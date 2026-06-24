/**
 * useAuth — Hook and Provider to manage Supabase Authentication state.
 * Returns: { user, session, loading, isAdmin, signIn, signUp, signOut }
 */
import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string, 
    password: string, 
    fullName?: string, 
    phone?: string,
    dni?: string,
    avatarUrl?: string,
    address?: string,
    locationCoords?: string
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Verificar si el usuario es admin leyendo is_super_admin de app_metadata
  const isAdmin = Boolean(user?.app_metadata?.is_super_admin);

  useEffect(() => {
    // Timeout de seguridad: si la sesión no resuelve en 4s, liberar el loading.
    // Necesario para iOS Safari que bloquea cookies de terceros y puede
    // dejar getSession() pendiente indefinidamente.
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 4000);

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        clearTimeout(safetyTimer);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        clearTimeout(safetyTimer);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        // En iOS Safari con cookies bloqueadas, getSession puede fallar.
        // Liberamos el loading para que la app sea usable (usuario no logueado).
        clearTimeout(safetyTimer);
        setLoading(false);
      });

    return () => {
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (
    email: string, 
    password: string, 
    fullName?: string, 
    phone?: string,
    dni?: string,
    avatarUrl?: string,
    address?: string,
    locationCoords?: string
  ) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          phone: phone,
          dni: dni,
          avatar_url: avatarUrl,
          address: address,
          location_coords: locationCoords
        }
      }
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
