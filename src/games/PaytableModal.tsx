import { Modal } from "../components/Modal";
import type { SlotConfig } from "./types";
import { SymbolTile } from "./SymbolTile";

export function PaytableModal({ game, onClose }: { game: SlotConfig; onClose: () => void }) {
  return (
    <Modal title={`${game.name} Paytable`} onClose={onClose}>
      <div className="modal-stack">
        <p className="muted">
          Demo math only. Real-money games would require certified RNG, certified math, and legal review.
        </p>
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
          Scatters trigger {game.freeSpins.awarded[0]}-{game.freeSpins.awarded[1]} free spins at {game.freeSpins.triggerCount} symbols.
          Bonus symbols trigger the pick bonus at {game.pickBonus.triggerCount} symbols.
        </div>
      </div>
    </Modal>
  );
}
