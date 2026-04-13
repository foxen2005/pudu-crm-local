import { supabase } from '@/lib/supabase';

/**
 * Banner inline que aparece cuando el token de Google expiró
 * y el auto-refresh no funcionó. Un clic reconecta sin salir de la página.
 */
export function GoogleReconnectBanner({ onReconnecting }: { onReconnecting?: () => void }) {
  const reconnect = async () => {
    onReconnecting?.();
    await supabase.auth.linkIdentity({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/tasks',
        redirectTo: window.location.href, // vuelve a la misma página
        queryParams: { access_type: 'offline', prompt: 'select_account' },
      },
    });
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl">
      <span className="material-symbols-outlined text-amber-500 flex-shrink-0">token</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-amber-800 dark:text-amber-300">Sesión de Google expirada</p>
        <p className="text-[11px] text-amber-600 dark:text-amber-400">El acceso a Gmail/Calendar venció. Reconecta para continuar.</p>
      </div>
      <button
        onClick={reconnect}
        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold rounded-lg transition-colors"
      >
        <span className="material-symbols-outlined text-sm">refresh</span>
        Reconectar
      </button>
    </div>
  );
}
