-- ══════════════════════════════════════════════════════════════════
-- PUDU CRM — Automatizaciones server-side con pg_cron
-- Ejecutar en Supabase SQL Editor (requiere extensión pg_cron activa)
-- ══════════════════════════════════════════════════════════════════

-- PASO 1: Activar extensión (solo si no está activa)
-- Ve a Supabase → Settings → Database → Extensions → busca "pg_cron" y actívala
-- O ejecuta:
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- CREATE EXTENSION IF NOT EXISTS pg_net;  -- para HTTP si usas Edge Functions

-- ══════════════════════════════════════════════════════════════════
-- Función principal: evalúa todas las automatizaciones activas
-- para todas las organizaciones
-- ══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION pudu_ejecutar_automatizaciones()
RETURNS TABLE(org_id UUID, automatizacion TEXT, negocio TEXT, accion TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r_auto   RECORD;
  r_neg    RECORD;
  cutoff   TIMESTAMPTZ;
  last_act TIMESTAMPTZ;
  cooldown TIMESTAMPTZ;
  nueva_id UUID;
BEGIN
  -- Iterar sobre todas las automatizaciones activas
  FOR r_auto IN
    SELECT a.* FROM automatizaciones a WHERE a.activa = TRUE
  LOOP
    cutoff   := NOW() - (r_auto.trigger_dias || ' days')::INTERVAL;
    cooldown := NOW() - (r_auto.trigger_dias || ' days')::INTERVAL;

    -- Obtener negocios candidatos según el tipo de trigger
    FOR r_neg IN
      SELECT n.*
      FROM negocios n
      WHERE n.org_id = r_auto.org_id
        AND (
          (r_auto.trigger_tipo = 'deal_idle'    AND n.etapa NOT IN ('Cerrado Ganado','Cerrado Perdido'))
          OR (r_auto.trigger_tipo = 'deal_won'  AND n.etapa IN ('Cierre','Cerrado Ganado'))
          OR (r_auto.trigger_tipo = 'deal_created' AND n.created_at >= cutoff)
        )
    LOOP

      -- Saltar si ya se disparó para este negocio dentro del período de cooldown
      IF EXISTS (
        SELECT 1 FROM automatizaciones_log l
        WHERE l.automatizacion_id = r_auto.id
          AND l.negocio_id = r_neg.id
          AND l.fired_at >= cooldown
      ) THEN
        CONTINUE;
      END IF;

      -- Para deal_idle: verificar que no haya actividad reciente
      IF r_auto.trigger_tipo = 'deal_idle' THEN
        SELECT MAX(a.fecha_hora)
          INTO last_act
          FROM actividades a
         WHERE a.org_id = r_auto.org_id
           AND (
             a.relacionado ILIKE '%' || r_neg.nombre || '%'
             OR (r_neg.empresa_nombre IS NOT NULL AND a.relacionado ILIKE '%' || r_neg.empresa_nombre || '%')
           );

        -- Usar created_at del negocio si no hay actividades
        IF last_act IS NULL THEN
          last_act := r_neg.created_at;
        END IF;

        IF last_act >= cutoff THEN
          CONTINUE;
        END IF;
      END IF;

      -- Ejecutar la acción
      IF r_auto.accion_tipo = 'crear_actividad' THEN
        INSERT INTO actividades (org_id, tipo, titulo, relacionado, prioridad, completada)
        VALUES (
          r_auto.org_id,
          LOWER(COALESCE(r_auto.accion_tipo_actividad, 'tarea')),
          r_auto.accion_titulo || ' — ' || r_neg.nombre,
          r_neg.nombre,
          'alta',
          FALSE
        )
        RETURNING id INTO nueva_id;

      ELSIF r_auto.accion_tipo = 'marcar_riesgo' THEN
        UPDATE negocios SET riesgo = TRUE
        WHERE id = r_neg.id;
      END IF;

      -- Registrar ejecución en el log
      INSERT INTO automatizaciones_log (org_id, automatizacion_id, negocio_id)
      VALUES (r_auto.org_id, r_auto.id, r_neg.id);

      -- Incrementar contador de ejecuciones
      UPDATE automatizaciones
         SET ejecuciones = ejecuciones + 1
       WHERE id = r_auto.id;

      -- Devolver fila con info del disparo (para debugging)
      org_id         := r_auto.org_id;
      automatizacion := r_auto.nombre;
      negocio        := r_neg.nombre;
      accion         := r_auto.accion_tipo;
      RETURN NEXT;

    END LOOP;
  END LOOP;
END;
$$;

-- ══════════════════════════════════════════════════════════════════
-- PASO 2: Programar con pg_cron
-- Corre todos los días a las 08:00 hora Chile (UTC-3 = 11:00 UTC)
-- ══════════════════════════════════════════════════════════════════

-- Eliminar schedule anterior si existe
SELECT cron.unschedule('pudu-automatizaciones-diarias')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'pudu-automatizaciones-diarias'
  );

SELECT cron.schedule(
  'pudu-automatizaciones-diarias',   -- nombre del job
  '0 11 * * *',                      -- 11:00 UTC = 08:00 Chile (UTC-3)
  $$ SELECT pudu_ejecutar_automatizaciones() $$
);

-- ══════════════════════════════════════════════════════════════════
-- VERIFICACIÓN (ejecutar manualmente para probar)
-- SELECT * FROM pudu_ejecutar_automatizaciones();
--
-- Ver jobs programados:
-- SELECT * FROM cron.job;
--
-- Ver historial de ejecuciones:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
-- ══════════════════════════════════════════════════════════════════
