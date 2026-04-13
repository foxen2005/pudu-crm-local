import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { NuevoContactoModal } from '@/components/modals/NuevoContactoModal';
import { NuevaActividadModal } from '@/components/modals/NuevaActividadModal';
import { ImportarCSVModal } from '@/components/modals/ImportarCSVModal';
import { WaThread } from '@/components/WaThread';
import { getContactos, eliminarContacto, getTimelineContacto, getWaCredentials, type Contacto, type ContactoTimeline } from '@/lib/db';

function initials(nombre: string, apellido: string | null) {
  return ((nombre[0] ?? '') + (apellido?.[0] ?? '')).toUpperCase();
}

const statusColor: Record<string, string> = {
  'Prospecto': 'bg-blue-50 text-blue-700 border-blue-100',
  'Cliente Activo': 'bg-orange-50 text-orange-700 border-orange-100',
  'Inactivo': 'bg-slate-100 text-slate-600 border-slate-200',
};

const typeIcon: Record<string, string> = { llamada: 'call', reunion: 'groups', email: 'mail', tarea: 'task_alt' };
const typeColor: Record<string, string> = { llamada: 'bg-blue-50 text-blue-600', reunion: 'bg-primary/10 text-primary', email: 'bg-orange-50 text-orange-600', tarea: 'bg-green-50 text-green-600' };

const filterTabs = ['Todos', 'Prospectos', 'Clientes', 'Inactivos'] as const;
type FilterTab = (typeof filterTabs)[number];

export default function Contacts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const empresaFilter = searchParams.get('empresa') ?? '';

  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('Todos');
  const [selected, setSelected] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editContacto, setEditContacto] = useState<Contacto | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getContactos();
    if (result.ok) setContactos(result.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = contactos.filter((c) => {
    if (empresaFilter && c.empresa_nombre?.toLowerCase() !== empresaFilter.toLowerCase()) return false;
    if (activeTab === 'Prospectos') return c.estado === 'Prospecto';
    if (activeTab === 'Clientes') return c.estado === 'Cliente Activo';
    if (activeTab === 'Inactivos') return c.estado === 'Inactivo';
    return true;
  });

  const activeContact = contactos.find((c) => c.id === selected) ?? null;

  const handleDelete = async (contacto: Contacto) => {
    if (!window.confirm(`¿Eliminar a "${contacto.nombre} ${contacto.apellido ?? ''}"?\nEsta acción no se puede deshacer.`)) return;
    const result = await eliminarContacto(contacto.id);
    if (result.ok) { setSelected(''); load(); }
    else window.alert(result.error);
  };

  return (
    <div>
      <div className="flex flex-col mb-8">
        <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-2">Directorio de Contactos</span>
        <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Contactos</h2>
      </div>

      {empresaFilter && (
        <div className="flex items-center gap-3 mb-5 px-4 py-2.5 bg-primary/5 border border-primary/10 rounded-xl">
          <span className="material-symbols-outlined text-sm text-primary">filter_alt</span>
          <p className="text-xs font-bold text-primary flex-1">Empresa: {empresaFilter}</p>
          <button onClick={() => setSearchParams({})} className="size-6 flex items-center justify-center rounded hover:bg-primary/10 text-primary transition-colors">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard icon="contacts" label="Total Contactos" value={loading ? '...' : String(contactos.length)} />
        <StatCard icon="person_check" label="Clientes Activos" value={loading ? '...' : String(contactos.filter(c => c.estado === 'Cliente Activo').length)} color="text-orange-600" />
        <StatCard icon="person_search" label="Prospectos" value={loading ? '...' : String(contactos.filter(c => c.estado === 'Prospecto').length)} color="text-primary" />
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
              <span className="material-symbols-outlined text-sm">person_add</span>
              Nuevo Contacto
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1e1a2e] rounded-xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-700/50">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-[#13111a] border-b border-slate-100 dark:border-slate-700/50">
                <th className="py-4 px-6 w-12"><input type="checkbox" className="rounded text-primary focus:ring-primary/30 border-slate-300" /></th>
                <th className="py-4 px-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Contacto</th>
                <th className="py-4 px-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Estado</th>
                <th className="py-4 px-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Empresa</th>
                <th className="py-4 px-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Cargo</th>
                <th className="py-4 px-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Teléfono</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="py-4 px-6"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <span className="material-symbols-outlined text-3xl text-slate-300 block mb-2">contacts</span>
                    <p className="text-sm text-slate-400">No hay contactos registrados</p>
                    <button onClick={() => setModalOpen(true)} className="mt-3 text-xs text-primary font-bold hover:underline">
                      Crear el primer contacto
                    </button>
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <ContactRow key={c.id} contacto={c} isSelected={c.id === selected}
                    onSelect={() => setSelected(c.id === selected ? '' : c.id)}
                    onEdit={() => setEditContacto(c)} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ContactDetail
        contacto={activeContact}
        onClose={() => setSelected('')}
        onEdit={() => activeContact && setEditContacto(activeContact)}
        onDelete={() => activeContact && handleDelete(activeContact)}
        typeIcon={typeIcon}
        typeColor={typeColor}
        onSelectClose={() => setSelected('')}
      />

      <NuevoContactoModal open={modalOpen} onClose={() => setModalOpen(false)} onSuccess={load} />
      <NuevoContactoModal open={!!editContacto} onClose={() => setEditContacto(null)} contacto={editContacto ?? undefined} onSuccess={load} />
      <ImportarCSVModal open={importOpen} onClose={() => setImportOpen(false)} tipo="contacto" onSuccess={load} />
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

function ContactRow({ contacto, isSelected, onSelect, onEdit }: {
  contacto: Contacto; isSelected: boolean; onSelect: () => void; onEdit: () => void;
}) {
  const ini = initials(contacto.nombre, contacto.apellido);
  const sc = statusColor[contacto.estado] ?? 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <tr onClick={onSelect} className={`transition-colors cursor-pointer group ${isSelected ? 'bg-primary/5 border-l-4 border-l-primary' : 'hover:bg-primary/[0.02]'}`}>
      <td className="py-4 px-6"><input type="checkbox" checked={isSelected} readOnly className="rounded text-primary focus:ring-primary/30 border-slate-300" /></td>
      <td className="py-4 px-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">{ini}</div>
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{contacto.nombre} {contacto.apellido ?? ''}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{contacto.email ?? '—'}</p>
          </div>
        </div>
      </td>
      <td className="py-4 px-4"><span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${sc}`}>{contacto.estado}</span></td>
      <td className="py-4 px-4"><p className="text-xs font-medium text-slate-600 dark:text-slate-300">{contacto.empresa_nombre ?? '—'}</p></td>
      <td className="py-4 px-4"><p className="text-xs text-slate-500 dark:text-slate-400">{contacto.cargo ?? '—'}</p></td>
      <td className="py-4 px-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400">{contacto.telefono ?? '—'}</p>
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="size-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-400 hover:text-primary transition-colors opacity-0 group-hover:opacity-100">
            <span className="material-symbols-outlined text-base">edit</span>
          </button>
        </div>
      </td>
    </tr>
  );
}

function ContactDetail({ contacto, onClose, onEdit, onDelete, typeIcon, typeColor, onSelectClose }: {
  contacto: Contacto | null; onClose: () => void; onEdit: () => void; onDelete: () => void;
  typeIcon: Record<string, string>; typeColor: Record<string, string>; onSelectClose: () => void;
}) {
  const open = !!contacto;
  const navigate = useNavigate();

  const goEmpresa = () => {
    if (!contacto?.empresa_nombre) return;
    navigate(`/empresas`);
    onSelectClose();
  };
  const goNegocios = () => {
    if (!contacto?.empresa_nombre) return;
    navigate(`/negocios?empresa=${encodeURIComponent(contacto.empresa_nombre)}`);
    onSelectClose();
  };
  const [detailTab, setDetailTab] = useState<'historial' | 'whatsapp'>('historial');
  const [waActive, setWaActive] = useState(false);
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [timeline, setTimeline] = useState<ContactoTimeline>({ actividades: [], negocios: [] });
  const [timelineLoading, setTimelineLoading] = useState(false);

  useEffect(() => {
    getWaCredentials().then(creds => setWaActive(!!creds));
  }, []);

  useEffect(() => {
    if (!contacto) return;
    const nombre = `${contacto.nombre}${contacto.apellido ? ' ' + contacto.apellido : ''}`;
    setTimelineLoading(true);
    getTimelineContacto(nombre).then(data => {
      setTimeline(data);
      setTimelineLoading(false);
    });
  }, [contacto?.id]);

  // Merge timeline into chronological list
  type TItem = { kind: 'act'; id: string; icon: string; color: string; title: string; sub: string; done?: boolean }
             | { kind: 'neg'; id: string; title: string; sub: string };

  const items: TItem[] = [
    ...timeline.actividades.map(a => ({
      kind: 'act' as const,
      id: a.id,
      icon: typeIcon[a.tipo] ?? 'task_alt',
      color: typeColor[a.tipo] ?? 'bg-slate-100 text-slate-500',
      title: a.titulo,
      sub: a.fecha_hora ? new Date(a.fecha_hora).toLocaleDateString('es-CL') : '—',
      done: a.completada,
    })),
    ...timeline.negocios.map(n => ({
      kind: 'neg' as const,
      id: n.id,
      title: n.nombre,
      sub: `${n.etapa}${n.valor != null ? ' · CLP $' + n.valor.toLocaleString('es-CL') : ''}`,
    })),
  ];

  const agendaRelacionado = contacto ? `${contacto.nombre}${contacto.apellido ? ' ' + contacto.apellido : ''}` : '';

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/10 z-40 backdrop-blur-[1px]" onClick={onClose} />}
      <aside className={`fixed top-4 right-4 bottom-20 w-[22rem] bg-white dark:bg-[#1e1a2e] rounded-2xl shadow-2xl shadow-black/15 z-50 flex flex-col overflow-y-auto transition-all duration-300 ease-out border border-slate-100/80 dark:border-slate-700/50 ${open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        <div className="flex justify-end px-4 pt-4 flex-shrink-0">
          <button onClick={onClose} className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {contacto && (
          <div className="px-6 pb-6 space-y-4">
            {/* Info card */}
            <div className="bg-white dark:bg-[#252035] rounded-xl shadow-lg border border-slate-100 dark:border-slate-700/50 p-6">
              <div className="flex justify-between items-start mb-6">
                <div className="size-20 rounded-xl bg-primary/10 flex items-center justify-center shadow-md">
                  <span className="text-2xl font-black text-primary">{initials(contacto.nombre, contacto.apellido)}</span>
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

              <div className="mb-6">
                <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">{contacto.nombre} {contacto.apellido ?? ''}</h3>
                {contacto.cargo && <p className="text-xs font-medium text-slate-500">{contacto.cargo}</p>}
                <div className="mt-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColor[contacto.estado] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {contacto.estado}
                  </span>
                </div>
              </div>

              <div className="space-y-2 mb-6">
                {contacto.email && (
                  <div className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors">
                    <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><span className="material-symbols-outlined text-lg">mail</span></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter leading-none mb-1">Email</p>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{contacto.email}</p>
                    </div>
                  </div>
                )}
                {contacto.telefono && (
                  <div className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors">
                    <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><span className="material-symbols-outlined text-lg">call</span></div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter leading-none mb-1">Teléfono</p>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{contacto.telefono}</p>
                    </div>
                  </div>
                )}
                {contacto.empresa_nombre && (
                  <button onClick={goEmpresa} className="w-full flex items-center gap-3 p-2 hover:bg-primary/5 rounded-lg transition-colors text-left">
                    <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><span className="material-symbols-outlined text-lg">business</span></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter leading-none mb-1">Empresa</p>
                      <p className="text-xs font-medium text-primary truncate">{contacto.empresa_nombre}</p>
                    </div>
                    <span className="material-symbols-outlined text-sm text-slate-300">arrow_forward</span>
                  </button>
                )}
                {contacto.rut && (
                  <div className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors">
                    <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><span className="material-symbols-outlined text-lg">badge</span></div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter leading-none mb-1">RUT</p>
                      <p className="text-xs font-mono text-slate-700 dark:text-slate-300">{contacto.rut}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setAgendaOpen(true)}
                  className="flex-1 py-3 bg-primary text-white text-xs font-bold rounded-lg shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:-translate-y-0.5 transition-all"
                >
                  Agendar
                  <span className="material-symbols-outlined text-sm">calendar_today</span>
                </button>
                {contacto.empresa_nombre && (
                  <button
                    onClick={goNegocios}
                    className="flex-1 py-3 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Negocios
                    <span className="material-symbols-outlined text-sm">account_tree</span>
                  </button>
                )}
              </div>
            </div>

            {/* Tab switcher — solo si WhatsApp está configurado */}
            {waActive && (
              <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
                {(['historial', 'whatsapp'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setDetailTab(tab)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-all ${
                      detailTab === tab ? 'bg-white dark:bg-[#252035] text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">
                      {tab === 'historial' ? 'history' : 'chat'}
                    </span>
                    <span className="font-sans">{tab === 'historial' ? 'Historial' : 'WhatsApp'}</span>
                  </button>
                ))}
              </div>
            )}

            {/* WhatsApp tab */}
            {waActive && detailTab === 'whatsapp' && (
              <div className="bg-white dark:bg-[#252035] rounded-xl border border-slate-100 dark:border-slate-700/50 p-4">
                <WaThread contacto={contacto} />
              </div>
            )}

            {/* Historial 360 */}
            {(!waActive || detailTab === 'historial') && (
            <div className="bg-white dark:bg-[#252035] rounded-xl border border-slate-100 dark:border-slate-700/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Historial</p>
                <button
                  onClick={() => { navigate(`/contactos/${contacto?.id}`); onSelectClose(); }}
                  className="text-[10px] text-primary font-bold hover:underline flex items-center gap-0.5"
                >
                  Ver completo
                  <span className="material-symbols-outlined text-xs">open_in_new</span>
                </button>
              </div>
              {timelineLoading ? (
                <div className="space-y-2">
                  {[1, 2].map(i => <div key={i} className="h-9 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />)}
                </div>
              ) : items.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-3">Sin registros asociados</p>
              ) : (
                <div className="space-y-1">
                  {items.slice(0, 6).map((item) => (
                    <div key={item.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      {item.kind === 'act' ? (
                        <div className={`size-7 rounded-lg flex items-center justify-center flex-shrink-0 ${item.color}`}>
                          <span className="material-symbols-outlined text-sm">{item.icon}</span>
                        </div>
                      ) : (
                        <div className="size-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-green-50 text-green-600">
                          <span className="material-symbols-outlined text-sm">handshake</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{item.title}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">{item.sub}</p>
                      </div>
                      {item.kind === 'act' && item.done && (
                        <span className="material-symbols-outlined text-xs text-green-500 flex-shrink-0">check_circle</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}
          </div>
        )}
      </aside>

      <NuevaActividadModal
        open={agendaOpen}
        onClose={() => setAgendaOpen(false)}
        relacionadoDefault={agendaRelacionado}
        contactoId={contacto?.id}
        empresaId={contacto?.empresa_id ?? undefined}
      />
    </>
  );
}
