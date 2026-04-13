import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  getWaCredentials, getOrCreateWaConversacion, findWaConversacion, getWaMensajes, sendWaMensaje,
  type Contacto, type WaMensaje,
} from '@/lib/db';

export function WaThread({ contacto }: { contacto: Contacto }) {
  const { member } = useAuth();
  const [credOk, setCredOk] = useState<boolean | null>(null); // null=loading
  const [convId, setConvId] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<WaMensaje[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Check credentials
  useEffect(() => {
    getWaCredentials().then(creds => setCredOk(!!creds));
  }, []);

  // Init: solo busca conversación existente, NO crea una vacía
  useEffect(() => {
    if (!credOk || !contacto.telefono) return;
    const nombre = `${contacto.nombre}${contacto.apellido ? ' ' + contacto.apellido : ''}`;
    findWaConversacion(contacto.id, contacto.telefono, nombre).then(conv => {
      if (conv) setConvId(conv.id);
    });
  }, [credOk, contacto.id, contacto.telefono]);

  // Load messages
  useEffect(() => {
    if (!convId) return;
    getWaMensajes(convId).then(res => {
      if (res.ok) setMensajes(res.data);
    });
  }, [convId]);

  // Realtime subscription
  useEffect(() => {
    if (!convId) return;
    const channel = supabase
      .channel(`wa-${convId}-${Date.now()}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'whatsapp_messages',
        filter: `conversation_id=eq.${convId}`,
      }, payload => {
        setMensajes(prev => [...prev, payload.new as WaMensaje]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [convId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  const handleSend = async () => {
    if (!input.trim() || !contacto.telefono) return;
    setSending(true);
    setSendError(null);

    // Si no hay conversación aún, crearla ahora (primer mensaje)
    let activeConvId = convId;
    if (!activeConvId) {
      const nombre = `${contacto.nombre}${contacto.apellido ? ' ' + contacto.apellido : ''}`;
      const res = await getOrCreateWaConversacion(contacto.id, contacto.telefono, nombre);
      if (!res.ok) { setSendError(res.error); setSending(false); return; }
      activeConvId = res.data.id;
      setConvId(activeConvId);
    }

    const senderNombre = member?.nombre ?? member?.email ?? 'Agente';
    const res = await sendWaMensaje(activeConvId, input.trim(), contacto.telefono, senderNombre);
    setSending(false);
    if (!res.ok) { setSendError(res.error); return; }
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ── Loading credentials ──
  if (credOk === null) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="material-symbols-outlined text-2xl text-slate-300 animate-pulse">more_horiz</span>
      </div>
    );
  }

  // ── Not configured ──
  if (!credOk) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center px-4">
        <div className="size-12 rounded-xl bg-green-100 flex items-center justify-center mb-3">
          <span className="material-symbols-outlined text-2xl text-green-600">whatsapp</span>
        </div>
        <p className="text-sm font-bold text-slate-700 mb-1">WhatsApp no configurado</p>
        <p className="text-xs text-slate-400 mb-4">
          Ve a Ajustes → WhatsApp para conectar tu número de empresa
        </p>
        <a href="/settings" className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg shadow-sm shadow-primary/20 hover:opacity-90 transition-all">
          Ir a Ajustes
        </a>
      </div>
    );
  }

  // ── No phone on contact ──
  if (!contacto.telefono) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center px-4">
        <span className="material-symbols-outlined text-3xl text-slate-200 mb-2">phone_disabled</span>
        <p className="text-xs font-bold text-slate-500">Sin teléfono registrado</p>
        <p className="text-xs text-slate-400 mt-1">Edita el contacto y agrega un número para enviar mensajes</p>
      </div>
    );
  }

  // ── Sin historial previo ──
  if (!convId) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center px-4">
        <div className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-3">
          <span className="material-symbols-outlined text-2xl text-slate-400">chat</span>
        </div>
        <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Sin conversaciones previas</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 mb-5">
          No hay mensajes de WhatsApp con {contacto.nombre}
        </p>
        <div className="flex items-end gap-2 w-full max-w-xs">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Escribe un mensaje para iniciar..."
            rows={2}
            className="flex-1 px-3 py-2.5 text-xs border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white dark:bg-slate-800 resize-none"
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="size-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-40 flex-shrink-0"
          >
            <span className="material-symbols-outlined text-lg">send</span>
          </button>
        </div>
        {sendError && <p className="text-[10px] text-red-600 mt-2">{sendError}</p>}
      </div>
    );
  }

  // ── Chat thread ──
  return (
    <div className="flex flex-col h-[340px]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-[#e5ddd5]/30 rounded-xl mb-2">
        {mensajes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-4">
            <span className="material-symbols-outlined text-3xl text-slate-200 mb-2">chat_bubble_outline</span>
            <p className="text-[10px] text-slate-400 font-medium">Conversación iniciada</p>
            <p className="text-[10px] text-slate-400">Escribe abajo para enviar el primer mensaje</p>
          </div>
        ) : (
          mensajes.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] px-3 py-2 rounded-xl shadow-sm ${
                msg.direction === 'outbound'
                  ? 'bg-[#d9fdd3] rounded-br-sm'
                  : 'bg-white rounded-bl-sm'
              }`}>
                {msg.direction === 'outbound' && msg.sent_by_nombre && (
                  <p className="text-[9px] font-bold text-primary mb-0.5">{msg.sent_by_nombre}</p>
                )}
                <p className="text-xs text-slate-800 leading-relaxed break-words">{msg.body}</p>
                <div className="flex items-center justify-end gap-1 mt-0.5">
                  <p className="text-[9px] text-slate-400">
                    {new Date(msg.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {msg.direction === 'outbound' && (
                    <span className="material-symbols-outlined text-[10px] text-blue-400">
                      {msg.status === 'read' ? 'done_all' : msg.status === 'delivered' ? 'done_all' : 'done'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {sendError && (
        <p className="text-[10px] text-red-600 px-2 mb-1">{sendError}</p>
      )}

      {/* Input */}
      <div className="flex items-end gap-2">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe un mensaje..."
          rows={1}
          className="flex-1 px-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white resize-none"
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="size-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-40 flex-shrink-0"
        >
          <span className="material-symbols-outlined text-lg">send</span>
        </button>
      </div>
    </div>
  );
}
