import { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { getOrgIdPublic } from '@/lib/db';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ImportTipo = 'contacto' | 'empresa';

type RowStatus = 'valid' | 'error';
type ParsedRow = {
  index: number;
  data: Record<string, string>;
  status: RowStatus;
  errors: string[];
};

// ─── CSV parser ───────────────────────────────────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const splitRow = (line: string): string[] => {
    const result: string[] = [];
    let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = splitRow(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
  const rows = lines.slice(1).map(line => {
    const vals = splitRow(line);
    return headers.reduce((obj, h, i) => { obj[h] = vals[i] ?? ''; return obj; }, {} as Record<string, string>);
  });
  return { headers, rows };
}

// ─── Validation ───────────────────────────────────────────────────────────────

const ESTADOS_VALIDOS = ['Prospecto', 'Cliente Activo', 'VIP', 'Inactivo'];
const TAMANOS_VALIDOS = ['1-10', '11-50', '51-200', '201-1000', '1000+'];

function validateContacto(row: Record<string, string>): string[] {
  const errs: string[] = [];
  if (!row.nombre?.trim()) errs.push('nombre es obligatorio');
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) errs.push('email inválido');
  if (row.estado && !ESTADOS_VALIDOS.includes(row.estado)) errs.push(`estado debe ser: ${ESTADOS_VALIDOS.join(', ')}`);
  return errs;
}

function validateEmpresa(row: Record<string, string>): string[] {
  const errs: string[] = [];
  if (!row.razon_social?.trim()) errs.push('razon_social es obligatorio');
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) errs.push('email inválido');
  if (row.tamano && !TAMANOS_VALIDOS.includes(row.tamano)) errs.push(`tamaño debe ser: ${TAMANOS_VALIDOS.join(', ')}`);
  return errs;
}

// ─── CSV Templates ────────────────────────────────────────────────────────────

const TEMPLATES: Record<ImportTipo, { headers: string[]; example: string[] }> = {
  contacto: {
    headers: ['nombre', 'apellido', 'email', 'telefono', 'empresa', 'cargo', 'estado'],
    example:  ['Juan', 'Pérez', 'juan@empresa.cl', '+56912345678', 'ACME SpA', 'Gerente General', 'Prospecto'],
  },
  empresa: {
    headers: ['razon_social', 'rut', 'giro', 'region', 'ciudad', 'direccion', 'telefono', 'email', 'tamano'],
    example:  ['ACME SpA', '76.123.456-7', 'Tecnología', 'Metropolitana', 'Santiago', 'Av. Providencia 123', '+56222345678', 'contacto@acme.cl', '11-50'],
  },
};

function downloadTemplate(tipo: ImportTipo) {
  const t = TEMPLATES[tipo];
  const csv = [t.headers.join(','), t.example.join(',')].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `plantilla_${tipo}s.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Batch import ─────────────────────────────────────────────────────────────

async function importarContactos(rows: Record<string, string>[], orgId: string): Promise<{ ok: number; errors: number }> {
  const inserts = rows.map(r => ({
    org_id: orgId,
    nombre: r.nombre.trim(),
    apellido: r.apellido?.trim() || null,
    email: r.email?.trim() || null,
    telefono: r.telefono?.trim() || null,
    empresa_nombre: r.empresa?.trim() || null,
    cargo: r.cargo?.trim() || null,
    estado: ESTADOS_VALIDOS.includes(r.estado) ? r.estado : 'Prospecto',
  }));

  let ok = 0, errors = 0;
  // Batch in chunks of 50
  for (let i = 0; i < inserts.length; i += 50) {
    const { error } = await supabase.from('contactos').insert(inserts.slice(i, i + 50));
    if (error) errors += Math.min(50, inserts.length - i);
    else ok += Math.min(50, inserts.length - i);
  }
  return { ok, errors };
}

async function importarEmpresas(rows: Record<string, string>[], orgId: string): Promise<{ ok: number; errors: number }> {
  const inserts = rows.map(r => ({
    org_id: orgId,
    razon_social: r.razon_social.trim(),
    rut: r.rut?.trim() || null,
    giro: r.giro?.trim() || null,
    region: r.region?.trim() || null,
    ciudad: r.ciudad?.trim() || null,
    direccion: r.direccion?.trim() || null,
    telefono: r.telefono?.trim() || null,
    email: r.email?.trim() || null,
    tamano: TAMANOS_VALIDOS.includes(r.tamano) ? r.tamano : null,
  }));

  let ok = 0, errors = 0;
  for (let i = 0; i < inserts.length; i += 50) {
    const { error } = await supabase.from('empresas').insert(inserts.slice(i, i + 50));
    if (error) errors += Math.min(50, inserts.length - i);
    else ok += Math.min(50, inserts.length - i);
  }
  return { ok, errors };
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function Steps({ current }: { current: number }) {
  const steps = ['Subir archivo', 'Vista previa', 'Resultado'];
  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center flex-1">
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <div className={cn(
              'size-7 rounded-full flex items-center justify-center text-[11px] font-black transition-all',
              i < current  ? 'bg-primary text-white' :
              i === current ? 'bg-primary text-white ring-4 ring-primary/20' :
                              'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500',
            )}>
              {i < current
                ? <span className="material-symbols-outlined text-[13px]">check</span>
                : i + 1}
            </div>
            <span className={cn(
              'text-[9px] font-bold uppercase tracking-widest whitespace-nowrap',
              i === current ? 'text-primary' : 'text-slate-400 dark:text-slate-500',
            )}>{label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={cn('flex-1 h-px mx-2 mb-4 transition-all', i < current ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700')} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ImportarCSVModal({
  open, onClose, tipo, onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  tipo: ImportTipo;
  onSuccess?: () => void;
}) {
  const [step, setStep]         = useState(0);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [rows, setRows]         = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [result, setResult]       = useState<{ ok: number; errors: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const titulo = tipo === 'contacto' ? 'Importar Contactos' : 'Importar Empresas';
  const icon   = tipo === 'contacto' ? 'contacts' : 'domain';
  const validate = tipo === 'contacto' ? validateContacto : validateEmpresa;

  const reset = () => {
    setStep(0); setFileName(''); setRows([]); setResult(null); setProgress(0);
  };

  const handleClose = () => { reset(); onClose(); };

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { rows: rawRows } = parseCSV(text);
      const parsed: ParsedRow[] = rawRows.map((data, index) => {
        const errors = validate(data);
        return { index: index + 1, data, status: errors.length ? 'error' : 'valid', errors };
      });
      setRows(parsed);
      setStep(1);
    };
    reader.readAsText(file, 'UTF-8');
  }, [validate]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleImport = async () => {
    const validRows = rows.filter(r => r.status === 'valid').map(r => r.data);
    if (!validRows.length) return;

    setImporting(true);
    setStep(2);

    // Fake progress animation
    let p = 0;
    const interval = setInterval(() => {
      p = Math.min(p + 8, 85);
      setProgress(p);
    }, 120);

    const orgId = await getOrgIdPublic();
    let res = { ok: 0, errors: 0 };
    if (orgId) {
      res = tipo === 'contacto'
        ? await importarContactos(validRows, orgId)
        : await importarEmpresas(validRows, orgId);
    }

    clearInterval(interval);
    setProgress(100);
    setResult(res);
    setImporting(false);
    if (res.ok > 0) onSuccess?.();
  };

  const validCount   = rows.filter(r => r.status === 'valid').length;
  const errorCount   = rows.filter(r => r.status === 'error').length;
  const templateCols = TEMPLATES[tipo].headers;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-3xl bg-white dark:bg-[#1e1a2e] rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700/50 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-9 bg-primary/10 dark:bg-primary/20 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-lg">{icon}</span>
            </div>
            <h2 className="text-base font-black text-slate-900 dark:text-slate-100">{titulo}</h2>
          </div>
          <button onClick={handleClose} className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition-colors">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <Steps current={step} />

          {/* ── Step 0: Upload ── */}
          {step === 0 && (
            <div className="space-y-4">
              {/* Drop zone */}
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={cn(
                  'border-2 border-dashed rounded-2xl p-12 flex flex-col items-center gap-3 cursor-pointer transition-all',
                  dragging
                    ? 'border-primary bg-primary/5 dark:bg-primary/10'
                    : 'border-slate-200 dark:border-slate-700 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-[#252035]',
                )}
              >
                <div className={cn('size-14 rounded-2xl flex items-center justify-center transition-all', dragging ? 'bg-primary/15' : 'bg-slate-100 dark:bg-slate-800')}>
                  <span className={cn('material-symbols-outlined text-3xl transition-all', dragging ? 'text-primary' : 'text-slate-400')}>
                    upload_file
                  </span>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {dragging ? 'Suelta el archivo aquí' : 'Arrastra tu CSV o haz click para seleccionar'}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Solo archivos .csv · Codificación UTF-8</p>
                </div>
              </div>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileInput} />

              {/* Template download */}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-[#252035] rounded-xl border border-slate-200/60 dark:border-slate-700/50">
                <div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">¿No tienes el formato correcto?</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Columnas: {templateCols.join(', ')}
                  </p>
                </div>
                <button
                  onClick={() => downloadTemplate(tipo)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#1e1a2e] border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-primary/40 hover:text-primary transition-all"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  Plantilla CSV
                </button>
              </div>
            </div>
          )}

          {/* ── Step 1: Preview ── */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Summary bar */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300">
                  <span className="material-symbols-outlined text-sm">table_rows</span>
                  {rows.length} filas
                </span>
                {validCount > 0 && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 dark:bg-green-950/40 rounded-lg text-xs font-bold text-green-700 dark:text-green-400">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    {validCount} válidas
                  </span>
                )}
                {errorCount > 0 && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-950/40 rounded-lg text-xs font-bold text-red-600 dark:text-red-400">
                    <span className="material-symbols-outlined text-sm">error</span>
                    {errorCount} con error
                  </span>
                )}
                <button
                  onClick={() => { reset(); }}
                  className="ml-auto text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">restart_alt</span>
                  Cambiar archivo
                </button>
              </div>

              {/* Table */}
              <div className="border border-slate-200 dark:border-slate-700/50 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-[#13111a]">
                      <tr>
                        <th className="px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-10">#</th>
                        {templateCols.map(col => (
                          <th key={col} className="px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{col}</th>
                        ))}
                        <th className="px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700/30">
                      {rows.map(row => (
                        <tr key={row.index} className={cn(
                          'transition-colors',
                          row.status === 'error'
                            ? 'bg-red-50/60 dark:bg-red-950/20'
                            : 'hover:bg-slate-50/60 dark:hover:bg-[#252035]/60',
                        )}>
                          <td className="px-3 py-2 text-slate-400 font-mono">{row.index}</td>
                          {templateCols.map(col => (
                            <td key={col} className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-[140px] truncate">
                              {row.data[col] || <span className="text-slate-300 dark:text-slate-600 italic">—</span>}
                            </td>
                          ))}
                          <td className="px-3 py-2">
                            {row.status === 'valid'
                              ? <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 text-[10px] font-bold"><span className="material-symbols-outlined text-[12px]">check_circle</span>OK</span>
                              : <span title={row.errors.join(', ')} className="inline-flex items-center gap-1 text-red-500 text-[10px] font-bold cursor-help"><span className="material-symbols-outlined text-[12px]">error</span>{row.errors[0]}</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {errorCount > 0 && validCount === 0 && (
                <p className="text-xs text-red-500 dark:text-red-400 text-center">Todas las filas tienen errores. Corrige el archivo antes de continuar.</p>
              )}
              {errorCount > 0 && validCount > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 text-center">Las {errorCount} filas con error serán omitidas. Se importarán las {validCount} válidas.</p>
              )}
            </div>
          )}

          {/* ── Step 2: Result ── */}
          {step === 2 && (
            <div className="flex flex-col items-center justify-center py-8 gap-6">
              {importing ? (
                <>
                  <div className="size-16 bg-primary/10 dark:bg-primary/20 rounded-2xl flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-3xl animate-spin">progress_activity</span>
                  </div>
                  <div className="w-full max-w-sm space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>Importando registros...</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </>
              ) : result && (
                <>
                  <div className={cn(
                    'size-20 rounded-3xl flex items-center justify-center',
                    result.ok > 0 ? 'bg-green-100 dark:bg-green-950/40' : 'bg-red-100 dark:bg-red-950/40',
                  )}>
                    <span className={cn('material-symbols-outlined text-4xl', result.ok > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500')}>
                      {result.ok > 0 ? 'task_alt' : 'error'}
                    </span>
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-lg font-black text-slate-800 dark:text-slate-100">
                      {result.ok > 0 ? '¡Importación completada!' : 'Error al importar'}
                    </p>
                    {result.ok > 0 && (
                      <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                        {result.ok} {tipo === 'contacto' ? 'contacto' : 'empresa'}{result.ok > 1 ? 's' : ''} importado{result.ok > 1 ? 's' : ''} correctamente
                      </p>
                    )}
                    {result.errors > 0 && (
                      <p className="text-sm text-red-500 font-medium">
                        {result.errors} fila{result.errors > 1 ? 's' : ''} no se {result.errors > 1 ? 'pudieron importar' : 'pudo importar'}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-700/50 flex-shrink-0">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all"
          >
            {step === 2 && !importing ? 'Cerrar' : 'Cancelar'}
          </button>

          <div className="flex items-center gap-2">
            {step === 1 && (
              <button
                onClick={() => setStep(0)}
                className="px-4 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                ← Atrás
              </button>
            )}
            {step === 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic">Sube un CSV para continuar</p>
            )}
            {step === 1 && (
              <button
                onClick={handleImport}
                disabled={validCount === 0}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-sm">upload</span>
                Importar {validCount} {tipo === 'contacto' ? 'contacto' : 'empresa'}{validCount !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
