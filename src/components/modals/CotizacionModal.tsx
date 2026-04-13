import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { crearCotizacion, actualizarCotizacion, type Cotizacion, type CotizacionItem } from '@/lib/db';

const inputClass =
  'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white dark:bg-[#252035] dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500';
const labelClass = 'block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1';

type ItemRow = {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  descuento: number;
};

const emptyItem = (): ItemRow => ({ descripcion: '', cantidad: 1, precio_unitario: 0, descuento: 0 });

const ESTADOS = [
  { value: 'borrador', label: 'Borrador', color: 'text-slate-500' },
  { value: 'enviada',  label: 'Enviada',  color: 'text-blue-600' },
  { value: 'aceptada', label: 'Aceptada', color: 'text-green-600' },
  { value: 'rechazada',label: 'Rechazada',color: 'text-red-500' },
] as const;

function formatCLP(n: number) {
  return 'CLP $' + Math.round(n).toLocaleString('es-CL');
}

function itemTotal(item: ItemRow) {
  return item.cantidad * item.precio_unitario * (1 - item.descuento / 100);
}

export function CotizacionModal({
  open,
  onClose,
  negocioId,
  negocioNombre,
  cotizacion,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  negocioId: string;
  negocioNombre: string;
  cotizacion?: Cotizacion;
  onSuccess: () => void;
}) {
  const isEdit = !!cotizacion;

  const [titulo, setTitulo] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [validez, setValidez] = useState(30);
  const [moneda, setMoneda] = useState('CLP');
  const [notas, setNotas] = useState('');
  const [estado, setEstado] = useState<Cotizacion['estado']>('borrador');
  const [items, setItems] = useState<ItemRow[]>([emptyItem()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (cotizacion) {
        setTitulo(cotizacion.titulo);
        setFecha(cotizacion.fecha);
        setValidez(cotizacion.validez_dias);
        setMoneda(cotizacion.moneda);
        setNotas(cotizacion.notas ?? '');
        setEstado(cotizacion.estado);
        setItems(
          cotizacion.items.length > 0
            ? cotizacion.items.map(i => ({
                descripcion: i.descripcion,
                cantidad: i.cantidad,
                precio_unitario: i.precio_unitario,
                descuento: i.descuento,
              }))
            : [emptyItem()]
        );
      } else {
        setTitulo(`Cotización — ${negocioNombre}`);
        setFecha(new Date().toISOString().slice(0, 10));
        setValidez(30);
        setMoneda('CLP');
        setNotas('');
        setEstado('borrador');
        setItems([emptyItem()]);
      }
      setError(null);
    }
  }, [open, cotizacion, negocioNombre]);

  const setItem = (idx: number, field: keyof ItemRow, value: string | number) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const addItem = () => setItems(prev => [...prev, emptyItem()]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const subtotal = items.reduce((s, it) => s + itemTotal(it), 0);
  const iva = moneda === 'CLP' ? subtotal * 0.19 : 0;
  const total = subtotal + iva;

  const handleSave = async () => {
    if (!titulo.trim()) { setError('El título es obligatorio'); return; }
    const validItems = items.filter(i => i.descripcion.trim());
    setLoading(true);
    setError(null);
    const fields = { titulo: titulo.trim(), fecha, validez_dias: validez, moneda, notas: notas.trim() || null, estado };
    let ok: boolean;
    if (isEdit) {
      ok = await actualizarCotizacion(cotizacion!.id, fields, validItems);
    } else {
      const result = await crearCotizacion(negocioId, fields, validItems);
      ok = !!result;
    }
    setLoading(false);
    if (!ok) { setError('Error al guardar la cotización'); return; }
    onSuccess();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Editar cotización #${cotizacion?.numero}` : 'Nueva cotización'}
      size="lg"
    >
      <div className="px-6 py-5 space-y-5 max-h-[75vh] overflow-y-auto">

        {/* Cabecera */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={labelClass}>Título *</label>
            <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} className={inputClass} placeholder="Ej: Propuesta desarrollo web" />
          </div>
          <div>
            <label className={labelClass}>Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Validez (días)</label>
            <input type="number" value={validez} min={1} onChange={e => setValidez(Number(e.target.value))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Moneda</label>
            <select value={moneda} onChange={e => setMoneda(e.target.value)} className={inputClass}>
              <option value="CLP">CLP — Peso chileno</option>
              <option value="USD">USD — Dólar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="UF">UF</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Estado</label>
            <select value={estado} onChange={e => setEstado(e.target.value as Cotizacion['estado'])} className={inputClass}>
              {ESTADOS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Ítems */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={labelClass + ' mb-0'}>Ítems</label>
            <button
              onClick={addItem}
              className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Agregar línea
            </button>
          </div>

          {/* Header */}
          <div className="grid grid-cols-[1fr_80px_110px_80px_90px_28px] gap-2 mb-1 px-1">
            {['Descripción', 'Cantidad', 'Precio unit.', 'Desc. %', 'Total', ''].map(h => (
              <span key={h} className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{h}</span>
            ))}
          </div>

          <div className="space-y-2">
            {items.map((item, idx) => {
              const tot = itemTotal(item);
              return (
                <div key={idx} className="grid grid-cols-[1fr_80px_110px_80px_90px_28px] gap-2 items-center">
                  <input
                    type="text"
                    value={item.descripcion}
                    onChange={e => setItem(idx, 'descripcion', e.target.value)}
                    placeholder="Descripción del ítem"
                    className={inputClass + ' text-xs'}
                  />
                  <input
                    type="number"
                    value={item.cantidad}
                    min={0}
                    step="0.01"
                    onChange={e => setItem(idx, 'cantidad', Number(e.target.value))}
                    className={inputClass + ' text-xs text-right'}
                  />
                  <input
                    type="number"
                    value={item.precio_unitario}
                    min={0}
                    step="1"
                    onChange={e => setItem(idx, 'precio_unitario', Number(e.target.value))}
                    className={inputClass + ' text-xs text-right'}
                  />
                  <input
                    type="number"
                    value={item.descuento}
                    min={0}
                    max={100}
                    step="1"
                    onChange={e => setItem(idx, 'descuento', Number(e.target.value))}
                    className={inputClass + ' text-xs text-right'}
                  />
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200 text-right tabular-nums">
                    {tot.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                  </div>
                  <button
                    onClick={() => removeItem(idx)}
                    disabled={items.length === 1}
                    className="size-7 flex items-center justify-center rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors disabled:opacity-20"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Totales */}
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50 space-y-1.5">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Subtotal</span>
              <span className="font-bold text-slate-700 dark:text-slate-200 tabular-nums">{formatCLP(subtotal)}</span>
            </div>
            {moneda === 'CLP' && (
              <div className="flex justify-between text-xs text-slate-500">
                <span>IVA (19%)</span>
                <span className="tabular-nums">{formatCLP(iva)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-black text-slate-900 dark:text-slate-100 pt-1">
              <span>Total {moneda}</span>
              <span className="tabular-nums text-primary">{formatCLP(total)}</span>
            </div>
          </div>
        </div>

        {/* Notas */}
        <div>
          <label className={labelClass}>Notas / condiciones (opcional)</label>
          <textarea
            value={notas}
            onChange={e => setNotas(e.target.value)}
            rows={2}
            placeholder="Forma de pago, condiciones especiales, etc."
            className={inputClass + ' resize-none'}
          />
        </div>

        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium">{error}</div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-700/50">
        <button
          onClick={onClose}
          className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={loading || !titulo.trim()}
          className="flex items-center gap-2 px-5 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-40"
        >
          {loading
            ? <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
            : <span className="material-symbols-outlined text-sm">save</span>}
          {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear cotización'}
        </button>
      </div>
    </Modal>
  );
}
