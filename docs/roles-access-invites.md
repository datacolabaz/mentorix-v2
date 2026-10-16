# Rollar, icazələr, dəvət tokenləri və canlı dərs əlavələri

Migrasiya: `backend/src/models/migrations/237_role_access_invites_live_topics.sql` (additiv, idempotent).
Geri qaytarma: `backend/scripts/sql/rollback/237_role_access_invites_live_topics.rollback.sql` (əl ilə).

## Rollar

Mövcud saxlama rolları dəyişmir (`users.role`, `user_roles`, `org_memberships`). Platforma rolları
serverdə bunlardan hesablanır və `/auth/me` cavabında `access_roles` kimi qaytarılır:

| Platforma rolu | Haradan gəlir |
| --- | --- |
| `super_admin` | `users.role = 'admin'` |
| `organization_admin` | təşkilat üzvlüyü `owner` / `org_admin` |
| `corporate_manager` | təşkilat üzvlüyü `manager` |
| `teacher` | `instructor` rolu (təsdiqlə verilir) |
| `student` | `student` rolu (dəvət linki ilə qrupa qoşulma və ya ilk seçim) |
| `parent` | `parent` rolu (övladın `student_profiles.parent_id` əlaqəsi) |

`course` (təhsil mərkəzi paneli) hər müəllimdə avtomatik olduğu üçün ayrıca platforma rolu sayılmır.

### Sərbəst rol keçidi bağlıdır

`POST /auth/switch-workspace`, `PATCH /auth/persona` və `POST /auth/onboarding/*` yalnız istifadəçinin
**artıq sahib olduğu** kabinetə keçid edir.

- Müəllim (və ya təhsil mərkəzi) kabineti yoxdursa: keçid edilmir, gözləyən sorğu yaradılır →
  `202 { pending_approval: true, code: 'ROLE_APPROVAL_PENDING', role_request, user }` (yeni token verilmir).
- Tələbə/valideyn kabineti yoxdursa (ilk onboarding seçimi istisna): `403 ROLE_NOT_GRANTED`.
- Platforma açarı `access.teacher_role_approval.enabled` (default **ON**). Admin panelində söndürülsə köhnə
  davranış (dərhal keçid) qayıdır.

### Rol sorğuları — `/api/role-requests`

| Metod | Yol | Kim |
| --- | --- | --- |
| GET | `/mine` | istifadəçi: öz sorğuları + `access_roles`, `teacher_request` |
| POST | `/` `{ role: 'teacher', note?, organization_id? }` | istifadəçi (idempotent: bir gözləyən sorğu) |
| POST | `/:id/cancel` | istifadəçi |
| GET | `/?status=pending\|approved\|rejected\|all` | platforma admini (hamısı), təşkilat admini (yalnız öz təşkilatı) |
| POST | `/:id/approve` `{ reason? }` | eyni |
| POST | `/:id/reject` `{ reason? }` | eyni |

Təsdiq yalnız `instructor` üzvlüyünü verir; istifadəçinin aktiv kabineti dəyişmir — o özü müəllim
kabinetinə keçir (profil və sınaq müddəti həmin anda yaradılır). Təşkilat sorğusu təsdiqlənəndə
istifadəçi təşkilata `instructor` kimi əlavə olunur və `org_audit_events`-ə yazılır. Öz sorğusunu
təsdiqləmək olmaz. Sorğu, təsdiq və rədd `auth_events`-ə yazılır, tərəflərə bildiriş gedir.

### Sahiblik

- Müəllim: imtahan, sual bankı, qrup, material və tapşırıq dəyişiklikləri `instructor_id` yoxlamasından
  keçir (mövcud kod; bu dəyişiklikdə auditdən keçirildi).
- Tələbə: yalnız özünə təyin edilmiş imtahan/tapşırıq/material və öz nəticələri.
- Valideyn: `GET /api/parent/children`, `GET /api/parent/children/:studentId/results` — yalnız
  `parent_id` ilə bağlı övlad; açılmamış imtahan balı gizlədilir (tələbənin öz görünüş qaydası ilə eyni).
- Təşkilat admini: mövcud `/api/course/org/*` (icazə əsaslı) + öz təşkilatının müəllim sorğuları.

## Qrup dəvət tokenləri

Model: `group_invites (token, created_by, group_id, expires_at, max_uses, used_count, status, allowed_role, label, …)`
və jurnal `group_invite_redemptions (invite_id, user_id, group_id, enrollment_id, join_request_id, ip, user_agent, redeemed_at)`.

| Metod | Yol | Qeyd |
| --- | --- | --- |
| GET | `/api/instructor/invites?group_id=` | müəllimin öz linkləri |
| POST | `/api/instructor/groups/:groupId/invites` | `{ duration: '24h'\|'7d'\|'30d'\|'custom', expires_at?, max_uses (default 30), label? }` |
| POST | `/api/instructor/invites/:id/revoke` | ləğv |
| GET | `/api/instructor/invites/:id/redemptions` | kim, nə vaxt qoşulub |

- Token `INV-XXXXXXXXXXXX` formatındadır, link `/join/<token>` — mövcud qoşulma səhifəsi işlənir.
  Köhnə `MX-12345` qrup kodları əvvəlki kimi işləyir.
- Qoşulma tranzaksiyasında token sətri `FOR UPDATE` ilə kilidlənir: paralel qoşulmalar limiti aşa bilməz
  (DB `CHECK used_count <= max_uses` əlavə qorumadır). Uğursuz qoşulma istifadə sayını artırmır.
- Eyni istifadəçi eyni tokenlə yalnız bir dəfə (`UNIQUE (invite_id, user_id)`).
- Müddəti bitmiş, limiti dolmuş və ya ləğv edilmiş token: `410 INVITE_INACTIVE` —
  «Bu dəvət linki artıq aktiv deyil.» Qeydiyyat baş vermir.

## Canlı dərs

Mövcud «Canlı dərs yarat» funksiyası (əl ilə Zoom/Meet/digər HTTPS linki, xatırlatma bildirişləri,
davamiyyət) dəyişmir. Yeni API inteqrasiyası qurulmayıb.

- Yeni sahə: `topic` (mövzu). «Qeyd» mövcud `description` sahəsidir.
- Dərsdən sonra: `POST /api/live-lessons/:id/followups { kind: 'material'|'task'|'exam', ref_id, assign? }`,
  `DELETE /api/live-lessons/:id/followups/:followupId`. Yalnız müəllimin öz materialı/tapşırığı/imtahanı.
  `assign` (default `true`) tapşırıq/imtahanı dərsin tələbələrinə təyin edir. Tələbələrə
  `live_lesson_followup` bildirişi gedir. Dərs səhifəsində tələbə materialları və yalnız ona təyin
  edilmiş tapşırıq/imtahanları görür.
