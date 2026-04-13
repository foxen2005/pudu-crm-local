// app/api/calendar/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { google } from 'googleapis'
import { getAuthenticatedClient } from '@/lib/google-oauth'

// GET /api/calendar?maxResults=10&timeMin=2024-01-01T00:00:00Z
export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const maxResults = Number(searchParams.get('maxResults') ?? 10)
  const timeMin    = searchParams.get('timeMin') ?? new Date().toISOString()

  try {
    const auth     = await getAuthenticatedClient(session.user.id)
    const calendar = google.calendar({ version: 'v3', auth })

    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    })

    const events = (res.data.items ?? []).map(e => ({
      id:          e.id,
      title:       e.summary,
      description: e.description,
      location:    e.location,
      start:       e.start?.dateTime ?? e.start?.date,
      end:         e.end?.dateTime   ?? e.end?.date,
      allDay:      !e.start?.dateTime,   // true si es evento de día completo
      htmlLink:    e.htmlLink,
      attendees:   e.attendees?.map(a => ({ email: a.email, name: a.displayName })) ?? [],
    }))

    return NextResponse.json({ events })
  } catch (err: any) {
    console.error('Calendar API error:', err)
    return NextResponse.json({ error: 'Error al obtener eventos' }, { status: 500 })
  }
}

// POST /api/calendar — crear evento
// Body: { title, description?, location?, start, end, attendees? }
// start y end: strings ISO 8601, ej: "2024-06-15T10:00:00-03:00"
export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { title, description, location, start, end, attendees } = await req.json()
  if (!title || !start || !end) {
    return NextResponse.json({ error: 'Faltan campos: title, start, end' }, { status: 400 })
  }

  try {
    const auth     = await getAuthenticatedClient(session.user.id)
    const calendar = google.calendar({ version: 'v3', auth })

    const event = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary:     title,
        description,
        location,
        start: { dateTime: start, timeZone: 'America/Santiago' },
        end:   { dateTime: end,   timeZone: 'America/Santiago' },
        attendees: attendees?.map((email: string) => ({ email })) ?? [],
      },
    })

    return NextResponse.json({
      id:      event.data.id,
      htmlLink: event.data.htmlLink,
    })
  } catch (err) {
    console.error('Calendar create error:', err)
    return NextResponse.json({ error: 'Error al crear evento' }, { status: 500 })
  }
}

// DELETE /api/calendar?eventId=xxx
export async function DELETE(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const eventId = new URL(req.url).searchParams.get('eventId')
  if (!eventId) return NextResponse.json({ error: 'Falta eventId' }, { status: 400 })

  try {
    const auth     = await getAuthenticatedClient(session.user.id)
    const calendar = google.calendar({ version: 'v3', auth })

    await calendar.events.delete({ calendarId: 'primary', eventId })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Calendar delete error:', err)
    return NextResponse.json({ error: 'Error al eliminar evento' }, { status: 500 })
  }
}
