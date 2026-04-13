import type { Negocio, Actividad, Automatizacion } from './db';

export type SmartSuggestion = {
  id: string;
  icon: string;
  titulo: string;
  descripcion: string;
  tipo: 'warning' | 'alert' | 'info';
  ctaLabel: string;
  autoData: {
    nombre: string;
    trigger_tipo: string;
    trigger_dias: number;
    accion_tipo: string;
    accion_titulo: string;
    accion_tipo_actividad: string;
  };
};

const ETAPAS_ACTIVAS = ['Prospección', 'Calificación', 'Propuesta', 'Negociación', 'Cierre'];

export function generarSugerencias(
  negocios: Negocio[],
  actividades: Actividad[],
  automatizaciones: Automatizacion[],
): SmartSuggestion[] {
  const suggestions: SmartSuggestion[] = [];
  const hoy = Date.now();
  const negociosActivos = negocios.filter(n => ETAPAS_ACTIVAS.includes(n.etapa));

  // ── 1. Negocios sin actividad en 14+ días ─────────────────────────────────
  const IDLE_DIAS = 14;
  const idleCutoff = new Date(hoy - IDLE_DIAS * 86_400_000);

  const negociosIdle = negociosActivos.filter(n => {
    // Solo considerar negocios creados antes del cutoff
    if (new Date(n.created_at) >= idleCutoff) return false;
    const tieneActividadReciente = actividades.some(a => {
      if (!a.fecha_hora) return false;
      if (new Date(a.fecha_hora) < idleCutoff) return false;
      const nombre = n.nombre.toLowerCase();
      const empresa = n.empresa_nombre?.toLowerCase() ?? '';
      const rel = a.relacionado?.toLowerCase() ?? '';
      return rel.includes(nombre) || (empresa && rel.includes(empresa));
    });
    return !tieneActividadReciente;
  });

  const yaHayIdleAuto = automatizaciones.some(
    a => a.trigger_tipo === 'deal_idle' && a.accion_tipo === 'crear_actividad' && a.activa,
  );

  if (negociosIdle.length > 0 && !yaHayIdleAuto) {
    const nombres = negociosIdle
      .slice(0, 2)
      .map(n => n.nombre)
      .join(', ');
    suggestions.push({
      id: 'idle_deals',
      icon: 'schedule',
      titulo: `${negociosIdle.length} negocio${negociosIdle.length > 1 ? 's' : ''} sin actividad`,
      descripcion: `Sin contacto hace +${IDLE_DIAS} días: ${nombres}${negociosIdle.length > 2 ? ` y ${negociosIdle.length - 2} más` : ''}.`,
      tipo: 'warning',
      ctaLabel: 'Crear seguimiento automático',
      autoData: {
        nombre: `Seguimiento cada ${IDLE_DIAS} días sin actividad`,
        trigger_tipo: 'deal_idle',
        trigger_dias: IDLE_DIAS,
        accion_tipo: 'crear_actividad',
        accion_titulo: 'Seguimiento pendiente',
        accion_tipo_actividad: 'tarea',
      },
    });
  }

  // ── 2. Negocios con cierre en los próximos 7 días ─────────────────────────
  const CIERRE_DIAS = 7;
  const cierreLimite = new Date(hoy + CIERRE_DIAS * 86_400_000);

  const negociosPorCerrar = negociosActivos.filter(n => {
    if (!n.fecha_cierre) return false;
    const fc = new Date(n.fecha_cierre);
    return fc >= new Date() && fc <= cierreLimite;
  });

  const yaHayWonAuto = automatizaciones.some(
    a => a.trigger_tipo === 'deal_won' && a.activa,
  );

  if (negociosPorCerrar.length > 0 && !yaHayWonAuto) {
    suggestions.push({
      id: 'closing_soon',
      icon: 'flag',
      titulo: `${negociosPorCerrar.length} negocio${negociosPorCerrar.length > 1 ? 's' : ''} cierran esta semana`,
      descripcion: negociosPorCerrar.map(n => n.nombre).join(', '),
      tipo: 'alert',
      ctaLabel: 'Activar tarea post-cierre',
      autoData: {
        nombre: 'Tarea automática al ganar negocio',
        trigger_tipo: 'deal_won',
        trigger_dias: 1,
        accion_tipo: 'crear_actividad',
        accion_titulo: 'Generar factura / Onboarding cliente',
        accion_tipo_actividad: 'tarea',
      },
    });
  }

  // ── 3. Marcar riesgo automáticamente (21 días sin actividad) ──────────────
  const yaHayRiesgoAuto = automatizaciones.some(
    a => a.accion_tipo === 'marcar_riesgo' && a.activa,
  );

  if (!yaHayRiesgoAuto && negociosActivos.length >= 2) {
    suggestions.push({
      id: 'auto_risk',
      icon: 'warning',
      titulo: 'Detección automática de riesgo',
      descripcion: `Marca negocios en riesgo si llevan +21 días sin actividad, sin intervención manual.`,
      tipo: 'info',
      ctaLabel: 'Activar alerta de riesgo',
      autoData: {
        nombre: 'Auto-detección de riesgo — 21 días',
        trigger_tipo: 'deal_idle',
        trigger_dias: 21,
        accion_tipo: 'marcar_riesgo',
        accion_titulo: 'Marcar negocio como en riesgo',
        accion_tipo_actividad: 'tarea',
      },
    });
  }

  return suggestions.slice(0, 3);
}
