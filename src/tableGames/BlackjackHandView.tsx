import { blackjackAnimationConfig, dealerDrawDelay, initialDealStepDelay } from "./blackjackAnimations";
import { handValue } from "./blackjackEngine";
import { PlayingCard } from "./PlayingCard";
import type { BlackjackHand, PlayingCard as Card } from "./types";

export function DealerHandView({
  cards,
  revealed,
  immediateDeal,
  sequencing,
  animateDraws,
  markerSrc,
}: {
  cards: Card[];
  revealed: boolean;
  immediateDeal?: boolean;
  sequencing?: boolean;
  animateDraws?: boolean;
  markerSrc?: string;
}) {
  return (
    <section className="blackjack-clean-hand dealer" aria-label="Dealer hand">
      {markerSrc && <img className="blackjack-clean-dealer-button" src={markerSrc} alt="" draggable={false} aria-hidden="true" />}
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
              delayMs={immediateDeal || sequencing ? 0 : index === 0 ? initialDealStepDelay(1) : index === 1 ? initialDealStepDelay(3) : dealerDrawDelay(index - 2)}
              animate={Boolean(immediateDeal || (animateDraws && index > 1))}
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
  immediateDeal,
  animateLastCard,
}: {
  hand: BlackjackHand;
  active: boolean;
  index: number;
  split: boolean;
  immediateDeal?: boolean;
  animateLastCard?: boolean;
}) {
  const value = handValue(hand.cards);
  const total = value.total;
  const handTotal = formatHandTotal(hand.cards);
  const label = hand.status === "BUST" ? "Bust" : hand.cards.length === 2 && total === 21 ? "Blackjack" : `Total: ${handTotal}`;
  const className = [
    "blackjack-clean-hand",
    active ? "active" : "",
    hand.status === "BUST" ? "bust" : "",
    hand.cards.length === 2 && total === 21 ? "natural" : "",
  ].filter(Boolean).join(" ");

  return (
    <section className={className} aria-label={`${split ? `Hand ${index + 1}` : "Player"} ${label}`}>
      <div className="blackjack-clean-cards">
        {hand.cards.map((card, cardIndex) => (
          <PlayingCard
            key={`${hand.id}${cardIndex}`}
            card={card}
            index={cardIndex}
            delayMs={immediateDeal ? 0 : cardIndex === 0 ? initialDealStepDelay(0) : cardIndex === 1 ? initialDealStepDelay(2) : blackjackAnimationConfig.initialDealDelayMs}
            animate={Boolean(immediateDeal || (animateLastCard && cardIndex === hand.cards.length - 1 && cardIndex > 1))}
          />
        ))}
      </div>
      <div className="blackjack-clean-hand-total" aria-label={`${split ? `Hand ${index + 1}` : "Player"} total ${handTotal}`}>
        <span>{split ? `H${index + 1}` : "Player"}</span>
        <strong>{handTotal}</strong>
      </div>
      {hand.result && <small>{hand.result.result}</small>}
    </section>
  );
}

function formatHandTotal(cards: Card[]) {
  const value = handValue(cards);
  const hardTotal = cards.reduce((sum, card) => {
    if (card.rank === "A") return sum + 1;
    return sum + (["K", "Q", "J", "10"].includes(card.rank) ? 10 : Number(card.rank));
  }, 0);
  if (value.soft && hardTotal !== value.total) return `${hardTotal}/${value.total}`;
  return `${value.total}`;
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
