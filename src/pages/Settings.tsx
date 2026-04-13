import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getMiembros, actualizarMiembro, getNotificaciones, guardarNotificaciones, getWaLocalStatus, getWaLocalQr, setWaActivoOrg, listarInvitaciones, eliminarInvitacion, getRankingEquipo, type Miembro, type Invitacion, type RankingMiembro } from '@/lib/db';
import { CrearColaboradorModal } from '@/components/modals/CrearColaboradorModal';
import { CamposPersonalizadosSettings } from '@/components/settings/CamposPersonalizadosSettings';
import { PipelinesSettings } from '@/components/settings/PipelinesSettings';

const labelClass = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5';
const inputClass =
  'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white dark:bg-[#252035] dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500';

export default function Settings() {
  const { member, signOut } = useAuth();
  const [profile, setProfile] = useState({
    nombre: member?.nombre ?? '',
    email: member?.email ?? '',
    cargo: member?.rol ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [notifs, setNotifs] = useState({
    nuevosLeads: true,
    sinActividad: true,
    tareasVencidas: true,
    resumenDiario: false,
  });

  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [colaboradorOpen, setColaboradorOpen] = useState(false);
  const [ranking, setRanking] = useState<RankingMiembro[]>([]);

  const [waLocal, setWaLocal] = useState<{ connected: boolean; phone: string | null; qrPending: boolean } | null>(null);
  const [waQr, setWaQr] = useState<string | null>(null);
  const [waQrImage, setWaQrImage] = useState<string | null>(null);

  // ── Google OAuth ──
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(true);
  const [connectingGoogle, setConnectingGoogle] = useState(false);

  const checkGoogleStatus = async () => {
    setGoogleLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const identity = user?.identities?.find(i => i.provider === 'google');
    setGoogleConnected(!!identity);
    setGoogleEmail((identity?.identity_data?.email as string) ?? null);
    setGoogleLoading(false);
  };

  const connectGoogle = async () => {
    setConnectingGoogle(true);
    const { error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/tasks',
        redirectTo: `${window.location.origin}/configuracion`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) { console.error('Google connect:', error); setConnectingGoogle(false); }
    // no error → redirect happens, loading stays true
  };

  const disconnectGoogle = async () => {
    if (!window.confirm('¿Desconectar tu cuenta de Google? Perderás acceso a Gmail, Calendar y Tasks.')) return;
    const { data: { user } } = await supabase.auth.getUser();
    const identity = user?.identities?.find(i => i.provider === 'google');
    if (!identity) return;
    const { error } = await supabase.auth.unlinkIdentity(identity);
    if (!error) { setGoogleConnected(false); setGoogleEmail(null); }
  };

  useEffect(() => {
    checkGoogleStatus();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'USER_UPDATED' || event === 'SIGNED_IN') checkGoogleStatus();
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let alive = true;
    let lastConnected: boolean | null = null;
    const orgId = member?.orgId;
    const poll = async () => {
      const s = await getWaLocalStatus(orgId);
      if (!alive) return;
      setWaLocal(s);
      const connected = s?.connected ?? false;
      if (connected !== lastConnected) {
        lastConnected = connected;
        setWaActivoOrg(connected);
      }
      if (s?.qrPending && !s.connected) {
        const qr = await getWaLocalQr(orgId);
        if (alive) setWaQr(qr);
      } else {
        setWaQr(null);
      }
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => { alive = false; clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (!waQr) { setWaQrImage(null); return; }
    // Si el servidor ya devuelve base64/dataURL, usarlo directo
    if (waQr.startsWith('data:') || waQr.startsWith('iVBOR')) {
      setWaQrImage(waQr.startsWith('data:') ? waQr : `data:image/png;base64,${waQr}`);
    } else {
      // Es un string de QR → convertir con la librería
      QRCode.toDataURL(waQr, { width: 256, margin: 2 }).then(setWaQrImage).catch(() => setWaQrImage(null));
    }
  }, [waQr]);

  useEffect(() => {
    getMiembros().then(r => { if (r.ok) setMiembros(r.data); });
    getRankingEquipo().then(setRanking);
    if (member?.orgId) listarInvitaciones(member.orgId).then(setInvitaciones);
  }, [member?.orgId]);

  // Sync profile + notificaciones when member loads
  useEffect(() => {
    if (member) {
      setProfile({ nombre: member.nombre ?? '', email: member.email ?? '', cargo: member.rol ?? '' });
      getNotificaciones(member.userId).then(saved => {
        if (saved) setNotifs(prev => ({ ...prev, ...saved }));
      });
    }
  }, [member?.userId]);

  const setProfileField = (field: keyof typeof profile) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => setProfile((prev) => ({ ...prev, [field]: e.target.value }));

  function copiarLink(token: string) {
    navigator.clipboard.writeText(`${window.location.origin}/?join=${token}`);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  async function borrarInvitacion(id: string) {
    await eliminarInvitacion(id);
    setInvitaciones(prev => prev.filter(i => i.id !== id));
  }

  const toggleNotif = (field: keyof typeof notifs) => () => {
    setNotifs((prev) => {
      const next = { ...prev, [field]: !prev[field] };
      if (member) guardarNotificaciones(member.userId, next);
      return next;
    });
  };

  const handleSave = async () => {
    if (!member) return;
    setSaving(true);
    setSaveMsg(null);
    const result = await actualizarMiembro(member.userId, profile.nombre);
    setSaving(false);
    if (result.ok) {
      setSaveMsg('Cambios guardados');
      setTimeout(() => setSaveMsg(null), 3000);
    } else {
      setSaveMsg(result.error);
    }
  };

  return (
    <div className="">
      <div className="flex flex-col mb-8">
        <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-2">Configuración</span>
        <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Ajustes</h2>
      </div>

      <div className="max-w-2xl space-y-6">

        {/* ── Perfil ── */}
        <section className="bg-white dark:bg-[#1e1a2e] rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm p-6">
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-5 flex items-center gap-2">
            <span className="material-symbols-outlined text-lg text-primary">manage_accounts</span>
            Perfil
          </h3>

          <div className="flex items-center gap-5 mb-6">
            <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-4xl text-primary">person</span>
            </div>
            <div>
              <p className="text-base font-black text-slate-900 dark:text-slate-100">{profile.nombre}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{profile.cargo}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className={labelClass}>Nombre completo</label>
              <input type="text" value={profile.nombre} onChange={setProfileField('nombre')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" value={profile.email} onChange={setProfileField('email')} className={inputClass} disabled />
            </div>
            <div>
              <label className={labelClass}>Cargo / Rol</label>
              <input type="text" value={profile.cargo} className={inputClass} disabled />
            </div>
          </div>

          <div className="h-px bg-slate-100 dark:bg-slate-700/50 my-6" />

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => signOut()}
              className="px-4 py-2 border border-red-200 text-red-600 text-sm font-bold rounded-lg hover:bg-red-50 transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">logout</span>
              Cerrar sesión
            </button>
            <div className="flex items-center gap-3">
              {saveMsg && (
                <span className={`text-xs font-bold ${saveMsg === 'Cambios guardados' ? 'text-green-600' : 'text-red-600'}`}>
                  {saveMsg}
                </span>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </section>

        {/* ── Organización ── */}
        <section className="bg-white dark:bg-[#1e1a2e] rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm p-6">
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-5 flex items-center gap-2">
            <span className="material-symbols-outlined text-lg text-primary">domain</span>
            Organización
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-3 px-4 bg-slate-50 dark:bg-[#13111a] rounded-xl">
              <div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Nombre</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{member?.orgNombre ?? '—'}</p>
              </div>
            </div>
            <div className="flex items-center justify-between py-3 px-4 bg-slate-50 dark:bg-[#13111a] rounded-xl">
              <div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Tu rol</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 capitalize">{member?.rol ?? '—'}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                member?.rol === 'admin' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}>
                {member?.rol === 'admin' ? 'Administrador' : 'Colaborador'}
              </span>
            </div>
          </div>
        </section>

        {/* ── Equipo ── */}
        <section className="bg-white dark:bg-[#1e1a2e] rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm p-6">
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-5 flex items-center gap-2">
            <span className="material-symbols-outlined text-lg text-primary">group</span>
            Equipo
          </h3>
          {miembros.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">Cargando miembros...</p>
          ) : (
            <div className="space-y-2">
              {miembros.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-sm flex-shrink-0">
                      {(m.nombre ?? m.email ?? '?').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{m.nombre ?? '—'}</p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">{m.email ?? '—'}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    m.rol === 'admin' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>
                    {m.rol === 'admin' ? 'Admin' : 'Colaborador'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Notificaciones ── */}
        <section className="bg-white dark:bg-[#1e1a2e] rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm p-6">
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-5 flex items-center gap-2">
            <span className="material-symbols-outlined text-lg text-primary">notifications</span>
            Notificaciones
          </h3>

          <div className="space-y-1">
            <ToggleRow label="Nuevos leads asignados" desc="Recibir alerta cuando se te asigne un lead" checked={notifs.nuevosLeads} onChange={toggleNotif('nuevosLeads')} />
            <div className="h-px bg-slate-50" />
            <ToggleRow label="Negocios sin actividad 7 días" desc="Recordatorio de deals sin interacción" checked={notifs.sinActividad} onChange={toggleNotif('sinActividad')} />
            <div className="h-px bg-slate-50" />
            <ToggleRow label="Tareas vencidas" desc="Notificación de actividades pendientes" checked={notifs.tareasVencidas} onChange={toggleNotif('tareasVencidas')} />
            <div className="h-px bg-slate-50" />
            <ToggleRow label="Resumen diario por email" desc="Recibe un reporte al inicio del día" checked={notifs.resumenDiario} onChange={toggleNotif('resumenDiario')} />
          </div>
        </section>

        {/* ── WhatsApp ── */}
        <section className="bg-white dark:bg-[#1e1a2e] rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-green-600">whatsapp</span>
              WhatsApp
            </h3>
            {waLocal?.connected ? (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-100 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                Conectado
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-500">Sin conexión</span>
            )}
          </div>

          {waLocal?.connected ? (
            <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-100 dark:border-green-900/30">
              <span className="material-symbols-outlined text-2xl text-green-600">check_circle</span>
              <div>
                <p className="text-sm font-bold text-green-700 dark:text-green-400">WhatsApp activo</p>
                <p className="text-xs text-green-600 dark:text-green-500">Los mensajes se envían y reciben correctamente</p>
              </div>
            </div>
          ) : waQr ? (
            <div className="flex flex-col items-center gap-3 py-2">
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                Escanea este QR desde WhatsApp en tu teléfono
              </p>
              <p className="text-[10px] text-slate-400 text-center">Ajustes → Dispositivos vinculados → Vincular dispositivo</p>
              <img src={waQrImage ?? ''} alt="WhatsApp QR" className="w-52 h-52 rounded-xl border-4 border-white dark:border-slate-700 shadow-lg" />
              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs animate-spin">autorenew</span>
                Detectando conexión...
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-[#252035] rounded-xl border border-slate-100 dark:border-slate-700/50">
              <span className="material-symbols-outlined text-2xl text-slate-400">info</span>
              <div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Sin conexión activa</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Contacta al administrador para activar WhatsApp en tu cuenta.</p>
              </div>
            </div>
          )}
        </section>

        {/* ── Equipo ── */}
        {member?.rol === 'admin' && (
          <section className="bg-white dark:bg-[#1e1a2e] rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span className="material-symbols-outlined text-lg text-primary">groups</span>
                Equipo · {miembros.length} miembro{miembros.length !== 1 ? 's' : ''}
              </h3>
              <button
                onClick={() => setColaboradorOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90 transition-all"
              >
                <span className="material-symbols-outlined text-sm">person_add</span>
                Agregar colaborador
              </button>
            </div>

            {/* Links de invitación activos */}
            {invitaciones.filter(i => !i.used_at).length > 0 && (
              <div className="mb-4 space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Invitaciones pendientes</p>
                {invitaciones.filter(i => !i.used_at).map(inv => (
                  <div key={inv.id} className="flex items-center gap-2 p-3 bg-primary/5 rounded-xl border border-primary/20">
                    <div className="flex-1 min-w-0">
                      {inv.nombre_invitado && (
                        <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">{inv.nombre_invitado}</p>
                      )}
                      <code className="text-[10px] text-slate-500 dark:text-slate-400 truncate block">
                        {window.location.origin}/?join={inv.token}
                      </code>
                    </div>
                    <button
                      onClick={() => copiarLink(inv.token)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold rounded-lg transition-all flex-shrink-0 ${copiedToken === inv.token ? 'bg-green-500 text-white' : 'bg-primary text-white hover:opacity-90'}`}
                    >
                      <span className="material-symbols-outlined text-sm">{copiedToken === inv.token ? 'check' : 'content_copy'}</span>
                      {copiedToken === inv.token ? 'Copiado' : 'Copiar'}
                    </button>
                    <button onClick={() => borrarInvitacion(inv.id)} className="size-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors flex-shrink-0">
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                ))}
                <p className="text-[10px] text-slate-400">Cada link es de un solo uso. El colaborador crea su propia contraseña.</p>
              </div>
            )}

            {/* Lista de miembros */}
            <div className="space-y-2 mb-6">
              {miembros.map(m => (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50">
                  <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-black flex-shrink-0">
                    {(m.nombre ?? m.email ?? '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{m.nombre ?? '—'}</p>
                    <p className="text-[10px] text-slate-400 truncate">{m.email ?? '—'}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize flex-shrink-0 ${m.rol === 'admin' ? 'bg-primary/10 text-primary' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                    {m.rol}
                  </span>
                  {m.id === member.userId && (
                    <span className="text-[10px] text-slate-300 flex-shrink-0">Tú</span>
                  )}
                </div>
              ))}
            </div>

            {/* Ranking del equipo */}
            {ranking.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-xs">leaderboard</span>
                  Ranking del equipo
                </p>
                <div className="space-y-2">
                  {ranking.map((r, idx) => {
                    const maxPts = ranking[0]?.puntos ?? 1;
                    const pct = maxPts > 0 ? Math.round((r.puntos / maxPts) * 100) : 0;
                    const medals = ['🥇', '🥈', '🥉'];
                    return (
                      <div key={r.id} className="p-3 rounded-xl border border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-[#252035]/50">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-lg leading-none w-6 text-center flex-shrink-0">
                            {idx < 3 ? medals[idx] : <span className="text-xs font-black text-slate-400">#{idx + 1}</span>}
                          </span>
                          <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-black flex-shrink-0">
                            {(r.nombre ?? r.email ?? '?').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{r.nombre ?? r.email}</p>
                            <p className="text-[10px] text-slate-400">
                              {r.negociosCerrados} cerrado{r.negociosCerrados !== 1 ? 's' : ''} · {r.actividadesCompletadas} actividad{r.actividadesCompletadas !== 1 ? 'es' : ''}
                            </p>
                          </div>
                          <span className="text-xs font-black text-primary flex-shrink-0">{r.puntos} pts</span>
                        </div>
                        <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-400 mt-2">Puntos: negocios creados ×3 · cerrados ×15 · actividades completadas ×1</p>
              </div>
            )}
          </section>
        )}

        <CrearColaboradorModal
          open={colaboradorOpen}
          onClose={() => setColaboradorOpen(false)}
          orgId={member?.orgId ?? ''}
          onCreado={() => { if (member?.orgId) listarInvitaciones(member.orgId).then(setInvitaciones); }}
        />

        {/* ── Integraciones ── */}
        <section className="bg-white dark:bg-[#1e1a2e] rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm p-6">
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
            <span className="material-symbols-outlined text-lg text-primary">extension</span>
            Integraciones
          </h3>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-5">
            Conecta tu cuenta de Google para acceder a Gmail, Calendar y Tasks directamente desde el CRM.
          </p>

          {/* Google */}
          <div className="rounded-xl border border-slate-100 dark:border-slate-700/50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center shadow-sm">
                  <svg className="size-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Google Workspace</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {googleLoading ? 'Verificando...' : googleConnected
                      ? `Gmail · Calendar · Tasks — ${googleEmail ?? ''}`
                      : 'Gmail, Calendar y Tasks'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {googleLoading ? (
                  <div className="size-5 animate-spin border-2 border-primary border-t-transparent rounded-full" />
                ) : googleConnected ? (
                  <>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold border bg-green-50 text-green-700 border-green-100">
                      Conectado
                    </span>
                    <button
                      onClick={disconnectGoogle}
                      className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-[11px] font-bold rounded-lg hover:border-red-200 hover:text-red-500 transition-colors"
                    >
                      Desconectar
                    </button>
                  </>
                ) : (
                  <button
                    onClick={connectGoogle}
                    disabled={connectingGoogle}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg shadow-md shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-60"
                  >
                    {connectingGoogle
                      ? <><div className="size-3.5 animate-spin border-2 border-white border-t-transparent rounded-full" /> Conectando...</>
                      : <><span className="material-symbols-outlined text-sm">add_link</span> Conectar Google</>
                    }
                  </button>
                )}
              </div>
            </div>

            {/* Scopes detail */}
            {googleConnected && (
              <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-700/50 border-t border-slate-100 dark:border-slate-700/50">
                {[
                  { icon: 'mail', label: 'Gmail', desc: 'Leer y enviar correos' },
                  { icon: 'calendar_month', label: 'Calendar', desc: 'Eventos y reuniones' },
                  { icon: 'task_alt', label: 'Tasks', desc: 'Tareas de Google' },
                ].map(({ label, desc }) => (
                  <div key={label} className="flex items-center gap-2.5 px-4 py-3">
                    <span className="material-symbols-outlined text-base text-green-500">check_circle</span>
                    <div>
                      <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{label}</p>
                      <p className="text-[10px] text-slate-400">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Not connected helper */}
            {!googleConnected && !googleLoading && (
              <div className="border-t border-slate-100 dark:border-slate-700/50 px-4 py-3 bg-primary/[0.02]">
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Al conectar se solicitará acceso a Gmail, Calendar y Tasks. Podrás ver correos en cada contacto, eventos en Actividades y tareas de Google directamente en el CRM.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* ── Pipelines ── */}
        <section className="bg-white dark:bg-[#1e1a2e] rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm p-6">
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-5 flex items-center gap-2">
            <span className="material-symbols-outlined text-lg text-primary">view_kanban</span>
            Pipelines de ventas
          </h3>
          <PipelinesSettings />
        </section>

        {/* ── Campos personalizados ── */}
        <section className="bg-white dark:bg-[#1e1a2e] rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm p-6">
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-5 flex items-center gap-2">
            <span className="material-symbols-outlined text-lg text-primary">tune</span>
            Campos personalizados
          </h3>
          <CamposPersonalizadosSettings />
        </section>

      </div>
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between py-3 px-2">
      <div>
        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{label}</p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${checked ? 'bg-primary' : 'bg-slate-200'}`}
      >
        <span className={`pointer-events-none inline-block size-5 rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}
