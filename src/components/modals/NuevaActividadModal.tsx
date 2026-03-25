import { useState } from 'react';
import { Modal } from '@/components/modals/Modal';
import { cn } from '@/lib/utils';

const labelClass = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5';
const inputClass =
  'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white';

type TipoActividad = 'llamada' | 'reunion' | 'email' | 'tarea';

const tipoOptions: { value: TipoActividad; label: string; icon: string }[] = [
  { value: 'llamada', label: 'Llamada', icon: 'call' },
  { value: 'reunion', label: 'Reunión', icon: 'videocam' },
  { value: 'email', label: 'Email', icon: 'mail' },
  { value: 'tarea', label: 'Tarea', icon: 'task_alt' },
];

export function NuevaActividadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({
    tipo: 'llamada' as TipoActividad,
    titulo: '',
    contacto: '',
    empresa: '',
    fecha: '',
    hora: '',
    prioridad: 'Normal',
    descripcion: '',
  });

  const set = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Nueva Actividad" size="md">
      <form onSubmit={handleSubmit}>
        <div className="px-6 py-5 space-y-4">
          {/* Tipo button group */}
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
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  )}
                >
                  <span className="material-symbols-outlined text-xl">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Título — full width */}
          <div>
            <label className={labelClass}>
              Título <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={form.titulo}
              onChange={set('titulo')}
              placeholder="Ej. Llamada de seguimiento"
              className={inputClass}
            />
          </div>

          {/* Row: Contacto + Empresa */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Contacto</label>
              <input
                type="text"
                value={form.contacto}
                onChange={set('contacto')}
                placeholder="Nombre contacto"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Empresa</label>
              <input
                type="text"
                value={form.empresa}
                onChange={set('empresa')}
                placeholder="Nombre empresa"
                className={inputClass}
              />
            </div>
          </div>

          {/* Row: Fecha + Hora */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                Fecha <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                required
                value={form.fecha}
                onChange={set('fecha')}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Hora</label>
              <input
                type="time"
                value={form.hora}
                onChange={set('hora')}
                className={inputClass}
              />
            </div>
          </div>

          {/* Prioridad */}
          <div>
            <label className={labelClass}>Prioridad</label>
            <select value={form.prioridad} onChange={set('prioridad')} className={inputClass}>
              {['Normal', 'Alta', 'Urgente'].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Descripción */}
          <div>
            <label className={labelClass}>Descripción</label>
            <textarea
              rows={3}
              value={form.descripcion}
              onChange={set('descripcion')}
              placeholder="Detalles de la actividad..."
              className={inputClass + ' resize-none'}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:opacity-90 transition-all shadow-lg shadow-primary/20"
          >
            Crear Actividad
          </button>
        </div>
      </form>
    </Modal>
  );
}
