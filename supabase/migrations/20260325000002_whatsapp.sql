-- ══════════════════════════════════════════════
-- PUDU CRM - WhatsApp Business Integration
-- Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════

-- Credenciales por organización
ALTER TABLE organizaciones
  ADD COLUMN IF NOT EXISTS wa_phone_number_id TEXT,
  ADD COLUMN IF NOT EXISTS wa_access_token    TEXT,
  ADD COLUMN IF NOT EXISTS wa_verify_token    TEXT;

-- Conversaciones
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL,
  contact_id       UUID REFERENCES contactos(id) ON DELETE SET NULL,
  contact_phone    TEXT NOT NULL,
  contact_nombre   TEXT,
  status           TEXT DEFAULT 'open',
  last_message_at  TIMESTAMPTZ,
  session_expires_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Mensajes
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL,
  conversation_id  UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  wamid            TEXT UNIQUE,
  direction        TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  message_type     TEXT NOT NULL DEFAULT 'text',
  body             TEXT,
  content          JSONB,
  status           TEXT DEFAULT 'sent',
  sent_by_nombre   TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_msgs_conv    ON whatsapp_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_wa_conv_contact ON whatsapp_conversations(org_id, contact_id);

-- RLS
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON whatsapp_conversations
  FOR ALL USING (org_id = get_my_org_id()) WITH CHECK (org_id = get_my_org_id());

CREATE POLICY "org_isolation" ON whatsapp_messages
  FOR ALL USING (org_id = get_my_org_id()) WITH CHECK (org_id = get_my_org_id());

-- Realtime (para chat en vivo)
ALTER TABLE whatsapp_messages REPLICA IDENTITY FULL;
