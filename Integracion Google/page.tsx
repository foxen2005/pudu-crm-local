'use client'
// app/dashboard/page.tsx
// Ejemplo de dashboard que consume los 3 servicios de Google.
// Reemplaza el contenido con tus propios componentes según necesites.

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useGmail, useCalendar, useTasks } from '@/hooks/useGoogleData'
import GoogleConnectButton from '@/components/GoogleConnectButton'

export default function DashboardPage() {
  const { user, logout }                     = useAuth()
  const { messages, loading: gmailLoading }  = useGmail(10)
  const { events,   loading: calLoading }    = useCalendar(5)
  const { tasks, loading: tasksLoading,
          toggleTask, createTask }            = useTasks()

  const [newTask, setNewTask] = useState('')

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault()
    if (!newTask.trim()) return
    await createTask(newTask.trim())
    setNewTask('')
  }

  return (
    <div style={s.page}>

      {/* Header */}
      <header style={s.header}>
        <div style={s.headerBrand}>
          <div style={s.dot} />
          <span style={s.appName}>MiApp</span>
        </div>
        <div style={s.headerRight}>
          <span style={s.userEmail}>{user?.email}</span>
          <button onClick={logout} style={s.logoutBtn}>Salir</button>
        </div>
      </header>

      <main style={s.main}>

        {/* Conexión Google */}
        <section style={s.section}>
          <h2 style={s.sectionTitle}>Cuenta Google</h2>
          <GoogleConnectButton />
        </section>

        <div style={s.grid}>

          {/* Gmail */}
          <section style={s.card}>
            <h2 style={s.cardTitle}>
              <InboxIcon /> Bandeja de entrada
            </h2>
            {gmailLoading ? (
              <LoadingRows count={4} />
            ) : messages.length === 0 ? (
              <Empty text="Sin emails" />
            ) : (
              <ul style={s.list}>
                {messages.map(msg => (
                  <li key={msg.id} style={s.emailItem}>
                    <div style={s.emailHeader}>
                      <span style={{ ...s.emailFrom, fontWeight: msg.unread ? 700 : 400 }}>
                        {shortFrom(msg.from)}
                      </span>
                      {msg.unread && <span style={s.unreadDot} />}
                    </div>
                    <p style={s.emailSubject}>{msg.subject || '(sin asunto)'}</p>
                    <p style={s.emailSnippet}>{msg.snippet}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Calendar */}
          <section style={s.card}>
            <h2 style={s.cardTitle}>
              <CalIcon /> Próximos eventos
            </h2>
            {calLoading ? (
              <LoadingRows count={3} />
            ) : events.length === 0 ? (
              <Empty text="Sin eventos próximos" />
            ) : (
              <ul style={s.list}>
                {events.map(ev => (
                  <li key={ev.id} style={s.eventItem}>
                    <div style={s.eventDate}>{formatDate(ev.start)}</div>
                    <div>
                      <p style={s.eventTitle}>{ev.title}</p>
                      {ev.location && (
                        <p style={s.eventLocation}>📍 {ev.location}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Tasks */}
          <section style={s.card}>
            <h2 style={s.cardTitle}>
              <TaskIcon /> Tareas pendientes
            </h2>

            {/* Formulario nueva tarea */}
            <form onSubmit={handleAddTask} style={s.taskForm}>
              <input
                value={newTask}
                onChange={e => setNewTask(e.target.value)}
                placeholder="Nueva tarea..."
                style={s.taskInput}
              />
              <button type="submit" style={s.taskAddBtn}>+</button>
            </form>

            {tasksLoading ? (
              <LoadingRows count={4} />
            ) : tasks.length === 0 ? (
              <Empty text="Sin tareas pendientes" />
            ) : (
              <ul style={s.list}>
                {tasks.filter(t => !t.completed).map(task => (
                  <li key={task.id} style={s.taskItem}>
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={e => toggleTask(task.id, e.target.checked)}
                      style={s.checkbox}
                    />
                    <span style={s.taskTitle}>{task.title}</span>
                    {task.due && (
                      <span style={s.taskDue}>{formatDate(task.due)}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

        </div>
      </main>
    </div>
  )
}

// ─── Utilidades ───────────────────────────────

function shortFrom(from: string) {
  // "Nombre Apellido <email@ejemplo.com>" → "Nombre Apellido"
  const match = from.match(/^([^<]+)/)
  return match ? match[1].trim() : from
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CL', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function LoadingRows({ count }: { count: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ height: 20, borderRadius: 4, background: '#f3f4f6', width: `${70 + (i % 3) * 10}%` }} />
      ))}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p style={{ fontSize: 13, color: '#9ca3af', margin: '12px 0' }}>{text}</p>
}

function InboxIcon() { return <span style={{ fontSize: 16 }}>✉️</span> }
function CalIcon()   { return <span style={{ fontSize: 16 }}>📅</span> }
function TaskIcon()  { return <span style={{ fontSize: 16 }}>✅</span> }

// ─── Estilos ──────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page:         { minHeight: '100vh', background: '#f8f7f4', fontFamily: '"DM Sans", sans-serif' },
  header:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', background: '#fff', borderBottom: '1px solid #e8e6e0' },
  headerBrand:  { display: 'flex', alignItems: 'center', gap: 8 },
  dot:          { width: 10, height: 10, borderRadius: '50%', background: '#1a1a1a' },
  appName:      { fontSize: 15, fontWeight: 600, color: '#1a1a1a', letterSpacing: '-0.02em' },
  headerRight:  { display: 'flex', alignItems: 'center', gap: 16 },
  userEmail:    { fontSize: 13, color: '#737373' },
  logoutBtn:    { fontSize: 13, fontWeight: 500, color: '#1a1a1a', background: 'none', border: '1px solid #e0ddd8', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' },
  main:         { padding: '32px', maxWidth: 1100, margin: '0 auto' },
  section:      { marginBottom: 32 },
  sectionTitle: { fontSize: 15, fontWeight: 600, color: '#1a1a1a', margin: '0 0 12px', letterSpacing: '-0.02em' },
  grid:         { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 },
  card:         { background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0', padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 },
  cardTitle:    { fontSize: 14, fontWeight: 600, color: '#1a1a1a', margin: 0, display: 'flex', alignItems: 'center', gap: 6 },
  list:         { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  emailItem:    { padding: '8px 0', borderBottom: '1px solid #f3f4f6' },
  emailHeader:  { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 },
  emailFrom:    { fontSize: 13, color: '#1a1a1a' },
  unreadDot:    { width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 },
  emailSubject: { fontSize: 13, color: '#374151', margin: '2px 0', fontWeight: 500 },
  emailSnippet: { fontSize: 12, color: '#9ca3af', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  eventItem:    { display: 'flex', gap: 12, alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid #f3f4f6' },
  eventDate:    { fontSize: 11, color: '#6366f1', fontWeight: 600, minWidth: 72, paddingTop: 2 },
  eventTitle:   { fontSize: 13, color: '#1a1a1a', fontWeight: 500, margin: 0 },
  eventLocation:{ fontSize: 12, color: '#9ca3af', margin: '2px 0 0' },
  taskForm:     { display: 'flex', gap: 8 },
  taskInput:    { flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #e0ddd8', fontSize: 13, outline: 'none', background: '#fafaf8' },
  taskAddBtn:   { padding: '8px 14px', borderRadius: 8, border: 'none', background: '#1a1a1a', color: '#fff', fontSize: 18, cursor: 'pointer', lineHeight: 1 },
  taskItem:     { display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' },
  checkbox:     { width: 16, height: 16, cursor: 'pointer', accentColor: '#1a1a1a', flexShrink: 0 },
  taskTitle:    { fontSize: 13, color: '#374151', flex: 1 },
  taskDue:      { fontSize: 11, color: '#f59e0b', fontWeight: 500 },
}
