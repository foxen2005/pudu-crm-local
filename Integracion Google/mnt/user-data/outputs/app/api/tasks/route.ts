// app/api/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { google } from 'googleapis'
import { getAuthenticatedClient } from '@/lib/google-oauth'

// Obtiene el ID de la lista de tareas principal del usuario
async function getDefaultTaskListId(auth: any): Promise<string> {
  const tasksApi = google.tasks({ version: 'v1', auth })
  const lists = await tasksApi.tasklists.list({ maxResults: 1 })
  return lists.data.items?.[0]?.id ?? '@default'
}

// GET /api/tasks?showCompleted=false
export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const showCompleted = new URL(req.url).searchParams.get('showCompleted') === 'true'

  try {
    const auth     = await getAuthenticatedClient(session.user.id)
    const tasksApi = google.tasks({ version: 'v1', auth })
    const listId   = await getDefaultTaskListId(auth)

    const res = await tasksApi.tasks.list({
      tasklist:      listId,
      showCompleted,
      showHidden:    false,
      maxResults:    100,
    })

    const tasks = (res.data.items ?? []).map(t => ({
      id:        t.id,
      title:     t.title,
      notes:     t.notes,
      status:    t.status,            // 'needsAction' | 'completed'
      completed: t.status === 'completed',
      due:       t.due ?? null,       // fecha de vencimiento (si tiene)
      updated:   t.updated,
    }))

    return NextResponse.json({ tasks })
  } catch (err: any) {
    console.error('Tasks API error:', err)
    return NextResponse.json({ error: 'Error al obtener tareas' }, { status: 500 })
  }
}

// POST /api/tasks — crear tarea
// Body: { title, notes?, due? }  due: ISO string "2024-06-15T00:00:00.000Z"
export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { title, notes, due } = await req.json()
  if (!title) return NextResponse.json({ error: 'Falta campo: title' }, { status: 400 })

  try {
    const auth     = await getAuthenticatedClient(session.user.id)
    const tasksApi = google.tasks({ version: 'v1', auth })
    const listId   = await getDefaultTaskListId(auth)

    const task = await tasksApi.tasks.insert({
      tasklist: listId,
      requestBody: {
        title,
        notes,
        due: due ?? undefined,
        status: 'needsAction',
      },
    })

    return NextResponse.json({
      id:    task.data.id,
      title: task.data.title,
    })
  } catch (err) {
    console.error('Tasks create error:', err)
    return NextResponse.json({ error: 'Error al crear tarea' }, { status: 500 })
  }
}

// PATCH /api/tasks — marcar como completada o actualizar
// Body: { taskId, completed?, title?, notes? }
export async function PATCH(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { taskId, completed, title, notes } = await req.json()
  if (!taskId) return NextResponse.json({ error: 'Falta campo: taskId' }, { status: 400 })

  try {
    const auth     = await getAuthenticatedClient(session.user.id)
    const tasksApi = google.tasks({ version: 'v1', auth })
    const listId   = await getDefaultTaskListId(auth)

    await tasksApi.tasks.patch({
      tasklist: listId,
      task:     taskId,
      requestBody: {
        ...(title     !== undefined && { title }),
        ...(notes     !== undefined && { notes }),
        ...(completed !== undefined && {
          status:    completed ? 'completed' : 'needsAction',
          completed: completed ? new Date().toISOString() : null,
        }),
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Tasks patch error:', err)
    return NextResponse.json({ error: 'Error al actualizar tarea' }, { status: 500 })
  }
}

// DELETE /api/tasks?taskId=xxx
export async function DELETE(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const taskId = new URL(req.url).searchParams.get('taskId')
  if (!taskId) return NextResponse.json({ error: 'Falta taskId' }, { status: 400 })

  try {
    const auth     = await getAuthenticatedClient(session.user.id)
    const tasksApi = google.tasks({ version: 'v1', auth })
    const listId   = await getDefaultTaskListId(auth)

    await tasksApi.tasks.delete({ tasklist: listId, task: taskId })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Tasks delete error:', err)
    return NextResponse.json({ error: 'Error al eliminar tarea' }, { status: 500 })
  }
}
