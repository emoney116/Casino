import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastContext";
import { formatCoins } from "../lib/format";
import { recordRetentionRound } from "../retention/retentionService";
import type { Currency } from "../types";
import { getBalance } from "../wallet/walletService";
import { GameResultBanner, ScreenShake, SoundToggle } from "../feedback/components";
import { playBlackjackWin, playCardDeal, playCardFlip, playChip, playError, playLose, playPush, playWin } from "../feedback/feedbackService";
import {
  acceptEvenMoneyBlackjack,
  activeBlackjackHand,
  canDoubleBlackjack,
  canOfferEvenMoney,
  canOfferInsurance,
  canSplitBlackjack,
  createShoe,
  declineEvenMoneyBlackjack,
  doubleDownBlackjack,
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
  dealerDisplayTotal,
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
  const [dealerTotalRevealed, setDealerTotalRevealed] = useState(false);
  const [resultVisible, setResultVisible] = useState(false);
  const soundTimers = useRef<number[]>([]);
  const recordedRoundIds = useRef<Set<string>>(new Set());

  useEffect(() => () => clearSoundTimers(), []);

  useEffect(() => {
    if (!round?.dealerRevealed) {
      setDealerTotalRevealed(false);
      return;
    }
    const timer = window.setTimeout(() => setDealerTotalRevealed(true), blackjackAnimationConfig.flipMs);
    return () => window.clearTimeout(timer);
  }, [round?.dealerRevealed, round?.dealerCards.length]);

  useEffect(() => {
    if (!round?.result || !resultVisible) return;
    if (round.result.result === "WIN") {
      if (round.playerHands.some((hand) => isBlackjack(hand.cards) && hand.result?.result === "WIN")) playBlackjackWin();
      else playWin();
    } else if (round.result.result === "LOSS") playLose();
    else if (round.result.result === "PUSH") playPush();
  }, [round?.result, resultVisible]);

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
  const canDeal = !active && !cardsAnimating && betAmount >= blackjackConfig.minBet && betAmount <= blackjackConfig.maxBet && balance >= betAmount;
  const visibleRound = round ? getVisibleBlackjackRound(round, animationKind, initialDealVisibleCount) : null;

  function lockForAnimation(ms: number, kind: BlackjackAnimationKind, after?: () => void) {
    setAnimationKind(kind);
    setCardsAnimating(true);
    scheduleTimer(() => {
      setCardsAnimating(false);
      setAnimationKind(null);
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
    setInitialDealVisibleCount(0);
    blackjackSoundTimings.initialDealMs.forEach((delay, index) => {
      scheduleTimer(() => {
        playCardDeal();
        setInitialDealVisibleCount(index + 1);
      }, delay);
    });
  }

  function scheduleDealerRevealSounds(previous: BlackjackRound, next: BlackjackRound) {
    if (!next.dealerRevealed || previous.dealerRevealed) return;
    scheduleSound(playCardFlip, blackjackSoundTimings.dealerFlipMs);
    const extraDealerCards = Math.max(0, next.dealerCards.length - Math.max(2, previous.dealerCards.length));
    for (let index = 0; index < extraDealerCards; index += 1) {
      scheduleSound(playCardDeal, dealerDrawDelay(index));
    }
  }

  function deal() {
    try {
      const next = startBlackjackRound({ userId: currentUser.id, currency, betAmount, deck: shoe });
      scheduleInitialDealSounds();
      setDealerTotalRevealed(false);
      setResultVisible(false);
      setRound(next);
      setShoe(prepareNextShoe(next.deck));
      const revealDelay = next.dealerRevealed ? dealerRevealAnimationMs(0, next.dealerCards.length) : 0;
      lockForAnimation(initialDealAnimationMs() + revealDelay, "initial", () => setResultVisible(Boolean(next.result)));
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Unable to deal.", "error");
      playError();
    }
  }

  function apply(action: "hit" | "stand" | "double" | "split") {
    if (!round || actionBlocked || cardsAnimating) return;
    try {
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
      notify(caught instanceof Error ? caught.message : "Action failed.", "error");
      playError();
    }
  }

  function insurance(take: boolean) {
    if (!round) return;
    const next = resolveInsuranceBlackjack(round, currentUser.id, take);
    setRound(next);
  }

  function evenMoney(take: boolean) {
    if (!round) return;
    setRound(take ? acceptEvenMoneyBlackjack(round, currentUser.id) : declineEvenMoneyBlackjack(round));
  }

  return (
    <section className="blackjack-clean-page">
      <header className="blackjack-clean-header">
        <button className="blackjack-clean-back" onClick={onExit} aria-label="Back to table games">‹</button>
        <div className="blackjack-clean-title">
          <h1>Blackjack <span className="blackjack-clean-logo" aria-hidden="true">♠</span></h1>
        </div>
        <div className="blackjack-clean-currency-tabs" role="tablist" aria-label="Currency">
          <button
            type="button"
            className={currency === "GOLD" ? "active" : ""}
            disabled={active || cardsAnimating}
            onClick={() => setCurrency("GOLD")}
          >
            Gold
          </button>
          <button
            type="button"
            className={currency === "BONUS" ? "active" : ""}
            disabled={active || cardsAnimating}
            onClick={() => setCurrency("BONUS")}
          >
            Bonus
          </button>
        </div>
        <SoundToggle className="ghost-button icon-only" compact />
      </header>

      <div className="blackjack-clean-balance">
        <span>Balance: {formatCoins(balance)}</span>
        <strong>Bet: {formatCoins(betAmount)}</strong>
      </div>

      <ScreenShake active={Boolean(round?.result && round.result.result === "WIN" && round.result.amountPaid >= betAmount * 3)}>
      <main className="blackjack-clean-table">
        <div className="blackjack-clean-deck-source" aria-hidden="true">
          <span />
          <span />
        </div>
        <DealerHandView
          cards={visibleRound?.dealerCards ?? []}
          total={round ? dealerDisplayTotal(round, dealerTotalRevealed) : 0}
          revealed={Boolean(round?.dealerRevealed) && animationKind !== "initial"}
          totalRevealed={dealerTotalRevealed}
          immediateDeal={animationKind === "initial"}
        />
        {insuranceOffer && <InlineOffer title="Insurance?" onYes={() => insurance(true)} onNo={() => insurance(false)} />}
        {evenMoneyOffer && <InlineOffer title="Even Money?" onYes={() => evenMoney(true)} onNo={() => evenMoney(false)} />}

        <section className="blackjack-clean-player">
          {(visibleRound?.playerHands ?? []).length === 0 ? (
            <div className="blackjack-clean-empty">Set your bet and deal.</div>
          ) : visibleRound!.playerHands.length > 1 ? (
            <>
              <div className={animationKind === "split" ? "blackjack-clean-split-hands splitting" : "blackjack-clean-split-hands"}>
                {visibleRound!.playerHands.map((hand, index) => (
                  <PlayerHandView key={hand.id} hand={hand} index={index} split active={active && index === round!.activeHandIndex} immediateDeal={animationKind === "initial"} />
                ))}
              </div>
              <div className="blackjack-clean-split-strip">
                {visibleRound!.playerHands.map((hand, index) => (
                  <SplitHandSummary key={hand.id} hand={hand} index={index} active={index === round!.activeHandIndex && active} />
                ))}
              </div>
            </>
          ) : (
            <PlayerHandView hand={visibleRound!.playerHands[0]} index={0} split={false} active={active} immediateDeal={animationKind === "initial"} />
          )}
        </section>

        {round?.result && resultVisible && (
          <GameResultBanner
            tone={round.result.result === "LOSS" ? "loss" : round.result.result === "PUSH" ? "push" : "win"}
            title={round.result.result === "LOSS" ? "Dealer Wins" : round.result.result}
            amount={round.result.result === "WIN" ? round.result.amountPaid : undefined}
            message={round.result.message}
            compact
          />
        )}
      </main>
      </ScreenShake>

      <BlackjackControlsClean
        active={Boolean(active && activeHand && !actionBlocked)}
        betAmount={betAmount}
        canDeal={canDeal}
        canDouble={Boolean(round && canDoubleBlackjack(round, currentUser.id))}
        canSplit={Boolean(round && canSplitBlackjack(round, currentUser.id))}
        disabled={actionsDisabled}
        onBetChange={setBetAmount}
        onDeal={deal}
        onHit={() => apply("hit")}
        onStand={() => apply("stand")}
        onDouble={() => apply("double")}
        onSplit={() => apply("split")}
      />
    </section>
  );
}

function getVisibleBlackjackRound(round: BlackjackRound, animationKind: BlackjackAnimationKind, initialDealVisibleCount: number): BlackjackRound {
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

function InlineOffer({ title, onYes, onNo }: { title: string; onYes: () => void; onNo: () => void }) {
  return (
    <div className="blackjack-clean-offer">
      <strong>{title}</strong>
      <button onClick={onYes}>Yes</button>
      <button onClick={onNo}>No</button>
    </div>
  );
}
