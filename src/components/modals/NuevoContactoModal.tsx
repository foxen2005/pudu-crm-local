import { useState } from 'react';
import { Modal } from '@/components/modals/Modal';

const labelClass = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5';
const inputClass =
  'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white';

export function NuevoContactoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    empresa: '',
    cargo: '',
    estado: 'Prospecto',
    notas: '',
  });

  const set = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: wire to API
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuevo Contacto" size="md">
      <form onSubmit={handleSubmit}>
        <div className="px-6 py-5 space-y-4">
          {/* Row 1 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                Nombre <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={form.nombre}
                onChange={set('nombre')}
                placeholder="Ej. Carlos"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>
                Apellido <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={form.apellido}
                onChange={set('apellido')}
                placeholder="Ej. Méndez"
                className={inputClass}
              />
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                Email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={set('email')}
                placeholder="correo@empresa.cl"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Teléfono</label>
              <input
                type="text"
                value={form.telefono}
                onChange={set('telefono')}
                placeholder="+56 9 1234 5678"
                className={inputClass}
              />
            </div>
          </div>

          {/* Row 3 */}
          <div className="grid grid-cols-2 gap-4">
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
            <div>
              <label className={labelClass}>Cargo / Rol</label>
              <input
                type="text"
                value={form.cargo}
                onChange={set('cargo')}
                placeholder="Ej. Gerente Comercial"
                className={inputClass}
              />
            </div>
          </div>

          {/* Row 4: Estado */}
          <div>
            <label className={labelClass}>Estado</label>
            <select value={form.estado} onChange={set('estado')} className={inputClass}>
              <option>Prospecto</option>
              <option>Cliente Activo</option>
              <option>Inactivo</option>
            </select>
          </div>

          {/* Row 5: Notas */}
          <div>
            <label className={labelClass}>Notas</label>
            <textarea
              rows={3}
              value={form.notas}
              onChange={set('notas')}
              placeholder="Notas adicionales..."
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
            Crear Contacto
          </button>
        </div>
      </form>
    </Modal>
  );
}
