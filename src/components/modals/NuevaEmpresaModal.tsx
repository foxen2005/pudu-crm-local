import { useState } from 'react';
import { Modal } from '@/components/modals/Modal';

const labelClass = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5';
const inputClass =
  'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white';

export function NuevaEmpresaModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({
    nombre: '',
    sector: 'Tecnología',
    rut: '',
    sitioWeb: '',
    direccion: '',
    ciudad: '',
    tamano: '1-10',
    notas: '',
  });

  const set = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Nueva Empresa" size="md">
      <form onSubmit={handleSubmit}>
        <div className="px-6 py-5 space-y-4">
          {/* Row 1 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                Nombre empresa <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={form.nombre}
                onChange={set('nombre')}
                placeholder="Ej. Acme Corp SpA"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Sector</label>
              <select value={form.sector} onChange={set('sector')} className={inputClass}>
                {['Tecnología', 'Minería', 'Retail', 'Logística', 'Inmobiliaria', 'Agro', 'Finanzas', 'Otro'].map(
                  (s) => (
                    <option key={s}>{s}</option>
                  )
                )}
              </select>
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>RUT</label>
              <input
                type="text"
                value={form.rut}
                onChange={set('rut')}
                placeholder="76.123.456-7"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Sitio web</label>
              <input
                type="text"
                value={form.sitioWeb}
                onChange={set('sitioWeb')}
                placeholder="www.empresa.cl"
                className={inputClass}
              />
            </div>
          </div>

          {/* Row 3 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Dirección</label>
              <input
                type="text"
                value={form.direccion}
                onChange={set('direccion')}
                placeholder="Av. Providencia 1234"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Ciudad</label>
              <input
                type="text"
                value={form.ciudad}
                onChange={set('ciudad')}
                placeholder="Santiago"
                className={inputClass}
              />
            </div>
          </div>

          {/* Row 4: Tamaño */}
          <div>
            <label className={labelClass}>Tamaño empresa</label>
            <select value={form.tamano} onChange={set('tamano')} className={inputClass}>
              {['1-10', '11-50', '51-200', '201-500', '500+'].map((t) => (
                <option key={t}>{t}</option>
              ))}
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
            Crear Empresa
          </button>
        </div>
      </form>
    </Modal>
  );
}
