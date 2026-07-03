FROM node:18-bullseye-slim

WORKDIR /app

# Install deps first (better layer caching). Skip postinstall — source not copied yet.
COPY package.json package-lock.json ./
RUN test -f package-lock.json && npm ci --omit=dev --no-audit --no-fund --ignore-scripts

# App source + certificate fonts
COPY . .
RUN node scripts/download-certificate-fonts.js

ENV NODE_ENV=production

EXPOSE 3000

RUN chmod +x /app/start.sh
CMD ["/app/start.sh"]
