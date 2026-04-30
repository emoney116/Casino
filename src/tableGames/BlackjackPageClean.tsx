import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastContext";
import { formatCoins } from "../lib/format";
import type { Currency } from "../types";
import { getBalance } from "../wallet/walletService";
import {
  acceptEvenMoneyBlackjack,
  activeBlackjackHand,
  canDoubleBlackjack,
  canOfferEvenMoney,
  canOfferInsurance,
  canSplitBlackjack,
  declineEvenMoneyBlackjack,
  doubleDownBlackjack,
  hitBlackjack,
  resolveInsuranceBlackjack,
  splitBlackjack,
  standBlackjack,
  startBlackjackRound,
  visibleDealerValue,
} from "./blackjackEngine";
import { BlackjackControlsClean } from "./BlackjackControlsClean";
import { DealerHandView, PlayerHandView } from "./BlackjackHandView";
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
};

export function BlackjackPageClean({ onExit }: { onExit?: () => void }) {
  const { user } = useAuth();
  const notify = useToast();
  const [currency, setCurrency] = useState<Currency>("GOLD");
  const [betAmount, setBetAmount] = useState(25);
  const [round, setRound] = useState<BlackjackRound | null>(null);
  const [dealerTotalRevealed, setDealerTotalRevealed] = useState(false);
  if (!user) return null;
  const currentUser = user;

  useEffect(() => {
    if (!round?.dealerRevealed) {
      setDealerTotalRevealed(false);
      return;
    }
    const timer = window.setTimeout(() => setDealerTotalRevealed(true), 520);
    return () => window.clearTimeout(timer);
  }, [round?.dealerRevealed, round?.dealerCards.length]);

  const balance = getBalance(currentUser.id, currency);
  const active = round?.status === "PLAYER_TURN";
  const activeHand = round ? activeBlackjackHand(round) : null;
  const insuranceOffer = round ? canOfferInsurance(round, blackjackConfig, currentUser.id) : false;
  const evenMoneyOffer = round ? canOfferEvenMoney(round) : false;
  const actionBlocked = insuranceOffer || evenMoneyOffer;
  const canDeal = !active && betAmount >= blackjackConfig.minBet && betAmount <= blackjackConfig.maxBet && balance >= betAmount;

  function deal() {
    try {
      const next = startBlackjackRound({ userId: currentUser.id, currency, betAmount });
      setRound(next);
      if (next.result) notify(next.result.message, next.result.result === "WIN" ? "success" : "info");
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Unable to deal.", "error");
    }
  }

  function apply(action: "hit" | "stand" | "double" | "split") {
    if (!round || actionBlocked) return;
    try {
      const next = action === "hit"
        ? hitBlackjack(round, currentUser.id)
        : action === "stand"
          ? standBlackjack(round, currentUser.id)
          : action === "double"
            ? doubleDownBlackjack(round, currentUser.id)
            : splitBlackjack(round, currentUser.id);
      setRound(next);
      if (next.result) notify(next.result.message, next.result.result === "WIN" ? "success" : "info");
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Action failed.", "error");
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
      </header>

      <div className="blackjack-clean-balance">
        <span>Balance: {formatCoins(balance)}</span>
        <strong>Bet: {formatCoins(betAmount)}</strong>
      </div>

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
          ) : (
            round!.playerHands.map((hand, index) => (
              <PlayerHandView
                key={hand.id}
                hand={hand}
                index={index}
                split={round!.playerHands.length > 1}
                active={active && index === round!.activeHandIndex}
              />
            ))
          )}
        </section>

        {round?.result && (
          <div className={`blackjack-clean-result ${round.result.result.toLowerCase()}`}>
            <strong>{round.result.result === "LOSS" ? "Dealer Wins" : round.result.result}</strong>
            <span>{round.result.message}</span>
          </div>
        )}
      </main>

      <BlackjackControlsClean
        active={Boolean(active && activeHand && !actionBlocked)}
        betAmount={betAmount}
        canDeal={canDeal}
        canDouble={Boolean(round && canDoubleBlackjack(round, currentUser.id))}
        canSplit={Boolean(round && canSplitBlackjack(round, currentUser.id))}
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
