/**
 * Ruta base del servidor WhatsApp.
 * En dev: Vite proxea /wa → VM o ngrok (según se eligió al iniciar).
 * En producción: apunta directo al servidor con HTTPS.
 */
export const WA_URL = import.meta.env.PROD
  ? (import.meta.env.VITE_WA_SERVER_URL ?? 'http://3.143.245.74:3001')
  : '/wa';
