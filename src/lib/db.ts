import { supabase } from './supabase';
import type { PendingAction } from './groq';

// Obtiene el org_id del usuario actualmente autenticado
export async function getOrgIdPublic(): Promise<string | null> {
  return getOrgId();
}

async function getOrgId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('miembros')
    .select('org_id')
    .eq('user_id', user.id)
    .single();
  return data?.org_id ?? null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type Empresa = {
  id: string;
  razon_social: string;
  rut: string | null;
  giro: string | null;
  region: string | null;
  ciudad: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  sitio_web: string | null;
  tamano: string | null;
  condiciones_pago: string | null;
  created_at: string;
};

export type Contacto = {
  id: string;
  nombre: string;
  apellido: string | null;
  email: string | null;
  telefono: string | null;
  cargo: string | null;
  rut: string | null;
  empresa_id: string | null;
  empresa_nombre: string | null;
  estado: string;
  created_at: string;
};

export type Negocio = {
  id: string;
  nombre: string;
  empresa_id: string | null;
  empresa_nombre: string | null;
  contacto_id: string | null;
  contacto_nombre: string | null;
  valor: number | null;
  etapa: string;
  fecha_cierre: string | null;
  probabilidad: number | null;
  descripcion: string | null;
  riesgo: boolean;
  created_at: string;
};

export type Actividad = {
  id: string;
  tipo: string;
  titulo: string;
  relacionado: string | null;
  empresa_id: string | null;
  contacto_id: string | null;
  fecha_hora: string | null;
  prioridad: string;
  completada: boolean;
  created_by: string | null;
  created_at: string;
};

// ─── Result wrapper ───────────────────────────────────────────────────────────

export type DbResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Normaliza RUT chileno al formato 12345678-9 (sin puntos, con guión antes del dígito verificador)
function normalizeRut(rut: string): string {
  // Quitar puntos y espacios, uppercase
  const clean = rut.replace(/[\.\s]/g, '').toUpperCase();
  // Separar cuerpo y dígito verificador
  const withoutDash = clean.replace(/-/g, '');
  if (withoutDash.length < 2) return clean;
  return withoutDash.slice(0, -1) + '-' + withoutDash.slice(-1);
}

// ─── Empresas ─────────────────────────────────────────────────────────────────

export async function crearEmpresa(data: Record<string, string>): Promise<DbResult<Empresa>> {
  const org_id = await getOrgId();
  if (!org_id) return { ok: false, error: 'No autenticado' };

  const rutNorm = data.rut ? normalizeRut(data.rut) : null;

  const { data: row, error } = await supabase
    .from('empresas')
    .insert({
      org_id,
      razon_social: data.razonSocial,
      rut: rutNorm || null,
      giro: data.giro || null,
      region: data.region || null,
      ciudad: data.ciudad || null,
      direccion: data.direccion || null,
      telefono: data.telefono || null,
      email: data.email || null,
      sitio_web: data.sitioWeb && data.sitioWeb !== 'no' ? data.sitioWeb : null,
      tamano: data.tamano || null,
      condiciones_pago: data.condicionesPago || null,
    })
    .select()
    .single();

  if (error) {
    // Unique constraint on RUT — empresa ya existe, retornarla silenciosamente
    if ((error as { code?: string }).code === '23505' && rutNorm) {
      const existing = await buscarEmpresaPorRut(rutNorm);
      if (existing) return { ok: true, data: existing };
      return { ok: false, error: `Ya existe una empresa registrada con el RUT ${data.rut}` };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, data: row };
}

export async function getEmpresas(): Promise<DbResult<Empresa[]>> {
  const org_id = await getOrgId();
  if (!org_id) return { ok: false, error: 'No autenticado' };
  const { data, error } = await supabase
    .from('empresas')
    .select('*')
    .eq('org_id', org_id)
    .order('created_at', { ascending: false });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}

export async function buscarEmpresaPorNombre(nombre: string): Promise<Empresa | null> {
  const org_id = await getOrgId();
  if (!org_id) return null;
  const { data } = await supabase
    .from('empresas')
    .select('*')
    .eq('org_id', org_id)
    .ilike('razon_social', `%${nombre}%`)
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

// Sugerencias para autocomplete — devuelve hasta 6 coincidencias parciales
export async function buscarEmpresasSugerencias(query: string): Promise<Empresa[]> {
  if (!query || query.length < 2) return [];
  const org_id = await getOrgId();
  if (!org_id) return [];
  const { data } = await supabase
    .from('empresas')
    .select('*')
    .eq('org_id', org_id)
    .ilike('razon_social', `%${query}%`)
    .limit(6);
  return data ?? [];
}

export async function buscarEmpresaPorRut(rut: string): Promise<Empresa | null> {
  if (!rut) return null;
  const org_id = await getOrgId();
  if (!org_id) return null;
  // Usar solo el cuerpo numérico (sin puntos, sin dígito verificador)
  // para que "773144753", "77314475-3" y "77.314.475-3" coincidan igual
  const body = normalizeRut(rut).split('-')[0]; // ej: "77314475"
  const { data } = await supabase
    .from('empresas')
    .select('*')
    .eq('org_id', org_id)
    .ilike('rut', `%${body}%`)
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

// ─── Contactos ────────────────────────────────────────────────────────────────

export async function crearContacto(data: Record<string, string>): Promise<DbResult<Contacto>> {
  const org_id = await getOrgId();
  if (!org_id) return { ok: false, error: 'No autenticado' };

  let empresa_id: string | null = null;
  if (data.empresa) {
    // 1. Buscar por RUT (dedup exacto — no pueden existir 2 empresas con el mismo RUT)
    let empresa: Empresa | null = null;
    if (data.empresa_rut) empresa = await buscarEmpresaPorRut(data.empresa_rut);
    // 2. Buscar por nombre exacto
    if (!empresa) empresa = await buscarEmpresaPorNombre(data.empresa);
    // 3. Crear automáticamente si no existe
    if (!empresa) {
      const created = await crearEmpresa({
        razonSocial: data.empresa,
        rut: data.empresa_rut ?? '',
        giro: data.empresa_giro ?? '',
        ciudad: data.empresa_ciudad ?? '',
        tamano: data.empresa_tamano ?? '1-10',
      });
      if (created.ok) empresa = created.data;
    }
    empresa_id = empresa?.id ?? null;
  }

  const { data: row, error } = await supabase
    .from('contactos')
    .insert({
      org_id,
      nombre: data.nombre,
      apellido: data.apellido || null,
      email: data.email || null,
      telefono: data.telefono || null,
      cargo: data.cargo || null,
      rut: data.rut || null,
      empresa_id,
      empresa_nombre: data.empresa || null,
      estado: data.estado || 'Prospecto',
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: row };
}

export async function getContactos(): Promise<DbResult<Contacto[]>> {
  const org_id = await getOrgId();
  if (!org_id) return { ok: false, error: 'No autenticado' };
  const { data, error } = await supabase
    .from('contactos')
    .select('*')
    .eq('org_id', org_id)
    .order('created_at', { ascending: false });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}

// ─── Negocios ─────────────────────────────────────────────────────────────────

export async function crearNegocio(data: Record<string, string>): Promise<DbResult<Negocio>> {
  const org_id = await getOrgId();
  if (!org_id) return { ok: false, error: 'No autenticado' };

  let empresa_id: string | null = null;
  if (data.empresa) {
    const emp = await buscarEmpresaPorNombre(data.empresa);
    empresa_id = emp?.id ?? null;
  }

  const { data: { user } } = await supabase.auth.getUser();
  const { data: row, error } = await supabase
    .from('negocios')
    .insert({
      org_id,
      created_by: user?.id ?? null,
      nombre: data.nombre,
      empresa_id,
      empresa_nombre: data.empresa || null,
      contacto_nombre: data.contacto || null,
      valor: data.valor ? parseInt(data.valor.replace(/\D/g, '')) : null,
      etapa: data.etapa || 'Prospección',
      fecha_cierre: data.fechaCierre || null,
      probabilidad: data.probabilidad ? parseInt(data.probabilidad) : null,
      descripcion: data.descripcion || null,
      riesgo: data.riesgo === 'true',
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: row };
}

export async function getNegocios(): Promise<DbResult<Negocio[]>> {
  const org_id = await getOrgId();
  if (!org_id) return { ok: false, error: 'No autenticado' };
  const { data, error } = await supabase
    .from('negocios')
    .select('*')
    .eq('org_id', org_id)
    .order('created_at', { ascending: false });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}

// ─── Actividades ──────────────────────────────────────────────────────────────

export async function crearActividad(data: Record<string, string>): Promise<DbResult<Actividad>> {
  const org_id = await getOrgId();
  if (!org_id) return { ok: false, error: 'No autenticado' };

  const { data: { user } } = await supabase.auth.getUser();
  const { data: row, error } = await supabase
    .from('actividades')
    .insert({
      org_id,
      created_by: user?.id ?? null,
      tipo: (data.tipoActividad || 'tarea').toLowerCase(),
      titulo: data.titulo,
      relacionado: data.relacionado || null,
      contacto_id: data.contacto_id || null,
      empresa_id: data.empresa_id || null,
      fecha_hora: data.fechaHora || null,
      prioridad: data.prioridad || 'Media',
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: row };
}

export async function getActividades(): Promise<DbResult<Actividad[]>> {
  const org_id = await getOrgId();
  if (!org_id) return { ok: false, error: 'No autenticado' };
  const { data, error } = await supabase
    .from('actividades')
    .select('*')
    .eq('org_id', org_id)
    .order('fecha_hora', { ascending: true });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}

export async function toggleActividad(id: string, completada: boolean): Promise<void> {
  await supabase.from('actividades').update({ completada }).eq('id', id);
}

export async function actualizarActividad(id: string, data: Record<string, string>): Promise<DbResult<Actividad>> {
  const { data: row, error } = await supabase
    .from('actividades')
    .update({
      tipo: (data.tipoActividad || 'tarea').toLowerCase(),
      titulo: data.titulo,
      relacionado: data.relacionado || null,
      contacto_id: data.contacto_id || null,
      empresa_id: data.empresa_id || null,
      fecha_hora: data.fechaHora || null,
      prioridad: data.prioridad || 'Media',
    })
    .eq('id', id)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: row };
}

export async function eliminarActividad(id: string): Promise<DbResult<null>> {
  const org_id = await getOrgId();
  if (!org_id) return { ok: false, error: 'No autenticado' };
  const { error } = await supabase.from('actividades').delete().eq('id', id).eq('org_id', org_id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

// ─── Update / Delete ──────────────────────────────────────────────────────────

export async function actualizarEmpresa(id: string, data: Record<string, string>): Promise<DbResult<Empresa>> {
  const { data: row, error } = await supabase
    .from('empresas')
    .update({
      razon_social: data.razonSocial,
      rut: data.rut || null,
      giro: data.giro || null,
      ciudad: data.ciudad || null,
      direccion: data.direccion || null,
      sitio_web: data.sitioWeb || null,
      tamano: data.tamano || null,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: row };
}

export async function eliminarEmpresa(id: string): Promise<DbResult<null>> {
  const org_id = await getOrgId();
  if (!org_id) return { ok: false, error: 'No autenticado' };
  const { error } = await supabase.from('empresas').delete().eq('id', id).eq('org_id', org_id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export async function actualizarContacto(id: string, data: Record<string, string>): Promise<DbResult<Contacto>> {
  // Re-resolve empresa_id when empresa name changes
  let empresa_id: string | null = null;
  if (data.empresa) {
    const emp = data.empresa_rut
      ? await buscarEmpresaPorRut(data.empresa_rut) ?? await buscarEmpresaPorNombre(data.empresa)
      : await buscarEmpresaPorNombre(data.empresa);
    empresa_id = emp?.id ?? null;
  }

  const { data: row, error } = await supabase
    .from('contactos')
    .update({
      nombre: data.nombre,
      apellido: data.apellido || null,
      email: data.email || null,
      telefono: data.telefono || null,
      cargo: data.cargo || null,
      rut: data.rut || null,
      empresa_id: empresa_id,
      empresa_nombre: data.empresa || null,
      estado: data.estado,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: row };
}

export async function eliminarContacto(id: string): Promise<DbResult<null>> {
  const org_id = await getOrgId();
  if (!org_id) return { ok: false, error: 'No autenticado' };
  const { error } = await supabase.from('contactos').delete().eq('id', id).eq('org_id', org_id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export async function actualizarNegocio(id: string, data: Record<string, string>): Promise<DbResult<Negocio>> {
  const { data: row, error } = await supabase
    .from('negocios')
    .update({
      nombre: data.nombre,
      empresa_nombre: data.empresa || null,
      contacto_nombre: data.contacto || null,
      valor: data.valor ? parseInt(data.valor.replace(/\D/g, '')) : null,
      etapa: data.etapa || 'Prospección',
      fecha_cierre: data.fechaCierre || null,
      probabilidad: data.probabilidad ? parseInt(data.probabilidad) : null,
      descripcion: data.descripcion || null,
      riesgo: data.riesgo === 'true',
    })
    .eq('id', id)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: row };
}

export async function moverNegocioEtapa(id: string, etapa: string): Promise<DbResult<null>> {
  const org_id = await getOrgId();
  if (!org_id) return { ok: false, error: 'No autenticado' };
  const { error } = await supabase.from('negocios').update({ etapa }).eq('id', id).eq('org_id', org_id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export async function eliminarNegocio(id: string): Promise<DbResult<null>> {
  const org_id = await getOrgId();
  if (!org_id) return { ok: false, error: 'No autenticado' };
  const { error } = await supabase.from('negocios').delete().eq('id', id).eq('org_id', org_id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export type Miembro = { id: string; nombre: string | null; email: string | null; rol: string };

export async function getMiembros(): Promise<DbResult<Miembro[]>> {
  const org_id = await getOrgId();
  if (!org_id) return { ok: false, error: 'No autenticado' };
  const { data, error } = await supabase
    .from('miembros')
    .select('user_id, nombre, email, rol')
    .eq('org_id', org_id)
    .order('nombre');
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []).map(m => ({ id: m.user_id, nombre: m.nombre, email: m.email, rol: m.rol })) };
}

export async function actualizarMiembro(userId: string, nombre: string): Promise<DbResult<null>> {
  const { error } = await supabase.from('miembros').update({ nombre }).eq('user_id', userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export async function getNotificaciones(userId: string): Promise<Record<string, boolean> | null> {
  const { data, error } = await supabase
    .from('miembros')
    .select('notificaciones')
    .eq('user_id', userId)
    .single();
  if (error || !data) return null;
  return data.notificaciones as Record<string, boolean> | null;
}

export async function guardarNotificaciones(userId: string, notifs: Record<string, boolean>): Promise<void> {
  await supabase.from('miembros').update({ notificaciones: notifs }).eq('user_id', userId);
}

// ─── Invitaciones ─────────────────────────────────────────────────────────────

export async function crearInvitacion(
  orgId: string,
  nombreInvitado?: string,
  emailInvitado?: string,
): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('invitaciones')
    .insert({
      org_id: orgId,
      created_by: user?.id ?? null,
      nombre_invitado: nombreInvitado || null,
      email_invitado: emailInvitado || null,
    })
    .select('token')
    .single();
  if (error || !data) return null;
  return data.token as string;
}

export async function getInvitacion(token: string): Promise<{ orgId: string; orgNombre: string; nombreInvitado: string | null; emailInvitado: string | null } | null> {
  const { data } = await supabase
    .from('invitaciones')
    .select('org_id, nombre_invitado, email_invitado, organizaciones(nombre)')
    .eq('token', token)
    .is('used_at', null)
    .single();
  if (!data) return null;
  return {
    orgId: data.org_id,
    orgNombre: (Array.isArray(data.organizaciones) ? data.organizaciones[0] : data.organizaciones as { nombre: string } | null)?.nombre ?? '',
    nombreInvitado: data.nombre_invitado ?? null,
    emailInvitado: data.email_invitado ?? null,
  };
}

export type Invitacion = {
  id: string;
  token: string;
  created_at: string;
  used_at: string | null;
  nombre_invitado: string | null;
  email_invitado: string | null;
};

export async function listarInvitaciones(orgId: string): Promise<Invitacion[]> {
  const { data } = await supabase
    .from('invitaciones')
    .select('id, token, created_at, used_at, nombre_invitado, email_invitado')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  return (data ?? []) as Invitacion[];
}

export async function eliminarInvitacion(id: string): Promise<void> {
  await supabase.from('invitaciones').delete().eq('id', id);
}

// ─── Ranking del equipo ───────────────────────────────────────────────────────

export type RankingMiembro = {
  id: string;
  nombre: string | null;
  email: string | null;
  rol: string;
  puntos: number;
  negociosCreados: number;
  negociosCerrados: number;
  actividadesCompletadas: number;
  pipeline: number;
  medalla: '🥇' | '🥈' | '🥉' | null;
};

export async function getRankingEquipo(): Promise<RankingMiembro[]> {
  const org_id = await getOrgId();
  if (!org_id) return [];

  const [miembrosRes, negociosRes, actividadesRes] = await Promise.all([
    supabase.from('miembros').select('user_id, nombre, email, rol').eq('org_id', org_id),
    supabase.from('negocios').select('created_by, etapa, valor').eq('org_id', org_id),
    supabase.from('actividades').select('created_by, completada').eq('org_id', org_id),
  ]);

  const miembros = miembrosRes.data ?? [];
  const negocios = negociosRes.data ?? [];
  const actividades = actividadesRes.data ?? [];

  const ranked = miembros
    .map(m => {
      const misNegocios = negocios.filter(n => n.created_by === m.user_id);
      const cerrados = misNegocios.filter(n => ['Cierre', 'Cerrado Ganado'].includes(n.etapa));
      const completadas = actividades.filter(a => a.created_by === m.user_id && a.completada);
      const pipeline = misNegocios.reduce((s, n) => s + (n.valor ?? 0), 0);
      const puntos = misNegocios.length * 3 + cerrados.length * 15 + completadas.length * 1;
      return {
        id: m.user_id,
        nombre: m.nombre,
        email: m.email,
        rol: m.rol,
        puntos,
        negociosCreados: misNegocios.length,
        negociosCerrados: cerrados.length,
        actividadesCompletadas: completadas.length,
        pipeline,
        medalla: null as RankingMiembro['medalla'],
      };
    })
    .sort((a, b) => b.puntos - a.puntos);

  const medallas: RankingMiembro['medalla'][] = ['🥇', '🥈', '🥉'];
  ranked.forEach((m, i) => { if (i < 3) m.medalla = medallas[i]; });

  return ranked;
}

// ─── Customer 360 ─────────────────────────────────────────────────────────────

export type ContactoTimeline = { actividades: Actividad[]; negocios: Negocio[] };
export type EmpresaData360 = { contactos: Contacto[]; negocios: Negocio[] };

export async function getContactoById(id: string): Promise<Contacto | null> {
  const { data } = await supabase.from('contactos').select('*').eq('id', id).single();
  return data ?? null;
}

export async function getTimelineContacto(nombre: string, contacto_id?: string): Promise<ContactoTimeline> {
  const [a, n] = await Promise.all([
    contacto_id
      ? supabase.from('actividades').select('*').eq('contacto_id', contacto_id).order('fecha_hora', { ascending: false }).limit(100)
      : supabase.from('actividades').select('*').ilike('relacionado', `%${nombre}%`).order('fecha_hora', { ascending: false }).limit(10),
    contacto_id
      ? supabase.from('negocios').select('*').eq('contacto_id', contacto_id).order('created_at', { ascending: false }).limit(100)
      : supabase.from('negocios').select('*').ilike('contacto_nombre', `%${nombre}%`).order('created_at', { ascending: false }).limit(10),
  ]);
  return { actividades: a.data ?? [], negocios: n.data ?? [] };
}

export async function getEmpresaData360(nombre: string): Promise<EmpresaData360> {
  const [c, n] = await Promise.all([
    supabase.from('contactos').select('*').ilike('empresa_nombre', `%${nombre}%`).order('nombre'),
    supabase.from('negocios').select('*').ilike('empresa_nombre', `%${nombre}%`).order('created_at', { ascending: false }),
  ]);
  return { contactos: c.data ?? [], negocios: n.data ?? [] };
}

// ─── Dispatcher desde el chat ─────────────────────────────────────────────────

export async function ejecutarAccion(action: PendingAction): Promise<DbResult<unknown>> {
  switch (action.type) {
    case 'empresa':   return crearEmpresa(action.data);
    case 'contacto':  return crearContacto(action.data);
    case 'negocio':   return crearNegocio(action.data);
    case 'actividad': return crearActividad(action.data);
    default:          return { ok: false, error: 'Tipo de acción desconocido' };
  }
}

// ─── Búsqueda global ──────────────────────────────────────────────────────────

export type SearchResult = {
  type: 'contacto' | 'empresa' | 'negocio' | 'actividad';
  id: string;
  titulo: string;
  subtitulo: string;
  href: string;
};

export async function busquedaGlobal(query: string): Promise<SearchResult[]> {
  if (!query || query.length < 2) return [];
  const q = `%${query}%`;

  const [contactosRes, empresasRes, negociosRes, actividadesRes] = await Promise.all([
    supabase.from('contactos')
      .select('id, nombre, apellido, empresa_nombre, estado')
      .or(`nombre.ilike.${q},apellido.ilike.${q},empresa_nombre.ilike.${q},email.ilike.${q}`)
      .limit(4),
    supabase.from('empresas')
      .select('id, razon_social, ciudad, giro')
      .or(`razon_social.ilike.${q},rut.ilike.${q},ciudad.ilike.${q}`)
      .limit(4),
    supabase.from('negocios')
      .select('id, nombre, empresa_nombre, etapa, valor')
      .or(`nombre.ilike.${q},empresa_nombre.ilike.${q}`)
      .limit(3),
    supabase.from('actividades')
      .select('id, titulo, tipo, relacionado')
      .or(`titulo.ilike.${q},relacionado.ilike.${q}`)
      .limit(3),
  ]);

  const results: SearchResult[] = [];

  for (const c of contactosRes.data ?? []) {
    results.push({
      type: 'contacto',
      id: c.id,
      titulo: `${c.nombre}${c.apellido ? ' ' + c.apellido : ''}`,
      subtitulo: c.empresa_nombre ?? c.estado,
      href: `/contactos/${c.id}`,
    });
  }
  for (const e of empresasRes.data ?? []) {
    results.push({
      type: 'empresa',
      id: e.id,
      titulo: e.razon_social,
      subtitulo: [e.ciudad, e.giro].filter(Boolean).join(' · '),
      href: '/empresas',
    });
  }
  for (const n of negociosRes.data ?? []) {
    results.push({
      type: 'negocio',
      id: n.id,
      titulo: n.nombre,
      subtitulo: `${n.etapa}${n.valor ? ' · $' + Number(n.valor).toLocaleString('es-CL') : ''}`,
      href: '/negocios',
    });
  }
  for (const a of actividadesRes.data ?? []) {
    results.push({
      type: 'actividad',
      id: a.id,
      titulo: a.titulo,
      subtitulo: `${a.tipo}${a.relacionado ? ' · ' + a.relacionado : ''}`,
      href: '/actividades',
    });
  }

  return results;
}

// ─── Automatizaciones ─────────────────────────────────────────────────────────

export type Automatizacion = {
  id: string;
  org_id: string;
  nombre: string;
  trigger_tipo: string;
  trigger_dias: number;
  accion_tipo: string;
  accion_titulo: string;
  accion_tipo_actividad: string;
  activa: boolean;
  ejecuciones: number;
  created_at: string;
};

export async function getAutomatizaciones(): Promise<DbResult<Automatizacion[]>> {
  const org_id = await getOrgId();
  if (!org_id) return { ok: false, error: 'No autenticado' };
  const { data, error } = await supabase
    .from('automatizaciones')
    .select('*')
    .eq('org_id', org_id)
    .order('created_at', { ascending: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}

export async function crearAutomatizacion(fields: {
  nombre: string;
  trigger_tipo: string;
  trigger_dias: number;
  accion_tipo: string;
  accion_titulo: string;
  accion_tipo_actividad: string;
}): Promise<DbResult<Automatizacion>> {
  const org_id = await getOrgId();
  if (!org_id) return { ok: false, error: 'No autenticado' };
  const { data: row, error } = await supabase
    .from('automatizaciones')
    .insert({ org_id, ...fields })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: row };
}

export async function toggleAutomatizacion(id: string, activa: boolean): Promise<DbResult<null>> {
  const org_id = await getOrgId();
  if (!org_id) return { ok: false, error: 'No autenticado' };
  const { error } = await supabase.from('automatizaciones').update({ activa }).eq('id', id).eq('org_id', org_id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export async function eliminarAutomatizacion(id: string): Promise<DbResult<null>> {
  const org_id = await getOrgId();
  if (!org_id) return { ok: false, error: 'No autenticado' };
  const { error } = await supabase.from('automatizaciones').delete().eq('id', id).eq('org_id', org_id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export async function actualizarAutomatizacion(id: string, fields: {
  nombre: string;
  trigger_tipo: string;
  trigger_dias: number;
  accion_tipo: string;
  accion_titulo: string;
  accion_tipo_actividad: string;
}): Promise<DbResult<null>> {
  const org_id = await getOrgId();
  if (!org_id) return { ok: false, error: 'No autenticado' };
  const { error } = await supabase.from('automatizaciones').update(fields).eq('id', id).eq('org_id', org_id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export async function evaluarAutomatizaciones(): Promise<{ fired: number; errors: string[] }> {
  const org_id = await getOrgId();
  if (!org_id) return { fired: 0, errors: ['No autenticado'] };

  const [autosRes, negociosRes, actividadesRes, logsRes] = await Promise.all([
    supabase.from('automatizaciones').select('*').eq('org_id', org_id).eq('activa', true),
    supabase.from('negocios').select('*').eq('org_id', org_id),
    supabase.from('actividades').select('*').eq('org_id', org_id),
    supabase.from('automatizaciones_log').select('*').eq('org_id', org_id)
      .gte('fired_at', new Date(Date.now() - 30 * 86400000).toISOString()),
  ]);

  const autos: Automatizacion[] = autosRes.data ?? [];
  const negocios: Negocio[] = negociosRes.data ?? [];
  const actividades: Actividad[] = actividadesRes.data ?? [];
  const logs = logsRes.data ?? [];

  let fired = 0;
  const errors: string[] = [];

  for (const auto of autos) {
    const cutoffMs = auto.trigger_dias * 86400000;
    const cutoff = new Date(Date.now() - cutoffMs);

    const candidatos = (() => {
      if (auto.trigger_tipo === 'deal_idle') {
        return negocios.filter(n => n.etapa !== 'Cierre');
      }
      if (auto.trigger_tipo === 'deal_created') {
        return negocios.filter(n => new Date(n.created_at) >= cutoff);
      }
      if (auto.trigger_tipo === 'deal_won') {
        return negocios.filter(n => n.etapa === 'Cierre');
      }
      return [];
    })();

    for (const negocio of candidatos) {
      // Skip if already fired for this negocio within cooldown
      const alreadyFired = logs.some(
        l => l.automatizacion_id === auto.id && l.negocio_id === negocio.id &&
             new Date(l.fired_at) >= cutoff
      );
      if (alreadyFired) continue;

      // For deal_idle: skip if there's a recent activity
      if (auto.trigger_tipo === 'deal_idle') {
        const lastActivity = actividades
          .filter(a =>
            a.relacionado?.toLowerCase().includes(negocio.nombre.toLowerCase()) ||
            (negocio.empresa_nombre && a.relacionado?.toLowerCase().includes(negocio.empresa_nombre.toLowerCase()))
          )
          .reduce((latest, a) => {
            if (!a.fecha_hora) return latest;
            const d = new Date(a.fecha_hora);
            return d > latest ? d : latest;
          }, new Date(negocio.created_at));

        if (lastActivity >= cutoff) continue;
      }

      // Execute action
      if (auto.accion_tipo === 'crear_actividad') {
        const res = await crearActividad({
          tipoActividad: auto.accion_tipo_actividad,
          titulo: `${auto.accion_titulo} — ${negocio.nombre}`,
          relacionado: negocio.nombre,
          fechaHora: '',
          prioridad: 'Alta',
        });
        if (!res.ok) { errors.push(res.error); continue; }
      } else if (auto.accion_tipo === 'marcar_riesgo') {
        const { error } = await supabase
          .from('negocios').update({ riesgo: true }).eq('id', negocio.id);
        if (error) { errors.push(error.message); continue; }
      }

      // Log the execution
      await supabase.from('automatizaciones_log').insert({
        org_id,
        automatizacion_id: auto.id,
        negocio_id: negocio.id,
      });

      // Increment counter
      await supabase.from('automatizaciones')
        .update({ ejecuciones: auto.ejecuciones + 1 })
        .eq('id', auto.id);

      fired++;
    }
  }

  return { fired, errors };
}

// ─── WhatsApp Business ────────────────────────────────────────────────────────

export type WaCredentials = {
  phoneNumberId: string;
  accessToken: string;
  verifyToken: string;
};

export type WaConversacion = {
  id: string;
  org_id: string;
  contact_id: string | null;
  contact_phone: string;
  contact_nombre: string | null;
  status: string;
  last_message_at: string | null;
  session_expires_at: string | null;
  created_at: string;
};

export type WaMensaje = {
  id: string;
  conversation_id: string;
  wamid: string | null;
  direction: 'inbound' | 'outbound';
  message_type: string;
  body: string | null;
  status: string;
  sent_by_nombre: string | null;
  created_at: string;
};

// Cache para no ir a Supabase en cada apertura de contacto
let _waCreds: WaCredentials | null | undefined = undefined;

export async function getWaCredentials(): Promise<WaCredentials | null> {
  // Servidor local tiene prioridad — si está conectado, retornar creds virtuales
  try {
    const org_id = await getOrgId();
    const localStatus = await getWaLocalStatus(org_id ?? undefined);
    if (localStatus?.connected) {
      return { phoneNumberId: 'local', accessToken: 'local', verifyToken: '' };
    }
  } catch { /* ignorar */ }

  if (_waCreds !== undefined) return _waCreds;
  const org_id = await getOrgId();
  if (!org_id) return null;
  const { data } = await supabase
    .from('organizaciones')
    .select('wa_phone_number_id, wa_access_token, wa_verify_token')
    .eq('id', org_id)
    .single();
  _waCreds = (data?.wa_phone_number_id && data?.wa_access_token)
    ? { phoneNumberId: data.wa_phone_number_id, accessToken: data.wa_access_token, verifyToken: data.wa_verify_token ?? '' }
    : null;
  return _waCreds;
}

export async function saveWaCredentials(creds: WaCredentials): Promise<DbResult<null>> {
  const org_id = await getOrgId();
  if (!org_id) return { ok: false, error: 'No autenticado' };
  const { error } = await supabase
    .from('organizaciones')
    .update({
      wa_phone_number_id: creds.phoneNumberId,
      wa_access_token: creds.accessToken,
      wa_verify_token: creds.verifyToken,
    })
    .eq('id', org_id);
  if (error) return { ok: false, error: error.message };
  _waCreds = undefined; // invalidar cache
  return { ok: true, data: null };
}

export async function getOrCreateWaConversacion(
  contactId: string,
  phone: string,
  nombre: string,
): Promise<DbResult<WaConversacion>> {
  const org_id = await getOrgId();
  if (!org_id) return { ok: false, error: 'No autenticado' };

  // 1. Try to find by contact_id (already linked)
  const { data: byId } = await supabase
    .from('whatsapp_conversations')
    .select('*')
    .eq('org_id', org_id)
    .eq('contact_id', contactId)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (byId) return { ok: true, data: byId };

  // 2. Try to find by phone number (last 9 digits) — auto-link it
  const normPhone = phone.replace(/\D/g, '').slice(-9);
  const { data: allByOrg } = await supabase
    .from('whatsapp_conversations')
    .select('*')
    .eq('org_id', org_id)
    .order('last_message_at', { ascending: false });

  const byPhone = (allByOrg ?? []).find(
    c => c.contact_phone.replace(/\D/g, '').slice(-9) === normPhone
  );

  if (byPhone) {
    // Auto-link this conversation to the contact
    await supabase
      .from('whatsapp_conversations')
      .update({ contact_id: contactId, contact_nombre: nombre })
      .eq('id', byPhone.id);
    return { ok: true, data: { ...byPhone, contact_id: contactId, contact_nombre: nombre } };
  }

  // 3. No existing conversation — create a new one
  const { data: created, error } = await supabase
    .from('whatsapp_conversations')
    .insert({ org_id, contact_id: contactId, contact_phone: phone, contact_nombre: nombre, status: 'open' })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: created };
}

/**
 * Solo busca una conversación existente por contact_id o teléfono.
 * NO crea nada. Retorna null si no hay historial previo.
 */
export async function findWaConversacion(
  contactId: string,
  phone: string,
  nombre: string,
): Promise<WaConversacion | null> {
  const org_id = await getOrgId();
  if (!org_id) return null;

  const normPhone = phone.replace(/\D/g, '').slice(-9);

  // Traer todas las convs del org, ordenadas: las que tienen mensajes primero
  const { data: all } = await supabase
    .from('whatsapp_conversations')
    .select('*')
    .eq('org_id', org_id)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  const convs = all ?? [];

  // 1. Exacto: contact_id vinculado Y con mensajes
  const byIdWithMsgs = convs.find(c => c.contact_id === contactId && c.last_message_at != null);
  if (byIdWithMsgs) return byIdWithMsgs;

  // 2. Por teléfono con mensajes — auto-vincula
  const byPhoneWithMsgs = convs.find(c =>
    c.contact_phone.replace(/\D/g, '').slice(-9) === normPhone && c.last_message_at != null
  );
  if (byPhoneWithMsgs) {
    await supabase.from('whatsapp_conversations')
      .update({ contact_id: contactId, contact_nombre: nombre })
      .eq('id', byPhoneWithMsgs.id);
    return { ...byPhoneWithMsgs, contact_id: contactId, contact_nombre: nombre };
  }

  // 3. contact_id vinculado (aunque esté vacío)
  const byId = convs.find(c => c.contact_id === contactId);
  if (byId) return byId;

  // 4. Por teléfono vacío — auto-vincula
  const byPhone = convs.find(c =>
    c.contact_phone.replace(/\D/g, '').slice(-9) === normPhone
  );
  if (byPhone) {
    await supabase.from('whatsapp_conversations')
      .update({ contact_id: contactId, contact_nombre: nombre })
      .eq('id', byPhone.id);
    return { ...byPhone, contact_id: contactId, contact_nombre: nombre };
  }

  return null;
}

export async function getWaConversaciones(): Promise<DbResult<WaConversacion[]>> {
  const org_id = await getOrgId();
  if (!org_id) return { ok: false, error: 'No autenticado' };
  const { data, error } = await supabase
    .from('whatsapp_conversations')
    .select('*')
    .eq('org_id', org_id)
    .order('last_message_at', { ascending: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}

export async function getWaMensajes(conversationId: string): Promise<DbResult<WaMensaje[]>> {
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}

/**
 * Returns all WA messages (across any conversation) that match a phone number
 * by comparing the last 9 digits. Used for enriched contact history.
 */
export async function getWaHistorialByPhone(phone: string): Promise<WaMensaje[]> {
  const org_id = await getOrgId();
  if (!org_id || !phone) return [];

  // Fetch all conversations for this org that share the last 9 digits of the phone
  const normalized = phone.replace(/\D/g, '').slice(-9);
  const { data: convs } = await supabase
    .from('whatsapp_conversations')
    .select('id, contact_phone')
    .eq('org_id', org_id);

  if (!convs) return [];
  const matchingIds = convs
    .filter(c => c.contact_phone.replace(/\D/g, '').slice(-9) === normalized)
    .map(c => c.id);

  if (matchingIds.length === 0) return [];

  const { data } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .in('conversation_id', matchingIds)
    .order('created_at', { ascending: true })
    .limit(200);

  return data ?? [];
}

import { WA_URL as WA_LOCAL_URL } from '@/lib/wa-url';

// Lee wa_activo de Supabase para el org actual
export async function getWaActivoOrg(): Promise<boolean> {
  const org_id = await getOrgId();
  if (!org_id) return false;
  const { data } = await supabase
    .from('organizaciones')
    .select('wa_activo')
    .eq('id', org_id)
    .single();
  return data?.wa_activo ?? false;
}

// Persiste el estado de conexión WA en Supabase
export async function setWaActivoOrg(activo: boolean): Promise<void> {
  const org_id = await getOrgId();
  if (!org_id) return;
  await supabase.from('organizaciones').update({ wa_activo: activo }).eq('id', org_id);
}

// Verifica si el servidor local está activo y conectado
export async function getWaLocalStatus(orgId?: string): Promise<{ connected: boolean; phone: string | null; qrPending: boolean } | null> {
  try {
    const url = orgId ? `${WA_LOCAL_URL}/status?orgId=${orgId}` : `${WA_LOCAL_URL}/status`;
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      connected: data.connected ?? false,
      phone: data.phone ?? null,
      qrPending: data.status === 'qr_ready',
    };
  } catch {
    return null;
  }
}

export async function getWaLocalQr(orgId?: string): Promise<string | null> {
  try {
    const url = orgId ? `${WA_LOCAL_URL}/qr?orgId=${orgId}` : `${WA_LOCAL_URL}/qr`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data.qr ?? null;
  } catch {
    return null;
  }
}

export async function sendWaMensaje(
  conversationId: string,
  body: string,
  phone: string,
  senderNombre: string,
): Promise<DbResult<WaMensaje>> {
  const org_id = await getOrgId();
  if (!org_id) return { ok: false, error: 'No autenticado' };

  // ── Intentar servidor local primero ──────────────────────────────────────
  const localStatus = await getWaLocalStatus();
  if (localStatus?.connected) {
    try {
      const res = await fetch(`${WA_LOCAL_URL}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, phone, body, orgId: org_id, senderNombre }),
      });
      const json = await res.json();
      if (res.ok) return { ok: true, data: json.data };
      return { ok: false, error: json.error ?? 'Error enviando mensaje' };
    } catch (err) {
      return { ok: false, error: 'Servidor local no responde' };
    }
  }

  // ── Fallback: Meta Cloud API ──────────────────────────────────────────────
  const creds = await getWaCredentials();
  if (!creds) return { ok: false, error: 'WhatsApp no configurado' };

  // Call Meta Graph API
  const res = await fetch(`https://graph.facebook.com/v20.0/${creds.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${creds.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'text',
      text: { body },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: (err as { error?: { message?: string } }).error?.message ?? 'Error enviando mensaje' };
  }

  const result = await res.json() as { messages?: [{ id: string }] };
  const wamid = result.messages?.[0]?.id ?? null;

  // Save to DB
  const { data: row, error } = await supabase
    .from('whatsapp_messages')
    .insert({
      org_id,
      conversation_id: conversationId,
      wamid,
      direction: 'outbound',
      message_type: 'text',
      body,
      status: 'sent',
      sent_by_nombre: senderNombre,
    })
    .select()
    .single();

  // Update conversation last_message_at
  await supabase.from('whatsapp_conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: row };
}

// ─── Adjuntos ──────────────────────────────────────────────────────────────────

export type Adjunto = {
  id: string;
  org_id: string;
  entidad_tipo: 'negocio' | 'contacto';
  entidad_id: string;
  nombre: string;
  url: string;
  size: number | null;
  mime_type: string | null;
  created_by: string | null;
  created_at: string;
};

export async function getAdjuntos(entidadTipo: 'negocio' | 'contacto', entidadId: string): Promise<Adjunto[]> {
  const org_id = await getOrgId();
  const { data } = await supabase
    .from('adjuntos')
    .select('*')
    .eq('org_id', org_id)
    .eq('entidad_tipo', entidadTipo)
    .eq('entidad_id', entidadId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function subirAdjunto(
  entidadTipo: 'negocio' | 'contacto',
  entidadId: string,
  file: File
): Promise<Adjunto | null> {
  const org_id = await getOrgId();
  const { data: { user } } = await supabase.auth.getUser();
  const path = `${org_id}/${entidadTipo}/${entidadId}/${Date.now()}_${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from('adjuntos')
    .upload(path, file, { upsert: false });
  if (uploadError) return null;

  const { data: { publicUrl } } = supabase.storage.from('adjuntos').getPublicUrl(path);

  const { data } = await supabase
    .from('adjuntos')
    .insert({ org_id, entidad_tipo: entidadTipo, entidad_id: entidadId, nombre: file.name, url: publicUrl, size: file.size, mime_type: file.type, created_by: user?.id })
    .select()
    .single();
  return data;
}

export async function eliminarAdjunto(id: string, url: string): Promise<void> {
  const marker = '/adjuntos/';
  const idx = url.indexOf(marker);
  if (idx !== -1) {
    const path = decodeURIComponent(url.slice(idx + marker.length));
    await supabase.storage.from('adjuntos').remove([path]);
  }
  await supabase.from('adjuntos').delete().eq('id', id);
}

// ─── Cotizaciones ──────────────────────────────────────────────────────────────

export type CotizacionItem = {
  id: string;
  cotizacion_id: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  descuento: number;
};

export type Cotizacion = {
  id: string;
  org_id: string;
  negocio_id: string;
  numero: number;
  titulo: string;
  fecha: string;
  validez_dias: number;
  moneda: string;
  notas: string | null;
  estado: 'borrador' | 'enviada' | 'aceptada' | 'rechazada';
  created_by: string | null;
  created_at: string;
  items: CotizacionItem[];
};

export async function getCotizaciones(negocioId: string): Promise<Cotizacion[]> {
  const { data } = await supabase
    .from('cotizaciones')
    .select('*, cotizacion_items(*)')
    .eq('negocio_id', negocioId)
    .order('created_at', { ascending: false });
  return (data ?? []).map((c: Record<string, unknown>) => ({ ...c, items: (c.cotizacion_items as CotizacionItem[]) ?? [] })) as Cotizacion[];
}

export async function crearCotizacion(
  negocioId: string,
  fields: Pick<Cotizacion, 'titulo' | 'fecha' | 'validez_dias' | 'moneda' | 'notas' | 'estado'>,
  items: Pick<CotizacionItem, 'descripcion' | 'cantidad' | 'precio_unitario' | 'descuento'>[]
): Promise<Cotizacion | null> {
  const org_id = await getOrgId();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: cot } = await supabase
    .from('cotizaciones')
    .insert({ ...fields, org_id, negocio_id: negocioId, created_by: user?.id })
    .select()
    .single();
  if (!cot) return null;
  if (items.length > 0) {
    await supabase.from('cotizacion_items').insert(items.map(i => ({ ...i, cotizacion_id: cot.id })));
  }
  return { ...cot, items: [] };
}

export async function actualizarCotizacion(
  id: string,
  fields: Partial<Pick<Cotizacion, 'titulo' | 'fecha' | 'validez_dias' | 'moneda' | 'notas' | 'estado'>>,
  items?: Pick<CotizacionItem, 'descripcion' | 'cantidad' | 'precio_unitario' | 'descuento'>[]
): Promise<boolean> {
  const { error } = await supabase.from('cotizaciones').update(fields).eq('id', id);
  if (error) return false;
  if (items !== undefined) {
    await supabase.from('cotizacion_items').delete().eq('cotizacion_id', id);
    if (items.length > 0) {
      await supabase.from('cotizacion_items').insert(items.map(i => ({ ...i, cotizacion_id: id })));
    }
  }
  return true;
}

export async function eliminarCotizacion(id: string): Promise<void> {
  await supabase.from('cotizaciones').delete().eq('id', id);
}

// ─── Notificaciones ────────────────────────────────────────────────────────────

export type Notificacion = {
  id: string;
  org_id: string;
  user_id: string;
  tipo: string;
  titulo: string;
  descripcion: string | null;
  entidad_tipo: string | null;
  entidad_id: string | null;
  leida: boolean;
  created_at: string;
};

export async function getAlertas(limite = 30): Promise<Notificacion[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from('notificaciones')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limite);
  return data ?? [];
}

export async function marcarLeida(id: string): Promise<void> {
  await supabase.from('notificaciones').update({ leida: true }).eq('id', id);
}

export async function marcarTodasLeidas(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('notificaciones').update({ leida: true }).eq('user_id', user.id).eq('leida', false);
}

export async function generarNotificacionLocal(
  tipo: string,
  titulo: string,
  descripcion?: string,
  entidadTipo?: string,
  entidadId?: string
): Promise<void> {
  const org_id = await getOrgId();
  const { data: { user } } = await supabase.auth.getUser();
  if (!org_id || !user) return;
  await supabase.from('notificaciones').insert({
    org_id, user_id: user.id, tipo, titulo, descripcion: descripcion ?? null,
    entidad_tipo: entidadTipo ?? null, entidad_id: entidadId ?? null,
  });
}

// ─── Productos ─────────────────────────────────────────────────────────────────

export type Producto = {
  id: string;
  org_id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  unidad: string;
  categoria: string | null;
  activo: boolean;
  created_at: string;
};

export async function getProductos(): Promise<Producto[]> {
  const org_id = await getOrgId();
  const { data } = await supabase
    .from('productos')
    .select('*')
    .eq('org_id', org_id)
    .eq('activo', true)
    .order('nombre');
  return data ?? [];
}

export async function crearProducto(fields: Pick<Producto, 'nombre' | 'descripcion' | 'precio' | 'unidad' | 'categoria'>): Promise<Producto | null> {
  const org_id = await getOrgId();
  const { data } = await supabase.from('productos').insert({ ...fields, org_id }).select().single();
  return data;
}

export async function actualizarProducto(id: string, fields: Partial<Pick<Producto, 'nombre' | 'descripcion' | 'precio' | 'unidad' | 'categoria' | 'activo'>>): Promise<boolean> {
  const { error } = await supabase.from('productos').update(fields).eq('id', id);
  return !error;
}

export async function eliminarProducto(id: string): Promise<void> {
  await supabase.from('productos').update({ activo: false }).eq('id', id);
}

// ─── Emails enviados (tracking) ────────────────────────────────────────────────

export type EmailEnviado = {
  id: string;
  org_id: string;
  contacto_id: string | null;
  asunto: string;
  destinatario: string;
  enviado_at: string;
  abierto_at: string | null;
  aperturas: number;
  created_by: string | null;
};

export async function registrarEmailEnviado(
  asunto: string,
  destinatario: string,
  contactoId?: string
): Promise<EmailEnviado | null> {
  const org_id = await getOrgId();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase
    .from('emails_enviados')
    .insert({ org_id, asunto, destinatario, contacto_id: contactoId ?? null, created_by: user?.id })
    .select()
    .single();
  return data;
}

export async function getEmailsEnviados(contactoId: string): Promise<EmailEnviado[]> {
  const { data } = await supabase
    .from('emails_enviados')
    .select('*')
    .eq('contacto_id', contactoId)
    .order('enviado_at', { ascending: false });
  return data ?? [];
}

// ─── Campos personalizados ─────────────────────────────────────────────────────

export type CampoDefinicion = {
  id: string;
  org_id: string;
  entidad_tipo: 'contacto' | 'empresa' | 'negocio';
  nombre: string;
  clave: string;
  tipo: 'texto' | 'numero' | 'fecha' | 'select' | 'checkbox';
  opciones: string[];
  requerido: boolean;
  orden: number;
};

export async function getCamposDefinicion(entidadTipo?: 'contacto' | 'empresa' | 'negocio'): Promise<CampoDefinicion[]> {
  const org_id = await getOrgId();
  let q = supabase.from('campos_definicion').select('*').eq('org_id', org_id).order('orden');
  if (entidadTipo) q = q.eq('entidad_tipo', entidadTipo);
  const { data } = await q;
  return (data ?? []).map(r => ({ ...r, opciones: r.opciones ?? [] }));
}

export async function crearCampoDefinicion(
  fields: Pick<CampoDefinicion, 'entidad_tipo' | 'nombre' | 'clave' | 'tipo' | 'opciones' | 'requerido' | 'orden'>
): Promise<CampoDefinicion | null> {
  const org_id = await getOrgId();
  const { data } = await supabase
    .from('campos_definicion')
    .insert({ ...fields, org_id, opciones: fields.opciones ?? [] })
    .select()
    .single();
  return data ? { ...data, opciones: data.opciones ?? [] } : null;
}

export async function eliminarCampoDefinicion(id: string): Promise<void> {
  await supabase.from('campos_definicion').delete().eq('id', id);
}

export async function guardarCamposExtra(
  tabla: 'contactos' | 'empresas' | 'negocios',
  id: string,
  campos: Record<string, unknown>
): Promise<void> {
  await supabase.from(tabla).update({ campos_extra: campos }).eq('id', id);
}

// ─── Pipelines ─────────────────────────────────────────────────────────────────

export type PipelineEtapa = { id: string; label: string; color: string; orden: number };

export type Pipeline = {
  id: string;
  org_id: string;
  nombre: string;
  etapas: PipelineEtapa[];
  color: string;
  activo: boolean;
  orden: number;
  created_at: string;
};

export async function getPipelines(): Promise<Pipeline[]> {
  const org_id = await getOrgId();
  const { data } = await supabase
    .from('pipelines')
    .select('*')
    .eq('org_id', org_id)
    .eq('activo', true)
    .order('orden');
  return (data ?? []).map(p => ({ ...p, etapas: p.etapas ?? [] }));
}

export async function crearPipeline(fields: Pick<Pipeline, 'nombre' | 'etapas' | 'color' | 'orden'>): Promise<Pipeline | null> {
  const org_id = await getOrgId();
  const { data } = await supabase.from('pipelines').insert({ ...fields, org_id }).select().single();
  return data ? { ...data, etapas: data.etapas ?? [] } : null;
}

export async function actualizarPipeline(id: string, fields: Partial<Pick<Pipeline, 'nombre' | 'etapas' | 'color' | 'activo' | 'orden'>>): Promise<boolean> {
  const { error } = await supabase.from('pipelines').update(fields).eq('id', id);
  return !error;
}

export async function eliminarPipeline(id: string): Promise<void> {
  await supabase.from('pipelines').update({ activo: false }).eq('id', id);
}

// ─── Duplicados ────────────────────────────────────────────────────────────────

export async function buscarDuplicadosContacto(nombre: string, email?: string): Promise<Contacto[]> {
  const org_id = await getOrgId();
  if (!org_id) return [];
  const filters: unknown[] = [];
  const nombreLike = `%${nombre.trim().split(' ')[0]}%`;
  const { data: byNombre } = await supabase
    .from('contactos')
    .select('*')
    .eq('org_id', org_id)
    .ilike('nombre', nombreLike)
    .limit(5);
  filters.push(...(byNombre ?? []));
  if (email) {
    const { data: byEmail } = await supabase
      .from('contactos')
      .select('*')
      .eq('org_id', org_id)
      .eq('email', email.toLowerCase().trim())
      .limit(3);
    filters.push(...(byEmail ?? []));
  }
  const seen = new Set<string>();
  return (filters as Contacto[]).filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });
}

export async function buscarDuplicadosEmpresa(nombre: string, rut?: string): Promise<Empresa[]> {
  const org_id = await getOrgId();
  if (!org_id) return [];
  const results: Empresa[] = [];
  const { data: byNombre } = await supabase
    .from('empresas')
    .select('*')
    .eq('org_id', org_id)
    .ilike('razon_social', `%${nombre.trim().split(' ')[0]}%`)
    .limit(5);
  results.push(...(byNombre ?? []));
  if (rut) {
    const { data: byRut } = await supabase
      .from('empresas')
      .select('*')
      .eq('org_id', org_id)
      .eq('rut', rut.trim())
      .limit(2);
    results.push(...(byRut ?? []));
  }
  const seen = new Set<string>();
  return results.filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; });
}

export async function mergeContactos(keepId: string, deleteId: string): Promise<boolean> {
  try {
    await supabase.from('actividades').update({ contacto_id: keepId }).eq('contacto_id', deleteId);
    const { data: keep } = await supabase.from('contactos').select('campos_extra, telefono, email, cargo').eq('id', keepId).single();
    const { data: del  } = await supabase.from('contactos').select('campos_extra, telefono, email, cargo').eq('id', deleteId).single();
    if (keep && del) {
      const mergedCampos = { ...(del.campos_extra ?? {}), ...(keep.campos_extra ?? {}) };
      const patch: Record<string, unknown> = { campos_extra: mergedCampos };
      if (!keep.telefono && del.telefono) patch.telefono = del.telefono;
      if (!keep.email    && del.email)    patch.email    = del.email;
      if (!keep.cargo    && del.cargo)    patch.cargo    = del.cargo;
      await supabase.from('contactos').update(patch).eq('id', keepId);
    }
    await supabase.from('contactos').delete().eq('id', deleteId);
    return true;
  } catch { return false; }
}

export async function mergeEmpresas(keepId: string, deleteId: string): Promise<boolean> {
  try {
    await supabase.from('contactos').update({ empresa_id: keepId }).eq('empresa_id', deleteId);
    await supabase.from('negocios').update({ empresa_id: keepId }).eq('empresa_id', deleteId);
    const { data: keep } = await supabase.from('empresas').select('campos_extra').eq('id', keepId).single();
    const { data: del } = await supabase.from('empresas').select('campos_extra').eq('id', deleteId).single();
    if (keep && del) {
      await supabase.from('empresas').update({ campos_extra: { ...(del.campos_extra ?? {}), ...(keep.campos_extra ?? {}) } }).eq('id', keepId);
    }
    await supabase.from('empresas').delete().eq('id', deleteId);
    return true;
  } catch { return false; }
}
