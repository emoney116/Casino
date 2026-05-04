import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { ComplianceNotice } from "../components/ComplianceNotice";
import { BalanceToggle } from "../components/BalanceCard";
import { AccountPage } from "../account/AccountPage";
import { AdminPage } from "../admin/AdminPage";
import { GamesPage } from "../games/GamesPage";
import { LobbyPage } from "../games/LobbyPage";
import { WalletPage } from "../wallet/WalletPage";
import type { WalletPanel } from "../wallet/WalletPage";
import { PurchaseCoinsModal } from "../wallet/PurchaseCoinsModal";
import { getBalance } from "../wallet/walletService";
import type { Currency } from "../types";
import type { AppView } from "./navigation";
import { BrandIcon, visibleNavItems } from "./navigation";
import { MobileTabBar } from "./MobileTabBar";
import { Modal } from "../components/Modal";
import { dismissOnboarding, hasDismissedOnboarding } from "./onboarding";
import { TableGamesPage } from "../tableGames/TableGamesPage";
import type { TableGameId } from "../tableGames/types";
import { RewardsPage } from "../retention/RewardsPage";
import { COMPLIANCE_COPY } from "../lib/compliance";
import { LegalPage } from "../legal/LegalPage";

const tableRouteIds: Record<string, TableGameId> = {
  blackjack: "blackjack",
  roulette: "roulette",
  dice: "dice",
  "over-under": "dice",
  crash: "crash",
  "treasure-dig": "treasureDig",
  treasureDig: "treasureDig",
  "brick-break-bonus": "brickBreakBonus",
  "coin-breaker": "brickBreakBonus",
  brickBreakBonus: "brickBreakBonus",
  "balloon-pop": "balloonPop",
  balloonPop: "balloonPop",
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
  if (section === "rewards") return { view: "rewards", slotGameId: null, tableGameId: null };
  if (section === "wallet") return { view: "wallet", slotGameId: null, tableGameId: null };
  if (section === "redemption") return { view: "redemption", slotGameId: null, tableGameId: null };
  if (section === "account") return { view: "account", slotGameId: null, tableGameId: null };
  if (section === "terms") return { view: "terms", slotGameId: null, tableGameId: null };
  if (section === "sweepstakes-rules") return { view: "sweepstakesRules", slotGameId: null, tableGameId: null };
  if (section === "privacy") return { view: "privacy", slotGameId: null, tableGameId: null };
  if (section === "responsible-play") return { view: "responsiblePlay", slotGameId: null, tableGameId: null };
  if (section === "eligibility") return { view: "eligibility", slotGameId: null, tableGameId: null };
  if (section === "admin") return { view: "admin", slotGameId: null, tableGameId: null };
  return { view: "lobby", slotGameId: null, tableGameId: null };
}

export function AppShell() {
  const { user } = useAuth();
  const initialRoute = getInitialRoute();
  const [activeView, setActiveView] = useState<AppView>(initialRoute.view);
  const [activeGameId, setActiveGameId] = useState<string | null>(initialRoute.slotGameId);
  const [activeTableGameId, setActiveTableGameId] = useState<TableGameId | null>(initialRoute.tableGameId);
  const [selectedBalance, setSelectedBalance] = useState<Currency>("GOLD");
  const [balanceExpanded, setBalanceExpanded] = useState(false);
  const [walletPanel, setWalletPanel] = useState<WalletPanel>(initialRoute.view === "redemption" ? "redeem" : null);
  const [walletPanelKey, setWalletPanelKey] = useState(0);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
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
    if (view === "wallet") setWalletPanel(null);
    if (view === "redemption") setWalletPanel("redeem");
    setActiveView(view);
    if (view !== "tableGames") setActiveTableGameId(null);
    if (view === "games") setActiveGameId(null);
    const route = view === "tableGames"
      ? "/games"
      : view === "games"
        ? "/slots"
        : view === "rewards"
          ? "/rewards"
          : view === "wallet"
            ? "/wallet"
            : view === "redemption"
              ? "/redemption"
              : view === "account"
                ? "/account"
                : view === "terms"
                  ? "/terms"
                  : view === "sweepstakesRules"
                    ? "/sweepstakes-rules"
                    : view === "privacy"
                      ? "/privacy"
                      : view === "responsiblePlay"
                        ? "/responsible-play"
                        : view === "eligibility"
                          ? "/eligibility"
                          : view === "admin"
                            ? "/admin"
                            : "/";
    window.history.pushState(null, "", route);
  }

  function openPurchasePacks() {
    setPurchaseModalOpen(true);
  }

  function playTableGame(gameId: TableGameId) {
    setActiveTableGameId(gameId);
    setActiveView("tableGames");
    window.history.pushState(null, "", `/games/${gameId === "treasureDig" ? "treasure-dig" : gameId === "brickBreakBonus" ? "brick-break-bonus" : gameId === "balloonPop" ? "balloon-pop" : gameId}`);
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
          <div className="header-wallet-tools">
            <BalanceToggle
              balances={balances}
              selected={selectedBalance}
              expanded={balanceExpanded}
              onSelect={(currency) => {
                setSelectedBalance(currency);
                setBalanceExpanded(false);
              }}
              onToggleExpanded={() => setBalanceExpanded((value) => !value)}
            />
            <button className="wallet-plus-button" type="button" aria-label="Purchase coin packs" onClick={openPurchasePacks}>+</button>
          </div>
        </header>
        <div className="balance-strip desktop-balance-strip">
          <div className="header-wallet-tools">
            <BalanceToggle
              balances={balances}
              selected={selectedBalance}
              expanded={balanceExpanded}
              onSelect={(currency) => {
                setSelectedBalance(currency);
                setBalanceExpanded(false);
              }}
              onToggleExpanded={() => setBalanceExpanded((value) => !value)}
            />
            <button className="wallet-plus-button" type="button" aria-label="Purchase coin packs" onClick={openPurchasePacks}>+</button>
          </div>
        </div>

        {activeView === "lobby" && (
          <LobbyPage
            onPlay={playGame}
            onTablePlay={playTableGame}
            onWallet={() => setView("wallet")}
            onRewards={() => setView("rewards")}
            onSlots={() => setView("games")}
            onGames={() => setView("tableGames")}
          />
        )}
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
        {activeView === "rewards" && <RewardsPage onWallet={() => setView("wallet")} />}
        {activeView === "wallet" && <WalletPage key={`wallet-${walletPanelKey}`} initialPanel={walletPanel} />}
        {activeView === "redemption" && <WalletPage initialPanel="redeem" />}
        {activeView === "account" && <AccountPage />}
        {activeView === "terms" && <LegalPage kind="terms" />}
        {activeView === "sweepstakesRules" && <LegalPage kind="sweepstakesRules" />}
        {activeView === "privacy" && <LegalPage kind="privacy" />}
        {activeView === "responsiblePlay" && <LegalPage kind="responsiblePlay" />}
        {activeView === "eligibility" && <LegalPage kind="eligibility" />}
        {activeView === "admin" && user.roles.includes("ADMIN") && <AdminPage />}
        <div className="mobile-compliance">
          <ComplianceNotice compact />
        </div>
      </main>

      {!hideMobileNav && <MobileTabBar activeView={activeView} roles={user.roles} onChange={setView} />}
      {showOnboarding && (
        <Modal title="Welcome to the Demo Casino" onClose={() => undefined}>
          <div className="modal-stack">
            <p>{COMPLIANCE_COPY}</p>
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
      {purchaseModalOpen && (
        <PurchaseCoinsModal
          onClose={() => setPurchaseModalOpen(false)}
          onPurchased={() => setWalletPanelKey((value) => value + 1)}
        />
      )}
    </div>
  );
}
