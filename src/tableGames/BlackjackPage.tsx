import { useState, type CSSProperties } from "react";
import { Modal } from "../components/Modal";
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

export function BlackjackPage() {
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
    <section className="table-play-screen blackjack-table blackjack-premium">
      <div className="table-game-heading blackjack-heading">
        <div>
          <p className="eyebrow">Virtual blackjack</p>
          <h1>Blackjack</h1>
          <p className="muted">Dealer hole card stays hidden until resolution. Virtual coins only.</p>
        </div>
        <label className="blackjack-currency">
          Currency
          <select value={currency} disabled={activeRound} onChange={(event) => setCurrency(event.target.value as Currency)}>
            <option value="GOLD">Gold Coins</option>
            <option value="BONUS">Bonus Coins</option>
          </select>
        </label>
      </div>

      <article className="felt-table blackjack-felt">
        <section className="blackjack-row dealer-row">
          <Hand
            label="Dealer"
            cards={round?.dealerCards ?? []}
            total={round ? visibleDealerValue(round) : 0}
            hideHoleCard={Boolean(round && !round.dealerRevealed)}
          />
        </section>

        <section className="blackjack-player-zone">
          {(round?.playerHands ?? []).length === 0 ? (
            <div className="blackjack-empty-hand">Place chips, then deal.</div>
          ) : (
            round!.playerHands.map((hand, index) => (
              <PlayerHand
                key={hand.id}
                hand={hand}
                active={round!.status === "PLAYER_TURN" && index === round!.activeHandIndex}
                index={index}
              />
            ))
          )}
        </section>

        {round?.result && <ResultBanner round={round} />}
      </article>

      <section className="blackjack-control-deck">
        <div className="blackjack-status-panel">
          <div>
            <span>Balance</span>
            <strong>{formatCoins(balance)}</strong>
            <small>{currency}</small>
          </div>
          <div>
            <span>Bet</span>
            <strong>{formatCoins(betAmount)}</strong>
            <small>Min {blackjackConfig.minBet} / Max {blackjackConfig.maxBet}</small>
          </div>
        </div>

        {!activeRound && (
          <div className="chip-betting">
            <div className="chip-rack" aria-label="Chip betting">
              {chipValues.map((value) => (
                <button
                  key={value}
                  className={`casino-chip chip-${value}`}
                  disabled={betAmount + value > blackjackConfig.maxBet || betAmount + value > balance}
                  onClick={() => addChip(value)}
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="chip-actions">
              <button className="ghost-button" onClick={clearBet}>Clear Bet</button>
              <button className="ghost-button" onClick={rebet}>Rebet</button>
            </div>
          </div>
        )}

        <div className="blackjack-actions">
          {!activeRound && <button className="primary-button" disabled={!canDeal} onClick={deal}>Deal</button>}
          {activeRound && activeHand && !actionBlocked && (
            <>
              <button className="primary-button" onClick={() => action("hit")}>Hit</button>
              <button className="ghost-button" onClick={() => action("stand")}>Stand</button>
              {round && canDoubleBlackjack(round, currentUser.id) && <button className="ghost-button" onClick={() => action("double")}>Double</button>}
              {round && canSplitBlackjack(round, currentUser.id) && <button className="ghost-button" onClick={() => action("split")}>Split</button>}
            </>
          )}
        </div>
      </section>

      {offerInsurance && round && (
        <Modal title="Insurance?" onClose={() => insurance(false)}>
          <div className="modal-stack">
            <p>Dealer shows an Ace. Insurance costs up to half your original wager and pays 2:1 if the dealer has blackjack.</p>
            <div className="notice-card">Virtual coins only. No cash value.</div>
            <div className="top-actions">
              <button className="primary-button" onClick={() => insurance(true)}>Take Insurance</button>
              <button className="ghost-button" onClick={() => insurance(false)}>No Insurance</button>
            </div>
          </div>
        </Modal>
      )}

      {offerEvenMoney && round && (
        <Modal title="Even Money?" onClose={() => evenMoney(false)}>
          <div className="modal-stack">
            <p>You have blackjack and the dealer shows an Ace. Take even money to lock a 1:1 win now.</p>
            <div className="notice-card">Virtual coins only. No cash value.</div>
            <div className="top-actions">
              <button className="primary-button" onClick={() => evenMoney(true)}>Take Even Money</button>
              <button className="ghost-button" onClick={() => evenMoney(false)}>Play It Out</button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}

function Hand({
  label,
  cards,
  total,
  hideHoleCard,
}: {
  label: string;
  cards: PlayingCard[];
  total: number;
  hideHoleCard?: boolean;
}) {
  return (
    <div className="card-hand blackjack-hand">
      <div className="section-title">
        <h3>{label}</h3>
        <span>Total {cards.length ? total : "-"}</span>
      </div>
      <div className="playing-cards blackjack-cards">
        {cards.length === 0 ? <div className="empty-state">Cards will appear here.</div> : cards.map((card, index) => (
          <CardView key={`${card.rank}${card.suit}${index}`} card={card} hidden={hideHoleCard && index === 1} index={index} />
        ))}
      </div>
    </div>
  );
}

function PlayerHand({ hand, active, index }: { hand: BlackjackHand; active: boolean; index: number }) {
  return (
    <div className={active ? "player-hand active" : "player-hand"}>
      <div className="section-title">
        <h3>Hand {index + 1}</h3>
        <span>{hand.status === "BUST" ? "Bust" : `Total ${handValue(hand.cards).total}`}</span>
      </div>
      <div className="playing-cards blackjack-cards">
        {hand.cards.map((card, cardIndex) => <CardView key={`${hand.id}${cardIndex}`} card={card} index={cardIndex} />)}
      </div>
      <div className="hand-footer">
        <span>Bet {formatCoins(hand.betAmount)}</span>
        {hand.result && <strong>{hand.result.result}</strong>}
      </div>
    </div>
  );
}

function CardView({ card, hidden, index }: { card: PlayingCard; hidden?: boolean; index: number }) {
  if (hidden) {
    return <div className="playing-card card-back" style={{ "--card-delay": `${index * 90}ms` } as CSSProperties}><span>Casino</span></div>;
  }
  const red = card.suit === "H" || card.suit === "D";
  return (
    <div className={red ? "playing-card red" : "playing-card"} style={{ "--card-delay": `${index * 90}ms` } as CSSProperties}>
      <strong>{card.rank}</strong>
      <span>{suitMarks[card.suit]}</span>
    </div>
  );
}

function ResultBanner({ round }: { round: BlackjackRound }) {
  const label = round.playerHands.some((hand) => hand.cards.length === 2 && handValue(hand.cards).total === 21 && hand.result?.result === "WIN")
    ? "Blackjack"
    : round.result?.result === "LOSS"
      ? "Dealer Wins"
      : round.result?.result ?? "Resolved";
  return (
    <div className={`table-result ${(round.result?.result ?? "push").toLowerCase()}`}>
      <strong>{label}</strong>
      <span>{round.result?.message}</span>
      {round.playerHands.length > 1 && (
        <small>{round.playerHands.map((hand, index) => `Hand ${index + 1}: ${hand.result?.result ?? "-"}`).join(" | ")}</small>
      )}
    </div>
  );
}
