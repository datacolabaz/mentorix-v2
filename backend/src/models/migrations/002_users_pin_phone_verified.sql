-- Run once on existing DBs (Railway / local):
-- psql $DATABASE_URL -f backend/src/models/migrations/002_users_pin_phone_verified.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;
