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

const tableRouteIds: Record<string, TableGameId> = {
  blackjack: "blackjack",
  roulette: "roulette",
  dice: "dice",
  "over-under": "dice",
  crash: "crash",
  "treasure-dig": "treasureDig",
  treasureDig: "treasureDig",
};

function getInitialRoute(): { view: AppView; slotGameId: string | null; tableGameId: TableGameId | null } {
  const path = window.location.pathname;
  const [, section, rawId] = path.split("/");
  const tableGameId = rawId ? tableRouteIds[rawId] : null;
  if (section === "slots") return { view: "games", slotGameId: rawId ?? null, tableGameId: null };
  if (section === "games" && tableGameId) return { view: "tableGames", slotGameId: null, tableGameId };
  if (section === "games" && rawId) return { view: "games", slotGameId: rawId, tableGameId: null };
  if (section === "games") return { view: "tableGames", slotGameId: null, tableGameId: null };
  if (section === "table-games") return { view: "tableGames", slotGameId: null, tableGameId };
  return { view: "lobby", slotGameId: null, tableGameId: null };
}

export function AppShell() {
  const { user } = useAuth();
  const initialRoute = getInitialRoute();
  const [activeView, setActiveView] = useState<AppView>(initialRoute.view);
  const [activeGameId, setActiveGameId] = useState<string | null>(initialRoute.slotGameId);
  const [activeTableGameId, setActiveTableGameId] = useState<TableGameId | null>(initialRoute.tableGameId);
  const [showOnboarding, setShowOnboarding] = useState(() => (user ? !hasDismissedOnboarding(user.id) : false));

  if (!user) return null;
  const balances = getBalance(user.id);
  const nav = visibleNavItems(user.roles);

  function playGame(gameId: string) {
    setActiveGameId(gameId);
    setActiveView("games");
    window.history.pushState(null, "", `/slots/${gameId}`);
  }

  function setView(view: AppView) {
    setActiveView(view);
    if (view !== "tableGames") setActiveTableGameId(null);
    if (view === "games") setActiveGameId(null);
    const route = view === "tableGames" ? "/games" : view === "games" ? "/slots" : "/";
    window.history.pushState(null, "", route);
  }

  function playTableGame(gameId: TableGameId) {
    setActiveTableGameId(gameId);
    setActiveView("tableGames");
    window.history.pushState(null, "", `/games/${gameId === "treasureDig" ? "treasure-dig" : gameId}`);
  }

  const hideMobileNav = (activeView === "games" && Boolean(activeGameId)) || (activeView === "tableGames" && Boolean(activeTableGameId));

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
          <GamesPage
            activeGameId={activeGameId}
            onGameChange={(gameId) => {
              if (gameId) playGame(gameId);
              else {
                setActiveGameId(null);
                window.history.pushState(null, "", "/slots");
              }
            }}
            onExit={() => setView("lobby")}
          />
        )}
        {activeView === "tableGames" && (
          <TableGamesPage
            activeGameId={activeTableGameId}
            onGameChange={playTableGame}
            onExit={() => {
              setActiveTableGameId(null);
              setActiveView("tableGames");
              window.history.pushState(null, "", "/games");
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
