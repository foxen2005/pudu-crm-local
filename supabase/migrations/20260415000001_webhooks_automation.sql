-- Añadir soporte para webhooks en las automatizaciones
ALTER TABLE automatizaciones ADD COLUMN IF NOT EXISTS webhook_url TEXT;

-- Comentario para documentación
COMMENT ON COLUMN automatizaciones.webhook_url IS 'URL del Webhook (ej. n8n, Zapier) a disparar cuando se cumpla el trigger.';
