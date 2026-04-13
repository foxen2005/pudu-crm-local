import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { registrarEmailEnviado } from './db';

// ─── Token cache + auto-refresh ────────────────────────────────────────────────

// In-memory cache: evita pedir el token a Supabase en cada llamada
let _cachedToken: string | null = null;
let _tokenExpiresAt: number = 0; // ms desde epoch

async function getGoogleToken(): Promise<string | null> {
  // Devuelve el token cacheado si sigue vigente (con margen de 90s)
  if (_cachedToken && Date.now() < _tokenExpiresAt - 90_000) {
    return _cachedToken;
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.provider_token) return null;
  _cachedToken = session.provider_token;
  // Google tokens duran 3600s; usamos 50 min como vida del cache para ser conservadores
  _tokenExpiresAt = Date.now() + 50 * 60 * 1000;
  return _cachedToken;
}

async function refreshGoogleToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  const refreshToken = session?.provider_refresh_token;
  if (!refreshToken) return null;

  try {
    const { data, error } = await supabase.functions.invoke('refresh-google-token', {
      body: { refresh_token: refreshToken },
    });
    if (error || !data?.access_token) return null;
    _cachedToken = data.access_token as string;
    _tokenExpiresAt = Date.now() + ((data.expires_in as number) ?? 3600) * 1000;
    return _cachedToken;
  } catch {
    return null;
  }
}

export async function gFetch(url: string, options?: RequestInit) {
  let token = await getGoogleToken();
  if (!token) throw new Error('NO_TOKEN');

  const doRequest = (tok: string) =>
    fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${tok}`,
        'Content-Type': 'application/json',
        ...(options?.headers ?? {}),
      },
    });

  let res = await doRequest(token);

  // 401 → intentar renovar el token automáticamente y reintentar una vez
  if (res.status === 401) {
    _cachedToken = null;
    _tokenExpiresAt = 0;
    const newToken = await refreshGoogleToken();
    if (newToken) {
      res = await doRequest(newToken);
    }
    // Si sigue 401 después del refresh → el usuario debe reconectar
    if (res.status === 401) throw new Error('TOKEN_EXPIRED');
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export type GmailMessage = {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  fromEmail: string;
  date: string;
  snippet: string;
  unread: boolean;
  labelIds: string[];
  body?: string;
};

export type GmailThread = {
  id: string;
  messages: GmailMessage[];
};

export type CalendarEvent = {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  attendees: { email: string; displayName?: string; responseStatus?: string }[];
  htmlLink: string;
  colorId?: string;
};

export type GoogleTask = {
  id: string;
  title: string;
  notes?: string;
  due?: string;
  status: 'needsAction' | 'completed';
  completed?: string;
};

// ─── Gmail ─────────────────────────────────────────────────────────────────────

function parseGmailHeaders(headers: { name: string; value: string }[]) {
  const get = (name: string) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
  return {
    subject: get('Subject') || '(Sin asunto)',
    from: get('From'),
    date: get('Date'),
  };
}

function parseFrom(raw: string) {
  const match = raw.match(/^(.*?)\s*<(.+?)>$/);
  if (match) return { name: match[1].replace(/"/g, '').trim(), email: match[2] };
  return { name: raw, email: raw };
}

function extractBody(payload: { mimeType?: string; body?: { data?: string }; parts?: unknown[] }): string {
  if (!payload) return '';
  // Prefer text/html, fallback to text/plain
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
  }
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
  }
  if (payload.parts) {
    // Try html first, then plain
    const parts = payload.parts as { mimeType?: string; body?: { data?: string }; parts?: unknown[] }[];
    const html = parts.find(p => p.mimeType === 'text/html');
    if (html?.body?.data) return atob(html.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    const plain = parts.find(p => p.mimeType === 'text/plain');
    if (plain?.body?.data) return atob(plain.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    // Recurse into multipart
    for (const part of parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }
  return '';
}

export async function fetchGmailBody(id: string): Promise<string> {
  const msg = await gFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`);
  return extractBody(msg.payload ?? {});
}

async function fetchMessageDetail(id: string): Promise<GmailMessage> {
  const msg = await gFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`);
  const { subject, from, date } = parseGmailHeaders(msg.payload?.headers ?? []);
  const { name, email } = parseFrom(from);
  return {
    id: msg.id,
    threadId: msg.threadId,
    subject,
    from: name,
    fromEmail: email,
    date,
    snippet: msg.snippet ?? '',
    unread: (msg.labelIds ?? []).includes('UNREAD'),
    labelIds: msg.labelIds ?? [],
  };
}

// ─── Gmail actions ─────────────────────────────────────────────────────────────

export async function modifyGmailMessage(id: string, addLabelIds: string[], removeLabelIds: string[]) {
  await gFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`, {
    method: 'POST',
    body: JSON.stringify({ addLabelIds, removeLabelIds }),
  });
}

export async function trashGmailMessage(id: string) {
  await gFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/trash`, { method: 'POST' });
}

export type GmailLabel = { id: string; name: string; type: 'system' | 'user'; messagesUnread?: number };

export async function fetchGmailLabels(): Promise<GmailLabel[]> {
  const data = await gFetch('https://gmail.googleapis.com/gmail/v1/users/me/labels');
  return data.labels ?? [];
}

export function useGmail(maxResults = 20, labelId = 'INBOX') {
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);

  const fetch_ = useCallback(async (pageToken?: string) => {
    setLoading(true);
    setError(null);
    setNeedsReconnect(false);
    try {
      const params = new URLSearchParams({ maxResults: String(maxResults), labelIds: labelId });
      if (pageToken) params.set('pageToken', pageToken);
      const data = await gFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`);
      const ids: string[] = (data.messages ?? []).map((m: { id: string }) => m.id);
      const details = await Promise.all(ids.map(fetchMessageDetail));
      setMessages(prev => pageToken ? [...prev, ...details] : details);
      setNextPageToken(data.nextPageToken ?? null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error';
      if (msg === 'TOKEN_EXPIRED' || msg === 'NO_TOKEN') setNeedsReconnect(true);
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }, [maxResults, labelId]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const fetchMore = () => { if (nextPageToken) fetch_(nextPageToken); };

  const sendEmail = async (to: string, subject: string, body: string) => {
    // Register in DB first to get the tracking ID (no contacto_id at this point)
    const emailRecord = await registrarEmailEnviado(subject, to);
    const emailId = emailRecord?.id ?? null;

    // Inject 1x1 tracking pixel if we got an ID
    let htmlBody = body.replace(/\n/g, '<br>');
    if (emailId) {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const pixelUrl = `${supabaseUrl}/functions/v1/track-email?id=${emailId}`;
      htmlBody += `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />`;
    }

    const mime = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      htmlBody,
    ].join('\r\n');

    const raw = btoa(unescape(encodeURIComponent(mime)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    await gFetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      body: JSON.stringify({ raw }),
    });
  };

  return { messages, loading, error, needsReconnect, fetchMore, hasMore: !!nextPageToken, refetch: fetch_, sendEmail };
}

/** Get Gmail threads for a specific email address (for contact detail) */
export function useGmailContact(contactEmail: string | null) {
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contactEmail) return;
    setLoading(true);
    setError(null);
    const q = encodeURIComponent(`from:${contactEmail} OR to:${contactEmail}`);
    gFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=20`)
      .then(async data => {
        const ids: string[] = (data.messages ?? []).map((m: { id: string }) => m.id);
        const details = await Promise.all(ids.map(fetchMessageDetail));
        setMessages(details);
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, [contactEmail]);

  return { messages, loading, error };
}

// ─── Calendar ──────────────────────────────────────────────────────────────────

export function useCalendar(maxResults = 20) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNeedsReconnect(false);
    try {
      const params = new URLSearchParams({
        maxResults: String(maxResults),
        orderBy: 'startTime',
        singleEvents: 'true',
        timeMin: new Date().toISOString(),
      });
      const data = await gFetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`);
      const parsed: CalendarEvent[] = (data.items ?? []).map((e: {
        id: string; summary?: string; description?: string; location?: string;
        start: { dateTime?: string; date?: string };
        end: { dateTime?: string; date?: string };
        attendees?: { email: string; displayName?: string; responseStatus?: string }[];
        htmlLink?: string; colorId?: string;
      }) => ({
        id: e.id,
        summary: e.summary ?? '(Sin título)',
        description: e.description,
        location: e.location,
        start: e.start.dateTime ?? e.start.date ?? '',
        end: e.end.dateTime ?? e.end.date ?? '',
        attendees: e.attendees ?? [],
        htmlLink: e.htmlLink ?? '',
        colorId: e.colorId,
      }));
      setEvents(parsed);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error';
      if (msg === 'TOKEN_EXPIRED' || msg === 'NO_TOKEN') setNeedsReconnect(true);
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }, [maxResults]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const createEvent = async (data: { summary: string; description?: string; start: string; end: string; attendees?: string[] }) => {
    await gFetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      body: JSON.stringify({
        summary: data.summary,
        description: data.description,
        start: { dateTime: data.start },
        end: { dateTime: data.end },
        attendees: (data.attendees ?? []).map(email => ({ email })),
      }),
    });
    fetch_();
  };

  const deleteEvent = async (eventId: string) => {
    const token = await getGoogleToken();
    if (!token) return;
    await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setEvents(prev => prev.filter(e => e.id !== eventId));
  };

  return { events, loading, error, needsReconnect, refetch: fetch_, createEvent, deleteEvent };
}

// ─── Tasks ─────────────────────────────────────────────────────────────────────

export function useTasks(showCompleted = false) {
  const [tasks, setTasks] = useState<GoogleTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [taskListId, setTaskListId] = useState<string>('@default');

  const fetch_ = useCallback(async (listId = taskListId) => {
    setLoading(true);
    setError(null);
    setNeedsReconnect(false);
    try {
      // Ensure we have the default task list
      if (listId === '@default') {
        const lists = await gFetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=1');
        const id = lists.items?.[0]?.id ?? '@default';
        setTaskListId(id);
        listId = id;
      }
      const params = new URLSearchParams({ showCompleted: String(showCompleted), maxResults: '100' });
      const data = await gFetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks?${params}`);
      const parsed: GoogleTask[] = (data.items ?? []).map((t: {
        id: string; title?: string; notes?: string; due?: string; status?: string; completed?: string;
      }) => ({
        id: t.id,
        title: t.title?.trim() || '(Sin título)',
        notes: t.notes,
        due: t.due,
        status: (t.status ?? 'needsAction') as GoogleTask['status'],
        completed: t.completed,
      }));
      setTasks(parsed);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error';
      if (msg === 'TOKEN_EXPIRED' || msg === 'NO_TOKEN') setNeedsReconnect(true);
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }, [taskListId, showCompleted]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const createTask = async (title: string, notes?: string, due?: string) => {
    await gFetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ title, notes, due }),
    });
    fetch_();
  };

  const toggleTask = async (taskId: string, completed: boolean) => {
    await gFetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: completed ? 'completed' : 'needsAction' }),
    });
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: completed ? 'completed' : 'needsAction' } : t));
  };

  const deleteTask = async (taskId: string) => {
    const token = await getGoogleToken();
    if (!token) return;
    await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks/${taskId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  return { tasks, loading, error, needsReconnect, refetch: fetch_, createTask, toggleTask, deleteTask };
}

// ─── Connection check ──────────────────────────────────────────────────────────

export async function isGoogleConnected(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  return !!(user?.identities?.find(i => i.provider === 'google'));
}
