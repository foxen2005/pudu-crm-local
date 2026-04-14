import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { NuevaEmpresaModal } from '@/components/modals/NuevaEmpresaModal';
import { ImportarCSVModal } from '@/components/modals/ImportarCSVModal';
import { getEmpresas, eliminarEmpresa, getEmpresaData360, type Empresa, type EmpresaData360 } from '@/lib/db';

function initials(name: string) {
  const words = name.trim().split(/\s+/);
  return words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function fmtCLP(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString('es-CL')}`;
}

const filterTabs = ['Todos', 'Con RUT', 'Sin RUT'] as const;
type FilterTab = (typeof filterTabs)[number];

export default function Companies() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('Todos');
  const [selectedId, setSelectedId] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editEmpresa, setEditEmpresa] = useState<Empresa | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getEmpresas();
    if (result.ok) setEmpresas(result.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = empresas.filter((e) => {
    if (activeTab === 'Con RUT') return !!e.rut;
    if (activeTab === 'Sin RUT') return !e.rut;
    return true;
  });

  const activeEmpresa = empresas.find((e) => e.id === selectedId) ?? null;

  const handleDelete = async (empresa: Empresa) => {
    if (!window.confirm(`¿Eliminar "${empresa.razon_social}"?\nEsta acción no se puede deshacer.`)) return;
    const result = await eliminarEmpresa(empresa.id);
    if (result.ok) { setSelectedId(''); load(); }
    else window.alert(result.error);
  };

  return (
    <div>
      <div className="flex flex-col mb-8">
        <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-2">Directorio de Empresas</span>
        <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Empresas</h2>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard icon="domain" label="Total Empresas" value={loading ? '...' : String(empresas.length)} />
        <StatCard icon="business_center" label="Con RUT registrado" value={loading ? '...' : String(empresas.filter(e => e.rut).length)} color="text-orange-600" />
        <StatCard icon="location_city" label="Ciudades distintas" value={loading ? '...' : String(new Set(empresas.map(e => e.ciudad).filter(Boolean)).size)} color="text-primary" />
      </div>

      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center p-1 bg-slate-200/50 dark:bg-slate-800 rounded-lg">
            {filterTabs.map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-5 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === tab ? 'bg-white dark:bg-[#252035] shadow-sm text-primary' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                {tab}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => load()} className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-all">
              <span className="material-symbols-outlined text-sm">refresh</span>
              Actualizar
            </button>
            <button onClick={() => setImportOpen(true)} className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-all">
              <span className="material-symbols-outlined text-sm">upload_file</span>
              Importar CSV
            </button>
            <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20">
              <span className="material-symbols-outlined text-sm">add_business</span>
              Nueva Empresa
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1e1a2e] rounded-xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-700/50">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-[#13111a] border-b border-slate-100 dark:border-slate-700/50">
                <th className="py-4 px-6 w-12"><input type="checkbox" className="rounded text-primary focus:ring-primary/30 border-slate-300" /></th>
                <th className="py-4 px-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Empresa</th>
                <th className="py-4 px-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Giro</th>
                <th className="py-4 px-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Ciudad</th>
                <th className="py-4 px-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">RUT</th>
                <th className="py-4 px-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Creada</th>
                <th className="py-4 px-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}><td colSpan={7} className="py-4 px-6"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <span className="material-symbols-outlined text-3xl text-slate-300 block mb-2">domain</span>
                    <p className="text-sm text-slate-400">No hay empresas registradas</p>
                    <button onClick={() => setModalOpen(true)} className="mt-3 text-xs text-primary font-bold hover:underline">Crear la primera empresa</button>
                  </td>
                </tr>
              ) : (
                filtered.map((empresa) => (
                  <EmpresaRow key={empresa.id} empresa={empresa}
                    isSelected={empresa.id === selectedId}
                    onSelect={() => setSelectedId(empresa.id === selectedId ? '' : empresa.id)}
                    onEdit={() => setEditEmpresa(empresa)} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EmpresaDetail
        empresa={activeEmpresa}
        onClose={() => setSelectedId('')}
        onEdit={() => activeEmpresa && setEditEmpresa(activeEmpresa)}
        onDelete={() => activeEmpresa && handleDelete(activeEmpresa)}
        fmtCLP={fmtCLP}
      />

      <NuevaEmpresaModal open={modalOpen} onClose={() => setModalOpen(false)} onSuccess={load} />
      <ImportarCSVModal open={importOpen} onClose={() => setImportOpen(false)} tipo="empresa" onSuccess={load} />
      <NuevaEmpresaModal open={!!editEmpresa} onClose={() => setEditEmpresa(null)} empresa={editEmpresa ?? undefined} onSuccess={load} />
    </div>
  );
}

function StatCard({ icon, label, value, color = 'text-slate-900' }: { icon: string; label: string; value: string; color?: string }) {
  return (
    <div className="bg-white dark:bg-[#1e1a2e] rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm px-5 py-4 flex items-center gap-4">
      <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <span className="material-symbols-outlined text-xl text-primary">{icon}</span>
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">{label}</p>
        <p className={`text-xl font-black ${color}`}>{value}</p>
      </div>
    </div>
  );
}

function EmpresaRow({ empresa, isSelected, onSelect, onEdit }: {
  empresa: Empresa; isSelected: boolean; onSelect: () => void; onEdit: () => void;
}) {
  return (
    <tr onClick={onSelect} className={`transition-colors cursor-pointer group ${isSelected ? 'bg-primary/5 border-l-4 border-l-primary' : 'hover:bg-primary/[0.02]'}`}>
      <td className="py-4 px-6"><input type="checkbox" checked={isSelected} readOnly className="rounded text-primary focus:ring-primary/30 border-slate-300" /></td>
      <td className="py-4 px-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm flex-shrink-0">{initials(empresa.razon_social)}</div>
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{empresa.razon_social}</p>
            {empresa.sitio_web && <p className="text-[11px] text-slate-400 dark:text-slate-500">{empresa.sitio_web}</p>}
          </div>
        </div>
      </td>
      <td className="py-4 px-4"><span className="text-xs font-medium text-slate-600 dark:text-slate-300">{empresa.giro ?? '—'}</span></td>
      <td className="py-4 px-4"><span className="text-xs text-slate-600 dark:text-slate-300">{empresa.ciudad ?? '—'}</span></td>
      <td className="py-4 px-4"><span className="text-xs font-mono text-slate-600 dark:text-slate-300">{empresa.rut ?? '—'}</span></td>
      <td className="py-4 px-4"><span className="text-xs text-slate-400 dark:text-slate-500">{new Date(empresa.created_at).toLocaleDateString('es-CL')}</span></td>
      <td className="py-4 px-4">
        <button onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-400 hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-lg">edit</span>
        </button>
      </td>
    </tr>
  );
}

function EmpresaDetail({ empresa, onClose, onEdit, onDelete, fmtCLP }: {
  empresa: Empresa | null; onClose: () => void; onEdit: () => void; onDelete: () => void;
  fmtCLP: (n: number) => string;
}) {
  const open = !!empresa;
  const navigate = useNavigate();
  const [data360, setData360] = useState<EmpresaData360>({ contactos: [], negocios: [] });
  const [data360Loading, setData360Loading] = useState(false);

  useEffect(() => {
    if (!empresa) return;
    setData360Loading(true);
    getEmpresaData360(empresa.razon_social).then(data => {
      setData360(data);
      setData360Loading(false);
    });
  }, [empresa?.id]);

  const goContactos = () => {
    if (!empresa) return;
    navigate(`/contactos?empresa=${encodeURIComponent(empresa.razon_social)}`);
    onClose();
  };
  const goNegocios = () => {
    if (!empresa) return;
    navigate(`/negocios?empresa=${encodeURIComponent(empresa.razon_social)}`);
    onClose();
  };

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/10 z-40 backdrop-blur-[1px]" onClick={onClose} />}
      <aside className={`fixed top-4 right-4 bottom-20 w-[22rem] bg-white dark:bg-[#1e1a2e] rounded-2xl shadow-2xl shadow-black/15 z-50 flex flex-col overflow-y-auto transition-all duration-300 ease-out border border-slate-100/80 dark:border-slate-700/50 ${open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        <div className="flex justify-end px-4 pt-4 flex-shrink-0">
          <button onClick={onClose} className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {empresa && (
          <div className="px-6 pb-6 space-y-4">
            {/* Info card */}
            <div className="bg-white dark:bg-[#252035] rounded-xl shadow-sm border border-slate-100 dark:border-slate-700/50 p-6">
              <div className="flex justify-between items-start mb-5">
                <div className="size-20 rounded-xl bg-primary/10 flex items-center justify-center shadow-md">
                  <span className="text-2xl font-black text-primary">{initials(empresa.razon_social)}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={onEdit} className="size-8 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-400 hover:text-primary transition-colors">
                    <span className="material-symbols-outlined text-lg">edit</span>
                  </button>
                  <button onClick={onDelete} className="size-8 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-400 hover:text-red-500 transition-colors">
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
              </div>

              <div className="mb-5">
                <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">{empresa.razon_social}</h3>
                <div className="flex items-center gap-2 mt-1.5">
                  {empresa.giro && <span className="text-[11px] text-slate-400">{empresa.giro}</span>}
                  {empresa.tamano && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-blue-50 text-blue-700 border-blue-100">
                      {empresa.tamano} empleados
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2 mb-5">
                {empresa.sitio_web && (
                  <InfoRow icon="language" label="Sitio web">
                    <a href={`https://${empresa.sitio_web}`} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-primary hover:underline">{empresa.sitio_web}</a>
                  </InfoRow>
                )}
                {empresa.rut && <InfoRow icon="badge" label="RUT"><span className="text-xs font-mono">{empresa.rut}</span></InfoRow>}
                {empresa.email && <InfoRow icon="mail" label="Email"><span className="text-xs">{empresa.email}</span></InfoRow>}
                {empresa.telefono && <InfoRow icon="call" label="Teléfono"><span className="text-xs">{empresa.telefono}</span></InfoRow>}
                {(empresa.ciudad || empresa.region) && (
                  <InfoRow icon="location_on" label="Ubicación">
                    <span className="text-xs">{[empresa.ciudad, empresa.region].filter(Boolean).join(', ')}</span>
                  </InfoRow>
                )}
              </div>

              <div className="space-y-2">
                <button onClick={goContactos} className="w-full py-2.5 bg-primary text-white text-xs font-bold rounded-lg shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:-translate-y-0.5 transition-all">
                  <span className="material-symbols-outlined text-sm">group</span>
                  Ver Contactos {!data360Loading && `(${data360.contactos.length})`}
                </button>
                <button onClick={goNegocios} className="w-full py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <span className="material-symbols-outlined text-sm">account_tree</span>
                  Ver Negocios {!data360Loading && `(${data360.negocios.length})`}
                </button>
              </div>
            </div>

            {/* 360: Contactos preview */}
            <div className="bg-white dark:bg-[#252035] rounded-xl border border-slate-100 dark:border-slate-700/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Contactos</p>
                {!data360Loading && <span className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-700 px-2 py-0.5 rounded-full">{data360.contactos.length}</span>}
              </div>
              {data360Loading ? (
                <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-7 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />)}</div>
              ) : data360.contactos.length === 0 ? (
                <p className="text-xs text-slate-400">Sin contactos registrados</p>
              ) : (
                <div className="space-y-1">
                  {data360.contactos.slice(0, 4).map(c => (
                    <div key={c.id} className="flex items-center gap-2 py-1">
                      <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary flex-shrink-0">
                        {((c.nombre[0] ?? '') + (c.apellido?.[0] ?? '')).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-700 dark:text-slate-300 truncate">{c.nombre} {c.apellido ?? ''}</p>
                      </div>
                      <span className="text-[10px] text-slate-400">{c.cargo ?? ''}</span>
                    </div>
                  ))}
                  {data360.contactos.length > 4 && (
                    <button onClick={goContactos} className="text-[11px] text-primary font-bold hover:underline mt-1">
                      Ver {data360.contactos.length} contactos →
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 360: Negocios preview */}
            <div className="bg-white dark:bg-[#252035] rounded-xl border border-slate-100 dark:border-slate-700/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Negocios</p>
                {!data360Loading && <span className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-700 px-2 py-0.5 rounded-full">{data360.negocios.length}</span>}
              </div>
              {data360Loading ? (
                <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-7 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />)}</div>
              ) : data360.negocios.length === 0 ? (
                <p className="text-xs text-slate-400">Sin negocios registrados</p>
              ) : (
                <div className="space-y-1">
                  {data360.negocios.slice(0, 4).map(n => (
                    <div key={n.id} className="flex items-center justify-between py-1 gap-2">
                      <p className="text-xs text-slate-700 dark:text-slate-300 truncate flex-1">{n.nombre}</p>
                      <span className="text-[10px] font-bold text-primary flex-shrink-0">
                        {n.valor != null ? fmtCLP(n.valor) : '—'}
                      </span>
                    </div>
                  ))}
                  {data360.negocios.length > 4 && (
                    <button onClick={goNegocios} className="text-[11px] text-primary font-bold hover:underline mt-1">
                      Ver {data360.negocios.length} negocios →
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

function InfoRow({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors">
      <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
        <span className="material-symbols-outlined text-lg">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter leading-none mb-1">{label}</p>
        {children}
      </div>
    </div>
  );
}
