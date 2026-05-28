import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  ArrowUpRight,
  Ban,
  Camera,
  Clock,
  FileText,
  Flame,
  Gauge,
  HeartHandshake,
  LifeBuoy,
  LockKeyhole,
  LogOut,
  Mail,
  Scale,
  ShieldCheck,
  Trophy,
  User,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { Modal } from "../components/Modal";
import { SupabaseDebugPanel } from "../components/SupabaseDebugPanel";
import { formatCoins } from "../lib/format";
import { getProgression } from "../progression/progressionService";
import { getKycStatus } from "../redemption/redemptionService";
import { getStreak } from "../streaks/streakService";
import { CashierIcon } from "../wallet/CashierIcons";
import { getBalance } from "../wallet/walletService";
import {
  PROFILE_IMAGE_MAX_BYTES,
  SELF_EXCLUSION_WARNING,
  canSaveAccountProfile,
  defaultResponsiblePlaySettings,
  getDisplayNameError,
  getProfilePreferences,
  normalizeDisplayName,
  saveAvatarDataUrl,
  saveDisplayName,
  saveResponsiblePlaySettings,
  type ResponsiblePlaySettings,
  type SessionReminderMinutes,
} from "./profileService";

const AVATAR_CROP_OUTPUT_SIZE = 256;
const AVATAR_CROP_FRAME_SIZE = 220;
const AVATAR_CROP_OFFSET_LIMIT = 110;

interface AvatarCropDraft {
  src: string;
  offsetX: number;
  offsetY: number;
  zoom: number;
}

function formatStatus(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getKycProgress(status: ReturnType<typeof getKycStatus>) {
  if (status === "APPROVED") return 100;
  if (status === "PENDING") return 66;
  if (status === "REQUIRED") return 34;
  if (status === "REJECTED") return 20;
  return 8;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Unable to read image."));
    };
    reader.onerror = () => reject(new Error("Unable to read image."));
    reader.readAsDataURL(file);
  });
}

function clampCropOffset(value: number) {
  return Math.max(-AVATAR_CROP_OFFSET_LIMIT, Math.min(AVATAR_CROP_OFFSET_LIMIT, Math.round(value)));
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load image."));
    image.src = src;
  });
}

async function createCroppedAvatarDataUrl(crop: AvatarCropDraft) {
  const image = await loadImage(crop.src);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_CROP_OUTPUT_SIZE;
  canvas.height = AVATAR_CROP_OUTPUT_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to crop image.");

  const baseScale = Math.max(AVATAR_CROP_FRAME_SIZE / image.naturalWidth, AVATAR_CROP_FRAME_SIZE / image.naturalHeight);
  const scale = baseScale * crop.zoom;
  const outputRatio = AVATAR_CROP_OUTPUT_SIZE / AVATAR_CROP_FRAME_SIZE;
  const width = image.naturalWidth * scale * outputRatio;
  const height = image.naturalHeight * scale * outputRatio;
  const x = AVATAR_CROP_OUTPUT_SIZE / 2 + crop.offsetX * outputRatio - width / 2;
  const y = AVATAR_CROP_OUTPUT_SIZE / 2 + crop.offsetY * outputRatio - height / 2;

  context.fillStyle = "#070a12";
  context.fillRect(0, 0, AVATAR_CROP_OUTPUT_SIZE, AVATAR_CROP_OUTPUT_SIZE);
  context.drawImage(image, x, y, width, height);
  return canvas.toDataURL("image/png");
}

export function AccountPage() {
  const { user, logout, refreshUser } = useAuth();
  const initialPreferences = user ? getProfilePreferences(user.id) : undefined;
  const [savedProfile, setSavedProfile] = useState(() => ({
    displayName: initialPreferences?.displayName ?? user?.username ?? "",
    email: user?.email ?? "",
  }));
  const [draftDisplayName, setDraftDisplayName] = useState(() => initialPreferences?.displayName ?? user?.username ?? "");
  const [savedAvatarDataUrl, setSavedAvatarDataUrl] = useState(() => initialPreferences?.avatarDataUrl ?? "");
  const [draftAvatarDataUrl, setDraftAvatarDataUrl] = useState(() => initialPreferences?.avatarDataUrl ?? "");
  const [avatarError, setAvatarError] = useState("");
  const [avatarCrop, setAvatarCrop] = useState<AvatarCropDraft | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [cropDragStart, setCropDragStart] = useState<{
    pointerX: number;
    pointerY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [profileError, setProfileError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [responsiblePlay, setResponsiblePlay] = useState<ResponsiblePlaySettings>(
    () => initialPreferences?.responsiblePlay ?? defaultResponsiblePlaySettings,
  );
  const [selfExclusionConfirmOpen, setSelfExclusionConfirmOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const preferences = getProfilePreferences(user.id);
    const nextProfile = { displayName: preferences.displayName ?? user.username, email: user.email };
    setSavedProfile(nextProfile);
    setDraftDisplayName(nextProfile.displayName);
    setSavedAvatarDataUrl(preferences.avatarDataUrl ?? "");
    setDraftAvatarDataUrl(preferences.avatarDataUrl ?? "");
    setResponsiblePlay(preferences.responsiblePlay);
    setAvatarError("");
    setProfileError("");
    setSaveMessage("");
  }, [user]);

  if (!user) return null;
  const currentUser = user;

  const balances = getBalance(currentUser.id);
  const progress = getProgression(currentUser.id);
  const streak = getStreak(currentUser.id);
  const kycStatus = getKycStatus(currentUser.id);
  const kycProgress = getKycProgress(kycStatus);
  const isAdmin = currentUser.roles.includes("ADMIN");
  const normalizedDisplayName = normalizeDisplayName(draftDisplayName);
  const displayNameChanged = normalizedDisplayName !== savedProfile.displayName;
  const displayNameError = getDisplayNameError(draftDisplayName, currentUser.id, savedProfile.displayName);
  const profileChanged = displayNameChanged;
  const canSaveProfile = canSaveAccountProfile({
    displayName: draftDisplayName,
    savedDisplayName: savedProfile.displayName,
    userId: currentUser.id,
    avatarChanged: false,
    avatarError,
  }) && !saving;
  const avatarPreview = draftAvatarDataUrl || savedAvatarDataUrl;

  const legalLinks = [
    { label: "Support", href: "/support", Icon: LifeBuoy },
    { label: "Terms", href: "/terms", Icon: FileText },
    { label: "Privacy", href: "/privacy", Icon: LockKeyhole },
    { label: "Sweeps Rules", href: "/sweepstakes-rules", Icon: Trophy },
    { label: "Responsible Play", href: "/responsible-play", Icon: HeartHandshake },
    { label: "Eligibility", href: "/eligibility", Icon: Scale },
  ];

  function persistResponsiblePlay(next: ResponsiblePlaySettings) {
    setResponsiblePlay(next);
    saveResponsiblePlaySettings(currentUser.id, next);
  }

  async function chooseAvatar(file: File | undefined) {
    setAvatarError("");
    setSaveMessage("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarError("Choose an image file.");
      return;
    }
    if (file.size > PROFILE_IMAGE_MAX_BYTES) {
      setAvatarError("Image must be 2 MB or smaller.");
      return;
    }

    try {
      setAvatarCrop({
        src: await readFileAsDataUrl(file),
        offsetX: 0,
        offsetY: 0,
        zoom: 1,
      });
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : "Unable to read image.");
    }
  }

  async function saveCroppedAvatar() {
    if (!avatarCrop) return;
    setAvatarSaving(true);
    setAvatarError("");
    setSaveMessage("");
    try {
      const cropped = await createCroppedAvatarDataUrl(avatarCrop);
      saveAvatarDataUrl(currentUser.id, cropped);
      setSavedAvatarDataUrl(cropped);
      setDraftAvatarDataUrl(cropped);
      setAvatarCrop(null);
      setCropDragStart(null);
      setSaveMessage("Photo updated.");
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : "Unable to save photo.");
    } finally {
      setAvatarSaving(false);
    }
  }

  async function saveProfile() {
    if (!canSaveProfile) return;
    setSaving(true);
    setProfileError("");
    setSaveMessage("");
    try {
      let savedName = savedProfile.displayName;
      if (displayNameChanged) savedName = saveDisplayName(currentUser.id, normalizedDisplayName);
      await refreshUser();
      setSavedProfile({ displayName: savedName, email: currentUser.email });
      setDraftDisplayName(savedName);
      setSaveMessage("Profile saved.");
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  }

  function updateSessionReminder(enabled: boolean) {
    persistResponsiblePlay({ ...responsiblePlay, sessionReminderEnabled: enabled });
  }

  function updateSessionReminderMinutes(value: SessionReminderMinutes) {
    persistResponsiblePlay({ ...responsiblePlay, sessionReminderMinutes: value });
  }

  function updateSpendingLimit(enabled: boolean) {
    persistResponsiblePlay({ ...responsiblePlay, spendingLimitEnabled: enabled });
  }

  function updateDailyGcLimit(value: string) {
    const amount = Math.max(0, Math.min(999999, Math.round(Number(value) || 0)));
    persistResponsiblePlay({ ...responsiblePlay, dailyGcLimit: amount });
  }

  function enableSelfExclusion() {
    persistResponsiblePlay({
      ...responsiblePlay,
      selfExclusionEnabled: true,
      selfExclusionStartedAt: new Date().toISOString(),
    });
    setSelfExclusionConfirmOpen(false);
  }

  function updateAvatarCrop(next: Partial<AvatarCropDraft>) {
    setAvatarCrop((current) => current ? { ...current, ...next } : current);
  }

  function startCropDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!avatarCrop) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setCropDragStart({
      pointerX: event.clientX,
      pointerY: event.clientY,
      offsetX: avatarCrop.offsetX,
      offsetY: avatarCrop.offsetY,
    });
  }

  function moveCropDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!cropDragStart) return;
    updateAvatarCrop({
      offsetX: clampCropOffset(cropDragStart.offsetX + event.clientX - cropDragStart.pointerX),
      offsetY: clampCropOffset(cropDragStart.offsetY + event.clientY - cropDragStart.pointerY),
    });
  }

  return (
    <section className="account-page page-stack">
      <section className="account-hero" aria-label="Profile overview">
        <label className="account-avatar-control">
          <span className="account-avatar" aria-hidden="true">
            {avatarPreview ? <img src={avatarPreview} alt="" /> : <User size={34} />}
          </span>
          <span className="account-avatar-badge" aria-hidden="true">
            <Camera size={14} />
          </span>
          <span className="sr-only">Change profile photo</span>
          <input
            aria-label="Change profile photo"
            type="file"
            accept="image/*"
            onChange={(event) => {
              void chooseAvatar(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
        </label>
        <div className="account-hero-copy">
          <h1>{normalizedDisplayName || savedProfile.displayName}</h1>
        </div>
        <div className="account-hero-metrics" aria-label="Player status">
          <div className="account-metric">
            <Trophy size={17} />
            <span>Level</span>
            <strong>{progress.level}</strong>
          </div>
          <div className="account-metric">
            <Flame size={17} />
            <span>Streak</span>
            <strong>{streak.currentStreakDays}d</strong>
          </div>
          <div className="account-metric">
            <ShieldCheck size={17} />
            <span>Wins</span>
            <strong>{progress.lifetimeWins}</strong>
          </div>
        </div>
      </section>

      <section className="account-balance-grid" aria-label="Balance snapshot">
        <article className="account-balance-card gold">
          <CashierIcon kind="goldStack" />
          <div>
            <span>Gold Coins</span>
            <strong>{formatCoins(balances.GOLD)} <small>GC</small></strong>
          </div>
        </article>
        <article className="account-balance-card sweeps">
          <CashierIcon kind="sweepsToken" />
          <div>
            <span>Sweeps Coins</span>
            <strong>{formatCoins(balances.BONUS)} <small>SC</small></strong>
          </div>
        </article>
      </section>

      <section className="account-panel" id="account-settings" aria-labelledby="account-settings-title">
        <div className="account-section-heading">
          <h2 id="account-settings-title">Profile Settings</h2>
          {saveMessage && <span className="account-save-state">{saveMessage}</span>}
        </div>
        <form
          className="account-settings-form"
          onSubmit={(event) => {
            event.preventDefault();
            void saveProfile();
          }}
        >
          <div className="account-field-grid">
            <label className="account-field">
              <span>Display name</span>
              <input
                aria-invalid={Boolean(displayNameError)}
                value={draftDisplayName}
                onChange={(event) => {
                  setDraftDisplayName(event.target.value);
                  setProfileError("");
                  setSaveMessage("");
                }}
                minLength={3}
                maxLength={24}
              />
              {displayNameError && <small className="account-field-error">{displayNameError}</small>}
            </label>
            <label className="account-field account-field-readonly">
              <span>Email</span>
              <div className="account-readonly-input">
                <Mail size={15} />
                <input value={savedProfile.email} type="email" readOnly aria-readonly="true" />
                <LockKeyhole size={15} />
              </div>
            </label>
          </div>
          {(avatarError || profileError) && <div className="account-error-box">{avatarError || profileError}</div>}
          <div className="account-save-row">
            <button className="account-save-button" type="submit" disabled={!canSaveProfile}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </section>

      <section className="account-panel account-verification-card" aria-labelledby="account-identity-title">
        <div className="account-section-heading">
          <h2 id="account-identity-title">Identity Verification</h2>
          <span className="account-status-chip neutral">{formatStatus(kycStatus)}</span>
        </div>
        <div className="account-progress-track" aria-hidden="true">
          <i style={{ width: `${kycProgress}%` }} />
        </div>
        <div className="account-compact-detail">
          <span>Status</span>
          <strong>{formatStatus(kycStatus)}</strong>
          <span>Redemption</span>
          <strong>Future review</strong>
        </div>
        <p>Verification will be required before redemptions.</p>
        <button className="account-secondary-button" type="button" disabled>
          Start Verification
        </button>
      </section>

      <section className="account-panel" aria-labelledby="account-play-title">
        <div className="account-section-heading">
          <h2 id="account-play-title">Responsible Play</h2>
          <span className="account-save-state">Saved locally</span>
        </div>
        <div className="account-setting-list">
          <article className={`account-setting-row ${responsiblePlay.sessionReminderEnabled ? "expanded" : ""}`}>
            <Clock size={18} />
            <span>
              <strong>Session reminder</strong>
              <small>{responsiblePlay.sessionReminderEnabled ? `Every ${responsiblePlay.sessionReminderMinutes} min` : "Off"}</small>
            </span>
            <button
              className={`account-switch ${responsiblePlay.sessionReminderEnabled ? "active" : ""}`}
              type="button"
              role="switch"
              aria-checked={responsiblePlay.sessionReminderEnabled}
              aria-label="Session reminder"
              onClick={() => updateSessionReminder(!responsiblePlay.sessionReminderEnabled)}
            >
              <span />
            </button>
            {responsiblePlay.sessionReminderEnabled && (
              <label className="account-inline-setting">
                <span>Reminder interval</span>
                <select
                  value={responsiblePlay.sessionReminderMinutes}
                  onChange={(event) => updateSessionReminderMinutes(Number(event.target.value) as SessionReminderMinutes)}
                >
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={60}>60 min</option>
                </select>
              </label>
            )}
          </article>

          <article className={`account-setting-row ${responsiblePlay.spendingLimitEnabled ? "expanded" : ""}`}>
            <Gauge size={18} />
            <span>
              <strong>Spending limit</strong>
              <small>{responsiblePlay.spendingLimitEnabled ? `${formatCoins(responsiblePlay.dailyGcLimit)} GC daily` : "Off"}</small>
            </span>
            <button
              className={`account-switch ${responsiblePlay.spendingLimitEnabled ? "active" : ""}`}
              type="button"
              role="switch"
              aria-checked={responsiblePlay.spendingLimitEnabled}
              aria-label="Spending limit"
              onClick={() => updateSpendingLimit(!responsiblePlay.spendingLimitEnabled)}
            >
              <span />
            </button>
            {responsiblePlay.spendingLimitEnabled && (
              <div className="account-limit-grid">
                <label className="account-inline-setting">
                  <span>Daily GC limit</span>
                  <input
                    value={responsiblePlay.dailyGcLimit}
                    inputMode="numeric"
                    type="number"
                    min={0}
                    max={999999}
                    onChange={(event) => updateDailyGcLimit(event.target.value)}
                  />
                </label>
                <label className="account-inline-setting disabled">
                  <span>SC limit</span>
                  <input value="Future review" disabled readOnly />
                </label>
              </div>
            )}
          </article>

          <article className={`account-setting-row ${responsiblePlay.selfExclusionEnabled ? "expanded danger" : ""}`}>
            <Ban size={18} />
            <span>
              <strong>Self-exclusion</strong>
            </span>
            <button
              className={`account-switch danger ${responsiblePlay.selfExclusionEnabled ? "active" : ""}`}
              type="button"
              role="switch"
              aria-checked={responsiblePlay.selfExclusionEnabled}
              aria-label="Self-exclusion"
              disabled={responsiblePlay.selfExclusionEnabled}
              onClick={() => setSelfExclusionConfirmOpen(true)}
            >
              <span />
            </button>
            {responsiblePlay.selfExclusionEnabled && (
              <div className="account-lock-note">
                {SELF_EXCLUSION_WARNING}
              </div>
            )}
          </article>
        </div>
      </section>

      <section className="account-panel" aria-labelledby="account-legal-title">
        <div className="account-section-heading">
          <h2 id="account-legal-title">Support / Legal</h2>
        </div>
        <div className="account-legal-grid">
          {legalLinks.map(({ label, href, Icon }) => (
            <a className="account-legal-link" href={href} key={label}>
              <Icon size={17} />
              <span>{label}</span>
              <ArrowUpRight size={15} />
            </a>
          ))}
        </div>
      </section>

      {isAdmin && (
        <details className="account-debug-panel">
          <summary>Developer diagnostics</summary>
          <SupabaseDebugPanel />
        </details>
      )}

      <section className="account-logout-section" aria-label="Session">
        <button className="account-action account-logout-action" type="button" onClick={() => void logout()}>
          <LogOut size={18} />
          <span>
            <strong>Logout</strong>
          </span>
        </button>
      </section>

      {avatarCrop && (
        <Modal title="Adjust Photo" onClose={() => setAvatarCrop(null)} className="account-modal account-crop-modal">
          <div className="modal-stack account-crop-stack">
            <div
              className="account-crop-stage"
              onPointerDown={startCropDrag}
              onPointerMove={moveCropDrag}
              onPointerUp={() => setCropDragStart(null)}
              onPointerCancel={() => setCropDragStart(null)}
              role="application"
              aria-label="Drag image to crop profile photo"
            >
              <img
                alt=""
                draggable={false}
                src={avatarCrop.src}
                style={{
                  transform: `translate(calc(-50% + ${avatarCrop.offsetX}px), calc(-50% + ${avatarCrop.offsetY}px)) scale(${avatarCrop.zoom})`,
                }}
              />
            </div>
            <label className="account-crop-control">
              <span>Zoom</span>
              <input
                aria-label="Photo zoom"
                type="range"
                min="1"
                max="2.5"
                step="0.05"
                value={avatarCrop.zoom}
                onChange={(event) => updateAvatarCrop({ zoom: Number(event.target.value) })}
              />
            </label>
            <div className="account-modal-actions">
              <button className="account-secondary-button" type="button" onClick={() => setAvatarCrop(null)}>
                Cancel
              </button>
              <button className="account-save-button" type="button" onClick={() => void saveCroppedAvatar()} disabled={avatarSaving}>
                {avatarSaving ? "Saving..." : "Save Photo"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {selfExclusionConfirmOpen && (
        <Modal title="Enable Cooling Off?" onClose={() => setSelfExclusionConfirmOpen(false)} className="account-modal">
          <div className="modal-stack">
            <p>{SELF_EXCLUSION_WARNING}</p>
            <div className="account-modal-actions">
              <button className="account-secondary-button" type="button" onClick={() => setSelfExclusionConfirmOpen(false)}>
                Cancel
              </button>
              <button className="account-danger-button" type="button" onClick={enableSelfExclusion}>
                Enable Cooling Off
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
