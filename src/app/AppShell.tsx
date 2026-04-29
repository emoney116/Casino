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
import { TableGamesPage } from "../tableGames/TableGamesPage";
import type { TableGameId } from "../tableGames/types";

function getInitialRoute(): { view: AppView; tableGameId: TableGameId | null } {
  const path = window.location.pathname;
  if (path.startsWith("/table-games/blackjack")) return { view: "tableGames", tableGameId: "blackjack" };
  if (path.startsWith("/table-games/roulette")) return { view: "tableGames", tableGameId: "roulette" };
  if (path.startsWith("/table-games/dice")) return { view: "tableGames", tableGameId: "dice" };
  if (path.startsWith("/table-games")) return { view: "tableGames", tableGameId: null };
  return { view: "lobby", tableGameId: null };
}

export function AppShell() {
  const { user } = useAuth();
  const initialRoute = getInitialRoute();
  const [activeView, setActiveView] = useState<AppView>(initialRoute.view);
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [activeTableGameId, setActiveTableGameId] = useState<TableGameId | null>(initialRoute.tableGameId);
  const [showOnboarding, setShowOnboarding] = useState(() => (user ? !hasDismissedOnboarding(user.id) : false));

  if (!user) return null;
  const balances = getBalance(user.id);
  const nav = visibleNavItems(user.roles);

  function playGame(gameId: string) {
    setActiveGameId(gameId);
    setActiveView("games");
  }

  function setView(view: AppView) {
    setActiveView(view);
    if (view !== "tableGames") setActiveTableGameId(null);
    const route = view === "tableGames" ? "/table-games" : "/";
    window.history.pushState(null, "", route);
  }

  function playTableGame(gameId: TableGameId) {
    setActiveTableGameId(gameId);
    setActiveView("tableGames");
    window.history.pushState(null, "", `/table-games/${gameId}`);
  }

  const hideMobileNav = activeView === "games" || (activeView === "tableGames" && activeTableGameId);

  return (
    <div className={`shell ${hideMobileNav ? "game-mode" : ""}`}>
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
                onClick={() => setView(item.id)}
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

        {activeView === "lobby" && <LobbyPage onPlay={playGame} onTablePlay={playTableGame} onWallet={() => setView("wallet")} />}
        {activeView === "games" && (
          <GamesPage activeGameId={activeGameId} onGameChange={setActiveGameId} onExit={() => setView("lobby")} />
        )}
        {activeView === "tableGames" && (
          <TableGamesPage
            activeGameId={activeTableGameId}
            onGameChange={playTableGame}
            onExit={() => {
              setActiveTableGameId(null);
              setActiveView("tableGames");
              window.history.pushState(null, "", "/table-games");
            }}
          />
        )}
        {activeView === "wallet" && <WalletPage />}
        {activeView === "account" && <AccountPage />}
        {activeView === "admin" && user.roles.includes("ADMIN") && <AdminPage />}
        <div className="mobile-compliance">
          <ComplianceNotice compact />
        </div>
      </main>

      {!hideMobileNav && <MobileTabBar activeView={activeView} roles={user.roles} onChange={setView} />}
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
