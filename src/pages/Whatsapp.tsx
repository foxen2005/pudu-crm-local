import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { WA_URL } from '@/lib/wa-url';
import { NuevoContactoModal } from '@/components/modals/NuevoContactoModal';

async function getOrgId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('miembros').select('org_id').eq('user_id', user.id).single();
  return data?.org_id ?? null;
}

type Conv = {
  id: string;
  contact_id: string | null;
  contact_phone: string;
  contact_nombre: string | null;
  profile_pic_url: string | null;
  status: string;
  archived: boolean;
  last_message_at: string | null;
};

type LinkedContact = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
  email: string | null;
  cargo: string | null;
};

type Msg = {
  id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  body: string | null;
  status: string;
  message_type: string | null;
  sent_by_nombre: string | null;
  media_url: string | null;
  media_type: string | null;
  wa_msg_id: string | null;
  author_phone: string | null;
  quoted_wa_msg_id: string | null;
  quoted_body: string | null;
  quoted_author: string | null;
  reactions: { emoji: string; sender: string }[] | null;
  edited: boolean;
  created_at: string;
};

function cleanPhone(p: string) {
  return p.replace(/@(c\.us|lid|g\.us)$/i, '').replace(/\D/g, '');
}

function convName(conv: Conv) {
  if (!conv.contact_nombre) return cleanPhone(conv.contact_phone);
  const s = conv.contact_nombre.replace(/@(c\.us|lid|g\.us)$/i, '');
  return /^\d{7,}$/.test(s) ? cleanPhone(conv.contact_phone) : s;
}

function initials(conv: Conv) {
  const n = convName(conv);
  const parts = n.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return n.slice(0, 2).toUpperCase();
}

function ago(iso: string | null) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Ahora';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

export default function Whatsapp() {
  const navigate = useNavigate();
  const [convs, setConvs] = useState<Conv[]>([]);
  const [crearContactoOpen, setCrearContactoOpen] = useState(false);
  const [selected, setSelected] = useState<Conv | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [convTab, setConvTab] = useState<'all' | 'contacts' | 'groups'>('contacts');
  const [sendingMedia, setSendingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkedContact, setLinkedContact] = useState<LinkedContact | null | undefined>(undefined);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [orderPanel, setOrderPanel] = useState(false);
  const [orderForm, setOrderForm] = useState({ nombre: '', valor: '', fecha_cierre: '' });
  const [orderSaving, setOrderSaving] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function loadConvs() {
    setLoadingConvs(true);
    setError(null);
    const org_id = await getOrgId();
    if (!org_id) { setLoadingConvs(false); return; }
    const { data, error } = await supabase
      .from('whatsapp_conversations')
      .select('*')
      .eq('org_id', org_id)
      .order('last_message_at', { ascending: false, nullsFirst: false });
    if (error) {
      setError(error.message);
    } else {
      const list = data ?? [];
      setConvs(list);
      if (list.length > 0) setSelected(s => s ?? list[0]);
    }
    setLoadingConvs(false);
  }

  async function loadMsgs(convId: string) {
    setLoadingMsgs(true);
    setMsgs([]);
    const { data } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });
    setMsgs(data ?? []);
    setLoadingMsgs(false);
  }

  useEffect(() => { loadConvs(); }, []);

  useEffect(() => {
    if (!selected) return;
    loadMsgs(selected.id);
    // Marcar como leído al abrir
    getOrgId().then(org_id => {
      if (!org_id) return;
      fetch(`${WA_URL}/seen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: selected.contact_phone, orgId: org_id }),
      }).catch(() => {});
    });
    const ch = supabase.channel(`msgs-${selected.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'whatsapp_messages',
        filter: `conversation_id=eq.${selected.id}`,
      }, payload => {
        const msg = payload.new as Msg;
        if (msg.conversation_id !== selected.id) return;
        setMsgs(p => p.some(m => m.id === msg.id) ? p : [...p, msg]);
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'whatsapp_messages',
        filter: `conversation_id=eq.${selected.id}`,
      }, payload => {
        const msg = payload.new as Msg;
        if (msg.conversation_id !== selected.id) return;
        setMsgs(p => p.map(m => m.id === msg.id ? { ...m, ...msg } : m));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selected?.id]);

  useEffect(() => {
    const ch = supabase.channel('wa-convs-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_conversations' }, loadConvs)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  useEffect(() => {
    if (!selected) { setLinkedContact(undefined); return; }
    setLinkedContact(undefined);

    async function resolveContact() {
      // Si ya tiene contact_id, buscar directo por ID
      if (selected!.contact_id) {
        const { data } = await supabase
          .from('contactos')
          .select('id, nombre, apellido, telefono, email, cargo')
          .eq('id', selected!.contact_id)
          .maybeSingle();
        setLinkedContact(data ?? null);
        return;
      }

      // Si no, buscar por últimos 9 dígitos del teléfono y auto-vincular
      const last9 = cleanPhone(selected!.contact_phone).slice(-9);
      const { data } = await supabase
        .from('contactos')
        .select('id, nombre, apellido, telefono, email, cargo')
        .ilike('telefono', `%${last9}`)
        .limit(1)
        .maybeSingle();

      setLinkedContact(data ?? null);

      if (data) {
        const nombre = [data.nombre, data.apellido].filter(Boolean).join(' ');
        await supabase
          .from('whatsapp_conversations')
          .update({ contact_id: data.id, contact_nombre: nombre })
          .eq('id', selected!.id);
        setConvs(prev => prev.map(c =>
          c.id === selected!.id ? { ...c, contact_id: data.id, contact_nombre: nombre } : c
        ));
      }
    }

    resolveContact();
  }, [selected?.id]);

  async function createOrder() {
    if (!orderForm.nombre.trim() || !selected) return;
    setOrderSaving(true);
    const org_id = await getOrgId();
    const { data } = await supabase.from('negocios').insert({
      org_id,
      nombre: orderForm.nombre.trim(),
      valor: orderForm.valor ? parseFloat(orderForm.valor) : null,
      fecha_cierre: orderForm.fecha_cierre || null,
      etapa: 'Nuevo',
      contacto_id: linkedContact?.id ?? null,
      contacto_nombre: linkedContact ? [linkedContact.nombre, linkedContact.apellido].filter(Boolean).join(' ') : convName(selected),
    }).select('id').single();
    setOrderSaving(false);
    if (data) {
      setOrderSuccess(data.id);
      setOrderForm({ nombre: '', valor: '', fecha_cierre: '' });
    }
  }

  async function toggleStatus(conv: Conv) {
    const newStatus = conv.status === 'open' ? 'closed' : 'open';
    await supabase.from('whatsapp_conversations').update({ status: newStatus }).eq('id', conv.id);
    setConvs(p => p.map(c => c.id === conv.id ? { ...c, status: newStatus } : c));
    setSelected(s => s?.id === conv.id ? { ...s, status: newStatus } : s);
  }

  async function toggleArchive(conv: Conv) {
    const archived = !conv.archived;
    await supabase.from('whatsapp_conversations').update({ archived }).eq('id', conv.id);
    setConvs(p => p.filter(c => c.id !== conv.id));
    setSelected(s => s?.id === conv.id ? null : s);
  }

  async function downloadMedia(msg: Msg) {
    const org_id = await getOrgId();
    await fetch(`${WA_URL}/download-media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: org_id, messageId: msg.id, waMsgId: msg.wa_msg_id }),
    });
    // Realtime UPDATE listener actualizará el mensaje automáticamente
  }

  async function sendMedia(file: File) {
    if (!selected) return;
    setSendingMedia(true);
    const org_id = await getOrgId();
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      const { data } = await supabase.from('whatsapp_messages').insert({
        org_id,
        conversation_id: selected.id,
        direction: 'outbound',
        message_type: file.type.startsWith('image') ? 'image' : file.type.startsWith('audio') ? 'audio' : file.type.startsWith('video') ? 'video' : 'document',
        body: file.name,
        status: 'pending',
        media_type: file.type,
      }).select().single();
      if (data) setMsgs(p => [...p, data as Msg]);
      fetch(`${WA_URL}/send-media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone(selected.contact_phone), orgId: org_id, messageId: data?.id, data: base64, mimetype: file.type, filename: file.name }),
      }).catch(() => {});
      setSendingMedia(false);
    };
    reader.readAsDataURL(file);
  }

  // Typing indicator con debounce
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleInputChange(val: string) {
    setInput(val);
    if (!selected) return;
    getOrgId().then(org_id => {
      fetch(`${WA_URL}/typing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: selected.contact_phone, orgId: org_id, typing: true }),
      }).catch(() => {});
    });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      getOrgId().then(org_id => {
        fetch(`${WA_URL}/typing`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: selected.contact_phone, orgId: org_id, typing: false }),
        }).catch(() => {});
      });
    }, 3000);
  }

  async function sendMsg() {
    if (!input.trim() || !selected) return;
    const body = input.trim();
    setInput('');
    const reply = replyTo;
    setReplyTo(null);
    const phone = cleanPhone(selected.contact_phone);
    const org_id = await getOrgId();

    const { data } = await supabase.from('whatsapp_messages').insert({
      org_id,
      conversation_id: selected.id,
      direction: 'outbound',
      message_type: 'text',
      body,
      status: 'pending',
      quoted_wa_msg_id: reply?.wa_msg_id ?? null,
      quoted_body: reply?.body ?? null,
    }).select().single();
    if (data) setMsgs(p => [...p, data as Msg]);

    fetch(`${WA_URL}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message: body, orgId: org_id, messageId: data?.id, quotedMsgId: reply?.wa_msg_id }),
    }).catch(() => {});
  }

  const filtered = (() => {
    const base = convs.filter(c => {
      if (c.archived) return false;
      const isGroup = c.contact_phone.includes('@g.us');
      if (convTab === 'contacts' && isGroup) return false;
      if (convTab === 'groups' && !isGroup) return false;
      if (search && !convName(c).toLowerCase().includes(search.toLowerCase()) && !cleanPhone(c.contact_phone).includes(search)) return false;
      return true;
    });
    // Deduplicar: un solo registro por número de teléfono (el más reciente)
    const seen = new Map<string, Conv>();
    for (const c of base) {
      const key = cleanPhone(c.contact_phone);
      if (!seen.has(key)) seen.set(key, c);
    }
    return Array.from(seen.values());
  })();

  return (
    // fixed: independiente del layout padre, siempre ocupa el área correcta
    <div className="fixed top-14 left-64 right-0 bottom-20 flex overflow-hidden bg-slate-50 dark:bg-[#13111a]">

      {/* ── Izquierda: lista de conversaciones ── */}
      <div className="w-72 flex-shrink-0 flex flex-col border-r border-slate-200 dark:border-slate-700/50 bg-white dark:bg-[#1e1a2e]">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700/50">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-green-500" style={{ fontSize: 20 }}>whatsapp</span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">WhatsApp</span>
          </div>
          <button
            onClick={loadConvs}
            className="size-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-700/50 text-[11px] font-bold">
          {([['all', 'Todos'], ['contacts', 'Contactos'], ['groups', 'Grupos']] as const).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setConvTab(tab)}
              className={`flex-1 py-2 transition-colors ${
                convTab === tab
                  ? 'text-green-600 border-b-2 border-green-500'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="p-2 border-b border-slate-100 dark:border-slate-700/50">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-[#252035] dark:text-slate-100 dark:placeholder:text-slate-500 focus:outline-none focus:border-green-500"
          />
        </div>

        {/* Conv list */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <p className="text-[11px] text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2">{error}</p>
          )}
          {loadingConvs ? (
            <div className="p-3 space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center px-4">
              <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 mb-2" style={{ fontSize: 36 }}>forum</span>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">Sin conversaciones</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-600 mt-1">Los mensajes aparecerán aquí</p>
            </div>
          ) : (
            filtered.map(conv => {
              const sel = selected?.id === conv.id;
              const isGroup = conv.contact_phone.includes('@g.us');
              return (
                <button
                  key={conv.id}
                  onClick={() => setSelected(conv)}
                  className={`w-full flex items-center gap-3 px-3 py-3.5 text-left border-b border-slate-100 dark:border-slate-700/30 transition-colors ${
                    sel
                      ? 'bg-green-50 dark:bg-green-900/20 border-l-2 border-l-green-500'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="size-10 rounded-full flex-shrink-0 relative">
                    {conv.profile_pic_url && !isGroup ? (
                      <img src={conv.profile_pic_url} alt="" className="size-10 rounded-full object-cover" />
                    ) : (
                      <div className={`size-10 rounded-full flex items-center justify-center text-xs font-bold ${
                        isGroup
                          ? sel ? 'bg-violet-500 text-white' : 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400'
                          : sel ? 'bg-green-500 text-white' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      }`}>
                        {isGroup
                          ? <span className="material-symbols-outlined text-[18px]">group</span>
                          : initials(conv)
                        }
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center gap-1 mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">{convName(conv)}</p>
                        {conv.contact_id && (
                          <span className="flex-shrink-0 size-3.5 rounded-full bg-primary flex items-center justify-center" title="Contacto CRM vinculado">
                            <span className="material-symbols-outlined text-white" style={{ fontSize: 9 }}>person</span>
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 flex-shrink-0">{ago(conv.last_message_at)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {isGroup && <span className="text-[9px] font-bold uppercase tracking-wide text-violet-400 bg-violet-50 dark:bg-violet-900/20 px-1.5 py-0.5 rounded-full">Grupo</span>}
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">+{cleanPhone(conv.contact_phone)}</p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Derecha: chat ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center bg-slate-50 dark:bg-[#13111a]">
            <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 mb-3" style={{ fontSize: 48 }}>whatsapp</span>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Selecciona una conversación</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 dark:border-slate-700/50 bg-white dark:bg-[#1e1a2e] flex-shrink-0">
              <div className="size-9 rounded-full flex-shrink-0">
                {selected.profile_pic_url && !selected.contact_phone.includes('@g.us') ? (
                  <img src={selected.profile_pic_url} alt="" className="size-9 rounded-full object-cover" />
                ) : (
                  <div className="size-9 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-xs font-bold text-green-700 dark:text-green-400">
                    {initials(selected)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{convName(selected)}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">+{cleanPhone(selected.contact_phone)}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  selected.status === 'open'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                  {selected.status === 'open' ? 'Abierta' : 'Cerrada'}
                </span>
                <button
                  onClick={() => toggleStatus(selected)}
                  title={selected.status === 'open' ? 'Cerrar conversación' : 'Reabrir conversación'}
                  className="size-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {selected.status === 'open' ? 'lock' : 'lock_open'}
                  </span>
                </button>
                <button
                  onClick={() => toggleArchive(selected)}
                  title="Archivar conversación"
                  className="size-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">archive</span>
                </button>
                <button
                  onClick={() => { setOrderPanel(true); setOrderSuccess(null); }}
                  title="Nueva orden de trabajo"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-white text-[11px] font-bold hover:opacity-90 transition-all"
                >
                  <span className="material-symbols-outlined text-[14px]">add_task</span>
                  Orden
                </button>
              </div>
            </div>

            {/* Contacto vinculado */}
            {linkedContact !== undefined && (
              <div className={`flex items-center gap-3 px-5 py-2 border-b text-xs flex-shrink-0 ${
                linkedContact
                  ? 'bg-primary/5 border-primary/10'
                  : 'bg-slate-50 dark:bg-[#13111a] border-slate-100 dark:border-slate-700/50'
              }`}>
                {linkedContact ? (
                  <>
                    <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[11px] flex-shrink-0">
                      {((linkedContact.nombre?.[0] ?? '') + (linkedContact.apellido?.[0] ?? '')).toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {[linkedContact.nombre, linkedContact.apellido].filter(Boolean).join(' ')}
                      </span>
                      {linkedContact.cargo && <span className="text-slate-400 ml-1">· {linkedContact.cargo}</span>}
                      {linkedContact.email && <span className="text-slate-400 ml-1">· {linkedContact.email}</span>}
                    </div>
                    <button
                      onClick={() => navigate(`/contactos/${linkedContact.id}`)}
                      className="flex items-center gap-1 text-primary font-semibold hover:underline flex-shrink-0"
                    >
                      <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                      Ver contacto
                    </button>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-slate-400 text-[16px]">person_search</span>
                    <span className="text-slate-400 flex-1">Sin contacto vinculado</span>
                    <button
                      onClick={() => setCrearContactoOpen(true)}
                      className="flex items-center gap-1 text-primary font-semibold hover:underline flex-shrink-0"
                    >
                      <span className="material-symbols-outlined text-[14px]">person_add</span>
                      Crear contacto
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 bg-slate-50 dark:bg-[#13111a]">
              {loadingMsgs ? (
                <div className="flex justify-center py-8">
                  <span className="material-symbols-outlined text-slate-300 animate-spin" style={{ fontSize: 32 }}>progress_activity</span>
                </div>
              ) : msgs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 mb-2" style={{ fontSize: 32 }}>chat_bubble_outline</span>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Sin mensajes aún</p>
                </div>
              ) : (
                [...new Map(msgs.map(m => [m.id, m])).values()].map(msg => {
                  const isOut = msg.direction === 'outbound';
                  if (msg.message_type === 'revoked') {
                    return (
                      <div key={msg.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs italic opacity-60 ${isOut ? 'bg-green-500 text-white rounded-br-sm' : 'bg-white dark:bg-[#252035] text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-700/50 rounded-bl-sm'}`}>
                          <span className="material-symbols-outlined text-[13px]">block</span>
                          Se eliminó este mensaje
                        </div>
                      </div>
                    );
                  }
                  const isImage = msg.media_type?.startsWith('image') || (msg.media_url && !msg.media_type);
                  const isAudio = msg.media_type?.startsWith('audio');
                  const isDoc = msg.media_url && !isImage && !isAudio;
                  return (
                    <div key={msg.id} className={`flex group/msg ${isOut ? 'justify-end' : 'justify-start'}`}>
                      {/* Botón reply */}
                      {!isOut && (
                        <button
                          onClick={() => setReplyTo(msg)}
                          className="self-end mb-1 mr-1 opacity-0 group-hover/msg:opacity-100 transition-opacity size-6 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 hover:text-slate-700 flex-shrink-0"
                        >
                          <span className="material-symbols-outlined text-[13px]">reply</span>
                        </button>
                      )}
                      <div className={`max-w-[70%] rounded-2xl text-xs shadow-sm overflow-hidden ${
                        isOut
                          ? 'bg-green-500 text-white rounded-br-sm'
                          : 'bg-white dark:bg-[#252035] text-slate-800 dark:text-slate-200 rounded-bl-sm border border-slate-100 dark:border-slate-700/50'
                      }`}>
                        {/* Media */}
                        {isImage && msg.media_url && (
                          <a href={msg.media_url} target="_blank" rel="noreferrer">
                            <img src={msg.media_url} alt="imagen" className="max-w-[260px] max-h-[200px] object-cover w-full" />
                          </a>
                        )}
                        {isAudio && (
                          msg.media_url
                            ? <audio controls src={msg.media_url} className="w-full max-w-[260px] px-2 py-1" />
                            : <DownloadBtn msg={msg} onDownload={downloadMedia} isOut={isOut} label="Audio" icon="mic" />
                        )}
                        {isDoc && (
                          msg.media_url
                            ? <a href={msg.media_url} target="_blank" rel="noreferrer"
                                className={`flex items-center gap-2 px-3.5 py-2 ${isOut ? 'text-white' : 'text-primary'}`}>
                                <span className="material-symbols-outlined text-base">attach_file</span>
                                <span className="text-[11px] underline truncate max-w-[180px]">Adjunto</span>
                              </a>
                            : <DownloadBtn msg={msg} onDownload={downloadMedia} isOut={isOut} label="Documento" icon="description" />
                        )}
                        {msg.media_type?.startsWith('video') && (
                          msg.media_url
                            ? <video controls src={msg.media_url} className="w-full max-w-[260px]" />
                            : <DownloadBtn msg={msg} onDownload={downloadMedia} isOut={isOut} label="Video" icon="videocam" />
                        )}
                        {/* Cita (reply) */}
                        {msg.quoted_body && (
                          <div className={`mx-2 mt-2 px-2 py-1.5 rounded-lg border-l-2 text-[10px] ${
                            isOut
                              ? 'bg-green-600/40 border-green-200 text-green-100'
                              : 'bg-slate-100 dark:bg-slate-700/50 border-slate-300 dark:border-slate-500 text-slate-500 dark:text-slate-400'
                          }`}>
                            <p className="font-bold mb-0.5">{msg.quoted_author ?? 'Mensaje'}</p>
                            <p className="truncate">{msg.quoted_body}</p>
                          </div>
                        )}

                        {/* Texto */}
                        <div className="px-3.5 py-2">
                          {msg.body && <p className="break-words leading-relaxed">{msg.body}</p>}
                          <div className="flex items-center justify-end gap-1 mt-0.5">
                            {msg.edited && (
                              <span className={`text-[9px] italic ${isOut ? 'text-green-100' : 'text-slate-400'}`}>editado</span>
                            )}
                            <p className={`text-[9px] ${isOut ? 'text-green-100' : 'text-slate-400 dark:text-slate-500'}`}>
                              {new Date(msg.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {isOut && (
                              <span className={`material-symbols-outlined text-[10px] ${msg.status === 'read' ? 'text-blue-200' : 'text-green-100'}`}>
                                {msg.status === 'read' || msg.status === 'delivered' ? 'done_all' : 'done'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Reacciones */}
                        {msg.reactions && msg.reactions.length > 0 && (
                          <div className={`flex flex-wrap gap-1 px-2 pb-1.5 ${isOut ? 'justify-end' : 'justify-start'}`}>
                            {Object.entries(
                              msg.reactions.reduce((acc, r) => {
                                acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
                                return acc;
                              }, {} as Record<string, number>)
                            ).map(([emoji, count]) => (
                              <span key={emoji} className="text-[11px] bg-white dark:bg-slate-700 rounded-full px-1.5 py-0.5 shadow-sm border border-slate-100 dark:border-slate-600">
                                {emoji}{count > 1 ? ` ${count}` : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Botón reply outbound */}
                      {isOut && (
                        <button
                          onClick={() => setReplyTo(msg)}
                          className="self-end mb-1 ml-1 opacity-0 group-hover/msg:opacity-100 transition-opacity size-6 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 hover:text-slate-700 flex-shrink-0"
                        >
                          <span className="material-symbols-outlined text-[13px]">reply</span>
                        </button>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Barra de reply */}
            {replyTo && (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 border-t border-green-200 dark:border-green-900/40 flex-shrink-0">
                <span className="material-symbols-outlined text-green-500 text-[16px]">reply</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-green-600">Respondiendo a</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{replyTo.body ?? '(media)'}</p>
                </div>
                <button onClick={() => setReplyTo(null)} className="size-5 flex items-center justify-center text-slate-400 hover:text-slate-600">
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </div>
            )}

            {/* Input */}
            <div className="flex gap-2 px-4 py-3 border-t border-slate-100 dark:border-slate-700/50 bg-white dark:bg-[#1e1a2e] flex-shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) { sendMedia(f); e.target.value = ''; } }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={sendingMedia}
                title="Adjuntar archivo"
                className="size-9 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-400 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 flex-shrink-0 transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  {sendingMedia ? 'uploading' : 'attach_file'}
                </span>
              </button>
              <textarea
                value={input}
                onChange={e => handleInputChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
                placeholder="Escribe un mensaje... (Enter para enviar)"
                rows={1}
                className="flex-1 px-3 py-2 text-xs border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-[#252035] dark:text-slate-100 dark:placeholder:text-slate-500 focus:outline-none focus:border-green-500 resize-none"
              />
              <button
                onClick={sendMsg}
                disabled={!input.trim()}
                className="size-9 rounded-xl bg-green-500 text-white flex items-center justify-center hover:bg-green-600 disabled:opacity-40 flex-shrink-0 transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Panel Nueva Orden ── */}
      {orderPanel && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOrderPanel(false)} />
          <div className="relative w-96 h-full bg-white dark:bg-[#1e1a2e] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700/50">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">add_task</span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Nueva orden de trabajo</h3>
              </div>
              <button onClick={() => setOrderPanel(false)} className="size-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Contacto */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#252035] text-xs">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Contacto</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {linkedContact
                    ? [linkedContact.nombre, linkedContact.apellido].filter(Boolean).join(' ')
                    : convName(selected!)}
                </p>
                <p className="text-slate-400">+{cleanPhone(selected!.contact_phone)}</p>
              </div>

              {/* Título */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Descripción del trabajo *</label>
                <textarea
                  value={orderForm.nombre}
                  onChange={e => setOrderForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: Instalación de cámara de seguridad..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-[#252035] dark:text-slate-100 focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {/* Valor */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Valor estimado</label>
                <input
                  type="number"
                  value={orderForm.valor}
                  onChange={e => setOrderForm(f => ({ ...f, valor: e.target.value }))}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-[#252035] dark:text-slate-100 focus:outline-none focus:border-primary"
                />
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Fecha estimada de entrega</label>
                <input
                  type="date"
                  value={orderForm.fecha_cierre}
                  onChange={e => setOrderForm(f => ({ ...f, fecha_cierre: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-[#252035] dark:text-slate-100 focus:outline-none focus:border-primary"
                />
              </div>

              {orderSuccess && (
                <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 flex items-center gap-3">
                  <span className="material-symbols-outlined text-green-600 text-xl">check_circle</span>
                  <div>
                    <p className="text-sm font-bold text-green-700 dark:text-green-400">Orden creada</p>
                    <a href={`/negocios/${orderSuccess}`} className="text-xs text-green-600 underline">Ver orden →</a>
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-700/50">
              <button
                onClick={createOrder}
                disabled={!orderForm.nombre.trim() || orderSaving}
                className="w-full py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
              >
                {orderSaving
                  ? <><span className="material-symbols-outlined text-base animate-spin">progress_activity</span> Creando...</>
                  : <><span className="material-symbols-outlined text-base">add_task</span> Crear orden</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear contacto desde WA */}
      {crearContactoOpen && selected && (
        <NuevoContactoModal
          open={crearContactoOpen}
          onClose={() => setCrearContactoOpen(false)}
          onSuccess={() => {
            setCrearContactoOpen(false);
            // Re-resolver el contacto vinculado
            const last9 = cleanPhone(selected.contact_phone).slice(-9);
            supabase
              .from('contactos')
              .select('id, nombre, apellido, telefono, email, cargo')
              .ilike('telefono', `%${last9}`)
              .limit(1)
              .maybeSingle()
              .then(({ data }) => {
                if (data) {
                  setLinkedContact(data);
                  const nombre = [data.nombre, data.apellido].filter(Boolean).join(' ');
                  supabase.from('whatsapp_conversations')
                    .update({ contact_id: data.id, contact_nombre: nombre })
                    .eq('id', selected.id);
                  setConvs(prev => prev.map(c =>
                    c.id === selected.id ? { ...c, contact_id: data.id, contact_nombre: nombre } : c
                  ));
                }
              });
          }}
          initialValues={{
            nombre: convName(selected).split(' ')[0] ?? '',
            apellido: convName(selected).split(' ').slice(1).join(' '),
            telefono: `+${cleanPhone(selected.contact_phone)}`,
          }}
        />
      )}
    </div>
  );
}

function DownloadBtn({ msg, onDownload, isOut, label, icon }: {
  msg: Msg;
  onDownload: (msg: Msg) => void;
  isOut: boolean;
  label: string;
  icon: string;
}) {
  const [loading, setLoading] = useState(false);
  return (
    <button
      onClick={async () => { setLoading(true); await onDownload(msg); setLoading(false); }}
      disabled={loading}
      className={`flex items-center gap-2 px-3.5 py-2.5 w-full text-left ${isOut ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}
    >
      <span className="material-symbols-outlined text-base">{loading ? 'downloading' : icon}</span>
      <span className="text-[11px] truncate max-w-[180px]">{loading ? 'Descargando...' : label}</span>
      {!loading && <span className="material-symbols-outlined text-xs ml-auto opacity-60">download</span>}
    </button>
  );
}
