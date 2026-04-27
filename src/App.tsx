import { AuthPage } from "./auth/AuthPage";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { AppShell } from "./app/AppShell";
import { ToastProvider } from "./components/ToastContext";
import { seedDemoAdmin } from "./lib/demoSeed";
import { isSupabaseConfigured } from "./lib/supabaseClient";

if (!isSupabaseConfigured) seedDemoAdmin();

function Root() {
  const { user, loading } = useAuth();
  if (loading) return <main className="auth-shell"><section className="auth-panel"><h1>Loading</h1><p className="muted">Checking session...</p></section></main>;
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
