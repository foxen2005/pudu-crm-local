import { useState, useEffect } from 'react';
import { getCamposDefinicion, type CampoDefinicion } from '@/lib/db';

/**
 * Renderiza dinámicamente los campos personalizados de una entidad.
 * Recibe `valores` (objeto key→value) y `onChange` para propagar cambios.
 */
export function CamposExtrasForm({
  entidadTipo,
  valores,
  onChange,
}: {
  entidadTipo: 'contacto' | 'empresa' | 'negocio';
  valores: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const [campos, setCampos] = useState<CampoDefinicion[]>([]);

  useEffect(() => {
    getCamposDefinicion(entidadTipo).then(setCampos);
  }, [entidadTipo]);

  if (campos.length === 0) return null;

  const set = (clave: string, valor: unknown) => onChange({ ...valores, [clave]: valor });

  return (
    <>
      <div className="border-t border-slate-100 dark:border-slate-700/50 pt-4 mt-1">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Campos adicionales</p>
        <div className="space-y-3">
          {campos.map(campo => (
            <div key={campo.id}>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                {campo.nombre}{campo.requerido && <span className="text-red-400 ml-1">*</span>}
              </label>

              {campo.tipo === 'texto' && (
                <input
                  type="text"
                  value={(valores[campo.clave] as string) ?? ''}
                  onChange={e => set(campo.clave, e.target.value)}
                  required={campo.requerido}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white dark:bg-[#252035] dark:border-slate-600 dark:text-slate-100"
                />
              )}
              {campo.tipo === 'numero' && (
                <input
                  type="number"
                  value={(valores[campo.clave] as string) ?? ''}
                  onChange={e => set(campo.clave, e.target.value)}
                  required={campo.requerido}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white dark:bg-[#252035] dark:border-slate-600 dark:text-slate-100"
                />
              )}
              {campo.tipo === 'fecha' && (
                <input
                  type="date"
                  value={(valores[campo.clave] as string) ?? ''}
                  onChange={e => set(campo.clave, e.target.value)}
                  required={campo.requerido}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white dark:bg-[#252035] dark:border-slate-600 dark:text-slate-100"
                />
              )}
              {campo.tipo === 'select' && (
                <select
                  value={(valores[campo.clave] as string) ?? ''}
                  onChange={e => set(campo.clave, e.target.value)}
                  required={campo.requerido}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white dark:bg-[#252035] dark:border-slate-600 dark:text-slate-100"
                >
                  <option value="">Seleccionar...</option>
                  {(campo.opciones ?? []).map(op => <option key={op}>{op}</option>)}
                </select>
              )}
              {campo.tipo === 'checkbox' && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!(valores[campo.clave])}
                    onChange={e => set(campo.clave, e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">{campo.nombre}</span>
                </label>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
