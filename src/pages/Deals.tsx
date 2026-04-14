import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { NuevoNegocioModal } from '@/components/modals/NuevoNegocioModal';
import { NegocioDrawer } from '@/components/NegocioDrawer';
import { getNegocios, eliminarNegocio, moverNegocioEtapa, type Negocio } from '@/lib/db';

const STAGES_PIPELINE = [
  { id: 'Prospección', label: 'Prospección', color: 'text-slate-500', dotColor: 'bg-slate-400' },
  { id: 'Calificación', label: 'Calificación', color: 'text-blue-500', dotColor: 'bg-blue-400' },
  { id: 'Propuesta', label: 'Propuesta', color: 'text-primary', dotColor: 'bg-primary' },
  { id: 'Negociación', label: 'Negociación', color: 'text-orange-500', dotColor: 'bg-orange-400' },
  { id: 'Cierre', label: 'Cierre', color: 'text-green-600', dotColor: 'bg-green-500' },
];

const STAGES_ORDENES = [
  { id: 'Nuevo', label: 'Nuevo', color: 'text-slate-500', dotColor: 'bg-slate-400' },
  { id: 'En proceso', label: 'En proceso', color: 'text-blue-500', dotColor: 'bg-blue-400' },
  { id: 'Listo', label: 'Listo', color: 'text-primary', dotColor: 'bg-primary' },
  { id: 'Entregado', label: 'Entregado', color: 'text-orange-500', dotColor: 'bg-orange-400' },
  { id: 'Facturado', label: 'Facturado', color: 'text-green-600', dotColor: 'bg-green-500' },
];

function formatCLP(n: number) {
  return 'CLP $' + n.toLocaleString('es-CL');
}

function daysAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  if (diff < 7) return `Hace ${diff} días`;
  return new Date(iso).toLocaleDateString('es-CL');
}

export default function Deals() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const empresaFilter = searchParams.get('empresa') ?? '';

  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editNegocio, setEditNegocio] = useState<Negocio | null>(null);
  const [drawerNegocio, setDrawerNegocio] = useState<Negocio | null>(null);
  const [vista, setVista] = useState<'pipeline' | 'ordenes'>('pipeline');
  const STAGES = vista === 'ordenes' ? STAGES_ORDENES : STAGES_PIPELINE;

  // Drag & drop state
  const dragId = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getNegocios();
    if (result.ok) setNegocios(result.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const ordenEtapas = new Set(STAGES_ORDENES.map(s => s.id));
  const pipelineEtapas = new Set(STAGES_PIPELINE.map(s => s.id));

  // Negocios con etapa desconocida para la vista actual caen en la primera columna
  const firstPipelineStage = STAGES_PIPELINE[0].id;
  const firstOrdenStage = STAGES_ORDENES[0].id;

  const displayNegocios = negocios
    .filter(n => !empresaFilter || n.empresa_nombre?.toLowerCase().includes(empresaFilter.toLowerCase()))
    .map(n => {
      if (vista === 'ordenes') {
        return ordenEtapas.has(n.etapa) ? n : { ...n, etapa: firstOrdenStage };
      } else {
        return pipelineEtapas.has(n.etapa) ? n : { ...n, etapa: firstPipelineStage };
      }
    });

  const totalPipeline = displayNegocios.reduce((s, n) => s + (n.valor ?? 0), 0);
  const totalDeals = displayNegocios.length;
  const enRiesgo = displayNegocios.filter((n) => n.riesgo).length;
  const pipelineEsperado = displayNegocios.reduce((s, n) => s + (n.valor ?? 0) * (n.probabilidad ?? 0) / 100, 0);

  const handleDelete = async (deal: Negocio) => {
    if (!window.confirm(`¿Eliminar "${deal.nombre}"?\nEsta acción no se puede deshacer.`)) return;
    const result = await eliminarNegocio(deal.id);
    if (result.ok) load();
    else window.alert(result.error);
  };

  // ── Drag & Drop handlers ──────────────────────────────────────────
  const onDragStart = (e: React.DragEvent, dealId: string) => {
    dragId.current = dealId;
    setDragging(dealId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragEnd = () => {
    dragId.current = null;
    setDragging(null);
    setDragOver(null);
  };

  const onDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(stageId);
  };

  const onDrop = async (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    const id = dragId.current;
    if (!id) return;
    const deal = negocios.find(n => n.id === id);
    if (!deal || deal.etapa === stageId) { setDragOver(null); return; }

    // Optimistic update
    setNegocios(prev => prev.map(n => n.id === id ? { ...n, etapa: stageId } : n));
    setDragOver(null);

    await moverNegocioEtapa(id, stageId);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-2 block">Pipeline de Ventas</span>
          <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Negocios</h2>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 text-xs font-bold">
            <button
              onClick={() => setVista('pipeline')}
              className={`px-3 py-1.5 rounded-md transition-all ${vista === 'pipeline' ? 'bg-white dark:bg-[#1e1a2e] text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500'}`}
            >
              Pipeline
            </button>
            <button
              onClick={() => setVista('ordenes')}
              className={`px-3 py-1.5 rounded-md transition-all ${vista === 'ordenes' ? 'bg-white dark:bg-[#1e1a2e] text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500'}`}
            >
              Órdenes
            </button>
          </div>
          <button onClick={() => load()} className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-all">
            <span className="material-symbols-outlined text-sm">refresh</span>
            Actualizar
          </button>
          <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all">
            <span className="material-symbols-outlined text-sm">add</span>
            {vista === 'ordenes' ? 'Nueva Orden' : 'Nuevo Negocio'}
          </button>
        </div>
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

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Pipeline', value: loading ? '...' : formatCLP(totalPipeline), icon: 'attach_money', color: 'text-primary' },
          { label: 'Pipeline Esperado', value: loading ? '...' : formatCLP(Math.round(pipelineEsperado)), icon: 'trending_up', color: 'text-green-600' },
          { label: 'Negocios Activos', value: loading ? '...' : String(totalDeals), icon: 'handshake', color: 'text-blue-600' },
          { label: 'En Riesgo', value: loading ? '...' : String(enRiesgo), icon: 'warning', color: 'text-orange-500' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white dark:bg-[#1e1a2e] rounded-xl p-4 border border-slate-100 dark:border-slate-700/50 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{kpi.label}</p>
              <span className={`material-symbols-outlined text-base ${kpi.color}`}>{kpi.icon}</span>
            </div>
            <p className={`text-lg font-black ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex gap-4">
          {STAGES.map((s) => (
            <div key={s.id} className="flex-1 min-w-[180px]">
              <div className="mb-3 px-1"><div className="h-3 bg-slate-100 dark:bg-slate-800 rounded animate-pulse mb-2 w-24" /></div>
              <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="bg-white dark:bg-[#1e1a2e] rounded-xl p-4 border border-slate-100 dark:border-slate-700/50 shadow-sm h-28 animate-pulse" />)}</div>
            </div>
          ))}
        </div>
      ) : displayNegocios.length === 0 && !dragging ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="material-symbols-outlined text-5xl text-slate-200 mb-4">handshake</span>
          <p className="text-slate-400 font-medium mb-3">
            {empresaFilter ? `Sin negocios para "${empresaFilter}"` : 'No hay negocios registrados'}
          </p>
          {!empresaFilter && (
            <button onClick={() => setModalOpen(true)} className="text-xs text-primary font-bold hover:underline">Crear el primer negocio</button>
          )}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
          {STAGES.map((stage) => {
            const stageDeals = displayNegocios.filter((n) => n.etapa === stage.id);
            const stageTotal = stageDeals.reduce((s, n) => s + (n.valor ?? 0), 0);
            const isDropTarget = dragOver === stage.id;
            return (
              <div
                key={stage.id}
                className="flex-1 min-w-[200px]"
                onDragOver={e => onDragOver(e, stage.id)}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => onDrop(e, stage.id)}
              >
                <div className="mb-3 px-1">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <div className={`size-2 rounded-full ${stage.dotColor}`} />
                      <span className={`text-[10px] font-black uppercase tracking-widest ${stage.color}`}>{stage.label}</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{stageDeals.length}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium pl-3.5">{formatCLP(stageTotal)}</p>
                </div>

                {/* Drop zone column */}
                <div className={`space-y-3 min-h-[60px] rounded-xl transition-all duration-150 ${isDropTarget ? 'bg-primary/5 ring-2 ring-primary/20 ring-dashed p-2' : 'p-0'}`}>
                  {stageDeals.map((deal) => (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={e => onDragStart(e, deal.id)}
                      onDragEnd={onDragEnd}
                      className={`bg-white dark:bg-[#1e1a2e] rounded-xl p-4 border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group cursor-grab active:cursor-grabbing select-none ${
                        dragging === deal.id ? 'opacity-40 scale-95' : ''
                      } ${deal.riesgo ? 'border-l-4 border-l-orange-400 border-slate-100 dark:border-slate-700/50' : 'border-slate-100 dark:border-slate-700/50'}`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight pr-2 flex-1">{deal.nombre}</h4>
                        <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); setDrawerNegocio(deal); }}
                            onMouseDown={e => e.stopPropagation()}
                            className="size-6 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-400 hover:text-primary transition-colors"
                            title="Ver adjuntos y cotizaciones"
                          >
                            <span className="material-symbols-outlined text-sm">open_in_new</span>
                          </button>
                          <button
                            onClick={() => setEditNegocio(deal)}
                            onMouseDown={e => e.stopPropagation()}
                            className="size-6 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-400 hover:text-primary transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">edit</span>
                          </button>
                          <button
                            onClick={() => handleDelete(deal)}
                            onMouseDown={e => e.stopPropagation()}
                            className="size-6 flex items-center justify-center rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                        {deal.empresa_nombre ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/contactos?empresa=${encodeURIComponent(deal.empresa_nombre!)}`); }}
                            className="hover:text-primary hover:underline transition-colors"
                          >{deal.empresa_nombre}</button>
                        ) : '—'}
                        {deal.contacto_nombre ? ` · ${deal.contacto_nombre}` : ''}
                      </p>
                      <p className="text-xs font-black text-slate-800 dark:text-slate-200 mb-3">{formatCLP(deal.valor ?? 0)}</p>

                      {deal.probabilidad != null && (
                        <div className="mb-2">
                          <div className="flex justify-between mb-1">
                            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">Probabilidad</span>
                            <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300">{deal.probabilidad}%</span>
                          </div>
                          <div className="h-1 bg-slate-100 dark:bg-slate-700 rounded-full">
                            <div
                              className={`h-1 rounded-full ${deal.probabilidad >= 70 ? 'bg-green-500' : deal.probabilidad >= 40 ? 'bg-primary' : 'bg-orange-400'}`}
                              style={{ width: `${deal.probabilidad}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{daysAgo(deal.created_at)}</span>
                        {deal.riesgo && <span className="material-symbols-outlined text-sm text-orange-400">warning</span>}
                      </div>
                    </div>
                  ))}

                  {/* Drop placeholder when dragging over empty column */}
                  {isDropTarget && stageDeals.length === 0 && (
                    <div className="h-20 rounded-xl border-2 border-dashed border-primary/30 flex items-center justify-center">
                      <span className="text-xs text-primary/50 font-medium">Soltar aquí</span>
                    </div>
                  )}

                  <button
                    onClick={() => setModalOpen(true)}
                    className="w-full p-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-400 dark:text-slate-500 hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-base">add</span>
                    Agregar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <NuevoNegocioModal open={modalOpen} onClose={() => setModalOpen(false)} onSuccess={load} />
      <NuevoNegocioModal open={!!editNegocio} onClose={() => setEditNegocio(null)} negocio={editNegocio ?? undefined} onSuccess={load} />
      <NegocioDrawer
        negocio={drawerNegocio}
        onClose={() => setDrawerNegocio(null)}
        onEdit={(n) => { setDrawerNegocio(null); setEditNegocio(n); }}
      />
    </div>
  );
}