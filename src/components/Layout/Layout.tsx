import { useState, useEffect } from 'react';
import { Outlet, useOutletContext, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { RightPanel } from './RightPanel';
import { FloatingCommandBar } from './CommandBar';
import { NuevoRegistroModal } from '@/components/modals/NuevoRegistroModal';
import { NuevoContactoModal } from '@/components/modals/NuevoContactoModal';
import { NuevaEmpresaModal } from '@/components/modals/NuevaEmpresaModal';
import { NuevoNegocioModal } from '@/components/modals/NuevoNegocioModal';
import { NuevaActividadModal } from '@/components/modals/NuevaActividadModal';
import { useAuth } from '@/lib/auth';
import { useDarkMode } from '@/lib/darkMode';
import { evaluarAutomatizaciones } from '@/lib/db';
import { GlobalSearch } from './GlobalSearch';
import { NotificationBell } from './NotificationBell';

type RightPanelContext = {
  openRightPanel: (title: string, content: React.ReactNode) => void;
  closeRightPanel: () => void;
};

type ModalContext = {
  openNuevoRegistro: () => void;
};

export function usePanel() {
  return useOutletContext<RightPanelContext & ModalContext>();
}

interface LayoutProps {
  children?: React.ReactNode;
}

type EntityType = 'contacto' | 'empresa' | 'negocio' | 'actividad' | null;

export function Layout({ children }: LayoutProps) {
  const { signOut } = useAuth();
  const { dark, toggle } = useDarkMode();

  // Ejecutar automatizaciones activas al cargar la app
  useEffect(() => {
    evaluarAutomatizaciones();
  }, []);
  const location = useLocation();
  const isFullscreen = location.pathname === '/whatsapp';
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [rightPanelTitle, setRightPanelTitle] = useState('');
  const [rightPanelContent, setRightPanelContent] = useState<React.ReactNode>(null);

  const [nuevoRegistroOpen, setNuevoRegistroOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<EntityType>(null);

  const openRightPanel = (title: string, content: React.ReactNode) => {
    setRightPanelTitle(title);
    setRightPanelContent(content);
    setRightPanelOpen(true);
  };

  const closeRightPanel = () => {
    setRightPanelOpen(false);
    setRightPanelTitle('');
    setRightPanelContent(null);
  };

  const openNuevoRegistro = () => setNuevoRegistroOpen(true);

  const handleSelectEntity = (type: EntityType) => {
    setNuevoRegistroOpen(false);
    setActiveModal(type);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar onNuevoRegistro={openNuevoRegistro} />

      {/* Main area offset by sidebar width */}
      <div className="flex-1 flex flex-col ml-64 min-w-0">
        {/* Header */}
        <header className="h-14 flex-shrink-0 flex items-center justify-between px-8 bg-white/70 dark:bg-[#1e1a2e]/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-700/50 z-40">
          <GlobalSearch />
          <div className="flex items-center gap-3">
            <button
              onClick={toggle}
              className="size-9 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
              title={dark ? 'Modo claro' : 'Modo oscuro'}
            >
              <span className="material-symbols-outlined text-xl">
                {dark ? 'light_mode' : 'dark_mode'}
              </span>
            </button>
            <NotificationBell />
            <button
              onClick={() => signOut()}
              className="h-7 px-3 flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 dark:hover:bg-red-900/30 dark:hover:text-red-400 dark:hover:border-red-800 transition-all"
            >
              <span className="material-symbols-outlined text-sm">logout</span>
              Salir
            </button>
          </div>
        </header>

        {/* Scrollable content — pb-32 makes room for floating command bar */}
        <main className={`flex-1 overflow-x-hidden ${isFullscreen ? 'overflow-hidden flex flex-col min-h-0' : 'overflow-y-auto pb-32'}`}>
          {isFullscreen ? (
            <div>
              {children}
            </div>
          ) : (
            <div className="p-8">
              {children || (
                <Outlet context={{ openRightPanel, closeRightPanel, openNuevoRegistro }} />
              )}
            </div>
          )}
        </main>
      </div>

      {/* Floating command bar */}
      <FloatingCommandBar />

      {/* Right detail panel */}
      <RightPanel open={rightPanelOpen} onClose={closeRightPanel} title={rightPanelTitle}>
        {rightPanelContent}
      </RightPanel>

      {/* Global modals */}
      <NuevoRegistroModal
        open={nuevoRegistroOpen}
        onClose={() => setNuevoRegistroOpen(false)}
        onSelect={handleSelectEntity}
      />
      <NuevoContactoModal open={activeModal === 'contacto'} onClose={() => setActiveModal(null)} />
      <NuevaEmpresaModal open={activeModal === 'empresa'} onClose={() => setActiveModal(null)} />
      <NuevoNegocioModal open={activeModal === 'negocio'} onClose={() => setActiveModal(null)} />
      <NuevaActividadModal open={activeModal === 'actividad'} onClose={() => setActiveModal(null)} />
    </div>
  );
}
