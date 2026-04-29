import { useState, type CSSProperties } from "react";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastContext";
import { formatCoins } from "../lib/format";
import type { Currency } from "../types";
import { getBalance } from "../wallet/walletService";
import { blackjackConfig } from "./configs";
import {
  acceptEvenMoneyBlackjack,
  activeBlackjackHand,
  canDoubleBlackjack,
  canOfferEvenMoney,
  canOfferInsurance,
  canSplitBlackjack,
  declineEvenMoneyBlackjack,
  doubleDownBlackjack,
  handValue,
  hitBlackjack,
  resolveInsuranceBlackjack,
  splitBlackjack,
  standBlackjack,
  startBlackjackRound,
  visibleDealerValue,
} from "./blackjackEngine";
import type { BlackjackHand, BlackjackRound, PlayingCard } from "./types";

const chipValues = [1, 5, 10, 25, 100, 500];
const suitMarks: Record<PlayingCard["suit"], string> = { S: "♠", H: "♥", D: "♦", C: "♣" };

export const blackjackInlineUxMarkers = {
  inlineInsurance: true,
  inlineEvenMoney: true,
  chipStack: true,
  cssChips: true,
  compactTable: true,
  fixedMobileActions: true,
  integratedHeader: true,
  simpleUi: true,
};

export function BlackjackPage({ onExit }: { onExit?: () => void }) {
  const { user } = useAuth();
  const notify = useToast();
  const [currency, setCurrency] = useState<Currency>("GOLD");
  const [betAmount, setBetAmount] = useState(blackjackConfig.minBet);
  const [lastBet, setLastBet] = useState(blackjackConfig.minBet);
  const [round, setRound] = useState<BlackjackRound | null>(null);
  if (!user) return null;
  const currentUser = user;

  const balance = getBalance(currentUser.id, currency);
  const activeRound = round?.status === "PLAYER_TURN";
  const activeHand = round ? activeBlackjackHand(round) : null;
  const offerInsurance = round ? canOfferInsurance(round) : false;
  const offerEvenMoney = round ? canOfferEvenMoney(round) : false;
  const actionBlocked = offerInsurance || offerEvenMoney;
  const canDeal = !activeRound && betAmount >= blackjackConfig.minBet && betAmount <= blackjackConfig.maxBet && balance >= betAmount;

  function addChip(value: number) {
    if (activeRound) return;
    setBetAmount((current) => Math.min(blackjackConfig.maxBet, Math.min(balance, current + value)));
  }

  function clearBet() {
    if (!activeRound) setBetAmount(0);
  }

  function rebet() {
    if (!activeRound) setBetAmount(Math.min(lastBet, blackjackConfig.maxBet, balance));
  }

  function deal() {
    try {
      const wager = Math.max(blackjackConfig.minBet, betAmount);
      const next = startBlackjackRound({ userId: currentUser.id, currency, betAmount: wager });
      setLastBet(wager);
      setRound(next);
      if (next.result) notify(next.result.message, next.result.result === "WIN" ? "success" : "info");
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Unable to deal.", "error");
    }
  }

  function action(type: "hit" | "stand" | "double" | "split") {
    if (!round || actionBlocked) return;
    try {
      const next = type === "hit"
        ? hitBlackjack(round, currentUser.id)
        : type === "stand"
          ? standBlackjack(round, currentUser.id)
          : type === "double"
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
    try {
      const next = resolveInsuranceBlackjack(round, currentUser.id, take);
      setRound(next);
      if (next.insuranceResult) notify(next.insuranceResult.message, next.insuranceResult.result === "WIN" ? "success" : "info");
      if (next.result) notify(next.result.message, next.result.result === "WIN" ? "success" : "info");
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Insurance failed.", "error");
    }
  }

  function evenMoney(take: boolean) {
    if (!round) return;
    const next = take ? acceptEvenMoneyBlackjack(round, currentUser.id) : declineEvenMoneyBlackjack(round);
    setRound(next);
    if (next.result) notify("Even money paid.", "success");
  }

  return (
    <section className="blackjack-simple">
      <header className="bj-topbar">
        <button className="bj-back" onClick={onExit} aria-label="Back to table games">
          <ArrowLeft size={18} />
        </button>
        <div className="bj-title">
          <h1>Blackjack</h1>
          <span>Virtual Coins Only</span>
        </div>
        <label className="bj-currency">
          <span>Currency</span>
          <select value={currency} disabled={activeRound} onChange={(event) => setCurrency(event.target.value as Currency)}>
            <option value="GOLD">Gold</option>
            <option value="BONUS">Bonus</option>
          </select>
        </label>
      </header>

      <main className="bj-table">
        <HandRow
          label="Dealer"
          cards={round?.dealerCards ?? []}
          totalLabel={round?.dealerRevealed ? "Total" : "Upcard"}
          total={round ? visibleDealerValue(round) : 0}
          hideHoleCard={Boolean(round && !round.dealerRevealed)}
        />

        {offerInsurance && (
          <InlineOffer title="Insurance?" text="Dealer shows Ace." onYes={() => insurance(true)} onNo={() => insurance(false)} />
        )}
        {offerEvenMoney && (
          <InlineOffer title="Even Money?" text="Take a 1:1 win now?" onYes={() => evenMoney(true)} onNo={() => evenMoney(false)} />
        )}

        <section className="bj-player-area">
          {(round?.playerHands ?? []).length === 0 ? (
            <div className="bj-empty-hand">Place a bet to start.</div>
          ) : (
            round!.playerHands.map((hand, index) => (
              <PlayerHand key={hand.id} hand={hand} active={round!.status === "PLAYER_TURN" && index === round!.activeHandIndex} index={index} />
            ))
          )}
        </section>

        <BetDisplay amount={betAmount} />
        {round?.result && <ResultBanner round={round} />}
      </main>

      <footer className="bj-controls">
        <div className="bj-actions">
          {!activeRound && <button className="bj-primary bj-deal" disabled={!canDeal} onClick={deal}>Deal</button>}
          {activeRound && activeHand && !actionBlocked && (
            <>
              <button className="bj-primary" onClick={() => action("hit")}>Hit</button>
              <button className="bj-secondary" onClick={() => action("stand")}>Stand</button>
              {round && canDoubleBlackjack(round, currentUser.id) && <button className="bj-secondary blue" onClick={() => action("double")}>Double</button>}
              {round && canSplitBlackjack(round, currentUser.id) && <button className="bj-secondary purple" onClick={() => action("split")}>Split</button>}
            </>
          )}
        </div>

        {!activeRound && (
          <>
            <div className="bj-chip-row" aria-label="Chip betting">
              {chipValues.map((value) => (
                <button
                  key={value}
                  className={`bj-chip chip-${value}`}
                  disabled={betAmount + value > blackjackConfig.maxBet || betAmount + value > balance}
                  onClick={() => addChip(value)}
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="bj-utility">
              <button onClick={clearBet}>Clear</button>
              <button onClick={rebet}>Rebet</button>
            </div>
          </>
        )}

        <div className="bj-footer">
          <span>Balance <strong>{formatCoins(balance)}</strong> {currency}</span>
          <span>Min {blackjackConfig.minBet} / Max {blackjackConfig.maxBet}</span>
        </div>
      </footer>
    </section>
  );
}

function HandRow({
  label,
  cards,
  totalLabel,
  total,
  hideHoleCard,
}: {
  label: string;
  cards: PlayingCard[];
  totalLabel: string;
  total: number;
  hideHoleCard?: boolean;
}) {
  return (
    <section className="bj-hand-row">
      <div className="bj-row-heading">
        <strong>{label}</strong>
        <span>{totalLabel}: {cards.length ? total : "-"}</span>
      </div>
      <div className="bj-cards">
        {cards.length === 0 ? <div className="bj-card-placeholder">Cards</div> : cards.map((card, index) => (
          <CardView key={`${card.rank}${card.suit}${index}`} card={card} hidden={hideHoleCard && index === 1} index={index} />
        ))}
      </div>
    </section>
  );
}

function PlayerHand({ hand, active, index }: { hand: BlackjackHand; active: boolean; index: number }) {
  const total = handValue(hand.cards).total;
  const natural = hand.cards.length === 2 && total === 21;
  return (
    <section className={active ? "bj-player-hand active" : "bj-player-hand"}>
      <div className="bj-row-heading">
        <strong>{hand.splitFromPair ? `Hand ${index + 1}` : "Player"}</strong>
        <span>{hand.status === "BUST" ? "BUST" : natural ? "BLACKJACK" : `Total: ${total}`}</span>
      </div>
      <div className="bj-cards">
        {hand.cards.map((card, cardIndex) => <CardView key={`${hand.id}${cardIndex}`} card={card} index={cardIndex} />)}
      </div>
      <small>Bet {formatCoins(hand.betAmount)} {hand.result ? `• ${hand.result.result}` : ""}</small>
    </section>
  );
}

function InlineOffer({ title, text, onYes, onNo }: { title: string; text: string; onYes: () => void; onNo: () => void }) {
  return (
    <div className="bj-inline-offer">
      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
      <button onClick={onYes}>Yes</button>
      <button onClick={onNo}>No</button>
    </div>
  );
}

function BetDisplay({ amount }: { amount: number }) {
  return (
    <div className="bj-bet-display">
      <div className="bj-mini-stack" aria-hidden="true">
        {[0, 1, 2].map((index) => <span key={index} style={{ "--stack-index": index } as CSSProperties} />)}
      </div>
      <strong>Bet: {formatCoins(amount)}</strong>
    </div>
  );
}

function CardView({ card, hidden, index }: { card: PlayingCard; hidden?: boolean; index: number }) {
  if (hidden) return <div className="bj-card bj-card-back" style={{ "--card-delay": `${index * 120}ms` } as CSSProperties}>BJ</div>;
  const red = card.suit === "H" || card.suit === "D";
  return (
    <div className={red ? "bj-card red" : "bj-card"} style={{ "--card-delay": `${index * 120}ms` } as CSSProperties}>
      <strong>{card.rank}</strong>
      <span>{suitMarks[card.suit]}</span>
    </div>
  );
}

function ResultBanner({ round }: { round: BlackjackRound }) {
  const blackjack = round.playerHands.some((hand) => hand.cards.length === 2 && handValue(hand.cards).total === 21 && hand.result?.result === "WIN");
  const bust = round.playerHands.every((hand) => hand.status === "RESOLVED" && handValue(hand.cards).total > 21);
  const label = blackjack ? "Blackjack" : bust ? "Bust" : round.result?.result === "LOSS" ? "Dealer Wins" : round.result?.result ?? "Resolved";
  return (
    <div className={`bj-result ${(round.result?.result ?? "push").toLowerCase()}`}>
      <strong>{label}</strong>
      <span>{round.result?.message}</span>
    </div>
  );
}
