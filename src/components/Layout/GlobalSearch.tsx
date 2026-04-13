import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { busquedaGlobal, type SearchResult } from '@/lib/db';
import { cn } from '@/lib/utils';

const TYPE_CONFIG: Record<SearchResult['type'], { icon: string; label: string; color: string; bg: string }> = {
  contacto:  { icon: 'person',     label: 'Contactos',   color: 'text-blue-500',   bg: 'bg-blue-100 dark:bg-blue-950/60' },
  empresa:   { icon: 'domain',     label: 'Empresas',    color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-950/60' },
  negocio:   { icon: 'handshake',  label: 'Negocios',    color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-950/60' },
  actividad: { icon: 'event_note', label: 'Actividades', color: 'text-green-500',  bg: 'bg-green-100 dark:bg-green-950/60' },
};

const TYPE_ORDER: SearchResult['type'][] = ['contacto', 'empresa', 'negocio', 'actividad'];

export function GlobalSearch() {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen]       = useState(false);
  const [selected, setSelected] = useState(-1);
  const inputRef   = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const navigate   = useNavigate();

  const runSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    const res = await busquedaGlobal(q);
    setResults(res);
    setOpen(true);
    setLoading(false);
    setSelected(-1);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(val), 280);
  };

  const handleSelect = (result: SearchResult) => {
    navigate(result.href);
    setQuery('');
    setOpen(false);
    setResults([]);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); setQuery(''); inputRef.current?.blur(); return; }
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === 'Enter' && selected >= 0) handleSelect(results[selected]);
  };

  // Ctrl/Cmd+F opens search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const noResults = open && query.length >= 2 && results.length === 0 && !loading;

  return (
    <div className="relative flex-1 max-w-sm">
      {/* Input */}
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-[18px] pointer-events-none">
          search
        </span>
        <input
          ref={inputRef}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (query.length >= 2 && results.length > 0) setOpen(true); }}
          placeholder="Buscar... (⌘F)"
          className="w-full pl-9 pr-8 py-1.5 text-sm bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary/30 focus:bg-white dark:focus:bg-[#1e1a2e] rounded-xl outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-800 dark:text-slate-100"
        />
        {loading && (
          <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[16px] animate-spin">
            progress_activity
          </span>
        )}
        {!loading && query && (
          <button
            onClick={() => { setQuery(''); setOpen(false); setResults([]); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        )}
      </div>

      {/* Dropdown */}
      {(open && results.length > 0) && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-2 left-0 right-0 z-50 bg-white dark:bg-[#1e1a2e] border border-slate-200/60 dark:border-slate-700/50 rounded-2xl shadow-2xl shadow-black/10 overflow-hidden min-w-[360px]">
            {TYPE_ORDER.map(type => {
              const group = results.filter(r => r.type === type);
              if (group.length === 0) return null;
              const cfg = TYPE_CONFIG[type];
              return (
                <div key={type}>
                  <div className="px-4 pt-3 pb-1 flex items-center gap-1.5">
                    <span className={cn('material-symbols-outlined text-[13px]', cfg.color)}>{cfg.icon}</span>
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{cfg.label}</span>
                  </div>
                  {group.map(r => {
                    const idx = results.indexOf(r);
                    return (
                      <button
                        key={r.id}
                        onClick={() => handleSelect(r)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-2 text-left transition-colors',
                          selected === idx
                            ? 'bg-primary/10 dark:bg-primary/20'
                            : 'hover:bg-slate-50 dark:hover:bg-[#252035]',
                        )}
                      >
                        <div className={cn('size-7 rounded-lg flex items-center justify-center flex-shrink-0', cfg.bg)}>
                          <span className={cn('material-symbols-outlined text-[14px]', cfg.color)}>{cfg.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{r.titulo}</p>
                          {r.subtitulo && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{r.subtitulo}</p>
                          )}
                        </div>
                        <span className="material-symbols-outlined text-[14px] text-slate-300 dark:text-slate-600 flex-shrink-0">
                          chevron_right
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {/* Footer hints */}
            <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700/50 flex items-center gap-4">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                <kbd className="font-mono bg-slate-100 dark:bg-slate-700 px-1 rounded text-[9px]">↑↓</kbd> navegar
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                <kbd className="font-mono bg-slate-100 dark:bg-slate-700 px-1 rounded text-[9px]">↵</kbd> abrir
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                <kbd className="font-mono bg-slate-100 dark:bg-slate-700 px-1 rounded text-[9px]">Esc</kbd> cerrar
              </span>
            </div>
          </div>
        </>
      )}

      {/* No results */}
      {noResults && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-2 left-0 right-0 z-50 bg-white dark:bg-[#1e1a2e] border border-slate-200/60 dark:border-slate-700/50 rounded-2xl shadow-2xl p-6 text-center min-w-[360px]">
            <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600">search_off</span>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">Sin resultados para <strong>"{query}"</strong></p>
          </div>
        </>
      )}
    </div>
  );
}
