import { RotateCcw, Users } from "lucide-react";
import { Fragment, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { StatCard } from "../components/StatCard";
import { TransactionTable } from "../components/TransactionTable";
import { useToast } from "../components/ToastContext";
import { formatCoins } from "../lib/format";
import { seedDemoUsers } from "../lib/demoSeed";
import { readData, resetData } from "../lib/storage";
import { getMathWarnings, simulateSlot } from "../games/slotMath";
import { slotConfigs } from "../games/slotConfigs";
import type { SimulationResult } from "../games/types";
import type { Currency } from "../types";
import { creditCurrency, debitCurrency, getBalance, getTransactions } from "../wallet/walletService";
import { getProgression } from "../progression/progressionService";
import { resetMissions } from "../missions/missionService";
import { resetStreak } from "../streaks/streakService";
import { missionDefs } from "../missions/missionDefs";
import { streakRewards } from "../streaks/streakService";
import { QAChecklist } from "./QAChecklist";
import { SupabaseDebugPanel } from "../components/SupabaseDebugPanel";
import { tableGameConfigs } from "../tableGames/configs";
import { getTableMathWarnings, simulateTableGame } from "../tableGames/tableMath";
import type { TableGameId, TableSimulationResult } from "../tableGames/types";
import { getCurrencyDisplayName, getCurrencyShortName } from "../config/currencyConfig";
import { getKycStatus, getRedemptionRequests } from "../redemption/redemptionService";

export function AdminPage() {
  const { logout } = useAuth();
  const notify = useToast();
  const [dataVersion, setDataVersion] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [currency, setCurrency] = useState<Currency>("GOLD");
  const [amount, setAmount] = useState(1000);
  const [simulations, setSimulations] = useState<Record<string, SimulationResult>>({});
  const [tableSimulations, setTableSimulations] = useState<Record<string, TableSimulationResult>>({});
  const data = readData();

  function refresh() {
    setDataVersion((value) => value + 1);
  }

  function adjust() {
    if (!selectedUserId) return notify("Choose a user first.", "error");
    try {
      if (amount >= 0) {
        creditCurrency({ userId: selectedUserId, type: "ADMIN_ADJUSTMENT", currency, amount, metadata: { source: "admin_panel" } });
      } else {
        debitCurrency({ userId: selectedUserId, type: "ADMIN_ADJUSTMENT", currency, amount: Math.abs(amount), metadata: { source: "admin_panel" } });
      }
      refresh();
      notify("Admin adjustment recorded in ledger.", "success");
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Adjustment failed.", "error");
    }
  }

  function resetDemo() {
    resetData();
    logout();
    notify("Local demo data reset.", "info");
  }

  function seedUsers() {
    seedDemoUsers();
    refresh();
    notify("Demo users seeded. Password is demo123.", "success");
  }

  function runSimulation(gameId: string) {
    const game = slotConfigs.find((candidate) => candidate.id === gameId);
    if (!game) return;
    const result = simulateSlot(game, 100000, game.minBet);
    setSimulations((current) => ({ ...current, [gameId]: result }));
  }

  function runTableSimulation(gameId: TableGameId) {
    const result = simulateTableGame(gameId, 100000);
    setTableSimulations((current) => ({ ...current, [gameId]: result }));
  }

  function runAllSimulations() {
    const nextSlots: Record<string, SimulationResult> = {};
    slotConfigs.forEach((game) => {
      nextSlots[game.id] = simulateSlot(game, 100000, game.minBet);
    });
    const nextTables: Record<string, TableSimulationResult> = {};
    tableGameConfigs.forEach((game) => {
      nextTables[game.id] = simulateTableGame(game.id, 100000);
    });
    setSimulations(nextSlots);
    setTableSimulations(nextTables);
    notify("All RNG simulations completed.", "success");
  }

  const allTransactions = getTransactions();
  const redemptionRequests = getRedemptionRequests();
  const suspiciousGames = slotConfigs.flatMap((game) => getMathWarnings(game, simulations[game.id]));
  const suspiciousTableGames = tableGameConfigs.flatMap((game) => getTableMathWarnings(game, tableSimulations[game.id]));
  const economyWarnings = [
    ...suspiciousGames,
    ...suspiciousTableGames,
    ...(missionDefs.some((mission) => mission.rewardAmount > 5000) ? ["Mission rewards are high for demo economy."] : []),
    ...(streakRewards.some((reward) => reward.bonus > 6000 || reward.gold > 1000) ? ["Streak rewards are high for demo economy."] : []),
    ...(slotConfigs.some((game) => game.maxPayoutMultiplier > 75) ? ["A max payout cap is high."] : []),
  ];

  return (
    <section className="page-stack" key={dataVersion}>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Mock admin</p>
          <h1>Dev Tools</h1>
          <p className="muted">ADMIN role only. Local prototype data and demo-only math tools.</p>
        </div>
            <button className="ghost-button icon-button" onClick={seedUsers}>
              <Users size={17} />
              Seed Demo Users
            </button>
            <button className="primary-button" onClick={runAllSimulations}>Run All Simulations</button>
      </div>

      {economyWarnings.length > 0 && (
        <div className="error-box">
          {economyWarnings.slice(0, 4).join(" ")}
        </div>
      )}

      <div className="grid three">
        <StatCard label="Users" value={String(data.users.length)} />
        <StatCard label="Transactions" value={String(allTransactions.length)} />
        <StatCard label="Games" value={String(slotConfigs.length)} note="Config-driven slots" />
      </div>

      <QAChecklist />
      <SupabaseDebugPanel />

      <div className="grid two">
        <article className="card">
          <h2>Users</h2>
          <div className="user-list">
            {data.users.map((user) => {
              const balances = getBalance(user.id);
              return (
                <button
                  className={selectedUserId === user.id ? "user-row active" : "user-row"}
                  key={user.id}
                  onClick={() => setSelectedUserId(user.id)}
                >
                  <span>{user.username}</span>
                  <small>{user.email}</small>
                  <small className="admin-currency-line">
                    <span className="currency-badge currency-gc">{getCurrencyShortName("GOLD")} {formatCoins(balances.GOLD)}</span>
                    <span className="currency-badge currency-sc">{getCurrencyShortName("BONUS")} {formatCoins(balances.BONUS)}</span>
                  </small>
                  <small>KYC {getKycStatus(user.id)}</small>
                  <small>Level {getProgression(user.id).level} | XP {formatCoins(getProgression(user.id).xp)}</small>
                </button>
              );
            })}
          </div>
        </article>

        <article className="card">
          <h2>Balance Adjustment</h2>
          <div className="form-stack">
            <label>
              Currency
              <select value={currency} onChange={(event) => setCurrency(event.target.value as Currency)}>
                <option value="GOLD">{getCurrencyDisplayName("GOLD")}</option>
                <option value="BONUS">{getCurrencyDisplayName("BONUS")}</option>
              </select>
            </label>
            <label>
              Amount
              <input type="number" value={amount} onChange={(event) => setAmount(Number(event.target.value))} />
            </label>
            <button className="primary-button" onClick={adjust}>Record Adjustment</button>
            <button className="ghost-button" disabled={!selectedUserId} onClick={() => { resetMissions(selectedUserId); refresh(); notify("Missions reset.", "info"); }}>Reset Missions</button>
            <button className="ghost-button" disabled={!selectedUserId} onClick={() => { resetStreak(selectedUserId); refresh(); notify("Streak reset.", "info"); }}>Reset Streak</button>
            <button className="danger-button icon-button" onClick={resetDemo}>
              <RotateCcw size={16} />
              Reset Local Demo Data
            </button>
          </div>
        </article>
      </div>

      <article className="card">
        <div className="section-title">
          <h2>Future Sweepstakes Admin Prep</h2>
          <span>Read-only / disabled</span>
        </div>
        <div className="grid four admin-prep-grid">
          <StatCard label="Redemption Requests" value={String(redemptionRequests.length)} note="Request workflow disabled" />
          <StatCard label="KYC Statuses" value={String(Object.keys(data.kycStatuses).length)} note="KYC not enabled" />
          <StatCard label="Sweeps Grants" value={String(allTransactions.filter((tx) => tx.type === "SWEEPS_BONUS_GRANT").length)} note="Promotional placeholder" />
          <StatCard label="Eligibility Flags" value={String(Object.keys(data.eligibilityFlags).length)} note="No geo enforcement" />
        </div>
        <p className="muted">
          Future controls for redemption review, KYC review, promotional coin grants, and eligibility flags are intentionally read-only in this prototype.
        </p>
        <button className="ghost-button" disabled>Admin redemption tools not enabled</button>
      </article>

      <article className="card">
        <div className="section-title">
          <h2>Game Math Simulator</h2>
          <span>100,000 spins</span>
        </div>
        <div className="sim-grid">
          {slotConfigs.map((game) => {
            const sim = simulations[game.id];
            const warnings = getMathWarnings(game, sim);
            return (
              <article className="sim-card" key={game.id}>
                <h3>{game.name}</h3>
                <small>Target RTP {(game.targetRtp * 100).toFixed(1)}%</small>
                {sim ? (
                  <div className="detail-list compact-detail">
                    <span>Total wagered</span><strong>{formatCoins(sim.totalWagered)}</strong>
                    <span>Total paid</span><strong>{formatCoins(sim.totalPaid)}</strong>
                    <span>Observed RTP</span><strong>{(sim.observedRtp * 100).toFixed(2)}%</strong>
                    <span>Hit rate</span><strong>{(sim.hitRate * 100).toFixed(2)}%</strong>
                    <span>Biggest win</span><strong>{formatCoins(sim.biggestWin)}</strong>
                    <span>Cap hit rate</span><strong>{((sim.capHitRate ?? 0) * 100).toFixed(2)}%</strong>
                    <span>Bonus trigger</span><strong>{(sim.bonusTriggerRate * 100).toFixed(2)}%</strong>
                    <span>Free spins</span><strong>{(sim.freeSpinTriggerRate * 100).toFixed(2)}%</strong>
                    <span>Pick bonus</span><strong>{(sim.pickBonusTriggerRate * 100).toFixed(2)}%</strong>
                    <span>Hold and win</span><strong>{((sim.holdAndWinTriggerRate ?? 0) * 100).toFixed(2)}%</strong>
                    <span>Wheel bonus</span><strong>{((sim.wheelBonusTriggerRate ?? 0) * 100).toFixed(2)}%</strong>
                    <span>Expansion bonus</span><strong>{((sim.expansionBonusTriggerRate ?? 0) * 100).toFixed(2)}%</strong>
                    {game.expansionBonus?.mechanic === "mine-clash" && (
                      <>
                        <span>Mine Clash trigger</span><strong>{((sim.mineClashTriggerRate ?? 0) * 100).toFixed(2)}%</strong>
                        <span>Avg Mine Clash payout</span><strong>{formatCoins(sim.averageMineClashPayout ?? 0)}</strong>
                        <span>Multiplier wild EV</span><strong>{(sim.multiplierWildEv ?? 0).toFixed(2)}</strong>
                        <span>Free spins EV</span><strong>{formatCoins(sim.freeSpinsAveragePayout ?? 0)}</strong>
                      </>
                    )}
                    {game.id === "gold-rush-showdown" && (
                      <>
                        <span>Base line RTP</span><strong>{((sim.baseLineRtp ?? 0) * 100).toFixed(2)}%</strong>
                        <span>Inactive VS</span><strong>{sim.inactiveVsCount ?? 0}</strong>
                        <span>Active normal VS</span><strong>{sim.activeNormalVsCount ?? 0} ({((sim.activeNormalVsRate ?? 0) * 100).toFixed(2)}%)</strong>
                        <span>Interior boards</span><strong>{sim.interiorBoardAppearanceCount ?? 0} ({((sim.interiorBoardAppearanceRate ?? 0) * 100).toFixed(2)}%)</strong>
                        <span>VS inside interior</span><strong>{sim.vsInsideInteriorCount ?? 0}</strong>
                        <span>Active interior VS</span><strong>{sim.activeInteriorVsCount ?? 0} ({((sim.activeInteriorVsRate ?? 0) * 100).toFixed(2)}%)</strong>
                        <span>Avg normal VS pay</span><strong>{formatCoins(sim.averageActiveNormalVsPayout ?? 0)}</strong>
                        <span>Avg interior VS pay</span><strong>{formatCoins(sim.averageActiveInteriorVsPayout ?? 0)}</strong>
                        <span>Interior sizes</span><strong>{Object.entries(sim.interiorSizeDistribution ?? {}).map(([size, count]) => `${size}c:${count}`).join(" ") || "N/A"}</strong>
                        <span>VS tiers</span><strong>{Object.entries(sim.vsDuelTierDistribution ?? {}).map(([tier, count]) => `${tier}:${count}`).join(" ") || "N/A"}</strong>
                        <span>VS multipliers</span><strong>{Object.entries(sim.vsMultiplierDistribution ?? {}).map(([multiplier, count]) => `${multiplier}:${count}`).join(" ") || "N/A"}</strong>
                      </>
                    )}
                    <span>Coin collector</span><strong>{((sim.coinCollectorTriggerRate ?? 0) * 100).toFixed(2)}%</strong>
                    <span>Buy bonus RTP</span><strong>{sim.buyBonusRtp ? `${(sim.buyBonusRtp * 100).toFixed(2)}%` : "N/A"}</strong>
                    {Object.entries(sim.modeResults ?? {}).map(([mode, modeSim]) => (
                      <Fragment key={mode}>
                        <span>{mode.replaceAll("_", " ")}</span>
                        <strong className={modeSim.warning ? "warning" : ""}>{(modeSim.observedRtp * 100).toFixed(2)}%</strong>
                      </Fragment>
                    ))}
                  </div>
                ) : (
                  <p className="muted">Run simulation to inspect rough observed RTP.</p>
                )}
                {warnings.map((warning) => <div className="warning" key={warning}>{warning}</div>)}
                <button className="ghost-button" onClick={() => runSimulation(game.id)}>Simulate</button>
              </article>
            );
          })}
        </div>
      </article>

      <article className="card">
        <div className="section-title">
          <h2>Table Game Math Simulator</h2>
          <span>100,000 rounds</span>
        </div>
        <div className="sim-grid">
          {tableGameConfigs.map((game) => {
            const sim = tableSimulations[game.id];
            const warnings = getTableMathWarnings(game, sim);
            return (
              <article className="sim-card" key={game.id}>
                <h3>{game.name}</h3>
                <small>Target house edge {(game.houseEdgeTarget * 100).toFixed(2)}%</small>
                {sim ? (
                  <div className="detail-list compact-detail">
                    <span>Total wagered</span><strong>{formatCoins(sim.totalWagered)}</strong>
                    <span>Total paid</span><strong>{formatCoins(sim.totalPaid)}</strong>
                    <span>Observed RTP</span><strong>{(sim.observedRtp * 100).toFixed(2)}%</strong>
                    <span>House edge</span><strong>{(sim.houseEdge * 100).toFixed(2)}%</strong>
                    <span>Biggest win</span><strong>{formatCoins(sim.biggestWin)}</strong>
                    <span>Cap hits</span><strong>{formatCoins(sim.maxPayoutCapHits)}</strong>
                    <span>Cap hit rate</span><strong>{((sim.maxCapHitRate ?? 0) * 100).toFixed(2)}%</strong>
                    {typeof sim.averagePayout === "number" && <><span>Average payout</span><strong>{formatCoins(sim.averagePayout)}</strong></>}
                    {typeof sim.bustRate === "number" && <><span>{game.id === "balloonPop" ? "Blank rate" : "Bust rate"}</span><strong>{(sim.bustRate * 100).toFixed(2)}%</strong></>}
                    {typeof sim.averageBricksHit === "number" && <><span>Avg bricks hit</span><strong>{sim.averageBricksHit.toFixed(2)}</strong></>}
                  </div>
                ) : (
                  <p className="muted">Run simulation to inspect table game math.</p>
                )}
                {warnings.map((warning) => <div className="warning" key={warning}>{warning}</div>)}
                <button className="ghost-button" onClick={() => runTableSimulation(game.id as TableGameId)}>Simulate</button>
              </article>
            );
          })}
        </div>
      </article>

      <article className="card">
        <div className="section-title">
          <h2>Economy Summary</h2>
          <span>Virtual only</span>
        </div>
        <div className="grid three">
          <StatCard label="Mission Rewards" value={formatCoins(missionDefs.reduce((sum, mission) => sum + mission.rewardAmount, 0))} />
          <StatCard label="Streak Bonus Total" value={formatCoins(streakRewards.reduce((sum, reward) => sum + reward.bonus, 0))} />
          <StatCard label="Highest Max Cap" value={`${Math.max(...slotConfigs.map((game) => game.maxPayoutMultiplier))}x`} />
        </div>
      </article>

      <article className="card">
        <div className="section-title">
          <h2>All Transactions</h2>
          <span>{allTransactions.length} records</span>
        </div>
        <TransactionTable transactions={allTransactions} />
      </article>
    </section>
  );
}
