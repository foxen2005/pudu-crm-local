import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { getInvitacion } from '@/lib/db';

export default function Join({ token, onSwitch }: { token: string; onSwitch: () => void }) {
  const { signUpWithInvite } = useAuth();
  const [orgNombre, setOrgNombre] = useState<string | null>(null);
  const [tokenValido, setTokenValido] = useState<boolean | null>(null);
  const [form, setForm] = useState({ nombre: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    getInvitacion(token).then(inv => {
      if (inv) {
        setOrgNombre(inv.orgNombre);
        setTokenValido(true);
        if (inv.nombreInvitado) setForm(f => ({ ...f, nombre: inv.nombreInvitado! }));
        if (inv.emailInvitado)  setForm(f => ({ ...f, email: inv.emailInvitado! }));
      } else {
        setTokenValido(false);
      }
    });
  }, [token]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const err = await signUpWithInvite(form.email, form.password, form.nombre, token);
    setLoading(false);
    if (err) { setError(err); return; }
    setSuccess(true);
  };

  if (tokenValido === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <span className="material-symbols-outlined text-slate-300 animate-spin text-3xl">progress_activity</span>
      </div>
    );
  }

  if (!tokenValido) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center size-16 bg-red-100 rounded-2xl mb-5">
            <span className="material-symbols-outlined text-red-500 text-3xl">link_off</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">Link inválido</h2>
          <p className="text-sm text-slate-500 mb-6">Este link de invitación ya fue utilizado o no existe.</p>
          <button onClick={onSwitch} className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:opacity-90 transition-all">
            Ir al login
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center size-16 bg-green-100 rounded-2xl mb-5">
            <span className="material-symbols-outlined text-green-600 text-3xl">mark_email_read</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">¡Ya eres parte del equipo!</h2>
          <p className="text-sm text-slate-500 mb-1">
            Revisa tu correo <span className="font-semibold text-slate-700">{form.email}</span> y confirma tu cuenta.
          </p>
          <p className="text-sm text-slate-500 mb-6">Luego podrás ingresar a <strong>{orgNombre}</strong>.</p>
          <button onClick={onSwitch} className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:opacity-90 transition-all">
            Ir al login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center size-14 bg-primary rounded-2xl shadow-lg shadow-primary/30 mb-4">
            <span className="material-symbols-outlined text-white text-2xl">storefront</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">Pudu CRM</h1>
          <p className="text-sm text-slate-500 mt-1">
            Te invitaron a unirte a{' '}
            <span className="font-bold text-primary">{orgNombre}</span>
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 rounded-xl border border-primary/20 mb-5">
            <span className="material-symbols-outlined text-primary text-base">groups</span>
            <p className="text-xs text-slate-600">Crearás tu cuenta y quedarás dentro de <strong>{orgNombre}</strong> automáticamente.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Tu nombre</label>
              <input type="text" value={form.nombre} onChange={set('nombre')} placeholder="Nombre completo" required
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={set('email')} placeholder="tu@empresa.cl" required
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Contraseña</label>
              <input type="password" value={form.password} onChange={set('password')} placeholder="Mínimo 6 caracteres" required minLength={6}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all" />
            </div>

            {error && (
              <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium">{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-primary text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50 mt-2">
              {loading ? 'Creando cuenta...' : 'Unirme al equipo'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              ¿Ya tienes cuenta?{' '}
              <button onClick={onSwitch} className="text-primary font-bold hover:underline">Ingresar</button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
