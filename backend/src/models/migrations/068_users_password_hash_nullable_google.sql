-- OAuth (Google Identity Services) üsulu ilə yaradılan istifadəçilərdə klassik şifrə olmaya bilər.
-- Bəzi prod DB şemalarında `users.password_hash` NOT NULL olduğu üçün Google ilə INSERT partlayır.
-- Bu dəyişiklik Google-only və ya PIN əsaslı sessiyanı pozmur; mövcud NULL olmayan dəyərlər toxunulmur.

ALTER TABLE users
  ALTER COLUMN password_hash DROP NOT NULL;
