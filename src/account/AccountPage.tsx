import { LogOut } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { formatDateTime } from "../lib/format";
import { getProgression } from "../progression/progressionService";
import { ProgressionBar } from "../progression/ProgressionBar";
import { MissionsPanel } from "../missions/MissionsPanel";

export function AccountPage() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const progression = getProgression(user.id);

  return (
    <section className="page-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Account</p>
          <h1>{user.username}</h1>
          <p className="muted">{user.email}</p>
        </div>
        <button className="danger-button icon-button" onClick={logout}>
          <LogOut size={17} />
          Logout
        </button>
      </div>

      <ProgressionBar progress={progression} />

      <div className="grid two">
        <article className="card detail-card">
          <h2>Profile</h2>
          <div className="detail-list">
            <span>Status</span><strong>{user.accountStatus}</strong>
            <span>Created</span><strong>{formatDateTime(user.createdAt)}</strong>
            <span>Last Login</span><strong>{formatDateTime(user.lastLoginAt)}</strong>
            <span>Roles</span><strong>{user.roles.join(", ")}</strong>
          </div>
        </article>
        <article className="card detail-card">
          <h2>Mock Settings</h2>
          <label>
            Display Name
            <input defaultValue={user.username} />
          </label>
          <label>
            Email
            <input defaultValue={user.email} />
          </label>
          <button className="ghost-button" disabled>Save Placeholder</button>
        </article>
      </div>

      <article className="card">
        <h2>Responsible Play Demo Controls</h2>
        <p className="muted">Prototype-only controls. These do not enforce real compliance rules yet.</p>
        <div className="settings-grid">
          <label><input type="checkbox" /> Session reminder placeholder</label>
          <label><input type="checkbox" /> Spending limit placeholder</label>
          <label><input type="checkbox" /> Self-exclusion placeholder</label>
        </div>
      </article>
      <MissionsPanel />
    </section>
  );
}
