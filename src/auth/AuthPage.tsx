import { useState } from "react";
import { useAuth } from "./AuthContext";
import { requestPasswordReset } from "./authService";
import { PlayheaterWordmark } from "../branding/playheater";

export function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      if (mode === "login") await login(email, password);
      else if (mode === "register") {
        const result = await register(email, username, password);
        if (result.requiresEmailConfirmation) {
          setPassword("");
          setSuccess(result.message ?? "Account created. Check your email to confirm your account, then log in.");
        }
      } else {
        await requestPasswordReset(email);
        setSuccess("Password reset email sent. Check your inbox for the secure link.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <PlayheaterWordmark className="auth-wordmark" />

        <div className="segmented">
          <button className={mode === "login" ? "active" : ""} onClick={() => {
            setMode("login");
            setError("");
            setSuccess("");
          }}>
            Login
          </button>
          <button
            className={mode === "register" ? "active" : ""}
            onClick={() => {
              setMode("register");
              setError("");
              setSuccess("");
            }}
          >
            Register
          </button>
        </div>

        <form onSubmit={submit} className="form-stack">
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
          </label>
          {mode === "register" && (
            <label>
              Username
              <input value={username} onChange={(event) => setUsername(event.target.value)} />
            </label>
          )}
          {mode !== "forgot" && (
            <label>
              Password
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
              />
            </label>
          )}
          {error && <div className="error-box">{error}</div>}
          {success && <div className="success-box">{success}</div>}
          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? "Please wait..." : mode === "login" ? "Login" : mode === "register" ? "Create Account" : "Send Reset Link"}
          </button>
          {mode === "login" && (
            <button className="auth-link-button" type="button" onClick={() => {
              setMode("forgot");
              setError("");
              setSuccess("");
            }}>
              Forgot Password?
            </button>
          )}
          {mode === "forgot" && (
            <button className="auth-link-button" type="button" onClick={() => {
              setMode("login");
              setError("");
              setSuccess("");
            }}>
              Back to Login
            </button>
          )}
        </form>
      </section>
    </main>
  );
}
