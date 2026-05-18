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
    let { refresh_token, user_id } = await req.json().catch(() => ({}));

    // Si no viene refresh_token pero sí user_id, buscarlo en la DB
    if (!refresh_token && user_id) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      const { data } = await supabase
        .from('miembros')
        .select('google_refresh_token')
        .eq('user_id', user_id)
        .single();
      refresh_token = data?.google_refresh_token;
    }

    if (!refresh_token) {
      return new Response(
        JSON.stringify({ error: 'refresh_token o user_id con token persistido requerido' }),
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
