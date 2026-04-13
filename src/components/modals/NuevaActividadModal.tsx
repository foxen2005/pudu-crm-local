import { useState, useEffect } from 'react';
import { Modal } from '@/components/modals/Modal';
import { crearActividad, actualizarActividad, type Actividad } from '@/lib/db';
import { toLocalIsoString } from '@/lib/groq';
import { cn } from '@/lib/utils';

const labelClass = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5';
const inputClass =
  'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white dark:bg-[#252035] dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500';

type TipoActividad = 'llamada' | 'reunion' | 'email' | 'tarea';

const tipoOptions: { value: TipoActividad; label: string; icon: string }[] = [
  { value: 'llamada', label: 'Llamada', icon: 'call' },
  { value: 'reunion', label: 'Reunión', icon: 'videocam' },
  { value: 'email', label: 'Email', icon: 'mail' },
  { value: 'tarea', label: 'Tarea', icon: 'task_alt' },
];

const defaultForm = { tipo: 'llamada' as TipoActividad, titulo: '', relacionado: '', fecha: '', hora: '', prioridad: 'Media' };

export function NuevaActividadModal({
  open,
  onClose,
  onSuccess,
  relacionadoDefault,
  contactoId,
  empresaId,
  actividad,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  relacionadoDefault?: string;
  contactoId?: string;
  empresaId?: string;
  actividad?: Actividad;
}) {
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!actividad;

  useEffect(() => {
    if (actividad) {
      const dt = actividad.fecha_hora ? new Date(actividad.fecha_hora) : null;
      const pad = (n: number) => String(n).padStart(2, '0');
      setForm({
        tipo: actividad.tipo as TipoActividad,
        titulo: actividad.titulo,
        relacionado: actividad.relacionado ?? '',
        // Usar hora LOCAL para que el formulario muestre la hora correcta
        fecha: dt ? `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}` : '',
        hora: dt ? `${pad(dt.getHours())}:${pad(dt.getMinutes())}` : '',
        prioridad: actividad.prioridad,
      });
    } else if (open) {
      setForm(prev => ({ ...defaultForm, relacionado: relacionadoDefault ?? prev.relacionado }));
    }
    setError(null);
  }, [open, actividad, relacionadoDefault]);

  const set = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fechaHora = form.fecha
      ? toLocalIsoString(new Date(`${form.fecha}T${form.hora || '00:00'}:00`))
      : '';
    const payload = {
      tipoActividad: form.tipo,
      titulo: form.titulo,
      relacionado: form.relacionado,
      fechaHora,
      prioridad: form.prioridad,
      contacto_id: actividad?.contacto_id ?? contactoId ?? '',
      empresa_id: actividad?.empresa_id ?? empresaId ?? '',
    };
    const result = isEdit
      ? await actualizarActividad(actividad!.id, payload)
      : await crearActividad(payload);
    setLoading(false);
    if (!result.ok) { setError(result.error); return; }
    if (!isEdit) setForm(defaultForm);
    onSuccess?.();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar Actividad' : 'Nueva Actividad'} size="md">
      <form onSubmit={handleSubmit}>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className={labelClass}>Tipo de actividad</label>
            <div className="grid grid-cols-4 gap-2">
              {tipoOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, tipo: opt.value }))}
                  className={cn(
                    'flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border text-xs font-bold transition-all',
                    form.tipo === opt.value
                      ? 'bg-primary/10 text-primary border-primary'
                      : 'bg-white dark:bg-[#252035] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-[#2d2840]'
                  )}
                >
                  <span className="material-symbols-outlined text-xl">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass}>Título <span className="text-red-400">*</span></label>
            <input type="text" required value={form.titulo} onChange={set('titulo')} placeholder="Ej. Llamada de seguimiento" className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Relacionado con</label>
            <input type="text" value={form.relacionado} onChange={set('relacionado')} placeholder="Empresa o contacto" className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Fecha <span className="text-red-400">*</span></label>
              <input type="date" required value={form.fecha} onChange={set('fecha')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Hora</label>
              <input type="time" value={form.hora} onChange={set('hora')} className={inputClass} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Prioridad</label>
            <select value={form.prioridad} onChange={set('prioridad')} className={inputClass}>
              {['Baja', 'Media', 'Alta'].map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={loading} className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50">
            {loading ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Crear Actividad'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
