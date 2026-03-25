const dailyActions = [
  {
    icon: '🔥',
    title: 'Contactar 3 leads calientes',
    desc: 'Prioridad máxima: Interactuaron con la propuesta en las últimas 2h',
    color: 'orange',
    action: 'Ejecutar',
  },
  {
    icon: '⚠️',
    title: 'Revisar 2 oportunidades en riesgo',
    desc: 'Negocios estancados por más de 7 días sin contacto',
    color: 'red',
    action: 'Revisar',
  },
  {
    icon: '📞',
    title: '4 seguimientos pendientes',
    desc: 'Llamadas agendadas para el bloque de la tarde',
    color: 'blue',
    action: 'Ver Agenda',
  },
];

const colorMap: Record<string, { card: string; btn: string; text: string; desc: string }> = {
  orange: {
    card: 'border-l-4 border-l-orange-500 bg-orange-50 hover:shadow-md',
    btn: 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20',
    text: 'text-orange-900',
    desc: 'text-orange-700/70',
  },
  red: {
    card: 'border-l-4 border-l-red-500 bg-red-50 hover:shadow-md',
    btn: 'bg-red-500 hover:bg-red-600 shadow-red-500/20',
    text: 'text-red-900',
    desc: 'text-red-700/70',
  },
  blue: {
    card: 'border-l-4 border-l-blue-500 bg-blue-50 hover:shadow-md',
    btn: 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20',
    text: 'text-blue-900',
    desc: 'text-blue-700/70',
  },
};

const aiInsights = [
  {
    icon: 'auto_awesome',
    iconBg: 'bg-primary/10 text-primary',
    title: 'Potencial de Cierre: Alto',
    desc: 'Compañía Minera del Norte ha mostrado patrones de compra inminentes.',
  },
  {
    icon: 'trending_down',
    iconBg: 'bg-slate-100 text-slate-500',
    title: 'Cuello de Botella',
    desc: "La etapa 'Propuesta' requiere un descuento promedio del 5% para avanzar.",
    dim: true,
  },
];

const teamActivity = [
  { color: 'bg-green-500', text: '<b>Carlos</b> llamó a Juan Pérez' },
  { color: 'bg-blue-500', text: '<b>Ana</b> creó negocio Restaurante Sol' },
  { color: 'bg-slate-300', text: '<b>Rodrigo</b> envió email a Hotel Andes' },
];

const pipelineStages = [
  { label: 'LEAD', value: '$12.5M', highlight: false },
  { label: 'CONTAC.', value: '$8.2M', highlight: false },
  { label: 'PROPUESTA', value: '$15.0M', highlight: false },
  { label: 'NEGOCIA.', value: '$4.5M', highlight: false },
  { label: 'GANADO', value: '$5.0M', highlight: true },
];

const progressDone = 7;
const progressTotal = 10;

export default function Dashboard() {
  return (
    <div className="grid grid-cols-12 gap-8">

      {/* ── Left 8 columns ── */}
      <div className="col-span-8 space-y-10">

        {/* Daily focus */}
        <section>
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="text-[10px] font-black text-primary tracking-[0.2em] uppercase mb-1">
                Enfoque Diario
              </h2>
              <h3 className="text-3xl font-black text-slate-900">HOY DEBES HACER:</h3>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 mb-2 text-sm font-bold text-slate-500">
                <span>Progreso hoy</span>
                <span className="text-primary">70%</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-slate-400">
                <div className="flex gap-0.5">
                  {Array.from({ length: progressTotal }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-3 h-4 rounded-sm ${i < progressDone ? 'bg-primary' : 'bg-slate-200'}`}
                    />
                  ))}
                </div>
                <span className="ml-2 uppercase">12 acciones realizadas</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {dailyActions.map((item) => {
              const c = colorMap[item.color];
              return (
                <div
                  key={item.title}
                  className={`group flex items-center justify-between p-5 rounded-xl transition-all cursor-pointer ${c.card}`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{item.icon}</span>
                    <div>
                      <p className={`text-lg font-bold ${c.text}`}>{item.title}</p>
                      <p className={`text-sm ${c.desc}`}>{item.desc}</p>
                    </div>
                  </div>
                  <button className={`${c.btn} text-white px-4 py-2 rounded-lg font-bold text-sm shadow-lg transition-colors`}>
                    {item.action}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Insights + Team */}
        <div className="grid grid-cols-2 gap-8">
          <section className="space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">psychology</span>
              Insights de IA
            </h3>
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
              {aiInsights.map((ins) => (
                <div key={ins.title} className={`flex gap-4 items-start ${ins.dim ? 'opacity-60' : ''}`}>
                  <div className={`size-8 ${ins.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <span className="material-symbols-outlined text-sm">{ins.icon}</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold">{ins.title}</p>
                    <p className="text-xs text-slate-500 mt-1">{ins.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-400">group</span>
              Actividad del Equipo
            </h3>
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 h-full">
              {teamActivity.map((act, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`size-2 rounded-full ${act.color}`} />
                  <p
                    className="text-xs text-slate-600"
                    dangerouslySetInnerHTML={{ __html: act.text }}
                  />
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Pipeline snapshot */}
        <section className="opacity-80 hover:opacity-100 transition-opacity">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Embudo de Ventas (CLP)
            </h3>
            <p className="text-xs font-medium text-slate-500">Total: $45.200.000</p>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {pipelineStages.map((stage) => (
              <div
                key={stage.label}
                className={`p-3 rounded-xl border ${
                  stage.highlight
                    ? 'bg-primary/5 border-primary/20'
                    : 'bg-white border-slate-100'
                }`}
              >
                <p className={`text-[10px] font-bold mb-1 uppercase ${stage.highlight ? 'text-primary' : 'text-slate-400'}`}>
                  {stage.label}
                </p>
                <p className={`text-xs font-black ${stage.highlight ? 'text-primary' : ''}`}>
                  {stage.value}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── Right 4 columns ── */}
      <div className="col-span-4 space-y-8">
        {/* Featured contact card */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 pb-0 flex flex-col items-center">
            <div className="size-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 border-4 border-slate-50 shadow-sm">
              <span className="material-symbols-outlined text-3xl text-primary">person</span>
            </div>
            <h3 className="text-lg font-bold">María González</h3>
            <p className="text-xs font-bold text-primary mb-4">Transportes del Sur S.A.</p>
          </div>
          <div className="px-6 py-4 bg-slate-50 flex justify-between items-center border-y border-slate-100">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valor</p>
              <p className="text-sm font-black">
                $12.500.000 <span className="text-[10px] text-slate-500 font-normal">CLP</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Etapa</p>
              <p className="text-xs font-bold text-slate-700">Propuesta</p>
            </div>
          </div>
          <div className="p-6">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">Próxima Tarea</p>
            <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs font-medium flex items-center gap-3">
              <div className="size-2 rounded-full bg-primary" />
              Enviar brochure actualizado
            </div>
          </div>
        </section>

        {/* Performance card */}
        <section className="bg-primary text-white p-6 rounded-2xl shadow-xl shadow-primary/20 overflow-hidden relative">
          <div className="absolute -right-4 -bottom-4 size-32 bg-white/10 rounded-full blur-3xl" />
          <div className="flex items-center justify-between mb-8 relative z-10">
            <h3 className="text-xs font-black tracking-widest uppercase opacity-80">Rendimiento</h3>
            <span className="text-[10px] bg-white/20 px-2 py-1 rounded-full font-bold">Top 5%</span>
          </div>
          <div className="mb-2 relative z-10">
            <span className="text-5xl font-black">85</span>
            <span className="text-xl opacity-60 font-bold">/100</span>
          </div>
          <p className="text-xs font-medium opacity-80 mb-6 relative z-10">
            Excelente ritmo de cierre esta semana
          </p>
          <div className="space-y-3 relative z-10">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest opacity-60">
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                <span key={i} className={i === 4 ? 'opacity-100' : ''}>{d}</span>
              ))}
            </div>
            <div className="flex justify-between h-8 items-end gap-1">
              {[40, 60, 50, 90, 100, 10, 10].map((h, i) => (
                <div
                  key={i}
                  className={`w-full rounded-sm ${i === 4 ? 'bg-white' : 'bg-white/20'}`}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
