import { readData } from "../lib/storage";

const checks = [
  { id: "auth", label: "auth works", ok: () => readData().users.length > 0 && readData().sessions.length >= 0 },
  { id: "wallet", label: "wallet works", ok: () => Object.keys(readData().walletBalances).length > 0 },
  { id: "purchases", label: "fake purchases work", ok: () => readData().transactions.some((tx) => tx.type === "PURCHASE_FAKE") },
  { id: "slots", label: "slots work", ok: () => readData().transactions.some((tx) => tx.type === "GAME_BET" || tx.type === "GAME_WIN") },
  { id: "missions", label: "missions work", ok: () => Object.keys(readData().missions).length > 0 || readData().transactions.some((tx) => tx.type === "MISSION_REWARD") },
  { id: "streaks", label: "streaks work", ok: () => Object.keys(readData().streaks).length > 0 || readData().transactions.some((tx) => tx.type === "STREAK_REWARD") },
  { id: "progression", label: "progression works", ok: () => Object.keys(readData().progression).length > 0 || readData().transactions.some((tx) => tx.type === "LEVEL_REWARD") },
  { id: "admin", label: "admin tools work", ok: () => readData().users.some((user) => user.roles.includes("ADMIN")) },
];

export function QAChecklist() {
  return (
    <article className="card qa-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">Demo QA</p>
          <h2>Checklist</h2>
        </div>
        <span>Local data signals</span>
      </div>
      <div className="qa-grid">
        {checks.map((check) => {
          const ok = check.ok();
          return (
            <div className={`qa-check ${ok ? "ok" : "todo"}`} key={check.id}>
              <strong>{ok ? "Pass" : "Try"}</strong>
              <span>{check.label}</span>
            </div>
          );
        })}
      </div>
      <small>Checklist uses local prototype state and remains virtual-currency only.</small>
    </article>
  );
}
