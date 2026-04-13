// ══════════════════════════════════════════════════════════════════
// PUDU CRM — Edge Function: refresh-google-token
// Renueva el access_token de Google usando el provider_refresh_token
// guardado en la sesión del usuario.
//
// Secrets necesarios en Supabase (Dashboard → Settings → Edge Functions → Secrets):
//   GOOGLE_CLIENT_ID     → OAuth 2.0 Client ID de Google Cloud Console
//   GOOGLE_CLIENT_SECRET → OAuth 2.0 Client Secret de Google Cloud Console
// ══════════════════════════════════════════════════════════════════

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { refresh_token } = await req.json();

    if (!refresh_token) {
      return new Response(
        JSON.stringify({ error: 'refresh_token requerido' }),
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
