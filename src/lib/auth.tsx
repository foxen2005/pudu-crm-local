import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';

export type Rol = 'admin' | 'colaborador';

export type OrgMember = {
  userId: string;
  orgId: string;
  orgNombre: string;
  rol: Rol;
  nombre: string | null;
  email: string | null;
  isMaster: boolean;
};

type AuthState = {
  user: User | null;
  member: OrgMember | null;
  loading: boolean;
};

type AuthContext = AuthState & {
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, nombre: string, orgNombre: string) => Promise<string | null>;
  signUpWithInvite: (email: string, password: string, nombre: string, token: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isMaster: boolean;
};

const Ctx = createContext<AuthContext | null>(null);

// ─── Member cache en localStorage ─────────────────────────────────────────────
// Evita la query a Supabase en cada F5 — el member se guarda localmente
// y se usa de inmediato mientras se refresca en background.

const CACHE_KEY = 'pudu_member_v1';

function readCache(userId: string): OrgMember | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as OrgMember & { _uid: string };
    return cached._uid === userId ? cached : null;
  } catch {
    return null;
  }
}

function writeCache(member: OrgMember) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...member, _uid: member.userId }));
  } catch {}
}

function clearCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch {}
}

// ─── Timeout helper ───────────────────────────────────────────────────────────

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>(res => setTimeout(() => res(fallback), ms))]);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, member: null, loading: true });

  const fetchMember = async (user: User): Promise<OrgMember | null> => {
    const { data } = await withTimeout(
      supabase
        .from('miembros')
        .select('org_id, rol, nombre, email, is_master, activo, organizaciones(nombre)')
        .eq('user_id', user.id)
        .maybeSingle() as unknown as Promise<{ data: { org_id: string; rol: string; nombre: string | null; email: string | null; is_master: boolean | null; activo: boolean | null; organizaciones: { nombre: string } | null } | null; error: unknown }>,
      8000,
      { data: null, error: null },
    );

    if (!data) return null;

    // Si la cuenta está desactivada, cerrar sesión
    if (data.activo === false) {
      await supabase.auth.signOut();
      clearCache();
      return null;
    }

    // Actualizar last_seen en background
    supabase.rpc('update_my_last_seen').then(() => {});

    const member: OrgMember = {
      userId: user.id,
      orgId: data.org_id,
      orgNombre: data.organizaciones?.nombre ?? '',
      rol: data.rol as Rol,
      nombre: data.nombre,
      email: data.email,
      isMaster: data.is_master ?? false,
    };

    writeCache(member);
    return member;
  };

  useEffect(() => {
    let mounted = true;

    // Fallback absoluto: 10s máximo de loading
    const fallbackTimer = setTimeout(() => {
      if (mounted) setState(prev => prev.loading ? { user: null, member: null, loading: false } : prev);
    }, 10000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (!session?.user) {
        clearCache();
        setState({ user: null, member: null, loading: false });
        clearTimeout(fallbackTimer);
        return;
      }

      const user = session.user;

      // Intentar caché primero → loading desaparece instantáneamente
      const cached = readCache(user.id);
      if (cached) {
        setState({ user, member: cached, loading: false });
        clearTimeout(fallbackTimer);

        // Refrescar en background sin bloquear la UI
        fetchMember(user).then(fresh => {
          if (mounted && fresh) setState(prev => ({ ...prev, member: fresh }));
        });
        return;
      }

      // Sin caché (primer login) → esperar la query
      const member = await fetchMember(user);
      if (!mounted) return;
      setState({ user, member, loading: false });
      clearTimeout(fallbackTimer);
    });

    return () => {
      mounted = false;
      clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  };

  const signUp = async (
    email: string,
    password: string,
    nombre: string,
    orgNombre: string,
  ): Promise<string | null> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) return error.message;
    if (!data.user) return 'No se pudo crear el usuario';

    const { error: orgError } = await supabase.rpc('crear_org_para_usuario', {
      p_user_id: data.user.id,
      p_nombre_org: orgNombre,
      p_nombre_usuario: nombre,
      p_email: email,
    });

    return orgError?.message ?? null;
  };

  const signUpWithInvite = async (
    email: string,
    password: string,
    nombre: string,
    token: string,
  ): Promise<string | null> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) return error.message;
    if (!data.user) return 'No se pudo crear el usuario';

    const { error: joinError } = await supabase.rpc('unirse_con_invitacion', {
      p_token: token,
      p_user_id: data.user.id,
      p_nombre: nombre,
      p_email: email,
    });
    return joinError?.message ?? null;
  };

  const signOut = async () => {
    clearCache();
    await supabase.auth.signOut();
  };

  return (
    <Ctx.Provider value={{
      ...state,
      signIn,
      signUp,
      signUpWithInvite,
      signOut,
      isAdmin: state.member?.rol === 'admin',
      isMaster: state.member?.isMaster ?? false,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
