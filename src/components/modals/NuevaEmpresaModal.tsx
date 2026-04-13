import { useState, useEffect } from 'react';
import { Modal } from '@/components/modals/Modal';
import { crearEmpresa, actualizarEmpresa, buscarEmpresaPorRut, buscarDuplicadosEmpresa, type Empresa } from '@/lib/db';
import { CamposExtrasForm } from '@/components/CamposExtrasForm';

const labelClass = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5';
const inputClass =
  'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white dark:bg-[#252035] dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500';

const defaultForm = { razonSocial: '', giro: 'Tecnología', rut: '', sitioWeb: '', direccion: '', ciudad: '', tamano: '1-10' };

export function NuevaEmpresaModal({
  open,
  onClose,
  onSuccess,
  empresa,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  empresa?: Empresa;
}) {
  const [form, setForm] = useState(defaultForm);
  const [camposExtra, setCamposExtra] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rutWarning, setRutWarning] = useState<string | null>(null);
  const [duplicados, setDuplicados] = useState<Empresa[]>([]);

  const checkRut = async () => {
    if (!form.rut || isEdit) return;
    const existing = await buscarEmpresaPorRut(form.rut);
    if (existing) {
      setRutWarning(`Ya existe: "${existing.razon_social}"`);
    } else {
      setRutWarning(null);
    }
  };

  useEffect(() => {
    if (empresa) {
      setForm({
        razonSocial: empresa.razon_social,
        giro: empresa.giro ?? 'Tecnología',
        rut: empresa.rut ?? '',
        sitioWeb: empresa.sitio_web ?? '',
        direccion: empresa.direccion ?? '',
        ciudad: empresa.ciudad ?? '',
        tamano: empresa.tamano ?? '1-10',
      });
      setCamposExtra((empresa as Empresa & { campos_extra?: Record<string, unknown> }).campos_extra ?? {});
    } else {
      setForm(defaultForm);
      setCamposExtra({});
    }
    setError(null);
    setRutWarning(null);
    setDuplicados([]);
  }, [empresa, open]);

  const set = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!empresa && duplicados.length === 0) {
      const dups = await buscarDuplicadosEmpresa(form.razonSocial, form.rut || undefined);
      if (dups.length > 0) {
        setDuplicados(dups);
        setLoading(false);
        return;
      }
    }

    const payload = { ...form, campos_extra: camposExtra };
    const result = empresa
      ? await actualizarEmpresa(empresa.id, payload)
      : await crearEmpresa(payload);
    setLoading(false);
    if (!result.ok) { setError(result.error); return; }
    if (!empresa) { setForm(defaultForm); setCamposExtra({}); }
    onSuccess?.();
    onClose();
  };

  const isEdit = !!empresa;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar Empresa' : 'Nueva Empresa'} size="md">
      <form onSubmit={handleSubmit}>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Razón Social <span className="text-red-400">*</span></label>
              <input type="text" required value={form.razonSocial} onChange={set('razonSocial')} placeholder="Ej. Acme Corp SpA" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Giro / Sector</label>
              <select value={form.giro} onChange={set('giro')} className={inputClass}>
                {['Tecnología', 'Minería', 'Retail', 'Logística', 'Inmobiliaria', 'Agro', 'Finanzas', 'Otro'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>RUT</label>
              <input
                type="text"
                value={form.rut}
                onChange={e => { set('rut')(e); setRutWarning(null); }}
                onBlur={checkRut}
                placeholder="76.123.456-7"
                className={inputClass}
              />
              {rutWarning && (
                <p className="text-[10px] text-orange-600 mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">warning</span>
                  {rutWarning}
                </p>
              )}
            </div>
            <div>
              <label className={labelClass}>Sitio web</label>
              <input type="text" value={form.sitioWeb} onChange={set('sitioWeb')} placeholder="www.empresa.cl" className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Dirección</label>
              <input type="text" value={form.direccion} onChange={set('direccion')} placeholder="Av. Providencia 1234" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Ciudad</label>
              <input type="text" value={form.ciudad} onChange={set('ciudad')} placeholder="Santiago" className={inputClass} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Tamaño empresa</label>
            <select value={form.tamano} onChange={set('tamano')} className={inputClass}>
              {['1-10', '11-50', '51-200', '201-500', '500+'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          <CamposExtrasForm entidadTipo="empresa" valores={camposExtra} onChange={setCamposExtra} />

          {duplicados.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl p-4">
              <p className="text-xs font-bold text-amber-800 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">warning</span>
                Posibles duplicados encontrados
              </p>
              <div className="space-y-1.5 mb-2">
                {duplicados.map(d => (
                  <div key={d.id} className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
                    <span className="material-symbols-outlined text-xs">domain</span>
                    <span className="font-medium">{d.razon_social}</span>
                    {d.rut && <><span className="text-amber-500">·</span><span>{d.rut}</span></>}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-amber-600 dark:text-amber-400">¿Deseas crearla de todos modos?</p>
            </div>
          )}

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={loading} className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50">
            {loading ? 'Guardando...' : duplicados.length > 0 ? 'Crear de todos modos' : isEdit ? 'Guardar cambios' : 'Crear Empresa'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
