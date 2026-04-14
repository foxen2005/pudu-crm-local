-- ══════════════════════════════════════════════════════════════════
-- PUDU CRM — Admin: campos activo + last_seen en miembros
-- ══════════════════════════════════════════════════════════════════

-- Campo para desactivar cuentas sin eliminarlas
ALTER TABLE miembros ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;

-- Último acceso (se actualiza desde el frontend en cada login/refresh)
ALTER TABLE miembros ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;

-- Índice para consultas de estado
CREATE INDEX IF NOT EXISTS idx_miembros_activo ON miembros(activo);
CREATE INDEX IF NOT EXISTS idx_miembros_last_seen ON miembros(last_seen);

-- Función RPC para que el propio usuario actualice su last_seen
CREATE OR REPLACE FUNCTION update_my_last_seen()
RETURNS void AS $$
BEGIN
  UPDATE miembros SET last_seen = NOW() WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;