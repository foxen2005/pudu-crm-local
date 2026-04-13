/**
 * Cross-channel matching engine
 * Identifies WA conversations and Gmail senders that have no linked CRM contact.
 */

import { supabase } from './supabase';
import type { Contacto } from './db';
import { gFetch } from './useGoogleData';

// ─── Phone normalization ──────────────────────────────────────────────────────

/** Normalize to last 9 digits (strips country/carrier prefixes like +56, 56, 0) */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.slice(-9);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type UnmatchedWaConversation = {
  id: string;
  contact_phone: string;
  contact_nombre: string | null;
  last_message_at: string | null;
  message_count: number;
  /** Possible CRM contacts that share the same phone (last 9 digits) */
  suggestions: Contacto[];
};

export type UnmatchedGmailSender = {
  email: string;
  name: string;
  message_count: number;
  latest_subject: string;
  latest_date: string;
  /** Possible CRM contacts that share the same email */
  suggestions: Contacto[];
};

export type ValidationSummary = {
  unmatchedWa: UnmatchedWaConversation[];
  unmatchedGmail: UnmatchedGmailSender[];
};

// ─── WA Matching ─────────────────────────────────────────────────────────────

async function getOrgId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('miembros').select('org_id').eq('user_id', user.id).single();
  return data?.org_id ?? null;
}

export async function getUnmatchedWaConversations(): Promise<UnmatchedWaConversation[]> {
  const org_id = await getOrgId();
  if (!org_id) return [];

  // Conversations with no linked contact
  const { data: convs } = await supabase
    .from('whatsapp_conversations')
    .select('id, contact_phone, contact_nombre, last_message_at')
    .eq('org_id', org_id)
    .is('contact_id', null)
    .order('last_message_at', { ascending: false })
    .limit(50);

  if (!convs || convs.length === 0) return [];

  // For each conversation, get message count and check for phone matches in CRM
  const { data: allContacts } = await supabase
    .from('contactos')
    .select('id, nombre, apellido, email, telefono, cargo, empresa_nombre, estado, created_at')
    .not('telefono', 'is', null);

  const contacts: Contacto[] = (allContacts ?? []).map(c => ({
    ...c,
    rut: null,
    empresa_id: null,
  }));

  const results: UnmatchedWaConversation[] = await Promise.all(
    convs.map(async (conv) => {
      const { count } = await supabase
        .from('whatsapp_messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conv.id);

      const normPhone = normalizePhone(conv.contact_phone);
      const suggestions = contacts.filter(c =>
        c.telefono && normalizePhone(c.telefono) === normPhone
      );

      return {
        id: conv.id,
        contact_phone: conv.contact_phone,
        contact_nombre: conv.contact_nombre,
        last_message_at: conv.last_message_at,
        message_count: count ?? 0,
        suggestions,
      };
    })
  );

  return results;
}

// ─── Gmail Matching ───────────────────────────────────────────────────────────

export async function getUnmatchedGmailSenders(): Promise<UnmatchedGmailSender[]> {
  // Fetch recent inbox messages
  let messages: { id: string }[] = [];
  try {
    const data = await gFetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=INBOX&maxResults=50'
    );
    messages = data.messages ?? [];
  } catch {
    return [];
  }

  if (messages.length === 0) return [];

  // Fetch metadata for each message
  const details = await Promise.allSettled(
    messages.map(m =>
      gFetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`
      )
    )
  );

  // Aggregate by sender email
  const senderMap = new Map<string, {
    name: string;
    count: number;
    latest_subject: string;
    latest_date: string;
  }>();

  for (const result of details) {
    if (result.status !== 'fulfilled') continue;
    const msg = result.value;
    const headers: { name: string; value: string }[] = msg.payload?.headers ?? [];
    const get = (n: string) => headers.find((h: { name: string }) => h.name.toLowerCase() === n.toLowerCase())?.value ?? '';

    const fromRaw = get('From');
    const subject = get('Subject') || '(Sin asunto)';
    const date = get('Date');

    const emailMatch = fromRaw.match(/<(.+?)>/);
    const email = emailMatch ? emailMatch[1] : fromRaw;
    const nameMatch = fromRaw.match(/^(.*?)\s*</);
    const name = nameMatch ? nameMatch[1].replace(/"/g, '').trim() : email;

    if (!email || email.includes('noreply') || email.includes('no-reply') || email.includes('mailer')) continue;

    const existing = senderMap.get(email);
    if (!existing) {
      senderMap.set(email, { name, count: 1, latest_subject: subject, latest_date: date });
    } else {
      existing.count++;
    }
  }

  if (senderMap.size === 0) return [];

  // Load all contacts with email to check matches
  const { data: allContacts } = await supabase
    .from('contactos')
    .select('id, nombre, apellido, email, telefono, cargo, empresa_nombre, estado, created_at')
    .not('email', 'is', null);

  const contacts: Contacto[] = (allContacts ?? []).map(c => ({ ...c, rut: null, empresa_id: null }));

  const unmatched: UnmatchedGmailSender[] = [];

  for (const [email, info] of senderMap) {
    const emailLower = email.toLowerCase();
    const matched = contacts.some(c => c.email?.toLowerCase() === emailLower);
    if (!matched) {
      const suggestions = contacts.filter(c =>
        c.email?.toLowerCase().includes(emailLower.split('@')[0]) ||
        emailLower.includes((c.nombre ?? '').toLowerCase().split(' ')[0])
      ).slice(0, 3);

      unmatched.push({
        email,
        name: info.name,
        message_count: info.count,
        latest_subject: info.latest_subject,
        latest_date: info.latest_date,
        suggestions,
      });
    }
  }

  return unmatched.sort((a, b) => b.message_count - a.message_count);
}

// ─── Combined ─────────────────────────────────────────────────────────────────

export async function getValidationSummary(): Promise<ValidationSummary> {
  const [unmatchedWa, unmatchedGmail] = await Promise.allSettled([
    getUnmatchedWaConversations(),
    getUnmatchedGmailSenders(),
  ]);

  return {
    unmatchedWa: unmatchedWa.status === 'fulfilled' ? unmatchedWa.value : [],
    unmatchedGmail: unmatchedGmail.status === 'fulfilled' ? unmatchedGmail.value : [],
  };
}

// ─── Counts only (for Dashboard badges) ──────────────────────────────────────

export async function getValidationCounts(): Promise<{ wa: number; gmail: number }> {
  const org_id = await getOrgId();
  const waPromise = org_id
    ? supabase.from('whatsapp_conversations').select('id', { count: 'exact', head: true })
        .eq('org_id', org_id).is('contact_id', null)
    : Promise.resolve({ count: 0 });

  const [waResult] = await Promise.all([waPromise]);
  return { wa: waResult.count ?? 0, gmail: 0 }; // gmail count is expensive; skip for badge
}
