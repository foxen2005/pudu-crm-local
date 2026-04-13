import Groq from 'groq-sdk';

const client = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true,
});

export type CrmContext = {
  contactos: { nombre: string; apellido: string | null; empresa: string | null; estado: string; email: string | null; telefono: string | null }[];
  negocios: { nombre: string; empresa: string | null; etapa: string; valor: number | null; riesgo: boolean; fechaCierre: string | null }[];
  actividades: { tipo: string; titulo: string; relacionado: string | null; fechaHora: string | null; completada: boolean; prioridad: string }[];
  empresas: { razonSocial: string; ciudad: string | null; giro: string | null }[];
};

function buildSystemPrompt(ctx?: CrmContext) {
  const hoy = new Date();
  const fechaHoy = hoy.toISOString().slice(0, 10); // YYYY-MM-DD
  const manana = new Date(hoy); manana.setDate(manana.getDate() + 1);
  const fechaManana = manana.toISOString().slice(0, 10);

  // Build real CRM context section
  let crmSection = '## DATOS ACTUALES DEL CRM\n';
  if (!ctx) {
    crmSection += '(Sin datos disponibles — responde solo con la información que el usuario te dé)\n';
  } else {
    const todayStr = fechaHoy;
    const actHoy = ctx.actividades.filter(a => a.fechaHora?.startsWith(todayStr) && !a.completada);
    const negRiesgo = ctx.negocios.filter(n => n.riesgo);
    const totalPipeline = ctx.negocios.reduce((s, n) => s + (n.valor ?? 0), 0);

    crmSection += `- Contactos (${ctx.contactos.length} total): ${
      ctx.contactos.slice(0, 10).map(c =>
        `${c.nombre}${c.apellido ? ' ' + c.apellido : ''} (${c.empresa ?? 'sin empresa'}, ${c.estado}${c.telefono ? ', tel: ' + c.telefono : ''})`
      ).join('; ')
    }${ctx.contactos.length > 10 ? ` y ${ctx.contactos.length - 10} más` : ''}\n`;

    crmSection += `- Empresas (${ctx.empresas.length} total): ${
      ctx.empresas.slice(0, 8).map(e => `${e.razonSocial}${e.ciudad ? ' (' + e.ciudad + ')' : ''}`).join('; ')
    }${ctx.empresas.length > 8 ? ` y ${ctx.empresas.length - 8} más` : ''}\n`;

    crmSection += `- Pipeline: CLP $${totalPipeline.toLocaleString('es-CL')} total en ${ctx.negocios.length} negocios\n`;

    if (negRiesgo.length > 0) {
      crmSection += `- Negocios en riesgo: ${negRiesgo.map(n => `${n.nombre} (${n.empresa ?? '—'}, CLP $${(n.valor ?? 0).toLocaleString('es-CL')})`).join('; ')}\n`;
    } else {
      crmSection += `- Negocios en riesgo: ninguno\n`;
    }

    if (actHoy.length > 0) {
      crmSection += `- Actividades hoy (${actHoy.length} pendientes): ${actHoy.map(a => `${a.tipo} "${a.titulo}"${a.relacionado ? ' con ' + a.relacionado : ''} (${a.prioridad})`).join('; ')}\n`;
    } else {
      crmSection += `- Actividades hoy: ninguna pendiente\n`;
    }

    const negActivos = ctx.negocios.filter(n => !['Cerrado Ganado', 'Cerrado Perdido'].includes(n.etapa));
    crmSection += `- Negocios activos por etapa: ${['Prospección','Calificación','Propuesta','Negociación','Cierre'].map(e => {
      const count = negActivos.filter(n => n.etapa === e).length;
      return count > 0 ? `${e}: ${count}` : null;
    }).filter(Boolean).join(', ') || 'ninguno'}\n`;
  }

  return `Eres Pudu AI, el asistente inteligente de Pudu CRM para empresas chilenas.
Fecha actual del sistema: ${fechaHoy} (úsala para resolver "hoy", "mañana", "próximo lunes", etc.).
Hablas en español chileno informal pero profesional. Eres conciso y directo.

## REGLA CRÍTICA
NUNCA inventes datos. Si no tienes la información en el contexto del CRM, dilo directamente: "No tengo ese dato en el CRM". No asumas ni aluucines contactos, empresas, valores ni actividades.

## CONTEXTO CHILE
- Moneda: CLP (pesos chilenos). Siempre muestra montos como $XX.XXX.XXX
- RUT empresas: formato XX.XXX.XXX-X (ej: 76.123.456-7 o 12.345.678-K)
- RUT personas: mismo formato pero empieza con menos dígitos (ej: 12.345.678-9)
- IVA: 19% sobre el neto
- Condiciones de pago comunes: Contado, 30 días, 60 días, 90 días (Ley de pago a 30 días)
- Las 16 regiones: Arica y Parinacota, Tarapacá, Antofagasta, Atacama, Coquimbo, Valparaíso, Metropolitana, O'Higgins, Maule, Ñuble, Biobío, La Araucanía, Los Ríos, Los Lagos, Aysén, Magallanes

${crmSection}

## FLUJOS DE CREACIÓN
Cuando el usuario quiera crear algo, recoge los campos de a UNO por vez, de forma conversacional y natural. Valida el RUT si corresponde.

### CREAR EMPRESA — recopila en orden:
1. RUT de la empresa (formato XX.XXX.XXX-X) — SIEMPRE pide esto PRIMERO

**MUY IMPORTANTE — LOOKUP SII AUTOMÁTICO:**
Cuando el usuario te dé el RUT, el sistema automáticamente consulta el SII y te inyectará un bloque "[Datos SII para RUT ...]" en el contexto. Si recibes ese bloque:
- Extrae razón social, giro, dirección, comuna, región y fundación directamente de esos datos
- Muéstrale al usuario los datos encontrados: "Encontré esta empresa en el SII: [resumen]"
- Solo pide confirmación y los campos que FALTEN (teléfono, email, sitio web, tamaño, condiciones de pago)
- NO vuelvas a pedir campos que ya vienen del SII

Si NO hay datos SII (empresa no encontrada), continúa recogiendo manualmente:
2. Razón Social (nombre legal)
3. Giro comercial (actividad económica principal)
4. Región (de las 16 regiones de Chile)
5. Ciudad/Comuna
6. Dirección completa

Siempre pide al final (con o sin datos SII):
- Teléfono de contacto
- Email de contacto
- Sitio web (opcional)
- Tamaño de empresa (1-10, 11-50, 51-200, 201-1000, 1000+ empleados)
- Condiciones de pago preferidas

Cuando tengas TODOS los campos obligatorios, muestra un resumen y escribe al final en una línea separada:
[[ACTION:{"type":"empresa","razonSocial":"...","rut":"...","giro":"...","region":"...","ciudad":"...","direccion":"...","telefono":"...","email":"...","sitioWeb":"...","tamano":"...","condicionesPago":"..."}]]

### CREAR CONTACTO — recopila en orden:
1. Nombre
2. Apellido
3. Email
4. Teléfono
5. Cargo o posición en la empresa
6. Empresa donde trabaja
7. RUT personal (opcional, pregunta si lo tiene a mano)
8. Estado inicial (Prospecto, Cliente Activo, VIP, Inactivo)

Cuando tengas todos, escribe:
[[ACTION:{"type":"contacto","nombre":"...","apellido":"...","email":"...","telefono":"...","cargo":"...","empresa":"...","rut":"...","estado":"..."}]]

### CREAR NEGOCIO — recopila en orden:
1. Nombre o descripción del negocio
2. Empresa relacionada
3. Contacto principal
4. Valor estimado en CLP
5. Etapa actual (Prospección, Calificación, Propuesta, Negociación, Cierre)
6. Fecha estimada de cierre
7. Probabilidad de cierre en %
8. Descripción breve del negocio

Cuando tengas todos, escribe:
[[ACTION:{"type":"negocio","nombre":"...","empresa":"...","contacto":"...","valor":"...","etapa":"...","fechaCierre":"...","probabilidad":"...","descripcion":"..."}]]

### CREAR ACTIVIDAD — recopila en orden:
1. Tipo (Llamada, Reunión, Email o Tarea)
2. Título o descripción de la actividad
3. Empresa o contacto relacionado
4. Fecha y hora
5. Prioridad (Alta, Media, Baja)

IMPORTANTE: fechaHora SIEMPRE debe estar en formato ISO 8601: "YYYY-MM-DDTHH:MM:00"
- "hoy a las 15:00" → "${fechaHoy}T15:00:00"
- "mañana a las 11:00" → "${fechaManana}T11:00:00"
- Nunca uses texto como "Mañana a las 11:00 AM", siempre convierte a ISO.

Cuando tengas todos, escribe:
[[ACTION:{"type":"actividad","tipoActividad":"...","titulo":"...","relacionado":"...","fechaHora":"${fechaHoy}T00:00:00","prioridad":"..."}]]

## REGLAS IMPORTANTES
- Haz UNA sola pregunta a la vez, no bombardees con varias
- Si el usuario da varios datos juntos, acéptalos todos y pide solo los que falten
- Si el RUT no tiene el formato correcto, pide que lo corrija
- Cuando detectes intención de crear algo, confirma y empieza a recopilar
- Para consultas del CRM responde en máximo 2-3 oraciones
- Al final de un flujo de creación, muestra un resumen bonito antes del marcador [[ACTION:...]]`;
}

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type PendingAction = {
  type: 'empresa' | 'contacto' | 'negocio' | 'actividad';
  data: Record<string, string>;
};

export { toLocalIsoString };
// Serializa una Date al formato ISO con el offset local del navegador
// Ej. en Chile (UTC-3): 2026-03-26T11:00:00-03:00
// Así Supabase guarda la hora correcta independiente del servidor.
function toLocalIsoString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const offset = -d.getTimezoneOffset(); // minutos positivos = adelantado
  const sign = offset >= 0 ? '+' : '-';
  const oh = pad(Math.floor(Math.abs(offset) / 60));
  const om = pad(Math.abs(offset) % 60);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${oh}:${om}`
  );
}

// Convierte fechas en lenguaje natural o ISO sin TZ a ISO con offset local
function normalizeFechaHora(raw: string): string {
  if (!raw) return '';

  // Ya tiene info de zona horaria — respetar tal cual
  if (/[Z]$/.test(raw) || /[+-]\d{2}:\d{2}$/.test(raw)) return raw;

  // Es ISO sin zona horaria (lo que genera la IA) → parsear como hora local
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) {
    // new Date('2026-03-26T11:00:00') → JS interpreta como hora LOCAL
    return toLocalIsoString(new Date(raw));
  }

  // Texto en lenguaje natural → resolver día y hora
  const hoy = new Date();
  const lower = raw.toLowerCase();

  let base = new Date(hoy);
  if (lower.includes('mañana') || lower.includes('manana')) {
    base.setDate(base.getDate() + 1);
  } else if (lower.includes('pasado mañana') || lower.includes('pasado manana')) {
    base.setDate(base.getDate() + 2);
  }

  const horaMatch = raw.match(/(\d{1,2})[:h](\d{2})?\s*(am|pm)?/i);
  let horas = horaMatch ? parseInt(horaMatch[1]) : 9;
  const minutos = horaMatch?.[2] ? parseInt(horaMatch[2]) : 0;
  const periodo = horaMatch?.[3]?.toLowerCase();
  if (periodo === 'pm' && horas < 12) horas += 12;
  if (periodo === 'am' && horas === 12) horas = 0;

  base.setHours(horas, minutos, 0, 0);
  return toLocalIsoString(base);
}

export function parseAction(text: string): { clean: string; action: PendingAction | null } {
  const match = text.match(/\[\[ACTION:(\{.*?\})\]\]/s);
  if (!match) return { clean: text, action: null };
  try {
    const data = JSON.parse(match[1]);
    const { type, ...rest } = data;
    // Normalizar fechaHora si viene en texto libre
    if (rest.fechaHora && typeof rest.fechaHora === 'string') {
      rest.fechaHora = normalizeFechaHora(rest.fechaHora);
    }
    if (rest.fechaCierre && typeof rest.fechaCierre === 'string') {
      rest.fechaCierre = normalizeFechaHora(rest.fechaCierre).slice(0, 10);
    }
    return {
      clean: text.replace(match[0], '').trim(),
      action: { type, data: rest },
    };
  } catch {
    return { clean: text.replace(match[0], '').trim(), action: null };
  }
}

export type ReportInsight = {
  icon: string;
  titulo: string;
  descripcion: string;
  tipo: 'success' | 'warning' | 'info' | 'alert';
};

export async function getReportInsights(stats: string): Promise<ReportInsight[]> {
  const prompt = `Eres un analista de ventas experto en CRMs para empresas chilenas. Analiza los siguientes datos reales del pipeline y genera exactamente 4 insights accionables para el equipo de ventas. Responde SOLO con un JSON válido con la estructura indicada.

DATOS DEL PIPELINE:
${stats}

Responde con este JSON exacto (sin markdown, sin texto extra):
{"insights":[{"icon":"MATERIAL_ICON","titulo":"TITULO_CORTO","descripcion":"DESCRIPCION_EN_1_ORACION","tipo":"success|warning|info|alert"},...]}`

  try {
    const result = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    });
    const text = result.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(text);
    return Array.isArray(parsed.insights) ? parsed.insights : [];
  } catch {
    return [];
  }
}

export async function streamChatMessage(
  messages: ChatMessage[],
  onToken: (token: string) => void,
  onDone: () => void,
  onError: (error: string) => void,
  crmContext?: CrmContext,
) {
  try {
    const stream = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: buildSystemPrompt(crmContext) },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      stream: true,
      max_tokens: 1024,
    });

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content ?? '';
      if (token) onToken(token);
    }
    onDone();
  } catch (err) {
    const raw = err instanceof Error ? err.message : '';
    const msg = raw.includes('429')
      ? 'Demasiadas consultas seguidas. Espera unos segundos e intenta de nuevo.'
      : raw || 'Error al conectar con Groq';
    onError(msg);
  }
}
