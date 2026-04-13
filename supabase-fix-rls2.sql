-- Fix: política admin_gestionar_miembros aún tiene recursión
-- Solución: segunda función SECURITY DEFINER para verificar si es admin

CREATE OR REPLACE FUNCTION is_admin_of_my_org()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM miembros
    WHERE user_id = auth.uid() AND rol = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Reemplazar solo la política problemática
DROP POLICY IF EXISTS "admin_gestionar_miembros" ON miembros;

CREATE POLICY "admin_gestionar_miembros" ON miembros
  FOR ALL USING (
    org_id = get_my_org_id() AND is_admin_of_my_org()
  );
