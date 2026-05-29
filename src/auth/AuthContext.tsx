import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getCurrentUser, loginUser, logoutUser, registerUser, type AuthResult } from "./authService";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import type { User } from "../types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children, initialUser }: { children: React.ReactNode; initialUser?: User | null }) {
  const [user, setUser] = useState<User | null>(initialUser ?? null);
  const [loading, setLoading] = useState(!initialUser);

  const refreshUser = useCallback(async () => {
    try {
      setUser(await getCurrentUser());
    } catch (error) {
      setUser(null);
      throw error;
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (initialUser) {
      setLoading(false);
      return () => {
        active = false;
      };
    }
    getCurrentUser()
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    if (!isSupabaseConfigured || !supabase) {
      return () => {
        active = false;
      };
    }

    const { data } = supabase.auth.onAuthStateChange(() => {
      void refreshUser().catch(() => undefined);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [initialUser, refreshUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      refreshUser,
      login: async (email, password) => {
        const result = await loginUser(email, password);
        setUser(result.user);
      },
      register: async (email, username, password) => {
        const result = await registerUser(email, username, password);
        if (result.user) setUser(result.user);
        return result;
      },
      logout: async () => {
        await logoutUser();
        setUser(null);
      },
    }),
    [loading, refreshUser, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
