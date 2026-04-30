import { useMemo, useState, type CSSProperties } from "react";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastContext";
import { formatCoins } from "../lib/format";
import type { Currency } from "../types";
import { getBalance } from "../wallet/walletService";
import { rouletteConfig } from "./configs";
import {
  americanWheel,
  getRouletteColor,
  getRouletteWinningZones,
  resolveRouletteBets,
  rouletteBetKey,
  rouletteBetLabel,
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
  landscapeTable: true,
  chipFan: true,
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
  const [chipFanOpen, setChipFanOpen] = useState(false);
  const [result, setResult] = useState<RouletteResult | null>(null);
  const [spinning, setSpinning] = useState(false);
  if (!user) return null;
  const currentUser = user;

  const chips = currency === "GOLD" ? goldChips : bonusChips;
  const balance = getBalance(currentUser.id, currency);
  const totalBet = bets.reduce((sum, bet) => sum + bet.amount, 0);
  const canSpin = bets.length > 0 && totalBet <= balance && totalBet <= rouletteConfig.maxTotalBetGold && !spinning;
  const winningIds = new Set(result?.winningBetIds ?? []);
  const winningZoneKeys = new Set(result ? getRouletteWinningZones(result.outcome).map(rouletteBetKey) : []);
  const groupedBets = useMemo(() => bets.slice(-4).reverse(), [bets]);

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
    setChipFanOpen(false);
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
    setResult(null);
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
      notify("Select a valid split, street, corner, six-line, or basket group.", "error");
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
    }, 2400);
  }

  return (
    <section className="roulette-clean-page" onClick={() => chipFanOpen && setChipFanOpen(false)}>
      <div className="roulette-rotate-prompt">
        <strong>Rotate for Roulette</strong>
        <span>The full American roulette table is designed for landscape play.</span>
      </div>

      <header className="roulette-clean-header">
        <button className="roulette-back" onClick={onExit} aria-label="Back to table games">‹</button>
        <div className="roulette-title">
          <h1>Roulette <span aria-hidden="true">◉</span></h1>
          <small>American Roulette · Virtual Coins Only</small>
        </div>
        <div className="roulette-header-balance">
          <span>Balance</span>
          <strong>{formatCoins(balance)}</strong>
        </div>
        <div className="roulette-currency-tabs">
          <button className={currency === "GOLD" ? "active" : ""} disabled={spinning} onClick={() => { setCurrency("GOLD"); setSelectedChip(25); }}>Gold</button>
          <button className={currency === "BONUS" ? "active" : ""} disabled={spinning} onClick={() => { setCurrency("BONUS"); setSelectedChip(1); }}>Bonus</button>
        </div>
      </header>

      <section className={spinning ? "roulette-layout roulette-focus-wheel" : "roulette-layout"}>
        <div className="roulette-side-actions">
          <button onClick={undoLastBet}>↶<span>Undo</span></button>
          <button onClick={clearBets}>×<span>Clear</span></button>
          <button onClick={rebet}>↻<span>Rebet</span></button>
          <button className={advancedMode ? "active" : ""} onClick={() => { setAdvancedMode((value) => !value); setAdvancedSelection([]); }}>＋<span>Inside</span></button>
        </div>

        <div className="roulette-board-wrap">
          <div className="roulette-board">
            <button className={`zero ${result?.outcome === "0" ? "winner" : ""} ${advancedSelection.includes("0") ? "selected" : ""}`} onClick={() => advancedMode ? toggleAdvanced("0") : placeBet({ kind: "straight", value: "0" })}>
              0
              <ChipStack bets={bets.filter((placed) => rouletteBetKey(placed.bet) === "straight:0")} winningIds={winningIds} />
            </button>
            <button className={`double-zero ${result?.outcome === "00" ? "winner" : ""} ${advancedSelection.includes("00") ? "selected" : ""}`} onClick={() => advancedMode ? toggleAdvanced("00") : placeBet({ kind: "straight", value: "00" })}>
              00
              <ChipStack bets={bets.filter((placed) => rouletteBetKey(placed.bet) === "straight:00")} winningIds={winningIds} />
            </button>
            <div className="number-grid">
              {boardRows.map((row) => row.map((number) => (
                <button
                  key={number}
                  className={`${redNumbers.has(number) ? "red" : "black"} ${result?.outcome === number ? "winner" : ""} ${advancedSelection.includes(number) ? "selected" : ""}`}
                  onClick={() => advancedMode ? toggleAdvanced(number) : placeBet({ kind: "straight", value: number })}
                >
                  {number}
                  <ChipStack bets={bets.filter((placed) => rouletteBetKey(placed.bet) === `straight:${number}`)} winningIds={winningIds} />
                </button>
              )))}
              <InsideChipLayer bets={bets.filter((placed) => "numbers" in placed.bet && placed.bet.kind !== "basket")} winningIds={winningIds} />
              <InsideHitAreas onBet={placeBet} />
            </div>
            <div className="column-bets">
              {[1, 2, 3].map((column) => {
                const bet = { kind: "column", value: column as 1 | 2 | 3 } satisfies RouletteBet;
                return <button key={column} className={winningZoneKeys.has(rouletteBetKey(bet)) ? "winner" : ""} onClick={() => placeBet(bet)}>2 to 1<ChipStack bets={bets.filter((placed) => rouletteBetKey(placed.bet) === rouletteBetKey(bet))} winningIds={winningIds} /></button>;
              })}
            </div>
            <div className="dozen-bets">
              {[1, 2, 3].map((dozen) => {
                const bet = { kind: "dozen", value: dozen as 1 | 2 | 3 } satisfies RouletteBet;
                return <button key={dozen} className={winningZoneKeys.has(rouletteBetKey(bet)) ? "winner" : ""} onClick={() => placeBet(bet)}>{dozen === 1 ? "1st" : dozen === 2 ? "2nd" : "3rd"} 12<ChipStack bets={bets.filter((placed) => rouletteBetKey(placed.bet) === rouletteBetKey(bet))} winningIds={winningIds} /></button>;
              })}
            </div>
            <div className="outside-bets">
              {outsideBets.map(({ label, bet, className }) => (
                <button key={label} className={`${className ?? ""} ${winningZoneKeys.has(rouletteBetKey(bet)) ? "winner" : ""}`} onClick={() => placeBet(bet)}>{label}<ChipStack bets={bets.filter((placed) => rouletteBetKey(placed.bet) === rouletteBetKey(bet))} winningIds={winningIds} /></button>
              ))}
            </div>
          </div>
        </div>

        <div className="roulette-advanced">
          <button className={advancedMode ? "active" : ""} onClick={() => { setAdvancedMode((value) => !value); setAdvancedSelection([]); }}>Inside</button>
          <button onClick={() => advancedMode ? toggleAdvanced("0") : placeBet({ kind: "straight", value: "0" })}>0</button>
          <button onClick={() => advancedMode ? toggleAdvanced("00") : placeBet({ kind: "straight", value: "00" })}>00</button>
          <span>{advancedMode ? advancedSelection.join(", ") || "Tap board numbers" : "Tap borders for splits/corners or use Inside"}</span>
          <button onClick={confirmAdvancedBet}>Place</button>
          <button onClick={() => setAdvancedSelection([])}>Clear</button>
        </div>

        <aside className="roulette-bets-panel">
          <div className="roulette-stats">
            <span>Total Bet <strong>{formatCoins(totalBet)}</strong></span>
            <span>Min {rouletteConfig.minBet} / Max {rouletteConfig.maxTotalBetGold}</span>
          </div>
          <div className={chipFanOpen ? "roulette-chip-selector open" : "roulette-chip-selector"} onClick={(event) => event.stopPropagation()}>
            <button className="roulette-chip active selected-chip" onClick={() => setChipFanOpen((value) => !value)}>{selectedChip}</button>
            <div className="roulette-chip-fan">
              {chips.filter((chip) => chip !== selectedChip).map((chip, index) => (
                <button
                  key={chip}
                  className="roulette-chip"
                  style={{ "--chip-index": index } as CSSProperties}
                  onClick={() => { setSelectedChip(chip); setChipFanOpen(false); }}
                >
                  {chip}
                </button>
              ))}
            </div>
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

        <div className={spinning ? "roulette-wheel-stage spinning" : "roulette-wheel-stage"}>
          <div className="roulette-wheel-visual">
            <div className="roulette-ball" />
            <span>{spinning ? "..." : result?.outcome ?? "Spin"}</span>
          </div>
          {result && (
            <div className={`roulette-result-banner ${result.color}`}>
              <strong>{result.outcome} {result.color}</strong>
              <span>Won {formatCoins(result.totalPaid)} · Net {(result.net ?? 0) >= 0 ? "+" : ""}{formatCoins(result.net ?? 0)}</span>
            </div>
          )}
        </div>
      </section>
    </section>
  );
}

const outsideBets: Array<{ label: string; bet: RouletteBet; className?: string }> = [
  { label: "1-18", bet: { kind: "range", value: "low" } },
  { label: "Even", bet: { kind: "parity", value: "even" } },
  { label: "Red", bet: { kind: "color", value: "red" }, className: "red" },
  { label: "Black", bet: { kind: "color", value: "black" }, className: "black" },
  { label: "Odd", bet: { kind: "parity", value: "odd" } },
  { label: "19-36", bet: { kind: "range", value: "high" } },
];

function ChipStack({ bets, winningIds }: { bets: PlacedRouletteBet[]; winningIds: Set<string> }) {
  if (bets.length === 0) return null;
  const total = bets.reduce((sum, bet) => sum + bet.amount, 0);
  return <span className={bets.some((bet) => winningIds.has(bet.id)) ? "board-chip win" : "board-chip"}>{total}</span>;
}

function InsideHitAreas({ onBet }: { onBet: (bet: RouletteBet) => void }) {
  const areas: Array<{ key: string; bet: RouletteBet; style: CSSProperties }> = [];
  for (let street = 1; street <= 34; street += 3) {
    const streetIndex = (street - 1) / 3;
    areas.push({ key: `street-${street}`, bet: { kind: "street", numbers: [street, street + 1, street + 2] }, style: { left: `${streetIndex * (100 / 12)}%`, top: "100%", width: `${100 / 12}%`, height: "18%" } });
    if (street < 34) {
      areas.push({ key: `six-${street}`, bet: { kind: "sixLine", numbers: [street, street + 1, street + 2, street + 3, street + 4, street + 5] }, style: { left: `${(streetIndex + 1) * (100 / 12) - 1.4}%`, top: "100%", width: "2.8%", height: "18%" } });
    }
  }
  for (let column = 0; column < 12; column += 1) {
    for (let row = 0; row < 3; row += 1) {
      const number = boardRows[row][column];
      if (column < 11) areas.push({ key: `split-h-${number}`, bet: { kind: "split", numbers: [number, boardRows[row][column + 1]] }, style: { left: `${(column + 1) * (100 / 12) - 1.4}%`, top: `${row * (100 / 3)}%`, width: "2.8%", height: `${100 / 3}%` } });
      if (row < 2) areas.push({ key: `split-v-${number}`, bet: { kind: "split", numbers: [number, boardRows[row + 1][column]] }, style: { left: `${column * (100 / 12)}%`, top: `${(row + 1) * (100 / 3) - 2}%`, width: `${100 / 12}%`, height: "4%" } });
      if (column < 11 && row < 2) areas.push({ key: `corner-${number}`, bet: { kind: "corner", numbers: [number, boardRows[row][column + 1], boardRows[row + 1][column], boardRows[row + 1][column + 1]] }, style: { left: `${(column + 1) * (100 / 12) - 1.8}%`, top: `${(row + 1) * (100 / 3) - 2.4}%`, width: "3.6%", height: "4.8%" } });
    }
  }
  return <div className="roulette-hit-layer">{areas.map((area) => <button key={area.key} style={area.style} aria-label={rouletteBetLabel(area.bet)} onClick={() => onBet(area.bet)} />)}</div>;
}

function InsideChipLayer({ bets, winningIds }: { bets: PlacedRouletteBet[]; winningIds: Set<string> }) {
  return (
    <div className="inside-chip-layer">
      {bets.map((bet) => {
        const position = insideChipPosition(bet.bet);
        if (!position) return null;
        return <span key={bet.id} className={winningIds.has(bet.id) ? "board-chip inside win" : "board-chip inside"} style={{ left: `${position.left}%`, top: `${position.top}%` }}>{bet.amount}</span>;
      })}
    </div>
  );
}

function insideChipPosition(bet: RouletteBet) {
  if (!("numbers" in bet) || bet.kind === "basket") return null;
  const nums: number[] = [];
  bet.numbers.forEach((value) => {
    if (typeof value === "number") nums.push(value);
  });
  if (nums.length === 0) return null;
  const points = nums.map((number) => {
    const streetIndex = Math.floor((number - 1) / 3);
    const rowIndex = boardRows.findIndex((row) => row.includes(number));
    return { left: (streetIndex + 0.5) * (100 / 12), top: (rowIndex + 0.5) * (100 / 3) };
  });
  return {
    left: points.reduce((sum, point) => sum + point.left, 0) / points.length,
    top: points.reduce((sum, point) => sum + point.top, 0) / points.length,
  };
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
