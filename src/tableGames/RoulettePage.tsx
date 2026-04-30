import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastContext";
import { formatCoins } from "../lib/format";
import type { Currency } from "../types";
import { getBalance } from "../wallet/walletService";
import { rouletteConfig } from "./configs";
import {
  americanWheel,
  getRouletteColor,
  resolveRouletteBets,
  rouletteBetLabel,
  rouletteBetWins,
  type PlacedRouletteBet,
} from "./rouletteEngine";
import type { RouletteBet, RouletteResult } from "./types";

const redNumbers = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const boardRows = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
];
const goldChips = [1, 5, 10, 25, 100, 500, 1000];
const bonusChips = [0.1, 0.2, 0.5, 1, 5, 10, 20, 50, 100];

export const rouletteUiMarkers = {
  americanBoard: true,
  multipleActiveBets: true,
  cssChips: true,
  animatedWheel: true,
  advancedInsideBets: true,
};

export function RoulettePage({ onExit }: { onExit?: () => void }) {
  const { user } = useAuth();
  const notify = useToast();
  const [currency, setCurrency] = useState<Currency>("GOLD");
  const [selectedChip, setSelectedChip] = useState(25);
  const [bets, setBets] = useState<PlacedRouletteBet[]>([]);
  const [lastBets, setLastBets] = useState<PlacedRouletteBet[]>([]);
  const [advancedSelection, setAdvancedSelection] = useState<Array<"0" | "00" | number>>([]);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [result, setResult] = useState<RouletteResult | null>(null);
  const [spinning, setSpinning] = useState(false);
  if (!user) return null;
  const currentUser = user;

  const chips = currency === "GOLD" ? goldChips : bonusChips;
  const balance = getBalance(currentUser.id, currency);
  const totalBet = bets.reduce((sum, bet) => sum + bet.amount, 0);
  const canSpin = bets.length > 0 && totalBet <= balance && totalBet <= rouletteConfig.maxTotalBetGold && !spinning;
  const winningNumber = result?.outcome;
  const winningIds = new Set(result?.winningBetIds ?? []);

  const groupedBets = useMemo(() => bets.slice(-5).reverse(), [bets]);

  function placeBet(bet: RouletteBet) {
    if (spinning) return;
    const projected = totalBet + selectedChip;
    if (projected > balance) {
      notify("Insufficient balance for that roulette bet.", "error");
      return;
    }
    if (projected > rouletteConfig.maxTotalBetGold) {
      notify(`Maximum total roulette bet is ${formatCoins(rouletteConfig.maxTotalBetGold)}.`, "error");
      return;
    }
    setBets((current) => [...current, { id: crypto.randomUUID(), bet, amount: selectedChip, label: rouletteBetLabel(bet) }]);
    setResult(null);
  }

  function undoLastBet() {
    if (!spinning) setBets((current) => current.slice(0, -1));
  }

  function clearBets() {
    if (!spinning) setBets([]);
  }

  function rebet() {
    if (spinning || lastBets.length === 0) return;
    const total = lastBets.reduce((sum, bet) => sum + bet.amount, 0);
    if (total > balance) {
      notify("Insufficient balance to rebet.", "error");
      return;
    }
    setBets(lastBets.map((bet) => ({ ...bet, id: crypto.randomUUID() })));
  }

  function toggleAdvanced(number: "0" | "00" | number) {
    if (!advancedMode) return;
    setAdvancedSelection((current) => (
      current.includes(number) ? current.filter((value) => value !== number) : [...current, number].slice(-6)
    ));
  }

  function advancedBet(): RouletteBet | null {
    const sorted = [...advancedSelection].sort((a, b) => {
      const av = a === "0" ? 0 : a === "00" ? -1 : a;
      const bv = b === "0" ? 0 : b === "00" ? -1 : b;
      return av - bv;
    });
    if (sorted.length === 1) return { kind: "straight", value: sorted[0] };
    if (sorted.length === 2 && isValidSplit(sorted)) return { kind: "split", numbers: sorted };
    if (sorted.length === 3 && isValidStreet(sorted)) return { kind: "street", numbers: sorted as number[] };
    if (sorted.length === 4 && isValidCorner(sorted)) return { kind: "corner", numbers: sorted as number[] };
    if (sorted.length === 5 && sorted.includes("0") && sorted.includes("00")) return { kind: "basket", numbers: sorted };
    if (sorted.length === 6 && isValidSixLine(sorted)) return { kind: "sixLine", numbers: sorted as number[] };
    return null;
  }

  function confirmAdvancedBet() {
    const built = advancedBet();
    if (!built) {
      notify("Select 1, 2, 3, 4, or 6 valid numbers for an inside bet.", "error");
      return;
    }
    placeBet(built);
    setAdvancedSelection([]);
  }

  function spin() {
    if (!canSpin) return;
    setSpinning(true);
    const outcome = americanWheel[Math.floor(Math.random() * americanWheel.length)];
    window.setTimeout(() => {
      try {
        const next = resolveRouletteBets({ userId: currentUser.id, currency, bets, outcome });
        setResult(next);
        setLastBets(bets);
        setBets([]);
      } catch (caught) {
        notify(caught instanceof Error ? caught.message : "Roulette spin failed.", "error");
      } finally {
        setSpinning(false);
      }
    }, 1800);
  }

  return (
    <section className="roulette-clean-page">
      <header className="roulette-clean-header">
        <button className="roulette-back" onClick={onExit} aria-label="Back to table games">‹</button>
        <div className="roulette-title">
          <h1>Roulette <span aria-hidden="true">◉</span></h1>
          <small>American Roulette · Virtual Coins Only</small>
        </div>
        <div className="roulette-currency-tabs">
          <button className={currency === "GOLD" ? "active" : ""} disabled={spinning} onClick={() => { setCurrency("GOLD"); setSelectedChip(25); }}>Gold</button>
          <button className={currency === "BONUS" ? "active" : ""} disabled={spinning} onClick={() => { setCurrency("BONUS"); setSelectedChip(1); }}>Bonus</button>
        </div>
      </header>

      <section className="roulette-layout">
        <div className={spinning ? "roulette-wheel-stage spinning" : "roulette-wheel-stage"}>
          <div className="roulette-wheel-visual">
            <div className="roulette-ball" />
            <span>{spinning ? "..." : result?.outcome ?? "Spin"}</span>
          </div>
          {result && (
            <div className={`roulette-result-banner ${result.color}`}>
              <strong>Winning Number: {result.outcome} {result.color}</strong>
              <span>Total Won: {formatCoins(result.totalPaid)} · Net: {(result.net ?? 0) >= 0 ? "+" : ""}{formatCoins(result.net ?? 0)}</span>
            </div>
          )}
        </div>

        <div className="roulette-board-wrap">
          <div className="roulette-board">
            <button className={`zero ${winningNumber === "0" ? "winner" : ""} ${advancedSelection.includes("0") ? "selected" : ""}`} onClick={() => advancedMode ? toggleAdvanced("0") : placeBet({ kind: "straight", value: "0" })}>
              0
              <ChipStack bets={bets.filter((placed) => placed.bet.kind === "straight" && placed.bet.value === "0")} winningIds={winningIds} />
            </button>
            <button className={`double-zero ${winningNumber === "00" ? "winner" : ""} ${advancedSelection.includes("00") ? "selected" : ""}`} onClick={() => advancedMode ? toggleAdvanced("00") : placeBet({ kind: "straight", value: "00" })}>
              00
              <ChipStack bets={bets.filter((placed) => placed.bet.kind === "straight" && placed.bet.value === "00")} winningIds={winningIds} />
            </button>
            <div className="number-grid">
              {boardRows.map((row) => row.map((number) => (
              <button
                  key={number}
                  className={`${redNumbers.has(number) ? "red" : "black"} ${winningNumber === number ? "winner" : ""} ${advancedSelection.includes(number) ? "selected" : ""}`}
                  onClick={() => advancedMode ? toggleAdvanced(number) : placeBet({ kind: "straight", value: number })}
                  onDoubleClick={() => toggleAdvanced(number)}
                >
                  {number}
                  <ChipStack bets={bets.filter((placed) => placed.bet.kind === "straight" && placed.bet.value === number)} winningIds={winningIds} />
                </button>
              )))}
            </div>
            <div className="column-bets">
              {[1, 2, 3].map((column) => <button key={column} onClick={() => placeBet({ kind: "column", value: column as 1 | 2 | 3 })}>2 to 1</button>)}
            </div>
            <div className="dozen-bets">
              {[1, 2, 3].map((dozen) => <button key={dozen} onClick={() => placeBet({ kind: "dozen", value: dozen as 1 | 2 | 3 })}>{dozen === 1 ? "1st" : dozen === 2 ? "2nd" : "3rd"} 12</button>)}
            </div>
            <div className="outside-bets">
              <button onClick={() => placeBet({ kind: "range", value: "low" })}>1-18</button>
              <button onClick={() => placeBet({ kind: "parity", value: "even" })}>Even</button>
              <button className="red" onClick={() => placeBet({ kind: "color", value: "red" })}>Red</button>
              <button className="black" onClick={() => placeBet({ kind: "color", value: "black" })}>Black</button>
              <button onClick={() => placeBet({ kind: "parity", value: "odd" })}>Odd</button>
              <button onClick={() => placeBet({ kind: "range", value: "high" })}>19-36</button>
            </div>
          </div>
        </div>

        <div className="roulette-advanced">
          <button className={advancedMode ? "active" : ""} onClick={() => { setAdvancedMode((value) => !value); setAdvancedSelection([]); }}>
            Advanced
          </button>
          <button onClick={() => advancedMode ? toggleAdvanced("0") : placeBet({ kind: "straight", value: "0" })}>0</button>
          <button onClick={() => advancedMode ? toggleAdvanced("00") : placeBet({ kind: "straight", value: "00" })}>00</button>
          <span>{advancedMode ? advancedSelection.join(", ") || "Tap board numbers" : "Tap numbers for straights"}</span>
          <button onClick={confirmAdvancedBet}>Place Inside</button>
          <button onClick={() => setAdvancedSelection([])}>Clear</button>
        </div>

        <aside className="roulette-bets-panel">
          <div className="roulette-stats">
            <span>Balance <strong>{formatCoins(balance)}</strong></span>
            <span>Total Bet <strong>{formatCoins(totalBet)}</strong></span>
            <span>Min {rouletteConfig.minBet} / Max {rouletteConfig.maxTotalBetGold}</span>
          </div>
          <div className="roulette-chip-row">
            {chips.map((chip) => (
              <button key={chip} className={selectedChip === chip ? "roulette-chip active" : "roulette-chip"} onClick={() => setSelectedChip(chip)}>
                {chip}
              </button>
            ))}
          </div>
          <div className="roulette-actions">
            <button onClick={undoLastBet}>Undo</button>
            <button onClick={clearBets}>Clear</button>
            <button onClick={rebet}>Rebet</button>
          </div>
          <div className="roulette-active-bets">
            {groupedBets.length === 0 ? <span>No active bets.</span> : groupedBets.map((bet) => (
              <div key={bet.id} className={winningIds.has(bet.id) ? "win" : ""}>
                <span>{bet.label}</span>
                <strong>{formatCoins(bet.amount)}</strong>
              </div>
            ))}
          </div>
          <button className="roulette-spin" disabled={!canSpin} onClick={spin}>{spinning ? "Spinning..." : "Spin"}</button>
        </aside>
      </section>
    </section>
  );
}

function ChipStack({ bets, winningIds }: { bets: PlacedRouletteBet[]; winningIds: Set<string> }) {
  if (bets.length === 0) return null;
  const total = bets.reduce((sum, bet) => sum + bet.amount, 0);
  return <span className={bets.some((bet) => winningIds.has(bet.id)) ? "board-chip win" : "board-chip"}>{total}</span>;
}

function numberColumn(number: number) {
  return ((number - 1) % 3) + 1;
}

function numberStreetStart(number: number) {
  return number - ((number - 1) % 3);
}

function isValidSplit(numbers: Array<"0" | "00" | number>) {
  if (numbers.includes("0") && numbers.includes("00")) return true;
  if (!numbers.every((number) => typeof number === "number")) return false;
  const [a, b] = numbers as number[];
  return Math.abs(a - b) === 3 || (Math.abs(a - b) === 1 && numberStreetStart(a) === numberStreetStart(b));
}

function isValidStreet(numbers: Array<"0" | "00" | number>) {
  if (!numbers.every((number) => typeof number === "number")) return false;
  const nums = numbers as number[];
  const start = numberStreetStart(nums[0]);
  return nums.length === 3 && nums.every((number) => numberStreetStart(number) === start);
}

function isValidCorner(numbers: Array<"0" | "00" | number>) {
  if (!numbers.every((number) => typeof number === "number")) return false;
  const nums = numbers as number[];
  const min = Math.min(...nums);
  const candidates = [min, min + 1, min + 3, min + 4].sort((a, b) => a - b);
  return numberColumn(min) < 3 && JSON.stringify(nums) === JSON.stringify(candidates);
}

function isValidSixLine(numbers: Array<"0" | "00" | number>) {
  if (!numbers.every((number) => typeof number === "number")) return false;
  const nums = numbers as number[];
  const start = numberStreetStart(Math.min(...nums));
  const candidates = [start, start + 1, start + 2, start + 3, start + 4, start + 5].sort((a, b) => a - b);
  return start <= 31 && JSON.stringify(nums) === JSON.stringify(candidates);
}
