import { LogOut } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { formatDateTime } from "../lib/format";
import { SupabaseDebugPanel } from "../components/SupabaseDebugPanel";
import { COMPLIANCE_COPY } from "../lib/compliance";
import { DRAFT_LEGAL_PLACEHOLDER } from "../config/complianceConfig";
import { getEligibilityFlags, getKycStatus } from "../redemption/redemptionService";

export function AccountPage() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const kycStatus = getKycStatus(user.id);
  const eligibility = getEligibilityFlags(user.id);

  return (
    <section className="page-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Account</p>
          <h1>{user.username}</h1>
          <p className="muted">{user.email}</p>
          <p className="muted">{COMPLIANCE_COPY}</p>
        </div>
        <button className="danger-button icon-button" onClick={logout}>
          <LogOut size={17} />
          Logout
        </button>
      </div>

      <SupabaseDebugPanel />

      <div className="grid two">
        <article className="card detail-card">
          <h2>Profile</h2>
          <div className="detail-list">
            <span>Status</span><strong>{user.accountStatus}</strong>
            <span>Created</span><strong>{formatDateTime(user.createdAt)}</strong>
            <span>Last Login</span><strong>{formatDateTime(user.lastLoginAt)}</strong>
            <span>Roles</span><strong>{user.roles.join(", ")}</strong>
            <span>KYC</span><strong>{kycStatus}</strong>
            <span>Eligibility</span><strong>{eligibility.reviewRequired ? "Review required" : "Not evaluated"}</strong>
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
        <h2>KYC / Identity Prep</h2>
        <p className="muted">KYC not enabled in prototype. Future states: NOT_STARTED, REQUIRED, PENDING, APPROVED, REJECTED.</p>
        <button className="ghost-button" disabled>KYC not enabled in prototype</button>
      </article>

      <article className="card">
        <h2>Responsible Play Demo Controls</h2>
        <p className="muted">Prototype-only controls. These do not enforce real compliance rules yet.</p>
        <div className="settings-grid">
          <label><input type="checkbox" /> Session reminder placeholder</label>
          <label><input type="checkbox" /> Spending limit placeholder</label>
          <label><input type="checkbox" /> Self-exclusion placeholder</label>
        </div>
      </article>

      <article className="card">
        <h2>Compliance Placeholder Pages</h2>
        <p className="muted">{DRAFT_LEGAL_PLACEHOLDER}</p>
        <div className="legal-link-grid">
          <a className="ghost-button" href="/terms">Terms</a>
          <a className="ghost-button" href="/sweepstakes-rules">Sweepstakes Rules</a>
          <a className="ghost-button" href="/privacy">Privacy Policy</a>
          <a className="ghost-button" href="/responsible-play">Responsible Play</a>
          <a className="ghost-button" href="/eligibility">Eligibility</a>
        </div>
      </article>
    </section>
  );
}
