import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getContactoById, getTimelineContacto, eliminarContacto, getWaCredentials,
  type Contacto, type ContactoTimeline,
} from '@/lib/db';
import { NuevoContactoModal } from '@/components/modals/NuevoContactoModal';
import { NuevaActividadModal } from '@/components/modals/NuevaActividadModal';
import { WaThread } from '@/components/WaThread';
import { AdjuntosPanel } from '@/components/AdjuntosPanel';

const typeIcon: Record<string, string> = { llamada: 'call', reunion: 'groups', email: 'mail', tarea: 'task_alt' };
const typeColor: Record<string, string> = { llamada: 'bg-blue-50 text-blue-600', reunion: 'bg-primary/10 text-primary', email: 'bg-orange-50 text-orange-600', tarea: 'bg-green-50 text-green-600' };
const statusColor: Record<string, string> = {
  'Prospecto': 'bg-blue-50 text-blue-700 border-blue-100',
  'Cliente Activo': 'bg-orange-50 text-orange-700 border-orange-100',
  'Inactivo': 'bg-slate-100 text-slate-600 border-slate-200',
};

type HistorialFilter = 'todo' | 'actividades' | 'negocios';
type Tab = 'historial' | 'resumen' | 'archivos' | 'correo' | 'whatsapp';

export default function ContactoDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [contacto, setContacto] = useState<Contacto | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState<ContactoTimeline>({ actividades: [], negocios: [] });
  const [tlLoading, setTlLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('historial');
  const [waActive, setWaActive] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [historialFilter, setHistorialFilter] = useState<HistorialFilter>('todo');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setTlLoading(true);
    getContactoById(id).then(c => {
      setContacto(c);
      setLoading(false);
      if (c) {
        const nombre = `${c.nombre}${c.apellido ? ' ' + c.apellido : ''}`;
        getTimelineContacto(nombre, id).then(tl => {
          setTimeline(tl);
          setTlLoading(false);
        });
      }
    });
    getWaCredentials().then(creds => setWaActive(!!creds));
  }, [id]);

  const handleDelete = async () => {
    if (!contacto) return;
    if (!window.confirm(`¿Eliminar "${contacto.nombre} ${contacto.apellido ?? ''}"?\nEsta acción no se puede deshacer.`)) return;
    const result = await eliminarContacto(contacto.id);
    if (result.ok) navigate('/contactos');
    else window.alert(result.error);
  };

  const reloadContacto = async () => {
    if (!id) return;
    const c = await getContactoById(id);
    setContacto(c);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin size-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!contacto) {
    return (
      <div className="text-center py-20">
        <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 block mb-2">person_off</span>
        <p className="text-slate-400">Contacto no encontrado</p>
        <button onClick={() => navigate('/contactos')} className="mt-4 text-primary text-sm font-bold hover:underline">
          ← Volver a Contactos
        </button>
      </div>
    );
  }

  const nombre = `${contacto.nombre}${contacto.apellido ? ' ' + contacto.apellido : ''}`;
  const ini = ((contacto.nombre[0] ?? '') + (contacto.apellido?.[0] ?? '')).toUpperCase();
  const sc = statusColor[contacto.estado] ?? 'bg-slate-100 text-slate-600 border-slate-200';

  // Build merged + sorted timeline
  type TItem =
    | { kind: 'act'; id: string; tipo: string; titulo: string; fecha: string; completada: boolean; prioridad: string }
    | { kind: 'neg'; id: string; titulo: string; etapa: string; valor: number | null; fecha: string };

  const allItems: TItem[] = [
    ...timeline.actividades.map(a => ({
      kind: 'act' as const,
      id: a.id,
      tipo: a.tipo,
      titulo: a.titulo,
      fecha: a.fecha_hora ?? a.created_at,
      completada: a.completada,
      prioridad: a.prioridad,
    })),
    ...timeline.negocios.map(n => ({
      kind: 'neg' as const,
      id: n.id,
      titulo: n.nombre,
      etapa: n.etapa,
      valor: n.valor,
      fecha: n.created_at,
    })),
  ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  const filteredItems = allItems.filter(item => {
    if (historialFilter === 'actividades') return item.kind === 'act';
    if (historialFilter === 'negocios') return item.kind === 'neg';
    return true;
  });

  const pendientes = timeline.actividades.filter(a => !a.completada).length;
  const completadas = timeline.actividades.filter(a => a.completada).length;
  const negociosActivos = timeline.negocios.filter(n => !['Cerrado Ganado', 'Cerrado Perdido'].includes(n.etapa)).length;
  const valorTotal = timeline.negocios.reduce((s, n) => s + (n.valor ?? 0), 0);
  const proximaActividad = timeline.actividades
    .filter(a => !a.completada && a.fecha_hora && new Date(a.fecha_hora) >= new Date())
    .sort((a, b) => new Date(a.fecha_hora!).getTime() - new Date(b.fecha_hora!).getTime())[0];

  const tabDefs: { key: Tab; icon: string; label: string }[] = [
    { key: 'historial', icon: 'history', label: 'Historial' },
    { key: 'resumen', icon: 'dashboard', label: 'Resumen' },
    { key: 'archivos', icon: 'attach_file', label: 'Archivos' },
    { key: 'correo', icon: 'mail', label: 'Correo' },
    ...(waActive ? [{ key: 'whatsapp' as Tab, icon: 'chat', label: 'WhatsApp' }] : []),
  ];

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-xs">
        <button onClick={() => navigate('/contactos')} className="flex items-center gap-1 font-bold text-slate-400 hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Contactos
        </button>
        <span className="text-slate-300 dark:text-slate-600">/</span>
        <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[200px]">{nombre}</span>
      </div>

      <div className="grid grid-cols-[20rem_1fr] gap-6 items-start">
        {/* ── Left panel ── */}
        <div className="space-y-4 sticky top-6">
          {/* Contact card */}
          <div className="bg-white dark:bg-[#1e1a2e] rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm p-6">
            <div className="flex justify-between items-start mb-5">
              <div className="size-20 rounded-2xl bg-primary/10 flex items-center justify-center shadow-md">
                <span className="text-2xl font-black text-primary">{ini}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditOpen(true)} className="size-8 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-400 hover:text-primary transition-colors" title="Editar">
                  <span className="material-symbols-outlined text-lg">edit</span>
                </button>
                <button onClick={handleDelete} className="size-8 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-400 hover:text-red-500 transition-colors" title="Eliminar">
                  <span className="material-symbols-outlined text-lg">delete</span>
                </button>
              </div>
            </div>
            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 mb-1">{nombre}</h1>
            {contacto.cargo && <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{contacto.cargo}</p>}
            <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${sc} mb-5`}>
              {contacto.estado}
            </span>

            <div className="space-y-1">
              {contacto.email && (
                <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-lg">mail</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight leading-none mb-0.5">Email</p>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{contacto.email}</p>
                  </div>
                </div>
              )}
              {contacto.telefono && (
                <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-lg">call</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight leading-none mb-0.5">Teléfono</p>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{contacto.telefono}</p>
                  </div>
                </div>
              )}
              {contacto.empresa_nombre && (
                <button onClick={() => navigate('/empresas')} className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-primary/5 transition-colors text-left">
                  <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-lg">business</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight leading-none mb-0.5">Empresa</p>
                    <p className="text-xs font-medium text-primary truncate">{contacto.empresa_nombre}</p>
                  </div>
                  <span className="material-symbols-outlined text-sm text-slate-300">arrow_forward</span>
                </button>
              )}
              {contacto.rut && (
                <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-lg">badge</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight leading-none mb-0.5">RUT</p>
                    <p className="text-xs font-mono text-slate-700 dark:text-slate-300">{contacto.rut}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setAgendaOpen(true)}
                className="flex-1 py-2.5 bg-primary text-white text-xs font-bold rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:-translate-y-0.5 transition-all"
              >
                <span className="material-symbols-outlined text-sm">calendar_today</span>
                Agendar
              </button>
              {contacto.empresa_nombre && (
                <button
                  onClick={() => navigate(`/negocios?empresa=${encodeURIComponent(contacto.empresa_nombre!)}`)}
                  className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">account_tree</span>
                  Negocios
                </button>
              )}
            </div>
          </div>

          {/* Quick stats */}
          <div className="bg-white dark:bg-[#1e1a2e] rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm p-4">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Resumen de actividad</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-center">
                <p className="text-xl font-black text-slate-900 dark:text-slate-100">{timeline.actividades.length}</p>
                <p className="text-[10px] text-slate-400 font-medium">Actividades</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-center">
                <p className="text-xl font-black text-orange-600">{pendientes}</p>
                <p className="text-[10px] text-slate-400 font-medium">Pendientes</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-center">
                <p className="text-xl font-black text-primary">{negociosActivos}</p>
                <p className="text-[10px] text-slate-400 font-medium">Negocios</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-center">
                <p className="text-xl font-black text-green-600">{completadas}</p>
                <p className="text-[10px] text-slate-400 font-medium">Completadas</p>
              </div>
            </div>
            {valorTotal > 0 && (
              <div className="mt-2 bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-center">
                <p className="text-sm font-black text-green-700 dark:text-green-400">
                  CLP ${valorTotal.toLocaleString('es-CL')}
                </p>
                <p className="text-[10px] text-green-600 dark:text-green-500 font-medium">Valor total en negocios</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="space-y-4">
          {/* Tab bar */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl gap-1 overflow-hidden">
            {tabDefs.map(({ key, icon, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 min-w-0 flex items-center justify-center gap-1 py-2 px-1 rounded-lg text-[11px] font-bold transition-all overflow-hidden ${
                  tab === key
                    ? 'bg-white dark:bg-[#1e1a2e] shadow-sm text-slate-900 dark:text-slate-100'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                <span className="material-symbols-outlined text-[15px] flex-shrink-0">{icon}</span>
                <span className="truncate font-sans">{label}</span>
              </button>
            ))}
          </div>

          {/* ── Historial tab ── */}
          {tab === 'historial' && (
            <div className="bg-white dark:bg-[#1e1a2e] rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700/50">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Historial completo</p>
                  {!tlLoading && <p className="text-[11px] text-slate-400">{allItems.length} registros</p>}
                </div>
                <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  {([['todo', 'Todo'], ['actividades', 'Actividades'], ['negocios', 'Negocios']] as const).map(([val, lbl]) => (
                    <button
                      key={val}
                      onClick={() => setHistorialFilter(val)}
                      className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                        historialFilter === val
                          ? 'bg-white dark:bg-[#252035] text-primary shadow-sm'
                          : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {tlLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="py-16 text-center">
                  <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600 block mb-2">history</span>
                  <p className="text-sm text-slate-400">Sin registros para este filtro</p>
                  <button onClick={() => setAgendaOpen(true)} className="mt-3 text-xs text-primary font-bold hover:underline">
                    + Agendar actividad
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-50 dark:divide-slate-700/30">
                  {filteredItems.map(item => {
                    const fecha = new Date(item.fecha);
                    const fechaStr = fecha.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
                    const horaStr = item.kind === 'act' && item.fecha.includes('T')
                      ? fecha.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
                      : null;

                    return (
                      <div key={item.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                        {item.kind === 'act' ? (
                          <div className={`size-10 rounded-xl flex items-center justify-center flex-shrink-0 ${typeColor[item.tipo] ?? 'bg-slate-100 text-slate-500'}`}>
                            <span className="material-symbols-outlined text-lg">{typeIcon[item.tipo] ?? 'task_alt'}</span>
                          </div>
                        ) : (
                          <div className="size-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-green-50 dark:bg-green-900/30 text-green-600">
                            <span className="material-symbols-outlined text-lg">handshake</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{item.titulo}</p>
                          <p className="text-[11px] text-slate-400">
                            {item.kind === 'act'
                              ? item.tipo.charAt(0).toUpperCase() + item.tipo.slice(1)
                              : `Negocio · ${item.etapa}`}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0 space-y-0.5">
                          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{fechaStr}</p>
                          {horaStr && <p className="text-[10px] text-slate-400">{horaStr}</p>}
                          {item.kind === 'act' && (
                            <span className={`block text-[10px] font-bold ${item.completada ? 'text-green-500' : 'text-orange-500'}`}>
                              {item.completada ? '✓ Completada' : 'Pendiente'}
                            </span>
                          )}
                          {item.kind === 'neg' && item.valor != null && (
                            <p className="text-[10px] font-bold text-green-600">
                              CLP ${item.valor.toLocaleString('es-CL')}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Resumen tab ── */}
          {tab === 'resumen' && (
            <div className="space-y-4">
              {proximaActividad && (
                <div className="bg-primary/5 dark:bg-primary/10 border border-primary/10 rounded-2xl p-5">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-3">Próxima actividad</p>
                  <div className="flex items-center gap-3">
                    <div className={`size-10 rounded-xl flex items-center justify-center flex-shrink-0 ${typeColor[proximaActividad.tipo] ?? 'bg-slate-100 text-slate-500'}`}>
                      <span className="material-symbols-outlined text-lg">{typeIcon[proximaActividad.tipo] ?? 'task_alt'}</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{proximaActividad.titulo}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(proximaActividad.fecha_hora!).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {timeline.negocios.length > 0 && (
                <div className="bg-white dark:bg-[#1e1a2e] rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm p-5">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Negocios asociados</p>
                  <div className="space-y-2">
                    {timeline.negocios.map(n => (
                      <div key={n.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                        <div className="size-9 rounded-lg bg-green-50 dark:bg-green-900/30 text-green-600 flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-base">handshake</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{n.nombre}</p>
                          <p className="text-[10px] text-slate-400">{n.etapa}</p>
                        </div>
                        {n.valor != null && (
                          <p className="text-xs font-black text-green-600 flex-shrink-0">
                            CLP ${n.valor.toLocaleString('es-CL')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white dark:bg-[#1e1a2e] rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Actividades recientes</p>
                  <button onClick={() => setTab('historial')} className="text-[10px] text-primary font-bold hover:underline">
                    Ver todo →
                  </button>
                </div>
                {tlLoading ? (
                  <div className="space-y-2">
                    {[1, 2].map(i => <div key={i} className="h-9 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />)}
                  </div>
                ) : timeline.actividades.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-xs text-slate-400 mb-2">Sin actividades registradas</p>
                    <button onClick={() => setAgendaOpen(true)} className="text-xs text-primary font-bold hover:underline">+ Agendar</button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {timeline.actividades.slice(0, 5).map(a => (
                      <div key={a.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <div className={`size-8 rounded-lg flex items-center justify-center flex-shrink-0 ${typeColor[a.tipo] ?? 'bg-slate-100 text-slate-500'}`}>
                          <span className="material-symbols-outlined text-sm">{typeIcon[a.tipo] ?? 'task_alt'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{a.titulo}</p>
                          <p className="text-[10px] text-slate-400">
                            {a.fecha_hora ? new Date(a.fecha_hora).toLocaleDateString('es-CL') : '—'}
                          </p>
                        </div>
                        {a.completada && (
                          <span className="material-symbols-outlined text-sm text-green-500 flex-shrink-0">check_circle</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Archivos tab ── */}
          {tab === 'archivos' && (
            <div className="bg-white dark:bg-[#1e1a2e] rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm p-5">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-xs">attach_file</span>
                Archivos adjuntos
              </p>
              <AdjuntosPanel entidadTipo="contacto" entidadId={contacto.id} />
            </div>
          )}

          {/* ── Correo tab ── */}
          {tab === 'correo' && (
            <div className="bg-white dark:bg-[#1e1a2e] rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm p-10 text-center">
              <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl text-primary">mail</span>
              </div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
                Correos con {contacto.email ? contacto.email : 'este contacto'}
              </p>
              <p className="text-xs text-slate-400 mb-6 max-w-xs mx-auto">
                Conecta tu cuenta de Google para ver los correos intercambiados con este contacto directamente aquí.
              </p>
              <button
                onClick={() => navigate('/configuracion')}
                className="px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-xl shadow-md shadow-primary/20 hover:opacity-90 transition-all"
              >
                Conectar Google en Configuración
              </button>
            </div>
          )}

          {/* ── WhatsApp tab ── */}
          {tab === 'whatsapp' && waActive && (
            <div className="bg-white dark:bg-[#1e1a2e] rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm p-4">
              <WaThread contacto={contacto} />
            </div>
          )}
        </div>
      </div>

      <NuevoContactoModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        contacto={contacto}
        onSuccess={async () => {
          await reloadContacto();
          setEditOpen(false);
        }}
      />
      <NuevaActividadModal
        open={agendaOpen}
        onClose={() => setAgendaOpen(false)}
        relacionadoDefault={nombre}
        contactoId={contacto.id}
        empresaId={contacto.empresa_id ?? undefined}
      />
    </div>
  );
}
