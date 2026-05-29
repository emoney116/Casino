import { useState } from "react";
import { PlayheaterWordmark } from "../branding/playheater";
import { updatePasswordFromRecovery } from "./authService";

export function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
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
    <main className="auth-shell">
      <section className="auth-panel">
        <PlayheaterWordmark className="auth-wordmark" />
        <h1>Reset Password</h1>
        <form onSubmit={submit} className="form-stack">
          <label>
            New Password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <label>
            Confirm Password
            <input
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              type="password"
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          {error && <div className="error-box">{error}</div>}
          {success && <div className="success-box">{success}</div>}
          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Update Password"}
          </button>
          <a className="auth-reset-link" href="/">
            Return to Login
          </a>
        </form>
      </section>
    </main>
  );
}
