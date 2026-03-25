import { useState } from 'react';

const labelClass = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5';
const inputClass =
  'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white';

interface TeamMember {
  initials: string;
  name: string;
  role: string;
  active: boolean;
}

const teamMembers: TeamMember[] = [
  { initials: 'CM', name: 'Carlos Méndez', role: 'Sales Manager', active: true },
  { initials: 'AP', name: 'Ana Pérez', role: 'Account Executive', active: true },
  { initials: 'RK', name: 'Rodrigo Kast', role: 'SDR', active: false },
];

interface Integration {
  icon: string;
  name: string;
  status: 'connected' | 'error';
  desc: string;
}

const integrations: Integration[] = [
  { icon: 'mail', name: 'Gmail', status: 'connected', desc: 'Sincronización de correos activa' },
  { icon: 'calendar_month', name: 'Calendar', status: 'connected', desc: 'Reuniones sincronizadas' },
  { icon: 'cloud', name: 'Salesforce', status: 'error', desc: 'Error de autenticación' },
];

export default function Settings() {
  const [profile, setProfile] = useState({
    nombre: 'Carlos Méndez',
    email: 'carlos@puducrm.cl',
    cargo: 'Sales Manager',
  });

  const [notifs, setNotifs] = useState({
    nuevosLeads: true,
    sinActividad: true,
    tareasVencidas: true,
    resumenDiario: false,
  });

  const setProfileField = (field: keyof typeof profile) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => setProfile((prev) => ({ ...prev, [field]: e.target.value }));

  const toggleNotif = (field: keyof typeof notifs) => () =>
    setNotifs((prev) => ({ ...prev, [field]: !prev[field] }));

  return (
    <div className="">
      {/* Page header */}
      <div className="flex flex-col mb-8">
        <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-2">
          Configuración
        </span>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Ajustes</h2>
      </div>

      <div className="max-w-2xl space-y-6">

        {/* ── Perfil ── */}
        <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <h3 className="text-sm font-black text-slate-900 mb-5 flex items-center gap-2">
            <span className="material-symbols-outlined text-lg text-primary">manage_accounts</span>
            Perfil
          </h3>

          <div className="flex items-center gap-5 mb-6">
            <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-4xl text-primary">person</span>
            </div>
            <div>
              <p className="text-base font-black text-slate-900">{profile.nombre}</p>
              <p className="text-xs text-slate-500">{profile.cargo}</p>
              <button className="mt-2 text-[11px] font-bold text-primary hover:underline">
                Cambiar foto
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className={labelClass}>Nombre completo</label>
              <input
                type="text"
                value={profile.nombre}
                onChange={setProfileField('nombre')}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                value={profile.email}
                onChange={setProfileField('email')}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Cargo</label>
              <input
                type="text"
                value={profile.cargo}
                onChange={setProfileField('cargo')}
                className={inputClass}
              />
            </div>
          </div>

          <div className="h-px bg-slate-100 my-6" />

          <div className="flex justify-end">
            <button className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:opacity-90 transition-all shadow-lg shadow-primary/20">
              Guardar cambios
            </button>
          </div>
        </section>

        {/* ── Equipo ── */}
        <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-primary">group</span>
              Equipo
            </h3>
            <button className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">
              <span className="material-symbols-outlined text-sm">person_add</span>
              Invitar miembro
            </button>
          </div>

          <div className="space-y-2">
            {teamMembers.map((member) => (
              <div
                key={member.name}
                className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-black text-primary flex-shrink-0">
                    {member.initials}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{member.name}</p>
                    <p className="text-[11px] text-slate-500">{member.role}</p>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    member.active
                      ? 'bg-green-50 text-green-700 border-green-100'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}
                >
                  {member.active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Notificaciones ── */}
        <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <h3 className="text-sm font-black text-slate-900 mb-5 flex items-center gap-2">
            <span className="material-symbols-outlined text-lg text-primary">notifications</span>
            Notificaciones
          </h3>

          <div className="space-y-1">
            <ToggleRow
              label="Nuevos leads asignados"
              desc="Recibir alerta cuando se te asigne un lead"
              checked={notifs.nuevosLeads}
              onChange={toggleNotif('nuevosLeads')}
            />
            <div className="h-px bg-slate-50" />
            <ToggleRow
              label="Negocios sin actividad 7 días"
              desc="Recordatorio de deals sin interacción"
              checked={notifs.sinActividad}
              onChange={toggleNotif('sinActividad')}
            />
            <div className="h-px bg-slate-50" />
            <ToggleRow
              label="Tareas vencidas"
              desc="Notificación de actividades pendientes"
              checked={notifs.tareasVencidas}
              onChange={toggleNotif('tareasVencidas')}
            />
            <div className="h-px bg-slate-50" />
            <ToggleRow
              label="Resumen diario por email"
              desc="Recibe un reporte al inicio del día"
              checked={notifs.resumenDiario}
              onChange={toggleNotif('resumenDiario')}
            />
          </div>
        </section>

        {/* ── Integraciones ── */}
        <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <h3 className="text-sm font-black text-slate-900 mb-5 flex items-center gap-2">
            <span className="material-symbols-outlined text-lg text-primary">extension</span>
            Integraciones
          </h3>

          <div className="space-y-3">
            {integrations.map((integ) => (
              <div
                key={integ.name}
                className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-xl bg-slate-100 flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl text-slate-600">
                      {integ.icon}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{integ.name}</p>
                    <p className="text-[11px] text-slate-500">{integ.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                      integ.status === 'connected'
                        ? 'bg-green-50 text-green-700 border-green-100'
                        : 'bg-red-50 text-red-600 border-red-100'
                    }`}
                  >
                    {integ.status === 'connected' ? 'Conectado' : 'Error'}
                  </span>
                  {integ.status === 'error' && (
                    <button className="px-3 py-1.5 border border-red-200 text-red-600 text-[11px] font-bold rounded-lg hover:bg-red-50 transition-colors">
                      Reconectar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 px-2">
      <div>
        <p className="text-sm font-bold text-slate-800">{label}</p>
        <p className="text-[11px] text-slate-400">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
          checked ? 'bg-primary' : 'bg-slate-200'
        }`}
      >
        <span
          className={`pointer-events-none inline-block size-5 rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
