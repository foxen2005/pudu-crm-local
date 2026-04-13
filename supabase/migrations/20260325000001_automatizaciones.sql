-- ══════════════════════════════════════════════
-- PUDU CRM - Tabla automatizaciones
-- Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS automatizaciones (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL,
  nombre                TEXT NOT NULL,
  trigger_tipo          TEXT NOT NULL DEFAULT 'deal_idle',
  trigger_dias          INTEGER DEFAULT 7,
  accion_tipo           TEXT NOT NULL DEFAULT 'crear_actividad',
  accion_titulo         TEXT NOT NULL DEFAULT 'Seguimiento automático',
  accion_tipo_actividad TEXT DEFAULT 'tarea',
  activa                BOOLEAN DEFAULT TRUE,
  ejecuciones           INTEGER DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automatizaciones_log (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL,
  automatizacion_id    UUID NOT NULL REFERENCES automatizaciones(id) ON DELETE CASCADE,
  negocio_id           UUID NOT NULL,
  fired_at             TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para búsquedas rápidas de log
CREATE INDEX IF NOT EXISTS idx_auto_log_lookup
  ON automatizaciones_log (automatizacion_id, negocio_id, fired_at);

-- RLS
ALTER TABLE automatizaciones      ENABLE ROW LEVEL SECURITY;
ALTER TABLE automatizaciones_log  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON automatizaciones
  FOR ALL USING (org_id = get_my_org_id())
  WITH CHECK (org_id = get_my_org_id());

CREATE POLICY "org_isolation" ON automatizaciones_log
  FOR ALL USING (org_id = get_my_org_id())
  WITH CHECK (org_id = get_my_org_id());
