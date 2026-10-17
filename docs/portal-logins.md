# Portal girişləri

«Bir hesab, çox rol» modeli saxlanılır: portal yalnız hesabın **artıq sahib olduğu** rollardan birini aktiv kabinet edir. Yoxlama serverdədir; frontend yalnız mesaj göstərir və yönləndirir.

| URL | Başlıq | Tələb olunan rol | Kabinet |
| --- | --- | --- | --- |
| `/login` | Giriş seçimi (4 kart, `?next=` ötürülür; `?admin=true` → `/login/admin`) | — | — |
| `/login/student` | Tələbə kabinetinə giriş | `student` | `/student` |
| `/login/instructor` | Təlimçi kabinetinə giriş | `teacher` | `/instructor` |
| `/login/organization` | Təşkilat kabinetinə giriş | `organization_admin` (təşkilatda `owner`/`org_admin`) | `/org` |
| `/login/admin` | Admin panelinə giriş | `super_admin` | `/admin` |

`/register` (Google qeydiyyatı + onboarding) dəyişməyib.

## Server

Mövcud endpoint-lər `portal` sahəsini qəbul edir (yeni auth yoxdur):
`POST /auth/google/login`, `/auth/google/complete`, `/auth/login/email`, `/auth/login` (admin parolu).

- Rol var → `users.role` portal roluna keçir (kabinet dəyişdiricisinin eyni yolu ilə — `applyPersonaSelection`), adi sessiya tokeni + `redirect` qaytarılır.
- Rol yoxdur → `403 PORTAL_ROLE_REQUIRED`, **token yoxdur**, aktiv kabinet dəyişmir. Mesaj: «Bu hesabda tələbə / təlimçi / təşkilat / admin girişi üçün icazə yoxdur.» Heç bir rolu olmayan hesab üçün `can_register: true`.
- Portal girişi hesab yaratmır və rol vermir (müəllim icazəsi yenə rol sorğusu ilə).
- Google hesab bağlama (`link/confirm`) seçilmiş portalı imzalı link tokeni daxilində daşıyır.
- `portal` göndərilməyəndə köhnə davranış dəyişmir (dəvət səhifələri, köhnə client-lər).
- `GET /public/auth-options` → `{ password_login }`: email/şifrə formu istifadəçi portallarında yalnız `LEGACY_PASSWORD_LOGIN_ENABLED=true` olanda göstərilir; admin formu həmişə.

Kod: `backend/src/services/portalAccess.js`, `controllers/authController.js` (`respondPortalSession`).

## Frontend

`pages/auth/LoginChooser.jsx`, `pages/auth/PortalLogin.jsx`, konfiqurasiya `lib/loginPortals.js`.
Ortaq komponentlər: `components/auth/AuthShell.jsx` (çərçivə), `components/auth/PasswordLoginForm.jsx` (mövcud admin formu, indi email rejimi ilə), `components/auth/PublicGoogleSignIn.jsx` (`portal` prop).
Girişdən sonra: eyni kabinet daxilindəki təhlükəsiz `?next=` saxlanılır (tələbə üçün dəvət səhifələri də), əks halda serverin `redirect`-i.
