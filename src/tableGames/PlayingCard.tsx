import type { CSSProperties } from "react";
import { blackjackAnimationConfig } from "./blackjackAnimations";
import type { PlayingCard as Card } from "./types";

const suits: Record<Card["suit"], string> = {
  S: "\u2660",
  H: "\u2665",
  D: "\u2666",
  C: "\u2663",
};

export function PlayingCard({
  card,
  hidden,
  index = 0,
  reveal,
  delayMs,
  mini,
}: {
  card?: Card;
  hidden?: boolean;
  index?: number;
  reveal?: boolean;
  delayMs?: number;
  mini?: boolean;
}) {
  const delay = delayMs ?? index * 90;
  const animationStyle = {
    "--deal-delay": `${delay}ms`,
    "--card-slide-ms": `${blackjackAnimationConfig.cardSlideMs}ms`,
    "--card-flip-ms": `${blackjackAnimationConfig.flipMs}ms`,
  } as CSSProperties;
  if (!card && !hidden) return <div className="blackjack-clean-card placeholder">Card</div>;
  if (hidden) {
    return (
      <div className="blackjack-clean-card back" style={animationStyle}>
        BJ
      </div>
    );
  }

  const red = card?.suit === "H" || card?.suit === "D";
  const className = `${red ? "blackjack-clean-card red" : "blackjack-clean-card"}${reveal ? " reveal" : ""}${mini ? " mini" : ""}`;
  return (
    <div className={className} style={animationStyle}>
      <strong>{card?.rank}</strong>
      <span>{card ? suits[card.suit] : ""}</span>
    </div>
  );
}
