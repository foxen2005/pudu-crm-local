import { useState, useEffect, useCallback } from 'react';
import { NuevaActividadModal } from '@/components/modals/NuevaActividadModal';
import { getActividades, toggleActividad, eliminarActividad, type Actividad } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { useCalendar, useTasks, isGoogleConnected, type CalendarEvent, type GoogleTask } from '@/lib/useGoogleData';

const DAYS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
const DAYS_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(d.getDate() + diff);
  m.setHours(0, 0, 0, 0);
  return m;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildCalendar(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

const typeIcon: Record<string, string> = { llamada: 'call', reunion: 'groups', email: 'mail', tarea: 'task_alt' };
const typeColor: Record<string, string> = { llamada: 'bg-blue-50 text-blue-600', reunion: 'bg-primary/10 text-primary', email: 'bg-orange-50 text-orange-600', tarea: 'bg-green-50 text-green-600' };
const typeColorActive: Record<string, string> = { llamada: 'bg-blue-500 text-white', reunion: 'bg-primary text-white', email: 'bg-orange-500 text-white', tarea: 'bg-green-500 text-white' };
const typeDot: Record<string, string> = { llamada: 'bg-blue-400', reunion: 'bg-primary', email: 'bg-orange-400', tarea: 'bg-green-500' };
const priorityBorder: Record<string, string> = { Alta: 'border-l-red-500', Media: 'border-l-orange-400', Baja: 'border-l-blue-400' };

function activityDate(act: Actividad): Date | null {
  if (!act.fecha_hora) return null;
  return new Date(act.fecha_hora);
}

function activityDay(act: Actividad, year: number, month: number): number | null {
  const d = activityDate(act);
  if (!d) return null;
  if (d.getFullYear() !== year || d.getMonth() !== month) return null;
  return d.getDate();
}

function activityTime(act: Actividad): string {
  if (!act.fecha_hora) return '';
  return new Date(act.fecha_hora).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

export default function Activities() {
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'HOY' | 'SEMANA' | 'MES' | 'TAREAS'>('HOY');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const [modalOpen, setModalOpen] = useState(false);
  const [editActividad, setEditActividad] = useState<Actividad | null>(null);
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(['llamada', 'reunion', 'email', 'tarea']));
  const [googleActive, setGoogleActive] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Google hooks — always called, handle no-token gracefully
  const { events: calEvents } = useCalendar(50);
  const { tasks, loading: tasksLoading, createTask, toggleTask, deleteTask } = useTasks(false);

  useEffect(() => { isGoogleConnected().then(setGoogleActive); }, []);

  const toggleType = (t: string) => setActiveTypes(prev => {
    const n = new Set(prev);
    n.has(t) ? n.delete(t) : n.add(t);
    return n;
  });

  const today = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const weeks = buildCalendar(year, month);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getActividades();
    if (result.ok) setActividades(result.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Realtime: actualiza la lista automáticamente ante cualquier cambio en actividades
  useEffect(() => {
    const channel = supabase
      .channel(`actividades-realtime-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'actividades' },
        (payload) => setActividades(prev => {
          if (prev.some(a => a.id === (payload.new as Actividad).id)) return prev;
          return [...prev, payload.new as Actividad];
        })
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'actividades' },
        (payload) => setActividades(prev =>
          prev.map(a => a.id === (payload.new as Actividad).id ? payload.new as Actividad : a)
        )
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'actividades' },
        (payload) => setActividades(prev => prev.filter(a => a.id !== (payload.old as Actividad).id))
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleToggle = async (act: Actividad) => {
    setActividades((prev) => prev.map((a) => a.id === act.id ? { ...a, completada: !a.completada } : a));
    await toggleActividad(act.id, !act.completada);
  };

  const handleDelete = async (act: Actividad) => {
    if (!window.confirm(`¿Eliminar "${act.titulo}"?`)) return;
    setActividades((prev) => prev.filter((a) => a.id !== act.id));
    await eliminarActividad(act.id);
  };

  const filteredActividades = actividades.filter(a => activeTypes.has(a.tipo));

  // Build event dots per day — solo del mes/año visible en el calendario
  const eventDays: Record<number, string[]> = {};
  filteredActividades.forEach((a) => {
    const d = activityDay(a, year, month);
    if (d == null) return;
    if (!eventDays[d]) eventDays[d] = [];
    eventDays[d].push(typeDot[a.tipo] ?? 'bg-slate-300');
  });

  // Actividades del día seleccionado (mismo mes y año del calendario)
  const todayActivities = filteredActividades.filter((a) => activityDay(a, year, month) === selectedDay);

  // Stats siempre referidos al día de hoy real
  const todayTotal = actividades.filter((a) => activityDay(a, today.getFullYear(), today.getMonth()) === today.getDate()).length;
  const completed = actividades.filter((a) => a.completada && activityDay(a, today.getFullYear(), today.getMonth()) === today.getDate()).length;
  const pct = todayTotal > 0 ? Math.round((completed / todayTotal) * 100) : 0;

  const prevMonth = () => {
    const d = new Date(year, month - 1, 1);
    setCurrentDate(d);
    setSelectedDay(d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() ? today.getDate() : 1);
  };
  const nextMonth = () => {
    const d = new Date(year, month + 1, 1);
    setCurrentDate(d);
    setSelectedDay(d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() ? today.getDate() : 1);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-2 block">Agenda de Actividades</span>
          <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Actividades</h2>
        </div>
        <div className="flex items-center gap-2">
          {(['HOY', 'SEMANA', 'MES'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                view === v ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white dark:bg-[#1e1a2e] border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-primary/30'
              }`}
            >
              {v}
            </button>
          ))}
          {googleActive && (
            <button
              onClick={() => setView('TAREAS')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 ${
                view === 'TAREAS' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white dark:bg-[#1e1a2e] border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-primary/30'
              }`}
            >
              <svg className="size-3" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="currentColor" opacity=".6"/></svg>
              Tareas
            </button>
          )}
          <button
            onClick={() => load()}
            className="size-8 flex items-center justify-center border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 transition-all ml-1"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all ml-1"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Nueva Actividad
          </button>
        </div>
      </div>

      {/* ── Vista SEMANA ── */}
      {view === 'SEMANA' && (() => {
        const monday = getMonday(currentDate);
        const weekDays = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(monday); d.setDate(monday.getDate() + i); return d;
        });
        const prevWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); };
        const nextWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); };
        const isCurrentWeek = sameDay(monday, getMonday(today));
        return (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button onClick={prevWeek} className="size-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 flex items-center justify-center text-slate-500 transition-colors">
                  <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>
                <button onClick={nextWeek} className="size-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 flex items-center justify-center text-slate-500 transition-colors">
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
                {!isCurrentWeek && (
                  <button onClick={() => setCurrentDate(new Date())} className="px-2.5 py-1 text-[10px] font-bold text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors">
                    Hoy
                  </button>
                )}
              </div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {weekDays[0].getDate()} {MONTHS[weekDays[0].getMonth()]} — {weekDays[6].getDate()} {MONTHS[weekDays[6].getMonth()]} {weekDays[6].getFullYear()}
              </p>
              {/* Type filter pills */}
              <div className="flex items-center gap-1">
                {(['llamada', 'reunion', 'email', 'tarea'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => toggleType(t)}
                    title={t === 'reunion' ? 'Reunión' : t.charAt(0).toUpperCase() + t.slice(1)}
                    className={`size-7 rounded-lg flex items-center justify-center transition-all ${activeTypes.has(t) ? typeColorActive[t] : 'bg-slate-100 dark:bg-slate-800 text-slate-400 opacity-40'}`}
                  >
                    <span className="material-symbols-outlined text-sm">{typeIcon[t]}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((wd, i) => {
                const isToday = sameDay(wd, today);
                const dayActs = filteredActividades.filter(a => { const d = activityDate(a); return d && sameDay(d, wd); });
                return (
                  <div key={i} className={`rounded-xl border ${isToday ? 'border-primary/30 bg-primary/5 dark:bg-primary/10' : 'border-slate-100 dark:border-slate-700/50 bg-white dark:bg-[#1e1a2e]'} p-2 min-h-[160px]`}>
                    <div className="text-center mb-2">
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">{DAYS_FULL[i].slice(0, 3)}</p>
                      <p className={`text-lg font-black ${isToday ? 'text-primary' : 'text-slate-800 dark:text-slate-200'}`}>{wd.getDate()}</p>
                    </div>
                    <div className="space-y-1">
                      {dayActs.length === 0
                        ? <p className="text-[10px] text-slate-300 dark:text-slate-600 text-center pt-2">—</p>
                        : dayActs.map(act => (
                          <div key={act.id} className={`group relative px-1.5 py-1 rounded-lg text-[10px] font-bold ${act.completada ? 'opacity-40 line-through' : ''} ${typeColor[act.tipo] ?? 'bg-slate-100 text-slate-500'}`}>
                            <div onClick={() => handleToggle(act)} className="cursor-pointer truncate pr-8">
                              {activityTime(act) && <span className="opacity-70 mr-1">{activityTime(act)}</span>}
                              {act.titulo}
                            </div>
                            <div className="absolute right-0.5 top-0.5 hidden group-hover:flex gap-0.5 bg-white/80 dark:bg-slate-900/80 rounded-md backdrop-blur-sm">
                              <button onClick={() => setEditActividad(act)} className="size-5 flex items-center justify-center rounded text-slate-500 hover:text-primary">
                                <span className="material-symbols-outlined text-[10px]">edit</span>
                              </button>
                              <button onClick={() => handleDelete(act)} className="size-5 flex items-center justify-center rounded text-slate-500 hover:text-red-500">
                                <span className="material-symbols-outlined text-[10px]">delete</span>
                              </button>
                            </div>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Vista MES ── */}
      {view === 'MES' && (() => {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysWithActs: { day: number; acts: typeof filteredActividades }[] = [];
        for (let d = 1; d <= daysInMonth; d++) {
          const acts = filteredActividades.filter(a => activityDay(a, year, month) === d);
          if (acts.length > 0) daysWithActs.push({ day: d, acts });
        }
        const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
        return (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button onClick={prevMonth} className="size-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 flex items-center justify-center text-slate-500 transition-colors">
                  <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>
                <button onClick={nextMonth} className="size-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 flex items-center justify-center text-slate-500 transition-colors">
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
                {!isCurrentMonth && (
                  <button onClick={() => setCurrentDate(new Date())} className="px-2.5 py-1 text-[10px] font-bold text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors">
                    Hoy
                  </button>
                )}
              </div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{MONTHS[month]} {year}</p>
              {/* Type filter pills */}
              <div className="flex items-center gap-1">
                {(['llamada', 'reunion', 'email', 'tarea'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => toggleType(t)}
                    title={t === 'reunion' ? 'Reunión' : t.charAt(0).toUpperCase() + t.slice(1)}
                    className={`size-7 rounded-lg flex items-center justify-center transition-all ${activeTypes.has(t) ? typeColorActive[t] : 'bg-slate-100 dark:bg-slate-800 text-slate-400 opacity-40'}`}
                  >
                    <span className="material-symbols-outlined text-sm">{typeIcon[t]}</span>
                  </button>
                ))}
              </div>
            </div>
            {daysWithActs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <span className="material-symbols-outlined text-5xl text-slate-200 mb-3">event_busy</span>
                <p className="text-sm font-bold text-slate-400">Sin actividades este mes</p>
              </div>
            ) : (
              <div className="space-y-4">
                {daysWithActs.map(({ day, acts }) => {
                  const date = new Date(year, month, day);
                  const isToday = sameDay(date, today);
                  const dayName = DAYS_FULL[(date.getDay() + 6) % 7];
                  return (
                    <div key={day}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`size-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${isToday ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>{day}</div>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{dayName} · {acts.length} actividad{acts.length > 1 ? 'es' : ''}</p>
                      </div>
                      <div className="space-y-2 pl-11">
                        {acts.map(act => (
                          <div key={act.id} className={`border-l-4 ${priorityBorder[act.prioridad] ?? 'border-l-slate-300'} p-3 rounded-r-xl group ${act.completada ? 'bg-slate-50 dark:bg-slate-800 opacity-60' : 'bg-white dark:bg-[#1e1a2e] border border-slate-100 dark:border-slate-700/50'}`}>
                            <div className="flex items-center gap-2">
                              <div onClick={() => handleToggle(act)} className={`size-6 rounded-md flex items-center justify-center flex-shrink-0 cursor-pointer ${typeColor[act.tipo]}`}>
                                <span className="material-symbols-outlined text-xs">{typeIcon[act.tipo]}</span>
                              </div>
                              <p className={`text-xs font-bold flex-1 ${act.completada ? 'line-through text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}>{act.titulo}</p>
                              <span className="text-[10px] text-slate-400">{activityTime(act)}</span>
                              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => setEditActividad(act)} className="size-6 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-400 hover:text-primary">
                                  <span className="material-symbols-outlined text-xs">edit</span>
                                </button>
                                <button onClick={() => handleDelete(act)} className="size-6 flex items-center justify-center rounded hover:bg-red-50 text-slate-400 hover:text-red-500">
                                  <span className="material-symbols-outlined text-xs">delete</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Vista HOY ── */}
      {view === 'HOY' && <div className="flex gap-6 items-start">
        <div className="flex-1 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: 'Actividades Hoy', value: loading ? '...' : String(todayTotal), icon: 'event', color: 'text-primary' },
              { label: 'Completadas', value: loading ? '...' : String(completed), icon: 'task_alt', color: 'text-green-600' },
              { label: 'Pendientes', value: loading ? '...' : String(todayTotal - completed), icon: 'pending_actions', color: 'text-orange-500' },
            ].map((s) => (
              <div key={s.label} className="bg-white dark:bg-[#1e1a2e] rounded-xl p-5 border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4">
                <div className="size-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                  <span className={`material-symbols-outlined ${s.color}`}>{s.icon}</span>
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{s.value}</p>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Calendar */}
          <div className="bg-white dark:bg-[#1e1a2e] rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{MONTHS[month]} {year}</h3>
              <div className="flex gap-1">
                <button onClick={prevMonth} className="size-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 flex items-center justify-center text-slate-500 dark:text-slate-400 transition-colors">
                  <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>
                <button onClick={nextMonth} className="size-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 flex items-center justify-center text-slate-500 dark:text-slate-400 transition-colors">
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 mb-0.5">
              {DAYS.map((d) => (
                <div key={d} className="text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest py-1">{d}</div>
              ))}
            </div>

            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7">
                {week.map((day, di) => {
                  const dots = day ? (eventDays[day] ?? []) : [];
                  const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                  const isSelected = day === selectedDay;
                  return (
                    <div
                      key={di}
                      onClick={() => day && setSelectedDay(day)}
                      className={`relative h-10 flex flex-col items-center justify-center rounded-lg transition-colors ${
                        day ? 'cursor-pointer hover:bg-primary/5' : ''
                      } ${isSelected ? 'bg-primary/10 ring-1 ring-primary/30' : ''} ${isToday && !isSelected ? 'bg-primary/5' : ''}`}
                    >
                      {day && (
                        <>
                          <span className={`text-xs font-bold leading-none ${isToday ? 'text-primary' : 'text-slate-700 dark:text-slate-300'}`}>{day}</span>
                          <div className="flex gap-0.5 mt-0.5">
                            {dots.slice(0, 3).map((c, i) => (
                              <div key={i} className={`size-1 rounded-full ${c}`} />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div className="w-80 flex-shrink-0 space-y-5">
          <div className="bg-white dark:bg-[#1e1a2e] rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-base">calendar_today</span>
              {selectedDay === today.getDate() && month === today.getMonth() && year === today.getFullYear()
                ? 'Hoy'
                : `${selectedDay} ${MONTHS[month]}`
              } · {todayActivities.length} actividades
            </h3>

            {loading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : todayActivities.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-xs text-slate-400">Sin actividades este día</p>
                <button
                  onClick={() => setModalOpen(true)}
                  className="mt-2 text-xs text-primary font-bold hover:underline"
                >
                  Agregar actividad
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {todayActivities.map((act) => (
                  <div
                    key={act.id}
                    className={`border-l-4 ${priorityBorder[act.prioridad] ?? 'border-l-slate-300'} p-3 rounded-r-xl hover:shadow-sm transition-all group ${
                      act.completada ? 'bg-slate-50 dark:bg-slate-800 opacity-60' : 'bg-white dark:bg-[#252035] border border-slate-100 dark:border-slate-700/50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        onClick={() => handleToggle(act)}
                        className={`size-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 cursor-pointer ${typeColor[act.tipo] ?? 'bg-slate-100 text-slate-500'}`}
                      >
                        <span className="material-symbols-outlined text-xs">{typeIcon[act.tipo] ?? 'task_alt'}</span>
                      </div>
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleToggle(act)}>
                        <p className={`text-xs font-bold leading-tight ${act.completada ? 'line-through text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}>
                          {act.titulo}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                          {activityTime(act)}{act.relacionado ? ` · ${act.relacionado}` : ''}
                        </p>
                      </div>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button onClick={() => setEditActividad(act)} className="size-6 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-400 hover:text-primary transition-colors">
                          <span className="material-symbols-outlined text-xs">edit</span>
                        </button>
                        <button onClick={() => handleDelete(act)} className="size-6 flex items-center justify-center rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                          <span className="material-symbols-outlined text-xs">delete</span>
                        </button>
                      </div>
                      {act.completada && (
                        <span className="material-symbols-outlined text-green-500 text-base flex-shrink-0">check_circle</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Google Calendar events for selected day */}
          {googleActive && (() => {
            const dayCalEvents = calEvents.filter(e => {
              const d = new Date(e.start);
              return d.getFullYear() === year && d.getMonth() === month && d.getDate() === selectedDay;
            });
            if (dayCalEvents.length === 0) return null;
            return (
              <div className="bg-white dark:bg-[#1e1a2e] rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm p-4">
                <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <svg className="size-3.5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  Google Calendar
                </h3>
                <div className="space-y-2">
                  {dayCalEvents.map((ev: CalendarEvent) => {
                    const start = new Date(ev.start);
                    const timeStr = isNaN(start.getTime()) ? '' : start.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
                    return (
                      <a key={ev.id} href={ev.htmlLink} target="_blank" rel="noreferrer"
                        className="flex items-start gap-2.5 p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors group">
                        <div className="size-6 rounded-md bg-blue-500 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="material-symbols-outlined text-xs">event</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-blue-800 dark:text-blue-200 truncate">{ev.summary}</p>
                          {timeStr && <p className="text-[10px] text-blue-500">{timeStr}</p>}
                          {ev.location && <p className="text-[10px] text-blue-400 truncate">{ev.location}</p>}
                        </div>
                        <span className="material-symbols-outlined text-xs text-blue-400 opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5">open_in_new</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Progress */}
          <div className="bg-primary text-white p-5 rounded-2xl shadow-xl shadow-primary/20 relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 size-24 bg-white/10 rounded-full blur-2xl" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-base">auto_awesome</span>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Progreso Diario</p>
              </div>
              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="opacity-80">{completed} de {todayTotal} completadas</span>
                  <span className="font-black">{pct}%</span>
                </div>
                <div className="h-1.5 bg-white/20 rounded-full">
                  <div className="h-1.5 bg-white rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <p className="text-xs opacity-80 leading-relaxed">
                {pct >= 80 ? '¡Excelente ritmo! Vas a cerrar el día con todo completado.' :
                 pct >= 50 ? 'Buen avance. Prioriza las actividades de alta urgencia.' :
                 todayTotal === 0 ? 'Sin actividades programadas para hoy.' :
                 'Tienes actividades críticas pendientes. Empieza por las llamadas.'}
              </p>
            </div>
          </div>

          {/* Types filter */}
          <div className="bg-white dark:bg-[#1e1a2e] rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm p-4">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Tipos de Actividad</p>
            <div className="grid grid-cols-2 gap-2">
              {(['llamada', 'reunion', 'email', 'tarea'] as const).map((t) => {
                const isActive = activeTypes.has(t);
                const count = actividades.filter(a => a.tipo === t && activityDay(a, year, month) !== null).length;
                return (
                  <button
                    key={t}
                    onClick={() => toggleType(t)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                      isActive ? typeColorActive[t] : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 opacity-50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">{typeIcon[t]}</span>
                    <span className="text-xs font-bold capitalize flex-1 text-left">{t === 'reunion' ? 'Reunión' : t.charAt(0).toUpperCase() + t.slice(1)}</span>
                    {count > 0 && (
                      <span className={`text-[10px] font-black leading-none px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/25' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>}

      {/* ── Vista TAREAS (Google Tasks) ── */}
      {view === 'TAREAS' && (
        <div className="max-w-2xl mx-auto">
          {/* New task input */}
          <div className="bg-white dark:bg-[#1e1a2e] rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm p-4 mb-4">
            <form onSubmit={async e => {
              e.preventDefault();
              if (!newTaskTitle.trim()) return;
              await createTask(newTaskTitle.trim());
              setNewTaskTitle('');
            }} className="flex gap-2">
              <input
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
                placeholder="Nueva tarea de Google..."
                className="flex-1 px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary dark:text-slate-200 placeholder:text-slate-400"
              />
              <button type="submit" disabled={!newTaskTitle.trim()}
                className="px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-xl shadow-md shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-40 flex items-center gap-2">
                <span className="material-symbols-outlined text-base">add</span>
                Agregar
              </button>
            </form>
          </div>

          {/* Tasks list */}
          <div className="bg-white dark:bg-[#1e1a2e] rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 dark:border-slate-700/50">
              <svg className="size-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Google Tasks</p>
              <span className="ml-auto text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                {tasks.filter(t => t.status === 'needsAction').length} pendientes
              </span>
            </div>

            {tasksLoading ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}
              </div>
            ) : tasks.length === 0 ? (
              <div className="py-16 text-center">
                <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600 block mb-2">task_alt</span>
                <p className="text-sm text-slate-400">Sin tareas pendientes</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-slate-700/30">
                {tasks.map((task: GoogleTask) => (
                  <div key={task.id} className={`flex items-center gap-3 px-5 py-3.5 group hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors ${task.status === 'completed' ? 'opacity-50' : ''}`}>
                    <button
                      onClick={() => toggleTask(task.id, task.status !== 'completed')}
                      className={`size-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        task.status === 'completed'
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-slate-300 dark:border-slate-600 hover:border-primary'
                      }`}
                    >
                      {task.status === 'completed' && <span className="material-symbols-outlined text-xs">check</span>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium text-slate-800 dark:text-slate-200 ${task.status === 'completed' ? 'line-through' : ''}`}>
                        {task.title}
                      </p>
                      {task.notes && <p className="text-[11px] text-slate-400 truncate">{task.notes}</p>}
                      {task.due && (
                        <p className="text-[10px] text-orange-500 font-medium">
                          Vence: {new Date(task.due).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="size-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <NuevaActividadModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={load}
      />
      <NuevaActividadModal
        open={!!editActividad}
        onClose={() => setEditActividad(null)}
        actividad={editActividad ?? undefined}
        onSuccess={load}
      />
    </div>
  );
}
