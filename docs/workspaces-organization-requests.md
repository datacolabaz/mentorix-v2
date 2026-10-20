# «Kabinetlərim» və «Təşkilat yarat»

## Qısa

- Bir hesab (Gmail) bir neçə kabinetə sahib ola bilər: İştirakçı, Müəllim, bir və ya bir neçə Təşkilat, Valideyn, Partner.
- Hansı kabinetlərin göstərildiyini **server** qərar verir (`GET /api/auth/workspaces`). Frontend yalnız siyahını çəkir.
- Kabinetlər arasında keçid çıxış etdirmir: `POST /api/auth/switch-workspace` yeni token qaytarır və hər keçidi yenidən yoxlayır.
- **Təşkilat yalnız «Təşkilat yarat» sorğusu ilə yaranır** və onu platforma admini təsdiqləyir. Müəllim rolu təşkilata giriş vermir.

## Verilənlər bazası (migration 240)

| Obyekt | Təyinat |
| --- | --- |
| `organization_requests` | `name`, `org_type` (education_center / school / company / other), `description`, `source` (workspace / onboarding), `status` (pending / approved / rejected / cancelled), `organization_id`, `reviewed_by/at`, `review_reason` |
| `uq_organization_requests_one_pending` | bir istifadəçinin eyni anda yalnız bir gözləyən sorğusu ola bilər |
| `users.active_organization_id` | bir neçə təşkilatı idarə edənlər üçün açıq olan təşkilat |
| `org_roles('owner')` + backfill | mövcud bütün təşkilatların sahibləri üçün `org_memberships(role_key='owner')` yazılır — mövcud sahiblər girişini itirmir |
| `auth_events` CHECK | `organization_request`, `organization_request_approved`, `organization_request_rejected` |

Geri qaytarma: `backend/scripts/sql/rollback/240_organization_requests_workspaces.rollback.sql`. Cədvəl və sütun silinir. Yaradılmış təşkilatlar və sahiblik qeydləri saxlanılır.

## API

| Metod | Yol | Kim |
| --- | --- | --- |
| GET | `/api/auth/workspaces` | daxil olmuş istifadəçi |
| POST | `/api/auth/switch-workspace` `{ target: student \| teacher \| organization \| parent, organization_id? }` | daxil olmuş istifadəçi |
| POST | `/api/organization-requests` `{ name, org_type, description? }` | daxil olmuş istifadəçi (təşkilatı yoxdursa) |
| GET | `/api/organization-requests/mine` | sorğu sahibi |
| POST | `/api/organization-requests/:id/cancel` | sorğu sahibi |
| GET | `/api/organization-requests?status=` | yalnız platforma admini |
| POST | `/api/organization-requests/:id/approve` | yalnız platforma admini (öz sorğusunu təsdiqləyə bilməz) |
| POST | `/api/organization-requests/:id/reject` `{ reason? }` | yalnız platforma admini |

Təsdiq bir tranzaksiyada icra olunur: sorğu `FOR UPDATE` ilə kilidlənir, təşkilat `ON CONFLICT (owner_user_id)` ilə yaradılır, sonra sahiblik qeydi, `course` rolu və profil yazılır. Eyni sorğunu iki dəfə təsdiqləmək və ya paralel təsdiq ikinci təşkilat yaratmır (ikincisi `409 ALREADY_RESOLVED` alır).

## Qorunma qaydaları

- `/api/course/*` marşrutları `requireOrgAccess` keçir. Təşkilatı olmayan istifadəçi `403 ORG_REQUIRED` alır və heç nə avtomatik yaranmır (`ensureOrgCourseForOwner` / `getOrgWorkspace` artıq təşkilat yaratmır).
- `switch-workspace` hədəfi `course`/`organization` olduqda `organization_admin` giriş rolu (sahib və ya org_admin üzvlüyü) tələb olunur.
- Başqasının `organization_id`-si ilə keçid `403 ORG_PERMISSION_REQUIRED` qaytarır.
- Qeydiyyatda «Təhsil mərkəzi» seçimi təşkilat yaratmır. Mərkəz adı ilə sorğu göndərir və `202 ORG_REQUEST_PENDING` qaytarır.

## Frontend

- `WorkspaceSwitcher.jsx` → «Kabinetlərim»: aktiv kabinet ✓ ilə işarələnir. Mobil ekranda siyahı aşağıdan açılan panel kimi göstərilir. Müəllim icazəsi və «Təşkilat yarat» əməliyyatlarının statusu (gözləyir / rədd edilib) görünür.
- `CreateOrganizationModal.jsx` — ad, növ, istəyə bağlı təsvir.
- `/admin/role-requests?tab=organizations` — «Təşkilat sorğuları» (təsdiq / rədd).
- Silinənlər: idarə panellərindəki «İstifadə məqsədi» kartı (`PersonaSettingsCard`) və yan menyunun altındakı ayrıca «Partner kabineti» linki. Partner kabineti yalnız partner qeydi olduqda «Kabinetlərim» siyahısında görünür.
- Tələbə girişi «Tələbə kabinetinə giriş» adlanır (`/login/student`).

## Deploy qeydi

Təsdiqlənmiş təşkilatı olmayan müəllimlər artıq `/org` kabinetinə daxil ola bilmir. Mövcud təşkilat sahiblərinin girişi backfill ilə qorunur. Belə müəllimlər «Kabinetlərim → Təşkilat yarat» ilə sorğu göndərir və admin təsdiqləyir.
