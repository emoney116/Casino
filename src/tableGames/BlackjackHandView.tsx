import { handValue } from "./blackjackEngine";
import { PlayingCard } from "./PlayingCard";
import type { BlackjackHand, PlayingCard as Card } from "./types";

export function DealerHandView({
  cards,
  total,
  revealed,
  totalRevealed,
}: {
  cards: Card[];
  total: number;
  revealed: boolean;
  totalRevealed?: boolean;
}) {
  return (
    <section className="blackjack-clean-hand">
      <div className="blackjack-clean-hand-head">
        <strong>Dealer</strong>
        <span>{revealed && totalRevealed ? "Total" : "Visible"}: {cards.length ? total : "-"}</span>
      </div>
      <div className="blackjack-clean-cards">
        {cards.length === 0 ? (
          <PlayingCard />
        ) : (
          cards.map((card, index) => (
            <PlayingCard
              key={`${card.rank}${card.suit}${index}`}
              card={card}
              hidden={!revealed && index === 1}
              reveal={revealed && index === 1}
              index={index}
              delayMs={index === 0 ? 120 : index === 1 ? 360 : 540 + (index - 2) * 160}
            />
          ))
        )}
      </div>
    </section>
  );
}

export function PlayerHandView({
  hand,
  active,
  index,
  split,
}: {
  hand: BlackjackHand;
  active: boolean;
  index: number;
  split: boolean;
}) {
  const total = handValue(hand.cards).total;
  const label = hand.status === "BUST" ? "Bust" : hand.cards.length === 2 && total === 21 ? "Blackjack" : `Total: ${total}`;

  return (
    <section className={active ? "blackjack-clean-hand active" : "blackjack-clean-hand"}>
      <div className="blackjack-clean-hand-head">
        <strong>{split ? `Hand ${index + 1}` : "Player"}</strong>
        <span>{label}</span>
      </div>
      <div className="blackjack-clean-cards">
        {hand.cards.map((card, cardIndex) => (
          <PlayingCard key={`${hand.id}${cardIndex}`} card={card} index={cardIndex} delayMs={cardIndex === 0 ? 0 : cardIndex === 1 ? 240 : 80} />
        ))}
      </div>
      {hand.result && <small>{hand.result.result}</small>}
    </section>
  );
}

export function SplitHandSummary({
  hand,
  active,
  index,
}: {
  hand: BlackjackHand;
  active: boolean;
  index: number;
}) {
  const total = handValue(hand.cards).total;
  const status = hand.result?.result ?? (hand.status === "ACTIVE" ? `Total ${total}` : hand.status);
  return (
    <div className={active ? "blackjack-clean-hand-summary active" : "blackjack-clean-hand-summary"}>
      <strong>H{index + 1}</strong>
      <div className="blackjack-clean-mini-cards">
        {hand.cards.slice(0, 3).map((card, cardIndex) => (
          <PlayingCard key={`${hand.id}-mini-${cardIndex}`} card={card} index={cardIndex} mini />
        ))}
      </div>
      <span>{status}</span>
    </div>
  );
}
