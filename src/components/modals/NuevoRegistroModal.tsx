import { Modal } from '@/components/modals/Modal';
import { cn } from '@/lib/utils';

type EntityType = 'contacto' | 'empresa' | 'negocio' | 'actividad';

interface NuevoRegistroModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (type: EntityType) => void;
}

const tiles: { type: EntityType; icon: string; title: string; desc: string }[] = [
  {
    type: 'contacto',
    icon: 'contacts',
    title: 'Contacto',
    desc: 'Persona de contacto o lead',
  },
  {
    type: 'empresa',
    icon: 'domain',
    title: 'Empresa',
    desc: 'Organización o cliente',
  },
  {
    type: 'negocio',
    icon: 'account_tree',
    title: 'Negocio',
    desc: 'Oportunidad en el pipeline',
  },
  {
    type: 'actividad',
    icon: 'event_available',
    title: 'Actividad',
    desc: 'Llamada, reunión o tarea',
  },
];

export function NuevoRegistroModal({ open, onClose, onSelect }: NuevoRegistroModalProps) {
  const handleSelect = (type: EntityType) => {
    onSelect(type);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="¿Qué quieres crear?" size="md">
      <div className="px-6 py-6">
        <div className="grid grid-cols-2 gap-4">
          {tiles.map((tile) => (
            <button
              key={tile.type}
              type="button"
              onClick={() => handleSelect(tile.type)}
              className={cn(
                'group flex flex-col items-start gap-3 p-5 rounded-xl border-2 border-slate-200 bg-white text-left',
                'hover:border-primary hover:bg-primary/5 transition-all duration-150'
              )}
            >
              <div className="size-12 rounded-xl bg-slate-100 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined text-2xl text-slate-500 group-hover:text-primary transition-colors">
                  {tile.icon}
                </span>
              </div>
              <div>
                <p className="text-sm font-black text-slate-900 mb-0.5">{tile.title}</p>
                <p className="text-[11px] text-slate-500 leading-snug">{tile.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
