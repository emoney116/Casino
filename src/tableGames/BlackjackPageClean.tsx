import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Info, X } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastContext";
import { formatCoins } from "../lib/format";
import { recordRetentionRound } from "../retention/retentionService";
import type { Currency } from "../types";
import { getBalance } from "../wallet/walletService";
import { CoinBurst, GameResultBanner, ScreenShake, SoundToggle } from "../feedback/components";
import { playBigWin, playBlackjackWin, playCardDeal, playCardFlip, playChip, playClick, playError, playLose, playPush, playWin } from "../feedback/feedbackService";
import {
  acceptEvenMoneyBlackjack,
  activeBlackjackHand,
  blackjackRankValue,
  canDoubleBlackjack,
  canOfferEvenMoney,
  canOfferInsurance,
  canSplitBlackjack,
  createShoe,
  declineEvenMoneyBlackjack,
  doubleDownBlackjack,
  getBlackjackBetLimits,
  handValue,
  hitBlackjack,
  isBlackjack,
  prepareNextShoe,
  resolveInsuranceBlackjack,
  shuffleDeck,
  splitBlackjack,
  standBlackjack,
  startBlackjackRound,
} from "./blackjackEngine";
import {
  blackjackActionsDisabled,
  blackjackAnimationConfig,
  dealerDrawDelay,
  dealerRevealAnimationMs,
  hitAnimationMs,
  initialDealAnimationMs,
  initialDealStepDelay,
  splitAnimationMs,
} from "./blackjackAnimations";
import { BlackjackControlsClean } from "./BlackjackControlsClean";
import { DealerHandView, PlayerHandView, SplitHandSummary } from "./BlackjackHandView";
import { blackjackConfig } from "./configs";
import type { BlackjackHand, BlackjackRound } from "./types";

const cardBackAsset = new URL("../assets/blackjack/card-back-premium.png", import.meta.url).href;
const dealerButtonAsset = new URL("../assets/blackjack/dealer-button-premium.png", import.meta.url).href;
const feltEdgeOverlayAsset = new URL("../assets/blackjack/felt-edge-overlay.png", import.meta.url).href;
const goldTrimOverlayAsset = new URL("../assets/blackjack/gold-trim-overlay.png", import.meta.url).href;
const winBannerAsset = new URL("../assets/blackjack/win-banner-premium.png", import.meta.url).href;

export const blackjackCleanUxMarkers = {
  cleanPage: true,
  noChipSystem: true,
  numericBetControls: true,
  inlineInsurance: true,
  hiddenDealerCard: true,
  centeredMobileLayout: true,
  cardDealAnimation: true,
  dealerFlipAnimation: true,
  animationBlocksActions: true,
  compactSplitLayout: true,
  sharedResultBanner: true,
  sharedSoundToggle: true,
  cardDealSound: true,
  dealerFlipSound: true,
  chipSound: true,
  premiumTableAssets: true,
  premiumCardBack: true,
  resultOverlayArt: true,
  bottomBetControls: true,
};

export const blackjackSoundTimings = {
  initialDealMs: [0, blackjackAnimationConfig.initialDealDelayMs, blackjackAnimationConfig.initialDealDelayMs * 2, blackjackAnimationConfig.initialDealDelayMs * 3],
  playerHitMs: 0,
  dealerFlipMs: 0,
  dealerDrawStartMs: blackjackAnimationConfig.flipMs,
  dealerDrawStepMs: blackjackAnimationConfig.dealerDrawDelayMs,
  splitDealMs: [blackjackAnimationConfig.splitSlideMs, blackjackAnimationConfig.splitSlideMs + blackjackAnimationConfig.initialDealDelayMs],
};

type BlackjackAnimationKind = "initial" | "hit" | "dealer" | "double" | "split" | null;

const currencyCopy: Record<Currency, { short: string; className: string }> = {
  GOLD: { short: "GC", className: "currency-gc" },
  BONUS: { short: "SC", className: "currency-sc" },
};

function normalizeBet(amount: number, currency: Currency) {
  if (!Number.isFinite(amount)) return currency === "BONUS" ? 0.01 : 1;
  return currency === "BONUS" ? Math.round(amount * 100) / 100 : Math.round(amount);
}

type BlackjackResultDisplay = {
  title: string;
  tone: "win" | "big-win" | "loss" | "push";
  amount?: number;
  message?: ReactNode;
};

export function BlackjackPageClean({ onExit }: { onExit?: () => void }) {
  const { user, refreshUser } = useAuth();
  const notify = useToast();
  const [currency, setCurrency] = useState<Currency>("GOLD");
  const [betAmount, setBetAmount] = useState(25);
  const [round, setRound] = useState<BlackjackRound | null>(null);
  const [shoe, setShoe] = useState(() => shuffleDeck(createShoe()));
  const [cardsAnimating, setCardsAnimating] = useState(false);
  const [animationKind, setAnimationKind] = useState<BlackjackAnimationKind>(null);
  const [initialDealVisibleCount, setInitialDealVisibleCount] = useState(0);
  const [dealerRevealVisibleCount, setDealerRevealVisibleCount] = useState<number | null>(null);
  const [resultVisible, setResultVisible] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const soundTimers = useRef<number[]>([]);
  const interactionLockedRef = useRef(false);
  const recordedRoundIds = useRef<Set<string>>(new Set());

  useEffect(() => () => clearSoundTimers(), []);

  useEffect(() => {
    if (!round?.result || !resultVisible) return;
    if (round.insuranceResult?.result === "WIN") {
      playWin();
      return;
    }
    if (round.result.result === "WIN") {
      if (round.playerHands.some((hand) => isBlackjack(hand.cards) && hand.result?.result === "WIN")) playBlackjackWin();
      else if (round.result.amountPaid >= Math.max(round.totalBet * 3, betAmount * 3)) playBigWin();
      else playWin();
    } else if (round.result.result === "LOSS") playLose();
    else if (round.result.result === "PUSH") playPush();
  }, [round?.result, resultVisible, betAmount]);

  useEffect(() => {
    if (!round?.result || !resultVisible || !user || recordedRoundIds.current.has(round.id)) return;
    recordedRoundIds.current.add(round.id);
    recordRetentionRound({
      userId: user.id,
      gameId: "blackjack",
      wager: round.totalBet,
      won: round.result.amountPaid,
      multiplier: round.totalBet > 0 ? round.result.amountPaid / round.totalBet : 0,
    });
    refreshUser();
  }, [round?.result, resultVisible, user, refreshUser, notify]);

  if (!user) return null;
  const currentUser = user;

  const balance = getBalance(currentUser.id, currency);
  const active = round?.status === "PLAYER_TURN";
  const activeHand = round ? activeBlackjackHand(round) : null;
  const insuranceOffer = round ? canOfferInsurance(round, blackjackConfig, currentUser.id) : false;
  const evenMoneyOffer = round ? canOfferEvenMoney(round) : false;
  const actionBlocked = insuranceOffer || evenMoneyOffer;
  const actionsDisabled = blackjackActionsDisabled(cardsAnimating, actionBlocked);
  const betLimits = getBlackjackBetLimits(currency);
  const currencyLabel = currencyCopy[currency].short;
  const canDeal = !active && !cardsAnimating && !interactionLockedRef.current && betAmount >= betLimits.minBet && betAmount <= betLimits.maxBet && balance >= betAmount;
  const dealNotice = betAmount < betLimits.minBet
    ? `Minimum ${currencyLabel} bet is ${formatCoins(betLimits.minBet)}.`
    : betAmount > betLimits.maxBet
      ? `Maximum ${currencyLabel} initial bet is ${formatCoins(betLimits.maxBet)}.`
      : balance < betAmount
        ? `Need ${formatCoins(betAmount - balance)} more ${currencyLabel} to deal.`
        : undefined;
  const dealNoticeTone = dealNotice ? "warning" as const : "default" as const;
  const activeCardA = activeHand?.cards[0];
  const activeCardB = activeHand?.cards[1];
  const activeFirstValue = activeCardA ? blackjackRankValue(activeCardA) : 0;
  const activeSecondValue = activeCardB ? blackjackRankValue(activeCardB) : 0;
  const doubleEligibleBeforeBalance = Boolean(
    round &&
      activeHand &&
      !actionBlocked &&
      blackjackConfig.allowDouble &&
      round.status === "PLAYER_TURN" &&
      activeHand.cards.length === 2 &&
      activeHand.status === "ACTIVE" &&
      (!activeHand.splitFromPair || blackjackConfig.allowDoubleAfterSplit),
  );
  const splitEligibleBeforeBalance = Boolean(
    round &&
      activeHand &&
      !actionBlocked &&
      blackjackConfig.allowSplit &&
      round.status === "PLAYER_TURN" &&
      (blackjackConfig.allowResplit || !round.playerHands.some((hand) => hand.splitFromPair)) &&
      round.playerHands.length < (blackjackConfig.maxSplitHands ?? blackjackConfig.maxHandsAfterSplit) &&
      activeHand.cards.length === 2 &&
      activeFirstValue === activeSecondValue &&
      (blackjackConfig.allowSplitTens || activeFirstValue !== 10),
  );
  const extraWagerNeeded = activeHand ? Math.max(0, activeHand.betAmount - balance) : 0;
  const actionBalanceNotice = active && extraWagerNeeded > 0 && (doubleEligibleBeforeBalance || splitEligibleBeforeBalance)
    ? `Need ${formatCoins(extraWagerNeeded)} more ${currencyLabel} to ${doubleEligibleBeforeBalance && splitEligibleBeforeBalance ? "double or split" : doubleEligibleBeforeBalance ? "double" : "split"}.`
    : undefined;
  const visibleRound = round ? getVisibleBlackjackRound(round, animationKind, initialDealVisibleCount, dealerRevealVisibleCount) : null;
  const resultDisplay = round?.result && resultVisible ? getBlackjackResultDisplay(round) : null;
  const bigWin = Boolean(round?.result && round.result.result === "WIN" && round.result.amountPaid >= Math.max(round.totalBet * 3, betAmount * 3));
  const pageStyle = {
    "--blackjack-card-back": `url(${cardBackAsset})`,
    "--blackjack-table-overlay": `url(${feltEdgeOverlayAsset})`,
    "--blackjack-trim-overlay": `url(${goldTrimOverlayAsset})`,
    "--blackjack-win-banner": `url(${winBannerAsset})`,
  } as CSSProperties;

  function lockForAnimation(ms: number, kind: BlackjackAnimationKind, after?: () => void) {
    interactionLockedRef.current = true;
    setAnimationKind(kind);
    setCardsAnimating(true);
    scheduleTimer(() => {
      setCardsAnimating(false);
      setAnimationKind(null);
      setDealerRevealVisibleCount(null);
      interactionLockedRef.current = false;
      after?.();
    }, ms);
  }

  function clearSoundTimers() {
    soundTimers.current.forEach((timer) => window.clearTimeout(timer));
    soundTimers.current = [];
  }

  function scheduleSound(sound: () => void, delayMs: number) {
    scheduleTimer(sound, delayMs);
  }

  function scheduleTimer(callback: () => void, delayMs: number) {
    const timer = window.setTimeout(callback, delayMs);
    soundTimers.current.push(timer);
  }

  function scheduleInitialDealSounds() {
    clearSoundTimers();
    setDealerRevealVisibleCount(null);
    setInitialDealVisibleCount(0);
    blackjackSoundTimings.initialDealMs.forEach((delay, index) => {
      scheduleTimer(() => {
        playCardDeal();
        setInitialDealVisibleCount(index + 1);
      }, delay);
    });
  }

  function selectCurrency(nextCurrency: Currency) {
    if (nextCurrency === currency || active || cardsAnimating) return;
    const limits = getBlackjackBetLimits(nextCurrency);
    const nextBet = normalizeBet(Math.max(limits.minBet, Math.min(limits.maxBet, betAmount)), nextCurrency);
    playClick();
    setCurrency(nextCurrency);
    setBetAmount(nextBet);
  }

  function scheduleDealerRevealSounds(previous: BlackjackRound, next: BlackjackRound) {
    if (!next.dealerRevealed || previous.dealerRevealed) {
      setDealerRevealVisibleCount(null);
      return;
    }
    const visibleBaseCount = Math.min(next.dealerCards.length, Math.max(2, previous.dealerCards.length));
    setDealerRevealVisibleCount(visibleBaseCount);
    scheduleSound(playCardFlip, blackjackSoundTimings.dealerFlipMs);
    const extraDealerCards = Math.max(0, next.dealerCards.length - visibleBaseCount);
    for (let index = 0; index < extraDealerCards; index += 1) {
      const delay = dealerDrawDelay(index);
      scheduleSound(playCardDeal, delay);
      scheduleTimer(() => setDealerRevealVisibleCount(visibleBaseCount + index + 1), delay);
    }
  }

  function deal() {
    if (interactionLockedRef.current || !canDeal) return;
    interactionLockedRef.current = true;
    try {
      const next = startBlackjackRound({ userId: currentUser.id, currency, betAmount, deck: shoe });
      scheduleInitialDealSounds();
      playChip();
      setResultVisible(false);
      setRound(next);
      setShoe(prepareNextShoe(next.deck));
      const revealDelay = next.dealerRevealed ? dealerRevealAnimationMs(0, next.dealerCards.length) : 0;
      lockForAnimation(initialDealAnimationMs() + revealDelay, "initial", () => setResultVisible(Boolean(next.result)));
    } catch (caught) {
      interactionLockedRef.current = false;
      notify(caught instanceof Error ? caught.message : "Unable to deal.", "error");
      playError();
    }
  }

  function apply(action: "hit" | "stand" | "double" | "split") {
    if (!round || actionBlocked || cardsAnimating || interactionLockedRef.current) return;
    interactionLockedRef.current = true;
    try {
      playClick();
      const next = action === "hit"
        ? hitBlackjack(round, currentUser.id)
        : action === "stand"
          ? standBlackjack(round, currentUser.id)
          : action === "double"
            ? doubleDownBlackjack(round, currentUser.id)
          : splitBlackjack(round, currentUser.id);
      clearSoundTimers();
      setResultVisible(false);
      if (action === "hit") scheduleSound(playCardDeal, blackjackSoundTimings.playerHitMs);
      if (action === "double") {
        playChip();
        scheduleSound(playCardDeal, blackjackSoundTimings.playerHitMs);
      }
      if (action === "split") {
        blackjackSoundTimings.splitDealMs.forEach((delay) => scheduleSound(playCardDeal, delay));
      }
      scheduleDealerRevealSounds(round, next);
      setRound(next);
      setShoe(prepareNextShoe(next.deck));
      const animationMs = action === "split"
        ? splitAnimationMs()
        : next.dealerRevealed
          ? dealerRevealAnimationMs(round.dealerCards.length, next.dealerCards.length)
          : hitAnimationMs();
      lockForAnimation(animationMs, action === "stand" || next.dealerRevealed ? "dealer" : action, () => setResultVisible(Boolean(next.result)));
    } catch (caught) {
      interactionLockedRef.current = false;
      notify(caught instanceof Error ? caught.message : "Action failed.", "error");
      playError();
    }
  }

  function insurance(take: boolean) {
    if (!round || interactionLockedRef.current) return;
    interactionLockedRef.current = true;
    playClick();
    if (take) playChip();
    try {
      const next = resolveInsuranceBlackjack(round, currentUser.id, take);
      setRound(next);
      setResultVisible(Boolean(next.result));
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Insurance failed.", "error");
      playError();
    } finally {
      scheduleTimer(() => {
        interactionLockedRef.current = false;
      }, 160);
    }
  }

  function evenMoney(take: boolean) {
    if (!round || interactionLockedRef.current) return;
    interactionLockedRef.current = true;
    playClick();
    try {
      const next = take ? acceptEvenMoneyBlackjack(round, currentUser.id) : declineEvenMoneyBlackjack(round, currentUser.id);
      setRound(next);
      setResultVisible(Boolean(next.result));
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Even money failed.", "error");
      playError();
    } finally {
      scheduleTimer(() => {
        interactionLockedRef.current = false;
      }, 160);
    }
  }

  return (
    <section className={`blackjack-clean-page ${currencyCopy[currency].className} ${bigWin ? "big-win" : ""}`} style={pageStyle}>
      <header className="blackjack-clean-header">
        <button className="blackjack-clean-back" onClick={onExit} aria-label="Back to table games">&lt;</button>
        <div className="blackjack-clean-title">
          <div className="blackjack-clean-title-row">
            <h1><span>Blackjack</span></h1>
            <button className="blackjack-clean-info-button" type="button" aria-label="Blackjack rules" onClick={() => setRulesOpen(true)}>
              <Info size={14} />
            </button>
          </div>
        </div>
        <div className="blackjack-clean-currency-tabs" role="tablist" aria-label="Currency">
          <button
            type="button"
            className={currency === "GOLD" ? "active" : ""}
            disabled={active || cardsAnimating}
            onClick={() => selectCurrency("GOLD")}
          >
            GC
          </button>
          <button
            type="button"
            className={currency === "BONUS" ? "active" : ""}
            disabled={active || cardsAnimating}
            onClick={() => selectCurrency("BONUS")}
          >
            SC
          </button>
        </div>
        <SoundToggle className="ghost-button icon-only" compact />
      </header>

      <ScreenShake active={bigWin}>
      <main className="blackjack-clean-table">
        <div className="blackjack-clean-table-art" aria-hidden="true">
          <span className="blackjack-clean-felt-edge" />
          <span className="blackjack-clean-trim top" />
          <span className="blackjack-clean-trim bottom" />
          <span className="blackjack-clean-bet-ring" />
          <span className="blackjack-clean-ambient-line left" />
          <span className="blackjack-clean-ambient-line right" />
        </div>
        <div className="blackjack-clean-deck-source" aria-hidden="true">
          <span />
          <span />
        </div>
        <DealerHandView
          cards={visibleRound?.dealerCards ?? []}
          revealed={Boolean(round?.dealerRevealed) && animationKind !== "initial"}
          immediateDeal={animationKind === "initial"}
          sequencing={animationKind === "dealer"}
          animateDraws={animationKind === "dealer"}
          markerSrc={dealerButtonAsset}
        />
        <BlackjackPayoutBanner />
        {insuranceOffer && <InlineOffer title="Insurance?" onYes={() => insurance(true)} onNo={() => insurance(false)} />}
        {evenMoneyOffer && <InlineOffer title="Even Money?" onYes={() => evenMoney(true)} onNo={() => evenMoney(false)} />}

        <section className="blackjack-clean-player">
          {(visibleRound?.playerHands ?? []).length === 0 ? (
            <div className="blackjack-clean-empty">Table ready</div>
          ) : visibleRound!.playerHands.length > 1 ? (
            <>
              <div className={animationKind === "split" ? "blackjack-clean-split-hands splitting" : "blackjack-clean-split-hands"}>
                {visibleRound!.playerHands.map((hand, index) => (
                  <PlayerHandView key={hand.id} hand={hand} index={index} split active={active && index === round!.activeHandIndex} immediateDeal={animationKind === "initial"} animateLastCard={animationKind === "hit" || animationKind === "double"} />
                ))}
              </div>
              <div className="blackjack-clean-split-strip">
                {visibleRound!.playerHands.map((hand, index) => (
                  <SplitHandSummary key={hand.id} hand={hand} index={index} active={index === round!.activeHandIndex && active} />
                ))}
              </div>
            </>
          ) : (
            <PlayerHandView hand={visibleRound!.playerHands[0]} index={0} split={false} active={active} immediateDeal={animationKind === "initial"} animateLastCard={animationKind === "hit" || animationKind === "double"} />
          )}
        </section>

        {resultDisplay && (
          <div className={`blackjack-clean-result-frame ${resultDisplay.tone}`} role="presentation">
            <GameResultBanner
              tone={resultDisplay.tone}
              title={resultDisplay.title}
              amount={resultDisplay.amount}
              message={resultDisplay.message}
              compact
            />
            {(resultDisplay.tone === "win" || resultDisplay.tone === "big-win") && <CoinBurst count={resultDisplay.tone === "big-win" ? 18 : 12} />}
          </div>
        )}
      </main>
      </ScreenShake>

      <BlackjackControlsClean
        active={Boolean(active && activeHand && !actionBlocked)}
        balance={balance}
        betAmount={betAmount}
        canDeal={canDeal}
        canDouble={Boolean(round && canDoubleBlackjack(round, currentUser.id))}
        canSplit={Boolean(round && canSplitBlackjack(round, currentUser.id))}
        currency={currency}
        betLimits={betLimits}
        dealNotice={dealNotice}
        dealNoticeTone={dealNoticeTone}
        actionNotice={actionBalanceNotice}
        showDouble={doubleEligibleBeforeBalance}
        showSplit={splitEligibleBeforeBalance}
        doubleBlockedReason={doubleEligibleBeforeBalance && extraWagerNeeded > 0 ? actionBalanceNotice : undefined}
        splitBlockedReason={splitEligibleBeforeBalance && extraWagerNeeded > 0 ? actionBalanceNotice : undefined}
        disabled={actionsDisabled}
        onBetChange={setBetAmount}
        onDeal={deal}
        onHit={() => apply("hit")}
        onStand={() => apply("stand")}
        onDouble={() => apply("double")}
        onSplit={() => apply("split")}
      />
      {rulesOpen && (
        <div className="blackjack-clean-rules-backdrop" role="presentation" onClick={() => setRulesOpen(false)}>
          <section className="blackjack-clean-rules" role="dialog" aria-modal="true" aria-labelledby="blackjack-clean-rules-title" onClick={(event) => event.stopPropagation()}>
            <header>
              <h2 id="blackjack-clean-rules-title">Blackjack Rules</h2>
              <button type="button" aria-label="Close rules" onClick={() => setRulesOpen(false)}><X size={16} /></button>
            </header>
            <ul>
              {blackjackConfig.rules.map((rule) => <li key={rule}>{rule}</li>)}
              <li>Choose GC or SC before you play. The active currency sets your balance, bet limits, and payout display.</li>
              <li>Set your bet, press Deal, then use the available table actions for the active hand.</li>
              <li>Round results appear as a compact table banner after dealer resolution.</li>
            </ul>
          </section>
        </div>
      )}
    </section>
  );
}

function getVisibleBlackjackRound(round: BlackjackRound, animationKind: BlackjackAnimationKind, initialDealVisibleCount: number, dealerRevealVisibleCount: number | null): BlackjackRound {
  if (animationKind === "dealer" && dealerRevealVisibleCount !== null) {
    return {
      ...round,
      dealerCards: round.dealerCards.slice(0, dealerRevealVisibleCount),
    };
  }
  if (animationKind !== "initial") return round;
  const playerVisibleCount = Number(initialDealVisibleCount >= 1) + Number(initialDealVisibleCount >= 3);
  const dealerVisibleCount = Number(initialDealVisibleCount >= 2) + Number(initialDealVisibleCount >= 4);
  const firstHand = round.playerHands[0];
  const visibleHands: BlackjackHand[] = firstHand && playerVisibleCount > 0
    ? [{ ...firstHand, cards: firstHand.cards.slice(0, playerVisibleCount) }]
    : [];
  return {
    ...round,
    playerCards: firstHand?.cards.slice(0, playerVisibleCount) ?? [],
    playerHands: visibleHands,
    dealerCards: round.dealerCards.slice(0, dealerVisibleCount),
  };
}

function getBlackjackResultDisplay(round: BlackjackRound): BlackjackResultDisplay {
  const result = round.result;
  if (!result) return { title: "Table Ready", tone: "push" };

  if (round.insuranceResult?.result === "WIN") {
    return {
      title: "Insurance Win",
      tone: "win",
      amount: round.insuranceResult.amountPaid,
      message: `Insurance paid ${formatCoins(round.insuranceResult.amountPaid)}. ${result.message}`,
    };
  }

  if (result.result === "PUSH") {
    return { title: "Push", tone: "push", message: result.message };
  }

  if (result.result === "LOSS") {
    const busted = round.playerHands.some((hand) => hand.status === "BUST");
    return { title: busted ? "Bust" : "Dealer Wins", tone: "loss", message: result.message };
  }

  const playerBlackjack = round.playerHands.some((hand) => isBlackjack(hand.cards) && hand.result?.result === "WIN");
  const dealerBust = round.dealerRevealed && handValue(round.dealerCards).total > 21;
  const bigWin = result.amountPaid >= Math.max(round.totalBet * 3, round.betAmount * 3);
  return {
    title: playerBlackjack ? "Blackjack" : dealerBust ? "Dealer Bust" : bigWin ? "Big Win" : "Win",
    tone: bigWin || playerBlackjack ? "big-win" : "win",
    amount: result.amountPaid,
    message: result.message,
  };
}

function BlackjackPayoutBanner() {
  return (
    <div className="blackjack-clean-payout-banner" aria-label="Blackjack pays 3 to 2. Insurance pays 2 to 1.">
      <span>Blackjack <strong>3:2</strong></span>
      <i aria-hidden="true" />
      <span>Insurance <strong>2:1</strong></span>
    </div>
  );
}

function InlineOffer({ title, onYes, onNo }: { title: string; onYes: () => void; onNo: () => void }) {
  return (
    <div className="blackjack-clean-offer">
      <strong>{title}</strong>
      <button onClick={onYes}>Yes</button>
      <button onClick={onNo}>No</button>
    </div>
  );
}
