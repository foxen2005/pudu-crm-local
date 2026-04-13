import { useState, useEffect } from 'react';
import { getCotizaciones, eliminarCotizacion, type Negocio, type Cotizacion } from '@/lib/db';
import { AdjuntosPanel } from './AdjuntosPanel';
import { CotizacionModal } from './modals/CotizacionModal';

type DrawerTab = 'adjuntos' | 'cotizaciones';

const ESTADO_STYLES: Record<Cotizacion['estado'], string> = {
  borrador:  'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
  enviada:   'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  aceptada:  'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  rechazada: 'bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400',
};

const ESTADO_LABELS: Record<Cotizacion['estado'], string> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
};

function formatCLP(n: number) {
  return 'CLP $' + Math.round(n).toLocaleString('es-CL');
}

function cotizacionTotal(cot: Cotizacion) {
  const sub = cot.items.reduce((s, i) => s + i.cantidad * i.precio_unitario * (1 - i.descuento / 100), 0);
  return cot.moneda === 'CLP' ? sub * 1.19 : sub;
}

export function NegocioDrawer({
  negocio,
  onClose,
  onEdit,
}: {
  negocio: Negocio | null;
  onClose: () => void;
  onEdit: (n: Negocio) => void;
}) {
  const [tab, setTab] = useState<DrawerTab>('adjuntos');
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [cotLoading, setCotLoading] = useState(false);
  const [cotModal, setCotModal] = useState(false);
  const [editCot, setEditCot] = useState<Cotizacion | undefined>(undefined);

  const loadCotizaciones = async (id: string) => {
    setCotLoading(true);
    setCotizaciones(await getCotizaciones(id));
    setCotLoading(false);
  };

  useEffect(() => {
    if (negocio) {
      setTab('adjuntos');
      loadCotizaciones(negocio.id);
    }
  }, [negocio?.id]);

  const handleDeleteCot = async (cot: Cotizacion) => {
    if (!window.confirm(`¿Eliminar cotización #${cot.numero} "${cot.titulo}"?`)) return;
    await eliminarCotizacion(cot.id);
    if (negocio) loadCotizaciones(negocio.id);
  };

  if (!negocio) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-[480px] max-w-full bg-white dark:bg-[#1e1a2e] shadow-2xl z-50 flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-700/50 flex-shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">{negocio.etapa}</p>
            <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 truncate">{negocio.nombre}</h2>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {negocio.empresa_nombre && (
                <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="material-symbols-outlined text-xs">business</span>
                  {negocio.empresa_nombre}
                </span>
              )}
              {negocio.valor != null && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-green-600">
                  <span className="material-symbols-outlined text-xs">attach_money</span>
                  {formatCLP(negocio.valor)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => onEdit(negocio)}
              className="size-8 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-400 hover:text-primary transition-colors"
              title="Editar negocio"
            >
              <span className="material-symbols-outlined text-lg">edit</span>
            </button>
            <button
              onClick={onClose}
              className="size-8 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center p-1 mx-5 mt-4 bg-slate-100 dark:bg-slate-800/50 rounded-xl gap-1 flex-shrink-0">
          {([
            { key: 'adjuntos', icon: 'attach_file', label: 'Adjuntos' },
            { key: 'cotizaciones', icon: 'request_quote', label: 'Cotizaciones' },
          ] as const).map(({ key, icon, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-all ${
                tab === key
                  ? 'bg-white dark:bg-[#1e1a2e] shadow-sm text-slate-900 dark:text-slate-100'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">{icon}</span>
              {label}
              {key === 'cotizaciones' && cotizaciones.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-primary/10 text-primary rounded-full text-[9px] font-black">
                  {cotizaciones.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* ── Adjuntos tab ── */}
          {tab === 'adjuntos' && (
            <AdjuntosPanel entidadTipo="negocio" entidadId={negocio.id} />
          )}

          {/* ── Cotizaciones tab ── */}
          {tab === 'cotizaciones' && (
            <div className="space-y-3">
              <button
                onClick={() => { setEditCot(undefined); setCotModal(true); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-white text-xs font-bold rounded-xl shadow-lg shadow-primary/20 hover:opacity-90 transition-all"
              >
                <span className="material-symbols-outlined text-base">add</span>
                Nueva cotización
              </button>

              {cotLoading ? (
                <div className="space-y-2">
                  {[1, 2].map(i => <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}
                </div>
              ) : cotizaciones.length === 0 ? (
                <div className="text-center py-10">
                  <span className="material-symbols-outlined text-4xl text-slate-200 dark:text-slate-700 block mb-2">request_quote</span>
                  <p className="text-sm text-slate-400">Sin cotizaciones</p>
                  <p className="text-xs text-slate-400 mt-1">Crea la primera propuesta para este negocio</p>
                </div>
              ) : (
                cotizaciones.map(cot => {
                  const total = cotizacionTotal(cot);
                  return (
                    <div
                      key={cot.id}
                      className="p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 hover:shadow-md transition-all group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-black text-slate-400">#{cot.numero}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ESTADO_STYLES[cot.estado]}`}>
                              {ESTADO_LABELS[cot.estado]}
                            </span>
                          </div>
                          <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{cot.titulo}</p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2">
                          <button
                            onClick={() => { setEditCot(cot); setCotModal(true); }}
                            className="size-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-primary transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteCot(cot)}
                            className="size-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">
                          {new Date(cot.fecha).toLocaleDateString('es-CL')} · {cot.validez_dias} días validez
                        </span>
                        <span className="font-black text-primary">{formatCLP(total)}</span>
                      </div>
                      {cot.items.length > 0 && (
                        <p className="text-[10px] text-slate-400 mt-1">
                          {cot.items.length} ítem{cot.items.length !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      <CotizacionModal
        open={cotModal}
        onClose={() => setCotModal(false)}
        negocioId={negocio.id}
        negocioNombre={negocio.nombre}
        cotizacion={editCot}
        onSuccess={() => loadCotizaciones(negocio.id)}
      />
    </>
  );
}
