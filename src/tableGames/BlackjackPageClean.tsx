import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastContext";
import { formatCoins } from "../lib/format";
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
  visibleDealerValue,
} from "./blackjackEngine";
import { BlackjackControlsClean } from "./BlackjackControlsClean";
import { DealerHandView, PlayerHandView, SplitHandSummary } from "./BlackjackHandView";
import { blackjackConfig } from "./configs";
import type { BlackjackRound } from "./types";

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
  initialDealMs: [0, 120, 240, 360],
  playerHitMs: 80,
  dealerFlipMs: 360,
  dealerDrawStartMs: 540,
  dealerDrawStepMs: 160,
  splitDealMs: [0, 120],
};

export function BlackjackPageClean({ onExit }: { onExit?: () => void }) {
  const { user } = useAuth();
  const notify = useToast();
  const [currency, setCurrency] = useState<Currency>("GOLD");
  const [betAmount, setBetAmount] = useState(25);
  const [round, setRound] = useState<BlackjackRound | null>(null);
  const [shoe, setShoe] = useState(() => shuffleDeck(createShoe()));
  const [cardsAnimating, setCardsAnimating] = useState(false);
  const [dealerTotalRevealed, setDealerTotalRevealed] = useState(false);
  const soundTimers = useRef<number[]>([]);

  useEffect(() => () => clearSoundTimers(), []);

  useEffect(() => {
    if (!round?.dealerRevealed) {
      setDealerTotalRevealed(false);
      return;
    }
    const timer = window.setTimeout(() => setDealerTotalRevealed(true), 520);
    return () => window.clearTimeout(timer);
  }, [round?.dealerRevealed, round?.dealerCards.length]);

  useEffect(() => {
    if (!round?.result) return;
    const extraDealerCards = Math.max(0, round.dealerCards.length - 2);
    const resultDelay = round.dealerRevealed ? blackjackSoundTimings.dealerDrawStartMs + extraDealerCards * blackjackSoundTimings.dealerDrawStepMs + 160 : 520;
    const timer = window.setTimeout(() => {
      if (round.result?.result === "WIN") {
        if (round.playerHands.some((hand) => isBlackjack(hand.cards) && hand.result?.result === "WIN")) playBlackjackWin();
        else playWin();
      } else if (round.result?.result === "LOSS") playLose();
      else if (round.result?.result === "PUSH") playPush();
    }, resultDelay);
    return () => window.clearTimeout(timer);
  }, [round?.result]);

  if (!user) return null;
  const currentUser = user;

  const balance = getBalance(currentUser.id, currency);
  const active = round?.status === "PLAYER_TURN";
  const activeHand = round ? activeBlackjackHand(round) : null;
  const insuranceOffer = round ? canOfferInsurance(round, blackjackConfig, currentUser.id) : false;
  const evenMoneyOffer = round ? canOfferEvenMoney(round) : false;
  const actionBlocked = insuranceOffer || evenMoneyOffer;
  const canDeal = !active && !cardsAnimating && betAmount >= blackjackConfig.minBet && betAmount <= blackjackConfig.maxBet && balance >= betAmount;

  function lockForAnimation(ms = 1050) {
    setCardsAnimating(true);
    window.setTimeout(() => setCardsAnimating(false), ms);
  }

  function clearSoundTimers() {
    soundTimers.current.forEach((timer) => window.clearTimeout(timer));
    soundTimers.current = [];
  }

  function scheduleSound(sound: () => void, delayMs: number) {
    const timer = window.setTimeout(sound, delayMs);
    soundTimers.current.push(timer);
  }

  function scheduleInitialDealSounds() {
    clearSoundTimers();
    blackjackSoundTimings.initialDealMs.forEach((delay) => scheduleSound(playCardDeal, delay));
  }

  function scheduleDealerRevealSounds(previous: BlackjackRound, next: BlackjackRound) {
    if (!next.dealerRevealed || previous.dealerRevealed) return;
    scheduleSound(playCardFlip, blackjackSoundTimings.dealerFlipMs);
    const extraDealerCards = Math.max(0, next.dealerCards.length - Math.max(2, previous.dealerCards.length));
    for (let index = 0; index < extraDealerCards; index += 1) {
      scheduleSound(playCardDeal, blackjackSoundTimings.dealerDrawStartMs + index * blackjackSoundTimings.dealerDrawStepMs);
    }
  }

  function deal() {
    try {
      const next = startBlackjackRound({ userId: currentUser.id, currency, betAmount, deck: shoe });
      scheduleInitialDealSounds();
      setRound(next);
      setShoe(prepareNextShoe(next.deck));
      lockForAnimation(next.status === "RESOLVED" ? 1400 : 1250);
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
      lockForAnimation(action === "split" ? 950 : next.dealerRevealed ? 1100 : 520);
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
            disabled={active}
            onClick={() => setCurrency("GOLD")}
          >
            Gold
          </button>
          <button
            type="button"
            className={currency === "BONUS" ? "active" : ""}
            disabled={active}
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
        <DealerHandView
          cards={round?.dealerCards ?? []}
          total={round && dealerTotalRevealed ? visibleDealerValue(round) : round ? visibleDealerValue({ ...round, dealerRevealed: false }) : 0}
          revealed={Boolean(round?.dealerRevealed)}
          totalRevealed={dealerTotalRevealed}
        />
        {insuranceOffer && <InlineOffer title="Insurance?" onYes={() => insurance(true)} onNo={() => insurance(false)} />}
        {evenMoneyOffer && <InlineOffer title="Even Money?" onYes={() => evenMoney(true)} onNo={() => evenMoney(false)} />}

        <section className="blackjack-clean-player">
          {(round?.playerHands ?? []).length === 0 ? (
            <div className="blackjack-clean-empty">Set your bet and deal.</div>
          ) : round!.playerHands.length > 1 ? (
            <>
              <PlayerHandView
                key={round!.playerHands[round!.activeHandIndex]?.id ?? round!.playerHands[0].id}
                hand={round!.playerHands[round!.activeHandIndex] ?? round!.playerHands[0]}
                index={round!.activeHandIndex}
                split
                active={active}
              />
              <div className="blackjack-clean-split-strip">
                {round!.playerHands.map((hand, index) => (
                  <SplitHandSummary key={hand.id} hand={hand} index={index} active={index === round!.activeHandIndex && active} />
                ))}
              </div>
            </>
          ) : (
            <PlayerHandView hand={round!.playerHands[0]} index={0} split={false} active={active} />
          )}
        </section>

        {round?.result && (
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
        disabled={cardsAnimating}
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

function InlineOffer({ title, onYes, onNo }: { title: string; onYes: () => void; onNo: () => void }) {
  return (
    <div className="blackjack-clean-offer">
      <strong>{title}</strong>
      <button onClick={onYes}>Yes</button>
      <button onClick={onNo}>No</button>
    </div>
  );
}
