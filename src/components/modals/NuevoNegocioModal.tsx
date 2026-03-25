import { useState } from 'react';
import { Modal } from '@/components/modals/Modal';

const labelClass = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5';
const inputClass =
  'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white';

export function NuevoNegocioModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({
    nombre: '',
    empresa: '',
    contacto: '',
    valor: '',
    etapa: 'Lead',
    fechaCierre: '',
    probabilidad: '',
    responsable: 'Carlos',
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
    <Modal open={open} onClose={onClose} title="Nuevo Negocio" size="md">
      <form onSubmit={handleSubmit}>
        <div className="px-6 py-5 space-y-4">
          {/* Nombre negocio — full width */}
          <div>
            <label className={labelClass}>
              Nombre negocio <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={form.nombre}
              onChange={set('nombre')}
              placeholder="Ej. Licitación Minera Q4"
              className={inputClass}
            />
          </div>

          {/* Row: Empresa + Contacto */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                Empresa <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={form.empresa}
                onChange={set('empresa')}
                placeholder="Nombre empresa"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Contacto principal</label>
              <input
                type="text"
                value={form.contacto}
                onChange={set('contacto')}
                placeholder="Nombre contacto"
                className={inputClass}
              />
            </div>
          </div>

          {/* Row: Valor + Etapa */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                Valor CLP <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">
                  $
                </span>
                <input
                  type="number"
                  required
                  min={0}
                  value={form.valor}
                  onChange={set('valor')}
                  placeholder="0"
                  className={inputClass + ' pl-7'}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Etapa</label>
              <select value={form.etapa} onChange={set('etapa')} className={inputClass}>
                {['Lead', 'Contactado', 'Propuesta', 'Negociación'].map((e) => (
                  <option key={e}>{e}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row: Fecha cierre + Probabilidad */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Fecha cierre estimada</label>
              <input
                type="date"
                value={form.fechaCierre}
                onChange={set('fechaCierre')}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Probabilidad %</label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.probabilidad}
                onChange={set('probabilidad')}
                placeholder="0–100"
                className={inputClass}
              />
            </div>
          </div>

          {/* Responsable */}
          <div>
            <label className={labelClass}>Responsable</label>
            <select value={form.responsable} onChange={set('responsable')} className={inputClass}>
              {['Carlos', 'Ana', 'Rodrigo'].map((r) => (
                <option key={r}>{r}</option>
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
              placeholder="Contexto del negocio..."
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
            Crear Negocio
          </button>
        </div>
      </form>
    </Modal>
  );
}
