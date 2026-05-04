import { creditCurrency, getBalance, getTransactions } from "../wallet/walletService";
import type { CasinoData, User } from "../types";
import {
  balloonPopConfig,
  completeBalloonPopRound,
  popBalloon,
  revealLeftoverBalloons,
  simulateBalloonPop,
  startBalloonPopRound,
  pickBalloonPrize,
  type BalloonPopConfig,
  type BalloonPopRound,
  type BalloonPrizeKind,
} from "./balloonPopEngine";

const memory: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (key) => memory[key] ?? null,
  setItem: (key, value) => {
    memory[key] = value;
  },
  removeItem: (key) => {
    delete memory[key];
  },
  clear: () => {
    Object.keys(memory).forEach((key) => delete memory[key]);
  },
  key: (index) => Object.keys(memory)[index] ?? null,
  get length() {
    return Object.keys(memory).length;
  },
} as Storage;

const user: User = {
  id: "balloon-test-user",
  email: "balloon@test.local",
  username: "BalloonTest",
  createdAt: new Date().toISOString(),
  lastLoginAt: new Date().toISOString(),
  roles: ["USER"],
  accountStatus: "ACTIVE",
};

const seed: Partial<CasinoData> = {
  users: [user],
  passwordRecords: {},
  sessions: [],
  walletBalances: {},
  transactions: [],
  progression: {},
  streaks: {},
  missions: {},
  favorites: {},
};
localStorage.setItem("casino-prototype-data-v1", JSON.stringify(seed));
creditCurrency({ userId: user.id, type: "ADMIN_ADJUSTMENT", currency: "GOLD", amount: 100000 });
creditCurrency({ userId: user.id, type: "ADMIN_ADJUSTMENT", currency: "BONUS", amount: 100000 });

const lowestDefaultPrize = pickBalloonPrize(() => 0);
if (balloonPopConfig.blankChance !== 0 || lowestDefaultPrize.kind === "blank" || lowestDefaultPrize.multiplier !== 0.1) {
  throw new Error("Expected default Balloon Pop math to have no blanks and a 0.1x minimum prize.");
}

function testPrize(kind: BalloonPrizeKind, multiplier: number, label = `${multiplier}x`) {
  return { kind, multiplier, label };
}

function withBalloons(round: BalloonPopRound, prizes: ReturnType<typeof testPrize>[]) {
  return {
    ...round,
    balloons: round.balloons.map((balloon, index) => ({
      ...balloon,
      prize: prizes[index] ?? testPrize("blank", 0, "BLANK"),
      popped: false,
      revealed: false,
      paidAmount: 0,
    })),
  };
}

const betCountBefore = getTransactions(user.id).filter((tx) => tx.type === "ARCADE_BET").length;
const winCountBefore = getTransactions(user.id).filter((tx) => tx.type === "ARCADE_WIN").length;
const goldBefore = getBalance(user.id, "GOLD");
let round = startBalloonPopRound({ userId: user.id, currency: "GOLD", betAmount: 100, random: () => 0.99 });
round = withBalloons(round, [
  testPrize("coin", 0.5),
  testPrize("blank", 0, "BLANK"),
  testPrize("bonus", 1.25, "BONUS 1.25x"),
  testPrize("multiplier", 2, "2x"),
]);

if (getBalance(user.id, "GOLD") !== goldBefore - 100) {
  throw new Error("Expected Balloon Pop Play to debit the bet once.");
}
if (getTransactions(user.id).filter((tx) => tx.type === "ARCADE_BET").length !== betCountBefore + 1) {
  throw new Error("Expected Balloon Pop Play to create one ARCADE_BET.");
}
if (getTransactions(user.id).filter((tx) => tx.type === "ARCADE_WIN").length !== winCountBefore) {
  throw new Error("Expected Balloon Pop to delay payout credit until round completion.");
}

const firstPop = popBalloon(round, 0);
if (firstPop.shotsRemaining !== 2 || firstPop.balloons[0].paidAmount !== 50 || !firstPop.balloons[0].revealed) {
  throw new Error("Expected first Balloon Pop dart to reveal and add a fixed prize.");
}
try {
  popBalloon(firstPop, 0);
  throw new Error("Expected popped balloon to be blocked.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("already popped")) throw error;
}

const secondPop = popBalloon(firstPop, 1);
if (secondPop.shotsRemaining !== 1 || secondPop.runningTotal !== 50) {
  throw new Error("Expected blank Balloon Pop dart to use a shot without changing winnings.");
}
const thirdPop = popBalloon(secondPop, 2);
if (thirdPop.shotsRemaining !== 0 || thirdPop.state !== "reveal" || thirdPop.runningTotal !== 175) {
  throw new Error("Expected Balloon Pop to allow exactly three shots and then enter reveal.");
}
try {
  popBalloon(thirdPop, 3);
  throw new Error("Expected fourth Balloon Pop dart to be blocked.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("not accepting")) throw error;
}
if (getTransactions(user.id).filter((tx) => tx.type === "ARCADE_WIN").length !== winCountBefore) {
  throw new Error("Expected Balloon Pop to still have no payout before completion.");
}

const revealed = revealLeftoverBalloons(thirdPop);
if (revealed.balloons.some((balloon) => !balloon.revealed)) {
  throw new Error("Expected Balloon Pop leftover values to reveal after three shots.");
}
const completed = completeBalloonPopRound({ round: revealed, userId: user.id });
if (completed.state !== "complete" || completed.totalPaid !== 175 || completed.net !== 75) {
  throw new Error("Expected Balloon Pop completion to preserve total won and net result.");
}
if (getBalance(user.id, "GOLD") !== goldBefore - 100 + 175) {
  throw new Error("Expected Balloon Pop payout to credit wallet at completion.");
}
if (getTransactions(user.id).filter((tx) => tx.type === "ARCADE_WIN").length !== winCountBefore + 1) {
  throw new Error("Expected Balloon Pop completion to create one ARCADE_WIN.");
}

const multiplierRoundStart = startBalloonPopRound({ userId: user.id, currency: "BONUS", betAmount: 100, random: () => 0.99 });
let multiplierRound = withBalloons(multiplierRoundStart, [
  testPrize("coin", 1),
  testPrize("multiplier", 2, "2x"),
  testPrize("blank", 0, "BLANK"),
]);
multiplierRound = popBalloon(multiplierRound, 0);
multiplierRound = popBalloon(multiplierRound, 1);
if (multiplierRound.runningTotal !== 300 || multiplierRound.balloons[1].paidAmount !== 200) {
  throw new Error("Expected Balloon Pop multiplier to apply to the bet.");
}

const capConfig: BalloonPopConfig = { ...balloonPopConfig, maxWinMultiplier: 2 };
let cappedRound = startBalloonPopRound({ userId: user.id, currency: "GOLD", betAmount: 100, random: () => 0.99, config: capConfig });
cappedRound = withBalloons(cappedRound, [
  testPrize("coin", 5),
  testPrize("coin", 5),
  testPrize("coin", 5),
]);
cappedRound = popBalloon(cappedRound, 0, capConfig);
cappedRound = popBalloon(cappedRound, 1, capConfig);
cappedRound = popBalloon(cappedRound, 2, capConfig);
if (cappedRound.totalPaid !== 200 || !cappedRound.capped) {
  throw new Error("Expected Balloon Pop max payout cap to limit paid winnings.");
}

const lowUser = "low-balloon-user";
creditCurrency({ userId: lowUser, type: "ADMIN_ADJUSTMENT", currency: "GOLD", amount: balloonPopConfig.minBet - 1 });
try {
  startBalloonPopRound({ userId: lowUser, currency: "GOLD", betAmount: balloonPopConfig.minBet });
  throw new Error("Expected Balloon Pop to block insufficient balance.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("Insufficient")) throw error;
}

const sim = simulateBalloonPop(100000);
if (sim.observedRtp > 0.95 || balloonPopConfig.targetRtp > 0.95) {
  throw new Error(`Expected Balloon Pop RTP to stay under 95%, observed ${(sim.observedRtp * 100).toFixed(2)}%.`);
}
if (!Number.isFinite(sim.averagePayout) || !Number.isFinite(sim.blankRate) || !Number.isFinite(sim.maxCapHitRate)) {
  throw new Error("Expected Balloon Pop simulation to expose admin stats.");
}

console.log("balloonPop.devtest passed");
