import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { streamChatMessage, parseAction, type ChatMessage, type PendingAction, type CrmContext } from '@/lib/groq';
import { detectRut, lookupEmpresa, type SiiEmpresa, parseRutDigits } from '@/lib/sii';
import { ejecutarAccion, buscarEmpresaPorRut, getContactos, getNegocios, getActividades, getEmpresas, getAutomatizaciones, crearAutomatizacion, evaluarAutomatizaciones, type Negocio, type Actividad, type Automatizacion } from '@/lib/db';
import { generarSugerencias, type SmartSuggestion } from '@/lib/suggestions';

// ─── Message type ────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  streaming?: boolean;
  action?: PendingAction;
  options?: string[];
}

// ─── Intent detection ─────────────────────────────────────────────────────────

type FlowType = 'empresa' | 'contacto' | 'negocio' | 'actividad';

function detectIntent(text: string): FlowType | null {
  const t = text.toLowerCase();
  if (/crear?\s*empresa|nueva?\s*empresa|agregar?\s*empresa/.test(t)) return 'empresa';
  if (/crear?\s*contacto|nuevo?\s*contacto|agregar?\s*contacto/.test(t)) return 'contacto';
  if (/crear?\s*negocio|nuevo?\s*negocio|agregar?\s*negocio/.test(t)) return 'negocio';
  if (/crear?\s*actividad|nueva?\s*actividad|agendar|programar\s*(llamada|reunion|reunión|tarea)/.test(t)) return 'actividad';
  return null;
}

// ─── Flow definitions ─────────────────────────────────────────────────────────

type FlowStep = {
  field: string;
  question: string;
  options?: string[] | (() => string[]);
  skipIfSii?: boolean;
  lookupIfRut?: boolean;
  validate?: (v: string) => string | null;
};

function getStepOptions(step: FlowStep): string[] | undefined {
  if (!step.options) return undefined;
  return typeof step.options === 'function' ? step.options() : step.options;
}

function dynamicFechaOptions(): string[] {
  const pad = (n: number) => String(n).padStart(2, '0');
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const fmt = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  return [
    `Hoy ${pad(today.getHours() < 10 ? 10 : today.getHours() + 1)}:00`,
    `Hoy 15:00`,
    `Mañana 09:00`,
    `Mañana 15:00`,
    `${fmt(tomorrow)} 10:00`,
  ];
}

const EMPRESA_STEPS: FlowStep[] = [
  {
    field: 'rut',
    question: '¿Cuál es el RUT de la empresa? (ej: 76.123.456-7)',
    validate: (v) => {
      const digits = v.replace(/[.\s-]/g, '').replace(/[kK]$/, '');
      return digits.length >= 7 && digits.length <= 9 && /^\d+$/.test(digits)
        ? null
        : 'RUT no válido. Puedes ingresar: 77314475, 77314475-3, 77.314.475-3 o 773144753';
    },
  },
  { field: 'razonSocial', question: '¿Cuál es la razón social (nombre legal)?', skipIfSii: true },
  {
    field: 'giro',
    question: '¿Cuál es el giro o actividad económica principal?',
    skipIfSii: true,
    options: ['Tecnología', 'Minería', 'Retail', 'Logística', 'Inmobiliaria', 'Finanzas', 'Agro', 'Otro'],
  },
  {
    field: 'region',
    question: '¿En qué región está?',
    skipIfSii: true,
    options: ['Metropolitana', 'Valparaíso', 'Biobío', 'La Araucanía', 'Los Lagos', 'Antofagasta', 'Atacama', 'Otra'],
  },
  { field: 'ciudad', question: '¿Ciudad o comuna?', skipIfSii: true },
  { field: 'direccion', question: '¿Cuál es la dirección completa?', skipIfSii: true },
  { field: 'telefono', question: '¿Teléfono de contacto de la empresa?' },
  { field: 'email', question: '¿Email de la empresa?' },
  {
    field: 'sitioWeb',
    question: '¿Tiene sitio web?',
    options: ['no'],
  },
  {
    field: 'tamano',
    question: '¿Cuántos empleados tiene aproximadamente?',
    options: ['1-10', '11-50', '51-200', '201-1000', '1000+'],
  },
  {
    field: 'condicionesPago',
    question: '¿Condiciones de pago preferidas?',
    options: ['Contado', '30 días', '60 días', '90 días'],
  },
];

const CONTACTO_STEPS: FlowStep[] = [
  { field: 'nombre', question: '¿Cuál es el nombre del contacto?' },
  { field: 'apellido', question: '¿Y el apellido?' },
  { field: 'email', question: '¿Email del contacto?' },
  { field: 'telefono', question: '¿Teléfono?' },
  {
    field: 'cargo',
    question: '¿Qué cargo o posición tiene en la empresa?',
    options: ['Gerente General', 'Gerente Comercial', 'Director TI', 'Ejecutivo de Ventas', 'Dueño / Socio'],
  },
  { field: 'empresa', question: '¿A qué empresa pertenece? (nombre o RUT de la empresa)', lookupIfRut: true },
  {
    field: 'estado',
    question: '¿Cuál es su estado inicial?',
    options: ['Prospecto', 'Cliente Activo', 'VIP', 'Inactivo'],
  },
];

const NEGOCIO_STEPS: FlowStep[] = [
  { field: 'nombre', question: '¿Cómo se llama o describe este negocio?' },
  { field: 'empresa', question: '¿Con qué empresa es el negocio?' },
  { field: 'contacto', question: '¿Cuál es el contacto principal?' },
  { field: 'valor', question: '¿Cuál es el valor estimado en CLP? (ej: 15000000)' },
  {
    field: 'etapa',
    question: '¿En qué etapa está?',
    options: ['Prospección', 'Calificación', 'Propuesta', 'Negociación', 'Cierre'],
  },
  { field: 'fechaCierre', question: '¿Cuál es la fecha estimada de cierre? (ej: 30/06/2025)' },
  {
    field: 'probabilidad',
    question: '¿Probabilidad de cierre en %?',
    options: ['25%', '50%', '75%', '90%', '100%'],
  },
];

const ACTIVIDAD_STEPS: FlowStep[] = [
  {
    field: 'tipoActividad',
    question: '¿Qué tipo de actividad quieres crear?',
    options: ['Llamada', 'Reunión', 'Email', 'Tarea'],
  },
  { field: 'titulo', question: '¿Cuál es el título o descripción de la actividad?' },
  { field: 'relacionado', question: '¿Con qué empresa o contacto está relacionada? (nombre o RUT)', lookupIfRut: true },
  {
    field: 'fechaHora',
    question: '¿Cuándo? (ej: Hoy 15:00 o 25/03/2025 10:30)',
    options: dynamicFechaOptions,
  },
  {
    field: 'prioridad',
    question: '¿Prioridad?',
    options: ['Alta', 'Media', 'Baja'],
  },
];

const FLOW_STEPS: Record<FlowType, FlowStep[]> = {
  empresa: EMPRESA_STEPS,
  contacto: CONTACTO_STEPS,
  negocio: NEGOCIO_STEPS,
  actividad: ACTIVIDAD_STEPS,
};

const FLOW_INTROS: Record<FlowType, string> = {
  empresa: '¡Vamos a crear la empresa! Primero necesito el RUT para buscarlo en el SII.',
  contacto: '¡Perfecto! Vamos a crear el contacto. Te haré unas preguntas rápidas.',
  negocio: '¡Bien! Vamos a registrar el negocio. Cuéntame los detalles.',
  actividad: '¡Listo! Vamos a agendar la actividad.',
};

// ─── Flow state ───────────────────────────────────────────────────────────────

interface FlowState {
  type: FlowType;
  stepIndex: number;
  data: Record<string, string>;
  siiData?: SiiEmpresa;
  extraSteps?: FlowStep[]; // injected dynamically (ej. creación empresa nueva)
}

// ─── SII helpers ──────────────────────────────────────────────────────────────

function siiToFlowData(sii: SiiEmpresa): Record<string, string> {
  const fields: Record<string, string> = {};
  if (sii.razon_social) fields.razonSocial = sii.razon_social;
  if (sii.actividades_economicas?.[0]?.actividad) fields.giro = sii.actividades_economicas[0].actividad;
  if (sii.region) fields.region = sii.region;
  if (sii.comuna) fields.ciudad = sii.comuna;
  if (sii.direccion) fields.direccion = sii.direccion;
  return fields;
}

// ─── Action labels ────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  empresa: { label: 'Crear Empresa', icon: 'domain_add', color: 'bg-primary' },
  contacto: { label: 'Crear Contacto', icon: 'person_add', color: 'bg-blue-600' },
  negocio: { label: 'Crear Negocio', icon: 'handshake', color: 'bg-orange-500' },
  actividad: { label: 'Crear Actividad', icon: 'event_available', color: 'bg-green-600' },
};

const ACTION_FIELD_LABELS: Record<string, string> = {
  razonSocial: 'Razón Social', rut: 'RUT', giro: 'Giro', region: 'Región',
  ciudad: 'Ciudad', direccion: 'Dirección', telefono: 'Teléfono', email: 'Email',
  sitioWeb: 'Sitio Web', tamano: 'Tamaño', condicionesPago: 'Condiciones de pago',
  nombre: 'Nombre', apellido: 'Apellido', cargo: 'Cargo', empresa: 'Empresa',
  estado: 'Estado', contacto: 'Contacto', valor: 'Valor', etapa: 'Etapa',
  fechaCierre: 'Fecha cierre', probabilidad: 'Probabilidad',
  tipoActividad: 'Tipo', titulo: 'Título', relacionado: 'Relacionado',
  fechaHora: 'Fecha y hora', prioridad: 'Prioridad',
};

// ─── ActionCard ───────────────────────────────────────────────────────────────

function ActionCard({ action, onConfirm, onCancel }: {
  action: PendingAction;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const meta = ACTION_LABELS[action.type];
  return (
    <div className="mt-3 bg-white dark:bg-[#1e1a2e] border border-slate-200 dark:border-slate-700/50 rounded-xl overflow-hidden shadow-sm">
      <div className={cn('px-4 py-2.5 flex items-center gap-2', meta.color)}>
        <span className="material-symbols-outlined text-white text-base">{meta.icon}</span>
        <span className="text-white text-xs font-bold uppercase tracking-wider">{meta.label}</span>
      </div>
      <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {Object.entries(action.data).filter(([, v]) => v && v !== 'no').map(([k, v]) => (
          <div key={k}>
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{ACTION_FIELD_LABELS[k] ?? k}</p>
            <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{v}</p>
          </div>
        ))}
      </div>
      <div className="px-4 pb-3 flex gap-2">
        <button
          onClick={onConfirm}
          className={cn('flex-1 py-2 rounded-lg text-white text-xs font-bold flex items-center justify-center gap-1.5', meta.color)}
        >
          <span className="material-symbols-outlined text-sm">check</span>
          Confirmar y crear
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── Suggestions ──────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  { label: '¿Qué leads tengo hoy?', icon: 'person_search' },
  { label: 'Crear empresa', icon: 'domain_add' },
  { label: 'Crear contacto', icon: 'person_add' },
  { label: 'Crear actividad', icon: 'event_available' },
  { label: 'Crear negocio', icon: 'handshake' },
  { label: 'Ver negocios en riesgo', icon: 'warning' },
];

// ─── Main component ───────────────────────────────────────────────────────────

export function FloatingCommandBar() {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [thinking, setThinking] = useState(false);
  const [flow, setFlow] = useState<FlowState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [crmContext, setCrmContext] = useState<CrmContext | undefined>(undefined);
  const [smartSuggestions, setSmartSuggestions] = useState<SmartSuggestion[]>([]);
  // Raw DB objects needed for suggestion analysis
  const rawNegociosRef = useRef<Negocio[]>([]);
  const rawActividadesRef = useRef<Actividad[]>([]);
  const rawAutosRef = useRef<Automatizacion[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const _idRef = useRef(0);
  const uid = () => String(++_idRef.current);

  // Load real CRM context + generate smart suggestions
  useEffect(() => {
    Promise.all([getContactos(), getNegocios(), getActividades(), getEmpresas(), getAutomatizaciones()]).then(
      ([contactosRes, negociosRes, actividadesRes, empresasRes, autosRes]) => {
        const negocios = negociosRes.data ?? [];
        const actividades = actividadesRes.data ?? [];
        const autos = autosRes.data ?? [];
        rawNegociosRef.current = negocios;
        rawActividadesRef.current = actividades;
        rawAutosRef.current = autos;

        setCrmContext({
          contactos: (contactosRes.data ?? []).map((c) => ({
            nombre: c.nombre,
            apellido: c.apellido ?? null,
            empresa: c.empresa_nombre ?? null,
            estado: c.estado,
            email: c.email ?? null,
            telefono: c.telefono ?? null,
          })),
          negocios: negocios.map((n) => ({
            nombre: n.nombre,
            empresa: n.empresa_nombre ?? null,
            etapa: n.etapa,
            valor: n.valor ?? null,
            riesgo: n.riesgo ?? false,
            fechaCierre: n.fecha_cierre ?? null,
          })),
          actividades: actividades.map((a) => ({
            tipo: a.tipo,
            titulo: a.titulo,
            relacionado: a.relacionado ?? null,
            fechaHora: a.fecha_hora ?? null,
            completada: a.completada ?? false,
            prioridad: a.prioridad,
          })),
          empresas: (empresasRes.data ?? []).map((e) => ({
            razonSocial: e.razon_social,
            ciudad: e.ciudad ?? null,
            giro: e.giro ?? null,
          })),
        });

        setSmartSuggestions(generarSugerencias(negocios, actividades, autos));
      },
    );
  }, []);

  // Keyboard shortcut
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

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const addMessage = (msg: Omit<Message, 'id'>) =>
    setMessages((prev) => [...prev, { id: uid(), ...msg }]);

  const startFlow = (type: FlowType) => {
    const newFlow: FlowState = { type, stepIndex: 0, data: {} };
    setFlow(newFlow);
    addMessage({ role: 'assistant', text: FLOW_INTROS[type] });
    setTimeout(() => askStep(newFlow), 50);
  };

  const askStep = (f: FlowState) => {
    const steps = f.extraSteps ?? FLOW_STEPS[f.type];
    if (f.stepIndex >= steps.length) {
      finishFlow(f);
      return;
    }
    const step = steps[f.stepIndex];
    addMessage({ role: 'assistant', text: step.question, options: getStepOptions(step) });
  };

  const finishFlow = (f: FlowState) => {
    setFlow(null);
    const summary = buildSummary(f);
    addMessage({
      role: 'assistant',
      text: summary,
      action: { type: f.type as PendingAction['type'], data: f.data },
    });
  };

  const buildSummary = (f: FlowState): string => {
    const label = ACTION_LABELS[f.type].label;
    const lines = Object.entries(f.data)
      .filter(([, v]) => v && v !== 'no')
      .map(([k, v]) => `• **${ACTION_FIELD_LABELS[k] ?? k}**: ${v}`)
      .join('\n');
    return `¡Perfecto! Acá está el resumen para **${label}**:\n\n${lines}\n\n¿Confirmas la creación?`;
  };

  // ── Smart suggestion handler ───────────────────────────────────────────────

  const handleAcceptSuggestion = async (s: SmartSuggestion) => {
    setSmartSuggestions((prev) => prev.filter((x) => x.id !== s.id));
    const result = await crearAutomatizacion(s.autoData);
    if (result.ok) {
      showToast(`✅ Automatización "${s.autoData.nombre}" creada`);
      rawAutosRef.current = [...rawAutosRef.current, result.data];
      // Run immediately so existing negocios are evaluated now
      evaluarAutomatizaciones().then(({ fired }) => {
        if (fired > 0) showToast(`⚡ ${fired} acción${fired > 1 ? 'es' : ''} ejecutada${fired > 1 ? 's' : ''} automáticamente`);
      });
    } else {
      showToast(`❌ Error al crear automatización`);
      setSmartSuggestions((prev) => [...prev, s]);
    }
  };

  const handleDismissSuggestion = (id: string) => {
    setSmartSuggestions((prev) => prev.filter((x) => x.id !== id));
  };

  // ── SII lookup reutilizable ────────────────────────────────────────────────

  // Orden futuro: Supabase → SII scraper → manual
  const doSiiLookup = async (rut: string): Promise<SiiEmpresa | null> => {
    setThinking(true);
    addMessage({ role: 'assistant', text: '🔍 Buscando en el SII...' });
    try {
      const digits = parseRutDigits(rut);
      return await lookupEmpresa(digits);
    } catch {
      return null;
    } finally {
      setThinking(false);
    }
  };

  // ── Flow answer handler ────────────────────────────────────────────────────

  const FIELD_SYNONYMS: Record<string, Record<string, string>> = {
    prioridad: {
      urgente: 'Alta', urgente2: 'Alta', crítica: 'Alta', critica: 'Alta',
      'muy alta': 'Alta', alta: 'Alta', alto: 'Alta',
      normal: 'Media', regular: 'Media', media: 'Media', medio: 'Media',
      baja: 'Baja', bajo: 'Baja', 'sin prioridad': 'Baja', poca: 'Baja',
    },
    tipoActividad: {
      call: 'Llamada', llamar: 'Llamada', telefono: 'Llamada', teléfono: 'Llamada', llamada: 'Llamada',
      meet: 'Reunión', reunion: 'Reunión', junta: 'Reunión', 'video call': 'Reunión', videollamada: 'Reunión',
      mail: 'Email', correo: 'Email', mensaje: 'Email', email: 'Email',
      tarea: 'Tarea', pendiente: 'Tarea', 'to-do': 'Tarea', todo: 'Tarea',
    },
    estado: {
      nuevo: 'Prospecto', lead: 'Prospecto', potencial: 'Prospecto', prospecto: 'Prospecto',
      activo: 'Cliente Activo', cliente: 'Cliente Activo', 'cliente activo': 'Cliente Activo',
      vip: 'VIP', premium: 'VIP', importante: 'VIP',
      inactivo: 'Inactivo', perdido: 'Inactivo', cerrado: 'Inactivo',
    },
    etapa: {
      inicio: 'Prospección', nuevo: 'Prospección', prospección: 'Prospección', prospeccion: 'Prospección',
      calificacion: 'Calificación', calificación: 'Calificación',
      oferta: 'Propuesta', cotizacion: 'Propuesta', cotización: 'Propuesta', propuesta: 'Propuesta',
      negociacion: 'Negociación', negociación: 'Negociación',
      ganado: 'Cierre', cerrado: 'Cierre', cierre: 'Cierre',
    },
  };

  const handleFlowAnswer = async (text: string, currentFlow: FlowState) => {
    const steps = currentFlow.extraSteps ?? FLOW_STEPS[currentFlow.type];
    const step = steps[currentFlow.stepIndex];

    // Resolver sinónimos para campos con opciones fijas
    const synonymMap = FIELD_SYNONYMS[step.field];
    const resolvedText = synonymMap
      ? (synonymMap[text.toLowerCase().trim()] ?? text)
      : text;

    // Validate
    if (step.validate) {
      const err = step.validate(resolvedText);
      if (err) {
        addMessage({ role: 'assistant', text: `⚠️ ${err}` });
        return;
      }
    }

    // Normalizar valor antes de guardar
    let value = resolvedText;
    if (step.field === 'probabilidad') value = resolvedText.replace('%', '').trim();
    if (step.field === 'fechaCierre' && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(resolvedText)) {
      const [d, m, y] = resolvedText.split('/');
      value = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    const newData = { ...currentFlow.data, [step.field]: value };
    let newSiiData = currentFlow.siiData;

    // Paso RUT de empresa → lookup completo, pre-llena varios campos
    if (currentFlow.type === 'empresa' && step.field === 'rut') {
      const sii = await doSiiLookup(resolvedText);
      if (sii) {
        newSiiData = sii;
        Object.assign(newData, siiToFlowData(sii));
        const giro = sii.actividades_economicas?.[0]?.actividad ?? 'no especificado';
        addMessage({
          role: 'assistant',
          text: `✅ Encontré **${sii.razon_social}** en el SII.\n• Giro: ${giro}\n• Dirección: ${sii.direccion ?? '—'}, ${sii.comuna ?? '—'}\n• Región: ${sii.region ?? '—'}\n\nVoy a pre-llenar esos datos. Solo necesito un par de cosas más.`,
        });
      } else {
        addMessage({ role: 'assistant', text: '📋 No encontré la empresa en el SII. Continúo de forma manual.' });
      }
    }

    // Paso con lookupIfRut → busca la razón social del RUT ingresado
    let injectedSteps: FlowStep[] | undefined;
    const rutDetectado = step.lookupIfRut ? detectRut(resolvedText) : null;
    if (rutDetectado) {
      // Guardar el RUT en empresa_rut para que crearContacto lo use aunque el nombre no resuelva
      if (step.field === 'empresa') newData['empresa_rut'] = rutDetectado;
      // 1. Base de datos local primero
      const localEmp = await buscarEmpresaPorRut(resolvedText);
      if (localEmp) {
        newData[step.field] = localEmp.razon_social;
        addMessage({ role: 'assistant', text: `✅ Empresa encontrada: **${localEmp.razon_social}**` });
      } else {
        // 2. SII externo
        const sii = await doSiiLookup(resolvedText);
        if (sii) {
          newData[step.field] = sii.razon_social ?? resolvedText;
          addMessage({ role: 'assistant', text: `✅ Empresa encontrada en el SII: **${sii.razon_social}**` });
        } else {
          // 3. Ambos fallaron → pedir todos los datos de la empresa
          if (step.field === 'empresa') {
            addMessage({ role: 'assistant', text: '📋 No encontré esa empresa. Necesito algunos datos para registrarla.' });
            const empresaSteps: FlowStep[] = [
              { field: 'empresa_giro', question: '¿Giro o sector de la empresa?', options: ['Tecnología', 'Minería', 'Retail', 'Logística', 'Inmobiliaria', 'Agro', 'Finanzas', 'Otro'] },
              { field: 'empresa_ciudad', question: '¿En qué ciudad está la empresa?' },
              { field: 'empresa_tamano', question: '¿Tamaño aproximado?', options: ['1-10', '11-50', '51-200', '201-500', '500+'] },
            ];
            injectedSteps = [
              ...steps.slice(0, currentFlow.stepIndex + 1),
              ...empresaSteps,
              ...steps.slice(currentFlow.stepIndex + 1),
            ];
          } else {
            addMessage({ role: 'assistant', text: '⚠️ No encontré esa empresa. Escribe el nombre directamente.' });
          }
        }
      }
    }

    const effectiveSteps = injectedSteps ?? steps;

    // Advance to next step, skipping SII-filled fields
    let nextIndex = currentFlow.stepIndex + 1;
    while (nextIndex < effectiveSteps.length) {
      const nextStep = effectiveSteps[nextIndex];
      if (nextStep.skipIfSii && newData[nextStep.field]) {
        nextIndex++;
      } else {
        break;
      }
    }

    const newFlow: FlowState = {
      ...currentFlow,
      stepIndex: nextIndex,
      data: newData,
      siiData: newSiiData,
      extraSteps: injectedSteps ?? currentFlow.extraSteps,
    };
    setFlow(newFlow);

    if (nextIndex >= effectiveSteps.length) {
      finishFlow(newFlow);
    } else {
      askStep(newFlow);
    }
  };

  // ── AI fallback ────────────────────────────────────────────────────────────

  const callAI = async (text: string, history: Message[]) => {
    const assistantId = uid();
    let fullText = '';
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', text: '', streaming: true }]);

    const chatHistory: ChatMessage[] = history.map((m) => ({ role: m.role, content: m.text }));

    await streamChatMessage(
      chatHistory,
      (token) => {
        fullText += token;
        setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, text: fullText } : m));
      },
      () => {
        // Parsear [[ACTION:...]] al terminar el stream
        const { clean, action } = parseAction(fullText);
        setMessages((prev) => prev.map((m) =>
          m.id === assistantId
            ? { ...m, text: clean, streaming: false, ...(action ? { action } : {}) }
            : m
        ));
      },
      (error) => {
        setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, text: `Error: ${error}`, streaming: false } : m));
      },
      crmContext,
    );
  };

  // ── Main send handler ──────────────────────────────────────────────────────

  const sendMessage = async (text: string) => {
    if (!text.trim() || thinking) return;
    setQuery('');

    const userMsg: Message = { id: uid(), role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);

    // Cancel flow
    if (/^(cancelar|cancel|salir|stop)$/i.test(text.trim())) {
      setFlow(null);
      addMessage({ role: 'assistant', text: 'Flujo cancelado. ¿En qué más te ayudo?' });
      return;
    }

    // Active flow — treat as answer
    if (flow) {
      await handleFlowAnswer(text, flow);
      return;
    }

    // Intent detection — start scripted flow
    const intent = detectIntent(text);
    if (intent) {
      startFlow(intent);
      return;
    }

    // AI fallback
    setThinking(true);
    const history = [...messages, userMsg];
    setThinking(false);
    await callAI(text, history);
  };

  // ── Confirm / Cancel action ────────────────────────────────────────────────

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleConfirmAction = async (msgId: string, action: PendingAction) => {
    setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, action: undefined } : m));
    const result = await ejecutarAccion(action);
    if (result.ok) {
      showToast('✅ Registro creado correctamente');
    } else {
      showToast(`❌ Error: ${(result as { ok: false; error: string }).error}`);
    }
  };

  const handleCancelAction = (msgId: string) => {
    setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, action: undefined } : m));
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed bottom-0 left-64 right-0 z-50 flex justify-center pb-6 pointer-events-none">
      <div className={cn('pointer-events-auto', expanded ? 'w-full max-w-3xl mx-8' : '')}>

        {/* Chat history */}
        {expanded && (
          <div className="mb-2 bg-white/90 dark:bg-[#1e1a2e]/95 backdrop-blur-md border border-slate-200/60 dark:border-slate-700/50 rounded-2xl shadow-2xl shadow-primary/10 max-h-96 overflow-y-auto no-scrollbar p-4 space-y-3">

            {/* Header with reset button when there are messages */}
            {messages.length > 0 && (
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700/50">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Pudu AI</span>
                <button
                  onClick={() => { setMessages([]); setFlow(null); setQuery(''); }}
                  className="flex items-center gap-1 text-[10px] font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  title="Reiniciar chat"
                >
                  <span className="material-symbols-outlined text-sm">refresh</span>
                  Nuevo chat
                </button>
              </div>
            )}

            {/* Empty state */}
            {messages.length === 0 && (
              <div className="space-y-3">

                {/* Smart suggestions from AI analysis */}
                {smartSuggestions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">bolt</span>
                      Pudu detectó
                    </p>
                    {smartSuggestions.map((s) => (
                      <div
                        key={s.id}
                        className={cn(
                          'flex items-start gap-2.5 px-3 py-2.5 rounded-xl border',
                          s.tipo === 'warning' && 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/40',
                          s.tipo === 'alert'   && 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/40',
                          s.tipo === 'info'    && 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/40',
                        )}
                      >
                        <span className={cn(
                          'material-symbols-outlined text-base flex-shrink-0 mt-0.5',
                          s.tipo === 'warning' && 'text-amber-500',
                          s.tipo === 'alert'   && 'text-red-500',
                          s.tipo === 'info'    && 'text-blue-500',
                        )}>{s.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{s.titulo}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">{s.descripcion}</p>
                          <button
                            onClick={() => handleAcceptSuggestion(s)}
                            className={cn(
                              'mt-1.5 text-[11px] font-bold underline underline-offset-2',
                              s.tipo === 'warning' && 'text-amber-600 dark:text-amber-400',
                              s.tipo === 'alert'   && 'text-red-600 dark:text-red-400',
                              s.tipo === 'info'    && 'text-blue-600 dark:text-blue-400',
                            )}
                          >
                            {s.ctaLabel} →
                          </button>
                        </div>
                        <button
                          onClick={() => handleDismissSuggestion(s.id)}
                          className="text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 flex-shrink-0"
                        >
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">¿Qué quieres hacer?</p>
                <div className="grid grid-cols-2 gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => sendMessage(s.label)}
                      className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 dark:bg-[#252035] hover:bg-primary/5 dark:hover:bg-primary/10 hover:border-primary/20 dark:hover:border-primary/30 border border-slate-200 dark:border-slate-700/50 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 transition-all text-left"
                    >
                      <span className="material-symbols-outlined text-primary text-base flex-shrink-0">{s.icon}</span>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg) => (
              <div key={msg.id}>
                <div className={cn('flex gap-3 items-start', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                  {msg.role === 'assistant' && (
                    <div className="size-7 bg-primary rounded-full flex items-center justify-center text-white flex-shrink-0 mt-0.5">
                      <span className="material-symbols-outlined text-sm">auto_awesome</span>
                    </div>
                  )}
                  <div className={cn(
                    'max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap',
                    msg.role === 'user'
                      ? 'bg-primary text-white rounded-tr-sm'
                      : 'bg-slate-100 dark:bg-[#252035] text-slate-800 dark:text-slate-200 rounded-tl-sm'
                  )}>
                    {msg.text}
                    {msg.streaming && (
                      <span className="inline-block w-1.5 h-3.5 bg-slate-400 rounded-sm ml-0.5 animate-pulse align-middle" />
                    )}
                  </div>
                </div>

                {/* Option chips */}
                {msg.options && !msg.streaming && (
                  <div className="ml-10 mt-2 flex flex-wrap gap-2">
                    {msg.options.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => sendMessage(opt)}
                        className="px-3 py-1.5 bg-white dark:bg-[#252035] border border-slate-200 dark:border-slate-600 rounded-full text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-primary/40 hover:bg-primary/5 dark:hover:bg-primary/10 hover:text-primary transition-all"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                {/* Action card */}
                {msg.action && !msg.streaming && (
                  <div className="ml-10">
                    <ActionCard
                      action={msg.action}
                      onConfirm={() => handleConfirmAction(msg.id, msg.action!)}
                      onCancel={() => handleCancelAction(msg.id)}
                    />
                  </div>
                )}
              </div>
            ))}

            {thinking && (
              <div className="flex gap-3 items-start">
                <div className="size-7 bg-primary rounded-full flex items-center justify-center text-white flex-shrink-0">
                  <span className="material-symbols-outlined text-sm">auto_awesome</span>
                </div>
                <div className="bg-slate-100 dark:bg-[#252035] px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1.5 items-center">
                  <span className="size-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="size-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="size-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className="mb-3 px-4 py-2.5 bg-slate-900 text-white text-xs font-medium rounded-xl shadow-lg flex items-center gap-2 animate-fade-in">
            {toast}
          </div>
        )}

        {/* Compact button (default state) */}
        {!expanded && (
          <button
            onClick={() => { setExpanded(true); setTimeout(() => inputRef.current?.focus(), 50); }}
            className="flex items-center gap-2 bg-primary text-white rounded-full px-5 py-3 text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-primary/40 hover:scale-105 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-base">auto_awesome</span>
            <span>Pudu AI</span>
          </button>
        )}

        {/* Expanded input bar */}
        {expanded && (
          <div className="relative group">
            <div className="absolute inset-0 rounded-3xl bg-primary/15 blur-2xl transition-all duration-300" />
            <div className="relative glass-panel border border-primary/30 rounded-3xl shadow-2xl shadow-primary/20 flex items-center p-2">
              <button
                onClick={() => setExpanded(false)}
                className="flex items-center gap-2 bg-primary text-white rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest flex-shrink-0 hover:scale-105 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-base">auto_awesome</span>
                <span>Pudu AI</span>
              </button>

              <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-3" />

              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') sendMessage(query.trim());
                  if (e.key === 'Escape') setExpanded(false);
                }}
                placeholder={flow ? `Responde o escribe "cancelar"...` : 'Escribe o elige una acción...'}
                className="flex-1 bg-transparent border-none focus:ring-0 outline-none text-sm font-medium placeholder:text-slate-400 dark:placeholder:text-slate-600 text-slate-800 dark:text-slate-100 py-2"
              />

              <div className="flex items-center gap-1 pr-2 flex-shrink-0">
                {query.trim() ? (
                  <button
                    onClick={() => sendMessage(query.trim())}
                    disabled={thinking}
                    className="size-8 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-base">send</span>
                  </button>
                ) : (
                  <kbd className="bg-slate-100 dark:bg-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400 px-2 py-1 rounded border border-slate-200 dark:border-slate-600">ESC</kbd>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      {expanded && (
        <div className="fixed inset-0 -z-10" onClick={() => setExpanded(false)} />
      )}
    </div>
  );
}
