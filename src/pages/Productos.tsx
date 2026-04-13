import { useState, useEffect } from 'react';
import { getProductos, crearProducto, actualizarProducto, eliminarProducto, type Producto } from '@/lib/db';

const inputClass = 'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white dark:bg-[#252035] dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500';
const labelClass = 'block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1';

const UNIDADES = ['unidad', 'hora', 'día', 'mes', 'kg', 'lt', 'm²', 'servicio'];

function formatCLP(n: number) {
  return 'CLP $' + n.toLocaleString('es-CL');
}

type FormState = { nombre: string; descripcion: string; precio: string; unidad: string; categoria: string };
const emptyForm: FormState = { nombre: '', descripcion: '', precio: '', unidad: 'unidad', categoria: '' };

export default function Productos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Producto | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    setProductos(await getProductos());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyForm); setFormOpen(true); };

  const openEdit = (p: Producto) => {
    setEditing(p);
    setForm({ nombre: p.nombre, descripcion: p.descripcion ?? '', precio: String(p.precio), unidad: p.unidad, categoria: p.categoria ?? '' });
    setFormOpen(true);
  };

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    const fields = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      precio: Number(form.precio) || 0,
      unidad: form.unidad,
      categoria: form.categoria.trim() || null,
    };
    if (editing) {
      await actualizarProducto(editing.id, fields);
    } else {
      await crearProducto(fields);
    }
    setSaving(false);
    setFormOpen(false);
    load();
  };

  const handleDelete = async (p: Producto) => {
    if (!window.confirm(`¿Archivar "${p.nombre}"?`)) return;
    await eliminarProducto(p.id);
    load();
  };

  const filtered = productos.filter(p =>
    !search || p.nombre.toLowerCase().includes(search.toLowerCase()) || (p.categoria ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const categorias = [...new Set(productos.map(p => p.categoria).filter(Boolean))];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-2 block">Catálogo</span>
          <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Productos</h2>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all">
          <span className="material-symbols-outlined text-sm">add</span>
          Nuevo producto
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">search</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar productos..."
          className="w-full max-w-xs pl-9 pr-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-[#1e1a2e] focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-28 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="material-symbols-outlined text-5xl text-slate-200 dark:text-slate-700 mb-4">inventory_2</span>
          <p className="text-slate-400 font-medium mb-3">
            {search ? `Sin resultados para "${search}"` : 'No hay productos registrados'}
          </p>
          {!search && <button onClick={openNew} className="text-xs text-primary font-bold hover:underline">Crear el primer producto</button>}
        </div>
      ) : (
        <>
          {categorias.map(cat => {
            const group = filtered.filter(p => p.categoria === cat);
            if (!group.length) return null;
            return (
              <div key={cat} className="mb-6">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">{cat}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {group.map(p => <ProductCard key={p.id} p={p} onEdit={openEdit} onDelete={handleDelete} />)}
                </div>
              </div>
            );
          })}
          {filtered.filter(p => !p.categoria).length > 0 && (
            <div className="mb-6">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Sin categoría</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.filter(p => !p.categoria).map(p => <ProductCard key={p.id} p={p} onEdit={openEdit} onDelete={handleDelete} />)}
              </div>
            </div>
          )}
        </>
      )}

      {/* Drawer / Form */}
      {formOpen && (
        <>
          <div className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 backdrop-blur-[1px]" onClick={() => setFormOpen(false)} />
          <div className="fixed right-0 top-0 h-full w-96 max-w-full bg-white dark:bg-[#1e1a2e] shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-700/50">
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                {editing ? 'Editar producto' : 'Nuevo producto'}
              </h3>
              <button onClick={() => setFormOpen(false)} className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div>
                <label className={labelClass}>Nombre *</label>
                <input type="text" value={form.nombre} onChange={set('nombre')} placeholder="Ej: Consultoría hora" className={inputClass} autoFocus />
              </div>
              <div>
                <label className={labelClass}>Descripción</label>
                <textarea value={form.descripcion} onChange={set('descripcion')} rows={2} placeholder="Descripción opcional" className={inputClass + ' resize-none'} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Precio</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                    <input type="number" min={0} value={form.precio} onChange={set('precio')} placeholder="0" className={inputClass + ' pl-7'} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Unidad</label>
                  <select value={form.unidad} onChange={set('unidad')} className={inputClass}>
                    {UNIDADES.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>Categoría</label>
                <input type="text" value={form.categoria} onChange={set('categoria')} placeholder="Ej: Servicios, Software..." list="categorias-list" className={inputClass} />
                <datalist id="categorias-list">
                  {categorias.map(c => <option key={c as string} value={c as string} />)}
                </datalist>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
              <button onClick={() => setFormOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={!form.nombre.trim() || saving} className="flex items-center gap-2 px-5 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-40">
                {saving ? <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span> : <span className="material-symbols-outlined text-sm">save</span>}
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear producto'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ProductCard({ p, onEdit, onDelete }: { p: Producto; onEdit: (p: Producto) => void; onDelete: (p: Producto) => void }) {
  return (
    <div className="bg-white dark:bg-[#1e1a2e] rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm p-4 group hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{p.nombre}</p>
          {p.descripcion && <p className="text-[10px] text-slate-400 truncate mt-0.5">{p.descripcion}</p>}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2">
          <button onClick={() => onEdit(p)} className="size-6 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-sm">edit</span>
          </button>
          <button onClick={() => onDelete(p)} className="size-6 flex items-center justify-center rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors">
            <span className="material-symbols-outlined text-sm">archive</span>
          </button>
        </div>
      </div>
      <p className="text-base font-black text-primary">{formatCLP(p.precio)}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">por {p.unidad}</p>
    </div>
  );
}
