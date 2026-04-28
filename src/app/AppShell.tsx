import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { ComplianceNotice } from "../components/ComplianceNotice";
import { BalancePill } from "../components/BalanceCard";
import { AccountPage } from "../account/AccountPage";
import { AdminPage } from "../admin/AdminPage";
import { GamesPage } from "../games/GamesPage";
import { LobbyPage } from "../games/LobbyPage";
import { WalletPage } from "../wallet/WalletPage";
import { getBalance } from "../wallet/walletService";
import type { AppView } from "./navigation";
import { BrandIcon, visibleNavItems } from "./navigation";
import { MobileTabBar } from "./MobileTabBar";
import { Modal } from "../components/Modal";
import { dismissOnboarding, hasDismissedOnboarding } from "./onboarding";

export function AppShell() {
  const { user } = useAuth();
  const [activeView, setActiveView] = useState<AppView>("lobby");
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(() => (user ? !hasDismissedOnboarding(user.id) : false));

  if (!user) return null;
  const balances = getBalance(user.id);
  const nav = visibleNavItems(user.roles);

  function playGame(gameId: string) {
    setActiveGameId(gameId);
    setActiveView("games");
  }

  return (
    <div className={`shell ${activeView === "games" ? "game-mode" : ""}`}>
      <aside className="sidebar">
        <div className="shell-brand">
          <BrandIcon />
          <div>
            <strong>Casino</strong>
            <span>Prototype</span>
          </div>
        </div>
        <nav className="side-nav" aria-label="Primary navigation">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={activeView === item.id ? "active" : ""}
                onClick={() => setActiveView(item.id)}
              >
                <Icon size={19} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <ComplianceNotice compact />
      </aside>

      <main className="main-panel">
        <header className="mobile-header">
          <div className="shell-brand">
            <BrandIcon />
            <div>
              <strong>Casino</strong>
              <span>Prototype</span>
            </div>
          </div>
        </header>
        <div className="balance-strip">
          <BalancePill label="Gold Coins" amount={balances.GOLD} tone="gold" />
          <BalancePill label="Bonus Coins" amount={balances.BONUS} tone="bonus" />
        </div>

        {activeView === "lobby" && <LobbyPage onPlay={playGame} onWallet={() => setActiveView("wallet")} />}
        {activeView === "games" && (
          <GamesPage activeGameId={activeGameId} onGameChange={setActiveGameId} onExit={() => setActiveView("lobby")} />
        )}
        {activeView === "wallet" && <WalletPage />}
        {activeView === "account" && <AccountPage />}
        {activeView === "admin" && user.roles.includes("ADMIN") && <AdminPage />}
        <div className="mobile-compliance">
          <ComplianceNotice compact />
        </div>
      </main>

      {activeView !== "games" && <MobileTabBar activeView={activeView} roles={user.roles} onChange={setActiveView} />}
      {showOnboarding && (
        <Modal title="Welcome to the Demo Casino" onClose={() => undefined}>
          <div className="modal-stack">
            <p>
              This prototype uses virtual Gold Coins and Bonus Coins only. They have no cash value,
              and there are no deposits, withdrawals, prizes, or redemptions.
            </p>
            <div className="notice-card">
              Claim your daily bonus, pick a slot in the lobby, and test the ledger-backed demo economy.
            </div>
            <button
              className="primary-button"
              onClick={() => {
                dismissOnboarding(user.id);
                setShowOnboarding(false);
              }}
            >
              Start Playing Demo Games
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
