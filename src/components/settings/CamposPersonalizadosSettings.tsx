import { useState, useEffect } from 'react';
import { getCamposDefinicion, crearCampoDefinicion, eliminarCampoDefinicion, type CampoDefinicion } from '@/lib/db';

const TIPOS = [
  { value: 'texto',    label: 'Texto',     icon: 'text_fields' },
  { value: 'numero',   label: 'Número',    icon: 'tag' },
  { value: 'fecha',    label: 'Fecha',     icon: 'calendar_today' },
  { value: 'select',   label: 'Opciones',  icon: 'list' },
  { value: 'checkbox', label: 'Sí / No',   icon: 'check_box' },
] as const;

const ENTIDADES = [
  { value: 'contacto', label: 'Contactos' },
  { value: 'empresa',  label: 'Empresas' },
  { value: 'negocio',  label: 'Negocios' },
] as const;

const inputClass = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white dark:bg-[#252035] dark:border-slate-600 dark:text-slate-100';

export function CamposPersonalizadosSettings() {
  const [campos, setCampos] = useState<CampoDefinicion[]>([]);
  const [addingTo, setAddingTo] = useState<CampoDefinicion['entidad_tipo'] | null>(null);
  const [form, setForm] = useState({
    nombre: '', clave: '', tipo: 'texto' as CampoDefinicion['tipo'],
    opciones: '', requerido: false,
  });
  const [saving, setSaving] = useState(false);

  const load = async () => setCampos(await getCamposDefinicion());
  useEffect(() => { load(); }, []);

  const set = (k: string, v: unknown) => setForm(prev => ({ ...prev, [k]: v }));

  const handleAdd = async () => {
    if (!addingTo || !form.nombre.trim()) return;
    setSaving(true);
    const clave = form.clave.trim() || form.nombre.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    await crearCampoDefinicion({
      entidad_tipo: addingTo,
      nombre: form.nombre.trim(),
      clave,
      tipo: form.tipo,
      opciones: form.tipo === 'select' ? form.opciones.split('\n').map(s => s.trim()).filter(Boolean) : [],
      requerido: form.requerido,
      orden: campos.filter(c => c.entidad_tipo === addingTo).length,
    });
    setSaving(false);
    setAddingTo(null);
    setForm({ nombre: '', clave: '', tipo: 'texto', opciones: '', requerido: false });
    load();
  };

  const handleDelete = async (c: CampoDefinicion) => {
    if (!window.confirm(`¿Eliminar campo "${c.nombre}"? Los valores guardados no se borrarán.`)) return;
    await eliminarCampoDefinicion(c.id);
    load();
  };

  return (
    <div className="space-y-5">
      {ENTIDADES.map(({ value, label }) => {
        const entCampos = campos.filter(c => c.entidad_tipo === value);
        return (
          <div key={value} className="bg-slate-50 dark:bg-[#252035]/60 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-black text-slate-700 dark:text-slate-300">{label}</p>
              <button
                onClick={() => setAddingTo(addingTo === value ? null : value as CampoDefinicion['entidad_tipo'])}
                className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Agregar campo
              </button>
            </div>

            {entCampos.length === 0 && addingTo !== value && (
              <p className="text-[11px] text-slate-400">Sin campos personalizados</p>
            )}

            {entCampos.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {entCampos.map(c => (
                  <div key={c.id} className="flex items-center gap-3 px-3 py-2 bg-white dark:bg-[#1e1a2e] rounded-lg border border-slate-100 dark:border-slate-700/50">
                    <span className="material-symbols-outlined text-sm text-slate-400">
                      {TIPOS.find(t => t.value === c.tipo)?.icon ?? 'text_fields'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{c.nombre}</p>
                      <p className="text-[9px] text-slate-400">{c.clave} · {TIPOS.find(t => t.value === c.tipo)?.label}</p>
                    </div>
                    {c.requerido && <span className="text-[9px] font-bold text-red-500">Requerido</span>}
                    <button onClick={() => handleDelete(c)} className="size-6 flex items-center justify-center rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors">
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {addingTo === value && (
              <div className="mt-3 p-3 bg-white dark:bg-[#1e1a2e] rounded-xl border border-primary/20 space-y-3">
                <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Nuevo campo</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Nombre *</label>
                    <input value={form.nombre} onChange={e => { set('nombre', e.target.value); set('clave', e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')); }} placeholder="Ej: Región" className={inputClass} autoFocus />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Tipo</label>
                    <select value={form.tipo} onChange={e => set('tipo', e.target.value)} className={inputClass}>
                      {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>
                {form.tipo === 'select' && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Opciones (una por línea)</label>
                    <textarea value={form.opciones} onChange={e => set('opciones', e.target.value)} rows={3} placeholder="Opción 1&#10;Opción 2" className={inputClass + ' resize-none'} />
                  </div>
                )}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.requerido} onChange={e => set('requerido', e.target.checked)} className="rounded" />
                  <span className="text-xs text-slate-600 dark:text-slate-400">Campo requerido</span>
                </label>
                <div className="flex gap-2">
                  <button onClick={() => setAddingTo(null)} className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancelar</button>
                  <button onClick={handleAdd} disabled={!form.nombre.trim() || saving} className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90 transition-all disabled:opacity-40">
                    {saving ? <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span> : <span className="material-symbols-outlined text-sm">add</span>}
                    Agregar
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
