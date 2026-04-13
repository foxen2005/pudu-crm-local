-- ══════════════════════════════════════════════
-- PUDU CRM - Auth + Multi-tenant
-- Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════

-- Organizaciones (cada cliente del CRM)
CREATE TABLE IF NOT EXISTS organizaciones (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     TEXT NOT NULL,
  plan       TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Miembros: vincula auth.users con organizaciones y rol
CREATE TABLE IF NOT EXISTS miembros (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id     UUID NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  rol        TEXT NOT NULL DEFAULT 'colaborador', -- 'admin' | 'colaborador'
  nombre     TEXT,
  email      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, org_id)
);

-- Agregar org_id a todas las tablas de datos
ALTER TABLE empresas    ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizaciones(id) ON DELETE CASCADE;
ALTER TABLE contactos   ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizaciones(id) ON DELETE CASCADE;
ALTER TABLE negocios    ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizaciones(id) ON DELETE CASCADE;
ALTER TABLE actividades ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizaciones(id) ON DELETE CASCADE;
ALTER TABLE notas       ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizaciones(id) ON DELETE CASCADE;

-- ── RLS: miembros ─────────────────────────────

ALTER TABLE organizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE miembros       ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado puede ver su propia organización
CREATE POLICY "ver_propia_org" ON organizaciones
  FOR SELECT USING (
    id IN (SELECT org_id FROM miembros WHERE user_id = auth.uid())
  );

-- Solo admin puede actualizar la org
CREATE POLICY "admin_update_org" ON organizaciones
  FOR UPDATE USING (
    id IN (SELECT org_id FROM miembros WHERE user_id = auth.uid() AND rol = 'admin')
  );

-- Miembros: cada uno ve los de su org
CREATE POLICY "ver_miembros_org" ON miembros
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM miembros WHERE user_id = auth.uid())
  );

-- Solo admin puede agregar/eliminar miembros
CREATE POLICY "admin_gestionar_miembros" ON miembros
  FOR ALL USING (
    org_id IN (SELECT org_id FROM miembros WHERE user_id = auth.uid() AND rol = 'admin')
  );

-- ── RLS: tablas de datos (aislamiento por org) ─

DROP POLICY IF EXISTS "public_all" ON empresas;
DROP POLICY IF EXISTS "public_all" ON contactos;
DROP POLICY IF EXISTS "public_all" ON negocios;
DROP POLICY IF EXISTS "public_all" ON actividades;
DROP POLICY IF EXISTS "public_all" ON notas;

CREATE POLICY "org_isolation" ON empresas
  FOR ALL USING (org_id IN (SELECT org_id FROM miembros WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM miembros WHERE user_id = auth.uid()));

CREATE POLICY "org_isolation" ON contactos
  FOR ALL USING (org_id IN (SELECT org_id FROM miembros WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM miembros WHERE user_id = auth.uid()));

CREATE POLICY "org_isolation" ON negocios
  FOR ALL USING (org_id IN (SELECT org_id FROM miembros WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM miembros WHERE user_id = auth.uid()));

CREATE POLICY "org_isolation" ON actividades
  FOR ALL USING (org_id IN (SELECT org_id FROM miembros WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM miembros WHERE user_id = auth.uid()));

CREATE POLICY "org_isolation" ON notas
  FOR ALL USING (org_id IN (SELECT org_id FROM miembros WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM miembros WHERE user_id = auth.uid()));

-- ── Función: crear org al registrarse ─────────
-- Se llama desde el frontend después del signup

CREATE OR REPLACE FUNCTION crear_org_para_usuario(
  p_user_id UUID,
  p_nombre_org TEXT,
  p_nombre_usuario TEXT,
  p_email TEXT
)
RETURNS UUID AS $$
DECLARE
  v_org_id UUID;
BEGIN
  INSERT INTO organizaciones (nombre) VALUES (p_nombre_org) RETURNING id INTO v_org_id;
  INSERT INTO miembros (user_id, org_id, rol, nombre, email)
    VALUES (p_user_id, v_org_id, 'admin', p_nombre_usuario, p_email);
  RETURN v_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
