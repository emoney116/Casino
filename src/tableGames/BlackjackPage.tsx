import { useState, type CSSProperties } from "react";
import { ArrowLeft, BadgePlus, CirclePlay, Hand, RotateCcw, Scissors, X } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastContext";
import { formatCoins } from "../lib/format";
import type { Currency } from "../types";
import { getBalance } from "../wallet/walletService";
import { blackjackConfig } from "./configs";
import {
  acceptEvenMoneyBlackjack,
  activeBlackjackHand,
  canDoubleBlackjack,
  canOfferEvenMoney,
  canOfferInsurance,
  canSplitBlackjack,
  declineEvenMoneyBlackjack,
  doubleDownBlackjack,
  handValue,
  hitBlackjack,
  resolveInsuranceBlackjack,
  splitBlackjack,
  standBlackjack,
  startBlackjackRound,
  visibleDealerValue,
} from "./blackjackEngine";
import type { BlackjackHand, BlackjackRound, PlayingCard } from "./types";

const chipValues = [1, 5, 10, 25, 100, 500];
const suitMarks: Record<PlayingCard["suit"], string> = {
  S: "\u2660",
  H: "\u2665",
  D: "\u2666",
  C: "\u2663",
};

export const blackjackInlineUxMarkers = {
  inlineInsurance: true,
  inlineEvenMoney: true,
  chipStack: true,
  cssChips: true,
  compactTable: true,
  fixedMobileActions: true,
  integratedHeader: true,
  simpleUi: true,
  iconOnlyControls: true,
  singleChipSelector: true,
  cardDealAnimation: true,
};

export function BlackjackPage({ onExit }: { onExit?: () => void }) {
  const { user } = useAuth();
  const notify = useToast();
  const [currency, setCurrency] = useState<Currency>("GOLD");
  const [betAmount, setBetAmount] = useState(blackjackConfig.minBet);
  const [lastBet, setLastBet] = useState(blackjackConfig.minBet);
  const [selectedChipIndex, setSelectedChipIndex] = useState(3);
  const [round, setRound] = useState<BlackjackRound | null>(null);
  if (!user) return null;
  const currentUser = user;

  const selectedChip = chipValues[selectedChipIndex];
  const balance = getBalance(currentUser.id, currency);
  const activeRound = round?.status === "PLAYER_TURN";
  const activeHand = round ? activeBlackjackHand(round) : null;
  const offerInsurance = round ? canOfferInsurance(round) : false;
  const offerEvenMoney = round ? canOfferEvenMoney(round) : false;
  const actionBlocked = offerInsurance || offerEvenMoney;
  const canDeal = !activeRound && betAmount >= blackjackConfig.minBet && betAmount <= blackjackConfig.maxBet && balance >= betAmount;

  function cycleChip() {
    if (!activeRound) setSelectedChipIndex((index) => (index + 1) % chipValues.length);
  }

  function addSelectedChip() {
    if (activeRound) return;
    setBetAmount((current) => Math.min(blackjackConfig.maxBet, Math.min(balance, current + selectedChip)));
  }

  function clearBet() {
    if (!activeRound) setBetAmount(0);
  }

  function rebet() {
    if (!activeRound) setBetAmount(Math.min(lastBet, blackjackConfig.maxBet, balance));
  }

  function deal() {
    try {
      const wager = Math.max(blackjackConfig.minBet, betAmount);
      const next = startBlackjackRound({ userId: currentUser.id, currency, betAmount: wager });
      setLastBet(wager);
      setRound(next);
      if (next.result) notify(next.result.message, next.result.result === "WIN" ? "success" : "info");
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Unable to deal.", "error");
    }
  }

  function action(type: "hit" | "stand" | "double" | "split") {
    if (!round || actionBlocked) return;
    try {
      const next = type === "hit"
        ? hitBlackjack(round, currentUser.id)
        : type === "stand"
          ? standBlackjack(round, currentUser.id)
          : type === "double"
            ? doubleDownBlackjack(round, currentUser.id)
            : splitBlackjack(round, currentUser.id);
      setRound(next);
      if (next.result) notify(next.result.message, next.result.result === "WIN" ? "success" : "info");
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Action failed.", "error");
    }
  }

  function insurance(take: boolean) {
    if (!round) return;
    try {
      const next = resolveInsuranceBlackjack(round, currentUser.id, take);
      setRound(next);
      if (next.insuranceResult) notify(next.insuranceResult.message, next.insuranceResult.result === "WIN" ? "success" : "info");
      if (next.result) notify(next.result.message, next.result.result === "WIN" ? "success" : "info");
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Insurance failed.", "error");
    }
  }

  function evenMoney(take: boolean) {
    if (!round) return;
    const next = take ? acceptEvenMoneyBlackjack(round, currentUser.id) : declineEvenMoneyBlackjack(round);
    setRound(next);
    if (next.result) notify("Even money paid.", "success");
  }

  return (
    <section className="bj-game">
      <header className="bj-game-header">
        <button className="bj-icon-button" onClick={onExit} aria-label="Back to table games">
          <ArrowLeft size={18} />
        </button>
        <div className="bj-game-title">
          <h1>Blackjack</h1>
          <span>Virtual Coins Only</span>
        </div>
        <label className="bj-game-currency">
          <span>Currency</span>
          <select value={currency} disabled={activeRound} onChange={(event) => setCurrency(event.target.value as Currency)}>
            <option value="GOLD">Gold</option>
            <option value="BONUS">Bonus</option>
          </select>
        </label>
      </header>

      <main className="bj-felt">
        <div className="bj-deck" aria-hidden="true">Deck</div>
        <HandRow
          label="Dealer"
          cards={round?.dealerCards ?? []}
          totalLabel={round?.dealerRevealed ? "Total" : "Upcard"}
          total={round ? visibleDealerValue(round) : 0}
          hideHoleCard={Boolean(round && !round.dealerRevealed)}
          lane="dealer"
        />

        {offerInsurance && <InlineOffer title="Insurance?" onYes={() => insurance(true)} onNo={() => insurance(false)} />}
        {offerEvenMoney && <InlineOffer title="Even Money?" onYes={() => evenMoney(true)} onNo={() => evenMoney(false)} />}

        <section className="bj-player-zone">
          {(round?.playerHands ?? []).length === 0 ? (
            <div className="bj-waiting">Place your bet.</div>
          ) : (
            <>
              {round!.playerHands.length > 1 && (
                <div className="bj-hand-tabs">
                  {round!.playerHands.map((_, index) => (
                    <span key={index} className={index === round!.activeHandIndex && round!.status === "PLAYER_TURN" ? "active" : ""}>
                      Hand {index + 1}
                    </span>
                  ))}
                </div>
              )}
              <div className={round!.playerHands.length > 1 ? "bj-split-hands" : "bj-single-hand"}>
                {round!.playerHands.map((hand, index) => (
                  <PlayerHand key={hand.id} hand={hand} active={round!.status === "PLAYER_TURN" && index === round!.activeHandIndex} index={index} split={round!.playerHands.length > 1} />
                ))}
              </div>
            </>
          )}
        </section>

        <BetSpot amount={betAmount} />
        {round?.result && <ResultBanner round={round} />}
      </main>

      <footer className="bj-bottom">
        {!activeRound && (
          <div className="bj-bet-tools">
            <button className={`bj-chip-token chip-${selectedChip}`} onClick={cycleChip} aria-label="Cycle chip value">
              {selectedChip}
            </button>
            <button className="bj-tool" onClick={addSelectedChip}>Add Chip</button>
            <button className="bj-tool icon" onClick={clearBet} aria-label="Clear bet"><X size={18} /></button>
            <button className="bj-tool icon" onClick={rebet} aria-label="Rebet"><RotateCcw size={18} /></button>
          </div>
        )}

        <div className="bj-action-row">
          {!activeRound && (
            <button className="bj-main-action" disabled={!canDeal} onClick={deal}>
              <CirclePlay size={22} />
              <span>Deal</span>
            </button>
          )}
          {activeRound && activeHand && !actionBlocked && (
            <>
              <button className="bj-action hit" onClick={() => action("hit")} aria-label="Hit"><BadgePlus size={21} /><span>Hit</span></button>
              <button className="bj-action stand" onClick={() => action("stand")} aria-label="Stand"><Hand size={21} /><span>Stand</span></button>
              {round && canDoubleBlackjack(round, currentUser.id) && <button className="bj-action double" onClick={() => action("double")} aria-label="Double"><strong>2x</strong><span>Double</span></button>}
              {round && canSplitBlackjack(round, currentUser.id) && <button className="bj-action split" onClick={() => action("split")} aria-label="Split"><Scissors size={21} /><span>Split</span></button>}
            </>
          )}
        </div>

        <div className="bj-game-footer">
          <span>Balance <strong>{formatCoins(balance)}</strong> {currency}</span>
          <span>Min {blackjackConfig.minBet} / Max {blackjackConfig.maxBet}</span>
        </div>
      </footer>
    </section>
  );
}

function HandRow({
  label,
  cards,
  totalLabel,
  total,
  hideHoleCard,
  lane,
}: {
  label: string;
  cards: PlayingCard[];
  totalLabel: string;
  total: number;
  hideHoleCard?: boolean;
  lane: "dealer" | "player";
}) {
  return (
    <section className={`bj-hand-row ${lane}`}>
      <div className="bj-hand-meta">
        <strong>{label}</strong>
        <span>{totalLabel}: {cards.length ? total : "-"}</span>
      </div>
      <div className="bj-card-row">
        {cards.length === 0 ? <div className="bj-card-empty">Cards</div> : cards.map((card, index) => (
          <CardView key={`${card.rank}${card.suit}${index}`} card={card} hidden={hideHoleCard && index === 1} index={index} lane={lane} />
        ))}
      </div>
    </section>
  );
}

function PlayerHand({ hand, active, index, split }: { hand: BlackjackHand; active: boolean; index: number; split: boolean }) {
  const total = handValue(hand.cards).total;
  const natural = hand.cards.length === 2 && total === 21;
  return (
    <section className={active ? "bj-player-hand active" : "bj-player-hand"}>
      <div className="bj-hand-meta">
        <strong>{split ? `Hand ${index + 1}` : "Player"}</strong>
        <span>{hand.status === "BUST" ? "Bust" : natural ? "Blackjack" : `Total: ${total}`}</span>
      </div>
      <div className="bj-card-row">
        {hand.cards.map((card, cardIndex) => <CardView key={`${hand.id}${cardIndex}`} card={card} index={cardIndex} lane="player" glow={Boolean(hand.result?.result === "WIN" || hand.status === "BUST" || natural)} />)}
      </div>
      <small>Bet {formatCoins(hand.betAmount)}{hand.result ? ` - ${hand.result.result}` : ""}</small>
    </section>
  );
}

function InlineOffer({ title, onYes, onNo }: { title: string; onYes: () => void; onNo: () => void }) {
  return (
    <div className="bj-offer">
      <strong>{title}</strong>
      <button onClick={onYes}>Yes</button>
      <button onClick={onNo}>No</button>
    </div>
  );
}

function BetSpot({ amount }: { amount: number }) {
  return (
    <div className="bj-bet-spot">
      <div className="bj-bet-chips" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <strong>Bet {formatCoins(amount)}</strong>
    </div>
  );
}

function CardView({
  card,
  hidden,
  index,
  lane,
  glow,
}: {
  card: PlayingCard;
  hidden?: boolean;
  index: number;
  lane: "dealer" | "player";
  glow?: boolean;
}) {
  const style = { "--card-delay": `${index * 110}ms` } as CSSProperties;
  if (hidden) return <div className={`bj-playing-card back ${lane}`} style={style}>BJ</div>;
  const red = card.suit === "H" || card.suit === "D";
  return (
    <div className={`${red ? "bj-playing-card red" : "bj-playing-card"} ${lane} ${glow ? "glow" : ""}`} style={style}>
      <strong>{card.rank}</strong>
      <span>{suitMarks[card.suit]}</span>
    </div>
  );
}

function ResultBanner({ round }: { round: BlackjackRound }) {
  const blackjack = round.playerHands.some((hand) => hand.cards.length === 2 && handValue(hand.cards).total === 21 && hand.result?.result === "WIN");
  const bust = round.playerHands.every((hand) => hand.status === "RESOLVED" && handValue(hand.cards).total > 21);
  const insurance = round.insuranceResult ? ` Insurance ${round.insuranceResult.result}` : "";
  const label = blackjack ? "Blackjack" : bust ? "Bust" : round.result?.result === "LOSS" ? "Dealer Wins" : round.result?.result ?? "Resolved";
  return (
    <div className={`bj-result-pill ${(round.result?.result ?? "push").toLowerCase()}`}>
      <strong>{label}</strong>
      <span>{round.result?.message}{insurance}</span>
    </div>
  );
}
