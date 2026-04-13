import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Navigate } from 'react-router-dom';
import { WA_URL } from '@/lib/wa-url';

type Org = { id: string; nombre: string; created_at: string };
type WaStatus = { connected: boolean; status: string; phone?: string };
type QrModal = { orgId: string; orgNombre: string } | null;
type OrgMember = { user_id: string; nombre: string | null; email: string | null; rol: string };
type MemberStat = { acts_total: number; acts_done: number; deals: number; deals_cierre: number; score: number };

const MEDAL = ['🥇', '🥈', '🥉'];

function calcScore(s: MemberStat) {
  return s.acts_done * 10 + s.deals * 20 + s.deals_cierre * 100;
}

export default function Admin() {
  const { member, isMaster, signOut } = useAuth();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [waStatus, setWaStatus] = useState<Record<string, WaStatus>>({});
  const [loading, setLoading] = useState(true);
  const [qrModal, setQrModal] = useState<QrModal>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrConnected, setQrConnected] = useState(false);

  const [showNewOrg, setShowNewOrg] = useState(false);
  const [newOrgNombre, setNewOrgNombre] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);

  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
  const [orgMembers, setOrgMembers] = useState<Record<string, OrgMember[]>>({});
  const [loadingMembers, setLoadingMembers] = useState<string | null>(null);

  const [memberStats, setMemberStats] = useState<Record<string, Record<string, MemberStat>>>({});
  const [inviteOpen, setInviteOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  if (!isMaster) return <Navigate to="/" replace />;

  async function loadOrgs() {
    setLoading(true);
    const { data } = await supabase
      .from('organizaciones')
      .select('id, nombre, created_at')
      .order('created_at', { ascending: false });
    setOrgs(data ?? []);
    setLoading(false);
    (data ?? []).forEach(org => fetchWaStatus(org.id));
  }

  async function fetchWaStatus(orgId: string) {
    try {
      const res = await fetch(`${WA_URL}/status?orgId=${orgId}`);
      const json = await res.json();
      setWaStatus(prev => ({ ...prev, [orgId]: json }));
    } catch {
      setWaStatus(prev => ({ ...prev, [orgId]: { connected: false, status: 'sin_conexion' } }));
    }
  }

  async function initWa(org: Org) {
    await fetch(`${WA_URL}/init/${org.id}`, { method: 'POST' });
    setQrImage(null);
    setQrConnected(false);
    setQrModal({ orgId: org.id, orgNombre: org.nombre });
  }

  async function disconnectWa(orgId: string, orgNombre: string) {
    if (!window.confirm(`¿Desconectar WhatsApp de "${orgNombre}"?\nEl usuario deberá volver a escanear el QR.`)) return;
    setDisconnecting(orgId);
    try {
      await fetch(`${WA_URL}/logout/${orgId}`, { method: 'POST' });
    } catch { /* servidor puede no responder si ya está caído */ }
    await supabase.from('organizaciones').update({ wa_activo: false }).eq('id', orgId);
    setWaStatus(prev => ({ ...prev, [orgId]: { connected: false, status: 'disconnected' } }));
    setDisconnecting(null);
  }

  async function crearOrg() {
    if (!newOrgNombre.trim()) return;
    setCreatingOrg(true);
    const { error } = await supabase.from('organizaciones').insert({ nombre: newOrgNombre.trim() });
    setCreatingOrg(false);
    if (!error) { setNewOrgNombre(''); setShowNewOrg(false); loadOrgs(); }
  }

  async function eliminarOrg(org: Org) {
    if (!window.confirm(`¿Eliminar la organización "${org.nombre}"? Esta acción no se puede deshacer.`)) return;
    await supabase.from('organizaciones').delete().eq('id', org.id);
    setOrgs(prev => prev.filter(o => o.id !== org.id));
  }

  async function loadMemberStats(orgId: string, members: OrgMember[]) {
    if (members.length === 0) return;
    const userIds = members.map(m => m.user_id);

    const [{ data: acts }, { data: deals }] = await Promise.all([
      supabase.from('actividades').select('created_by, completada').eq('org_id', orgId).in('created_by', userIds),
      supabase.from('negocios').select('created_by, etapa').eq('org_id', orgId).in('created_by', userIds),
    ]);

    const stats: Record<string, MemberStat> = {};
    for (const m of members) {
      const uid = m.user_id;
      const myActs = (acts ?? []).filter(a => a.created_by === uid);
      const myDeals = (deals ?? []).filter(d => d.created_by === uid);
      const s: MemberStat = {
        acts_total: myActs.length,
        acts_done: myActs.filter(a => a.completada).length,
        deals: myDeals.length,
        deals_cierre: myDeals.filter(d => d.etapa === 'Cierre').length,
        score: 0,
      };
      s.score = calcScore(s);
      stats[uid] = s;
    }
    setMemberStats(prev => ({ ...prev, [orgId]: stats }));
  }

  async function toggleMembersPanel(orgId: string) {
    if (expandedOrg === orgId) { setExpandedOrg(null); return; }
    setExpandedOrg(orgId);
    if (orgMembers[orgId]) {
      loadMemberStats(orgId, orgMembers[orgId]);
      return;
    }
    setLoadingMembers(orgId);
    const { data } = await supabase
      .from('miembros')
      .select('user_id, nombre, email, rol')
      .eq('org_id', orgId)
      .order('nombre');
    const list = data ?? [];
    setOrgMembers(prev => ({ ...prev, [orgId]: list }));
    setLoadingMembers(null);
    loadMemberStats(orgId, list);
  }

  async function cambiarRol(orgId: string, userId: string, nuevoRol: string) {
    await supabase.from('miembros').update({ rol: nuevoRol }).eq('user_id', userId).eq('org_id', orgId);
    setOrgMembers(prev => ({
      ...prev,
      [orgId]: (prev[orgId] ?? []).map(m => m.user_id === userId ? { ...m, rol: nuevoRol } : m),
    }));
  }

  async function eliminarMiembro(orgId: string, userId: string) {
    if (!window.confirm('¿Eliminar este miembro de la organización?')) return;
    await supabase.from('miembros').delete().eq('user_id', userId).eq('org_id', orgId);
    setOrgMembers(prev => ({
      ...prev,
      [orgId]: (prev[orgId] ?? []).filter(m => m.user_id !== userId),
    }));
  }

  function copyInviteLink(orgId: string) {
    const link = `${window.location.origin}/?join=${orgId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // QR polling while modal is open
  useEffect(() => {
    if (!qrModal) { setQrImage(null); setQrConnected(false); return; }
    let alive = true;

    const poll = async () => {
      // Check if connected first
      try {
        const statusRes = await fetch(`${WA_URL}/status?orgId=${qrModal.orgId}`).then(r => r.json());
        if (!alive) return;
        if (statusRes?.connected) {
          setWaStatus(prev => ({ ...prev, [qrModal.orgId]: statusRes }));
          setQrConnected(true);
          return;
        }
      } catch { /* ignore */ }

      // Try to get QR
      try {
        const qrRes = await fetch(`${WA_URL}/qr?orgId=${qrModal.orgId}`).then(r => r.json());
        if (!alive) return;
        const raw: string | null = qrRes?.qr ?? qrRes?.qrDataUrl ?? null;
        if (raw) {
          if (raw.startsWith('data:') || raw.startsWith('iVBOR')) {
            setQrImage(raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`);
          } else {
            const QRCode = (await import('qrcode')).default;
            const url = await QRCode.toDataURL(raw, { width: 230, margin: 2 });
            if (alive) setQrImage(url);
          }
        }
      } catch { /* no QR yet */ }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => { alive = false; clearInterval(interval); };
  }, [qrModal?.orgId]);

  useEffect(() => { loadOrgs(); }, []);

  const statusLabel: Record<string, { label: string; color: string }> = {
    connected:       { label: 'Conectado',    color: 'bg-green-100 text-green-700' },
    qr_ready:        { label: 'QR pendiente', color: 'bg-yellow-100 text-yellow-700' },
    initializing:    { label: 'Iniciando…',   color: 'bg-blue-100 text-blue-700' },
    disconnected:    { label: 'Desconectado', color: 'bg-red-100 text-red-700' },
    not_initialized: { label: 'Sin iniciar',  color: 'bg-slate-100 text-slate-500' },
    sin_conexion:    { label: 'Sin servidor', color: 'bg-slate-100 text-slate-400' },
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-9 bg-primary rounded-lg flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-xl">shield</span>
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900 uppercase tracking-widest">Pudu Admin</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Panel maestro</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">{member?.email}</span>
          <button onClick={signOut} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors">
            <span className="material-symbols-outlined text-base">logout</span>
            Salir
          </button>
        </div>
      </header>

      <div className="flex-1 px-8 py-8 max-w-5xl mx-auto w-full">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">Organizaciones</p>
            <p className="text-3xl font-black text-slate-900">{orgs.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">WA Conectados</p>
            <p className="text-3xl font-black text-green-600">{Object.values(waStatus).filter(s => s.connected).length}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">WA Desconectados</p>
            <p className="text-3xl font-black text-red-500">{Object.values(waStatus).filter(s => !s.connected).length}</p>
          </div>
        </div>

        {/* Orgs table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-800">Organizaciones</h2>
            <div className="flex items-center gap-2">
              <button onClick={loadOrgs} className="size-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                <span className="material-symbols-outlined text-sm">refresh</span>
              </button>
              <button
                onClick={() => setShowNewOrg(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90 transition-all"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Nueva Org
              </button>
            </div>
          </div>

          {showNewOrg && (
            <div className="px-6 py-4 bg-primary/5 border-b border-primary/10 flex items-center gap-3">
              <input
                autoFocus
                type="text"
                placeholder="Nombre de la organización"
                value={newOrgNombre}
                onChange={e => setNewOrgNombre(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && crearOrg()}
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
              />
              <button onClick={crearOrg} disabled={creatingOrg || !newOrgNombre.trim()} className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90 disabled:opacity-50 transition-all">
                {creatingOrg ? 'Creando…' : 'Crear'}
              </button>
              <button onClick={() => setShowNewOrg(false)} className="text-slate-400 hover:text-slate-600 text-xs font-bold">Cancelar</button>
            </div>
          )}

          {loading ? (
            <div className="p-8 flex justify-center">
              <span className="material-symbols-outlined text-slate-300 animate-spin text-3xl">progress_activity</span>
            </div>
          ) : orgs.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">Sin organizaciones</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {orgs.map(org => {
                const ws = waStatus[org.id];
                const st = statusLabel[ws?.status ?? 'not_initialized'] ?? statusLabel.not_initialized;
                const isExpanded = expandedOrg === org.id;
                const members = orgMembers[org.id] ?? [];
                const stats = memberStats[org.id] ?? {};
                const ranked = [...members].sort((a, b) => (stats[b.user_id]?.score ?? 0) - (stats[a.user_id]?.score ?? 0));
                const maxScore = ranked[0] ? (stats[ranked[0].user_id]?.score ?? 0) : 1;

                return (
                  <div key={org.id}>
                    <div className="flex items-center hover:bg-slate-50/50 transition-colors">
                      <button onClick={() => toggleMembersPanel(org.id)} className="px-4 py-4 text-slate-400 hover:text-slate-600">
                        <span className="material-symbols-outlined text-sm">{isExpanded ? 'expand_less' : 'expand_more'}</span>
                      </button>
                      <div className="flex-1 px-2 py-4">
                        <p className="font-semibold text-slate-900 text-sm">{org.nombre}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{org.id.slice(0, 8)}…</p>
                      </div>
                      <div className="px-6 py-4 text-[11px] text-slate-400">
                        {new Date(org.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                      {/* WA Status */}
                      <div className="px-4 py-4 min-w-[140px]">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${st.color}`}>
                          {ws?.connected && <span className="size-1.5 rounded-full bg-green-500 animate-pulse inline-block" />}
                          {st.label}
                        </span>
                        {ws?.phone && (
                          <p className="text-[10px] text-slate-400 mt-1 font-mono pl-1">+{ws.phone.replace('@c.us', '')}</p>
                        )}
                      </div>
                      {/* WA Actions */}
                      <div className="px-4 py-4 flex items-center gap-2">
                        {ws?.connected ? (
                          <>
                            <button
                              onClick={() => initWa(org)}
                              title="Ver QR / Reconectar"
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 hover:text-primary border border-slate-200 hover:border-primary/30 rounded-lg transition-all"
                            >
                              <span className="material-symbols-outlined text-sm">qr_code</span>
                              QR
                            </button>
                            <button
                              onClick={() => disconnectWa(org.id, org.nombre)}
                              disabled={disconnecting === org.id}
                              title="Desconectar WhatsApp"
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 rounded-lg transition-all disabled:opacity-40"
                            >
                              <span className="material-symbols-outlined text-sm">link_off</span>
                              {disconnecting === org.id ? '…' : 'Desconectar'}
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => initWa(org)}
                            className="text-xs font-semibold text-primary hover:underline"
                          >
                            Vincular WA
                          </button>
                        )}
                        <button onClick={() => eliminarOrg(org)} className="size-6 flex items-center justify-center rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors" title="Eliminar organización">
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>

                    {/* ── Panel expandido ── */}
                    {isExpanded && (
                      <div className="bg-slate-50 border-t border-slate-100 px-6 py-5 space-y-6">

                        {/* Invitar miembro */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Miembros · {members.length}</p>
                            <button
                              onClick={() => setInviteOpen(inviteOpen === org.id ? null : org.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
                            >
                              <span className="material-symbols-outlined text-sm">person_add</span>
                              Invitar miembro
                            </button>
                          </div>

                          {inviteOpen === org.id && (
                            <div className="mb-4 p-4 bg-white rounded-xl border border-primary/20 space-y-3">
                              <p className="text-xs text-slate-600 font-medium">Comparte este link con el nuevo miembro para que se una a <strong>{org.nombre}</strong>:</p>
                              <div className="flex items-center gap-2">
                                <code className="flex-1 text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-600 truncate">
                                  {window.location.origin}/?join={org.id}
                                </code>
                                <button
                                  onClick={() => copyInviteLink(org.id)}
                                  className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold rounded-lg transition-all ${copied ? 'bg-green-500 text-white' : 'bg-primary text-white hover:opacity-90'}`}
                                >
                                  <span className="material-symbols-outlined text-sm">{copied ? 'check' : 'content_copy'}</span>
                                  {copied ? 'Copiado' : 'Copiar'}
                                </button>
                              </div>
                            </div>
                          )}

                          {loadingMembers === org.id ? (
                            <p className="text-xs text-slate-400">Cargando…</p>
                          ) : members.length === 0 ? (
                            <p className="text-xs text-slate-400">Sin miembros</p>
                          ) : (
                            <div className="space-y-2">
                              {members.map(m => (
                                <div key={m.user_id} className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5 border border-slate-100">
                                  <div className="flex items-center gap-3">
                                    <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-black flex-shrink-0">
                                      {(m.nombre ?? m.email ?? '?').slice(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                      <p className="text-xs font-bold text-slate-800">{m.nombre ?? '—'}</p>
                                      <p className="text-[10px] text-slate-400">{m.email ?? '—'}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <select
                                      value={m.rol}
                                      onChange={e => cambiarRol(org.id, m.user_id, e.target.value)}
                                      className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    >
                                      <option value="admin">Admin</option>
                                      <option value="colaborador">Colaborador</option>
                                    </select>
                                    <button onClick={() => eliminarMiembro(org.id, m.user_id)} className="size-6 flex items-center justify-center rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors" title="Eliminar miembro">
                                      <span className="material-symbols-outlined text-sm">person_remove</span>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* ── Leaderboard de gamificación ── */}
                        {ranked.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-base">🏆</span>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Leaderboard · Rendimiento del equipo</p>
                            </div>
                            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                              {ranked.map((m, i) => {
                                const s = stats[m.user_id] ?? { acts_total: 0, acts_done: 0, deals: 0, deals_cierre: 0, score: 0 };
                                const pct = maxScore > 0 ? Math.round((s.score / maxScore) * 100) : 0;
                                const isTop = i === 0;
                                return (
                                  <div key={m.user_id} className={`flex items-center gap-4 px-4 py-3 ${i < ranked.length - 1 ? 'border-b border-slate-50' : ''} ${isTop ? 'bg-yellow-50/50' : ''}`}>
                                    <span className="text-lg w-6 text-center flex-shrink-0">{MEDAL[i] ?? `${i + 1}`}</span>
                                    <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-black flex-shrink-0">
                                      {(m.nombre ?? m.email ?? '?').slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between mb-1">
                                        <p className="text-xs font-bold text-slate-800 truncate">{m.nombre ?? m.email ?? '—'}</p>
                                        <span className={`text-xs font-black ml-2 flex-shrink-0 ${isTop ? 'text-yellow-600' : 'text-slate-600'}`}>{s.score} pts</span>
                                      </div>
                                      <div className="h-1.5 bg-slate-100 rounded-full">
                                        <div className={`h-1.5 rounded-full transition-all duration-700 ${isTop ? 'bg-yellow-400' : 'bg-primary/60'}`} style={{ width: `${pct}%` }} />
                                      </div>
                                      <div className="flex gap-3 mt-1">
                                        <span className="text-[10px] text-slate-400">✅ {s.acts_done}/{s.acts_total} actvs.</span>
                                        <span className="text-[10px] text-slate-400">💼 {s.deals} negocios</span>
                                        <span className="text-[10px] text-slate-400">🏁 {s.deals_cierre} cerrados</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <p className="text-[10px] text-slate-300 mt-2 text-right">Actividad +10 · Negocio +20 · Cierre +100</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* QR Modal */}
      {qrModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setQrModal(null)}>
          <div className="bg-white rounded-2xl p-8 w-96 flex flex-col items-center shadow-2xl" onClick={e => e.stopPropagation()}>
            {qrConnected ? (
              <>
                <div className="size-16 rounded-2xl bg-green-100 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-green-600 text-3xl">check_circle</span>
                </div>
                <p className="text-sm font-black text-slate-900 mb-1">¡WhatsApp Conectado!</p>
                <p className="text-xs text-slate-500 mb-5">{qrModal.orgNombre}</p>
                <button onClick={() => setQrModal(null)} className="px-6 py-2 bg-green-500 text-white text-xs font-bold rounded-xl hover:opacity-90 transition-all">
                  Cerrar
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-primary text-xl">qr_code_scanner</span>
                  <p className="text-sm font-black text-slate-900">Escanear QR</p>
                </div>
                <p className="text-xs text-slate-500 mb-5">{qrModal.orgNombre}</p>

                <div className="size-56 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center mb-5">
                  {qrImage ? (
                    <img src={qrImage} alt="QR WhatsApp" className="size-52 rounded-lg" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <span className="material-symbols-outlined text-3xl animate-spin">progress_activity</span>
                      <p className="text-xs">Generando QR…</p>
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-slate-400 text-center leading-relaxed mb-4">
                  Abre WhatsApp → Dispositivos vinculados → Vincular dispositivo y escanea el código.
                </p>

                <div className="flex items-center gap-2">
                  <div className="size-1.5 rounded-full bg-yellow-400 animate-pulse" />
                  <p className="text-[11px] text-slate-400">Esperando escaneo… se actualiza automáticamente</p>
                </div>

                <button onClick={() => setQrModal(null)} className="mt-5 text-xs text-slate-400 hover:text-slate-600 transition-colors">
                  Cerrar
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}