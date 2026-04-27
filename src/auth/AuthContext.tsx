import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { getCurrentUser, loginUser, logoutUser, registerUser } from "./authService";
import type { User } from "../types";

interface AuthContextValue {
  user: User | null;
  refreshUser: () => void;
  login: (email: string, password: string) => void;
  register: (email: string, username: string, password: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getCurrentUser());

  const refreshUser = useCallback(() => {
    setUser(getCurrentUser());
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      refreshUser,
      login: (email, password) => {
        setUser(loginUser(email, password).user);
      },
      register: (email, username, password) => {
        setUser(registerUser(email, username, password).user);
      },
      logout: () => {
        logoutUser();
        setUser(null);
      },
    }),
    [refreshUser, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
