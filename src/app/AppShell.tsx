import { useEffect, useState, type MouseEvent } from "react";
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
import { visibleNavItems } from "./navigation";
import { MobileTabBar } from "./MobileTabBar";
import { Modal } from "../components/Modal";
import { useToast } from "../components/ToastContext";
import { dismissOnboarding, hasDismissedOnboarding } from "./onboarding";
import { TableGamesPage } from "../tableGames/TableGamesPage";
import type { TableGameId } from "../tableGames/types";
import { RewardsPage } from "../retention/RewardsPage";
import { COMPLIANCE_COPY } from "../lib/compliance";
import { LegalPage } from "../legal/LegalPage";
import { PLAYHEATER_BRAND, PlayheaterBrandLockup, PlayheaterMark } from "../branding/playheater";
import {
  RESPONSIBLE_PLAY_UPDATED_EVENT,
  getProfilePreferences,
  isSelfExcluded,
  type ResponsiblePlaySettings,
} from "../account/profileService";

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
  "lava-run": "lavaRun",
  lavaRun: "lavaRun",
  "ember-stack": "emberStack",
  emberStack: "emberStack",
  safecracker: "safecracker",
};

function getRouteFromPath(path: string): { view: AppView; slotGameId: string | null; tableGameId: TableGameId | null } {
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
  if (section === "support") return { view: "support", slotGameId: null, tableGameId: null };
  if (section === "terms") return { view: "terms", slotGameId: null, tableGameId: null };
  if (section === "sweepstakes-rules") return { view: "sweepstakesRules", slotGameId: null, tableGameId: null };
  if (section === "privacy") return { view: "privacy", slotGameId: null, tableGameId: null };
  if (section === "responsible-play") return { view: "responsiblePlay", slotGameId: null, tableGameId: null };
  if (section === "eligibility") return { view: "eligibility", slotGameId: null, tableGameId: null };
  if (section === "admin") return { view: "admin", slotGameId: null, tableGameId: null };
  return { view: "lobby", slotGameId: null, tableGameId: null };
}

function getInitialRoute() {
  return getRouteFromPath(window.location.pathname);
}

export function AppShell() {
  const { user } = useAuth();
  const notify = useToast();
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
  const [responsiblePlaySettings, setResponsiblePlaySettings] = useState<ResponsiblePlaySettings | null>(
    () => user ? getProfilePreferences(user.id).responsiblePlay : null,
  );
  const [sessionReminderOpen, setSessionReminderOpen] = useState(false);
  const [sessionReminderNonce, setSessionReminderNonce] = useState(0);

  useEffect(() => {
    function syncRouteFromHistory() {
      const nextRoute = getInitialRoute();
      setActiveView(nextRoute.view);
      setActiveGameId(nextRoute.slotGameId);
      setActiveTableGameId(nextRoute.tableGameId);
      if (nextRoute.view === "wallet") setWalletPanel(null);
      if (nextRoute.view === "redemption") setWalletPanel("redeem");
    }

    window.addEventListener("popstate", syncRouteFromHistory);
    return () => window.removeEventListener("popstate", syncRouteFromHistory);
  }, []);

  useEffect(() => {
    if (!user) return;
    setResponsiblePlaySettings(getProfilePreferences(user.id).responsiblePlay);
    setSessionReminderOpen(false);

    function syncResponsiblePlay(event: Event) {
      const detail = (event as CustomEvent<{ userId: string; settings: ResponsiblePlaySettings }>).detail;
      if (detail?.userId === user?.id) setResponsiblePlaySettings(detail.settings);
    }

    window.addEventListener(RESPONSIBLE_PLAY_UPDATED_EVENT, syncResponsiblePlay);
    return () => window.removeEventListener(RESPONSIBLE_PLAY_UPDATED_EVENT, syncResponsiblePlay);
  }, [user]);

  useEffect(() => {
    if (!user || !responsiblePlaySettings?.sessionReminderEnabled || sessionReminderOpen) return;
    const delayMs = responsiblePlaySettings.sessionReminderMinutes * 60 * 1000;
    const timer = window.setTimeout(() => setSessionReminderOpen(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [responsiblePlaySettings, sessionReminderNonce, sessionReminderOpen, user]);

  useEffect(() => {
    if (!user || !isSelfExcluded(user.id)) return;
    const route = getRouteFromPath(window.location.pathname);
    if (!route.slotGameId && !route.tableGameId) return;
    notify("Self-exclusion is active. Gameplay is locked until the support team reviews the account.", "error");
    setActiveGameId(null);
    setActiveTableGameId(null);
    setActiveView("account");
    window.history.replaceState(null, "", "/account");
  }, [notify, user]);

  if (!user) return null;
  const currentUser = user;
  const balances = getBalance(currentUser.id);
  const nav = visibleNavItems(currentUser.roles);

  function gameplayBlockedBySelfExclusion() {
    if (!isSelfExcluded(currentUser.id)) return false;
    notify("Self-exclusion is active. Gameplay is locked until the support team reviews the account.", "error");
    setView("account");
    return true;
  }

  function playGame(gameId: string) {
    if (gameplayBlockedBySelfExclusion()) return;
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
                : view === "support"
                  ? "/support"
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

  function accountBack(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    setView("account");
  }

  function openPurchasePacks() {
    if (isSelfExcluded(currentUser.id)) {
      notify("Self-exclusion is active. Coin purchases are locked until the support team reviews the account.", "error");
      setView("account");
      return;
    }
    setPurchaseModalOpen(true);
  }

  function playTableGame(gameId: TableGameId) {
    if (gameplayBlockedBySelfExclusion()) return;
    setActiveTableGameId(gameId);
    setActiveView("tableGames");
    window.history.pushState(null, "", `/games/${gameId === "treasureDig" ? "treasure-dig" : gameId === "brickBreakBonus" ? "brick-break-bonus" : gameId === "balloonPop" ? "balloon-pop" : gameId === "lavaRun" ? "lava-run" : gameId === "emberStack" ? "ember-stack" : gameId}`);
  }

  const hideMobileNav = (activeView === "games" && Boolean(activeGameId)) || (activeView === "tableGames" && Boolean(activeTableGameId));

  return (
    <div className={`shell ${hideMobileNav ? "game-mode" : ""}`}>
      <aside className="sidebar">
        <div className="shell-brand">
          <PlayheaterBrandLockup />
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
        {activeView !== "wallet" && activeView !== "redemption" && activeView !== "account" && <ComplianceNotice compact />}
      </aside>

      <main className="main-panel">
        <header className="mobile-header">
          <div className="shell-brand">
            <PlayheaterMark className="mobile-header-mark" />
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
            <button className={`wallet-plus-button ${selectedBalance === "BONUS" ? "sweeps" : "gold"}`} type="button" aria-label="Purchase coin packs" onClick={openPurchasePacks}>+</button>
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
            <button className={`wallet-plus-button ${selectedBalance === "BONUS" ? "sweeps" : "gold"}`} type="button" aria-label="Purchase coin packs" onClick={openPurchasePacks}>+</button>
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
        {activeView === "support" && <LegalPage kind="support" onBack={accountBack} />}
        {activeView === "terms" && <LegalPage kind="terms" onBack={accountBack} />}
        {activeView === "sweepstakesRules" && <LegalPage kind="sweepstakesRules" onBack={accountBack} />}
        {activeView === "privacy" && <LegalPage kind="privacy" onBack={accountBack} />}
        {activeView === "responsiblePlay" && <LegalPage kind="responsiblePlay" onBack={accountBack} />}
        {activeView === "eligibility" && <LegalPage kind="eligibility" onBack={accountBack} />}
        {activeView === "admin" && currentUser.roles.includes("ADMIN") && <AdminPage />}
        {activeView !== "wallet" && activeView !== "redemption" && activeView !== "account" && (
          <div className="mobile-compliance">
            <ComplianceNotice compact />
          </div>
        )}
      </main>

      {!hideMobileNav && <MobileTabBar activeView={activeView} roles={currentUser.roles} onChange={setView} />}
      {showOnboarding && (
        <Modal title={`Welcome to ${PLAYHEATER_BRAND.name}`} onClose={() => undefined}>
          <div className="modal-stack">
            <p>{COMPLIANCE_COPY}</p>
            <div className="notice-card">
              Claim your daily bonus, pick a HEATER game, and keep the streak alive.
            </div>
            <button
              className="primary-button"
              onClick={() => {
                dismissOnboarding(currentUser.id);
                setShowOnboarding(false);
              }}
            >
              Stay Hot
            </button>
          </div>
        </Modal>
      )}
      {sessionReminderOpen && responsiblePlaySettings?.sessionReminderEnabled && (
        <Modal title="Session Reminder" onClose={() => {
          setSessionReminderOpen(false);
          setSessionReminderNonce((value) => value + 1);
        }}>
          <div className="modal-stack">
            <p>You have been playing for {responsiblePlaySettings.sessionReminderMinutes} minutes.</p>
            <div className="notice-card">
              Take a break, check your balance, or continue when you are ready.
            </div>
            <div className="modal-actions">
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  setSessionReminderOpen(false);
                  setView("account");
                }}
              >
                Account
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  setSessionReminderOpen(false);
                  setSessionReminderNonce((value) => value + 1);
                }}
              >
                Continue
              </button>
            </div>
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
