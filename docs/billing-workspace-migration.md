# Billing: user-level modeldən provider workspace modelinə keçid

Status: **audit və plan**. Bu mərhələdə production-da billing, subscription, ödəniş, entitlement
və ya plan təyinatı ilə bağlı heç bir dəyişiklik edilmir. Bu sənəddə yalnız təhlil, hədəf model,
köçürmə qaydaları, risklər, dry-run və rollback planı var.

## 1. Hazırkı data modeli

| Cədvəl | Açar | Nəyi saxlayır | Qeyd |
|---|---|---|---|
| `subscriptions` | `user_id` PK | plan, status, period, `pending_plan`, `grace_until` | **Bir insana yalnız bir paket.** Əsas problem budur |
| `usage_counters` | `user_id` PK | tələbə sayı, SMS istifadəsi, storage, `extra_sms_balance`, `extra_storage_bytes` | Limitlər və add-on balansları da user-ə bağlıdır |
| `subscription_plans` | `slug` | paket limitləri və qiymətlər | Workspace-dən asılı deyil, olduğu kimi qalır |
| `billing_payments` | `id`, `user_id` | Payriff/manual ödənişlər, `product_type` (plan/sms/storage), `billing_interval` | Tarixçədir, silinməməlidir |
| `billing_history` | `id`, `user_id` | upgrade/downgrade/payment qeydləri | Tarixçədir |
| `billing_events` | `id`, `user_id` | analitika hadisələri | Tarixçədir |
| `trials`, `basic_trial_ip_claims` | `user_id` | sınaq müddəti və IP limitləri | Fərdi müəllim üçün qalır |
| `partner_commissions` | `billing_payment_id` UNIQUE | partnyor komissiyaları | Ödəniş ID-si dəyişməməlidir |
| `user_roles` | (`user_id`, `role`) | bir user-in bir neçə rolu | Artıq "bir identity, çox rol" modelidir |
| `courses` (+ `course_teachers`, `org_memberships`) | `owner_user_id` UNIQUE | təşkilat (tədris mərkəzi) | Təşkilat paketi hazırda sahibinin user paketidir |

Entitlement oxunuşu: `services/billingEntitlements.js`, `services/billingGetCurrentPlan.js`,
`middleware/entitlements.js`. Hamısı `WHERE user_id = $1` ilə işləyir.

Mövcud olmayanlar: ayrıca `coupons`/`discounts` və `invoices` cədvəli yoxdur.
`104_group_discount_join_terms` tələbə qrup qiymətinə aiddir, platforma billing-inə yox.
Qəbz rolunu `billing_payments` və `billing_history` oynayır.

## 2. Hədəf model

```text
User (login, identity)
 ├── Learner Profile          ← tələbə nəticələri, enrollment-lər (paketə bağlı deyil)
 └── Provider Workspace       ← fərdi müəllim/təlimçi iş məkanı
      ├── Subscription        ← workspace_subscriptions
      ├── Entitlements        ← workspace_usage_counters + subscription_plans
      ├── Exams, Groups, Live Lessons (owner = workspace)
Organization Workspace        ← courses (tədris mərkəzi); öz subscription-u
```

Yeni cədvəllər (təklif, hələ yaradılmır):

```sql
provider_workspaces (
  id UUID PK,
  kind TEXT CHECK (kind IN ('individual','organization')),
  owner_user_id UUID NOT NULL REFERENCES users(id),
  course_id UUID NULL REFERENCES courses(id),   -- kind='organization' üçün
  created_at, updated_at,
  UNIQUE (owner_user_id) WHERE kind = 'individual'
)
workspace_subscriptions (
  workspace_id UUID PK REFERENCES provider_workspaces(id),
  legacy_user_id UUID NULL,          -- reconciliation və rollback üçün
  plan, status, current_period_start, current_period_end,
  pending_plan, pending_effective_at, grace_until, provider, created_at, updated_at
)
workspace_usage_counters (workspace_id PK, ... usage_counters ilə eyni sütunlar)
billing_payments.workspace_id UUID NULL      -- yeni sütun, köhnə user_id saxlanılır
billing_history.workspace_id UUID NULL
```

## 3. Əsas qaydalar

1. Tələbənin hesabı heç vaxt paketə görə bloklanmır. Tələbə yoxlamaları (`/student/*`, imtahan verməsi) entitlement oxumur.
2. Müəllim paketi `provider_workspace_id`-yə bağlanır, user-in "aktiv rolu"na yox.
3. Bir user həm tələbə, həm müəllim ola bilər. Workspace dəyişmək (`/auth/switch-workspace`) subscription-u silmir və dəyişmir.
4. Köhnə user-level billing məlumatı dərhal silinmir. `subscriptions` və `usage_counters` ən azı iki billing dövrü read-only ehtiyat kimi qalır.
5. Ödəniş sətirləri köçürülmür, yalnız `workspace_id` ilə etiketlənir. `billing_payments.id` dəyişmir, ona görə `partner_commissions` pozulmur.

## 4. Mapping qaydası (user → workspace)

Dry-run skriptinin 3-cü və 4-cü bölmələri hər subscription-u aşağıdakı `target_kind`-a ayırır:

| target_kind | Şərt | Addım |
|---|---|---|
| `provider_workspace` | aktiv user, `role='instructor'` və ya aktiv `user_roles.instructor` | 1 fərdi workspace yaradılır, subscription və usage köçürülür |
| `org_workspace` | `courses.owner_user_id = user_id` | Təşkilat workspace-i yaradılır, sahibin paketi ora köçürülür. Sahib başqa yerdə fərdi dərs deyirsə, ona `basic` fərdi workspace verilir |
| `inactive_provider` | `is_active=false` və ya `deleted_at` dolu | Workspace yaradılır, subscription `status='canceled'` ilə köçürülür. Heç nə silinmir |
| `orphan_not_provider` | müəllim rolu yoxdur (placeholder student) | Köçürülmür, hesabatda saxlanılır, əl ilə baxılır |
| `orphan_user_missing` | user tapılmır | Köçürülmür, əl ilə baxılır |

Workspace-i olmayan provider-lər (dry-run 5-ci bölmə): köçürmə zamanı `basic`, `status='active'`
workspace alırlar. Bu, bu gün `072_backfill_instructor_plans_from_trials` ilə eyni davranışdır.

Bir user-in bir neçə workspace-i (dry-run 6-cı bölmə):
- təşkilat sahibi + fərdi müəllim → 2 workspace; ödənişli paket təşkilata gedir;
- başqa təşkilatda müəllim (`course_teachers`) → öz fərdi workspace-i + təşkilatda üzvlük. Təşkilatın paketi ona "miras" keçmir, təşkilat daxilində təşkilatın entitlement-i işləyir.

Həm tələbə, həm müəllim (dry-run 7-ci bölmə): tələbə məlumatları (`enrollments.student_id`,
`exam_results.student_id`) toxunulmur; müəllim paketi yalnız provider workspace-də oxunur.

## 5. Status mapping-i

| Mənbə | Hədəf |
|---|---|
| `plan` (basic/pro/business) | eyni `plan` |
| `status` active / past_due / canceled | eyni status |
| `current_period_start/end` | eyni |
| `pending_plan`, `pending_effective_at` (planlaşdırılmış downgrade) | eyni sahələr; downgrade cron-u workspace üzərindən işləyir |
| `grace_until` | eyni |
| `trials` (sınaq) | yalnız fərdi workspace-ə; təşkilat workspace-i sınaq almır |
| `extra_sms_balance`, `extra_storage_bytes` | `workspace_usage_counters`-ə tam məbləğlə |
| `billing_payments` (paid/pending/failed/expired) | köçürülmür; `workspace_id` doldurulur |
| pending ödəniş (checkout açıqdır) | köçürmədən əvvəl `billingPaymentsReaper` ilə bağlanması gözlənilir; callback gələrsə `user_id` → workspace resolver işləyir |
| kupon / endirim | cədvəl yoxdur, köçürüləcək məlumat yoxdur |
| invoice | ayrıca cədvəl yoxdur; `billing_payments` + `billing_history` qəbz rolunu saxlayır |
| cancellation | `status='canceled'` olduğu kimi köçürülür |

Upgrade/downgrade qaydaları dəyişmir, amma hədəf `workspace_id` olur:
- upgrade dərhal qüvvəyə minir, ödəniş workspace-ə yazılır;
- downgrade `pending_plan` ilə dövrün sonunda; `assertDowngradeAllowed` limitləri workspace-in `usage_counters`-i ilə yoxlayır;
- tələbə kabinetinə keçid heç bir upgrade/downgrade yaratmır.

## 6. Risklər

| Risk | Harada görünür | Azaldılması |
|---|---|---|
| Dublikat subscription (fərdi + təşkilat sahibi eyni anda ödəyir) | dry-run 8: `org_owner_is_also_paying_individually` | Əl ilə qərar: ödənişli paket təşkilata, fərdi `basic` |
| Ödənişsiz ödənişli paket | 8: `paid_plan_without_any_paid_payment` | Tarixi backfill/manual verilmiş ola bilər; olduğu kimi köçürülür, siyahı admin-ə verilir |
| Usage counter-siz subscription | 8: `subscription_without_usage_counter` | Köçürmədə sıfır counter yaradılır |
| Sınaq + ödənişli paket eyni anda | 8: `active_trial_and_paid_plan` | Paket üstündür; trial bağlanmır, sadəcə entitlement-ə təsir etmir |
| Açıq pending ödənişlər | 8: `multiple_pending_payments_same_user` | Köçürmə pəncərəsində yeni checkout bağlanır, reaper-in bitməsi gözlənilir |
| Partner komissiyası itməsi | 8: `partner_commission_on_orphan_payment` | `billing_payments.id` dəyişmir, yalnız `workspace_id` əlavə olunur |
| Data itkisi | — | Köhnə cədvəllər silinmir; `legacy_user_id` saxlanılır; backup məcburidir |
| Callback köhnə user_id ilə gəlir | Payriff return | Resolver: `workspace_id` yoxdursa `user_id` → fərdi workspace |

## 7. Rollout (hər addım ayrıca deploy)

1. **Schema (additive):** yeni cədvəllər və nullable `workspace_id` sütunları. Kod dəyişmir.
2. **Backfill:** bir tranzaksiyada workspace + subscription + usage köçürülür, `legacy_user_id` doldurulur. Reconciliation işlədilir.
3. **Dual-write:** `billingEntitlements` həm köhnə, həm yeni cədvələ yazır; oxunuş hələ köhnədən.
4. **Shadow-read:** hər sorğuda iki mənbə müqayisə olunur, fərq log-lanır (1–2 həftə).
5. **Read switch:** oxunuş yeni cədvəldən, feature flag ilə (`feature.workspace_billing.enabled`), geri qaytarmaq bir kliklik.
6. **Köhnə yazının dayandırılması:** ən azı iki billing dövründən sonra. Köhnə cədvəllər read-only saxlanılır.

## 8. Rollback

- Addım 1–3: yeni cədvəllər/sütunlar boşdur və ya dublikatdır; flag OFF qalır, köhnə model tam işləyir. Lazım olsa yeni cədvəllər drop edilir.
- Addım 4–5: flag OFF → oxunuş dərhal köhnə cədvələ qayıdır. Dual-write sayəsində köhnə cədvəl aktualdır.
- Addım 6-dan sonra: `workspace_subscriptions.legacy_user_id` ilə köhnə cədvələ geri yazma skripti (reconciliation checksum-u ilə yoxlanılır).

## 9. Dry-run və reconciliation

Hər iki skript `BEGIN TRANSACTION READ ONLY` ilə işləyir və `ROLLBACK` ilə bitir. Bazada heç nə dəyişmir.

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/scripts/sql/billing-workspace-dry-run.sql > dry-run.txt
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/scripts/sql/billing-workspace-reconciliation.sql > recon-before.txt
```

Dry-run bölmələri: (1) ümumi saylar, (2) paket × status, (3) hədəf təsnifatı, (4) tam siyahı,
(5) subscription-u olmayan provider-lər, (6) çox workspace-li user-lər, (7) tələbə+müəllim user-lər,
(8) risk sayğacları, (9) add-on balansları, (10) ödəniş tarixçəsi həcmi.

Lokal test bazasında nümunə reconciliation çıxışı (1 pro müəllim):

```text
== A. Mənbə (user-level) nəzarət cəmləri ==
 subscriptions_total | plan_basic | plan_pro | plan_business | status_active | status_past_due | pending_changes |             checksum
---------------------+------------+----------+---------------+---------------+-----------------+-----------------+----------------------------------
                   1 |          0 |        1 |             0 |             1 |               0 |               0 | 2a4723d4bb62112b02a718f6fd687176
== B. Hədəf (workspace-level) nəzarət cəmləri — yalnız köçürmədən sonra ==
NOTICE:  provider_workspaces hələ yoxdur — bu, köçürmədən ƏVVƏLKİ hesabatdır.
 workspace_subscriptions_total | workspace_checksum | payments_without_workspace
-------------------------------+--------------------+----------------------------
                               |                    |
```

Köçürmədən sonra gözlənilən: `subscriptions_total = workspace_subscriptions_total`,
`checksum = workspace_checksum`, `payments_without_workspace = 0`.

## 10. Production köçürməsindən əvvəl test checklist

- [ ] Dry-run production-un **kopyasında** işlədilib, risk sayğacları admin-lə gözdən keçirilib
- [ ] `orphan_*` və `org_owner_is_also_paying_individually` siyahıları üzrə əl ilə qərar verilib
- [ ] Staging-də backfill + reconciliation: checksum-lar bərabərdir
- [ ] Payriff sandbox: yeni checkout, callback, uğursuz ödəniş, expired ödəniş workspace-ə yazılır
- [ ] SMS və storage add-on alışı workspace balansına düşür
- [ ] Downgrade (`pending_plan`) dövr sonunda workspace-də tətbiq olunur
- [ ] Tələbə + müəllim user: tələbə kabinetində heç bir billing banneri/blok yoxdur
- [ ] Workspace keçidi (`switch-workspace`) subscription-u dəyişmir
- [ ] Təşkilat müəllimi: təşkilat daxilində təşkilatın limitləri, fərdi işdə öz limitləri
- [ ] Partner komissiyaları: sayı və məbləği köçürmədən əvvəl/sonra eynidir
- [ ] Flag OFF → köhnə model dərhal işləyir (rollback məşqi)

## 11. Production köçürməsi zamanı

1. **Backup:** tam `pg_dump` + Railway volume snapshot. Bərpa staging-də yoxlanılıb.
2. **Pəncərə:** aşağı trafik saatı; yeni checkout müvəqqəti bağlanır (banner), cron-lar (`billingPaymentsReaper`, `markPastDueSubscriptions`, `billingNotifications`) dayandırılır.
3. **Tranzaksiya:** backfill tək tranzaksiyada, `SET lock_timeout = '5s'`, `statement_timeout` ilə.
4. **Reconciliation:** dərhal `recon-after.txt`; checksum uyğun deyilsə `ROLLBACK`.
5. **Monitoring:** 402/403 entitlement cavablarının sayı, Payriff callback xətaları, shadow-read fərq log-ları, SMS göndərmə xətaları.
6. **Rollback meyarı:** checksum fərqi, entitlement xətalarında sıçrayış və ya ödəniş callback-lərində xəta → flag OFF, lazım olsa backup-dan bərpa.
