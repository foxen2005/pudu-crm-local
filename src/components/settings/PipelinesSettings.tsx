import { useState, useEffect } from 'react';
import { getPipelines, crearPipeline, actualizarPipeline, eliminarPipeline, type Pipeline, type PipelineEtapa } from '@/lib/db';

const inputClass = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white dark:bg-[#252035] dark:border-slate-600 dark:text-slate-100';

const PRESET_COLORS = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#3b82f6'];

function genId() { return Math.random().toString(36).slice(2, 8); }

const DEFAULT_ETAPAS: PipelineEtapa[] = [
  { id: genId(), label: 'Prospección', color: '#94a3b8', orden: 0 },
  { id: genId(), label: 'Propuesta',   color: '#6366f1', orden: 1 },
  { id: genId(), label: 'Cierre',      color: '#22c55e', orden: 2 },
];

export function PipelinesSettings() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Pipeline | null>(null);
  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [etapas, setEtapas] = useState<PipelineEtapa[]>(DEFAULT_ETAPAS);
  const [saving, setSaving] = useState(false);

  const load = async () => setPipelines(await getPipelines());
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setNombre('');
    setColor(PRESET_COLORS[0]);
    setEtapas(DEFAULT_ETAPAS.map(e => ({ ...e, id: genId() })));
    setFormOpen(true);
  };

  const openEdit = (p: Pipeline) => {
    setEditing(p);
    setNombre(p.nombre);
    setColor(p.color);
    setEtapas(p.etapas.length > 0 ? p.etapas : DEFAULT_ETAPAS.map(e => ({ ...e, id: genId() })));
    setFormOpen(true);
  };

  const addEtapa = () => setEtapas(prev => [...prev, { id: genId(), label: '', color: '#94a3b8', orden: prev.length }]);
  const removeEtapa = (id: string) => setEtapas(prev => prev.filter(e => e.id !== id));
  const setEtapa = (id: string, field: keyof PipelineEtapa, val: string | number) =>
    setEtapas(prev => prev.map(e => e.id === id ? { ...e, [field]: val } : e));

  const handleSave = async () => {
    if (!nombre.trim()) return;
    setSaving(true);
    const validEtapas = etapas.filter(e => e.label.trim()).map((e, i) => ({ ...e, orden: i }));
    if (editing) {
      await actualizarPipeline(editing.id, { nombre: nombre.trim(), color, etapas: validEtapas });
    } else {
      await crearPipeline({ nombre: nombre.trim(), color, etapas: validEtapas, orden: pipelines.length });
    }
    setSaving(false);
    setFormOpen(false);
    load();
  };

  const handleDelete = async (p: Pipeline) => {
    if (!window.confirm(`¿Archivar pipeline "${p.nombre}"?`)) return;
    await eliminarPipeline(p.id);
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pipelines</p>
        <button onClick={openNew} className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline">
          <span className="material-symbols-outlined text-sm">add</span>
          Nuevo pipeline
        </button>
      </div>

      {pipelines.length === 0 ? (
        <p className="text-[11px] text-slate-400">Sin pipelines personalizados. Los stages por defecto (Pipeline y Órdenes) siguen activos.</p>
      ) : (
        <div className="space-y-2">
          {pipelines.map(p => (
            <div key={p.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-[#252035]/60 rounded-xl border border-slate-100 dark:border-slate-700/50">
              <div className="size-3 rounded-full flex-shrink-0" style={{ background: p.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{p.nombre}</p>
                <p className="text-[10px] text-slate-400">{p.etapas.length} etapa{p.etapas.length !== 1 ? 's' : ''}: {p.etapas.map(e => e.label).join(' → ')}</p>
              </div>
              <button onClick={() => openEdit(p)} className="size-7 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-sm">edit</span>
              </button>
              <button onClick={() => handleDelete(p)} className="size-7 flex items-center justify-center rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors">
                <span className="material-symbols-outlined text-sm">delete</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <>
          <div className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 backdrop-blur-[1px]" onClick={() => setFormOpen(false)} />
          <div className="fixed right-0 top-0 h-full w-96 max-w-full bg-white dark:bg-[#1e1a2e] shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-700/50">
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">{editing ? 'Editar pipeline' : 'Nuevo pipeline'}</h3>
              <button onClick={() => setFormOpen(false)} className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Nombre *</label>
                <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Ventas Enterprise" className={inputClass} autoFocus />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-2">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.map(c => (
                    <button key={c} onClick={() => setColor(c)} className={`size-7 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-slate-500 scale-110' : 'hover:scale-110'}`} style={{ background: c }} />
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-bold text-slate-400">Etapas</label>
                  <button onClick={addEtapa} className="text-[11px] font-bold text-primary hover:underline flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-sm">add</span> Agregar
                  </button>
                </div>
                <div className="space-y-2">
                  {etapas.map((e, i) => (
                    <div key={e.id} className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 w-4 flex-shrink-0">{i + 1}</span>
                      <input
                        value={e.label}
                        onChange={ev => setEtapa(e.id, 'label', ev.target.value)}
                        placeholder={`Etapa ${i + 1}`}
                        className={inputClass + ' flex-1'}
                      />
                      <input
                        type="color"
                        value={e.color}
                        onChange={ev => setEtapa(e.id, 'color', ev.target.value)}
                        className="size-8 rounded cursor-pointer border-0 bg-transparent p-0.5"
                        title="Color de etapa"
                      />
                      <button onClick={() => removeEtapa(e.id)} disabled={etapas.length <= 1} className="size-7 flex items-center justify-center rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors disabled:opacity-20">
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
              <button onClick={() => setFormOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all">Cancelar</button>
              <button onClick={handleSave} disabled={!nombre.trim() || saving} className="flex items-center gap-2 px-5 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-40">
                {saving ? <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span> : <span className="material-symbols-outlined text-sm">save</span>}
                {saving ? 'Guardando...' : editing ? 'Guardar' : 'Crear pipeline'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
