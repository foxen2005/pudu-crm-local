import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useGmail, fetchGmailBody, fetchGmailLabels, modifyGmailMessage, trashGmailMessage,
  isGoogleConnected, type GmailMessage, type GmailLabel,
} from '@/lib/useGoogleData';
import { GoogleReconnectBanner } from '@/components/GoogleReconnectBanner';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function relativeDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || '?';
}

const avatarPalette = [
  'bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700', 'bg-orange-100 text-orange-700',
  'bg-green-100 text-green-700', 'bg-pink-100 text-pink-700', 'bg-teal-100 text-teal-700',
  'bg-indigo-100 text-indigo-700', 'bg-rose-100 text-rose-700',
];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return avatarPalette[Math.abs(h) % avatarPalette.length];
}

const SYSTEM_FOLDERS: { id: string; label: string; icon: string }[] = [
  { id: 'INBOX',   label: 'Bandeja de entrada', icon: 'inbox' },
  { id: 'SENT',    label: 'Enviados',            icon: 'send' },
  { id: 'STARRED', label: 'Destacados',          icon: 'star' },
  { id: 'DRAFT',   label: 'Borradores',          icon: 'draft' },
  { id: 'TRASH',   label: 'Papelera',            icon: 'delete' },
  { id: 'SPAM',    label: 'Spam',                icon: 'report' },
];

// ─── Component ─────────────────────────────────────────────────────────────────

export default function Correo() {
  const navigate = useNavigate();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [currentLabel, setCurrentLabel] = useState('INBOX');
  const [userLabels, setUserLabels] = useState<GmailLabel[]>([]);
  const [selected, setSelected] = useState<GmailMessage | null>(null);
  const [bodyHtml, setBodyHtml] = useState<string | null>(null);
  const [bodyLoading, setBodyLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    isGoogleConnected().then(ok => {
      setConnected(ok);
      if (ok) {
        fetchGmailLabels().then(labels => {
          setUserLabels(labels.filter(l => l.type === 'user'));
        }).catch(() => {});
      }
    });
  }, []);

  useEffect(() => {
    if (!selected) { setBodyHtml(null); return; }
    setBodyLoading(true);
    setBodyHtml(null);
    fetchGmailBody(selected.id)
      .then(body => setBodyHtml(body || null))
      .catch(() => setBodyHtml(null))
      .finally(() => setBodyLoading(false));
  }, [selected?.id]);

  const { messages, loading, error, needsReconnect, fetchMore, hasMore, refetch } = useGmail(30, currentLabel);

  const filtered = messages.filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    return m.subject.toLowerCase().includes(q) || m.from.toLowerCase().includes(q) || m.snippet.toLowerCase().includes(q);
  });

  const switchLabel = (id: string) => {
    setCurrentLabel(id);
    setSelected(null);
    setSearch('');
  };

  // ── Actions ──
  const [actioning, setActioning] = useState(false);

  const markRead = useCallback(async (msg: GmailMessage) => {
    if (!msg.unread) return;
    setActioning(true);
    await modifyGmailMessage(msg.id, [], ['UNREAD']).catch(() => {});
    setActioning(false);
    refetch();
  }, [refetch]);

  const markUnread = useCallback(async (msg: GmailMessage) => {
    setActioning(true);
    await modifyGmailMessage(msg.id, ['UNREAD'], []).catch(() => {});
    setActioning(false);
    refetch();
  }, [refetch]);

  const archive = useCallback(async (msg: GmailMessage) => {
    setActioning(true);
    await modifyGmailMessage(msg.id, [], ['INBOX']).catch(() => {});
    setActioning(false);
    setSelected(null);
    refetch();
  }, [refetch]);

  const toggleStar = useCallback(async (msg: GmailMessage) => {
    const starred = msg.labelIds.includes('STARRED');
    setActioning(true);
    await modifyGmailMessage(msg.id, starred ? [] : ['STARRED'], starred ? ['STARRED'] : []).catch(() => {});
    setActioning(false);
    refetch();
  }, [refetch]);

  const moveToTrash = useCallback(async (msg: GmailMessage) => {
    if (!window.confirm('¿Mover este correo a la papelera?')) return;
    setActioning(true);
    await trashGmailMessage(msg.id).catch(() => {});
    setActioning(false);
    setSelected(null);
    refetch();
  }, [refetch]);

  // ─── Not connected ─────────────────────────────────────────────────────────
  if (connected === false) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="size-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-5 mx-auto">
          <span className="material-symbols-outlined text-4xl text-primary">mail</span>
        </div>
        <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">Correo no conectado</h2>
        <p className="text-sm text-slate-400 mb-6 max-w-xs">
          Conecta tu cuenta de Google para ver y gestionar tus correos directamente en el CRM.
        </p>
        <button onClick={() => navigate('/configuracion')}
          className="px-6 py-3 bg-primary text-white text-sm font-bold rounded-xl shadow-lg shadow-primary/20 hover:opacity-90 transition-all">
          Conectar Google en Configuración
        </button>
      </div>
    );
  }

  const currentFolderLabel = SYSTEM_FOLDERS.find(f => f.id === currentLabel)?.label
    ?? userLabels.find(l => l.id === currentLabel)?.name
    ?? currentLabel;

  return (
    <div>
      {needsReconnect && (
        <div className="mb-4">
          <GoogleReconnectBanner onReconnecting={() => {}} />
        </div>
      )}
      <div className="flex flex-col mb-6">
        <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-2">Gmail</span>
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Correo</h2>
          <button onClick={() => refetch()} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-all disabled:opacity-50">
            <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`}>refresh</span>
            Actualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[11rem_1fr_1.7fr] gap-4 h-[calc(100vh-200px)]">

        {/* ── Folder panel ── */}
        <div className="bg-white dark:bg-[#1e1a2e] rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-y-auto">
          <div className="p-3 space-y-0.5">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 pt-1 pb-2">Carpetas</p>
            {SYSTEM_FOLDERS.map(f => (
              <button key={f.id} onClick={() => switchLabel(f.id)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-xs font-medium transition-all ${
                  currentLabel === f.id
                    ? 'bg-primary/10 text-primary font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}>
                <span className="material-symbols-outlined text-base">{f.icon}</span>
                <span className="truncate">{f.label}</span>
              </button>
            ))}

            {userLabels.length > 0 && (
              <>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 pt-4 pb-2">Etiquetas</p>
                {userLabels.map(l => (
                  <button key={l.id} onClick={() => switchLabel(l.id)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-xs font-medium transition-all ${
                      currentLabel === l.id
                        ? 'bg-primary/10 text-primary font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}>
                    <span className="material-symbols-outlined text-base">label</span>
                    <span className="truncate">{l.name}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* ── Message list ── */}
        <div className="flex flex-col bg-white dark:bg-[#1e1a2e] rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
          <div className="px-3 pt-3 pb-2 border-b border-slate-100 dark:border-slate-700/50">
            <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 px-1">
              {currentFolderLabel}
            </p>
            <div className="relative">
              <span className="material-symbols-outlined text-sm text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2">search</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary dark:text-slate-200 placeholder:text-slate-400" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && messages.length === 0 ? (
              <div className="p-3 space-y-2">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="flex items-start gap-2.5 p-2">
                    <div className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded animate-pulse w-3/4" />
                      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded animate-pulse w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <span className="material-symbols-outlined text-2xl text-red-400 block mb-1">error</span>
                <p className="text-xs text-slate-500 mb-2">
                  {error === 'NO_TOKEN' || error === 'UNAUTHORIZED' ? 'Sesión expirada' : 'Error al cargar'}
                </p>
                {(error === 'NO_TOKEN' || error === 'UNAUTHORIZED') && (
                  <button onClick={() => navigate('/configuracion')} className="text-xs text-primary font-bold hover:underline">
                    Reconectar Google
                  </button>
                )}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <span className="material-symbols-outlined text-2xl text-slate-300 dark:text-slate-600 block mb-1">inbox</span>
                <p className="text-xs text-slate-400">{search ? 'Sin resultados' : 'Sin mensajes'}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-slate-700/30">
                {filtered.map(msg => {
                  const isSelected = selected?.id === msg.id;
                  const starred = msg.labelIds.includes('STARRED');
                  return (
                    <button key={msg.id} onClick={() => { setSelected(isSelected ? null : msg); if (!msg.unread) return; markRead(msg); }}
                      className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/20 group ${isSelected ? 'bg-primary/5 dark:bg-primary/10' : ''}`}>
                      <div className={`size-8 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5 ${avatarColor(msg.from)}`}>
                        {initials(msg.from)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <p className={`text-xs truncate ${msg.unread ? 'font-black text-slate-900 dark:text-slate-100' : 'font-medium text-slate-600 dark:text-slate-300'}`}>
                            {msg.from}
                          </p>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {starred && <span className="material-symbols-outlined text-xs text-yellow-400">star</span>}
                            <span className="text-[10px] text-slate-400">{relativeDate(msg.date)}</span>
                            {msg.unread && <div className="size-1.5 rounded-full bg-primary" />}
                          </div>
                        </div>
                        <p className={`text-[11px] truncate ${msg.unread ? 'font-bold text-slate-800 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'}`}>
                          {msg.subject}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">{msg.snippet}</p>
                      </div>
                    </button>
                  );
                })}
                {hasMore && (
                  <div className="p-3 text-center">
                    <button onClick={fetchMore} disabled={loading} className="text-xs text-primary font-bold hover:underline disabled:opacity-50">
                      {loading ? 'Cargando...' : 'Cargar más'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Message detail ── */}
        <div className="bg-white dark:bg-[#1e1a2e] rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden flex flex-col">
          {selected ? (
            <>
              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700/50">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 leading-tight">{selected.subject}</h3>
                  <button onClick={() => setSelected(null)} className="size-6 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 flex-shrink-0 transition-colors">
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                </div>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className={`size-9 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${avatarColor(selected.from)}`}>
                    {initials(selected.from)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{selected.from}</p>
                    <p className="text-[10px] text-slate-400">{selected.fromEmail}</p>
                  </div>
                  <p className="text-[10px] text-slate-400 flex-shrink-0">
                    {new Date(selected.date).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                {/* Action bar */}
                <div className="flex items-center gap-1 flex-wrap">
                  <button onClick={() => selected.unread ? markRead(selected) : markUnread(selected)} disabled={actioning} title={selected.unread ? 'Marcar como leído' : 'Marcar como no leído'}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50">
                    <span className="material-symbols-outlined text-sm">{selected.unread ? 'mark_email_read' : 'mark_email_unread'}</span>
                    {selected.unread ? 'Leído' : 'No leído'}
                  </button>
                  <button onClick={() => toggleStar(selected)} disabled={actioning} title={selected.labelIds.includes('STARRED') ? 'Quitar estrella' : 'Destacar'}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg border transition-colors disabled:opacity-50 ${
                      selected.labelIds.includes('STARRED')
                        ? 'border-yellow-200 text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}>
                    <span className="material-symbols-outlined text-sm">{selected.labelIds.includes('STARRED') ? 'star' : 'star_outline'}</span>
                    {selected.labelIds.includes('STARRED') ? 'Destacado' : 'Destacar'}
                  </button>
                  {currentLabel === 'INBOX' && (
                    <button onClick={() => archive(selected)} disabled={actioning} title="Archivar"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50">
                      <span className="material-symbols-outlined text-sm">archive</span>
                      Archivar
                    </button>
                  )}
                  <button onClick={() => moveToTrash(selected)} disabled={actioning} title="Eliminar"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg border border-red-100 dark:border-red-900/50 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50">
                    <span className="material-symbols-outlined text-sm">delete</span>
                    Eliminar
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5">
                {bodyLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : bodyHtml ? (
                  <iframe srcDoc={bodyHtml} className="w-full min-h-[400px] border-0 rounded-xl bg-white"
                    sandbox="allow-same-origin" title="Email content"
                    onLoad={e => {
                      const iframe = e.target as HTMLIFrameElement;
                      if (iframe.contentDocument?.body)
                        iframe.style.height = iframe.contentDocument.body.scrollHeight + 32 + 'px';
                    }} />
                ) : (
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{selected.snippet}</p>
                )}
              </div>

              {/* Reply bar */}
              <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700/50 flex gap-2">
                <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-md shadow-primary/20 hover:opacity-90 transition-all">
                  <span className="material-symbols-outlined text-sm">reply</span>
                  Responder
                </button>
                <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <span className="material-symbols-outlined text-sm">forward</span>
                  Reenviar
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="size-16 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600">mark_email_read</span>
              </div>
              <p className="text-sm font-bold text-slate-400 dark:text-slate-500">Selecciona un correo</p>
              <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">para ver su contenido aquí</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
