import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  ArrowUpRight,
  Ban,
  Camera,
  Clock,
  FileText,
  Flame,
  Gem,
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
import { getDisplayBalances } from "../lib/displayBalanceStress";
import { setDebugRenderedVipTier, setDebugRenderedWalletBalance } from "../lib/debugState";
import { formatCoins, formatCurrencyFullDisplay, getCurrencyAmountFitClass } from "../lib/format";
import { getProgression } from "../progression/progressionService";
import { getKycStatus } from "../redemption/redemptionService";
import { getStreak } from "../streaks/streakService";
import { CashierIcon } from "../wallet/CashierIcons";
import { getBalance, refreshWalletFromRepository, WALLET_BALANCE_UPDATED_EVENT } from "../wallet/walletService";
import {
  PROFILE_IMAGE_ACCEPT,
  SELF_EXCLUSION_WARNING,
  canSaveAccountProfile,
  defaultResponsiblePlaySettings,
  getDisplayNameError,
  getProfileImageValidationError,
  getProfilePreferences,
  normalizeDisplayName,
  saveAvatarDataUrl,
  saveDisplayName,
  saveResponsiblePlaySettings,
  type ResponsiblePlaySettings,
  type SessionReminderMinutes,
} from "./profileService";
import {
  VIP_LEDGER_UPDATED_EVENT,
  getInitialVipProgress,
  getVipProgressForWagered,
  refreshVipProgress,
  vipTiers,
  type VipProgress,
  type VipTierConfig,
} from "./vipService";
import { vipBadgeSrcByTier } from "./vipBadgeAssets";

const AVATAR_CROP_OUTPUT_SIZE = 512;
const AVATAR_CROP_FRAME_SIZE = 220;
const AVATAR_CROP_OFFSET_LIMIT = 110;

type AvatarNoticeTone = "error" | "success";

export interface AvatarCropDraft {
  src: string;
  offsetX: number;
  offsetY: number;
  zoom: number;
}

function formatStatus(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function vipAccentClass(tier: VipTierConfig) {
  return `vip-${tier.accent}`;
}

function formatSc(value: number) {
  return `${formatCoins(value)} SC`;
}

function formatMemberSince(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
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
      else reject(new Error("Could not load image."));
    };
    reader.onerror = () => reject(new Error("Could not load image."));
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
    image.onerror = () => reject(new Error("Could not load image."));
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
  return canvas.toDataURL("image/webp", 0.8);
}

export function AvatarUploadNotice({ message, tone }: { message: string; tone: AvatarNoticeTone }) {
  return (
    <div className={`account-avatar-popover ${tone}`} role={tone === "error" ? "alert" : "status"}>
      {message}
    </div>
  );
}

export function AvatarCropModalBody({
  crop,
  avatarSaving,
  onStartDrag,
  onMoveDrag,
  onEndDrag,
  onZoomChange,
  onCancel,
  onSave,
}: {
  crop: AvatarCropDraft;
  avatarSaving: boolean;
  onStartDrag: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onMoveDrag: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onEndDrag: () => void;
  onZoomChange: (zoom: number) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="modal-stack account-crop-stack">
      <div
        className="account-crop-stage"
        onPointerDown={onStartDrag}
        onPointerMove={onMoveDrag}
        onPointerUp={onEndDrag}
        onPointerCancel={onEndDrag}
        role="application"
        aria-label="Drag image to crop profile photo"
      >
        <img
          alt=""
          draggable={false}
          src={crop.src}
          style={{
            transform: `translate(calc(-50% + ${crop.offsetX}px), calc(-50% + ${crop.offsetY}px)) scale(${crop.zoom})`,
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
          value={crop.zoom}
          onChange={(event) => onZoomChange(Number(event.target.value))}
        />
      </label>
      <div className="account-modal-actions">
        <button className="account-secondary-button" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="account-save-button" type="button" onClick={onSave} disabled={avatarSaving}>
          {avatarSaving ? "Saving..." : "Save Photo"}
        </button>
      </div>
    </div>
  );
}

function VipBadgeArt({ tier, size, className = "" }: { tier: VipTierConfig; size: "hero" | "card" | "ladder" | "pill"; className?: string }) {
  return (
    <img
      className={`account-vip-art account-vip-art-${size} ${vipAccentClass(tier)}${className ? ` ${className}` : ""}`}
      src={vipBadgeSrcByTier[tier.id]}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}

function VipBadge({ tier, size = "pill" }: { tier: VipTierConfig; size?: "card" | "ladder" | "pill" }) {
  return (
    <span className={`account-vip-badge account-vip-badge-${size} ${vipAccentClass(tier)}`}>
      <VipBadgeArt tier={tier} size={size} />
      <span>{tier.name}</span>
    </span>
  );
}

function VipProgressSummary({ vip }: { vip: VipProgress }) {
  return (
    <>
      <div className="account-progress-track account-vip-progress" aria-hidden="true">
        <i style={{ width: `${vip.progressPercent}%` }} />
      </div>
      <div className="account-compact-detail">
        <span>Lifetime SC wagered</span>
        <strong>{formatSc(vip.lifetimeSCWagered)}</strong>
        <span>Next tier</span>
        <strong>{vip.nextTier ? `${vip.nextTier.name} at ${formatSc(vip.nextTier.threshold)}` : "Top tier"}</strong>
        <span>Remaining</span>
        <strong>{vip.nextTier ? `${formatSc(vip.remainingToNext)} to go` : "Max tier reached"}</strong>
      </div>
    </>
  );
}

export function VipDetailsContent({ vip }: { vip: VipProgress }) {
  return (
    <div className="modal-stack account-vip-details">
      <section className={`account-vip-current ${vipAccentClass(vip.currentTier)}`}>
        <VipBadge tier={vip.currentTier} size="card" />
        <strong>{formatSc(vip.lifetimeSCWagered)}</strong>
        <span>Lifetime Sweeps Coins wagered</span>
      </section>

      <section className="account-vip-modal-section">
        <h3>Progress</h3>
        <VipProgressSummary vip={vip} />
      </section>

      <section className="account-vip-modal-section">
        <h3>Tier Ladder</h3>
        <div className="account-vip-ladder">
          {vipTiers.map((tier) => {
            const unlocked = vip.lifetimeSCWagered >= tier.threshold;
            return (
              <article className={`account-vip-ladder-row ${vipAccentClass(tier)} ${unlocked ? "unlocked" : "locked"}`} key={tier.id}>
                <VipBadge tier={tier} size="ladder" />
                <span>{formatSc(tier.threshold)}</span>
                <small>{unlocked ? "Unlocked" : "Locked"}</small>
                <ul>
                  {tier.benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      <p className="account-vip-disclaimer">
        VIP status is based on Sweeps Coins gameplay activity. Perks are promotional and may change.
      </p>
    </div>
  );
}

export function AccountVipCard({ vipProgress, onOpenVip }: { vipProgress: VipProgress; onOpenVip: () => void }) {
  return (
    <section className={`account-panel account-vip-card ${vipAccentClass(vipProgress.currentTier)}`} aria-labelledby="account-vip-title">
      <div className="account-section-heading">
        <h2 id="account-vip-title">VIP Status</h2>
        <button className="account-mini-button" type="button" onClick={onOpenVip}>
          View VIP
        </button>
      </div>
      <div className="account-vip-card-top">
        <VipBadge tier={vipProgress.currentTier} size="card" />
        <div>
          <strong>{vipProgress.nextTier ? `${formatSc(vipProgress.remainingToNext)} to go` : "Top tier reached"}</strong>
          <span>{vipProgress.nextTier ? `Next: ${vipProgress.nextTier.name} at ${formatSc(vipProgress.nextTier.threshold)}` : "All configured tiers unlocked"}</span>
        </div>
      </div>
      <VipProgressSummary vip={vipProgress} />
      <div className="account-vip-benefits-preview">
        {vipProgress.currentTier.benefits.slice(0, 3).map((benefit) => (
          <span key={benefit}>
            <Gem size={14} />
            {benefit}
          </span>
        ))}
      </div>
      <p className="account-vip-disclaimer">VIP perks are promotional and subject to change.</p>
    </section>
  );
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
  const [avatarNotice, setAvatarNotice] = useState<{ message: string; tone: AvatarNoticeTone } | null>(null);
  const [avatarCrop, setAvatarCrop] = useState<AvatarCropDraft | null>(null);
  const [avatarPreparing, setAvatarPreparing] = useState(false);
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
  const [vipModalOpen, setVipModalOpen] = useState(false);
  const [, setWalletRefreshKey] = useState(0);
  const [vipProgress, setVipProgress] = useState<VipProgress>(() => user ? getInitialVipProgress(user.id) : getVipProgressForWagered(0));

  useEffect(() => {
    if (!user) return;
    const preferences = getProfilePreferences(user.id);
    const nextProfile = { displayName: preferences.displayName ?? user.username, email: user.email };
    setSavedProfile(nextProfile);
    setDraftDisplayName(nextProfile.displayName);
    setSavedAvatarDataUrl(preferences.avatarDataUrl ?? "");
    setDraftAvatarDataUrl(preferences.avatarDataUrl ?? "");
    setResponsiblePlay(preferences.responsiblePlay);
    setAvatarNotice(null);
    setProfileError("");
    setSaveMessage("");
  }, [user]);

  useEffect(() => {
    if (!user || typeof window === "undefined" || typeof window.addEventListener !== "function") return;
    let active = true;
    const userId = user.id;

    function loadVipProgress() {
      void refreshVipProgress(userId)
        .then((progress) => {
          if (active) setVipProgress(progress);
        })
        .catch((error) => {
          console.warn("Unable to refresh VIP progress.", error);
        });
    }

    function refreshVip(event: Event) {
      const detail = (event as CustomEvent<{ userId: string }>).detail;
      if (detail?.userId === userId) {
        loadVipProgress();
      }
    }
    window.addEventListener(VIP_LEDGER_UPDATED_EVENT, refreshVip);
    setVipProgress(getInitialVipProgress(userId));
    loadVipProgress();
    return () => {
      active = false;
      window.removeEventListener(VIP_LEDGER_UPDATED_EVENT, refreshVip);
    };
  }, [user]);

  useEffect(() => {
    if (!user || typeof window === "undefined" || typeof window.addEventListener !== "function") return;

    function refreshWallet(event: Event) {
      const detail = (event as CustomEvent<{ userId: string }>).detail;
      if (detail?.userId === user?.id) setWalletRefreshKey((value) => value + 1);
    }

    window.addEventListener(WALLET_BALANCE_UPDATED_EVENT, refreshWallet);
    void refreshWalletFromRepository(user.id).then(() => setWalletRefreshKey((value) => value + 1));
    return () => window.removeEventListener(WALLET_BALANCE_UPDATED_EVENT, refreshWallet);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setDebugRenderedVipTier({ userId: user.id, renderedTier: vipProgress.currentTier.name });
  }, [user, vipProgress.currentTier.name]);

  if (!user) return null;
  const currentUser = user;

  const balances = getBalance(currentUser.id);
  const displayBalances = getDisplayBalances(balances);
  setDebugRenderedWalletBalance({
    userId: currentUser.id,
    surface: "AccountPage",
    storedBalances: balances,
    renderedBalances: displayBalances,
  });
  const goldBalanceDisplay = formatCurrencyFullDisplay(displayBalances.GOLD, "GOLD");
  const sweepsBalanceDisplay = formatCurrencyFullDisplay(displayBalances.BONUS, "BONUS");
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
    setAvatarNotice(null);
    setSaveMessage("");
    if (!file) return;
    const validationError = getProfileImageValidationError(file);
    if (validationError) {
      setAvatarNotice({ tone: "error", message: validationError });
      return;
    }
    setAvatarPreparing(true);
    try {
      const src = await readFileAsDataUrl(file);
      await loadImage(src);
      setAvatarCrop({
        src,
        offsetX: 0,
        offsetY: 0,
        zoom: 1,
      });
    } catch (error) {
      setAvatarNotice({ tone: "error", message: error instanceof Error ? error.message : "Could not load image." });
    } finally {
      setAvatarPreparing(false);
    }
  }

  async function saveCroppedAvatar() {
    if (!avatarCrop) return;
    setAvatarSaving(true);
    setAvatarNotice(null);
    setSaveMessage("");
    try {
      const cropped = await createCroppedAvatarDataUrl(avatarCrop);
      await saveAvatarDataUrl(currentUser.id, cropped);
      await refreshUser();
      const persistedAvatar = getProfilePreferences(currentUser.id).avatarDataUrl ?? cropped;
      setSavedAvatarDataUrl(persistedAvatar);
      setDraftAvatarDataUrl(persistedAvatar);
      setAvatarCrop(null);
      setCropDragStart(null);
      setAvatarNotice({ tone: "success", message: "Profile photo updated." });
    } catch (error) {
      setAvatarNotice({ tone: "error", message: error instanceof Error ? error.message : "Could not save profile photo." });
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

  function openVipModal() {
    void refreshVipProgress(currentUser.id)
      .then(setVipProgress)
      .catch((error) => console.warn("Unable to refresh VIP progress.", error));
    setVipModalOpen(true);
  }

  return (
    <section className="account-page page-stack">
      <section className="account-hero" aria-label="Profile overview">
        <div className="account-avatar-shell">
          <label className={`account-avatar-control ${avatarPreparing || avatarSaving ? "is-busy" : ""}`} aria-busy={avatarPreparing || avatarSaving}>
            <span className="account-avatar" aria-hidden="true">
              {avatarPreview ? <img src={avatarPreview} alt="" /> : <User size={34} />}
            </span>
            <span className="account-avatar-badge" aria-hidden="true">
              <Camera size={14} />
            </span>
            {(avatarPreparing || avatarSaving) && <span className="account-avatar-spinner" aria-hidden="true" />}
            <span className="sr-only">Change profile photo</span>
            <input
              aria-label="Change profile photo"
              type="file"
              accept={PROFILE_IMAGE_ACCEPT}
              disabled={avatarPreparing || avatarSaving}
              onChange={(event) => {
                void chooseAvatar(event.target.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
          </label>
          {avatarNotice && <AvatarUploadNotice message={avatarNotice.message} tone={avatarNotice.tone} />}
        </div>
        <div className="account-hero-copy">
          <div className="account-hero-title-row">
            <h1>{normalizedDisplayName || savedProfile.displayName}</h1>
            {vipProgress.currentTier.id !== "none" && (
              <img
                className={`account-hero-vip-mark account-vip-art account-vip-art-hero ${vipAccentClass(vipProgress.currentTier)}`}
                src={vipBadgeSrcByTier[vipProgress.currentTier.id]}
                alt={`${vipProgress.currentTier.name} VIP`}
                aria-label={`VIP: ${vipProgress.currentTier.name}`}
                title={`${vipProgress.currentTier.name} VIP`}
                draggable={false}
              />
            )}
          </div>
          <p className="account-member-since">Member since {formatMemberSince(currentUser.createdAt)}</p>
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
        <article className="account-balance-card gold" aria-label={`Gold Coins balance ${goldBalanceDisplay} GC`}>
          <CashierIcon kind="goldStack" />
          <strong className={`currency-full-amount ${getCurrencyAmountFitClass(goldBalanceDisplay)}`} title={`${goldBalanceDisplay} GC`}>
            <span className="currency-amount-text">{goldBalanceDisplay}</span> <small>GC</small>
          </strong>
        </article>
        <article className="account-balance-card sweeps" aria-label={`Sweeps Coins balance ${sweepsBalanceDisplay} SC`}>
          <CashierIcon kind="sweepsToken" />
          <strong className={`currency-full-amount ${getCurrencyAmountFitClass(sweepsBalanceDisplay)}`} title={`${sweepsBalanceDisplay} SC`}>
            <span className="currency-amount-text">{sweepsBalanceDisplay}</span> <small>SC</small>
          </strong>
        </article>
      </section>

      <AccountVipCard vipProgress={vipProgress} onOpenVip={openVipModal} />

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
          {profileError && <div className="account-error-box">{profileError}</div>}
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
          <AvatarCropModalBody
            crop={avatarCrop}
            avatarSaving={avatarSaving}
            onStartDrag={startCropDrag}
            onMoveDrag={moveCropDrag}
            onEndDrag={() => setCropDragStart(null)}
            onZoomChange={(zoom) => updateAvatarCrop({ zoom })}
            onCancel={() => setAvatarCrop(null)}
            onSave={() => void saveCroppedAvatar()}
          />
        </Modal>
      )}

      {vipModalOpen && (
        <Modal title="PLAYHEATER VIP" onClose={() => setVipModalOpen(false)} className="account-modal account-vip-modal">
          <VipDetailsContent vip={vipProgress} />
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
