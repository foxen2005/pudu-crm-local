'use client'
// hooks/useGoogleData.ts
// Un hook por cada servicio. Úsalos en cualquier componente React.

import { useState, useEffect, useCallback } from 'react'

// ─────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────

export type GmailMessage = {
  id: string
  threadId: string
  subject: string
  from: string
  date: string
  snippet: string
  unread: boolean
}

export type CalendarEvent = {
  id: string
  title: string
  description?: string
  location?: string
  start: string
  end: string
  allDay: boolean
  htmlLink: string
  attendees: { email: string; name?: string }[]
}

export type Task = {
  id: string
  title: string
  notes?: string
  status: 'needsAction' | 'completed'
  completed: boolean
  due?: string
  updated: string
}

// ─────────────────────────────────────────────
// HOOK: Gmail
// ─────────────────────────────────────────────

export function useGmail(maxResults = 20) {
  const [messages, setMessages]   = useState<GmailMessage[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [nextPageToken, setNext]  = useState<string | null>(null)

  const fetchMessages = useCallback(async (pageToken?: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ maxResults: String(maxResults) })
      if (pageToken) params.set('pageToken', pageToken)

      const res  = await fetch(`/api/gmail?${params}`)
      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      setMessages(prev => pageToken ? [...prev, ...data.messages] : data.messages)
      setNext(data.nextPageToken)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [maxResults])

  useEffect(() => { fetchMessages() }, [fetchMessages])

  async function sendEmail(to: string, subject: string, body: string) {
    const res  = await fetch('/api/gmail', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ to, subject, body }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    return data
  }

  return {
    messages,
    loading,
    error,
    hasMore: !!nextPageToken,
    loadMore: () => fetchMessages(nextPageToken ?? undefined),
    refetch:  () => fetchMessages(),
    sendEmail,
  }
}

// ─────────────────────────────────────────────
// HOOK: Calendar
// ─────────────────────────────────────────────

export function useCalendar(maxResults = 10) {
  const [events, setEvents]   = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        maxResults: String(maxResults),
        timeMin:    new Date().toISOString(),
      })
      const res  = await fetch(`/api/calendar?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setEvents(data.events)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [maxResults])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  async function createEvent(payload: {
    title: string
    start: string
    end: string
    description?: string
    location?: string
    attendees?: string[]
  }) {
    const res  = await fetch('/api/calendar', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    await fetchEvents() // refrescar lista
    return data
  }

  async function deleteEvent(eventId: string) {
    const res = await fetch(`/api/calendar?eventId=${eventId}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Error al eliminar evento')
    setEvents(prev => prev.filter(e => e.id !== eventId))
  }

  return { events, loading, error, refetch: fetchEvents, createEvent, deleteEvent }
}

// ─────────────────────────────────────────────
// HOOK: Tasks
// ─────────────────────────────────────────────

export function useTasks(showCompleted = false) {
  const [tasks, setTasks]     = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/tasks?showCompleted=${showCompleted}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTasks(data.tasks)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [showCompleted])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  async function createTask(title: string, notes?: string, due?: string) {
    const res  = await fetch('/api/tasks', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ title, notes, due }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    await fetchTasks()
    return data
  }

  async function toggleTask(taskId: string, completed: boolean) {
    // Optimistic update
    setTasks(prev =>
      prev.map(t => t.id === taskId ? { ...t, completed, status: completed ? 'completed' : 'needsAction' } : t)
    )
    const res = await fetch('/api/tasks', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ taskId, completed }),
    })
    if (!res.ok) {
      await fetchTasks() // revertir si falla
      throw new Error('Error al actualizar tarea')
    }
  }

  async function deleteTask(taskId: string) {
    setTasks(prev => prev.filter(t => t.id !== taskId)) // optimistic
    const res = await fetch(`/api/tasks?taskId=${taskId}`, { method: 'DELETE' })
    if (!res.ok) {
      await fetchTasks()
      throw new Error('Error al eliminar tarea')
    }
  }

  return { tasks, loading, error, refetch: fetchTasks, createTask, toggleTask, deleteTask }
}
