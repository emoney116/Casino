import { AuthPage } from "./auth/AuthPage";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { AppShell } from "./app/AppShell";
import { ToastProvider } from "./components/ToastContext";
import { seedDemoAdmin } from "./lib/demoSeed";

seedDemoAdmin();

function Root() {
  const { user } = useAuth();
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
