'use client';

import React, { createContext, use, useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase-client';
import type { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Get initial session or sign in anonymously if none exists
    let isMounted = true;

    const initAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();

        if (initialSession) {
          if (isMounted) {
            setSession(initialSession);
            setUser(initialSession.user);
            setLoading(false);
          }
        } else {
          // If no session exists, sign in anonymously
          const { data, error } = await supabase.auth.signInAnonymously();
          if (error) {
            console.error('Error signing in anonymously:', error.message);
          } else if (data.session && isMounted) {
            setSession(data.session);
            setUser(data.session.user);
          }
          if (isMounted) {
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    // 2. Listen for auth changes (ignoring the redundant initial session event to let initAuth control initial state)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (event !== 'INITIAL_SESSION') {
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          setLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const authValue = useMemo(() => ({ session, user, loading }), [session, user, loading]);

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => use(AuthContext);
