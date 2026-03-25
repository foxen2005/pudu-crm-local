const kpiCards = [
  {
    icon: 'conversion_path',
    label: 'Tasa de Conversión',
    value: '23.4%',
    trend: '+4.2%',
    trendUp: true,
    trendLabel: 'vs mes anterior',
  },
  {
    icon: 'payments',
    label: 'Revenue MTD',
    value: '$32.1M CLP',
    trend: '+12%',
    trendUp: true,
    trendLabel: 'vs mes anterior',
  },
  {
    icon: 'emoji_events',
    label: 'Deals Ganados',
    value: '12',
    trend: 'este mes',
    trendUp: null,
    trendLabel: '',
  },
  {
    icon: 'timer',
    label: 'Ciclo Promedio',
    value: '18 días',
    trend: '-2d',
    trendUp: false, // down is good here
    trendLabel: 'mejora',
  },
];

const funnelStages = [
  { label: 'Lead', count: 48, width: '100%', color: 'bg-slate-300' },
  { label: 'Contactado', count: 35, width: '72%', color: 'bg-blue-300' },
  { label: 'Propuesta', count: 22, width: '45%', color: 'bg-orange-300' },
  { label: 'Negociación', count: 14, width: '28%', color: 'bg-primary/30' },
  { label: 'Ganado', count: 12, width: '25%', color: 'bg-green-300' },
];

const performers = [
  { name: 'Carlos M.', deals: 8, revenue: '$14.2M', conversion: '34%' },
  { name: 'Ana P.', deals: 6, revenue: '$9.8M', conversion: '28%' },
  { name: 'Rodrigo K.', deals: 4, revenue: '$8.1M', conversion: '22%' },
];

const revenueMonths = [
  { label: 'Sep', height: '40%', current: false },
  { label: 'Oct', height: '55%', current: false },
  { label: 'Nov', height: '60%', current: false },
  { label: 'Dic', height: '45%', current: false },
  { label: 'Ene', height: '70%', current: false },
  { label: 'Feb', height: '85%', current: false },
  { label: 'Mar', height: '100%', current: true },
];

export default function Reports() {
  return (
    <div className="">
      {/* Page header */}
      <div className="flex flex-col mb-8">
        <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-2">
          Analytics
        </span>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Reportes</h2>
        <p className="text-sm text-slate-500 mt-1">Inteligencia operativa del pipeline</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {kpiCards.map((card) => (
          <KpiCard key={card.label} {...card} />
        ))}
      </div>

      {/* Middle row: Funnel + Top Performers */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {/* Funnel — 3 cols */}
        <div className="col-span-3 bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <h3 className="text-sm font-black text-slate-900 mb-5">Embudo de Conversión</h3>
          <div className="space-y-3">
            {funnelStages.map((stage) => (
              <div key={stage.label} className="flex items-center gap-3">
                <span className="text-[11px] font-bold text-slate-500 w-24 text-right flex-shrink-0">
                  {stage.label}
                </span>
                <div className="flex-1 h-8 bg-slate-50 rounded-lg overflow-hidden">
                  <div
                    className={`h-full ${stage.color} rounded-lg flex items-center px-3 transition-all`}
                    style={{ width: stage.width }}
                  >
                    <span className="text-[11px] font-bold text-slate-700">{stage.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Performers — 2 cols */}
        <div className="col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <h3 className="text-sm font-black text-slate-900 mb-5">Top Performers</h3>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Vendedor
                </th>
                <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
                  Deals
                </th>
                <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">
                  Revenue
                </th>
                <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">
                  Conv.
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {performers.map((p, i) => (
                <tr key={p.name}>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary flex-shrink-0">
                        {p.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-xs font-bold text-slate-800">{p.name}</span>
                      {i === 0 && (
                        <span className="material-symbols-outlined text-sm text-yellow-400" style={{ fontVariationSettings: "'FILL' 1" }}>
                          star
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 text-center">
                    <span className="text-xs font-bold text-slate-700">{p.deals}</span>
                  </td>
                  <td className="py-3 text-right">
                    <span className="text-xs font-bold text-primary">{p.revenue}</span>
                  </td>
                  <td className="py-3 text-right">
                    <span className="text-xs font-bold text-slate-700">{p.conversion}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revenue bar chart */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-black text-slate-900">Revenue por Mes</h3>
          <span className="text-[11px] font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
            Últimos 7 meses
          </span>
        </div>
        <div className="flex items-end gap-3 h-40">
          {revenueMonths.map((month) => (
            <div key={month.label} className="flex flex-col items-center gap-2 flex-1">
              <div className="w-full flex items-end" style={{ height: '120px' }}>
                <div
                  className={`w-full rounded-t-lg transition-all ${
                    month.current ? 'bg-primary' : 'bg-slate-200'
                  }`}
                  style={{ height: month.height }}
                />
              </div>
              <span
                className={`text-[11px] font-bold ${
                  month.current ? 'text-primary' : 'text-slate-400'
                }`}
              >
                {month.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  trend,
  trendUp,
  trendLabel,
}: {
  icon: string;
  label: string;
  value: string;
  trend: string;
  trendUp: boolean | null;
  trendLabel: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-5">
      <div className="flex items-center justify-between mb-3">
        <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-xl text-primary">{icon}</span>
        </div>
        {trendUp !== null && (
          <div
            className={`flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full ${
              trendUp
                ? 'bg-green-50 text-green-600'
                : 'bg-green-50 text-green-600'
            }`}
          >
            <span className="material-symbols-outlined text-xs">
              {trendUp ? 'trending_up' : 'trending_down'}
            </span>
            {trend}
          </div>
        )}
        {trendUp === null && (
          <span className="text-[11px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
            {trend}
          </span>
        )}
      </div>
      <p className="text-2xl font-black text-slate-900 mb-1">{value}</p>
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{label}</p>
      {trendLabel && (
        <p className="text-[10px] text-slate-400 mt-0.5">{trendLabel}</p>
      )}
    </div>
  );
}
