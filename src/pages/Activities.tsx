// Calendar grid for October 2023 (as per mockup)
const DAYS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

// Weeks for October 2023 (simplified)
const calendarWeeks = [
  [null, null, null, null, null, null, 1],
  [2, 3, 4, 5, 6, 7, 8],
  [9, 10, 11, 12, 13, 14, 15],
  [16, 17, 18, 19, 20, 21, 22],
  [23, 24, 25, 26, 27, 28, 29],
  [30, 31, null, null, null, null, null],
];

// Events on specific days
const events: Record<number, { color: string; count: number }[]> = {
  6: [{ color: 'bg-orange-400', count: 1 }],
  12: [{ color: 'bg-primary', count: 2 }],
  18: [{ color: 'bg-blue-400', count: 1 }, { color: 'bg-orange-400', count: 1 }],
  24: [{ color: 'bg-primary', count: 1 }],
};

const todayTasks = [
  {
    id: 't1',
    title: 'Llamado de cierre: Acme Corp',
    time: '10:30 AM',
    tag: 'Now',
    tagColor: 'bg-orange-500 text-white',
    priority: 'orange',
  },
  {
    id: 't2',
    title: 'Revisión de métricas',
    time: '01:45 PM',
    tag: 'Next',
    tagColor: 'bg-blue-100 text-blue-700',
    priority: 'blue',
  },
  {
    id: 't3',
    title: 'Follow-up: Client X',
    time: '04:30 PM',
    tag: 'URGENT',
    tagColor: 'bg-red-100 text-red-700',
    priority: 'red',
  },
];

const priorityBorder: Record<string, string> = {
  orange: 'border-l-orange-500',
  blue: 'border-l-blue-500',
  red: 'border-l-red-500',
};

const statsToday = [
  { label: 'Reuniones', value: 12, sub: 'Hoy', icon: 'groups', color: 'text-primary' },
  { label: 'Seguimientos', value: 5, sub: 'Pendientes', icon: 'phone_callback', color: 'text-blue-500' },
  { label: 'Urgentes', value: 3, sub: 'Acciones', icon: 'warning', color: 'text-orange-500' },
];

export default function Activities() {
  return (
    <div className="">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-2 block">
            Agenda de Calendario
          </span>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Actividades</h2>
        </div>
        <div className="flex items-center gap-2">
          {['HOY', 'SEMANA', 'MES'].map((v) => (
            <button
              key={v}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                v === 'HOY' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white border border-slate-200 text-slate-500 hover:border-primary/30'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* Calendar + stats */}
        <div className="flex-1 space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            {statsToday.map((s) => (
              <div key={s.label} className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
                <div className={`size-10 rounded-xl bg-primary/5 flex items-center justify-center ${s.color}`}>
                  <span className="material-symbols-outlined">{s.icon}</span>
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900">{s.value}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {s.label} · {s.sub}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Calendar */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-bold text-slate-900">Octubre 2023</h3>
              <div className="flex gap-2">
                <button className="size-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors">
                  <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>
                <button className="size-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors">
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-2">
              {DAYS.map((d) => (
                <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest py-2">
                  {d}
                </div>
              ))}
            </div>

            {/* Weeks */}
            {calendarWeeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7">
                {week.map((day, di) => {
                  const dayEvents = day ? events[day] : null;
                  const isToday = day === 12;
                  return (
                    <div
                      key={di}
                      className={`relative aspect-square flex flex-col items-center justify-start pt-2 rounded-lg cursor-pointer transition-colors group ${
                        day ? 'hover:bg-primary/5' : ''
                      } ${isToday ? 'bg-primary/10' : ''}`}
                    >
                      {day && (
                        <>
                          <span className={`text-sm font-bold ${isToday ? 'text-primary' : 'text-slate-700 group-hover:text-primary'}`}>
                            {day}
                          </span>
                          {dayEvents && (
                            <div className="flex gap-0.5 mt-1">
                              {dayEvents.map((ev, ei) => (
                                <div key={ei} className={`size-1.5 rounded-full ${ev.color}`} />
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Tasks today + AI insight */}
        <div className="w-80 flex-shrink-0 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-base">task_alt</span>
              Tareas de Hoy
            </h3>
            <div className="space-y-3">
              {todayTasks.map((task) => (
                <div
                  key={task.id}
                  className={`border-l-4 ${priorityBorder[task.priority]} bg-slate-50 p-4 rounded-r-xl cursor-pointer hover:shadow-sm transition-all`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <p className="text-sm font-bold text-slate-900 leading-tight">{task.title}</p>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ml-2 flex-shrink-0 ${task.tagColor}`}>
                      {task.tag}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">{task.time}</p>
                </div>
              ))}
            </div>
          </div>

          {/* AI daily insight */}
          <div className="bg-primary text-white p-6 rounded-2xl shadow-xl shadow-primary/20 relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 size-24 bg-white/10 rounded-full blur-2xl" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-base">auto_awesome</span>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Progreso Diario</p>
              </div>
              <p className="text-sm font-medium opacity-90 leading-relaxed">
                Estás al 65% de tu tasa de eficiencia para Hoy. 3 tareas críticas restantes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
