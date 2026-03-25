import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

// ── Simulated response engine ─────────────────────────────────────────────────
// Each entry: keywords to match + array of possible responses (picked randomly)
const MOCK_RESPONSES: Array<{ keywords: string[]; responses: string[] }> = [
  {
    keywords: ['lead', 'leads', 'caliente', 'calientes', 'hot'],
    responses: [
      'Encontré 3 leads calientes ahora mismo: María González (Transportes del Sur), Javier Valenzuela (Tech Patagonia) y Constanza Morán (Cencosud). ¿Quieres ver los detalles de alguno?',
      'Tienes 3 leads en estado caliente. El más urgente es María González — interactuó con la propuesta hace menos de 2 horas.',
    ],
  },
  {
    keywords: ['contacto', 'contactos', 'crear contacto', 'nuevo contacto'],
    responses: [
      'Para crear un contacto ve a Contactos → Nuevo Contacto, o dime el nombre y empresa y lo registro por ti.',
      '¿Cómo se llama el contacto y a qué empresa pertenece? Con eso lo agrego directamente.',
    ],
  },
  {
    keywords: ['negocio', 'negocios', 'deal', 'pipeline', 'propuesta'],
    responses: [
      'Tu pipeline actual tiene CLP $45.2M en total. La etapa con más valor es "Propuesta" con $15M en 4 negocios activos.',
      'Tienes 2 negocios estancados en "Propuesta" por más de 7 días sin contacto. ¿Quieres que te muestre cuáles son?',
    ],
  },
  {
    keywords: ['tarea', 'tareas', 'pendiente', 'pendientes', 'hoy'],
    responses: [
      'Hoy tienes 3 tareas: enviar brochure actualizado, llamada de prospección (ya hecha ✓) y agendar demo con equipo TI.',
      'Quedan 2 tareas pendientes para hoy. La más urgente: enviar brochure actualizado a Transportes del Sur antes de las 18:00.',
    ],
  },
  {
    keywords: ['seguimiento', 'seguimientos', 'llamada', 'llamadas', 'agendar'],
    responses: [
      'Tienes 4 seguimientos programados para esta tarde. El primero es con Hotel Andes a las 15:00.',
      '¿Con quién quieres agendar el seguimiento y para qué fecha/hora?',
    ],
  },
  {
    keywords: ['reporte', 'reportes', 'informe', 'resumen', 'rendimiento'],
    responses: [
      'Esta semana cerraste 1 negocio por CLP $5M. Tu tasa de conversión en "Propuesta" es del 30% vs el objetivo del 50%.',
      'Tu rendimiento de esta semana es 85/100. Estás en el Top 5% del equipo. El martes fue tu mejor día.',
    ],
  },
  {
    keywords: ['automatización', 'automatizaciones', 'flujo', 'flujos', 'automation'],
    responses: [
      'Tienes 24 flujos activos. Hay 1 con error: "Lead Calificado" está en pausa por un error de autenticación con Salesforce.',
      'El flujo más efectivo es "Nuevo Lead Creado → Enviar Secuencia Bienvenida" con 98.4% de éxito.',
    ],
  },
  {
    keywords: ['empresa', 'empresas', 'account', 'accounts', 'cuenta'],
    responses: [
      'Tienes 12 empresas activas en el CRM. La de mayor valor es Antofagasta Minerals con CLP $12.8M en pipeline.',
      '¿Quieres buscar una empresa específica o crear una nueva?',
    ],
  },
  {
    keywords: ['riesgo', 'riesgos', 'inactivo', 'inactivos', 'estancado'],
    responses: [
      '2 negocios en riesgo: "Hotel Andes" sin contacto por 12 días y "Logística Express" sin actualización por 8 días.',
      'Hotel Andes lleva 30 días inactivo. Te recomiendo una llamada de reactivación esta semana.',
    ],
  },
  {
    keywords: ['ayuda', 'help', 'qué puedes', 'que puedes', 'comandos'],
    responses: [
      'Puedo ayudarte a: buscar contactos o empresas, revisar tu pipeline, ver tareas del día, consultar reportes, gestionar seguimientos y más. Solo escríbeme en lenguaje natural.',
      'Ejemplos de lo que puedes preguntarme: "¿qué leads tengo hoy?", "muéstrame los negocios en riesgo", "¿cómo va mi pipeline esta semana?"',
    ],
  },
];

function getSimulatedResponse(query: string): string {
  const lower = query.toLowerCase();
  for (const entry of MOCK_RESPONSES) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      const idx = Math.floor(Math.random() * entry.responses.length);
      return entry.responses[idx];
    }
  }
  // Fallback
  const fallbacks = [
    `Entiendo que preguntas sobre "${query}". Aún estoy aprendiendo sobre ese tema — pronto podré responder con datos reales del CRM.`,
    `No encontré información sobre "${query}" todavía. Prueba con términos como: leads, contactos, pipeline, tareas o reportes.`,
    `Eso lo tendré disponible muy pronto. Por ahora puedo ayudarte con leads, negocios, seguimientos y reportes.`,
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function FloatingCommandBar() {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [thinking, setThinking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Cmd+K to focus / open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setExpanded(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') {
        setExpanded(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Scroll to bottom when new message arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = () => {
    const trimmed = query.trim();
    if (!trimmed || thinking) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setQuery('');
    setThinking(true);

    // Simulate network delay (400–900ms)
    const delay = 400 + Math.random() * 500;
    setTimeout(() => {
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: getSimulatedResponse(trimmed),
      };
      setMessages((prev) => [...prev, aiMsg]);
      setThinking(false);
    }, delay);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') setExpanded(false);
  };

  return (
    <div className="fixed bottom-0 left-64 right-0 z-50 flex justify-center pb-6 pointer-events-none">
      <div className="w-full max-w-3xl mx-8 pointer-events-auto">

        {/* Chat history — visible only when expanded and there are messages */}
        {expanded && messages.length > 0 && (
          <div className="mb-2 bg-white/90 backdrop-blur-md border border-slate-200/60 rounded-2xl shadow-2xl shadow-primary/10 max-h-72 overflow-y-auto no-scrollbar p-4 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'flex gap-3 items-start',
                  msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                )}
              >
                {msg.role === 'assistant' && (
                  <div className="size-7 bg-primary rounded-full flex items-center justify-center text-white flex-shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-sm">auto_awesome</span>
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-primary text-white rounded-tr-sm'
                      : 'bg-slate-100 text-slate-800 rounded-tl-sm'
                  )}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {thinking && (
              <div className="flex gap-3 items-start">
                <div className="size-7 bg-primary rounded-full flex items-center justify-center text-white flex-shrink-0">
                  <span className="material-symbols-outlined text-sm">auto_awesome</span>
                </div>
                <div className="bg-slate-100 px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1.5 items-center">
                  <span className="size-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="size-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="size-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Command bar input */}
        <div className="relative group">
          {/* Glow effect */}
          <div className={cn(
            'absolute inset-0 rounded-3xl transition-all duration-300',
            expanded ? 'bg-primary/15 blur-2xl' : 'bg-primary/5 blur-xl'
          )} />

          <div className={cn(
            'relative glass-panel border rounded-3xl shadow-2xl flex items-center transition-all duration-200',
            expanded
              ? 'border-primary/30 shadow-primary/20 p-2'
              : 'border-slate-200/60 shadow-black/10 p-2'
          )}>
            {/* Terminal icon pill */}
            <button
              onClick={() => {
                setExpanded(true);
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
              className="flex items-center gap-2 bg-primary text-white rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest flex-shrink-0 hover:scale-105 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-base">terminal</span>
              <span>Command</span>
            </button>

            <div className="h-5 w-px bg-slate-200 mx-3" />

            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setExpanded(true)}
              onKeyDown={handleKeyDown}
              placeholder={expanded ? '¿Qué quieres hacer hoy?' : 'Presiona CMD + K para acciones rápidas...'}
              className="flex-1 bg-transparent border-none focus:ring-0 outline-none text-sm font-medium placeholder:text-slate-400 text-slate-800 py-2"
            />

            <div className="flex items-center gap-1 pr-2 flex-shrink-0">
              {query.trim() && expanded ? (
                <button
                  onClick={handleSubmit}
                  className="size-8 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-primary/90 transition-colors"
                >
                  <span className="material-symbols-outlined text-base">send</span>
                </button>
              ) : (
                <>
                  <kbd className="bg-slate-100 text-[9px] font-bold text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">⌘</kbd>
                  <kbd className="bg-slate-100 text-[9px] font-bold text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">K</kbd>
                </>
              )}
            </div>
          </div>
        </div>

        {/* AI status indicator */}
        {!expanded && (
          <div className="absolute -top-12 right-0 flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-lg text-xs">
            <div className="size-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-slate-500 font-medium">IA activa</span>
          </div>
        )}
      </div>

      {/* Click outside to collapse */}
      {expanded && (
        <div
          className="fixed inset-0 -z-10"
          onClick={() => setExpanded(false)}
        />
      )}
    </div>
  );
}
