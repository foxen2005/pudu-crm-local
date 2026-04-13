-- ══════════════════════════════════════════════
-- PUDU CRM - Schema inicial
-- Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════

-- Empresas
CREATE TABLE IF NOT EXISTS empresas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razon_social    TEXT NOT NULL,
  rut             TEXT UNIQUE,
  giro            TEXT,
  region          TEXT,
  ciudad          TEXT,
  direccion       TEXT,
  telefono        TEXT,
  email           TEXT,
  sitio_web       TEXT,
  tamano          TEXT,
  condiciones_pago TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Contactos
CREATE TABLE IF NOT EXISTS contactos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          TEXT NOT NULL,
  apellido        TEXT,
  email           TEXT,
  telefono        TEXT,
  cargo           TEXT,
  rut             TEXT,
  empresa_id      UUID REFERENCES empresas(id) ON DELETE SET NULL,
  empresa_nombre  TEXT,
  estado          TEXT DEFAULT 'Prospecto',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Negocios
CREATE TABLE IF NOT EXISTS negocios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          TEXT NOT NULL,
  empresa_id      UUID REFERENCES empresas(id) ON DELETE SET NULL,
  empresa_nombre  TEXT,
  contacto_id     UUID REFERENCES contactos(id) ON DELETE SET NULL,
  contacto_nombre TEXT,
  valor           BIGINT,
  etapa           TEXT DEFAULT 'Prospección',
  fecha_cierre    DATE,
  probabilidad    INTEGER,
  descripcion     TEXT,
  riesgo          BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Actividades
CREATE TABLE IF NOT EXISTS actividades (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo            TEXT NOT NULL,
  titulo          TEXT NOT NULL,
  relacionado     TEXT,
  empresa_id      UUID REFERENCES empresas(id) ON DELETE SET NULL,
  contacto_id     UUID REFERENCES contactos(id) ON DELETE SET NULL,
  fecha_hora      TIMESTAMPTZ,
  prioridad       TEXT DEFAULT 'Media',
  completada      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Notas (para Customer 360 / timeline)
CREATE TABLE IF NOT EXISTS notas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contenido       TEXT NOT NULL,
  empresa_id      UUID REFERENCES empresas(id) ON DELETE CASCADE,
  contacto_id     UUID REFERENCES contactos(id) ON DELETE CASCADE,
  negocio_id      UUID REFERENCES negocios(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Auto updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER empresas_updated_at   BEFORE UPDATE ON empresas   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER contactos_updated_at  BEFORE UPDATE ON contactos  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER negocios_updated_at   BEFORE UPDATE ON negocios   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER actividades_updated_at BEFORE UPDATE ON actividades FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS: por ahora acceso público (ajustar cuando haya auth)
ALTER TABLE empresas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE contactos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE negocios   ENABLE ROW LEVEL SECURITY;
ALTER TABLE actividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE notas      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_all" ON empresas    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON contactos   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON negocios    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON actividades FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON notas       FOR ALL USING (true) WITH CHECK (true);
