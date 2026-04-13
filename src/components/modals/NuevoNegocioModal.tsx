import { useState, useEffect, useRef } from 'react';
import { Modal } from '@/components/modals/Modal';
import {
  crearNegocio, actualizarNegocio, buscarEmpresasSugerencias, buscarEmpresaPorRut,
  getPipelines,
  type Negocio, type Empresa, type Pipeline,
} from '@/lib/db';
import { CamposExtrasForm } from '@/components/CamposExtrasForm';

const labelClass = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5';
const inputClass =
  'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white dark:bg-[#252035] dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500';

const defaultForm = {
  nombre: '', empresa: '', contacto: '', valor: '',
  etapa: 'Prospección', fechaCierre: '', probabilidad: '', descripcion: '', riesgo: 'false',
};

export function NuevoNegocioModal({
  open,
  onClose,
  onSuccess,
  negocio,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  negocio?: Negocio;
}) {
  const [form, setForm] = useState(defaultForm);
  const [camposExtra, setCamposExtra] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [pipelineId, setPipelineId] = useState<string>('');

  // Autocomplete empresa
  const [sugerencias, setSugerencias] = useState<Empresa[]>([]);
  const [showSugerencias, setShowSugerencias] = useState(false);
  const empresaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getPipelines().then(setPipelines);
  }, []);

  useEffect(() => {
    if (negocio) {
      setForm({
        nombre: negocio.nombre,
        empresa: negocio.empresa_nombre ?? '',
        contacto: negocio.contacto_nombre ?? '',
        valor: negocio.valor != null ? String(negocio.valor) : '',
        etapa: negocio.etapa,
        fechaCierre: negocio.fecha_cierre ?? '',
        probabilidad: negocio.probabilidad != null ? String(negocio.probabilidad) : '',
        descripcion: negocio.descripcion ?? '',
        riesgo: negocio.riesgo ? 'true' : 'false',
      });
      setPipelineId((negocio as Negocio & { pipeline_id?: string }).pipeline_id ?? '');
      setCamposExtra((negocio as Negocio & { campos_extra?: Record<string, unknown> }).campos_extra ?? {});
    } else {
      setForm(defaultForm);
      setPipelineId('');
      setCamposExtra({});
    }
    setError(null);
    setSugerencias([]);
    setShowSugerencias(false);
  }, [negocio, open]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (empresaRef.current && !empresaRef.current.contains(e.target as Node)) {
        setShowSugerencias(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const set = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleEmpresaChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setForm(prev => ({ ...prev, empresa: val }));
    if (!val || val.length < 2) {
      setSugerencias([]);
      setShowSugerencias(false);
      return;
    }

    // Si parece un RUT, buscar por RUT y auto-completar
    const digitOnly = val.replace(/[.\-\s]/g, '');
    if (/^\d{7,9}[kK\d]?$/.test(digitOnly)) {
      const found = await buscarEmpresaPorRut(val);
      if (found) {
        setForm(prev => ({ ...prev, empresa: found.razon_social }));
        setSugerencias([]);
        setShowSugerencias(false);
        return;
      }
    }

    const results = await buscarEmpresasSugerencias(val);
    setSugerencias(results);
    setShowSugerencias(results.length > 0);
  };

  const selectEmpresa = (emp: Empresa) => {
    setForm(prev => ({ ...prev, empresa: emp.razon_social }));
    setSugerencias([]);
    setShowSugerencias(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const payload = { ...form, pipeline_id: pipelineId || undefined, campos_extra: camposExtra };
    const result = negocio
      ? await actualizarNegocio(negocio.id, payload)
      : await crearNegocio(payload);
    setLoading(false);
    if (!result.ok) { setError(result.error); return; }
    if (!negocio) { setForm(defaultForm); setCamposExtra({}); setPipelineId(''); }
    onSuccess?.();
    onClose();
  };

  const isEdit = !!negocio;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar Negocio' : 'Nuevo Negocio'} size="md">
      <form onSubmit={handleSubmit}>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className={labelClass}>Nombre negocio <span className="text-red-400">*</span></label>
            <input type="text" required value={form.nombre} onChange={set('nombre')} placeholder="Ej. Licitación Minera Q4" className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Empresa con autocomplete */}
            <div ref={empresaRef} className="relative">
              <label className={labelClass}>Empresa</label>
              <input
                type="text"
                value={form.empresa}
                onChange={handleEmpresaChange}
                onBlur={() => setTimeout(() => setShowSugerencias(false), 150)}
                onFocus={() => { if (sugerencias.length > 0) setShowSugerencias(true); }}
                placeholder="Nombre empresa"
                className={inputClass}
                autoComplete="off"
              />
              {showSugerencias && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#1e1a2e] border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-lg overflow-hidden">
                  {sugerencias.map(emp => (
                    <button
                      key={emp.id}
                      type="button"
                      onMouseDown={() => selectEmpresa(emp)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-base text-slate-400">domain</span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{emp.razon_social}</p>
                        <p className="text-[10px] text-slate-400">{emp.rut ?? emp.giro ?? '—'}</p>
                      </div>
                      <span className="ml-auto text-[10px] font-bold text-green-600 flex-shrink-0">Vincular</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className={labelClass}>Contacto principal</label>
              <input type="text" value={form.contacto} onChange={set('contacto')} placeholder="Nombre contacto" className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Valor CLP <span className="text-red-400">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">$</span>
                <input type="number" required min={0} value={form.valor} onChange={set('valor')} placeholder="0" className={inputClass + ' pl-7'} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Etapa</label>
              <select value={form.etapa} onChange={set('etapa')} className={inputClass}>
                <optgroup label="Pipeline">
                  {['Prospección', 'Calificación', 'Propuesta', 'Negociación', 'Cierre'].map(e => <option key={e}>{e}</option>)}
                </optgroup>
                <optgroup label="Órdenes">
                 D {['Nuevo', 'En proceso', 'Listo', 'Entregado', 'Facturado'].map(e => <option key={e}>{e}</option>)}
                </optgroup>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Fecha cierre estimada</label>
              <input type="date" value={form.fechaCierre} onChange={set('fechaCierre')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Probabilidad %</label>
              <input type="number" min={0} max={100} value={form.probabilidad} onChange={set('probabilidad')} placeholder="0–100" className={inputClass} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Descripción</label>
            <textarea rows={3} value={form.descripcion} onChange={set('descripcion')} placeholder="Contexto del negocio..." className={inputClass + ' resize-none'} />
          </div>

          {pipelines.length > 0 && (
            <div>
              <label className={labelClass}>Pipeline</label>
              <select value={pipelineId} onChange={e => setPipelineId(e.target.value)} className={inputClass}>
                <option value="">Pipeline por defecto</option>
                {pipelines.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
          )}

          <label className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 cursor-pointer">
            <input
              type="checkbox"
              checked={form.riesgo === 'true'}
              onChange={(e) => setForm(prev => ({ ...prev, riesgo: e.target.checked ? 'true' : 'false' }))}
              className="rounded border-orange-300"
            />
            <span className="text-xs font-bold text-orange-700 dark:text-orange-400">Marcar como negocio en riesgo</span>
          </label>

          <CamposExtrasForm entidadTipo="negocio" valores={camposExtra} onChange={setCamposExtra} />

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={loading} className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50">
            {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear Negocio'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
