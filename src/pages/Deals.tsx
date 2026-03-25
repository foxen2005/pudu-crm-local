const stages = [
  {
    id: 'lead',
    label: 'Lead',
    color: 'text-slate-500',
    deals: [
      { id: 'd1', name: 'Constructora Andes', value: 'CLP $12.500.000', tag: null, days: '30 días' },
      { id: 'd2', name: 'TechSol Chile', value: 'CLP $8.200.000', tag: null, days: 'Yesterday' },
    ],
  },
  {
    id: 'contactado',
    label: 'Contactado',
    color: 'text-blue-500',
    deals: [
      { id: 'd3', name: 'Logística Express', value: 'CLP $25.000.000', tag: null, days: '15h ago' },
    ],
  },
  {
    id: 'propuesta',
    label: 'Propuesta',
    color: 'text-primary',
    deals: [
      { id: 'd4', name: 'Inmobiliaria Sur', value: 'CLP $42.000.000', tag: 'Stalling Soon', days: 'Today' },
      { id: 'd5', name: 'Retail Global S.A.', value: 'CLP $15.000.000', tag: null, days: '2 days ago' },
    ],
  },
  {
    id: 'negociacion',
    label: 'Negociación',
    color: 'text-orange-500',
    deals: [
      { id: 'd6', name: 'Mining Corp', value: 'CLP $32.500.000', tag: 'High Priority', days: 'Today' },
    ],
  },
  {
    id: 'ganado',
    label: 'Ganado',
    color: 'text-green-500',
    deals: [
      { id: 'd7', name: 'Agencia Digital', value: 'CLP $10.000.000', tag: null, days: '3 days ago' },
    ],
  },
];

const tagStyles: Record<string, string> = {
  'Stalling Soon': 'bg-orange-50 text-orange-600 border border-orange-200',
  'High Priority': 'bg-red-50 text-red-600 border border-red-200',
};

export default function Deals() {
  const total = 'CLP $145.200.000';

  return (
    <div className="">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-2 block">
            Pipeline de Ventas
          </span>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            Q4 Negocios
          </h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Total Pipeline: <span className="font-black text-slate-700">{total}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-outline-variant rounded-lg text-xs font-bold text-slate-600 hover:bg-white transition-all">
            <span className="material-symbols-outlined text-sm">filter_list</span>
            Filtrar
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all">
            <span className="material-symbols-outlined text-sm">add</span>
            Crear Negocio
          </button>
        </div>
      </div>

      {/* Kanban columns */}
      <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
        {stages.map((stage) => (
          <div key={stage.id} className="flex-shrink-0 w-64">
            {/* Column header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <span className={`text-[10px] font-black uppercase tracking-widest ${stage.color}`}>
                {stage.label}
              </span>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {stage.deals.length}
              </span>
            </div>

            {/* Cards */}
            <div className="space-y-3">
              {stage.deals.map((deal) => (
                <div
                  key={deal.id}
                  className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="text-sm font-bold text-slate-900 leading-tight">{deal.name}</h4>
                    <button className="opacity-0 group-hover:opacity-100 size-6 flex items-center justify-center rounded-md hover:bg-slate-100 transition-all">
                      <span className="material-symbols-outlined text-sm text-slate-400">more_horiz</span>
                    </button>
                  </div>

                  <p className="text-xs font-black text-slate-800 mb-3">{deal.value}</p>

                  {deal.tag && (
                    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-3 ${tagStyles[deal.tag] ?? 'bg-slate-100 text-slate-600'}`}>
                      {deal.tag}
                    </span>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-medium">{deal.days}</span>
                    <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-xs text-primary">person</span>
                    </div>
                  </div>
                </div>
              ))}

              {/* Add card placeholder */}
              <button className="w-full p-3 rounded-xl border border-dashed border-slate-200 text-xs font-medium text-slate-400 hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-base">add</span>
                Agregar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
