import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastContext";
import { formatCoins } from "../lib/format";
import type { Currency } from "../types";
import { blackjackConfig } from "./configs";
import { doubleDownBlackjack, handValue, hitBlackjack, standBlackjack, startBlackjackRound } from "./blackjackEngine";
import { TableBetControls } from "./TableBetControls";
import type { BlackjackRound, PlayingCard } from "./types";

export function BlackjackPage() {
  const { user } = useAuth();
  const notify = useToast();
  const [currency, setCurrency] = useState<Currency>("GOLD");
  const [betAmount, setBetAmount] = useState(blackjackConfig.minBet);
  const [round, setRound] = useState<BlackjackRound | null>(null);
  if (!user) return null;
  const currentUser = user;
  const inRound = round?.status === "PLAYER_TURN";

  function deal() {
    try {
      setRound(startBlackjackRound({ userId: currentUser.id, currency, betAmount }));
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Unable to deal.", "error");
    }
  }

  function action(type: "hit" | "stand" | "double") {
    if (!round) return;
    try {
      const next = type === "hit"
        ? hitBlackjack(round, currentUser.id)
        : type === "stand"
          ? standBlackjack(round, currentUser.id)
          : doubleDownBlackjack(round, currentUser.id);
      setRound(next);
      if (next.result) notify(next.result.message, next.result.result === "WIN" ? "success" : "info");
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Action failed.", "error");
    }
  }

  return (
    <section className="table-play-screen blackjack-table">
      <TableHeader title="Blackjack" subtitle="Single-player demo blackjack. Virtual coins only." />
      <div className="table-layout">
        <article className="felt-table">
          <Hand label="Dealer" cards={round?.dealerCards ?? []} total={round ? handValue(round.dealerCards).total : 0} />
          <Hand label="Player" cards={round?.playerCards ?? []} total={round ? handValue(round.playerCards).total : 0} />
          {round?.result && <ResultBanner title={round.result.result} amount={round.result.amountPaid} message={round.result.message} />}
        </article>
        <div className="table-side-panel">
          <TableBetControls
            userId={currentUser.id}
            config={blackjackConfig}
            currency={currency}
            betAmount={betAmount}
            disabled={inRound}
            maxPayoutPreview={blackjackConfig.maxPayout}
            onCurrencyChange={setCurrency}
            onBetChange={setBetAmount}
          />
          <div className="table-action-grid">
            <button className="primary-button" disabled={inRound} onClick={deal}>Deal</button>
            <button className="ghost-button" disabled={!inRound} onClick={() => action("hit")}>Hit</button>
            <button className="ghost-button" disabled={!inRound} onClick={() => action("stand")}>Stand</button>
            <button className="ghost-button" disabled={!inRound || round?.playerCards.length !== 2} onClick={() => action("double")}>Double</button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Hand({ label, cards, total }: { label: string; cards: PlayingCard[]; total: number }) {
  return (
    <div className="card-hand">
      <div className="section-title">
        <h3>{label}</h3>
        <span>Total {total || "-"}</span>
      </div>
      <div className="playing-cards">
        {cards.length === 0 ? <div className="empty-state">Cards will appear here.</div> : cards.map((card, index) => (
          <div className={card.suit === "♥" || card.suit === "♦" ? "playing-card red" : "playing-card"} key={`${card.rank}${card.suit}${index}`}>
            <strong>{card.rank}</strong>
            <span>{card.suit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TableHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="table-game-heading">
      <p className="eyebrow">Table games</p>
      <h1>{title}</h1>
      <p className="muted">{subtitle}</p>
    </div>
  );
}

function ResultBanner({ title, amount, message }: { title: string; amount: number; message: string }) {
  return (
    <div className={`table-result ${title.toLowerCase()}`}>
      <strong>{title}</strong>
      <span>{amount > 0 ? formatCoins(amount) : message}</span>
    </div>
  );
}
