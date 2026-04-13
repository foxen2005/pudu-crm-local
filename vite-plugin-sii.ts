import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import axios from 'axios';
import * as cheerio from 'cheerio';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
};

async function buscarRUT(rut: string): Promise<string | null> {
  const url = `https://www.portalchile.org/buscador_rut?buscar=${rut}&page=1`;
  const { data } = await axios.get(url, { headers: HEADERS, timeout: 10000 });
  const $ = cheerio.load(data);
  let empresaURL: string | null = null;
  $("a[href*='/empresa/']").each((_, el) => {
    if (!empresaURL) {
      empresaURL = 'https://www.portalchile.org' + $(el).attr('href');
    }
  });
  return empresaURL;
}

async function obtenerDetalleEmpresa(empresaURL: string) {
  const { data } = await axios.get(empresaURL, { headers: HEADERS, timeout: 10000 });
  const $ = cheerio.load(data);

  const campos: Record<string, string> = {};
  $('ul li').each((_, el) => {
    const texto = $(el).text().trim();
    const partes = texto.split(':');
    if (partes.length >= 2) {
      const clave = partes[0].trim();
      const valor = partes.slice(1).join(':').trim();
      campos[clave] = valor;
    }
  });

  const actividades: { id: string; actividad: string }[] = [];
  $("a[href*='/actividad-economica/']").each((_, el) => {
    const texto = $(el).text().trim();
    const idMatch = texto.match(/ID ACTIVIDAD:\s*(\d+)/);
    const actMatch = texto.match(/ACTIVIDAD:\s*(.+)/);
    if (idMatch && actMatch) {
      actividades.push({ id: idMatch[1].trim(), actividad: actMatch[1].trim() });
    }
  });

  const sucursales: { direccion: string; comuna: string | null; region: string | null }[] = [];
  $("a[href*='maps.google.com']").each((_, el) => {
    const texto = $(el).text().trim();
    if (texto.includes('COMUNA:')) {
      const comunaMatch = texto.match(/COMUNA:\s*([^/]+)/);
      const regionMatch = texto.match(/REGIÓN:\s*(.+)/);
      sucursales.push({
        direccion: texto.replace(/\s+/g, ' '),
        comuna: comunaMatch ? comunaMatch[1].trim() : null,
        region: regionMatch ? regionMatch[1].trim() : null,
      });
    }
  });

  const direccionTexto = campos['Dirección'] || '';
  const partesDir = direccionTexto.split(',').map((s) => s.trim());

  return {
    rut: campos['RUT'] || null,
    razon_social: $('h1').first().text().trim() || null,
    tipo_contribuyente: campos['Tipo Contribuyente'] || null,
    subtipo_contribuyente: campos['SubTipo Contribuyente'] || null,
    direccion: partesDir[0] || null,
    comuna: partesDir[1] || null,
    provincia: partesDir[2] || null,
    region: partesDir[3] || null,
    fundada: campos['Fundada'] || null,
    actividades_economicas: actividades,
    sucursales,
    url_fuente: empresaURL,
  };
}

function sendJSON(res: ServerResponse, status: number, data: unknown) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

export function siiPlugin(): Plugin {
  return {
    name: 'vite-plugin-sii',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const match = req.url?.match(/^\/api\/empresa\/(\d+)$/);
        if (!match) return next();

        const rut = match[1];
        try {
          const empresaURL = await buscarRUT(rut);
          if (!empresaURL) {
            return sendJSON(res, 404, { rut, mensaje: 'No se encontró empresa para este RUT.' });
          }
          const detalle = await obtenerDetalleEmpresa(empresaURL);
          sendJSON(res, 200, detalle);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          sendJSON(res, 500, { error: 'Error al consultar portalchile.org', detalle: msg });
        }
      });
    },
  };
}
