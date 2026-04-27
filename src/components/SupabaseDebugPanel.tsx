import { useAuth } from "../auth/AuthContext";
import { getDebugState } from "../lib/debugState";
import { isSupabaseConfigured, isSupabaseUrlPresent } from "../lib/supabaseClient";

export function SupabaseDebugPanel() {
  const { user } = useAuth();
  const debug = getDebugState();

  return (
    <article className="card debug-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">Development</p>
          <h2>Supabase Debug</h2>
        </div>
      </div>
      <div className="detail-list">
        <span>Supabase configured</span><strong>{String(isSupabaseConfigured)}</strong>
        <span>VITE_SUPABASE_URL present</span><strong>{String(isSupabaseUrlPresent)}</strong>
        <span>Current auth provider</span><strong>{debug.authProvider}</strong>
        <span>Current user id</span><strong>{user?.id ?? "none"}</strong>
        <span>Current user email</span><strong>{user?.email ?? "none"}</strong>
        <span>Last auth error</span><strong>{debug.lastAuthError ?? "none"}</strong>
        <span>Last database mirror error</span><strong>{debug.lastMirrorError ?? "none"}</strong>
      </div>
      <small>No keys are displayed or logged.</small>
    </article>
  );
}
