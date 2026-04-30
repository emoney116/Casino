import { createId } from "../lib/ids";
import type { Currency } from "../types";
import { getBalance } from "../wallet/walletService";
import { blackjackConfig } from "./configs";
import { placeTableBet, settleTableResult } from "./ledger";
import type { BlackjackConfig, BlackjackHand, BlackjackRound, PlayingCard, TableSettlement } from "./types";

const ranks: PlayingCard["rank"][] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const suits: PlayingCard["suit"][] = ["S", "H", "D", "C"];

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

export function visibleDealerValue(round: BlackjackRound) {
  return round.dealerRevealed ? handValue(round.dealerCards).total : handValue(round.dealerCards.slice(0, 1)).total;
}

export function isBlackjack(cards: PlayingCard[]) {
  return cards.length === 2 && handValue(cards).total === 21;
}

export function activeBlackjackHand(round: BlackjackRound) {
  return round.playerHands[round.activeHandIndex];
}

export function canDoubleBlackjack(round: BlackjackRound, userId: string, config = blackjackConfig) {
  const hand = activeBlackjackHand(round);
  return Boolean(
    config.allowDouble &&
      round.status === "PLAYER_TURN" &&
      hand?.cards.length === 2 &&
      hand.status === "ACTIVE" &&
      getBalance(userId, round.currency) >= hand.betAmount,
  );
}

export function canSplitBlackjack(round: BlackjackRound, userId: string, config = blackjackConfig) {
  const hand = activeBlackjackHand(round);
  return Boolean(
    config.allowSplit &&
      round.status === "PLAYER_TURN" &&
      round.playerHands.length < config.maxHandsAfterSplit &&
      hand?.cards.length === 2 &&
      hand.cards[0].rank === hand.cards[1].rank &&
      getBalance(userId, round.currency) >= hand.betAmount,
  );
}

export function canOfferInsurance(round: BlackjackRound, config = blackjackConfig, userId?: string) {
  const insuranceBet = Math.floor(round.betAmount / 2);
  return Boolean(
    config.allowInsurance &&
      round.status === "PLAYER_TURN" &&
      round.dealerCards[0]?.rank === "A" &&
      !round.insuranceResolved &&
      !isBlackjack(round.playerHands[0].cards) &&
      (!userId || getBalance(userId, round.currency) >= insuranceBet),
  );
}

export function canOfferEvenMoney(round: BlackjackRound, config = blackjackConfig) {
  return Boolean(
    config.allowEvenMoney &&
      round.status === "PLAYER_TURN" &&
      round.dealerCards[0]?.rank === "A" &&
      !round.evenMoneyOffered &&
      isBlackjack(round.playerHands[0].cards),
  );
}

function syncCompat(round: BlackjackRound): BlackjackRound {
  return { ...round, playerCards: activeBlackjackHand(round)?.cards ?? round.playerHands[0]?.cards ?? [] };
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

function nextHandOrDealer(round: BlackjackRound, userId: string, config: BlackjackConfig) {
  const nextActive = round.playerHands.findIndex((hand, index) => index > round.activeHandIndex && hand.status === "ACTIVE");
  if (nextActive >= 0) return syncCompat({ ...round, activeHandIndex: nextActive });
  return playDealerAndSettle(round, userId, config);
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
  const hand: BlackjackHand = {
    id: createId("bjhand"),
    cards: [draw(deck), draw(deck)],
    betAmount,
    status: "ACTIVE",
  };
  const round = syncCompat({
    id: createId("bj"),
    status: "PLAYER_TURN",
    currency,
    betAmount,
    totalBet: betAmount,
    playerCards: hand.cards,
    playerHands: [hand],
    activeHandIndex: 0,
    dealerCards: [draw(deck), draw(deck)],
    dealerRevealed: false,
    deck,
  });

  if (isBlackjack(hand.cards) && round.dealerCards[0]?.rank !== "A") {
    return playDealerAndSettle(round, userId, config);
  }
  return round;
}

export function hitBlackjack(round: BlackjackRound, userId: string, config = blackjackConfig): BlackjackRound {
  if (round.status !== "PLAYER_TURN") return round;
  const hands = round.playerHands.map((hand, index) => {
    if (index !== round.activeHandIndex || hand.status !== "ACTIVE") return hand;
    const cards = [...hand.cards, draw(round.deck)];
    return { ...hand, cards, status: handValue(cards).total > 21 ? "BUST" as const : "ACTIVE" as const };
  });
  const next = syncCompat({ ...round, playerHands: hands });
  if (activeBlackjackHand(next)?.status === "BUST") return nextHandOrDealer(next, userId, config);
  return next;
}

export function standBlackjack(round: BlackjackRound, userId: string, config = blackjackConfig): BlackjackRound {
  if (round.status !== "PLAYER_TURN") return round;
  const hands = round.playerHands.map((hand, index) => (
    index === round.activeHandIndex ? { ...hand, status: "STOOD" as const } : hand
  ));
  return nextHandOrDealer(syncCompat({ ...round, playerHands: hands }), userId, config);
}

export function doubleDownBlackjack(round: BlackjackRound, userId: string, config = blackjackConfig): BlackjackRound {
  if (!canDoubleBlackjack(round, userId, config)) return round;
  const active = activeBlackjackHand(round);
  placeTableBet(userId, round.currency, active.betAmount, config, { action: "double_down", handId: active.id });
  const hands = round.playerHands.map((hand, index) => {
    if (index !== round.activeHandIndex) return hand;
    const cards = [...hand.cards, draw(round.deck)];
    return {
      ...hand,
      cards,
      betAmount: hand.betAmount * 2,
      doubled: true,
      status: handValue(cards).total > 21 ? "BUST" as const : "STOOD" as const,
    };
  });
  return nextHandOrDealer(syncCompat({ ...round, totalBet: round.totalBet + active.betAmount, playerHands: hands }), userId, config);
}

export function splitBlackjack(round: BlackjackRound, userId: string, config = blackjackConfig): BlackjackRound {
  if (!canSplitBlackjack(round, userId, config)) return round;
  const active = activeBlackjackHand(round);
  placeTableBet(userId, round.currency, active.betAmount, config, { action: "split", sourceHandId: active.id });
  const first: BlackjackHand = {
    ...active,
    id: createId("bjhand"),
    cards: [active.cards[0], draw(round.deck)],
    splitFromPair: true,
  };
  const second: BlackjackHand = {
    id: createId("bjhand"),
    cards: [active.cards[1], draw(round.deck)],
    betAmount: active.betAmount,
    status: "ACTIVE",
    splitFromPair: true,
  };
  const hands = [...round.playerHands];
  hands.splice(round.activeHandIndex, 1, first, second);
  return syncCompat({ ...round, totalBet: round.totalBet + active.betAmount, playerHands: hands });
}

export function resolveInsuranceBlackjack(
  round: BlackjackRound,
  userId: string,
  takeInsurance: boolean,
  config = blackjackConfig,
): BlackjackRound {
  if (!canOfferInsurance(round, config)) return round;
  let insuranceResult: TableSettlement | undefined;
  const insuranceBet = Math.floor(round.betAmount / 2);
  if (takeInsurance && insuranceBet > 0) {
    placeTableBet(userId, round.currency, insuranceBet, config, { action: "insurance" });
    if (isBlackjack(round.dealerCards)) {
      insuranceResult = settleTableResult({
        userId,
        currency: round.currency,
        config,
        result: "WIN",
        amountPaid: insuranceBet * 3,
        wagered: insuranceBet,
        metadata: { action: "insurance" },
      });
    } else {
      insuranceResult = settleTableResult({
        userId,
        currency: round.currency,
        config,
        result: "LOSS",
        amountPaid: 0,
        wagered: insuranceBet,
        metadata: { action: "insurance" },
      });
    }
  }
  const next = syncCompat({ ...round, insuranceBet: takeInsurance ? insuranceBet : 0, insuranceResolved: true, insuranceResult });
  if (isBlackjack(next.dealerCards)) return playDealerAndSettle(next, userId, config);
  return next;
}

export function acceptEvenMoneyBlackjack(round: BlackjackRound, userId: string, config = blackjackConfig): BlackjackRound {
  if (!canOfferEvenMoney(round, config)) return round;
  const settlement = settleTableResult({
    userId,
    currency: round.currency,
    config,
    result: "WIN",
    amountPaid: round.betAmount * 2,
    wagered: round.betAmount,
    metadata: { action: "even_money" },
  });
  const hand = { ...round.playerHands[0], status: "RESOLVED" as const, result: settlement };
  return syncCompat({
    ...round,
    status: "RESOLVED",
    dealerRevealed: true,
    evenMoneyOffered: true,
    playerHands: [hand],
    result: settlement,
  });
}

export function declineEvenMoneyBlackjack(round: BlackjackRound) {
  return { ...round, evenMoneyOffered: true };
}

function playDealerAndSettle(round: BlackjackRound, userId: string, config: BlackjackConfig) {
  const next = syncCompat({ ...round, status: "DEALER_TURN" as const, dealerRevealed: true });
  if (next.playerHands.some((hand) => hand.status !== "BUST")) {
    while (true) {
      maybeDealerAssist(next.deck, next.dealerCards, config);
      const dealer = handValue(next.dealerCards);
      if (dealer.total < 17 || (dealer.total === 17 && dealer.soft && config.dealerHitsSoft17)) {
        next.dealerCards = [...next.dealerCards, draw(next.deck)];
        continue;
      }
      break;
    }
  }
  return settleBlackjackRound(next, userId, config);
}

function settleHand(hand: BlackjackHand, round: BlackjackRound, userId: string, config: BlackjackConfig) {
  const playerTotal = handValue(hand.cards).total;
  const dealerTotal = handValue(round.dealerCards).total;
  let settlement: TableSettlement;
  if (playerTotal > 21) {
    settlement = settleTableResult({ userId, currency: round.currency, config, result: "LOSS", amountPaid: 0, wagered: hand.betAmount, metadata: { handId: hand.id } });
  } else if (dealerTotal > 21) {
    settlement = settleTableResult({ userId, currency: round.currency, config, result: "WIN", amountPaid: hand.betAmount * 2, wagered: hand.betAmount, metadata: { handId: hand.id } });
  } else if (isBlackjack(hand.cards) && isBlackjack(round.dealerCards)) {
    settlement = settleTableResult({ userId, currency: round.currency, config, result: "PUSH", amountPaid: hand.betAmount, wagered: hand.betAmount, metadata: { handId: hand.id } });
  } else if (isBlackjack(hand.cards)) {
    settlement = settleTableResult({
      userId,
      currency: round.currency,
      config,
      result: "WIN",
      amountPaid: hand.betAmount + hand.betAmount * config.blackjackPayout,
      wagered: hand.betAmount,
      metadata: { handId: hand.id, blackjack: true },
    });
  } else if (dealerTotal > playerTotal || isBlackjack(round.dealerCards)) {
    settlement = settleTableResult({ userId, currency: round.currency, config, result: "LOSS", amountPaid: 0, wagered: hand.betAmount, metadata: { handId: hand.id } });
  } else if (playerTotal === dealerTotal) {
    settlement = settleTableResult({ userId, currency: round.currency, config, result: "PUSH", amountPaid: hand.betAmount, wagered: hand.betAmount, metadata: { handId: hand.id } });
  } else {
    settlement = settleTableResult({ userId, currency: round.currency, config, result: "WIN", amountPaid: hand.betAmount * 2, wagered: hand.betAmount, metadata: { handId: hand.id } });
  }
  return { ...hand, status: "RESOLVED" as const, result: settlement };
}

export function settleBlackjackRound(round: BlackjackRound, userId: string, config = blackjackConfig): BlackjackRound {
  const playerHands = round.playerHands.map((hand) => settleHand(hand, round, userId, config));
  const amountPaid = playerHands.reduce((sum, hand) => sum + (hand.result?.amountPaid ?? 0), 0);
  const profit = playerHands.reduce((sum, hand) => sum + (hand.result?.profit ?? 0), 0);
  const result: TableSettlement = {
    result: profit > 0 ? "WIN" : profit === 0 ? "PUSH" : "LOSS",
    amountPaid,
    profit,
    transactions: playerHands.flatMap((hand) => hand.result?.transactions ?? []),
    message: profit > 0 ? `Blackjack paid ${amountPaid}` : profit === 0 ? "Blackjack push." : "Dealer wins.",
  };
  return syncCompat({ ...round, status: "RESOLVED", dealerRevealed: true, playerHands, result });
}
