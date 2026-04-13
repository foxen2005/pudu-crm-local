import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { getAlertas, marcarLeida, marcarTodasLeidas, type Notificacion } from '@/lib/db';

const TIPO_ICON: Record<string, string> = {
  actividad_vencida:     'event_busy',
  negocio_sin_movimiento:'trending_flat',
  actividad_hoy:         'today',
};
const TIPO_COLOR: Record<string, string> = {
  actividad_vencida:     'text-red-500 bg-red-50 dark:bg-red-900/20',
  negocio_sin_movimiento:'text-amber-500 bg-amber-50 dark:bg-amber-900/20',
  actividad_hoy:         'text-blue-500 bg-blue-50 dark:bg-blue-900/20',
};

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `Hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Hace ${h}h`;
  return `Hace ${Math.floor(h / 24)}d`;
}

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notificacion[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const unread = notifs.filter(n => !n.leida).length;

  const load = async () => {
    setNotifs(await getAlertas(20));
  };

  useEffect(() => {
    load();
    // Suscripción en tiempo real
    const channel = supabase
      .channel('notificaciones')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificaciones' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleClick = async (n: Notificacion) => {
    if (!n.leida) { await marcarLeida(n.id); load(); }
    setOpen(false);
    if (n.entidad_tipo === 'negocio')   navigate('/negocios');
    if (n.entidad_tipo === 'actividad') navigate('/actividades');
  };

  const handleMarkAll = async () => {
    await marcarTodasLeidas();
    load();
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="size-9 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 relative transition-colors"
      >
        <span className="material-symbols-outlined text-xl">notifications</span>
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 bg-white dark:bg-[#1e1a2e] border border-slate-100 dark:border-slate-700/50 rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700/50">
            <p className="text-sm font-black text-slate-900 dark:text-slate-100">
              Notificaciones {unread > 0 && <span className="ml-1 text-xs font-bold text-primary">({unread})</span>}
            </p>
            {unread > 0 && (
              <button onClick={handleMarkAll} className="text-[11px] text-primary font-bold hover:underline">
                Marcar todas leídas
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-700/30">
            {notifs.length === 0 ? (
              <div className="py-10 text-center">
                <span className="material-symbols-outlined text-3xl text-slate-200 dark:text-slate-700 block mb-2">notifications_off</span>
                <p className="text-xs text-slate-400">Sin notificaciones</p>
              </div>
            ) : (
              notifs.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors text-left ${!n.leida ? 'bg-primary/2' : ''}`}
                >
                  <div className={`size-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${TIPO_COLOR[n.tipo] ?? 'text-slate-400 bg-slate-100 dark:bg-slate-800'}`}>
                    <span className="material-symbols-outlined text-base">{TIPO_ICON[n.tipo] ?? 'info'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold truncate ${n.leida ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}>
                      {n.titulo}
                    </p>
                    {n.descripcion && (
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{n.descripcion}</p>
                    )}
                    <p className="text-[9px] text-slate-300 dark:text-slate-600 mt-1">{relTime(n.created_at)}</p>
                  </div>
                  {!n.leida && <div className="size-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
