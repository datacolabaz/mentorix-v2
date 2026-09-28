# Resulio rebrendi — Phase 0 audit və plan

Status: **audit, təsdiq gözləyir**. Production-a heç nə deploy olunmayıb. İctimai ad dəyişdirilməyib.

Brend adı konfiqurasiyaya çıxarılıb: `BRAND_NAME` və digər dəyişənlər, susmaya görə **Mentorix**.
Ad təsdiqlənəndə dəyişiklik yalnız env ilə edilir (bax §4). `[RESULIO_DOMAIN]` hələ məlum deyil.

Məhsulun mövqeyi: **assessment management + results analytics**, yəni imtahan yarat → keçir →
cavabları topla → yoxla → təhlil et → icazə verilən nəticəni göstər → fərdi və qrup
performansını izlə → nəticəni təhlükəsiz paylaş. Sual bankı, quiz, Q&A, mentor marketplace və
universitet axtarışı dili istifadə olunmur.

Hər bənddə status belə göstərilir:
- ✅ hazırdır (əvvəlki mərhələlərdə edilib)
- 🟡 qismən
- ⛔ yoxdur və ya prompt ilə ziddiyyət var
- 🔒 təsdiq tələb edir

---

## 1. Kod bazası auditi (xülasə)

Sayılar `rg` ilə alınıb. `export/`, `docs/`, `package-lock.json` və test faylları çıxılıb.

| Axtarış | Fayl | Uyğunluq | Qeyd |
|---|---|---|---|
| `Mentorix` (böyük hərflə, ictimai mətn) | 120+ | ~520 | locales 292, frontend pages 51, lib 39, backend services 65, controllers 29 |
| `mentorix` (bütün hallar, identifikatorlar daxil) | 161 | 824 | `mentorix_live`, `MENTORIX_API_ORIGIN`, `MentorixLiveProvider` və s. |
| `mentorix.io` URL | 36 | 125 | `index.html` 27, robots, sitemap, email servisləri, OG |
| `mentorix.az` | 6 | 7 | ⛔ səhv domen fallback: `Certificates.jsx`, `catalogWaitlistEmailService.js` |
| `edupanel.co` (API domeni) | 7 | 13 | API domeni, dəyişməməlidir |
| `mentor` | 219 | 1626 | mentor modulu (flag ilə söndürülüb), `frontend/src/mentor/*` AI köməkçi |
| `universit` | 106 | 1217 | universitet axtarışı modulu (flag ilə söndürülüb) |
| `marketplace` | 59 | 360 | flag ilə söndürülüb |
| `live_room` / `livekit` | 50 | 272 | daxili video otaq (flag ilə söndürülüb) |
| `organization` / `/org/` | 32 | 197 | ⛔ org workspace mövcuddur (prompt: qurmayın) |
| `/course/*` kurs mərkəzi | 9 route | — | ⛔ təhsil mərkəzi ERP-si mövcuddur (tələbələr, maliyyə, leads) |
| `parent` rolu | — | — | ⛔ prompt yalnız Student/Teacher/Partner/Admin deyir |
| `partner` | 64 | 1005 | referral sistemi mövcuddur (§15) |
| `subscription` | 109 | 407 | user səviyyəsində (§16) |
| Email göndərən (`VERIFY_EMAIL_FROM`, Resend) | 21 | 114 | §8 |
| `og:` | 6 | 51 | yeni preview sistemi hazırdır (§9) |
| `MENTORIX_*` env | 35 | 110 | dəyişməməlidir (§3) |

Yönləndirmə dili (dəyişməli olan mətnlər):

| Yer | İndiki mətn | Təklif |
|---|---|---|
| `locales/az` `landing.*.subtitle` | "AI dəstəkli imtahan platforması. **Sual bankı**, avtomatik bal…" | "İmtahan yaradın, nəticələri avtomatik yoxlayın və tələbə performansını təhlil edin." |
| `locales/*` feature kartları | "Sual bankınızdan seçin…", "Sual bankınızı… qurun" | "Mövcud imtahanlarınızdan yenisini qurun…" |
| `lib/publicSeoLandings.js`, `locales/publicLandings.js` | "imtahan platforması — sual bankı, vaxt limiti…" | "…vaxt limiti, avtomatik yoxlama, nəticə analitikası və hesabatlar" |
| `locales/en` SEO keywords | "question bank" | "assessment, exam results, analytics" |
| `index.html` keywords | "müəllim axtarışı, valideyn kabineti, SMS…" | assessment açar sözləri |
| `index.html` description | "…Müəllim, tələbə və valideyn…" | brend təsviri (`BRAND_DESCRIPTION`) |
| `constants/orgNav.js` | "Sual bankı" (yalnız org paneli) | org modulu barədə qərardan asılıdır (§11) |
| Live poll `quiz` | canlı dərsdə sorğu növü | live room söndürülüb, toxunulmur |

## 2. Dəyişəcək faylların siyahısı (Phase 1)

**Frontend (ictimai mətn):**
- `src/locales/{az,ru,en}/translation.json`: "Mentorix" → `{{brand}}` interpolasiyası. i18next `interpolation.defaultVariables.brand` = `BRAND.name`.
- `src/locales/publicLandings.js`, `src/lib/publicSeoLandings.js`
- `src/components/common/Brand.jsx` (loqo və wordmark), `Footer.jsx`, `PublicMarketingNav.jsx`
- `src/pages/auth/Landing.jsx`, `AuthPage.jsx`, `PersonaOnboarding.jsx`
- `src/pages/public/*` (SEO landing-lər, sertifikat səhifələri)
- `src/lib/mentorixSeoSchema.js` (JSON-LD `Organization.name` və `url`)
- `src/pages/student/Certificates.jsx` (`mentorix.az` fallback → `BRAND.domain`)
- `src/mentor/*` (AI köməkçi mətnlərində "Mentorix" adı)
- `index.html` (qalan 27 `mentorix.io` → `__BRAND_DOMAIN__` token)
- `public/site.webmanifest` (`name`, `short_name`), `public/robots.txt` (sitemap URL), favicon və loqo SVG-ləri (dizayn gözləyir)
- `api/sitemap.xml.js`

**Backend (email, SMS, PDF, bildiriş):**
- `services/emailService.js` və bütün `*EmailService.js` (subject, footer, göndərən adı)
- `services/smsService.js` (SMS imzası)
- `services/certificateService.js`, `certificatePdfService.js`, `lib/certificateLayout.js` (**yalnız yeni sertifikatlar**)
- `jobs/*` (xatırlatma mətnləri), `constants/defaultLoginMarketing.js`
- `controllers/authController.js`, `publicOgController.js` (köhnə OG endpoint-ləri)
- `constants/publicSitemapUrls.js`, `lib/frontendBaseUrl.js`

Hamısı `getBrand()` / `BRAND` ilə edilir. Kor find-and-replace edilmir.

## 3. Dəyişməyəcək fayllar və identifikatorlar

| Nə | Niyə |
|---|---|
| DB cədvəl və sütunları, migration faylları (tarixi şərhlər daxil) | data sabitliyi |
| `live_rooms.provider = 'mentorix_live'`, `MentorixLiveProvider` | DB-də saxlanılan dəyər |
| Env adları: `MENTORIX_API_ORIGIN` və s. | production secret-ləri |
| `localStorage` açarları: `mx_token`, `mx_user`, `mx_active_workspace`, `mx_return_after_login` | dəyişsə bütün istifadəçilər çıxış edər |
| Analytics eventləri: `mx_landing_*`, `mx_public_landing_view` | tarixi hesabatlar kəsilər |
| API path-ları, `/api/billing/payriff/callback` webhook | Payriff və inteqrasiyalar |
| `api.edupanel.co` API domeni | OAuth redirect-ləri və webhook-lar bu domendədir |
| Fayl storage açarları, `/api/uploads/...` | yüklənmiş fayllar |
| Artıq verilmiş sertifikat PDF-ləri və QR linkləri (`/c/:token`) | hüquqi və tarixi sənəd. QR redirect ilə işləməyə davam edir |
| `package.json` adları (`mentorix-frontend`), repo adı, git tarixçəsi | daxili |
| `frontend/src/mentor/` qovluq adı | daxili, UI mətni dəyişir |

## 4. İctimai brend miqrasiya planı

**Artıq hazırdır (bu commit):**
- `backend/src/config/brand.js` → `getBrand()`
- `frontend/src/config/brand.js` → `resolveBrand(env)`, `applyBrandTokens()`
- Vite plugin `index.html`-də `__BRAND_*__` tokenlərini build zamanı əvəz edir
- `frontend/src/lib/brand.js` → `BRAND` (app üçün)
- Paylaşım kartları (OG) brendi env-dən götürür
- `npm run og:default` statik şəkli brendə görə yenidən yaradır

**Dəyişənlər** (Vercel və Railway-də eyni adlar; Vite build üçün `VITE_` prefiksi də işləyir):

```text
BRAND_NAME=Resulio
BRAND_DOMAIN=[RESULIO_DOMAIN]
LEGACY_DOMAIN=mentorix.io
BRAND_TAGLINE=İmtahan yarat. Nəticəni gör. İnkişafı ölç.
BRAND_DESCRIPTION=Müəllim və təlimçilər üçün imtahan, qiymətləndirmə və nəticə analizi platforması.
BRAND_PREVIEW_TAGLINE=İmtahan • Nəticə • Analitika
SUPPORT_EMAIL=support@[RESULIO_DOMAIN]
NOREPLY_EMAIL=noreply@[RESULIO_DOMAIN]
PUBLIC_SITE_ORIGIN=https://[RESULIO_DOMAIN]
```

**Phase 1 addımları:**
1. Yuxarıdakı faylları `BRAND`/`getBrand()`-ə keçirmək. Default Mentorix qalır, yəni istifadəçi heç nə görmür.
2. Staging-də `BRAND_NAME=Resulio` ilə vizual QA.
3. Təsdiqdən sonra production env dəyişdirilir və redeploy edilir.

## 5. Domen miqrasiyası və 301 redirect planı

| Addım | Harada |
|---|---|
| `[RESULIO_DOMAIN]` və `www.` Vercel-ə əlavə olunur, DNS qurulur | Vercel → Domains |
| `mentorix.io` → **Redirect to `[RESULIO_DOMAIN]`, 308** | Vercel domen redirect-i path və query-ni saxlayır |
| `www.mentorix.io` → eyni | Vercel |
| `mentorix.io` **aktiv qalır** (redirect domeni kimi, minimum 12 ay) | domen qeydiyyatı uzadılır |
| `PUBLIC_SITE_ORIGIN`, `FRONTEND_URL`, `FRONTEND_BASE_URL` yeni domenə | Railway və Vercel |

308 status 301 ilə eyni kalıcılıqdadır və POST metodunu da saxlayır. SEO üçün ikisi də qəbul olunur.

Real path-lar üzrə redirect xəritəsi. Prompt-dakı `/exams/:id`, `/invite/:token` və `/results/:id` nümunələri bu kodda yoxdur, real path-lar belədir:

| Köhnə | Yeni |
|---|---|
| `mentorix.io/login` | `[D]/login` |
| `mentorix.io/exam/:examId?…` | `[D]/exam/:examId?…` |
| `mentorix.io/task/:taskId` | `[D]/task/:taskId` |
| `mentorix.io/library/material/:id`, `/m/:token` | eyni path |
| `mentorix.io/library/:groupId`, `/join/:code` | eyni path |
| `mentorix.io/c/:token` (sertifikat QR) | eyni path |
| `mentorix.io/student/exams…` (nəticələr) | eyni path |
| `mentorix.io/teachers/:id`, `/sertifikatli-imtahanlar/…` | eyni path |

⚠ **Sessiya itkisi:** `localStorage` domenə bağlıdır. Domen dəyişəndə hər kəs bir dəfə yenidən "Google ilə davam et" basmalı olacaq. Data itmir, sadəcə sessiya yenilənir. Alternativ həll (token-i redirect ilə ötürmək) təhlükəlidir və tövsiyə edilmir.

## 6. Google OAuth miqrasiya çeklisti

Giriş Google Identity Services ID token ilə işləyir. Login üçün redirect URI yoxdur, yalnız **Authorized JavaScript origins** lazımdır.

- [ ] Google Cloud Console → OAuth client → JS origins: `https://[D]`, `https://www.[D]` əlavə edin. `https://mentorix.io` **silinməsin**.
- [ ] OAuth consent screen: app adı, loqo, homepage, privacy və terms URL-ləri. ⚠ Loqo və ya ad dəyişikliyi Google brand verification tələb edə bilər. Əvvəlcədən təqdim edin.
- [ ] Authorized domains: `[D]` əlavə olunur.
- [ ] Google Meet OAuth redirect `https://api.edupanel.co/api/teacher-connections/google_meet/callback`. API domeni dəyişmirsə toxunulmur.
- [ ] Zoom OAuth redirect (əgər qurulubsa) API domenindədir, toxunulmur.
- [ ] Test: köhnə və yeni domendə giriş; eyni `google_sub` → eyni user; dublikat yaranmır.
- ✅ `google_sub` identity, email avtomatik birləşdirmir, legacy bağlama təsdiqlə, `auth_events` audit. Bunlar hazırdır.

## 7. SEO miqrasiya çeklisti

- [ ] Google Search Console-da `[D]` property əlavə edin, sonra `mentorix.io` üçün **Change of Address** edin.
- [ ] `robots.txt`-də `Sitemap: https://[D]/sitemap.xml`
- [ ] `api/sitemap.xml.js` və `constants/publicSitemapUrls.js` `BRAND_DOMAIN`/`PUBLIC_SITE_ORIGIN`-dən oxusun.
- [ ] Canonical tag-lar `[D]`-ə. Preview sistemi hazırdır, `index.html` tokenlərində qismən.
- [ ] JSON-LD (`mentorixSeoSchema.js`): `name`, `url`, `sameAs`.
- [ ] Bing Webmaster, Yandex (varsa).
- [ ] Köhnə backlink-lər 308 ilə yönlənir, redirect zənciri yoxdur (tək hop).
- [ ] 2–4 həftə 404 və indeksləmə monitorinqi.

## 8. Email domeni çeklisti

- [ ] Resend-də `[D]` domenini əlavə edin: SPF, DKIM, DMARC.
- [ ] Domen verified olana qədər `VERIFY_EMAIL_FROM` köhnə göndərəndə qalır, yalnız görünən ad dəyişir: `Resulio <notifications@mentorix.io>`.
- [ ] Verified olandan sonra `noreply@[D]`, `support@[D]`.
- [ ] Köhnə emaillərdəki linklər `mentorix.io` üzərindən redirect ilə işləyir.
- [ ] Email şablonlarında ad, footer və support linki `getBrand()`-dən gəlsin (Phase 1).
- [ ] Reply-to və support qutusu yaradılır.

## 9. Open Graph / WhatsApp preview memarlığı

✅ Hazırdır: `docs/social-link-previews.md`.
- Serverdə meta tag-lar, 1200×630 dinamik PNG, allowlist, privacy-safe nəticə kartı.
- Keş versiyalama brend adını da nəzərə alır.
- Mətnlər qiymətləndirmə mövqeyinə uyğunlaşdırılıb. Ana səhifə: "{Brand} — İmtahan, qiymətləndirmə və nəticə analizi". Müəllim profili: "{fənlər} üzrə imtahanlar, materiallar və tapşırıqlar". Tagline: "İmtahan • Nəticə • Analitika".
- Testdə yoxlanılır ki, preview mətnində "sual bank", "quiz", "mentor", "universitet", "marketplace" yoxdur.

Ad dəyişəndə: `BRAND_NAME`, `BRAND_DOMAIN` və `PUBLIC_SITE_ORIGIN` təyin olunur, sonra `npm run og:default`.

## 10. Feature-flag planı

| Flag | İndi | Prompt |
|---|---|---|
| `feature.mentor_services.enabled` | ✅ söndürülüb | OFF |
| `feature.marketplace.enabled` | ✅ söndürülüb | OFF |
| `feature.university_search.enabled` | ✅ söndürülüb | OFF |
| `feature.live_room.enabled` | ✅ söndürülüb | OFF |
| `feature.exam_result_modes.enabled` | ✅ açıq | — |
| `feature.proctoring.enabled` | ✅ söndürülüb | — |
| 🔒 `feature.organization_workspace.enabled` (yeni) | yoxdur, org modulu açıqdır | prompt: org workspace qurulmasın |
| 🔒 `feature.course_center.enabled` (yeni) | yoxdur, `/course/*` açıqdır | prompt: təhsil mərkəzi yoxdur |
| 🔒 `feature.parent_portal.enabled` (yeni) | yoxdur, `/parent` açıqdır | prompt: yalnız 4 rol |

🔒 **Qərar lazımdır:** org, kurs mərkəzi və valideyn modulları hazırda işləyir və real istifadəçiləri ola bilər. Tövsiyə:
1. Əvvəlcə read-only SQL ilə aktiv istifadəçi sayını ölçmək.
2. Flag əlavə edib yeni qeydiyyatda gizlətmək.
3. Mövcud istifadəçilər üçün açıq saxlamaq.

Data silinmir.

## 11. Rol və icazə matrisi

| İmkan | Student | Teacher/Trainer | Partner | Admin |
|---|---|---|---|---|
| İmtahan vermək, öz nəticəsi (rejimə görə) | ✅ | — | — | — |
| İmtahan, tapşırıq, material yaratmaq | — | ✅ öz workspace-i | — | ✅ |
| Qrup tələbələrinin nəticə və engagement datası | — | ✅ öz qrupları | ⛔ | ✅ |
| Referral link, klik, konversiya, komissiya | — | — | ✅ yalnız özünün | ✅ |
| Tələbə şəxsi datası | özünün | öz tələbələri | ⛔ | ✅ |
| Komissiya təsdiqi, payout | — | — | ⛔ | ✅ |
| Feature flag-lar, audit | — | — | — | ✅ |

İndiki vəziyyət:
- `users.role` CHECK-də `admin`, `instructor`, `student`, `parent`, `course` dəyərləri var.
- `personas.js`-də `TEACHER`, `MENTOR`, `STUDENT`, `PARENT`, `PARTNER` var.
- `MENTOR` persona-sı flag ilə gizlidir, amma kodda qalır. Onboarding yalnız 2 niyyət göstərir (tələbə, müəllim/təlimçi) ✅.
- Partner ayrıca kontekstdir (multi-role membership) ✅.

## 12. Provider Workspace memarlığı

- İndi: `instructor` rolu və `instructor_profiles` faktiki olaraq Provider Workspace-dir. Müəllim və təlimçi eyni backend-i işlədir ✅.
- "Müəllim / Təlimçi / İmtahan hazırlığı / Qrup dərsi" yalnız profil etiketləridir. Ayrı hesab tipi yaradılmır.
- Bir Google user: learner profile + provider workspace + partner profile. `lib/multiRoleMembership.js` və `authController.switchWorkspace` bunu dəstəkləyir ✅.
- Gələcək: `provider_workspaces` cədvəli yalnız billing miqrasiyası ilə birlikdə (§16). İndi yaradılmır.

## 13. Nəticə rejimləri — sxem və API

✅ Hazırdır:
- 5 rejim, `results_release_at`, köhnə imtahanlar üçün uyğunluq xəritəsi və regresiya testləri (`examResultVisibility.test.js`).
- UI etiketi "Nəticələrin göstərilmə qaydası".

⛔ Prompt-da tələb olunan, kodda **olmayan** imtahan tənzimləmələri:

| Tənzimləmə | Vəziyyət |
|---|---|
| Cəhd sayı (attempts) | yoxdur |
| Sualların təsadüfi sırası | yoxdur |
| Variantların təsadüfi sırası | yoxdur |
| Keçid balı | yalnız sertifikat imtahanlarında (`certificate_pass_pct`) |
| İzah (explanation) sahəsi və görünməsi | yoxdur |
| Düzgün cavabın görünməsi (ayrıca toggle) | rejimin içindədir, ayrıca toggle yoxdur |

Təklif (ayrıca mərhələ):
- `exams` cədvəlinə `max_attempts`, `shuffle_questions`, `shuffle_options`, `pass_pct`, `show_correct_answers`, `show_explanations` sütunları.
- `exam_questions` cədvəlinə `explanation`.
- Hamısı default olaraq indiki davranışı saxlayır.

## 14. Engagement izləmə — sxem və API

✅ Hazırdır:
- `material_assignments`, `material_view_events`, `assignment_status`, `student_activity_log`, `reminder_log` cədvəlləri.
- Kartlar, hover/tap popover, dedupe, 6 saatlıq xatırlatma cooldown-u, rəng + ikon + mətn.
- Yalnız müəllim və admin görür.

🟡 Prompt ilə fərq: "Yeni / son aktivlik" üçün mavi status ayrıca göstərilmir. Kiçik UI işidir.

## 15. Partner / referral memarlığı

Mövcud cədvəllər:
- `partners`, `partner_profiles`
- `partner_referral_codes`, `partner_referral_links`, `partner_referral_clicks`
- `partner_attributions`, `partner_commissions`
- `partner_payouts`, `partner_payout_items`
- `partner_campaigns`, `partner_audit_events`, `referrals`

| Prompt qaydası | Kodda | Status |
|---|---|---|
| Admin partner müraciətini təsdiq və ya rədd edir | `partners.status` pending/approved/rejected/suspended | ✅ |
| Unikal link və kod | var | ✅ |
| Son klik atributsiyası, pəncərə 30 gün, server tərəfində | `attribution_window_days` | ✅ |
| Self-referral bloku | attribution və komissiyada | ✅ |
| Bir payment üçün bir komissiya | `UNIQUE(billing_payment_id)` | ✅ |
| **Komissiya əvvəlcə `pending`, admin təsdiqi** | ⛔ `partnerCommissionService` komissiyanı **birbaşa `approved`** yaradır | ⛔ düzəlməlidir |
| Refund və cancel üçün gözləmə müddəti (hold) | ⛔ yoxdur | ⛔ |
| Refund/chargeback → `reversed` | ⛔ `reversed` statusu yoxdur | ⛔ |
| Yalnız yeni user və yeni workspace | 🟡 attribution yeni qeydiyyata bağlıdır, workspace yoxlaması yoxdur | 🟡 |
| Yalnız ilk Pro ödənişi, yoxsa təkrarlanan | 🟡 kod `commission_duration_months` müddətində **hər ödənişə** komissiya yazır | 🔒 qərar |
| `partner_application`, `fraud_review`, `payout_request` | ⛔ ayrı cədvəl yoxdur (müraciət `partners` içindədir) | 🟡 |
| Avtomatik payout yoxdur | payout admin tərəfindən işarələnir | ✅ |
| Partner tələbə və müəllim datasını görmür | partner API-ləri yalnız öz sayğaclarını qaytarır | ✅ (QA ilə təsdiqlənməli) |

⚠ Komissiya statusunun dəyişdirilməsi billing-ə toxunur. Phase 11 qaydasına görə bu, ayrıca təsdiqlə və əvvəlcə staging-də edilməlidir.

## 16. Billing auditi

✅ `docs/billing-workspace-migration.md`. Yalnız audit, production-da dəyişiklik yoxdur.

## 17. Read-only billing dry-run

✅ `backend/scripts/sql/billing-workspace-dry-run.sql`, `billing-workspace-reconciliation.sql` (`READ ONLY` transaction).

## 18. Privacy və təhlükəsizlik riskləri

| Risk | Tədbir |
|---|---|
| Nəticə linki preview-da şəxsi data göstərir | ✅ generic kart və test |
| Domen dəyişəndə sessiya itkisi | bir dəfə yenidən giriş. Token URL ilə ötürülmür |
| Dəvət kodu və token preview mətnində | ✅ yalnız URL-də qalır |
| Redirect zəncirində query itkisi | Vercel 308 path və query-ni saxlayır, test edilir |
| Google consent ekranının dəyişməsi | verification gecikməsi. Əvvəlcədən təqdim edilir |
| Köhnə sertifikat QR-ları | `/c/:token` redirect ilə işləyir, `mentorix.io` bağlanmır |
| Partner komissiyasının avtomatik təsdiqi | ⛔ §15, düzəliş tələb olunur |
| Email spoofing (yeni domen) | SPF, DKIM, DMARC |
| Öz-özünə dəvət və fırıldaq | self-referral bloku var, fraud review cədvəli yoxdur |
| `mentorix.az` səhv fallback (`Certificates.jsx`, `catalogWaitlistEmailService.js`) | Phase 1-də `BRAND.domain` / `getBrand().domain` |

## 19. Geriyə uyğunluq strategiyası

- Brend yalnız env ilə dəyişir. DB, API, storage və env adları eyni qalır.
- `mentorix.io` redirect domeni kimi saxlanılır.
- Köhnə OG endpoint-ləri (`/api/public/og/*`) saxlanılır.
- Nəticə rejimləri: köhnə imtahanlar `show_results`-ə görə xəritələnir ✅.
- `localStorage` açarları və analytics event adları dəyişmir.

## 20. Rollback strategiyası

| Dəyişiklik | Rollback |
|---|---|
| Brend adı | `BRAND_NAME` silinir → Mentorix, redeploy |
| Domen redirect | Vercel-də redirect söndürülür, `mentorix.io` yenidən əsas domen olur |
| `PUBLIC_SITE_ORIGIN` | boş buraxılır, canonical sorğu host-una qayıdır |
| OG şəkilləri | `TEMPLATE_VERSION` artırılır |
| Feature flag-lar | admin paneldən bir kliklə |
| Email göndərən | `VERIFY_EMAIL_FROM` köhnə dəyərə |

## 21. Avtomatlaşdırılmış test planı

**Hazırdır:**
- `backend npm test`: 140 test. Nəticə rejimləri, engagement, requireFeature, share preview, brend default və env ilə dəyişmə, mövqe dili yasağı.
- `frontend node --test api/_lib/sharePreview.test.js`: meta injeksiyası və brend fallback.

**Phase 1 üçün əlavə olunacaq:**
- Snapshot testi: default build-də `index.html`-də `Mentorix`, `BRAND_NAME=Resulio` build-də `Resulio` olmalı, `__BRAND_` tokeni qalmamalıdır.
- Locale testi: `translation.json`-da sabit "Mentorix" qalmayıb, hamısı `{{brand}}`.
- Redirect testi (staging): `curl -I` ilə hər path və query üçün 308 və eyni path.
- Partner: `pending` → `approved` yalnız admin; refund → `reversed`; ikinci iddia bloklanır.

## 22. Manual QA çeklisti

**Giriş:**
- [ ] Mövcud Google user köhnə domendə girir.
- [ ] Yeni domendə eyni hesab açılır.
- [ ] Yeni user qeydiyyatdan keçir.
- [ ] Telefon və OTP soruşulmur.

**Redirect-lər:** login, imtahan, tapşırıq, material, qrup dəvəti, nəticə, sertifikat QR. Query və tokenlər saxlanılır.

**Tələbə:**
- [ ] Tarixi nəticələr görünür.
- [ ] Yeni rejimlər düzgün işləyir.

**Müəllim:**
- [ ] İmtahanlar, qruplar, tapşırıqlar və materiallar yerindədir.
- [ ] Engagement sayları düzgündür.

**Fayllar:** yüklənmiş PDF və şəkillər açılır.

**Söndürülmüş modullar:** birbaşa URL ilə açılanda "Bu funksiya hazırda aktiv deyil" göstərilir.

**Preview-lar:**
- [ ] WhatsApp, Telegram, Facebook Debugger, LinkedIn Inspector, Discord, Slack.
- [ ] Azərbaycan hərfləri və uzun başlıq düzgün çıxır.
- [ ] Nəticə kartında şəxsi data yoxdur.

**Email:** yeni göndərən adı, spam qovluğuna düşmür, linklər işləyir.

## 23. Production deploy planı

1. **Təsdiq:** ad (Resulio), domen, bu sənəd, 🔒 qərarlar (§10, §15).
2. **Hazırlıq (deploysuz):**
   - domen və DNS, Resend DNS;
   - Google OAuth JS origin və consent;
   - Search Console property.
3. **Phase 1 kodu** (brend konfiqurasiyasına keçid, default Mentorix): deploy edilir, istifadəçi fərq görmür.
4. **Staging:** `BRAND_NAME=Resulio`, `BRAND_DOMAIN=[D]` ilə tam QA (§22).
5. **Keçid günü**, aşağı trafik saatında:
   - production env dəyişənləri;
   - `npm run og:default`;
   - redeploy;
   - Vercel-də `mentorix.io` → 308 → `[D]`;
   - Search Console Change of Address.
6. **Yoxlama:** §24-dəki monitorinq ilə 1 saat intensiv.
7. **Problem olarsa:** §20.

## 24. Buraxılışdan sonra monitorinq

- Google login uğur və xəta sayı (`auth_events`: `login_failed`, `google_sign_in`).
- 404 sayı (Vercel logs), redirect hop sayı.
- Railway API 5xx.
- Email çatdırılması (Resend dashboard, bounce və spam).
- Search Console: indeksləmə və coverage.
- Preview şəkil funksiyasının xətaları (Vercel function logs, `[og] render failed`).
- Payriff callback uğuru (ödəniş axını dəyişməyib, amma domen keçidindən sonra yoxlanılır).

---

## Təsdiq üçün qərarlar

1. Final ictimai ad **Resulio**-dur? Domen hansıdır?
2. Org workspace, kurs mərkəzi (`/course`) və valideyn portalı: flag ilə yeni istifadəçilərdən gizlədilsin, mövcudlar üçün qalsın? (§10)
3. Partner komissiyası:
   - `pending` və admin təsdiqi;
   - hold müddəti neçə gün olsun (təklif: 14);
   - komissiya yalnız ilk Pro ödənişinə, yoxsa `commission_duration_months` müddətində hər ödənişə? (§15)
4. İmtahan tənzimləmələri (cəhd sayı, təsadüfi sıra, keçid balı, izah) ayrıca mərhələdə edilsin? (§13)
5. Phase 1 (kodun brend konfiqurasiyasına keçirilməsi, ad Mentorix qalır) indi başlasın?
