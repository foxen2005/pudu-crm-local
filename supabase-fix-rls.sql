-- ══════════════════════════════════════════════
-- PUDU CRM - Fix RLS recursión infinita
-- Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════

-- Función helper que lee miembros sin activar RLS (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION get_my_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM miembros WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Reemplazar políticas de miembros ──────────

DROP POLICY IF EXISTS "ver_miembros_org"        ON miembros;
DROP POLICY IF EXISTS "admin_gestionar_miembros" ON miembros;

CREATE POLICY "ver_miembros_org" ON miembros
  FOR SELECT USING (org_id = get_my_org_id());

CREATE POLICY "admin_gestionar_miembros" ON miembros
  FOR ALL USING (
    org_id = get_my_org_id() AND
    EXISTS (SELECT 1 FROM miembros m WHERE m.user_id = auth.uid() AND m.org_id = get_my_org_id() AND m.rol = 'admin')
  );

-- ── Reemplazar políticas de datos ─────────────

DROP POLICY IF EXISTS "org_isolation" ON empresas;
DROP POLICY IF EXISTS "org_isolation" ON contactos;
DROP POLICY IF EXISTS "org_isolation" ON negocios;
DROP POLICY IF EXISTS "org_isolation" ON actividades;
DROP POLICY IF EXISTS "org_isolation" ON notas;

CREATE POLICY "org_isolation" ON empresas
  FOR ALL USING (org_id = get_my_org_id())
  WITH CHECK (org_id = get_my_org_id());

CREATE POLICY "org_isolation" ON contactos
  FOR ALL USING (org_id = get_my_org_id())
  WITH CHECK (org_id = get_my_org_id());

CREATE POLICY "org_isolation" ON negocios
  FOR ALL USING (org_id = get_my_org_id())
  WITH CHECK (org_id = get_my_org_id());

CREATE POLICY "org_isolation" ON actividades
  FOR ALL USING (org_id = get_my_org_id())
  WITH CHECK (org_id = get_my_org_id());

CREATE POLICY "org_isolation" ON notas
  FOR ALL USING (org_id = get_my_org_id())
  WITH CHECK (org_id = get_my_org_id());

-- ── Reemplazar políticas de organizaciones ────

DROP POLICY IF EXISTS "ver_propia_org"   ON organizaciones;
DROP POLICY IF EXISTS "admin_update_org" ON organizaciones;

CREATE POLICY "ver_propia_org" ON organizaciones
  FOR SELECT USING (id = get_my_org_id());

CREATE POLICY "admin_update_org" ON organizaciones
  FOR UPDATE USING (id = get_my_org_id());
