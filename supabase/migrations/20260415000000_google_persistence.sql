-- Añadir persistencia de refresh token de Google para estabilidad de integraciones
ALTER TABLE miembros ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;

-- Comentario para documentación
COMMENT ON COLUMN miembros.google_refresh_token IS 'Refresh token de Google OAuth para renovar access tokens en segundo plano.';
