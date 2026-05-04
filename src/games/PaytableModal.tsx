import { Modal } from "../components/Modal";
import type { SlotConfig } from "./types";
import { SymbolTile } from "./SymbolTile";
import { COMPLIANCE_COPY } from "../lib/compliance";

export function PaytableModal({ game, onClose }: { game: SlotConfig; onClose: () => void }) {
  return (
    <Modal title={`${game.name} Paytable`} onClose={onClose}>
      <div className="modal-stack">
        <p className="muted">
          {COMPLIANCE_COPY} Demo math only; release math is inspected in Admin.
        </p>
        <div className="rules-grid">
          <div><span>RTP target</span><strong>{(game.targetRtp * 100).toFixed(1)}%</strong></div>
          <div><span>Volatility</span><strong>{game.volatility}</strong></div>
          <div><span>Bet range</span><strong>{game.minBet}-{game.maxBet}</strong></div>
          <div><span>Max payout</span><strong>{game.maxPayoutMultiplier}x</strong></div>
        </div>
        <div className="paytable-grid">
          {game.payoutTable.map((rule) => (
            <div key={`${rule.symbol}-${rule.count}`} className="pay-row">
              <span className="pay-symbol">
                <SymbolTile game={game} symbolId={rule.symbol} compact />
                {rule.count} in a row
              </span>
              <strong>{rule.multiplier}x</strong>
            </div>
          ))}
        </div>
        <div className="notice-card">
          Features: {(game.featureTypes ?? ["FREE_SPINS", "PICK_BONUS"]).join(", ").replaceAll("_", " ")}.
          {game.freeSpins.triggerCount < 90 ? ` Scatters trigger ${game.freeSpins.awarded[0]}-${game.freeSpins.awarded[1]} free spins at ${game.freeSpins.triggerCount} symbols.` : ""}
          {game.pickBonus.triggerCount < 90 ? ` Bonus symbols trigger the pick bonus at ${game.pickBonus.triggerCount} symbols.` : ""}
          {game.buyBonus?.enabled ? ` Buy Bonus costs ${game.buyBonus.costMultiplier}x the current bet and starts ${game.buyBonus.featureType.replaceAll("_", " ")}.` : ""}
          Jackpot labels and bonus awards are demo virtual-coin values only.
        </div>
        {game.featureTypes?.includes("HOLD_AND_WIN") && (
          <div className="notice-card">
            Hold and Win: landing 3 or more coin symbols starts the bonus. Bet amount affects
            coin values, so higher bets can create larger bonus wins. Coin values use configurable
            multipliers: {(game.holdAndWin?.coinValueMultipliers ?? []).join(", ") || "game defaults"}x.
            You begin with 3 respins, and any new coin resets respins back to 3. Filling every
            position awards the Grand demo jackpot, capped at {game.maxPayoutMultiplier}x the bet.
          </div>
        )}
        {game.buyBonus?.enabled && (
          <div className="notice-card">
            Bonus buy pricing is always current bet x {game.buyBonus.costMultiplier}. Buy bonus RTP
            is demo-tuned for the virtual economy. {COMPLIANCE_COPY}
          </div>
        )}
        {game.jackpotLabels && (
          <div className="rules-grid">
            {Object.entries(game.jackpotLabels).map(([label, value]) => (
              <div key={label}><span>{label}</span><strong>{value}</strong></div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
