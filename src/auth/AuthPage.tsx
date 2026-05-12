import { useState } from "react";
import { useAuth } from "./AuthContext";
import { PlayheaterWordmark } from "../branding/playheater";

export function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, username, password);
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
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
            Login
          </button>
          <button
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
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
          <label>
            Password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
            />
          </label>
          {error && <div className="error-box">{error}</div>}
          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? "Please wait..." : mode === "login" ? "Login" : "Create Account"}
          </button>
        </form>
      </section>
    </main>
  );
}
