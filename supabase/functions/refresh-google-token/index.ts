// ══════════════════════════════════════════════════════════════════
// PUDU CRM — Edge Function: refresh-google-token
// Renueva el access_token de Google usando el refresh_token
// proporcionado o buscándolo en la base de datos para el usuario.
//
// Secrets necesarios en Supabase:
//   GOOGLE_CLIENT_ID
//   GOOGLE_CLIENT_SECRET
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// ══════════════════════════════════════════════════════════════════

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Validar identidad del usuario (Seguridad contra IDOR)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: corsHeaders });
    }
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: 'Token de sesión inválido' }), { status: 401, headers: corsHeaders });
    }

    let { refresh_token, user_id } = await req.json().catch(() => ({}));

    // Si se pide un user_id específico, verificar que sea el del usuario autenticado
    if (user_id && user_id !== authUser.id) {
      return new Response(JSON.stringify({ error: 'No tienes permiso para renovar tokens de otro usuario' }), { status: 403, headers: corsHeaders });
    }

    // Si no viene refresh_token, usar siempre el del usuario autenticado persistido en DB
    if (!refresh_token) {
      const { data } = await supabase
        .from('miembros')
        .select('google_refresh_token')
        .eq('user_id', authUser.id)
        .single();
      refresh_token = data?.google_refresh_token;
    }

    if (!refresh_token) {
      return new Response(
        JSON.stringify({ error: 'Refresh token no encontrado para este usuario. Reconnecta tu cuenta.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clientId     = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: 'Credenciales de Google no configuradas en secrets' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:     clientId,
        client_secret: clientSecret,
        refresh_token,
        grant_type:    'refresh_token',
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.access_token) {
      return new Response(
        JSON.stringify({ error: data.error ?? 'Error al refrescar token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ access_token: data.access_token, expires_in: data.expires_in ?? 3600 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
