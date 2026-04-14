# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ARG VITE_GROQ_API_KEY
ARG VITE_GEMINI_API_KEY

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Vite lee .env, no process.env — escribimos el archivo antes del build
RUN echo "VITE_SUPABASE_URL=${VITE_SUPABASE_URL}" > .env \
 && echo "VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY}" >> .env \
 && echo "VITE_SUPABASE_PROJECT_ID=${VITE_SUPABASE_PROJECT_ID}" >> .env \
 && echo "VITE_GROQ_API_KEY=${VITE_GROQ_API_KEY}" >> .env \
 && echo "VITE_GEMINI_API_KEY=${VITE_GEMINI_API_KEY}" >> .env

RUN npm run build

# ── Stage 2: Serve con nginx ──────────────────────────────────────────────────
FROM nginx:alpine

# Config nginx para SPA (React Router)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar el build
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]