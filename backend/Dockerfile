FROM node:18-bullseye-slim

WORKDIR /app

# Install deps first (better layer caching)
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# App source
COPY . .

ENV NODE_ENV=production

# Railway provides PORT at runtime
EXPOSE 3000

CMD ["bash", "-lc", "node scripts/migrate.js && node src/app.js"]

