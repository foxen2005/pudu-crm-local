import { useState, useEffect, useRef } from 'react';
import { Modal } from '@/components/modals/Modal';
import {
  crearContacto, actualizarContacto,
  buscarEmpresaPorRut, buscarEmpresasSugerencias,
  buscarDuplicadosContacto,
  type Contacto, type Empresa,
} from '@/lib/db';
import { CamposExtrasForm } from '@/components/CamposExtrasForm';

const labelClass = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5';
const inputClass =
  'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white dark:bg-[#252035] dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500';

const defaultForm = {
  nombre: '', apellido: '', email: '', telefono: '',
  empresa: '', empresa_rut: '', empresa_giro: 'Tecnología', empresa_ciudad: '', empresa_tamano: '1-10',
  cargo: '', estado: 'Prospecto',
};

export function NuevoContactoModal({
  open, onClose, onSuccess, contacto, initialValues,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  contacto?: Contacto;
  initialValues?: Partial<typeof defaultForm>;
}) {
  const [form, setForm] = useState(defaultForm);
  const [camposExtra, setCamposExtra] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicados, setDuplicados] = useState<Contacto[]>([]);
  const [empresaStatus, setEmpresaStatus] = useState<'existente' | 'nueva' | null>(null);
  const [checkingEmpresa, setCheckingEmpresa] = useState(false);

  // Autocomplete
  const [sugerencias, setSugerencias] = useState<Empresa[]>([]);
  const [showSugerencias, setShowSugerencias] = useState(false);
  const empresaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contacto) {
      setForm({
        nombre: contacto.nombre,
        apellido: contacto.apellido ?? '',
        email: contacto.email ?? '',
        telefono: contacto.telefono ?? '',
        empresa: contacto.empresa_nombre ?? '',
        empresa_rut: '',
        empresa_giro: 'Tecnología',
        empresa_ciudad: '',
        empresa_tamano: '1-10',
        cargo: contacto.cargo ?? '',
        estado: contacto.estado,
      });
      setCamposExtra((contacto as Contacto & { campos_extra?: Record<string, unknown> }).campos_extra ?? {});
    } else {
      setForm({ ...defaultForm, ...(initialValues ?? {}) });
      setCamposExtra({});
    }
    setDuplicados([]);
    setEmpresaStatus(null);
    setSugerencias([]);
    setShowSugerencias(false);
    setError(null);
  }, [contacto, open]);

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
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
    if (field === 'empresa_rut') setEmpresaStatus(null);
  };

  const setField = (field: keyof typeof form, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  // Mientras el usuario escribe el nombre de empresa → buscar sugerencias locales
  const handleEmpresaChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setForm(prev => ({ ...prev, empresa: val }));
    setEmpresaStatus(null);

    if (!val || val.length < 2) {
      setSugerencias([]);
      setShowSugerencias(false);
      return;
    }

    // Si parece un RUT (7+ dígitos tras quitar separadores), buscar por RUT primero
    const digitOnly = val.replace(/[.\-\s]/g, '');
    if (/^\d{7,9}[kK\d]?$/.test(digitOnly)) {
      const found = await buscarEmpresaPorRut(val);
      if (found) { selectEmpresa(found); return; }
    }

    const results = await buscarEmpresasSugerencias(val);
    setSugerencias(results);
    setShowSugerencias(results.length > 0);
  };

  // Usuario selecciona una empresa existente del dropdown
  const selectEmpresa = (emp: Empresa) => {
    setForm(prev => ({
      ...prev,
      empresa: emp.razon_social,
      empresa_rut: emp.rut ?? '',
    }));
    setEmpresaStatus('existente');
    setSugerencias([]);
    setShowSugerencias(false);
  };

  // onBlur: si no seleccionó del dropdown, verificar por RUT o nombre
  const checkEmpresa = async () => {
    if (!form.empresa || contacto) return;
    if (empresaStatus === 'existente') return; // ya está resuelta
    setCheckingEmpresa(true);
    let found = null;
    // 1. Por RUT explícito
    if (form.empresa_rut) found = await buscarEmpresaPorRut(form.empresa_rut);
    // 2. Si el campo empresa parece un RUT, buscar por él también
    if (!found) {
      const digitOnly = form.empresa.replace(/[.\-\s]/g, '');
      if (/^\d{7,9}[kK\d]?$/.test(digitOnly)) found = await buscarEmpresaPorRut(form.empresa);
    }
    // 3. Por nombre exacto
    if (!found) {
      const results = await buscarEmpresasSugerencias(form.empresa);
      found = results.find(r =>
        r.razon_social.toLowerCase() === form.empresa.toLowerCase()
      ) ?? null;
    }
    setEmpresaStatus(found ? 'existente' : 'nueva');
    if (found && !form.empresa_rut && found.rut) {
      setField('empresa_rut', found.rut);
    }
    setCheckingEmpresa(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Duplicate check on create
    if (!contacto && duplicados.length === 0) {
      const dups = await buscarDuplicadosContacto(form.nombre + ' ' + form.apellido, form.email || undefined);
      if (dups.length > 0) {
        setDuplicados(dups);
        setLoading(false);
        return;
      }
    }

    const payload = { ...form, campos_extra: camposExtra } as Record<string, string>;
    const result = contacto
      ? await actualizarContacto(contacto.id, payload)
      : await crearContacto(payload);
    setLoading(false);
    if (!result.ok) { setError(result.error); return; }
    if (!contacto) { setForm(defaultForm); setCamposExtra({}); }
    onSuccess?.();
    onClose();
  };

  const isEdit = !!contacto;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar Contacto' : 'Nuevo Contacto'} size="md">
      <form onSubmit={handleSubmit}>
        <div className="px-6 py-5 space-y-4">
          {/* Nombre / Apellido */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Nombre <span className="text-red-400">*</span></label>
              <input type="text" required value={form.nombre} onChange={set('nombre')} placeholder="Ej. Carlos" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Apellido</label>
              <input type="text" value={form.apellido} onChange={set('apellido')} placeholder="Ej. Méndez" className={inputClass} />
            </div>
          </div>

          {/* Email / Teléfono */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" value={form.email} onChange={set('email')} placeholder="correo@empresa.cl" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Teléfono</label>
              <input type="text" value={form.telefono} onChange={set('telefono')} placeholder="+56 9 1234 5678" className={inputClass} />
            </div>
          </div>

          {/* Empresa con autocomplete */}
          <div ref={empresaRef} className="relative">
            <label className={labelClass}>Empresa</label>
            <input
              type="text"
              value={form.empresa}
              onChange={handleEmpresaChange}
              onBlur={() => { setTimeout(() => { setShowSugerencias(false); checkEmpresa(); }, 150); }}
              onFocus={() => { if (sugerencias.length > 0) setShowSugerencias(true); }}
              placeholder="Nombre de la empresa"
              className={inputClass}
              autoComplete="off"
            />

            {/* Dropdown sugerencias */}
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
                <div className="px-3 py-2 border-t border-slate-50 dark:border-slate-700/50 bg-slate-50 dark:bg-[#252035]">
                  <p className="text-[10px] text-slate-400">¿No está? Escribe el nombre completo y se creará nueva.</p>
                </div>
              </div>
            )}

            {/* Indicador de estado */}
            {!isEdit && form.empresa && (
              <div className="mt-1.5 flex items-center gap-1.5">
                {checkingEmpresa ? (
                  <span className="text-[10px] text-slate-400 font-medium">Verificando...</span>
                ) : empresaStatus === 'existente' ? (
                  <>
                    <span className="material-symbols-outlined text-xs text-green-600">check_circle</span>
                    <span className="text-[10px] font-bold text-green-600">Empresa existente — se vinculará automáticamente</span>
                  </>
                ) : empresaStatus === 'nueva' ? (
                  <>
                    <span className="material-symbols-outlined text-xs text-blue-500">add_circle</span>
                    <span className="text-[10px] font-bold text-blue-500">Empresa nueva — se creará automáticamente</span>
                  </>
                ) : null}
              </div>
            )}
          </div>

          {/* Datos empresa — solo si hay nombre, no es edición, y no es existente */}
          {!isEdit && form.empresa && empresaStatus !== 'existente' && (
            <div className={`space-y-3 rounded-xl border p-4 transition-all ${empresaStatus === 'nueva' ? 'border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-900/10' : 'border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-[#252035]/50'}`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Datos de la empresa</p>

              <div>
                <label className={labelClass}>RUT <span className="text-slate-300 font-normal normal-case">(evita duplicados)</span></label>
                <input
                  type="text"
                  value={form.empresa_rut}
                  onChange={set('empresa_rut')}
                  onBlur={checkEmpresa}
                  placeholder="76.123.456-7"
                  className={inputClass}
                />
              </div>

              {empresaStatus === 'nueva' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Giro / Sector</label>
                      <select value={form.empresa_giro} onChange={set('empresa_giro')} className={inputClass}>
                        {['Tecnología','Minería','Retail','Logística','Inmobiliaria','Agro','Finanzas','Otro'].map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Ciudad</label>
                      <input type="text" value={form.empresa_ciudad} onChange={set('empresa_ciudad')} placeholder="Santiago" className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Tamaño empresa</label>
                    <div className="flex gap-2">
                      {['1-10','11-50','51-200','201-500','500+'].map(t => (
                        <button
                          key={t} type="button"
                          onClick={() => setField('empresa_tamano', t)}
                          className={`flex-1 py-2 rounded-lg text-[10px] font-bold border transition-all ${form.empresa_tamano === t ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-[#252035] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'}`}
                        >{t}</button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Cargo / Estado */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Cargo / Rol</label>
              <input type="text" value={form.cargo} onChange={set('cargo')} placeholder="Ej. Gerente Comercial" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Estado</label>
              <select value={form.estado} onChange={set('estado')} className={inputClass}>
                <option>Prospecto</option>
                <option>Cliente Activo</option>
                <option>Inactivo</option>
              </select>
            </div>
          </div>

          <CamposExtrasForm entidadTipo="contacto" valores={camposExtra} onChange={setCamposExtra} />

          {duplicados.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl p-4">
              <p className="text-xs font-bold text-amber-800 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">warning</span>
                Posibles duplicados encontrados
              </p>
              <div className="space-y-1.5 mb-3">
                {duplicados.map(d => (
                  <div key={d.id} className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
                    <span className="material-symbols-outlined text-xs">person</span>
                    <span className="font-medium">{d.nombre} {d.apellido}</span>
                    <span className="text-amber-500">·</span>
                    <span>{d.email ?? d.telefono ?? '—'}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-amber-600 dark:text-amber-400">¿Deseas crearlo de todos modos?</p>
            </div>
          )}

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={loading} className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50">
            {loading ? 'Guardando...' : duplicados.length > 0 ? 'Crear de todos modos' : isEdit ? 'Guardar cambios' : 'Crear Contacto'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
