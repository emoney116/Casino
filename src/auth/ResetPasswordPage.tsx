import { useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { PlayheaterWordmark } from "../branding/playheater";
import { updatePasswordFromRecovery } from "./authService";

export function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await updatePasswordFromRecovery(password);
      setPassword("");
      setConfirmPassword("");
      setSuccess("Password updated. You can log in with your new password.");
      if (typeof window !== "undefined") window.history.replaceState(null, "", "/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell auth-premium-shell">
      <section className="auth-stage">
        <section className="auth-panel auth-premium-card">
          <div className="auth-brand-block">
            <PlayheaterWordmark className="auth-wordmark" />
            <span className="auth-kicker">Secure recovery</span>
            <h1>Reset Password</h1>
            <p>Choose a new password for your PLAYHEATER account.</p>
          </div>
          <form onSubmit={submit} className="form-stack auth-form">
            <label htmlFor="reset-password">
              New Password
              <span className="auth-password-field">
                <input
                  id="reset-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={showPassword ? "text" : "password"}
                  minLength={8}
                  autoComplete="new-password"
                />
                <button className="auth-password-toggle" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>
            <label htmlFor="reset-confirm-password">
              Confirm Password
              <span className="auth-password-field">
                <input
                  id="reset-confirm-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  type={showConfirmPassword ? "text" : "password"}
                  minLength={8}
                  autoComplete="new-password"
                />
                <button className="auth-password-toggle" type="button" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? "Hide confirmed password" : "Show confirmed password"}>
                  {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>
            {error && <div className="error-box auth-message" role="alert">{error}</div>}
            {success && <div className="success-box auth-message" role="status">{success}</div>}
            <button className="primary-button auth-submit" type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Update Password"}
            </button>
            <a className="auth-reset-link" href="/">
              Return to Login
            </a>
          </form>
        </section>
        <div className="auth-trust-row" aria-label="Account security">
          <span><KeyRound size={15} /> Email recovery supported</span>
        </div>
      </section>
    </main>
  );
}
