import { createId } from "../lib/ids";
import type { Currency } from "../types";
import { blackjackConfig } from "./configs";
import { placeTableBet, settleTableResult } from "./ledger";
import type { BlackjackConfig, BlackjackRound, PlayingCard, TableSettlement } from "./types";

const ranks: PlayingCard["rank"][] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const suits: PlayingCard["suit"][] = ["♠", "♥", "♦", "♣"];

export function createDeck() {
  return suits.flatMap((suit) => ranks.map((rank) => ({ rank, suit })));
}

export function shuffleDeck(deck = createDeck()) {
  const shuffled = [...deck];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function draw(deck: PlayingCard[]) {
  const card = deck.shift();
  if (!card) throw new Error("Deck is empty.");
  return card;
}

export function handValue(cards: PlayingCard[]) {
  let total = 0;
  let aces = 0;
  cards.forEach((card) => {
    if (card.rank === "A") {
      total += 11;
      aces += 1;
    } else if (["K", "Q", "J"].includes(card.rank)) {
      total += 10;
    } else {
      total += Number(card.rank);
    }
  });
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return { total, soft: aces > 0 };
}

function isBlackjack(cards: PlayingCard[]) {
  return cards.length === 2 && handValue(cards).total === 21;
}

function maybeDealerAssist(deck: PlayingCard[], dealerCards: PlayingCard[], config: BlackjackConfig) {
  if (Math.random() >= config.dealerAdvantageAssistRate) return;
  const total = handValue(dealerCards).total;
  if (total < 12 || total > 16) return;
  const index = deck.findIndex((card) => {
    const nextTotal = handValue([...dealerCards, card]).total;
    return nextTotal >= 17 && nextTotal <= 21;
  });
  if (index > 0) {
    const [card] = deck.splice(index, 1);
    deck.unshift(card);
  }
}

export function startBlackjackRound({
  userId,
  currency,
  betAmount,
  deck = shuffleDeck(),
  config = blackjackConfig,
}: {
  userId: string;
  currency: Currency;
  betAmount: number;
  deck?: PlayingCard[];
  config?: BlackjackConfig;
}): BlackjackRound {
  placeTableBet(userId, currency, betAmount, config, { action: "deal" });
  const round: BlackjackRound = {
    id: createId("bj"),
    status: "PLAYER_TURN",
    currency,
    betAmount,
    totalBet: betAmount,
    playerCards: [draw(deck), draw(deck)],
    dealerCards: [draw(deck), draw(deck)],
    deck,
  };

  if (isBlackjack(round.playerCards) || isBlackjack(round.dealerCards)) {
    return settleBlackjackRound(round, userId, config);
  }
  return round;
}

export function hitBlackjack(round: BlackjackRound, userId: string, config = blackjackConfig): BlackjackRound {
  if (round.status !== "PLAYER_TURN") return round;
  const next = { ...round, playerCards: [...round.playerCards, draw(round.deck)] };
  if (handValue(next.playerCards).total > 21) {
    return settleBlackjackRound(next, userId, config);
  }
  return next;
}

export function doubleDownBlackjack(round: BlackjackRound, userId: string, config = blackjackConfig): BlackjackRound {
  if (!config.doubleDownAllowed || round.status !== "PLAYER_TURN" || round.playerCards.length !== 2) return round;
  placeTableBet(userId, round.currency, round.betAmount, config, { action: "double_down" });
  const next = {
    ...round,
    totalBet: round.totalBet + round.betAmount,
    doubled: true,
    playerCards: [...round.playerCards, draw(round.deck)],
  };
  return standBlackjack(next, userId, config);
}

export function standBlackjack(round: BlackjackRound, userId: string, config = blackjackConfig): BlackjackRound {
  if (round.status !== "PLAYER_TURN") return round;
  const next = { ...round, status: "DEALER_TURN" as const };
  while (true) {
    maybeDealerAssist(next.deck, next.dealerCards, config);
    const dealer = handValue(next.dealerCards);
    if (dealer.total < 17 || (dealer.total === 17 && dealer.soft && config.dealerHitsSoft17)) {
      next.dealerCards = [...next.dealerCards, draw(next.deck)];
      continue;
    }
    break;
  }
  return settleBlackjackRound(next, userId, config);
}

export function settleBlackjackRound(
  round: BlackjackRound,
  userId: string,
  config = blackjackConfig,
): BlackjackRound {
  const playerTotal = handValue(round.playerCards).total;
  const dealerTotal = handValue(round.dealerCards).total;
  let settlement: TableSettlement;

  if (playerTotal > 21) {
    settlement = settleTableResult({ userId, currency: round.currency, config, result: "LOSS", amountPaid: 0, wagered: round.totalBet });
  } else if (dealerTotal > 21) {
    settlement = settleTableResult({ userId, currency: round.currency, config, result: "WIN", amountPaid: round.totalBet * 2, wagered: round.totalBet });
  } else if (isBlackjack(round.playerCards) && isBlackjack(round.dealerCards)) {
    settlement = settleTableResult({ userId, currency: round.currency, config, result: "PUSH", amountPaid: round.totalBet, wagered: round.totalBet });
  } else if (isBlackjack(round.playerCards)) {
    settlement = settleTableResult({
      userId,
      currency: round.currency,
      config,
      result: "WIN",
      amountPaid: round.betAmount + round.betAmount * config.blackjackPayout,
      wagered: round.totalBet,
      metadata: { blackjack: true },
    });
  } else if (dealerTotal > playerTotal || isBlackjack(round.dealerCards)) {
    settlement = settleTableResult({ userId, currency: round.currency, config, result: "LOSS", amountPaid: 0, wagered: round.totalBet });
  } else if (playerTotal === dealerTotal) {
    settlement = settleTableResult({ userId, currency: round.currency, config, result: "PUSH", amountPaid: round.totalBet, wagered: round.totalBet });
  } else {
    settlement = settleTableResult({ userId, currency: round.currency, config, result: "WIN", amountPaid: round.totalBet * 2, wagered: round.totalBet });
  }

  return { ...round, status: "RESOLVED", result: settlement };
}
