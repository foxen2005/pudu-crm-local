const flows = [
  {
    id: 'f1',
    trigger: 'Nuevo Lead Creado',
    action: 'Enviar Secuencia Bienvenida',
    successRate: 98.4,
    active: true,
    error: false,
  },
  {
    id: 'f2',
    trigger: 'Factura Vencida > 5 días',
    action: 'Notificar a Account Manager',
    successRate: 100,
    active: true,
    error: false,
  },
  {
    id: 'f3',
    trigger: 'Webhook Externo (Zendesk)',
    action: 'Actualizar Ticket en CRM',
    successRate: null,
    active: false,
    error: true,
    errorCode: 'Error 401',
  },
];

export default function Automations() {
  return (
    <div className="">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-2 block">
            Flujos de Automatización
          </span>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Automatizaciones</h2>
          <p className="text-sm text-slate-500 mt-2 max-w-lg">
            Arquitectura de flujos lógicos para la velocidad operativa. Configure disparadores y acciones para eliminar la fricción manual.
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-xs font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all">
          <span className="material-symbols-outlined text-sm">add</span>
          Nuevo Flujo
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="size-12 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined">bolt</span>
          </div>
          <div>
            <p className="text-3xl font-black text-slate-900">24</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Flujos Activos</p>
            <p className="text-[10px] text-green-500 font-bold mt-0.5">↑ 12% este mes</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="size-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <span className="material-symbols-outlined">electric_bolt</span>
          </div>
          <div>
            <p className="text-3xl font-black text-slate-900">1.4k</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ejecuciones Hoy</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="size-12 rounded-xl bg-red-50 flex items-center justify-center text-red-500">
            <span className="material-symbols-outlined">error</span>
          </div>
          <div>
            <p className="text-3xl font-black text-slate-900">1</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Errores Activos</p>
          </div>
        </div>
      </div>

      {/* Error banner */}
      <div className="mb-6 border-l-4 border-l-red-500 bg-red-50 p-5 rounded-r-xl flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="size-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600">
            <span className="material-symbols-outlined">warning</span>
          </div>
          <div>
            <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Acción Requerida</p>
            <p className="text-sm font-bold text-red-900">
              Flujo de "Lead Calificado" en pausa
            </p>
            <p className="text-xs text-red-700/70 mt-0.5">
              La integración con Salesforce ha detectado un error de autenticación. 34 leads están en cola de espera.
            </p>
          </div>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20">
          Revisar Error
        </button>
      </div>

      {/* Flows list */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
            Flujos de Trabajo Recientes
          </h3>
        </div>
        <div className="divide-y divide-slate-50">
          {flows.map((flow) => (
            <div key={flow.id} className="px-6 py-5 flex items-center gap-6 hover:bg-slate-50/50 transition-colors group">
              {/* Trigger */}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Si ocurre</p>
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-slate-100 flex items-center justify-center">
                    <span className="material-symbols-outlined text-sm text-slate-500">play_circle</span>
                  </div>
                  <p className="text-sm font-bold text-slate-900 truncate">{flow.trigger}</p>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex-shrink-0 text-slate-300">
                <span className="material-symbols-outlined">arrow_forward</span>
              </div>

              {/* Action */}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Entonces</p>
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-sm text-primary">send</span>
                  </div>
                  <p className="text-sm font-bold text-slate-900 truncate">{flow.action}</p>
                </div>
              </div>

              {/* Success rate */}
              <div className="w-24 flex-shrink-0 text-center">
                {flow.error ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black text-red-600 bg-red-50 px-2 py-1 rounded-full border border-red-200">
                    <span className="material-symbols-outlined text-xs">error</span>
                    {flow.errorCode}
                  </span>
                ) : (
                  <>
                    <p className="text-lg font-black text-slate-900">{flow.successRate}%</p>
                    <p className="text-[10px] text-slate-400 font-medium">Éxito</p>
                  </>
                )}
              </div>

              {/* Toggle */}
              <div className="flex-shrink-0 flex items-center gap-3">
                <button
                  className={`w-11 h-6 rounded-full relative transition-colors ${
                    flow.active && !flow.error ? 'bg-primary' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`absolute top-1 size-4 bg-white rounded-full shadow-sm transition-transform ${
                      flow.active && !flow.error ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
