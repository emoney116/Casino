import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, KeyRound, MailCheck, ShieldCheck } from "lucide-react";
import { useAuth } from "./AuthContext";
import {
  getUsernameValidationError,
  isUsernameAvailable,
  requestPasswordReset,
  validateEmail,
} from "./authService";
import { PlayheaterWordmark } from "../branding/playheater";

type AuthMode = "login" | "register" | "forgot";
type UsernameAvailability = "idle" | "checking" | "available" | "taken" | "error";

interface FieldErrors {
  loginIdentifier?: string;
  loginPassword?: string;
  email?: string;
  username?: string;
  password?: string;
  confirmPassword?: string;
  legal?: string;
}

function passwordStrengthLabel(password: string) {
  if (!password) return "Use at least 8 characters.";
  if (password.length < 8) return "Too short.";
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);
  const hasMixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const score = [hasNumber, hasSymbol, hasMixedCase].filter(Boolean).length;
  if (score >= 2) return "Strong password.";
  return "Good start. Add numbers or symbols for a stronger password.";
}

function emailError(value: string) {
  if (!value.trim()) return "Email is required.";
  return validateEmail(value.trim()) ? "" : "Enter a valid email address.";
}

function AuthTrustRow() {
  return (
    <div className="auth-trust-row" aria-label="Account security">
      <span><ShieldCheck size={15} /> Secure account login</span>
      <span><MailCheck size={15} /> Email recovery supported</span>
      <span><KeyRound size={15} /> 2FA coming soon</span>
    </div>
  );
}

export function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [usernameAvailability, setUsernameAvailability] = useState<UsernameAvailability>("idle");
  const [submitting, setSubmitting] = useState(false);

  const passwordHint = useMemo(() => passwordStrengthLabel(password), [password]);
  const usernameValidationError = useMemo(() => getUsernameValidationError(username), [username]);

  useEffect(() => {
    if (mode !== "register" || usernameValidationError || !username.trim()) {
      setUsernameAvailability("idle");
      return;
    }

    let active = true;
    setUsernameAvailability("checking");
    const timer = window.setTimeout(() => {
      void isUsernameAvailable(username)
        .then((available) => {
          if (active) setUsernameAvailability(available ? "available" : "taken");
        })
        .catch(() => {
          if (active) setUsernameAvailability("error");
        });
    }, 420);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [mode, username, usernameValidationError]);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setFieldErrors({});
    setFormError("");
    setSuccess("");
    setConfirmationEmail("");
    if (nextMode === "forgot" && loginIdentifier.includes("@") && !email) setEmail(loginIdentifier);
  }

  function validateLoginFields() {
    const nextErrors: FieldErrors = {};
    if (!loginIdentifier.trim()) nextErrors.loginIdentifier = "Email or username is required.";
    if (!password) nextErrors.loginPassword = "Password is required.";
    return nextErrors;
  }

  async function validateRegisterFields() {
    const nextErrors: FieldErrors = {};
    const emailMessage = emailError(email);
    if (emailMessage) nextErrors.email = emailMessage;

    const usernameMessage = getUsernameValidationError(username);
    if (usernameMessage) nextErrors.username = usernameMessage;
    else {
      try {
        const available = await isUsernameAvailable(username);
        if (!available) nextErrors.username = "Username is already taken.";
      } catch {
        nextErrors.username = "Unable to check username right now.";
      }
    }

    if (password.length < 8) nextErrors.password = "Password must be at least 8 characters.";
    if (!confirmPassword) nextErrors.confirmPassword = "Confirm your password.";
    else if (password !== confirmPassword) nextErrors.confirmPassword = "Passwords must match.";
    if (!acceptedLegal) nextErrors.legal = "Confirm age and legal agreement to continue.";
    return nextErrors;
  }

  function validateForgotFields() {
    const nextErrors: FieldErrors = {};
    const emailMessage = emailError(email);
    if (emailMessage) nextErrors.email = emailMessage;
    return nextErrors;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    setFormError("");
    setSuccess("");
    setSubmitting(true);

    try {
      if (mode === "login") {
        const nextErrors = validateLoginFields();
        if (Object.keys(nextErrors).length) {
          setFieldErrors(nextErrors);
          return;
        }
        await login(loginIdentifier, password);
        setSuccess("Login successful. Opening PLAYHEATER...");
        return;
      }

      if (mode === "register") {
        const nextErrors = await validateRegisterFields();
        if (Object.keys(nextErrors).length) {
          setFieldErrors(nextErrors);
          return;
        }
        const result = await register(email, username, password);
        if (result.requiresEmailConfirmation) {
          setPassword("");
          setConfirmPassword("");
          setConfirmationEmail(email);
          setSuccess(result.message ?? "Check your email to confirm your PLAYHEATER account.");
        }
        return;
      }

      const nextErrors = validateForgotFields();
      if (Object.keys(nextErrors).length) {
        setFieldErrors(nextErrors);
        return;
      }
      await requestPasswordReset(email);
      setSuccess("If an account exists for that email, a reset link has been sent.");
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  const usernameHint = usernameValidationError
    ? usernameValidationError
    : usernameAvailability === "checking"
      ? "Checking availability..."
      : usernameAvailability === "available"
        ? "Username available."
        : usernameAvailability === "taken"
          ? "Username is already taken."
          : usernameAvailability === "error"
            ? "Unable to check username right now."
            : "Letters, numbers, and underscores only.";

  const usernameHintTone = usernameAvailability === "available" ? "success" : usernameAvailability === "taken" || usernameValidationError ? "error" : "";

  return (
    <main className="auth-shell auth-premium-shell">
      <section className="auth-stage">
        <section className="auth-panel auth-premium-card" aria-labelledby="auth-title">
          <div className="auth-brand-block">
            <PlayheaterWordmark className="auth-wordmark" />
            <span className="auth-kicker">Social casino account</span>
            <h1 id="auth-title">{mode === "forgot" ? "Recover Access" : mode === "register" ? "Create Account" : "Welcome Back"}</h1>
            <p>PLAYHEATER is a social casino. No real-money gambling is offered.</p>
          </div>

          {confirmationEmail ? (
            <div className="auth-confirmation-panel" role="status">
              <MailCheck size={24} />
              <strong>Check your email to confirm your PLAYHEATER account.</strong>
              <span>{confirmationEmail}</span>
              <button className="primary-button" type="button" onClick={() => switchMode("login")}>
                Back to Login
              </button>
            </div>
          ) : (
            <>
              {mode !== "forgot" && (
                <div className="segmented auth-tabs" role="tablist" aria-label="Authentication mode">
                  <button type="button" className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}>
                    Login
                  </button>
                  <button type="button" className={mode === "register" ? "active" : ""} onClick={() => switchMode("register")}>
                    Register
                  </button>
                </div>
              )}

              <form onSubmit={submit} className="form-stack auth-form" noValidate>
                {mode === "login" && (
                  <>
                    <label htmlFor="login-identifier">
                      Email or Username
                      <input
                        id="login-identifier"
                        value={loginIdentifier}
                        onChange={(event) => {
                          setLoginIdentifier(event.target.value);
                          setFieldErrors((current) => ({ ...current, loginIdentifier: undefined }));
                          setFormError("");
                        }}
                        placeholder="Enter email or username"
                        autoComplete="username"
                        aria-invalid={Boolean(fieldErrors.loginIdentifier)}
                        aria-describedby={fieldErrors.loginIdentifier ? "login-identifier-error" : undefined}
                      />
                    </label>
                    {fieldErrors.loginIdentifier && <small id="login-identifier-error" className="auth-field-error">{fieldErrors.loginIdentifier}</small>}
                  </>
                )}

                {(mode === "register" || mode === "forgot") && (
                  <>
                    <label htmlFor="auth-email">
                      Email
                      <input
                        id="auth-email"
                        value={email}
                        onChange={(event) => {
                          setEmail(event.target.value);
                          setFieldErrors((current) => ({ ...current, email: undefined }));
                          setFormError("");
                        }}
                        type="email"
                        autoComplete="email"
                        aria-invalid={Boolean(fieldErrors.email)}
                        aria-describedby={fieldErrors.email ? "auth-email-error" : undefined}
                      />
                    </label>
                    {fieldErrors.email && <small id="auth-email-error" className="auth-field-error">{fieldErrors.email}</small>}
                  </>
                )}

                {mode === "register" && (
                  <>
                    <label htmlFor="auth-username">
                      Username
                      <input
                        id="auth-username"
                        value={username}
                        onChange={(event) => {
                          setUsername(event.target.value);
                          setFieldErrors((current) => ({ ...current, username: undefined }));
                          setFormError("");
                        }}
                        autoComplete="username"
                        minLength={3}
                        maxLength={20}
                        aria-invalid={Boolean(fieldErrors.username || usernameAvailability === "taken")}
                        aria-describedby="auth-username-hint"
                      />
                    </label>
                    <small id="auth-username-hint" className={`auth-field-hint ${usernameHintTone}`}>{fieldErrors.username ?? usernameHint}</small>
                  </>
                )}

                {mode !== "forgot" && (
                  <>
                    <label htmlFor="auth-password">
                      Password
                      <span className="auth-password-field">
                        <input
                          id="auth-password"
                          value={password}
                          onChange={(event) => {
                            setPassword(event.target.value);
                            setFieldErrors((current) => ({ ...current, password: undefined, loginPassword: undefined }));
                            setFormError("");
                          }}
                          type={showPassword ? "text" : "password"}
                          autoComplete={mode === "login" ? "current-password" : "new-password"}
                          aria-invalid={Boolean(fieldErrors.password || fieldErrors.loginPassword)}
                          aria-describedby={mode === "register" ? "auth-password-hint" : fieldErrors.loginPassword ? "login-password-error" : undefined}
                        />
                        <button
                          className="auth-password-toggle"
                          type="button"
                          onClick={() => setShowPassword((value) => !value)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </span>
                    </label>
                    {fieldErrors.loginPassword && <small id="login-password-error" className="auth-field-error">{fieldErrors.loginPassword}</small>}
                    {mode === "register" && (
                      <small id="auth-password-hint" className={`auth-field-hint ${fieldErrors.password ? "error" : password.length >= 8 ? "success" : ""}`}>
                        {fieldErrors.password ?? passwordHint}
                      </small>
                    )}
                  </>
                )}

                {mode === "register" && (
                  <>
                    <label htmlFor="auth-confirm-password">
                      Confirm Password
                      <span className="auth-password-field">
                        <input
                          id="auth-confirm-password"
                          value={confirmPassword}
                          onChange={(event) => {
                            setConfirmPassword(event.target.value);
                            setFieldErrors((current) => ({ ...current, confirmPassword: undefined }));
                            setFormError("");
                          }}
                          type={showConfirmPassword ? "text" : "password"}
                          autoComplete="new-password"
                          aria-invalid={Boolean(fieldErrors.confirmPassword)}
                          aria-describedby={fieldErrors.confirmPassword ? "auth-confirm-password-error" : undefined}
                        />
                        <button
                          className="auth-password-toggle"
                          type="button"
                          onClick={() => setShowConfirmPassword((value) => !value)}
                          aria-label={showConfirmPassword ? "Hide confirmed password" : "Show confirmed password"}
                        >
                          {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </span>
                    </label>
                    {fieldErrors.confirmPassword && <small id="auth-confirm-password-error" className="auth-field-error">{fieldErrors.confirmPassword}</small>}

                    <label className="auth-legal-check" htmlFor="auth-legal">
                      <input
                        id="auth-legal"
                        checked={acceptedLegal}
                        onChange={(event) => {
                          setAcceptedLegal(event.target.checked);
                          setFieldErrors((current) => ({ ...current, legal: undefined }));
                        }}
                        type="checkbox"
                      />
                      <span>
                        I am at least 18 years old and agree to the <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>.
                      </span>
                    </label>
                    {fieldErrors.legal && <small className="auth-field-error">{fieldErrors.legal}</small>}
                  </>
                )}

                {mode === "register" && (
                  <div className="auth-compliance-copy">
                    <span>Sweeps Coins are promotional and subject to eligibility and <a href="/sweepstakes-rules">official rules</a>.</span>
                    <a href="/responsible-play">Play responsibly.</a>
                  </div>
                )}

                {formError && <div className="error-box auth-message" role="alert">{formError}</div>}
                {success && <div className="success-box auth-message" role="status">{success}</div>}

                <button className="primary-button auth-submit" type="submit" disabled={submitting}>
                  {submitting ? "Please wait..." : mode === "login" ? "Login" : mode === "register" ? "Create Account" : "Send Reset Link"}
                </button>

                {mode === "login" && (
                  <button className="auth-link-button" type="button" onClick={() => switchMode("forgot")}>
                    Forgot Password?
                  </button>
                )}
                {mode === "forgot" && (
                  <button className="auth-link-button" type="button" onClick={() => switchMode("login")}>
                    Back to Login
                  </button>
                )}
              </form>
            </>
          )}
        </section>
        <AuthTrustRow />
      </section>
    </main>
  );
}
