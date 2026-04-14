import { useState, useEffect } from 'react';
import {
  getAutomatizaciones, toggleAutomatizacion, eliminarAutomatizacion,
  evaluarAutomatizaciones, type Automatizacion,
} from '@/lib/db';
import { NuevaAutomatizacionModal } from '@/components/modals/NuevaAutomatizacionModal';

const TRIGGER_LABELS: Record<string, { label: string; icon: string }> = {
  deal_idle:    { label: 'Negocio sin actividad', icon: 'hourglass_empty' },
  deal_created: { label: 'Nuevo negocio creado',  icon: 'add_circle' },
  deal_won:     { label: 'Negocio cerrado',        icon: 'emoji_events' },
};

const ACTION_LABELS: Record<string, { label: string; icon: string }> = {
  crear_actividad: { label: 'Crear actividad de seguimiento', icon: 'task_alt' },
  marcar_riesgo:   { label: 'Marcar negocio en riesgo',       icon: 'warning' },
};

function triggerDesc(auto: Automatizacion) {
  const t = TRIGGER_LABELS[auto.trigger_tipo] ?? { label: auto.trigger_tipo, icon: 'play_circle' };
  if (auto.trigger_tipo === 'deal_idle') return `${t.label} por ${auto.trigger_dias} días`;
  return t.label;
}

export default function Automations() {
  const [autos, setAutos] = useState<Automatizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editando, setEditando] = useState<Automatizacion | undefined>();
  const [evaluating, setEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<{ fired: number; errors: string[] } | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await getAutomatizaciones();
    if (res.ok) setAutos(res.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleToggle = async (auto: Automatizacion) => {
    setAutos(prev => prev.map(a => a.id === auto.id ? { ...a, activa: !a.activa } : a));
    await toggleAutomatizacion(auto.id, !auto.activa);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar este flujo de automatización?')) return;
    setAutos(prev => prev.filter(a => a.id !== id));
    await eliminarAutomatizacion(id);
  };

  const handleEvaluar = async () => {
    setEvaluating(true);
    setEvalResult(null);
    const result = await evaluarAutomatizaciones();
    setEvalResult(result);
    setEvaluating(false);
    await load(); // refresh execution counts
  };

  const activas = autos.filter(a => a.activa).length;
  const errores = autos.filter(a => !a.activa && a.ejecuciones > 0).length;
  const totalEjecuciones = autos.reduce((s, a) => s + a.ejecuciones, 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-2 block">
            Flujos de Automatización
          </span>
          <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Automatizaciones</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-lg">
            Flujos lógicos que se disparan automáticamente sobre tu pipeline. Elimina la fricción manual.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleEvaluar}
            disabled={evaluating || activas === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-40"
          >
            <span className={`material-symbols-outlined text-sm ${evaluating ? 'animate-spin' : ''}`}>
              {evaluating ? 'progress_activity' : 'play_arrow'}
            </span>
            {evaluating ? 'Evaluando...' : 'Ejecutar ahora'}
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-xs font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Nuevo Flujo
          </button>
        </div>
      </div>

      {/* Eval result banner */}
      {evalResult && (
        <div className={`mb-6 rounded-xl p-4 flex items-center justify-between border ${
          evalResult.errors.length > 0
            ? 'bg-red-50 border-red-100'
            : evalResult.fired > 0
              ? 'bg-green-50 border-green-100'
              : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <span className={`material-symbols-outlined text-xl ${
              evalResult.errors.length > 0 ? 'text-red-500' : evalResult.fired > 0 ? 'text-green-600' : 'text-slate-400'
            }`}>
              {evalResult.errors.length > 0 ? 'error' : evalResult.fired > 0 ? 'check_circle' : 'info'}
            </span>
            <div>
              {evalResult.fired > 0 && (
                <p className="text-sm font-bold text-green-800">
                  {evalResult.fired} acción{evalResult.fired > 1 ? 'es' : ''} ejecutada{evalResult.fired > 1 ? 's' : ''}
                </p>
              )}
              {evalResult.fired === 0 && evalResult.errors.length === 0 && (
                <p className="text-sm font-bold text-slate-600">Sin acciones pendientes — todo al día</p>
              )}
              {evalResult.errors.length > 0 && (
                <p className="text-sm font-bold text-red-800">
                  {evalResult.errors.length} error{evalResult.errors.length > 1 ? 'es' : ''}: {evalResult.errors[0]}
                </p>
              )}
            </div>
          </div>
          <button onClick={() => setEvalResult(null)} className="text-slate-400 hover:text-slate-600">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-[#1e1a2e] rounded-xl p-5 border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4">
          <div className="size-12 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined">bolt</span>
          </div>
          <div>
            <p className="text-3xl font-black text-slate-900 dark:text-slate-100">{loading ? '—' : activas}</p>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Flujos Activos</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{autos.length} flujos totales</p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#1e1a2e] rounded-xl p-5 border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4">
          <div className="size-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
            <span className="material-symbols-outlined">electric_bolt</span>
          </div>
          <div>
            <p className="text-3xl font-black text-slate-900 dark:text-slate-100">{loading ? '—' : totalEjecuciones}</p>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Ejecuciones Total</p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#1e1a2e] rounded-xl p-5 border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4">
          <div className={`size-12 rounded-xl flex items-center justify-center ${errores > 0 ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
            <span className="material-symbols-outlined">{errores > 0 ? 'error' : 'check_circle'}</span>
          </div>
          <div>
            <p className="text-3xl font-black text-slate-900 dark:text-slate-100">{loading ? '—' : errores}</p>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              {errores > 0 ? 'Flujos Pausados' : 'Sin Errores'}
            </p>
          </div>
        </div>
      </div>

      {/* Flows list */}
      <div className="bg-white dark:bg-[#1e1a2e] rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Flujos de Trabajo
          </h3>
          {!loading && autos.length > 0 && (
            <span className="text-[10px] text-slate-400 font-bold">{autos.length} flujo{autos.length > 1 ? 's' : ''}</span>
          )}
        </div>

        {loading ? (
          <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {[1, 2, 3].map(i => (
              <div key={i} className="px-6 py-5 flex items-center gap-6">
                <div className="flex-1 h-10 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
                <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse" />
                <div className="flex-1 h-10 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
        ) : autos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="material-symbols-outlined text-5xl text-slate-200 mb-3">bolt</span>
            <p className="text-sm font-bold text-slate-400 mb-1">Sin flujos configurados</p>
            <p className="text-xs text-slate-400 mb-5">Crea tu primer flujo para automatizar acciones en tu pipeline</p>
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Crear primer flujo
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {autos.map((auto) => {
              const trigger = TRIGGER_LABELS[auto.trigger_tipo] ?? { label: auto.trigger_tipo, icon: 'play_circle' };
              const action  = ACTION_LABELS[auto.accion_tipo]   ?? { label: auto.accion_tipo,  icon: 'send' };
              return (
                <div key={auto.id} className="px-6 py-5 flex items-center gap-5 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                  {/* Trigger */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Si ocurre</p>
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-sm text-slate-500 dark:text-slate-400">{trigger.icon}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{triggerDesc(auto)}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{auto.nombre}</p>
                      </div>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex-shrink-0 text-slate-300 dark:text-slate-600">
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </div>

                  {/* Action */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Entonces</p>
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-sm text-primary">{action.icon}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{action.label}</p>
                        {auto.accion_tipo === 'crear_actividad' && (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{auto.accion_titulo}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Executions */}
                  <div className="w-20 flex-shrink-0 text-center">
                    <p className="text-lg font-black text-slate-900 dark:text-slate-100">{auto.ejecuciones}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">ejecuciones</p>
                  </div>

                  {/* Toggle + delete */}
                  <div className="flex-shrink-0 flex items-center gap-3">
                    <button
                      onClick={() => { setEditando(auto); setCreateOpen(true); }}
                      className="opacity-0 group-hover:opacity-100 size-7 rounded-lg hover:bg-primary/10 flex items-center justify-center text-slate-300 dark:text-slate-600 hover:text-primary transition-all"
                    >
                      <span className="material-symbols-outlined text-sm">edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(auto.id)}
                      className="opacity-0 group-hover:opacity-100 size-7 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center text-slate-300 dark:text-slate-600 hover:text-red-400 transition-all"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                    <button
                      onClick={() => handleToggle(auto)}
                      className={`w-11 h-6 rounded-full relative transition-colors flex-shrink-0 ${
                        auto.activa ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`block absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                          auto.activa ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info box */}
      {!loading && autos.length > 0 && (
        <div className="mt-4 bg-primary/5 border border-primary/10 rounded-xl p-5 flex items-start gap-3">
          <span className="material-symbols-outlined text-primary text-xl flex-shrink-0 mt-0.5">info</span>
          <div>
            <p className="text-xs font-bold text-primary mb-1">¿Cómo funciona?</p>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Haz clic en <strong>Ejecutar ahora</strong> para evaluar todos los flujos activos contra tu pipeline actual.
              El motor revisa cada negocio, detecta los que cumplen el disparador y ejecuta las acciones configuradas.
              Un negocio no activará el mismo flujo dos veces dentro del período configurado.
            </p>
          </div>
        </div>
      )}

      <NuevaAutomatizacionModal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setEditando(undefined); }}
        onSuccess={load}
        editando={editando}
      />
    </div>
  );
}
