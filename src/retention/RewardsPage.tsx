import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastContext";
import { getCurrencyShortName } from "../config/currencyConfig";
import { formatCoins, formatCurrencyDisplay } from "../lib/format";
import { claimMission, getMissions } from "../missions/missionService";
import { missionDefs } from "../missions/missionDefs";
import {
  REWARDS_VISIBLE_MISSION_IDS,
  getRewardGrantLabel,
  getStreakRewardBlockForDay,
  getStreakRewardForDay,
  getStreakRewardGrants,
} from "./rewardConfig";
import { canClaimStreak, claimStreak, getStreak } from "../streaks/streakService";
import type { Currency, DailyStreak, MissionStatus } from "../types";

const burstAsset = new URL("../assets/rewards/reward-burst.png", import.meta.url).href;
const dailyEmblemAsset = new URL("../assets/rewards/daily-emblem.png", import.meta.url).href;
const rewardChestAsset = new URL("../assets/rewards/reward-chest.png", import.meta.url).href;
const rewardGcAsset = new URL("../assets/rewards/reward-gc.png", import.meta.url).href;
const rewardScAsset = new URL("../assets/cashier/sc_reference.png", import.meta.url).href;
const claimRewardAsset = new URL("../assets/rewards/claim-reward.png", import.meta.url).href;
const bonusRewardAsset = new URL("../assets/rewards/bonus-reward.png", import.meta.url).href;
const streakFlameAsset = new URL("../assets/rewards/streak-flame.png", import.meta.url).href;
const streakLockedAsset = new URL("../assets/rewards/streak-locked.png", import.meta.url).href;
const streakJackpotAsset = new URL("../assets/rewards/streak-jackpot.png", import.meta.url).href;
const missionBadgeAsset = new URL("../assets/rewards/mission-badge.png", import.meta.url).href;
const missionPlayAsset = new URL("../assets/rewards/mission-play.png", import.meta.url).href;
const missionWinAsset = new URL("../assets/rewards/mission-win.png", import.meta.url).href;
const missionMultiplierAsset = new URL("../assets/rewards/mission-multiplier.png", import.meta.url).href;
const missionGamesAsset = new URL("../assets/rewards/mission-games.png", import.meta.url).href;

const STREAK_CLAIM_INTERVAL_MS = 20 * 60 * 60 * 1000;
const STREAK_RESET_MS = 48 * 60 * 60 * 1000;

const missionVisuals: Record<string, { iconSrc: string; tone: string; title?: string; helper: string }> = {
  "daily-rounds": { iconSrc: missionPlayAsset, tone: "ember", title: "Play 5", helper: "Finish 5 rounds today." },
  "daily-wins": { iconSrc: missionWinAsset, tone: "green", title: "Win 3", helper: "Win any 3 rounds." },
  "daily-multiplier": { iconSrc: missionMultiplierAsset, tone: "cyan", title: "Hit 10x+", helper: "Land one 10x or better result." },
  "daily-games": { iconSrc: missionGamesAsset, tone: "gold", title: "Try 3 games", helper: "Play 3 different games." },
};

const rewardIconByCurrency: Record<Currency, string> = {
  GOLD: rewardGcAsset,
  BONUS: rewardScAsset,
};

export function RewardsPage({ onWallet: _onWallet }: { onWallet: () => void }) {
  const { user, refreshUser } = useAuth();
  const notify = useToast();
  const [version, setVersion] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [dailyCount, setDailyCount] = useState(0);
  const [claimBurstKey, setClaimBurstKey] = useState(0);
  const [streakBurstKey, setStreakBurstKey] = useState(0);
  const streak = user ? getStreak(user.id) : undefined;
  const streakClaimDay = getVisibleStreakClaimDay(streak, now);
  const heroReward = getStreakRewardForDay(streakClaimDay);
  const heroRewardGrants = getStreakRewardGrants(heroReward);
  const heroPrimaryGrant = heroRewardGrants[0];
  const heroPrimaryAmount = heroPrimaryGrant?.amount ?? 0;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const duration = 520;
    const startedAt = performance.now();
    let frame = 0;

    function tick(now: number) {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = heroPrimaryAmount < 1
        ? Math.round(heroPrimaryAmount * eased * 100) / 100
        : Math.round(heroPrimaryAmount * eased);
      setDailyCount(value);
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    }

    setDailyCount(0);
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [heroPrimaryAmount, version]);

  if (!user) return null;
  const currentUser = user;
  const missions = getMissions(currentUser.id);
  const streakAvailable = canClaimStreak(currentUser.id);
  const streakCountdownMs = getMsUntilNextStreakClaim(streak, now);
  const streakCountdown = formatCountdown(streakCountdownMs);
  const visibleMissions = REWARDS_VISIBLE_MISSION_IDS
    .map((id) => missionDefs.find((mission) => mission.id === id))
    .filter(Boolean) as typeof missionDefs;
  const completedMissions = visibleMissions.filter((mission) => {
    const progress = missions[mission.id];
    return progress.status !== "ACTIVE" || progress.progress >= mission.target;
  }).length;

  function refreshRewards() {
    refreshUser();
    setVersion((value) => value + 1);
  }

  function claimDailyReward() {
    try {
      claimStreak(currentUser.id);
      setClaimBurstKey((value) => value + 1);
      setStreakBurstKey((value) => value + 1);
      refreshRewards();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Daily reward unavailable.", "error");
    }
  }

  function claimStreakReward() {
    claimDailyReward();
  }

  function claimMissionReward(id: string) {
    try {
      claimMission(currentUser.id, id);
      setClaimBurstKey((value) => value + 1);
      refreshRewards();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Mission unavailable.", "error");
    }
  }

  return (
    <section className="page-stack playheater-rewards rewards-clean" key={version} aria-label="PLAYHEATER rewards">
      <DailyClaimHero
        amount={dailyCount}
        rewardDay={streakClaimDay}
        primaryGrant={heroPrimaryGrant}
        bonusGrants={heroRewardGrants.slice(1)}
        available={streakAvailable}
        countdown={streakCountdown}
        burstKey={claimBurstKey}
        onClaim={claimDailyReward}
      />
      <StreakCalendar
        currentDay={streakClaimDay}
        currentStreakDays={streak?.currentStreakDays ?? 0}
        available={streakAvailable}
        countdown={streakCountdown}
        burstKey={streakBurstKey}
        onClaim={claimStreakReward}
      />
      <MissionSection missions={visibleMissions} state={missions} completedCount={completedMissions} onClaim={claimMissionReward} />
      <footer className="rewards-compliance" aria-label="Rewards compliance">
        <span>Prototype mode. Redemptions are not currently enabled.</span>
        <span>Gold Coins have no cash value.</span>
      </footer>
    </section>
  );
}

function DailyClaimHero({
  amount,
  rewardDay,
  primaryGrant,
  bonusGrants,
  available,
  countdown,
  burstKey,
  onClaim,
}: {
  amount: number;
  rewardDay: number;
  primaryGrant?: ReturnType<typeof getStreakRewardGrants>[number];
  bonusGrants: ReturnType<typeof getStreakRewardGrants>;
  available: boolean;
  countdown: string;
  burstKey: number;
  onClaim: () => void;
}) {
  const claimedLabel = countdown === "Ready" ? "Claimed • Resets soon" : `Claimed • Resets in ${countdown}`;
  const grantLabel = primaryGrant ? getRewardGrantLabel(primaryGrant) : getCurrencyShortName("GOLD");

  return (
    <section className={`rewards-daily-hero ${available ? "ready" : "claimed"}`} aria-label="Daily reward">
      <div className="rewards-hero-copy">
        <span className="rewards-kicker-row">
          <img className="rewards-daily-emblem" src={dailyEmblemAsset} alt="" />
          <span className="rewards-kicker">Daily Reward</span>
          <span className="rewards-hero-day">Day {rewardDay}</span>
        </span>
        <h1 title={`${formatCoins(amount)} ${grantLabel}`}>{formatCurrencyDisplay(amount, primaryGrant?.currency)} <span>{grantLabel}</span></h1>
        {bonusGrants.length > 0 && <div className="rewards-hero-bonus">{renderRewardPills(bonusGrants)}</div>}
        {available ? (
          <button
            className="primary-button rewards-claim-button"
            type="button"
            onClick={onClaim}
            aria-label={`Claim daily reward day ${rewardDay}`}
          >
            <img className="rewards-claim-gift" src={claimRewardAsset} alt="" />
            Claim
          </button>
        ) : (
          <div className="rewards-claim-pill" role="status" aria-label={`Daily reward claimed. Resets in ${countdown}.`}>
            <img className="rewards-claim-gift" src={claimRewardAsset} alt="" />
            {claimedLabel}
          </div>
        )}
      </div>
      <div className="rewards-chest-stage" aria-hidden="true">
        <img className="rewards-chest" src={rewardChestAsset} alt="" />
        {burstKey > 0 && <img className="rewards-claim-pop" key={burstKey} src={burstAsset} alt="" />}
      </div>
    </section>
  );
}

function StreakCalendar({
  currentDay,
  currentStreakDays,
  available,
  countdown,
  burstKey,
  onClaim,
}: {
  currentDay: number;
  currentStreakDays: number;
  available: boolean;
  countdown: string;
  burstKey: number;
  onClaim: () => void;
}) {
  return (
    <section className="rewards-section rewards-streak-section" aria-label="Streak calendar">
      <div className="rewards-section-title">
        <h2>Streak</h2>
        <span className="rewards-section-pill">{formatStreakDays(currentStreakDays)}</span>
      </div>
      <div className="rewards-streak-calendar">
        {getVisibleStreakRewards(currentDay).map((reward) => {
          const state = getStreakDayState(reward.day, currentDay, available);
          const canClaimDay = state === "current" && available;
          const statusLabel = state === "claimed" ? "Claimed" : canClaimDay ? "Ready" : state === "next" ? countdown : "Locked";
          const ariaStatus = state === "next" ? `Available in ${countdown}` : statusLabel;
          const iconSrc = getStreakIconSrc(reward.day, state);
          const hasSweepsReward = hasStreakSweepsReward(reward);
          return (
            <button
              className={`rewards-streak-day ${state} ${isJackpotStreakDay(reward.day) ? "jackpot" : ""} ${hasSweepsReward ? "has-sc-reward" : ""}`}
              type="button"
              key={reward.day}
              onClick={onClaim}
              disabled={!canClaimDay}
              aria-label={`Day ${reward.day}: ${formatStreakReward(reward)}. ${ariaStatus}.`}
            >
              <img className="rewards-streak-icon" src={iconSrc} alt="" />
              <span className="rewards-streak-copy">
                <strong>{formatStreakLine(reward)}</strong>
              </span>
              <em>{statusLabel}</em>
            </button>
          );
        })}
      </div>
      {burstKey > 0 && <img className="rewards-streak-burst" key={burstKey} src={burstAsset} alt="" aria-hidden="true" />}
    </section>
  );
}

function MissionSection({
  missions,
  state,
  completedCount,
  onClaim,
}: {
  missions: typeof missionDefs;
  state: ReturnType<typeof getMissions>;
  completedCount: number;
  onClaim: (id: string) => void;
}) {
  const [expandedMissionId, setExpandedMissionId] = useState("");

  useEffect(() => {
    if (!missions.some((mission) => mission.id === expandedMissionId)) {
      setExpandedMissionId("");
    }
  }, [expandedMissionId, missions]);

  return (
    <section className="rewards-section rewards-missions-section" aria-label="Missions">
      <div className="rewards-section-title">
        <h2><img className="rewards-section-icon" src={missionBadgeAsset} alt="" /> Daily Missions</h2>
        <span className="rewards-section-pill">
          <img className="rewards-pill-icon" src={bonusRewardAsset} alt="" />
          {completedCount}/{missions.length}
        </span>
      </div>
      <div className="rewards-mission-grid">
        {missions.map((mission) => {
          const progress = state[mission.id];
          const visual = missionVisuals[mission.id] ?? { iconSrc: missionGamesAsset, tone: "gold", helper: mission.description };
          const pct = Math.min(100, (progress.progress / mission.target) * 100);
          const expanded = expandedMissionId === mission.id;
          return (
            <article
              className={`rewards-mission-card ${visual.tone} ${progress.status.toLowerCase()} ${expanded ? "expanded" : ""}`}
              key={mission.id}
              role="button"
              tabIndex={0}
              aria-expanded={expanded}
              aria-label={`${visual.title ?? mission.title}. ${visual.helper} Prize ${formatCoins(mission.rewardAmount)} ${getCurrencyShortName(mission.rewardCurrency)}.`}
              onClick={() => setExpandedMissionId(expanded ? "" : mission.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setExpandedMissionId(expanded ? "" : mission.id);
                }
              }}
            >
              <div className="rewards-mission-head">
                <img className="rewards-mission-icon" src={visual.iconSrc} alt="" />
                <span className="rewards-mission-copy">
                  <strong>{visual.title ?? mission.title}</strong>
                </span>
                <span className={`rewards-mission-reward currency-${mission.rewardCurrency === "BONUS" ? "sc" : "gc"}`}>
                  <img src={rewardIconByCurrency[mission.rewardCurrency]} alt="" />
                  <span title={`${formatCoins(mission.rewardAmount)} ${getCurrencyShortName(mission.rewardCurrency)}`}>
                    {formatCurrencyDisplay(mission.rewardAmount, mission.rewardCurrency)} {getCurrencyShortName(mission.rewardCurrency)}
                  </span>
                </span>
              </div>
              <div className="rewards-mission-progress">
                <i style={{ width: `${pct}%` }} />
              </div>
              <div className="rewards-mission-foot">
                <span>{Math.min(progress.progress, mission.target)} / {mission.target}</span>
                <button
                  className="ghost-button rewards-mission-claim"
                  type="button"
                  disabled={progress.status !== "CLAIMABLE"}
                  onClick={(event) => {
                    event.stopPropagation();
                    onClaim(mission.id);
                  }}
                >
                  {renderMissionButtonText(progress.status)}
                </button>
              </div>
              {expanded && (
                <div className="rewards-mission-detail">
                  <span>{mission.description}</span>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function getStreakDayState(day: number, currentDay: number, available: boolean) {
  if (day < currentDay) return "claimed";
  if (day === currentDay) return available ? "current" : "next";
  return "locked";
}

function getStreakIconSrc(day: number, state: string) {
  if (isJackpotStreakDay(day)) return streakJackpotAsset;
  if (state === "locked") return streakLockedAsset;
  return streakFlameAsset;
}

function getVisibleStreakRewards(currentDay: number) {
  return getStreakRewardBlockForDay(currentDay);
}

function getVisibleStreakClaimDay(streak: DailyStreak | undefined, now: number) {
  if (!streak?.lastClaimedAt) return 1;
  const claimedAt = Date.parse(streak.lastClaimedAt);
  if (!Number.isFinite(claimedAt)) return clampStreakDay(streak.day);
  if (now - claimedAt > STREAK_RESET_MS) return 1;
  return clampStreakDay(streak.day);
}

function getMsUntilNextStreakClaim(streak: DailyStreak | undefined, now: number) {
  if (!streak?.lastClaimedAt) return 0;
  const claimedAt = Date.parse(streak.lastClaimedAt);
  if (!Number.isFinite(claimedAt)) return 0;
  return Math.max(0, claimedAt + STREAK_CLAIM_INTERVAL_MS - now);
}

function clampStreakDay(day: number) {
  if (!Number.isFinite(day)) return 1;
  return Math.max(Math.round(day), 1);
}

function isJackpotStreakDay(day: number) {
  return day % 7 === 0;
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "Ready";
  const totalMinutes = Math.max(1, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function formatStreakReward(reward: ReturnType<typeof getStreakRewardForDay>) {
  return getStreakRewardGrants(reward)
    .map((grant) => `${formatCoins(grant.amount)} ${getRewardGrantLabel(grant)}`)
    .join(" + ");
}

function formatStreakLine(reward: ReturnType<typeof getStreakRewardForDay>) {
  return `Day ${reward.day} - ${formatStreakReward(reward)}`;
}

function hasStreakSweepsReward(reward: ReturnType<typeof getStreakRewardForDay>) {
  return getStreakRewardGrants(reward).some((grant) => grant.currency === "BONUS");
}

function renderRewardPills(grants: ReturnType<typeof getStreakRewardGrants>) {
  return grants.map((grant) => (
    <span className={`rewards-reward-mini currency-${grant.currency === "BONUS" ? "sc" : "gc"}`} key={`${grant.currency}-${grant.amount}`}>
      <img src={rewardIconByCurrency[grant.currency]} alt="" />
      <span title={`${formatCoins(grant.amount)} ${getRewardGrantLabel(grant)}`}>
        {formatCurrencyDisplay(grant.amount, grant.currency)} {getRewardGrantLabel(grant)}
      </span>
    </span>
  ));
}

function renderMissionButtonText(status: MissionStatus) {
  if (status === "CLAIMED") return "Claimed";
  if (status === "CLAIMABLE") return "Claim";
  return "In Progress";
}

function formatStreakDays(days: number) {
  const safeDays = Math.max(0, days);
  return `${safeDays} ${safeDays === 1 ? "day" : "days"}`;
}
