const SII_API = '/api';

export type SiiEmpresa = {
  rut: string;
  razon_social: string;
  tipo_contribuyente: string;
  subtipo_contribuyente: string;
  direccion: string;
  comuna: string;
  provincia: string;
  region: string;
  fundada: string;
  actividades_economicas: { id: string; actividad: string }[];
  sucursales: { direccion: string; comuna: string; region: string }[];
  url_fuente: string;
};

// Extrae dígitos base del RUT sin el verificador.
// Acepta: 77.314.475-3 | 77314475-3 | 773144753 | 77314475
export function parseRutDigits(rut: string): string {
  // Quitar puntos y espacios
  const clean = rut.replace(/[.\s]/g, '');

  // Con guión: la base es todo lo que está antes
  if (clean.includes('-')) {
    return clean.split('-')[0].replace(/\D/g, '');
  }

  // Sin guión: quitar K/k final si existe
  const digits = clean.replace(/[kK]$/, '');

  // Si tiene 9+ dígitos, el último es el verificador
  if (digits.length >= 9) return digits.slice(0, -1);

  return digits;
}

// Detecta si un texto contiene un RUT chileno en cualquier formato
export function detectRut(text: string): string | null {
  // Formato con puntos y/o guión: 77.314.475-3 | 77314475-3 | 77.314.475
  const fmtMatch = text.match(/\b\d{1,2}\.?\d{3}\.?\d{3}[-]?[0-9kK]?\b/);
  if (fmtMatch) return fmtMatch[0];

  // Solo dígitos (7-9): 773144753 | 77314475
  const digitsMatch = text.match(/\b\d{7,9}\b/);
  if (digitsMatch) return digitsMatch[0];

  return null;
}

export async function lookupEmpresa(rut: string): Promise<SiiEmpresa | null> {
  const digits = parseRutDigits(rut);
  if (!digits || digits.length < 6) return null;

  try {
    const res = await fetch(`${SII_API}/empresa/${digits}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.mensaje) return null; // not found
    return data as SiiEmpresa;
  } catch {
    return null;
  }
}

export function siiToContext(empresa: SiiEmpresa): string {
  const giro = empresa.actividades_economicas?.[0]?.actividad ?? 'No especificado';
  return `[Datos SII para RUT ${empresa.rut}]
- Razón Social: ${empresa.razon_social}
- Giro principal: ${giro}
- Dirección: ${empresa.direccion}, ${empresa.comuna}
- Región: ${empresa.region}
- Tipo contribuyente: ${empresa.tipo_contribuyente}
- Fundada: ${empresa.fundada}`;
}
