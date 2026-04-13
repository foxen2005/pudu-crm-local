import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getEmpresas, getContactos, getNegocios, getActividades, type Actividad } from '@/lib/db';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

function formatCLP(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString('es-CL')}`;
}

const typeIcon: Record<string, string> = { llamada: 'call', reunion: 'groups', email: 'mail', tarea: 'task_alt' };
const typeColor: Record<string, string> = { llamada: 'bg-blue-50 text-blue-600', reunion: 'bg-primary/10 text-primary', email: 'bg-orange-50 text-orange-600', tarea: 'bg-green-50 text-green-600' };
const priorityBorder: Record<string, string> = { Alta: 'border-l-red-500', Media: 'border-l-orange-400', Baja: 'border-l-blue-400' };

const STAGES = ['Prospección', 'Calificación', 'Propuesta', 'Negociación', 'Cierre'];
const PIPELINE_STAGES = new Set(STAGES);
const STAGE_SHORT: Record<string, string> = { Prospección: 'PROSP.', Calificación: 'CALIF.', Propuesta: 'PROP.', Negociación: 'NEGOC.', Cierre: 'GANADO' };

export default function Dashboard() {
  const { member } = useAuth();
  const [stats, setStats] = useState({ empresas: 0, contactos: 0, pipeline: 0, negocios: 0, riesgo: 0 });
  const [todayActs, setTodayActs] = useState<{ id: string; tipo: string; titulo: string; prioridad: string; completada: boolean; time: string }[]>([]);
  const [pipelineByStage, setPipelineByStage] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [e, c, n, a] = await Promise.all([
        getEmpresas(), getContactos(), getNegocios(), getActividades()
      ]);
      const today = new Date();
      const todayStr = today.toDateString();

      if (n.ok) {
        const total = n.data.reduce((s, x) => s + (x.valor ?? 0), 0);
        const riesgo = n.data.filter(x => x.riesgo).length;
        setStats({
          empresas: e.ok ? e.data.length : 0,
          contactos: c.ok ? c.data.length : 0,
          pipeline: total,
          negocios: n.data.length,
          riesgo,
        });
        const byStage: Record<string, number> = {};
        STAGES.forEach(s => { byStage[s] = 0; });
        n.data.forEach(x => { byStage[x.etapa] = (byStage[x.etapa] ?? 0) + (x.valor ?? 0); });
        setPipelineByStage(byStage);
      } else {
        setStats(prev => ({ ...prev, empresas: e.ok ? e.data.length : 0, contactos: c.ok ? c.data.length : 0 }));
      }

      if (a.ok) {
        const acts = a.data
          .filter(x => x.fecha_hora && new Date(x.fecha_hora).toDateString() === todayStr)
          .map(x => ({
            id: x.id,
            tipo: x.tipo,
            titulo: x.titulo,
            prioridad: x.prioridad,
            completada: x.completada,
            time: x.fecha_hora ? new Date(x.fecha_hora).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '',
          }));
        setTodayActs(acts);
      }

      setLoading(false);
    }
    load();

    // Realtime: refrescar actividades de hoy al instante
    const channel = supabase
      .channel(`dashboard-acts-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'actividades' }, () => {
        getActividades().then(a => {
          if (!a.ok) return;
          const todayStr = new Date().toDateString();
          setTodayActs(a.data
            .filter(x => x.fecha_hora && new Date(x.fecha_hora).toDateString() === todayStr)
            .map(x => ({
              id: x.id, tipo: x.tipo, titulo: x.titulo,
              prioridad: x.prioridad, completada: x.completada,
              time: x.fecha_hora ? new Date(x.fecha_hora).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '',
            }))
          );
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const totalPipelineFormatted = formatCLP(stats.pipeline);
  const completedToday = todayActs.filter(a => a.completada).length;
  const pct = todayActs.length > 0 ? Math.round((completedToday / todayActs.length) * 100) : 0;
  const pendingRiesgo = stats.riesgo;

  const hora = new Date().getHours();
  const greeting = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
  const nombre = member?.nombre?.split(' ')[0] ?? 'Usuario';

  return (
    <div className="grid grid-cols-12 gap-8">

      {/* ── Left 8 cols ── */}
      <div className="col-span-8 space-y-10">

        {/* Greeting + KPIs */}
        <section>
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="text-[10px] font-black text-primary tracking-[0.2em] uppercase mb-1">Enfoque Diario</h2>
              <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100">{greeting}, {nombre}</h3>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 mb-2 text-sm font-bold text-slate-500 dark:text-slate-400">
                <span>Actividades hoy</span>
                <span className="text-primary">{pct}%</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-slate-400">
                <div className="flex gap-0.5">
                  {Array.from({ length: Math.max(todayActs.length, 1) }).map((_, i) => (
                    <div key={i} className={`w-3 h-4 rounded-sm ${i < completedToday ? 'bg-primary' : 'bg-slate-200'}`} />
                  ))}
                </div>
                <span className="ml-2 uppercase">{completedToday} de {todayActs.length} completadas</span>
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Empresas', value: loading ? '...' : String(stats.empresas), icon: 'domain', color: 'text-slate-700', to: '/empresas' },
              { label: 'Contactos', value: loading ? '...' : String(stats.contactos), icon: 'contacts', color: 'text-blue-600', to: '/contactos' },
              { label: 'Negocios', value: loading ? '...' : String(stats.negocios), icon: 'handshake', color: 'text-primary', to: '/negocios' },
              { label: 'En Riesgo', value: loading ? '...' : String(pendingRiesgo), icon: 'warning', color: pendingRiesgo > 0 ? 'text-orange-500' : 'text-slate-400', to: '/negocios' },
            ].map((k) => (
              <Link key={k.label} to={k.to} className="bg-white dark:bg-[#1e1a2e] rounded-xl p-4 border border-slate-100 dark:border-slate-700/50 shadow-sm hover:border-primary/30 hover:-translate-y-0.5 transition-all block">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{k.label}</p>
                  <span className={`material-symbols-outlined text-base ${k.color}`}>{k.icon}</span>
                </div>
                <p className={`text-2xl font-black ${k.color}`}>{k.value}</p>
              </Link>
            ))}
          </div>

          {/* Today's activities */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}
            </div>
          ) : todayActs.length === 0 ? (
            <div className="bg-white dark:bg-[#1e1a2e] rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm p-6 text-center">
              <span className="material-symbols-outlined text-3xl text-slate-200 block mb-2">event_available</span>
              <p className="text-sm text-slate-400 dark:text-slate-500">No tienes actividades programadas para hoy</p>
              <Link to="/actividades" className="mt-2 text-xs text-primary font-bold hover:underline inline-block">
                Ir a Actividades
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {todayActs.slice(0, 4).map((act) => (
                <div
                  key={act.id}
                  className={`border-l-4 ${priorityBorder[act.prioridad] ?? 'border-l-slate-300'} bg-white dark:bg-[#1e1a2e] p-4 rounded-r-xl shadow-sm flex items-center justify-between ${act.completada ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`size-9 rounded-lg flex items-center justify-center ${typeColor[act.tipo] ?? 'bg-slate-100 text-slate-500'}`}>
                      <span className="material-symbols-outlined text-base">{typeIcon[act.tipo] ?? 'task_alt'}</span>
                    </div>
                    <div>
                      <p className={`text-sm font-bold ${act.completada ? 'line-through text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}>{act.titulo}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{act.time} · {act.prioridad}</p>
                    </div>
                  </div>
                  {act.completada && <span className="material-symbols-outlined text-green-500">check_circle</span>}
                </div>
              ))}
              {todayActs.length > 4 && (
                <Link to="/actividades" className="block text-center text-xs text-primary font-bold hover:underline py-2">
                  Ver {todayActs.length - 4} más →
                </Link>
              )}
            </div>
          )}
        </section>

        {/* Pipeline snapshot */}
        <section className="opacity-80 hover:opacity-100 transition-opacity">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Embudo de Ventas (CLP)</h3>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total: {totalPipelineFormatted}</p>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {STAGES.map((stage) => {
              const val = pipelineByStage[stage] ?? 0;
              const isGanado = stage === 'Cierre';
              return (
                <Link
                  key={stage}
                  to="/negocios"
                  className={`p-3 rounded-xl border block hover:-translate-y-0.5 transition-all ${isGanado ? 'bg-primary/5 border-primary/20' : 'bg-white dark:bg-[#1e1a2e] border-slate-100 dark:border-slate-700/50 hover:border-primary/20'}`}
                >
                  <p className={`text-[10px] font-bold mb-1 uppercase ${isGanado ? 'text-primary' : 'text-slate-400'}`}>
                    {STAGE_SHORT[stage]}
                  </p>
                  <p className={`text-xs font-black ${isGanado ? 'text-primary' : ''}`}>
                    {loading ? '...' : formatCLP(val)}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      {/* ── Right 4 cols ── */}
      <div className="col-span-4 space-y-8">
        {/* Org info card */}
        <section className="bg-white dark:bg-[#1e1a2e] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="p-6 pb-0 flex flex-col items-center">
            <div className="size-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 border-4 border-slate-50 dark:border-slate-700 shadow-sm">
              <span className="material-symbols-outlined text-3xl text-primary">storefront</span>
            </div>
            <h3 className="text-lg font-bold dark:text-slate-100">{member?.orgNombre ?? 'Mi Organización'}</h3>
            <p className="text-xs font-bold text-primary mb-4">{member?.nombre}</p>
          </div>
          <div className="px-6 py-4 bg-slate-50 dark:bg-[#13111a] flex justify-between items-center border-y border-slate-100 dark:border-slate-700/50">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pipeline</p>
              <p className="text-sm font-black dark:text-slate-100">
                {loading ? '...' : totalPipelineFormatted} <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">CLP</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rol</p>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 capitalize">{member?.rol ?? '—'}</p>
            </div>
          </div>
          <div className="p-6">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">Accesos rápidos</p>
            <div className="space-y-2">
              <Link to="/empresas" className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
                <span className="material-symbols-outlined text-sm text-primary">domain</span>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Empresas ({stats.empresas})</span>
              </Link>
              <Link to="/contactos" className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
                <span className="material-symbols-outlined text-sm text-primary">contacts</span>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Contactos ({stats.contactos})</span>
              </Link>
              <Link to="/negocios" className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
                <span className="material-symbols-outlined text-sm text-primary">handshake</span>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Negocios ({stats.negocios})</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Performance card */}
        <section className="bg-primary text-white p-6 rounded-2xl shadow-xl shadow-primary/20 overflow-hidden relative">
          <div className="absolute -right-4 -bottom-4 size-32 bg-white/10 rounded-full blur-3xl" />
          <div className="flex items-center justify-between mb-8 relative z-10">
            <h3 className="text-xs font-black tracking-widest uppercase opacity-80">Progreso Hoy</h3>
            <span className="text-[10px] bg-white/20 px-2 py-1 rounded-full font-bold">{pct}%</span>
          </div>
          <div className="mb-2 relative z-10">
            <span className="text-5xl font-black">{completedToday}</span>
            <span className="text-xl opacity-60 font-bold">/{todayActs.length}</span>
          </div>
          <p className="text-xs font-medium opacity-80 mb-6 relative z-10">
            {todayActs.length === 0 ? 'Sin actividades hoy' :
             pct >= 80 ? 'Excelente ritmo de cierre' :
             pct >= 50 ? 'Buen avance, sigue así' :
             'Actividades pendientes por completar'}
          </p>
          <div className="relative z-10">
            <div className="h-2 bg-white/20 rounded-full">
              <div className="h-2 bg-white rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
