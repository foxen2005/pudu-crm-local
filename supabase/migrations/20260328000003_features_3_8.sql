-- ══════════════════════════════════════════════════════════════════
-- PUDU CRM — Features 3–8
-- Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════

-- ── 3. Notificaciones ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notificaciones (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID REFERENCES organizaciones(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo         TEXT NOT NULL,
  titulo       TEXT NOT NULL,
  descripcion  TEXT,
  entidad_tipo TEXT,
  entidad_id   UUID,
  leida        BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_user" ON notificaciones USING (user_id = auth.uid());

-- pg_cron: generar notificaciones diarias a las 08:30 (Chile)
CREATE OR REPLACE FUNCTION pudu_generar_notificaciones()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  r RECORD;
BEGIN
  -- Actividades vencidas (fecha_hora < ahora y no completadas)
  FOR r IN
    SELECT a.id, a.titulo, a.org_id, m.user_id
    FROM actividades a
    JOIN miembros m ON m.org_id = a.org_id
    WHERE a.completada = false
      AND a.fecha_hora < now()
      AND NOT EXISTS (
        SELECT 1 FROM notificaciones n
        WHERE n.entidad_id = a.id
          AND n.tipo = 'actividad_vencida'
          AND n.created_at > now() - INTERVAL '24 hours'
      )
  LOOP
    INSERT INTO notificaciones (org_id, user_id, tipo, titulo, descripcion, entidad_tipo, entidad_id)
    VALUES (r.org_id, r.user_id, 'actividad_vencida',
            'Actividad vencida',
            r.titulo,
            'actividad', r.id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Negocios sin movimiento en actividades por 14+ días
  FOR r IN
    SELECT n.id, n.nombre, n.org_id, m.user_id
    FROM negocios n
    JOIN miembros m ON m.org_id = n.org_id
    WHERE n.etapa NOT IN ('Cierre', 'Cerrado Ganado', 'Cerrado Perdido', 'Facturado')
      AND NOT EXISTS (
        SELECT 1 FROM actividades a
        WHERE a.negocio_id = n.id
          AND a.created_at > now() - INTERVAL '14 days'
      )
      AND NOT EXISTS (
        SELECT 1 FROM notificaciones nt
        WHERE nt.entidad_id = n.id
          AND nt.tipo = 'negocio_sin_movimiento'
          AND nt.created_at > now() - INTERVAL '7 days'
      )
  LOOP
    INSERT INTO notificaciones (org_id, user_id, tipo, titulo, descripcion, entidad_tipo, entidad_id)
    VALUES (r.org_id, r.user_id, 'negocio_sin_movimiento',
            'Negocio sin movimiento',
            r.nombre || ' lleva más de 14 días sin actividad',
            'negocio', r.id)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'pudu-notificaciones-diarias',
  '30 11 * * *',  -- 08:30 Chile (UTC-3)
  $$SELECT pudu_generar_notificaciones()$$
) ON CONFLICT DO NOTHING;

-- ── 4. Productos ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS productos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID REFERENCES organizaciones(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  precio      NUMERIC DEFAULT 0,
  unidad      TEXT DEFAULT 'unidad',
  categoria   TEXT,
  activo      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "productos_org" ON productos
  USING (org_id IN (SELECT org_id FROM miembros WHERE user_id = auth.uid()));

-- ── 5. Tracking emails ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS emails_enviados (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID REFERENCES organizaciones(id) ON DELETE CASCADE,
  contacto_id  UUID REFERENCES contactos(id) ON DELETE SET NULL,
  asunto       TEXT NOT NULL,
  destinatario TEXT NOT NULL,
  enviado_at   TIMESTAMPTZ DEFAULT now(),
  abierto_at   TIMESTAMPTZ,
  aperturas    INT DEFAULT 0,
  created_by   UUID REFERENCES auth.users(id)
);
ALTER TABLE emails_enviados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "emails_org" ON emails_enviados
  USING (org_id IN (SELECT org_id FROM miembros WHERE user_id = auth.uid()));

-- ── 6. Campos personalizados ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS campos_definicion (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID REFERENCES organizaciones(id) ON DELETE CASCADE,
  entidad_tipo TEXT NOT NULL CHECK (entidad_tipo IN ('contacto', 'empresa', 'negocio')),
  nombre       TEXT NOT NULL,
  clave        TEXT NOT NULL,
  tipo         TEXT NOT NULL CHECK (tipo IN ('texto', 'numero', 'fecha', 'select', 'checkbox')),
  opciones     JSONB DEFAULT '[]',
  requerido    BOOLEAN DEFAULT false,
  orden        INT DEFAULT 0,
  UNIQUE (org_id, entidad_tipo, clave)
);
ALTER TABLE campos_definicion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campos_def_org" ON campos_definicion
  USING (org_id IN (SELECT org_id FROM miembros WHERE user_id = auth.uid()));

ALTER TABLE contactos ADD COLUMN IF NOT EXISTS campos_extra JSONB DEFAULT '{}';
ALTER TABLE empresas  ADD COLUMN IF NOT EXISTS campos_extra JSONB DEFAULT '{}';
ALTER TABLE negocios  ADD COLUMN IF NOT EXISTS campos_extra JSONB DEFAULT '{}';

-- ── 7. Pipelines ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipelines (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID REFERENCES organizaciones(id) ON DELETE CASCADE,
  nombre     TEXT NOT NULL,
  etapas     JSONB NOT NULL DEFAULT '[]',
  color      TEXT DEFAULT '#6366f1',
  activo     BOOLEAN DEFAULT true,
  orden      INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pipelines_org" ON pipelines
  USING (org_id IN (SELECT org_id FROM miembros WHERE user_id = auth.uid()));

ALTER TABLE negocios ADD COLUMN IF NOT EXISTS pipeline_id UUID REFERENCES pipelines(id);

-- ── Helper: registrar apertura de email (llamado desde Edge Function) ──
CREATE OR REPLACE FUNCTION registrar_apertura_email(email_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE emails_enviados
  SET aperturas  = aperturas + 1,
      abierto_at = COALESCE(abierto_at, now())
  WHERE id = email_id;
END;
$$;
