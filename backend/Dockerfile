FROM node:18-bullseye-slim

WORKDIR /app

# Install deps first (better layer caching)
COPY package.json package-lock.json ./
RUN test -f package-lock.json && npm ci --omit=dev --no-audit --no-fund

# App source
COPY . .

ENV NODE_ENV=production

# Railway provides PORT at runtime
EXPOSE 3000

RUN chmod +x /app/start.sh
CMD ["/app/start.sh"]

