/**
 * Ruta base del servidor WhatsApp.
 * En dev: Vite proxea /wa → EC2 (vite.config.ts).
 * En prod: nginx en Cloud Run proxea /wa → EC2 (nginx.conf).
 * El browser nunca hace requests HTTP directos (evita Mixed Content).
 */
export const WA_URL = '/wa';
