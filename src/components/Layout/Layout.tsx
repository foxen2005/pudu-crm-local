import { useState } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { RightPanel } from './RightPanel';
import { FloatingCommandBar } from './CommandBar';
import { NuevoRegistroModal } from '@/components/modals/NuevoRegistroModal';
import { NuevoContactoModal } from '@/components/modals/NuevoContactoModal';
import { NuevaEmpresaModal } from '@/components/modals/NuevaEmpresaModal';
import { NuevoNegocioModal } from '@/components/modals/NuevoNegocioModal';
import { NuevaActividadModal } from '@/components/modals/NuevaActividadModal';

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
        <header className="h-14 flex-shrink-0 flex items-center justify-end px-8 bg-white/70 backdrop-blur-md border-b border-slate-100 z-40">
          <div className="flex items-center gap-3">
            <button className="size-9 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 relative transition-colors">
              <span className="material-symbols-outlined text-xl">notifications</span>
              <span className="absolute top-2 right-2 size-2 bg-red-500 rounded-full" />
            </button>
            <button
              onClick={openNuevoRegistro}
              className="bg-primary text-white text-xs font-bold h-9 px-4 rounded-lg shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">add</span>
              Nuevo
            </button>
          </div>
        </header>

        {/* Scrollable content — pb-32 makes room for floating command bar */}
        <main className="flex-1 overflow-y-auto pb-32 overflow-x-hidden">
          <div className="p-8">
            {children || (
              <Outlet context={{ openRightPanel, closeRightPanel, openNuevoRegistro }} />
            )}
          </div>
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
