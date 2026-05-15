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
  animate,
  mini,
}: {
  card?: Card;
  hidden?: boolean;
  index?: number;
  reveal?: boolean;
  delayMs?: number;
  animate?: boolean;
  mini?: boolean;
}) {
  const delay = delayMs ?? index * 90;
  const tiltPattern = mini ? [0, -2, 2] : [-2.8, 1.7, -1.2, 2.4, -2, 1.2, -0.8, 2.8];
  const tilt = tiltPattern[index % tiltPattern.length] ?? 0;
  const settleY = mini ? 0 : (index % 2 === 0 ? 0 : 2);
  const animationStyle = {
    "--deal-delay": `${delay}ms`,
    "--card-slide-ms": `${blackjackAnimationConfig.cardSlideMs}ms`,
    "--card-flip-ms": `${blackjackAnimationConfig.flipMs}ms`,
    "--card-tilt": `${tilt}deg`,
    "--card-settle-y": `${settleY}px`,
  } as CSSProperties;
  if (!card && !hidden) return <div className="blackjack-clean-card placeholder" aria-hidden="true"><span /></div>;

  const red = card?.suit === "H" || card?.suit === "D";
  const className = [
    "blackjack-clean-card",
    red ? "red" : "",
    hidden || reveal ? "hole" : "",
    hidden ? "hidden" : "",
    reveal ? "reveal" : "",
    animate && !mini ? "dealing" : "",
    mini ? "mini" : "",
  ].filter(Boolean).join(" ");

  if (hidden || reveal) {
    return (
      <div className={className} style={animationStyle} aria-label={hidden ? "Face-down card" : undefined}>
        <span className="blackjack-clean-card-corner top">
          <strong>{card?.rank}</strong>
          <em>{card ? suits[card.suit] : ""}</em>
        </span>
        <span className="blackjack-clean-card-pip">{card ? suits[card.suit] : ""}</span>
        <span className="blackjack-clean-card-corner bottom" aria-hidden="true">
          <strong>{card?.rank}</strong>
          <em>{card ? suits[card.suit] : ""}</em>
        </span>
        <span className="blackjack-clean-card-back-face" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className={className} style={animationStyle}>
      <span className="blackjack-clean-card-corner top">
        <strong>{card?.rank}</strong>
        <em>{card ? suits[card.suit] : ""}</em>
      </span>
      <span className="blackjack-clean-card-pip">{card ? suits[card.suit] : ""}</span>
      <span className="blackjack-clean-card-corner bottom" aria-hidden="true">
        <strong>{card?.rank}</strong>
        <em>{card ? suits[card.suit] : ""}</em>
      </span>
    </div>
  );
}
