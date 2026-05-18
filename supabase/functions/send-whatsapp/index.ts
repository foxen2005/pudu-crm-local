// ══════════════════════════════════════════════════════════════════
// PUDU CRM — Edge Function: send-whatsapp
// Permite enviar mensajes de WhatsApp vía API (para n8n u otros).
// ══════════════════════════════════════════════════════════════════

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Validar identidad
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: corsHeaders });
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return new Response(JSON.stringify({ error: 'Sesión inválida' }), { status: 401, headers: corsHeaders });

    const { phone, body, org_id } = await req.json();

    if (!phone || !body || !org_id) {
      return new Response(JSON.stringify({ error: 'Faltan campos: phone, body, org_id' }), { status: 400, headers: corsHeaders });
    }

    // 2. Validar que el usuario pertenece a la organización (Prevenir IDOR)
    const { data: membership, error: membershipError } = await supabase
      .from('miembros')
      .select('id')
      .eq('user_id', user.id)
      .eq('org_id', org_id)
      .maybeSingle();

    if (membershipError || !membership) {
      return new Response(JSON.stringify({ error: 'No tienes permisos para enviar mensajes desde esta organización' }), { status: 403, headers: corsHeaders });
    }

    // 3. Obtener credenciales de la organización
    const { data: org } = await supabase
      .from('organizaciones')
      .select('wa_phone_number_id, wa_access_token')
      .eq('id', org_id)
      .single();

    if (!org?.wa_access_token) {
      return new Response(JSON.stringify({ error: 'WhatsApp no configurado en esta organización' }), { status: 400, headers: corsHeaders });
    }

    // 3. Enviar vía Meta API
    const res = await fetch(`https://graph.facebook.com/v20.0/${org.wa_phone_number_id}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${org.wa_access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body },
      }),
    });

    const result = await res.json();

    if (!res.ok) return new Response(JSON.stringify({ error: result.error?.message || 'Error en Meta API' }), { status: 400, headers: corsHeaders });

    // 4. Registrar en la base de datos (opcional, para que aparezca en el CRM)
    // Buscamos o creamos la conversación
    const { data: conv } = await supabase
      .from('whatsapp_conversations')
      .select('id')
      .eq('org_id', org_id)
      .eq('contact_phone', phone)
      .maybeSingle();

    if (conv) {
      await supabase.from('whatsapp_messages').insert({
        org_id,
        conversation_id: conv.id,
        direction: 'outbound',
        message_type: 'text',
        body,
        status: 'sent',
        sent_by_nombre: 'Pudu AI (n8n)'
      });
    }

    return new Response(JSON.stringify({ ok: true, message_id: result.messages?.[0]?.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
