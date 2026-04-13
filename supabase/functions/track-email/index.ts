// ══════════════════════════════════════════════════════════════════
// PUDU CRM — Edge Function: track-email
// Sirve un pixel 1×1 transparente y registra la apertura del email.
// URL: /functions/v1/track-email?id=<email_id>
// ══════════════════════════════════════════════════════════════════

import { createClient } from 'jsr:@supabase/supabase-js@2';

// 1×1 pixel GIF transparente (base64)
const PIXEL = Uint8Array.from(atob(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
), c => c.charCodeAt(0));

Deno.serve(async (req) => {
  const url   = new URL(req.url);
  const id    = url.searchParams.get('id');

  // Siempre devolver el pixel, incluso si algo falla
  const pixelResponse = new Response(PIXEL, {
    headers: {
      'Content-Type':  'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma':        'no-cache',
    },
  });

  if (!id) return pixelResponse;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Registrar apertura
    await supabase.rpc('registrar_apertura_email', { email_id: id });
  } catch {
    // No lanzar error — el pixel siempre se sirve
  }

  return pixelResponse;
});
