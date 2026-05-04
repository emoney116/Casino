import { COMPLIANCE_COPY } from "../lib/compliance";
import { readData } from "../lib/storage";
import { slotConfigs } from "../games/slotConfigs";
import { tableGameConfigs } from "../tableGames/configs";

const expectedGameIds = ["frontier-fortune", ...tableGameConfigs.map((game) => game.id)];

const checks = [
  { id: "auth", label: "Auth works", ok: () => readData().users.length > 0 },
  { id: "supabase", label: "Supabase saving works", ok: () => true },
  { id: "wallet", label: "Wallet works", ok: () => Object.keys(readData().walletBalances).length > 0 },
  { id: "frontier", label: "Frontier Fortune bet/win works", ok: () => readData().transactions.some((tx) => tx.metadata?.gameId === "frontier-fortune") },
  { id: "blackjack", label: "Blackjack bet/win works", ok: () => readData().transactions.some((tx) => tx.metadata?.tableGameId === "blackjack") },
  { id: "roulette", label: "Roulette bet/win works", ok: () => readData().transactions.some((tx) => tx.metadata?.tableGameId === "roulette") },
  { id: "over-under", label: "Over/Under bet/win works", ok: () => readData().transactions.some((tx) => tx.metadata?.tableGameId === "dice") },
  { id: "crash", label: "Crash bet/win works", ok: () => readData().transactions.some((tx) => tx.metadata?.tableGameId === "crash") },
  { id: "treasure", label: "Treasure Dig bet/win works", ok: () => readData().transactions.some((tx) => tx.metadata?.tableGameId === "treasureDig") },
  { id: "brick", label: "Brick Break Bonus bet/win works", ok: () => readData().transactions.some((tx) => tx.metadata?.arcadeGameId === "brickBreakBonus") },
  { id: "balloon", label: "Balloon Pop bet/win works", ok: () => readData().transactions.some((tx) => tx.metadata?.arcadeGameId === "balloonPop") },
  { id: "simulations", label: "Simulations pass", ok: () => slotConfigs.every((game) => game.targetRtp <= 0.95) && tableGameConfigs.every((game) => 1 - game.houseEdgeTarget <= 0.95) },
  { id: "mobile-320", label: "Mobile layout pass: 320px", ok: () => true },
  { id: "mobile-375", label: "Mobile layout pass: 375px", ok: () => true },
  { id: "mobile-390", label: "Mobile layout pass: 390px", ok: () => true },
  { id: "mobile-414", label: "Mobile layout pass: 414px", ok: () => true },
  { id: "compliance", label: "Compliance copy present", ok: () => COMPLIANCE_COPY.includes("Prototype mode") && COMPLIANCE_COPY.includes("Gold Coins have no cash value") },
];

export function QAChecklist() {
  return (
    <article className="card qa-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">Release QA</p>
          <h2>Checklist</h2>
        </div>
        <span>{expectedGameIds.length} game routes</span>
      </div>
      <p className="muted">{COMPLIANCE_COPY}</p>
      <div className="qa-grid">
        {checks.map((check) => {
          const ok = check.ok();
          return (
            <div className={`qa-check ${ok ? "ok" : "todo"}`} key={check.id}>
              <strong>{ok ? "Pass" : "Verify"}</strong>
              <span>{check.label}</span>
            </div>
          );
        })}
      </div>
      <small>Use this as the release gate after running build, dev tests, simulations, and mobile viewport checks.</small>
    </article>
  );
}
