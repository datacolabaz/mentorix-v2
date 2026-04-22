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
- `JWT_SECRET` — JWT secret key
- `SMS_LOGIN` — sendsms.az login
- `SMS_PASSWORD` — sendsms.az password

### Frontend
- `VITE_API_URL` — Backend API URL
