import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastContext";
import { formatCoins } from "../lib/format";
import type { Currency } from "../types";
import { rouletteConfig } from "./configs";
import { getRouletteColor, resolveRouletteBet } from "./rouletteEngine";
import { TableBetControls } from "./TableBetControls";
import type { RouletteBet, RouletteResult } from "./types";

const straightNumbers = ["0", "00", ...Array.from({ length: 36 }, (_, index) => String(index + 1))];

export function RoulettePage() {
  const { user } = useAuth();
  const notify = useToast();
  const [currency, setCurrency] = useState<Currency>("GOLD");
  const [betAmount, setBetAmount] = useState(rouletteConfig.minBet);
  const [bet, setBet] = useState<RouletteBet>({ kind: "color", value: "red" });
  const [result, setResult] = useState<RouletteResult | null>(null);
  if (!user) return null;
  const currentUser = user;

  function spin() {
    try {
      const next = resolveRouletteBet({ userId: currentUser.id, currency, betAmount, bet });
      setResult(next);
      notify(next.won ? `Roulette paid ${formatCoins(next.totalPaid)}.` : "Roulette spin settled.", next.won ? "success" : "info");
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Roulette spin failed.", "error");
    }
  }

  return (
    <section className="table-play-screen roulette-table">
      <div className="table-game-heading">
        <p className="eyebrow">American roulette</p>
        <h1>Roulette</h1>
        <p className="muted">0 and 00 create the standard American roulette demo house edge. Virtual coins only.</p>
      </div>
      <div className="table-layout">
        <article className="felt-table roulette-felt">
          <div className={`roulette-wheel ${result ? getRouletteColor(result.outcome) : ""}`}>
            <span>{result?.outcome ?? "Spin"}</span>
          </div>
          <div className="roulette-bets">
            <button className={bet.kind === "color" && bet.value === "red" ? "active red" : "red"} onClick={() => setBet({ kind: "color", value: "red" })}>Red</button>
            <button className={bet.kind === "color" && bet.value === "black" ? "active black" : "black"} onClick={() => setBet({ kind: "color", value: "black" })}>Black</button>
            <button className={bet.kind === "parity" && bet.value === "odd" ? "active" : ""} onClick={() => setBet({ kind: "parity", value: "odd" })}>Odd</button>
            <button className={bet.kind === "parity" && bet.value === "even" ? "active" : ""} onClick={() => setBet({ kind: "parity", value: "even" })}>Even</button>
            <button className={bet.kind === "range" && bet.value === "low" ? "active" : ""} onClick={() => setBet({ kind: "range", value: "low" })}>1-18</button>
            <button className={bet.kind === "range" && bet.value === "high" ? "active" : ""} onClick={() => setBet({ kind: "range", value: "high" })}>19-36</button>
            <button className={bet.kind === "dozen" && bet.value === 1 ? "active" : ""} onClick={() => setBet({ kind: "dozen", value: 1 })}>1st 12</button>
            <button className={bet.kind === "dozen" && bet.value === 2 ? "active" : ""} onClick={() => setBet({ kind: "dozen", value: 2 })}>2nd 12</button>
            <button className={bet.kind === "dozen" && bet.value === 3 ? "active" : ""} onClick={() => setBet({ kind: "dozen", value: 3 })}>3rd 12</button>
          </div>
          <label className="straight-select">
            Straight number
            <select onChange={(event) => setBet({ kind: "straight", value: event.target.value === "00" || event.target.value === "0" ? event.target.value : Number(event.target.value) })}>
              {straightNumbers.map((number) => <option key={number} value={number}>{number}</option>)}
            </select>
          </label>
          {result && <div className={`table-result ${result.won ? "win" : "loss"}`}><strong>{result.won ? "WIN" : "LOSS"}</strong><span>{result.outcome} {result.color}</span></div>}
        </article>
        <div className="table-side-panel">
          <TableBetControls userId={currentUser.id} config={rouletteConfig} currency={currency} betAmount={betAmount} maxPayoutPreview={rouletteConfig.maxPayout} onCurrencyChange={setCurrency} onBetChange={setBetAmount} />
          <button className="primary-button table-big-action" onClick={spin}>Spin Wheel</button>
        </div>
      </div>
    </section>
  );
}
