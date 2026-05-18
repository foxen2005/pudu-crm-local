import { supabase } from './supabase';

/**
 * Standardized utility to send webhooks to n8n or other services.
 * Ensures metadata like org_id and timestamp are always included.
 */
export async function dispatchN8NWebhook(
  url: string,
  event: string,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    // Get org_id for the user
    const { data: member } = await supabase
      .from('miembros')
      .select('org_id')
      .eq('user_id', user?.id)
      .single();

    const fullPayload = {
      event,
      timestamp: new Date().toISOString(),
      org_id: member?.org_id,
      user_id: user?.id,
      user_email: user?.email,
      ...payload,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Pudu-Event': event,
      },
      body: JSON.stringify(fullPayload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${errorText}` };
    }

    return { ok: true };
  } catch (err) {
    console.error('[dispatchN8NWebhook] Error:', err);
    return { ok: false, error: String(err) };
  }
}
