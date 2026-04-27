import { useState } from "react";
import { Coins } from "lucide-react";
import { useAuth } from "./AuthContext";

export function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      if (mode === "login") login(email, password);
      else register(email, username, password);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-mark">
          <Coins />
        </div>
        <h1>Casino Prototype</h1>
        <p className="muted">
          Demo social casino prototype. Virtual currency only, with no deposits, withdrawals,
          prizes, or redemptions.
        </p>

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
          <button className="primary-button" type="submit">
            {mode === "login" ? "Login" : "Create Account"}
          </button>
        </form>

        <p className="hint">Admin demo: admin@demo.local / admin123</p>
      </section>
    </main>
  );
}
