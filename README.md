# Mentorix

Production-grade School Management SaaS

## Struktur

```
mentorix/
├── backend/   → Node.js + Express + PostgreSQL
└── frontend/  → React + Vite + Tailwind CSS
```

## Backend Qurulum

```bash
cd backend
npm install
cp .env.example .env
# .env faylını doldurun
npm run dev
```

## Frontend Qurulum

```bash
cd frontend
npm install
npm run dev
```

## Deploy

- **Backend** → Railway
- **Frontend** → Vercel

## Environment Variables

### Backend
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — JWT secret (ən azı 32 simvol; Railway Variables)
- `RESEND_API_KEY` — Resend API key
- `VERIFY_EMAIL_FROM` — verified Resend FROM (məs. `Mentorix <notifications@mentorix.io>`). Domain must be verified in [Resend Domains](https://resend.com/domains) — code cannot verify it.
- `INSTRUCTOR_COMPLETE_PROFILE_FROM` — optional override for incomplete-instructor reminders (falls back to `VERIFY_EMAIL_FROM` / `EMAIL_FROM`)
- `SMS_LOGIN` — sendsms.az login
- `SMS_PASSWORD` — sendsms.az password
- `GOOGLE_CLIENT_ID` — Google OAuth client ID. Giriş və qeydiyyat yalnız Google ilə işləyir
- `LEGACY_PASSWORD_LOGIN_ENABLED` — yalnız keçid dövrü üçün `true`; köhnə parol/OTP girişini müvəqqəti açır (default: bağlı)

### Frontend
- `VITE_API_URL` — Backend API URL
- `VITE_GOOGLE_CLIENT_ID` — backend-dəki `GOOGLE_CLIENT_ID` ilə eyni
- `PUBLIC_SITE_ORIGIN` (Vercel və Railway) — paylaşım preview-larında kanonik domen. Yeni domen qoşulana qədər boş saxlayın
- `BRAND_NAME`, `BRAND_DOMAIN`, `BRAND_TAGLINE`, `BRAND_DESCRIPTION`, `BRAND_PREVIEW_TAGLINE`, `SUPPORT_EMAIL` (Vercel və Railway; frontend build üçün `VITE_` prefiksi də işləyir) — ictimai brend. Default: Mentorix. Bax `docs/rebrand/`

## Platforma funksiyaları (feature flag)

Admin panelində **Platforma funksiyaları** (`/admin/feature-flags`) bölməsindən idarə olunur, hər dəyişiklik audit log-a yazılır.
Söndürülmüş modul menyudan, CTA-lardan və API-dən gizlədilir; məlumat silinmir.

| Açar | Default |
|---|---|
| `feature.university_search.enabled` | söndürülüb |
| `feature.marketplace.enabled` | söndürülüb |
| `feature.live_room.enabled` | söndürülüb (Zoom/Google Meet dərsləri açıqdır) |
| `feature.exam_result_modes.enabled` | aktiv |
| `feature.proctoring.enabled` | söndürülüb (hazır deyil) |

Billing-in workspace modelinə köçürülməsi üçün audit və yalnız oxuyan dry-run skriptləri: `docs/billing-workspace-migration.md`.

WhatsApp/Telegram/Facebook link preview sistemi (server-side Open Graph, 1200×630 brend kartları, privacy qaydaları, test planı): `docs/social-link-previews.md`.
<!-- deploy: task-file-ui -->
