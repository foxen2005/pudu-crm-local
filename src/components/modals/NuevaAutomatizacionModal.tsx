import { useState, useEffect } from 'react';
import { Modal } from '@/components/modals/Modal';
import { crearAutomatizacion, actualizarAutomatizacion, type Automatizacion } from '@/lib/db';
import { cn } from '@/lib/utils';

const labelClass = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5';
const inputClass =
  'w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white dark:bg-[#252035] dark:text-slate-100 dark:placeholder:text-slate-500';

const TRIGGERS = [
  { value: 'deal_idle',   label: 'Negocio sin actividad por N días', icon: 'hourglass_empty' },
  { value: 'deal_created', label: 'Nuevo negocio creado',            icon: 'add_circle' },
  { value: 'deal_won',    label: 'Negocio cerrado (Cierre)',          icon: 'emoji_events' },
];

const ACTIONS = [
  { value: 'crear_actividad', label: 'Crear actividad de seguimiento', icon: 'task_alt' },
  { value: 'marcar_riesgo',   label: 'Marcar negocio en riesgo',       icon: 'warning' },
];

const TIPOS_ACTIVIDAD = [
  { value: 'llamada', label: 'Llamada', icon: 'call' },
  { value: 'reunion', label: 'Reunión', icon: 'videocam' },
  { value: 'email',   label: 'Email',   icon: 'mail' },
  { value: 'tarea',   label: 'Tarea',   icon: 'task_alt' },
];

const defaultForm = {
  nombre: '',
  trigger_tipo: 'deal_idle',
  trigger_dias: 7,
  accion_tipo: 'crear_actividad',
  accion_titulo: 'Seguimiento automático',
  accion_tipo_actividad: 'tarea',
};

export function NuevaAutomatizacionModal({
  open, onClose, onSuccess, editando,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editando?: Automatizacion;
}) {
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editando) {
      setForm({
        nombre: editando.nombre,
        trigger_tipo: editando.trigger_tipo,
        trigger_dias: editando.trigger_dias ?? 7,
        accion_tipo: editando.accion_tipo,
        accion_titulo: editando.accion_titulo ?? 'Seguimiento automático',
        accion_tipo_actividad: editando.accion_tipo_actividad ?? 'tarea',
      });
    } else {
      setForm(defaultForm);
    }
    setError(null);
  }, [editando, open]);

  const setField = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = editando
      ? await actualizarAutomatizacion(editando.id, form)
      : await crearAutomatizacion(form);
    setLoading(false);
    if (!result.ok) { setError(result.error); return; }
    if (!editando) setForm(defaultForm);
    onSuccess?.();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={editando ? 'Editar Flujo' : 'Nuevo Flujo de Automatización'} size="md">
      <form onSubmit={handleSubmit}>
        <div className="px-6 py-5 space-y-5">
          {/* Nombre */}
          <div>
            <label className={labelClass}>Nombre del flujo <span className="text-red-400">*</span></label>
            <input
              type="text" required
              value={form.nombre} onChange={e => setField('nombre', e.target.value)}
              placeholder="Ej. Seguimiento a deals inactivos"
              className={inputClass}
            />
          </div>

          {/* Trigger */}
          <div>
            <label className={labelClass}>Disparador (Si ocurre...)</label>
            <div className="space-y-2">
              {TRIGGERS.map(t => (
                <button
                  key={t.value} type="button"
                  onClick={() => setField('trigger_tipo', t.value)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm font-bold transition-all text-left',
                    form.trigger_tipo === t.value
                      ? 'bg-primary/10 text-primary border-primary'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  )}
                >
                  <span className="material-symbols-outlined text-base">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Trigger dias (solo para deal_idle) */}
          {form.trigger_tipo === 'deal_idle' && (
            <div>
              <label className={labelClass}>Días de inactividad</label>
              <input
                type="number" min={1} max={90}
                value={form.trigger_dias}
                onChange={e => setField('trigger_dias', parseInt(e.target.value) || 7)}
                className={inputClass}
              />
            </div>
          )}

          {/* Accion */}
          <div>
            <label className={labelClass}>Acción (Entonces...)</label>
            <div className="space-y-2">
              {ACTIONS.map(a => (
                <button
                  key={a.value} type="button"
                  onClick={() => setField('accion_tipo', a.value)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm font-bold transition-all text-left',
                    form.accion_tipo === a.value
                      ? 'bg-primary/10 text-primary border-primary'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  )}
                >
                  <span className="material-symbols-outlined text-base">{a.icon}</span>
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* Detalles de actividad */}
          {form.accion_tipo === 'crear_actividad' && (
            <div className="space-y-4 pl-3 border-l-2 border-primary/20">
              <div>
                <label className={labelClass}>Título de la actividad</label>
                <input
                  type="text"
                  value={form.accion_titulo}
                  onChange={e => setField('accion_titulo', e.target.value)}
                  placeholder="Ej. Seguimiento automático"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Tipo de actividad</label>
                <div className="grid grid-cols-4 gap-2">
                  {TIPOS_ACTIVIDAD.map(t => (
                    <button
                      key={t.value} type="button"
                      onClick={() => setField('accion_tipo_actividad', t.value)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border text-xs font-bold transition-all',
                        form.accion_tipo_actividad === t.value
                          ? 'bg-primary/10 text-primary border-primary'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      )}
                    >
                      <span className="material-symbols-outlined text-xl">{t.icon}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={loading} className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50">
            {loading ? 'Creando...' : 'Crear Flujo'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
