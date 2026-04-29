import type { CSSProperties } from "react";
import type { PlayingCard as Card } from "./types";

const suits: Record<Card["suit"], string> = {
  S: "\u2660",
  H: "\u2665",
  D: "\u2666",
  C: "\u2663",
};

export function PlayingCard({ card, hidden, index = 0 }: { card?: Card; hidden?: boolean; index?: number }) {
  if (!card && !hidden) return <div className="blackjack-clean-card placeholder">Card</div>;
  if (hidden) {
    return (
      <div className="blackjack-clean-card back" style={{ "--deal-delay": `${index * 90}ms` } as CSSProperties}>
        BJ
      </div>
    );
  }

  const red = card?.suit === "H" || card?.suit === "D";
  return (
    <div className={red ? "blackjack-clean-card red" : "blackjack-clean-card"} style={{ "--deal-delay": `${index * 90}ms` } as CSSProperties}>
      <strong>{card?.rank}</strong>
      <span>{card ? suits[card.suit] : ""}</span>
    </div>
  );
}
