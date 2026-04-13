// app/api/gmail/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { google } from 'googleapis'
import { getAuthenticatedClient } from '@/lib/google-oauth'

// GET /api/gmail?maxResults=20&pageToken=xxx
export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const maxResults = Number(searchParams.get('maxResults') ?? 20)
  const pageToken  = searchParams.get('pageToken') ?? undefined

  try {
    const auth   = await getAuthenticatedClient(session.user.id)
    const gmail  = google.gmail({ version: 'v1', auth })

    // 1. Obtener lista de IDs de mensajes
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
      pageToken,
      labelIds: ['INBOX'],
    })

    const messageIds = listRes.data.messages ?? []

    // 2. Obtener metadatos de cada mensaje en paralelo
    const messages = await Promise.all(
      messageIds.map(async ({ id }) => {
        const msg = await gmail.users.messages.get({
          userId: 'me',
          id: id!,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        })

        const headers = msg.data.payload?.headers ?? []
        const get = (name: string) =>
          headers.find(h => h.name === name)?.value ?? ''

        return {
          id:        msg.data.id,
          threadId:  msg.data.threadId,
          subject:   get('Subject'),
          from:      get('From'),
          date:      get('Date'),
          snippet:   msg.data.snippet,
          unread:    msg.data.labelIds?.includes('UNREAD') ?? false,
        }
      })
    )

    return NextResponse.json({
      messages,
      nextPageToken: listRes.data.nextPageToken ?? null,
    })
  } catch (err: any) {
    console.error('Gmail API error:', err)
    if (err.message?.includes('no tiene Google conectado')) {
      return NextResponse.json({ error: 'Google no conectado' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Error al obtener emails' }, { status: 500 })
  }
}

// POST /api/gmail  — enviar email
// Body: { to, subject, body }
export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { to, subject, body } = await req.json()
  if (!to || !subject || !body) {
    return NextResponse.json({ error: 'Faltan campos: to, subject, body' }, { status: 400 })
  }

  try {
    const auth  = await getAuthenticatedClient(session.user.id)
    const gmail = google.gmail({ version: 'v1', auth })

    // Construir el email en formato RFC 2822 codificado en base64url
    const emailLines = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ]
    const raw = Buffer.from(emailLines.join('\n'))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    const sent = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    })

    return NextResponse.json({ messageId: sent.data.id })
  } catch (err) {
    console.error('Gmail send error:', err)
    return NextResponse.json({ error: 'Error al enviar email' }, { status: 500 })
  }
}
