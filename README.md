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

### Frontend
- `VITE_API_URL` — Backend API URL
<!-- deploy: task-file-ui -->
