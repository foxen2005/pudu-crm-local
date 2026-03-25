import { cn } from '@/lib/utils';

interface RightPanelProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function RightPanel({ open, onClose, title, children }: RightPanelProps) {
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/10 z-40 backdrop-blur-[1px]"
          onClick={onClose}
        />
      )}
      <div
        className={cn(
          'fixed top-4 right-4 bottom-20 w-[22rem] bg-white rounded-2xl shadow-2xl shadow-black/15 border border-slate-100/80 z-50 flex flex-col transition-all duration-300 ease-out',
          open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
            <h2 className="text-sm font-bold text-slate-900">{title}</h2>
            <button
              onClick={onClose}
              className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </>
  );
}
