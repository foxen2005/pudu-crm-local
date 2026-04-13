import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { getWaActivoOrg } from '@/lib/db';
import { isGoogleConnected } from '@/lib/useGoogleData';

const navItems = [
  { to: '/', icon: 'dashboard', label: 'Dashboard', end: true },
  { to: '/contactos', icon: 'contacts', label: 'Contactos' },
  { to: '/empresas', icon: 'domain', label: 'Empresas' },
  { to: '/negocios', icon: 'account_tree', label: 'Negocios' },
  { to: '/actividades', icon: 'event_available', label: 'Actividades' },
  { to: '/productos', icon: 'inventory_2', label: 'Productos' },
  { to: '/automatizaciones', icon: 'auto_fix_high', label: 'Automatizaciones' },
  { to: '/reportes', icon: 'bar_chart', label: 'Reportes' },
];

export function Sidebar({ onNuevoRegistro }: { onNuevoRegistro?: () => void }) {
  const [waActive, setWaActive] = useState(false);
  const [googleActive, setGoogleActive] = useState(false);

  useEffect(() => {
    const check = () => {
      getWaActivoOrg().then(setWaActive);
      isGoogleConnected().then(setGoogleActive);
    };
    check();
    const interval = setInterval(check, 20000); // re-verifica cada 20s
    return () => clearInterval(interval);
  }, []);
  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 border-r border-slate-200 dark:border-slate-700/50 bg-white dark:bg-[#1a1625] flex flex-col h-full z-50">
      {/* Logo */}
      <div className="px-6 py-6 flex items-center gap-3">
        <div className="size-9 bg-primary rounded-lg flex items-center justify-center text-white shadow-lg shadow-primary/20 flex-shrink-0">
          <span className="material-symbols-outlined text-xl">rocket_launch</span>
        </div>
        <div className="min-w-0">
          <h1 className="font-black text-primary dark:text-primary uppercase tracking-[0.18em] text-xs leading-none whitespace-nowrap">Pudu CRM</h1>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5 whitespace-nowrap">Operational Command</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-2 overflow-y-auto no-scrollbar space-y-0.5">
        {navItems.map(({ to, icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium tracking-wide transition-all duration-150',
                isActive
                  ? 'bg-primary/10 text-primary font-semibold border-r-[3px] border-primary'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-200'
              )
            }
          >
            <span className="material-symbols-outlined text-[20px]">{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}

        {waActive && (
          <NavLink
            to="/whatsapp"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium tracking-wide transition-all duration-150',
                isActive
                  ? 'bg-primary/10 text-primary font-semibold border-r-[3px] border-primary'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-200'
              )
            }
          >
            <span className="material-symbols-outlined text-[20px]">chat</span>
            <span>WhatsApp</span>
          </NavLink>
        )}
        {googleActive && (
          <NavLink
            to="/correo"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium tracking-wide transition-all duration-150',
                isActive
                  ? 'bg-primary/10 text-primary font-semibold border-r-[3px] border-primary'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-200'
              )
            }
          >
            <span className="material-symbols-outlined text-[20px]">mail</span>
            <span>Correo</span>
          </NavLink>
        )}
      </nav>

      {/* Bottom: New + Settings */}
      <div className="px-4 pb-6 pt-4 border-t border-slate-100 dark:border-slate-700/50 space-y-1">
        <button onClick={onNuevoRegistro} className="w-full bg-primary text-white rounded-lg py-2.5 px-4 text-xs font-bold uppercase tracking-wider mb-3 shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-base">add</span>
          Nuevo Registro
        </button>
        <div className="flex items-center gap-2 px-3 py-2 mb-1">
          <div className="size-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Pudu AI activa</span>
        </div>

        <NavLink
          to="/configuracion"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium tracking-wide transition-all duration-150',
              isActive
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-200'
            )
          }
        >
          <span className="material-symbols-outlined text-[20px]">settings</span>
          <span>Configuración</span>
        </NavLink>
      </div>
    </aside>
  );
}
