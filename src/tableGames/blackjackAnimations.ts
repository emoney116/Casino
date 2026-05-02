import { handValue, visibleDealerValue } from "./blackjackEngine";
import type { BlackjackRound } from "./types";

export const blackjackAnimationConfig = {
  initialDealDelayMs: 380,
  cardSlideMs: 520,
  dealerDrawDelayMs: 420,
  flipMs: 820,
  splitSlideMs: 620,
};

export const initialDealSequence = [
  "player-card-1",
  "dealer-upcard",
  "player-card-2",
  "dealer-hole-card",
] as const;

export function initialDealStepDelay(index: number) {
  return index * blackjackAnimationConfig.initialDealDelayMs;
}

export function initialDealAnimationMs() {
  return initialDealStepDelay(initialDealSequence.length - 1) + blackjackAnimationConfig.cardSlideMs;
}

export function hitAnimationMs() {
  return blackjackAnimationConfig.cardSlideMs;
}

export function splitAnimationMs() {
  return blackjackAnimationConfig.splitSlideMs + blackjackAnimationConfig.cardSlideMs;
}

export function dealerRevealAnimationMs(previousDealerCardCount: number, nextDealerCardCount: number) {
  const extraCards = Math.max(0, nextDealerCardCount - Math.max(2, previousDealerCardCount));
  return blackjackAnimationConfig.flipMs + extraCards * (blackjackAnimationConfig.dealerDrawDelayMs + blackjackAnimationConfig.cardSlideMs);
}

export function dealerDrawDelay(indexAfterHole: number) {
  return blackjackAnimationConfig.flipMs + indexAfterHole * blackjackAnimationConfig.dealerDrawDelayMs;
}

export function blackjackActionsDisabled(cardsAnimating: boolean, actionBlocked: boolean) {
  return cardsAnimating || actionBlocked;
}

export function dealerDisplayTotal(round: BlackjackRound, dealerTotalRevealed: boolean) {
  return round.dealerRevealed && dealerTotalRevealed ? handValue(round.dealerCards).total : visibleDealerValue({ ...round, dealerRevealed: false });
}
