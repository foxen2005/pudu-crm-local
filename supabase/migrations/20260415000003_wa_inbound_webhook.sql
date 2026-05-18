-- Trigger para notificar a n8n sobre nuevos mensajes de WhatsApp
CREATE OR REPLACE FUNCTION notificar_mensaje_wa_n8n()
RETURNS TRIGGER AS $$
DECLARE
  r_auto RECORD;
BEGIN
  -- Buscar automatizaciones de tipo 'wa_message' activas para esta org
  FOR r_auto IN
    SELECT webhook_url, nombre
    FROM automatizaciones
    WHERE org_id = NEW.org_id
      AND trigger_tipo = 'wa_message'
      AND activa = TRUE
      AND webhook_url IS NOT NULL
  LOOP
    -- Enviar a n8n vía pg_net
    PERFORM net.http_post(
      url := r_auto.webhook_url,
      body := jsonb_build_object(
        'event', 'wa_message_received',
        'automation_name', r_auto.nombre,
        'org_id', NEW.org_id,
        'message', jsonb_build_object(
          'id', NEW.id,
          'body', NEW.body,
          'direction', NEW.direction,
          'conversation_id', NEW.conversation_id,
          'created_at', NEW.created_at
        )
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar solo a mensajes entrantes
CREATE TRIGGER trigger_wa_message_n8n
AFTER INSERT ON whatsapp_messages
FOR EACH ROW
WHEN (NEW.direction = 'inbound')
EXECUTE FUNCTION notificar_mensaje_wa_n8n();
