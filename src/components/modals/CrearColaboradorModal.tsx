import { useState } from 'react';
import { Modal } from './Modal';
import { crearInvitacion } from '@/lib/db';

const inputClass =
  'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white dark:bg-[#252035] dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500';
const labelClass = 'block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5';

export function CrearColaboradorModal({
  open, onClose, orgId, onCreado,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
  onCreado?: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [link, setLink]     = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleClose = () => {
    setNombre(''); setEmail(''); setLink(null); setCopied(false);
    onClose();
  };

  const handleCrear = async () => {
    if (!nombre.trim()) return;
    setLoading(true);
    const token = await crearInvitacion(orgId, nombre.trim(), email.trim() || undefined);
    setLoading(false);
    if (token) {
      setLink(`${window.location.origin}/?join=${token}`);
      onCreado?.();
    }
  };

  const copyLink = () => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const sendWhatsApp = () => {
    if (!link) return;
    const msg = encodeURIComponent(`Hola ${nombre} 👋\n\nTe invito a unirte al equipo en Pudu CRM.\n\nIngresa con este enlace:\n${link}`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  const sendEmail = () => {
    if (!link) return;
    const subject = encodeURIComponent('Invitación a Pudu CRM');
    const body = encodeURIComponent(`Hola ${nombre},\n\nFuiste invitado a unirte al equipo en Pudu CRM.\n\nIngresa aquí:\n${link}\n\nSaludos`);
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
  };

  return (
    <Modal open={open} onClose={handleClose} title="Agregar colaborador" size="sm">
      <div className="px-6 py-5 space-y-4">

        {!link ? (
          <>
            {/* Nombre */}
            <div>
              <label className={labelClass}>Nombre completo *</label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej: María González"
                className={inputClass}
                autoFocus
              />
            </div>

            {/* Email */}
            <div>
              <label className={labelClass}>Email (opcional — para pre-llenar el registro)</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="maria@empresa.cl"
                className={inputClass}
              />
            </div>

            <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
              Se generará un enlace único. El colaborador lo usa para registrarse y unirse directamente a tu organización.
            </p>
          </>
        ) : (
          /* Link generado */
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-800/40">
              <span className="material-symbols-outlined text-green-600 dark:text-green-400">check_circle</span>
              <div>
                <p className="text-sm font-bold text-green-700 dark:text-green-400">Invitación creada para {nombre}</p>
                <p className="text-[11px] text-green-600 dark:text-green-500">El link es de un solo uso</p>
              </div>
            </div>

            {/* Link display */}
            <div>
              <label className={labelClass}>Enlace de invitación</label>
              <div className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-[#252035] border border-slate-200 dark:border-slate-700 rounded-lg">
                <p className="text-xs text-slate-600 dark:text-slate-300 flex-1 truncate font-mono">{link}</p>
                <button
                  onClick={copyLink}
                  className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-[#1e1a2e] border border-slate-200 dark:border-slate-600 rounded-md text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:border-primary/40 hover:text-primary transition-all"
                >
                  <span className="material-symbols-outlined text-[13px]">{copied ? 'check' : 'content_copy'}</span>
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            {/* Send options */}
            <div>
              <label className={labelClass}>Enviar invitación</label>
              <div className="flex gap-2">
                <button
                  onClick={sendWhatsApp}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 rounded-xl text-sm font-bold text-[#128C7E] dark:text-[#25D366] transition-all"
                >
                  <span className="material-symbols-outlined text-base">chat</span>
                  WhatsApp
                </button>
                {email && (
                  <button
                    onClick={sendEmail}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50 border border-blue-200 dark:border-blue-800/40 rounded-xl text-sm font-bold text-blue-600 dark:text-blue-400 transition-all"
                  >
                    <span className="material-symbols-outlined text-base">mail</span>
                    Email
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-700/50">
        <button
          onClick={handleClose}
          className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all"
        >
          {link ? 'Listo' : 'Cancelar'}
        </button>
        {!link && (
          <button
            onClick={handleCrear}
            disabled={!nombre.trim() || loading}
            className="flex items-center gap-2 px-5 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading
              ? <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
              : <span className="material-symbols-outlined text-sm">person_add</span>
            }
            {loading ? 'Generando...' : 'Crear invitación'}
          </button>
        )}
      </div>
    </Modal>
  );
}
