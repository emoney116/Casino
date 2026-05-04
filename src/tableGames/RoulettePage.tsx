import { useMemo, useState, type CSSProperties } from "react";
import { Repeat2, RotateCcw, Trash2 } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastContext";
import { formatCoins } from "../lib/format";
import { recordRetentionRound } from "../retention/retentionService";
import type { Currency } from "../types";
import { getBalance } from "../wallet/walletService";
import { GameResultBanner, ScreenShake, SoundToggle } from "../feedback/components";
import { playBet, playError, playLose, playSpin, playWin } from "../feedback/feedbackService";
import { rouletteConfig } from "./configs";
import { COMPLIANCE_COPY } from "../lib/compliance";
import {
  americanWheel,
  getRouletteColor,
  getRouletteInsideChipPosition,
  getRouletteWinningZones,
  resolveRouletteBets,
  rouletteBetKey,
  rouletteBetLabel,
  rouletteBoardRows,
  type PlacedRouletteBet,
} from "./rouletteEngine";
import type { RouletteBet, RouletteResult } from "./types";

const redNumbers = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const boardRows = rouletteBoardRows;
const goldChips = [1, 5, 10, 25, 100, 500];
const bonusChips = [0.1, 0.2, 0.5, 1, 5, 10, 20, 50, 100];
const ROULETTE_SPIN_MS = 3600;

export const rouletteUiMarkers = {
  americanBoard: true,
  multipleActiveBets: true,
  cssChips: true,
  animatedWheel: true,
  advancedInsideBets: true,
  landscapeTable: true,
  compactChipRow: true,
  insideHelperRowRemoved: true,
  zeroDoubleZeroBalanced: true,
  doubleBetsAction: true,
  sequencedAmericanWheel: true,
  selectedChipPopover: true,
  lastFiveResults: true,
  streetBetSidePanel: true,
  wheelInBottomDeck: true,
  sharedResultBanner: true,
  sharedSoundToggle: true,
  winningBetGlow: true,
};

export function RoulettePage({ onExit }: { onExit?: () => void }) {
  const { user, refreshUser } = useAuth();
  const notify = useToast();
  const [currency, setCurrency] = useState<Currency>("GOLD");
  const [selectedChip, setSelectedChip] = useState(25);
  const [bets, setBets] = useState<PlacedRouletteBet[]>([]);
  const [lastBets, setLastBets] = useState<PlacedRouletteBet[]>([]);
  const [advancedSelection, setAdvancedSelection] = useState<Array<"0" | "00" | number>>([]);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [chipMenuOpen, setChipMenuOpen] = useState(false);
  const [result, setResult] = useState<RouletteResult | null>(null);
  const [recentResults, setRecentResults] = useState<Array<"0" | "00" | number>>([]);
  const [spinning, setSpinning] = useState(false);
  const [wheelFocus, setWheelFocus] = useState(false);
  if (!user) return null;
  const currentUser = user;

  const chips = currency === "GOLD" ? goldChips : bonusChips;
  const balance = getBalance(currentUser.id, currency);
  const totalBet = bets.reduce((sum, bet) => sum + bet.amount, 0);
  const canSpin = bets.length > 0 && totalBet <= balance && totalBet <= rouletteConfig.maxTotalBetGold && !spinning;
  const winningIds = new Set(result?.winningBetIds ?? []);
  const winningZoneKeys = new Set(result ? getRouletteWinningZones(result.outcome).map(rouletteBetKey) : []);
  const groupedBets = useMemo(() => bets.slice(-4).reverse(), [bets]);
  const coveragePercent = Math.round((getCoveredOutcomes(bets).size / americanWheel.length) * 100);

  function placeBet(bet: RouletteBet) {
    if (spinning) return;
    const projected = totalBet + selectedChip;
    if (projected > balance) {
      notify("Insufficient balance for that roulette bet.", "error");
      playError();
      return;
    }
    if (projected > rouletteConfig.maxTotalBetGold) {
      notify(`Maximum total roulette bet is ${formatCoins(rouletteConfig.maxTotalBetGold)}.`, "error");
      playError();
      return;
    }
    playBet();
    setBets((current) => [...current, { id: crypto.randomUUID(), bet, amount: selectedChip, label: rouletteBetLabel(bet) }]);
    setResult(null);
    setChipMenuOpen(false);
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

  function doubleBets() {
    if (spinning || bets.length === 0) return;
    const doubledTotal = totalBet * 2;
    if (doubledTotal > balance) {
      notify("Insufficient balance to double all roulette bets.", "error");
      return;
    }
    if (doubledTotal > rouletteConfig.maxTotalBetGold) {
      notify(`Maximum total roulette bet is ${formatCoins(rouletteConfig.maxTotalBetGold)}.`, "error");
      return;
    }
    setBets((current) => current.map((bet) => ({ ...bet, amount: bet.amount * 2 })));
    setResult(null);
  }

  function stepChip(direction: -1 | 1) {
    const currentIndex = chips.findIndex((chip) => chip === selectedChip);
    const nextIndex = Math.min(Math.max(currentIndex + direction, 0), chips.length - 1);
    setSelectedChip(chips[nextIndex]);
    setChipMenuOpen(false);
  }

  function toggleAdvanced(number: "0" | "00" | number) {
    if (!advancedMode) {
      placeBet({ kind: "straight", value: number });
      return;
    }
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
    playSpin();
    setSpinning(true);
    setWheelFocus(true);
    setChipMenuOpen(false);
    const outcome = americanWheel[Math.floor(Math.random() * americanWheel.length)];
    window.setTimeout(() => {
      try {
        const next = resolveRouletteBets({ userId: currentUser.id, currency, bets, outcome });
        setResult(next);
        setRecentResults((current) => [outcome, ...current].slice(0, 5));
        setLastBets(bets);
        setBets([]);
        recordRetentionRound({
          userId: currentUser.id,
          gameId: "roulette",
          wager: next.totalWagered ?? totalBet,
          won: next.totalPaid,
          multiplier: (next.totalWagered ?? totalBet) > 0 ? next.totalPaid / (next.totalWagered ?? totalBet) : 0,
        });
        refreshUser();
        if (next.totalPaid > 0) playWin();
        else playLose();
      } catch (caught) {
        notify(caught instanceof Error ? caught.message : "Roulette spin failed.", "error");
        playError();
      } finally {
        setSpinning(false);
        window.setTimeout(() => setWheelFocus(false), 2200);
      }
    }, ROULETTE_SPIN_MS);
  }

  return (
    <section className="roulette-clean-page">
      <div className="roulette-rotate-prompt">
        <button className="roulette-rotate-back" onClick={onExit} aria-label="Back to table games">&lt; Home</button>
        <strong>Rotate for Roulette</strong>
        <span>The full American roulette table is designed for landscape play.</span>
        <span>{COMPLIANCE_COPY}</span>
      </div>

      <header className="roulette-clean-header">
        <button className="roulette-back" onClick={onExit} aria-label="Back to table games">&lt;</button>
        <div className="roulette-title">
          <h1>Roulette <span aria-hidden="true">o</span></h1>
          <small>American Roulette - Virtual Coins Only</small>
        </div>
        <div className="roulette-header-balance">
          <span>Balance</span>
          <strong>{formatCoins(balance)}</strong>
        </div>
        <div className="roulette-currency-tabs">
          <button className={currency === "GOLD" ? "active" : ""} disabled={spinning} onClick={() => { setCurrency("GOLD"); setSelectedChip(25); }}>Gold</button>
          <button className={currency === "BONUS" ? "active" : ""} disabled={spinning} onClick={() => { setCurrency("BONUS"); setSelectedChip(1); }}>Bonus</button>
        </div>
        <SoundToggle className="ghost-button icon-only" compact />
      </header>

      <ScreenShake active={Boolean(result && (result.net ?? 0) >= totalBet * 10)}>
      <section className="roulette-layout">
        <div className="roulette-board-wrap">
          <div className="roulette-board">
            <button className={`zero ${result?.outcome === "0" ? "winner" : ""} ${advancedSelection.includes("0") ? "selected" : ""}`} onClick={() => advancedMode ? toggleAdvanced("0") : placeBet({ kind: "straight", value: "0" })}>
              0
                  <ChipStack bets={bets.filter((placed) => rouletteBetKey(placed.bet) === "straight:0")} winningIds={winningIds} className="straight" />
            </button>
            <button className={`double-zero ${result?.outcome === "00" ? "winner" : ""} ${advancedSelection.includes("00") ? "selected" : ""}`} onClick={() => advancedMode ? toggleAdvanced("00") : placeBet({ kind: "straight", value: "00" })}>
              00
                  <ChipStack bets={bets.filter((placed) => rouletteBetKey(placed.bet) === "straight:00")} winningIds={winningIds} className="straight" />
            </button>
            <button className="zero-split" onClick={() => placeBet({ kind: "split", numbers: ["0", "00"] })} aria-label="Split 0 and 00">
              split
              <ChipStack bets={bets.filter((placed) => rouletteBetKey(placed.bet) === "split:0-00")} winningIds={winningIds} />
            </button>
            <div className="number-grid">
              {boardRows.map((row) => row.map((number) => (
                <button
                  key={number}
                  className={`${redNumbers.has(number) ? "red" : "black"} ${result?.outcome === number ? "winner" : ""} ${advancedSelection.includes(number) ? "selected" : ""}`}
                  onClick={() => advancedMode ? toggleAdvanced(number) : placeBet({ kind: "straight", value: number })}
                >
                  {number}
                  <ChipStack bets={bets.filter((placed) => rouletteBetKey(placed.bet) === `straight:${number}`)} winningIds={winningIds} className="straight" />
                </button>
              )))}
              <InsideChipLayer bets={bets.filter((placed) => "numbers" in placed.bet && placed.bet.kind !== "basket")} winningIds={winningIds} />
              <InsideHitAreas onBet={placeBet} />
            </div>
            <div className="column-bets">
              {[3, 2, 1].map((column) => {
                const bet = { kind: "column", value: column as 1 | 2 | 3 } satisfies RouletteBet;
                return <button key={column} className={winningZoneKeys.has(rouletteBetKey(bet)) ? "winner" : ""} onClick={() => placeBet(bet)}>2:1<ChipStack bets={bets.filter((placed) => rouletteBetKey(placed.bet) === rouletteBetKey(bet))} winningIds={winningIds} /></button>;
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

        <aside className="roulette-bets-panel">
          <div className="roulette-side-actions">
            <button onClick={undoLastBet} aria-label="Undo last bet"><RotateCcw size={16} /></button>
            <button onClick={clearBets} aria-label="Clear bets"><Trash2 size={16} /></button>
            <button onClick={rebet} aria-label="Rebet last bets"><Repeat2 size={16} /></button>
            <button onClick={doubleBets} disabled={spinning || bets.length === 0} aria-label="Double all bets">2x</button>
          </div>
          <div className="roulette-stats">
            <span>Total Bet <strong>{formatCoins(totalBet)}</strong></span>
            <span>Min {rouletteConfig.minBet} / Max {rouletteConfig.maxTotalBetGold}</span>
          </div>
          <div className={chipMenuOpen ? "roulette-chip-picker open" : "roulette-chip-picker"} aria-label="Select chip value">
            <button className="roulette-chip-step" disabled={selectedChip === chips[0]} onClick={() => stepChip(-1)} aria-label="Previous chip value">-</button>
            <div className="roulette-selected-chip-wrap">
              <button className="roulette-chip active selected-chip" onClick={() => setChipMenuOpen((open) => !open)}>
                {selectedChip}
              </button>
              <div className="roulette-chip-popover">
                {chips.filter((chip) => chip !== selectedChip).map((chip, index) => (
                  <button
                    key={chip}
                    className="roulette-chip"
                    style={{ "--chip-index": index } as CSSProperties}
                    onClick={() => { setSelectedChip(chip); setChipMenuOpen(false); }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
            <button className="roulette-chip-step" disabled={selectedChip === chips[chips.length - 1]} onClick={() => stepChip(1)} aria-label="Next chip value">+</button>
          </div>
          <div className="roulette-active-bets">
            {groupedBets.length === 0 && result ? (
              <div className="roulette-last-bet">
                <span>Last Bet</span>
                <strong>Won {formatCoins(result.totalPaid)} · Net {(result.net ?? 0) >= 0 ? "+" : ""}{formatCoins(result.net ?? 0)}</strong>
              </div>
            ) : groupedBets.length === 0 ? <span>No active bets.</span> : groupedBets.map((bet) => (
              <div key={bet.id} className={winningIds.has(bet.id) ? "win" : ""}>
                <span>{bet.label}</span>
                <strong>{formatCoins(bet.amount)}</strong>
              </div>
            ))}
          </div>
          <div className="roulette-coverage" style={{ "--coverage": coveragePercent } as CSSProperties} aria-label={`Board coverage ${coveragePercent}%`}>
            <strong>{coveragePercent}%</strong>
            <span>Cover</span>
          </div>
          <div className="roulette-bottom-wheel">
            <button className={spinning ? "roulette-wheel-spin-button spinning" : "roulette-wheel-spin-button"} disabled={!canSpin} onClick={spin} aria-label={spinning ? "Roulette spinning" : "Spin roulette wheel"}>
              <RouletteWheel outcome={result?.outcome ?? null} spinning={spinning} />
              <span>{spinning ? "Spinning..." : "Spin"}</span>
            </button>
            <LastResults values={recentResults} />
          </div>
          {result && (
            <GameResultBanner
              tone={result.totalPaid > 0 ? ((result.net ?? 0) >= 0 ? "win" : "loss") : "loss"}
              title={result.totalPaid > 0 ? "Roulette Win" : "No Hit"}
              amount={result.totalPaid > 0 ? result.totalPaid : undefined}
              message={`Landed ${result.outcome} ${result.color}. Net ${(result.net ?? 0) >= 0 ? "+" : ""}${formatCoins(result.net ?? 0)}`}
              compact
            />
          )}
          <div className="demo-copy game-compliance-copy">{COMPLIANCE_COPY}</div>
        </aside>

        <div className="roulette-street-panel">
          <StreetBetPanel onBet={placeBet} />
        </div>
      </section>
      </ScreenShake>
      {wheelFocus && (
        <div className={spinning ? "roulette-wheel-overlay spinning" : "roulette-wheel-overlay"}>
          <div className="roulette-wheel-overlay-card">
            <RouletteWheel outcome={result?.outcome ?? null} spinning={spinning} />
            <strong>{spinning ? "Spinning..." : result ? `${result.outcome} ${result.color}` : "Spin"}</strong>
            {result && <span>Won {formatCoins(result.totalPaid)} - Net {(result.net ?? 0) >= 0 ? "+" : ""}{formatCoins(result.net ?? 0)}</span>}
            {result && (
              <GameResultBanner
                tone={result.totalPaid > 0 ? "win" : "loss"}
                title={result.totalPaid > 0 ? "Winner" : "Result"}
                amount={result.totalPaid > 0 ? result.totalPaid : undefined}
                message={`Winning number ${result.outcome}`}
                compact
              />
            )}
          </div>
        </div>
      )}
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

function ChipStack({ bets, winningIds, className = "", style }: { bets: PlacedRouletteBet[]; winningIds: Set<string>; className?: string; style?: CSSProperties }) {
  if (bets.length === 0) return null;
  const total = bets.reduce((sum, bet) => sum + bet.amount, 0);
  return (
    <span className={`${bets.some((bet) => winningIds.has(bet.id)) ? "board-chip win" : "board-chip"} ${className}`.trim()} style={style}>
      {formatCoins(total)}
      {bets.length > 1 && <small>x{bets.length}</small>}
    </span>
  );
}

export function RouletteWheel({ outcome, spinning, showLabel = true }: { outcome: RouletteResult["outcome"] | null; spinning: boolean; showLabel?: boolean }) {
  const outcomeIndex = outcome ? americanWheel.findIndex((value) => value === outcome) : 0;
  const pocketAngle = 360 / americanWheel.length;
  const wheelEndAngle = -outcomeIndex * pocketAngle;
  return (
    <div
      className={spinning ? "roulette-wheel-visual realistic is-spinning" : "roulette-wheel-visual realistic"}
      style={{ "--wheel-end": `${wheelEndAngle}deg` } as CSSProperties}
    >
      <svg className="roulette-wheel-svg" viewBox="0 0 200 200" aria-hidden="true">
        <defs>
          <radialGradient id="rouletteWood" cx="50%" cy="50%" r="56%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="44%" stopColor="#7c2d12" />
            <stop offset="100%" stopColor="#2b1206" />
          </radialGradient>
          <radialGradient id="rouletteHub" cx="38%" cy="34%" r="66%">
            <stop offset="0%" stopColor="#cbd5e1" />
            <stop offset="26%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#111827" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="98" fill="url(#rouletteWood)" />
        <circle cx="100" cy="100" r="88" fill="#130b05" stroke="#b45309" strokeWidth="5" />
        <g className="roulette-wheel-disc">
          {americanWheel.map((value, index) => {
            const color = getRouletteColor(value);
            const midAngle = -90 + index * pocketAngle;
            return (
              <g key={value}>
                <path
                  className={`roulette-pocket-slice ${color}`}
                  d={describeWheelSlice(100, 100, 52, 86, -90 + (index - 0.5) * pocketAngle, -90 + (index + 0.5) * pocketAngle)}
                />
                <text
                  className="roulette-pocket-label"
                  x={100 + 70 * Math.cos((midAngle * Math.PI) / 180)}
                  y={100 + 70 * Math.sin((midAngle * Math.PI) / 180)}
                  transform={`rotate(${midAngle + 90} ${100 + 70 * Math.cos((midAngle * Math.PI) / 180)} ${100 + 70 * Math.sin((midAngle * Math.PI) / 180)})`}
                >
                  {value}
                </text>
              </g>
            );
          })}
        </g>
        <circle cx="100" cy="100" r="52" fill="#2b1708" stroke="#d97706" strokeWidth="3" />
        <circle cx="100" cy="100" r="40" fill="url(#rouletteHub)" stroke="#111827" strokeWidth="2" />
        <circle cx="88" cy="82" r="10" fill="rgba(255,255,255,0.18)" />
      </svg>
      <div className="roulette-ball-track">
        <span className="roulette-ball" />
      </div>
      {showLabel && <strong>{spinning ? "..." : outcome ?? "Spin"}</strong>}
    </div>
  );
}

function describeWheelSlice(cx: number, cy: number, innerRadius: number, outerRadius: number, startAngle: number, endAngle: number) {
  const outerStart = polarPoint(cx, cy, outerRadius, startAngle);
  const outerEnd = polarPoint(cx, cy, outerRadius, endAngle);
  const innerEnd = polarPoint(cx, cy, innerRadius, endAngle);
  const innerStart = polarPoint(cx, cy, innerRadius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

function polarPoint(cx: number, cy: number, radius: number, angleDegrees: number) {
  const angle = (angleDegrees * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function LastResults({ values }: { values: Array<"0" | "00" | number> }) {
  return (
    <div className="roulette-last-results" aria-label="Last five roulette results">
      <span>Last 5</span>
      <div>
        {values.length === 0 ? <em>--</em> : values.map((value, index) => (
          <strong key={`${value}-${index}`} className={getRouletteColor(value)}>{value}</strong>
        ))}
      </div>
    </div>
  );
}

function StreetBetPanel({ onBet }: { onBet: (bet: RouletteBet) => void }) {
  const streets = Array.from({ length: 12 }, (_, index) => index * 3 + 1);
  return (
    <div className="roulette-street-selector">
      <div>
        <strong>3 Street</strong>
        <span>Pays 11:1</span>
      </div>
      <div className="roulette-street-grid">
        {streets.map((street) => (
          (() => {
            const bet = { kind: "street", numbers: [street, street + 1, street + 2] } satisfies RouletteBet;
            return (
          <button
            key={`street-panel-${street}`}
            onClick={() => onBet(bet)}
          >
            {street}-{street + 2}
          </button>
            );
          })()
        ))}
      </div>
      <div>
        <strong>6 Street</strong>
        <span>Pays 5:1</span>
      </div>
      <div className="roulette-street-grid six">
        {streets.slice(0, -1).map((street) => (
          (() => {
            const bet = { kind: "sixLine", numbers: [street, street + 1, street + 2, street + 3, street + 4, street + 5] } satisfies RouletteBet;
            return (
          <button
            key={`six-panel-${street}`}
            onClick={() => onBet(bet)}
          >
            {street}-{street + 5}
          </button>
            );
          })()
        ))}
      </div>
    </div>
  );
}

function InsideHitAreas({ onBet }: { onBet: (bet: RouletteBet) => void }) {
  const areas: Array<{ key: string; bet: RouletteBet; style: CSSProperties }> = [];
  for (let column = 0; column < 12; column += 1) {
    for (let row = 0; row < 3; row += 1) {
      const number = boardRows[row][column];
      if (column < 11) areas.push({ key: `split-h-${number}`, bet: { kind: "split", numbers: [number, boardRows[row][column + 1]] }, style: { left: `${(column + 1) * (100 / 12) - 2.5}%`, top: `${row * (100 / 3)}%`, width: "5%", height: `${100 / 3}%` } });
      if (row < 2) areas.push({ key: `split-v-${number}`, bet: { kind: "split", numbers: [number, boardRows[row + 1][column]] }, style: { left: `${column * (100 / 12)}%`, top: `${(row + 1) * (100 / 3) - 4.5}%`, width: `${100 / 12}%`, height: "9%" } });
      if (column < 11 && row < 2) areas.push({ key: `corner-${number}`, bet: { kind: "corner", numbers: [number, boardRows[row][column + 1], boardRows[row + 1][column], boardRows[row + 1][column + 1]] }, style: { left: `${(column + 1) * (100 / 12) - 2.4}%`, top: `${(row + 1) * (100 / 3) - 3.2}%`, width: "4.8%", height: "6.4%" } });
    }
  }
  return <div className="roulette-hit-layer">{areas.map((area) => <button key={area.key} style={area.style} aria-label={rouletteBetLabel(area.bet)} onClick={() => onBet(area.bet)} />)}</div>;
}

function InsideChipLayer({ bets, winningIds }: { bets: PlacedRouletteBet[]; winningIds: Set<string> }) {
  const grouped = new Map<string, PlacedRouletteBet[]>();
  bets.forEach((bet) => {
    const key = rouletteBetKey(bet.bet);
    grouped.set(key, [...(grouped.get(key) ?? []), bet]);
  });
  return (
    <div className="inside-chip-layer">
      {[...grouped.entries()].map(([key, stack]) => {
        const position = getRouletteInsideChipPosition(stack[0].bet);
        if (!position) return null;
        return <ChipStack key={key} bets={stack} winningIds={winningIds} className="inside" style={{ left: `${position.left}%`, top: `${position.top}%` }} />;
      })}
    </div>
  );
}

function getCoveredOutcomes(bets: PlacedRouletteBet[]) {
  const covered = new Set<"0" | "00" | number>();
  bets.forEach(({ bet }) => {
    if (bet.kind === "straight") covered.add(bet.value);
    else if (bet.kind === "split" || bet.kind === "street" || bet.kind === "corner" || bet.kind === "sixLine" || bet.kind === "basket") bet.numbers.forEach((number) => covered.add(number));
    else if (bet.kind === "color") americanWheel.forEach((number) => { if (getRouletteColor(number) === bet.value) covered.add(number); });
    else if (bet.kind === "parity") americanWheel.forEach((number) => { if (typeof number === "number" && (bet.value === "odd" ? number % 2 === 1 : number % 2 === 0)) covered.add(number); });
    else if (bet.kind === "range") americanWheel.forEach((number) => { if (typeof number === "number" && (bet.value === "low" ? number <= 18 : number >= 19)) covered.add(number); });
    else if (bet.kind === "dozen") americanWheel.forEach((number) => { if (typeof number === "number" && Math.ceil(number / 12) === bet.value) covered.add(number); });
    else if (bet.kind === "column") americanWheel.forEach((number) => { if (typeof number === "number" && (((number - 1) % 3) + 1) === bet.value) covered.add(number); });
  });
  return covered;
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
