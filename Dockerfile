# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ── Stage 2: Serve con nginx ──────────────────────────────────────────────────
FROM nginx:alpine

# Config nginx para SPA (React Router)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar el build
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]