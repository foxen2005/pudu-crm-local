-- ══════════════════════════════════════════════════════════════════
-- PUDU CRM — Colaboradores dirigidos + Ranking
-- Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════

-- Datos del invitado en la invitación (para pre-llenar el Join)
ALTER TABLE invitaciones ADD COLUMN IF NOT EXISTS nombre_invitado TEXT;
ALTER TABLE invitaciones ADD COLUMN IF NOT EXISTS email_invitado  TEXT;

-- created_by en actividades (para el ranking por miembro)
ALTER TABLE actividades ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
