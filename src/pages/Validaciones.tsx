import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getUnmatchedWaConversations,
  getUnmatchedGmailSenders,
  type UnmatchedWaConversation,
  type UnmatchedGmailSender,
} from '@/lib/matching';
import { isGoogleConnected } from '@/lib/useGoogleData';
import { supabase } from '@/lib/supabase';
import { NuevoContactoModal } from '@/components/modals/NuevoContactoModal';
import { useAuth } from '@/lib/auth';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

function avatarColor(text: string): string {
  const colors = ['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-orange-500', 'bg-rose-500', 'bg-teal-500'];
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) & 0xffff;
  return colors[hash % colors.length];
}

// ─── Assign WA conversation to existing contact ───────────────────────────────

async function linkWaToContact(conversationId: string, contactId: string, orgId: string): Promise<void> {
  await supabase
    .from('whatsapp_conversations')
    .update({ contact_id: contactId })
    .eq('id', conversationId)
    .eq('org_id', orgId);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'whatsapp' | 'gmail';

export default function Validaciones() {
  const navigate = useNavigate();
  const { member } = useAuth();
  const [tab, setTab] = useState<Tab>('whatsapp');
  const [waData, setWaData] = useState<UnmatchedWaConversation[]>([]);
  const [gmailData, setGmailData] = useState<UnmatchedGmailSender[]>([]);
  const [loadingWa, setLoadingWa] = useState(false);
  const [loadingGmail, setLoadingGmail] = useState(false);
  const [googleActive, setGoogleActive] = useState(false);
  const [nuevoContactoOpen, setNuevoContactoOpen] = useState(false);
  const [prefill, setPrefill] = useState<Record<string, string>>({});
  const [pendingLink, setPendingLink] = useState<{ type: 'wa'; convId: string } | null>(null);
  const [linkingConvId, setLinkingConvId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchWa = useCallback(async () => {
    setLoadingWa(true);
    try {
      const data = await getUnmatchedWaConversations();
      setWaData(data);
    } finally {
      setLoadingWa(false);
    }
  }, []);

  const fetchGmail = useCallback(async () => {
    setLoadingGmail(true);
    try {
      const data = await getUnmatchedGmailSenders();
      setGmailData(data);
    } finally {
      setLoadingGmail(false);
    }
  }, []);

  useEffect(() => {
    isGoogleConnected().then(setGoogleActive);
    fetchWa();
  }, [fetchWa]);

  useEffect(() => {
    if (tab === 'gmail' && googleActive) fetchGmail();
  }, [tab, googleActive, fetchGmail]);

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  }

  // Called after NuevoContactoModal creates the contact
  const handleContactCreated = useCallback(async () => {
    setNuevoContactoOpen(false);
    if (pendingLink?.type === 'wa') {
      // Try to find the newly created contact by phone
      // (just reload the list to show it's gone)
      fetchWa();
      showSuccess('Contacto creado y conversación vinculada');
    } else {
      fetchWa();
      fetchGmail();
      showSuccess('Contacto creado');
    }
    setPendingLink(null);
    setPrefill({});
  }, [pendingLink, fetchWa, fetchGmail]);

  async function handleLinkToExisting(convId: string, contactId: string, contactName: string) {
    setLinkingConvId(convId);
    try {
      await linkWaToContact(convId, contactId, member?.orgId ?? '');
      setWaData(prev => prev.filter(c => c.id !== convId));
      showSuccess(`Vinculado a ${contactName}`);
    } finally {
      setLinkingConvId(null);
    }
  }

  function openCreateFromWa(conv: UnmatchedWaConversation) {
    const parts = (conv.contact_nombre ?? '').split(' ');
    setPrefill({
      nombre: parts[0] ?? '',
      apellido: parts.slice(1).join(' '),
      telefono: conv.contact_phone,
    });
    setPendingLink({ type: 'wa', convId: conv.id });
    setNuevoContactoOpen(true);
  }

  function openCreateFromGmail(sender: UnmatchedGmailSender) {
    const parts = sender.name.split(' ');
    setPrefill({
      nombre: parts[0] ?? sender.name,
      apellido: parts.slice(1).join(' '),
      email: sender.email,
    });
    setNuevoContactoOpen(true);
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-500">rule</span>
          Actividad no identificada
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Mensajes y correos de personas que no están en tus contactos
        </p>
      </div>

      {/* Success toast */}
      {successMsg && (
        <div className="fixed top-5 right-5 bg-green-600 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50 flex items-center gap-2">
          <span className="material-symbols-outlined text-base">check_circle</span>
          {successMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 w-fit mb-6">
        {(['whatsapp', 'gmail'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              tab === t
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
            }`}
          >
            {t === 'whatsapp' ? (
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">chat</span>
                WhatsApp
                {waData.length > 0 && (
                  <span className="bg-amber-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {waData.length > 9 ? '9+' : waData.length}
                  </span>
                )}
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">mail</span>
                Gmail
                {gmailData.length > 0 && (
                  <span className="bg-amber-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {gmailData.length > 9 ? '9+' : gmailData.length}
                  </span>
                )}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── WhatsApp Tab ── */}
      {tab === 'whatsapp' && (
        <div>
          {loadingWa ? (
            <LoadingState label="Cargando conversaciones..." />
          ) : waData.length === 0 ? (
            <EmptyState icon="check_circle" title="Todo identificado" desc="No hay conversaciones de WhatsApp sin contacto asociado." />
          ) : (
            <div className="space-y-3">
              {waData.map(conv => (
                <div key={conv.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className={`size-10 rounded-full ${avatarColor(conv.contact_phone)} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                      {(conv.contact_nombre ?? conv.contact_phone).charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white text-sm">
                            {conv.contact_nombre ?? 'Desconocido'}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{conv.contact_phone}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="text-xs text-slate-400">{timeAgo(conv.last_message_at)}</span>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {conv.message_count} mensaje{conv.message_count !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>

                      {/* Suggestions */}
                      {conv.suggestions.length > 0 && (
                        <div className="mt-3 p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/40">
                          <p className="text-xs text-blue-700 dark:text-blue-400 font-medium mb-2 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">person_search</span>
                            Posible coincidencia en CRM:
                          </p>
                          <div className="flex flex-col gap-1.5">
                            {conv.suggestions.map(s => (
                              <button
                                key={s.id}
                                disabled={linkingConvId === conv.id}
                                onClick={() => handleLinkToExisting(conv.id, s.id, `${s.nombre} ${s.apellido ?? ''}`)}
                                className="flex items-center justify-between w-full text-left px-2.5 py-1.5 bg-white dark:bg-slate-700 rounded-md hover:bg-blue-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 transition-colors disabled:opacity-50"
                              >
                                <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                                  {s.nombre} {s.apellido} {s.empresa_nombre ? `· ${s.empresa_nombre}` : ''}
                                </span>
                                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">Vincular →</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => openCreateFromWa(conv)}
                          className="flex items-center gap-1 text-xs bg-primary text-white px-3 py-1.5 rounded-lg font-medium hover:bg-primary/90 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">person_add</span>
                          Crear contacto
                        </button>
                        <button
                          onClick={() => navigate('/whatsapp')}
                          className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                          Ver chat
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Gmail Tab ── */}
      {tab === 'gmail' && (
        <div>
          {!googleActive ? (
            <EmptyState
              icon="mail_off"
              title="Google no conectado"
              desc="Conecta tu cuenta de Google en Configuración para ver remitentes sin identificar."
              action={{ label: 'Ir a Configuración', onClick: () => navigate('/configuracion') }}
            />
          ) : loadingGmail ? (
            <LoadingState label="Analizando bandeja de entrada..." />
          ) : gmailData.length === 0 ? (
            <EmptyState icon="mark_email_read" title="Todo identificado" desc="Todos los remitentes recientes están en tus contactos." />
          ) : (
            <div className="space-y-3">
              {gmailData.map(sender => (
                <div key={sender.email} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className={`size-10 rounded-full ${avatarColor(sender.email)} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                      {(sender.name || sender.email).charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white text-sm">{sender.name || sender.email}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{sender.email}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="text-xs text-slate-400">{sender.latest_date ? new Date(sender.latest_date).toLocaleDateString('es-CL') : ''}</span>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {sender.message_count} correo{sender.message_count !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                        Último: {sender.latest_subject}
                      </p>

                      {/* Suggestions */}
                      {sender.suggestions.length > 0 && (
                        <div className="mt-3 p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/40">
                          <p className="text-xs text-blue-700 dark:text-blue-400 font-medium mb-2 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">person_search</span>
                            Posible coincidencia en CRM:
                          </p>
                          <div className="flex flex-col gap-1.5">
                            {sender.suggestions.map(s => (
                              <button
                                key={s.id}
                                onClick={() => navigate(`/contactos/${s.id}`)}
                                className="flex items-center justify-between w-full text-left px-2.5 py-1.5 bg-white dark:bg-slate-700 rounded-md hover:bg-blue-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 transition-colors"
                              >
                                <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                                  {s.nombre} {s.apellido} {s.empresa_nombre ? `· ${s.empresa_nombre}` : ''}
                                </span>
                                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">Ver contacto →</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => openCreateFromGmail(sender)}
                          className="flex items-center gap-1 text-xs bg-primary text-white px-3 py-1.5 rounded-lg font-medium hover:bg-primary/90 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">person_add</span>
                          Crear contacto
                        </button>
                        <button
                          onClick={() => navigate('/correo')}
                          className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                          Ver correos
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {nuevoContactoOpen && (
        <NuevoContactoModal
          open={nuevoContactoOpen}
          onClose={() => { setNuevoContactoOpen(false); setPendingLink(null); setPrefill({}); }}
          onSuccess={handleContactCreated}
          initialValues={prefill}
        />
      )}
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
      <div className="size-8 border-2 border-slate-200 border-t-primary rounded-full animate-spin mb-3" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

function EmptyState({ icon, title, desc, action }: {
  icon: string; title: string; desc: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-3">{icon}</span>
      <p className="font-semibold text-slate-700 dark:text-slate-300">{title}</p>
      <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 max-w-xs">{desc}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 text-sm text-primary font-medium hover:underline"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
