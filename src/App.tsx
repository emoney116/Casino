import { AuthPage } from "./auth/AuthPage";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ResetPasswordPage } from "./auth/ResetPasswordPage";
import { AppShell } from "./app/AppShell";
import { ToastProvider } from "./components/ToastContext";
import { PlayheaterMark, PlayheaterWordmark } from "./branding/playheater";
import { seedDemoAdmin } from "./lib/demoSeed";
import { isSupabaseConfigured } from "./lib/supabaseClient";

if (!isSupabaseConfigured) seedDemoAdmin();

function Root() {
  const { user, loading } = useAuth();
  const isResetPasswordRoute = typeof window !== "undefined" && window.location.pathname === "/reset-password";
  if (isResetPasswordRoute) return <ResetPasswordPage />;
  if (loading) {
    return (
      <main className="playheater-splash">
        <section>
          <PlayheaterMark />
          <PlayheaterWordmark />
          <div className="heater-loader" aria-label="Loading PLAYHEATER" />
        </section>
      </main>
    );
  }
  return user ? <AppShell /> : <AuthPage />;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </ToastProvider>
  );
}
