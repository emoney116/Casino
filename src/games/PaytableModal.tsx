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
            Hold and Win: landing {game.holdAndWin?.triggerCount ?? 3} or more Gold Coin symbols, a collector trigger, or a wheel trigger starts the bonus.
            Coin awards are bet multipliers: {(game.holdAndWin?.coinValueMultipliers ?? []).join("x, ") || "game defaults"}x,
            with rare Mini, Minor, and Major coins also available.
            You begin with 3 respins, and any new coin resets respins back to 3. Filling every
            position awards the Grand demo jackpot, capped at {game.maxPayoutMultiplier}x the bet.
          </div>
        )}
        {game.wheelBonus && (
          <div className="notice-card">
            Oasis Scatters: {game.wheelBonus.triggerCount}+ trigger the Wheel Bonus. Segments include{" "}
            {game.wheelBonus.segments.map((segment) => segment.label).join(", ")}. Cash segments pay the current bet multiplier;
            Hold & Win segments move into the respin bonus with 6 starting coins.
          </div>
        )}
        {game.coinCollector?.enabled && (
          <div className="notice-card">
            Collector: base-game Gold Coin symbols collect {game.coinCollector.minCollect}-{game.coinCollector.maxCollect} coins into the top meter.
            Each collection can randomly trigger Hold & Win and the meter {game.coinCollector.resetOnTrigger ? "resets" : "stays"} after a trigger.
          </div>
        )}
        {game.expansionBonus?.mechanic === "mine-clash" && (
          <div className="notice-card">
            VS symbols open the Mine Clash frame. The frame expands over the reels, the Gold Miner and Diamond Miner compete,
            and the winning miner turns the covered frame into multiplier wilds. Demo prototype math only; feature buys are not real-money play.
          </div>
        )}
        {game.boostSpins && (
          <div className="notice-card">
            Boost spins debit the displayed cost exactly. Gold Boost increases Gold Coin and collector feature chances;
            Scatter Boost increases Oasis Scatter and Wheel Bonus chances. Boost and bonus-buy RTP are tuned to stay below 95%.
          </div>
        )}
        {game.buyBonus?.enabled && (
          <div className="notice-card">
            Buy bonus pricing: {(game.bonusBuys ?? []).map((buy) => `${buy.label} ${buy.costMultiplier}x`).join(", ") || `${game.buyBonus.costMultiplier}x`}.
            Bonus buys are not profitable long-term in the demo math. Max payout cap: {game.maxPayoutMultiplier}x. {COMPLIANCE_COPY}
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
