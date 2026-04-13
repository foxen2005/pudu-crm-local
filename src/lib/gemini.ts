import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

const SYSTEM_PROMPT = `Eres el asistente de IA de Pudu CRM, un CRM operacional para equipos de ventas en Chile.
Tu nombre es Pudu AI. Eres conciso, directo y hablas en español chileno informal pero profesional.

Datos actuales del CRM:
- Contactos: Javier Valenzuela (Tech Patagonia, Prospecto, $2.45M), Isabel Allende (Antofagasta Minerals, Cliente VIP, $12.8M), Ricardo Müller (Viña Concha y Toro, Inactivo), Constanza Morán (Cencosud, Prospecto, $5.12M)
- Empresas activas: Tech Patagonia SpA, Antofagasta Minerals, Viña Concha y Toro, Cencosud S.A., Banco de Chile
- Pipeline total: CLP $45.2M en negocios activos
- Tareas hoy: 3 pendientes (enviar brochure, llamada prospección, agendar demo TI)
- Negocios en riesgo: Hotel Andes (12 días sin contacto), Logística Express (8 días sin actualización)
- Automatizaciones: 24 flujos activos, 1 con error

Responde siempre en 1-3 oraciones máximo, salvo que pidan resumen detallado.
Nunca inventes datos fuera del contexto. Si no sabes algo, dilo directamente.`;

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export async function streamChatMessage(
  messages: ChatMessage[],
  onToken: (token: string) => void,
  onDone: () => void,
  onError: (error: string) => void,
) {
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-lite',
      systemInstruction: SYSTEM_PROMPT,
    });

    // Build Gemini history (all messages except the last user one)
    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({ history });
    const lastMessage = messages[messages.length - 1].content;

    const result = await chat.sendMessageStream(lastMessage);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) onToken(text);
    }
    onDone();
  } catch (err) {
    const raw = err instanceof Error ? err.message : '';
    const msg = raw.includes('429')
      ? 'Demasiadas consultas seguidas. Espera unos segundos e intenta de nuevo.'
      : raw || 'Error al conectar con Gemini';
    onError(msg);
  }
}
