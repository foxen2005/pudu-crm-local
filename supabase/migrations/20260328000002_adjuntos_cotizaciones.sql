-- ══════════════════════════════════════════════════════════════════
-- PUDU CRM — Adjuntos + Cotizaciones
-- Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════

-- ── 1. Adjuntos ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS adjuntos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID REFERENCES organizaciones(id) ON DELETE CASCADE,
  entidad_tipo TEXT NOT NULL CHECK (entidad_tipo IN ('negocio', 'contacto')),
  entidad_id  UUID NOT NULL,
  nombre      TEXT NOT NULL,
  url         TEXT NOT NULL,
  size        BIGINT,
  mime_type   TEXT,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE adjuntos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "adjuntos_org_members" ON adjuntos
  USING (org_id IN (
    SELECT org_id FROM miembros WHERE user_id = auth.uid()
  ));

-- ── 2. Cotizaciones ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cotizaciones (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID REFERENCES organizaciones(id) ON DELETE CASCADE,
  negocio_id   UUID REFERENCES negocios(id) ON DELETE CASCADE,
  numero       SERIAL,
  titulo       TEXT NOT NULL,
  fecha        DATE DEFAULT CURRENT_DATE,
  validez_dias INT DEFAULT 30,
  moneda       TEXT DEFAULT 'CLP',
  notas        TEXT,
  estado       TEXT DEFAULT 'borrador'
               CHECK (estado IN ('borrador','enviada','aceptada','rechazada')),
  created_by   UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cotizacion_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id   UUID REFERENCES cotizaciones(id) ON DELETE CASCADE,
  descripcion     TEXT NOT NULL,
  cantidad        NUMERIC DEFAULT 1,
  precio_unitario NUMERIC DEFAULT 0,
  descuento       NUMERIC DEFAULT 0
);

ALTER TABLE cotizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotizacion_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cotizaciones_org_members" ON cotizaciones
  USING (org_id IN (
    SELECT org_id FROM miembros WHERE user_id = auth.uid()
  ));

CREATE POLICY "cotizacion_items_via_cotizacion" ON cotizacion_items
  USING (cotizacion_id IN (
    SELECT id FROM cotizaciones
    WHERE org_id IN (
      SELECT org_id FROM miembros WHERE user_id = auth.uid()
    )
  ));

-- ── 3. Storage bucket adjuntos ─────────────────────────────────────
-- Ejecutar en Supabase Dashboard > Storage > New bucket:
--   Nombre: adjuntos
--   Public: true (para URLs públicas de descarga)
--
-- O via SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES ('adjuntos', 'adjuntos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "adjuntos_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'adjuntos'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "adjuntos_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'adjuntos');

CREATE POLICY "adjuntos_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'adjuntos'
    AND auth.uid() IS NOT NULL
  );
