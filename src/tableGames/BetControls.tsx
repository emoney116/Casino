import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import type { Currency } from "../types";
import { formatCurrencyDisplay, formatCurrencyFullDisplay, getCurrencyAmountFitClass } from "../lib/format";

export type BetClampOptions = {
  minBet: number;
  maxBet: number;
  balance: number;
  allowDecimals: boolean;
};

export type BetControlsProps = {
  currentBet: number;
  minBet: number;
  maxBet: number;
  balance: number;
  currency: Currency;
  onBetChange: (amount: number) => void;
  increment: number;
  allowDecimals?: boolean;
  showHalfDoubleControls?: boolean;
  disabled?: boolean;
  className?: string;
  leadingInfo?: ReactNode;
  notice?: ReactNode;
  noticeTone?: "default" | "warning";
};

const currencyCopy: Record<Currency, { short: string }> = {
  GOLD: { short: "GC" },
  BONUS: { short: "SC" },
};

export function getEffectiveBetMax(maxBet: number, balance: number) {
  const safeMax = Number.isFinite(maxBet) ? Math.max(0, maxBet) : 0;
  const safeBalance = Number.isFinite(balance) ? Math.max(0, balance) : 0;
  return Math.min(safeMax, safeBalance);
}

export function normalizeBetAmount(value: number, allowDecimals: boolean) {
  if (!Number.isFinite(value)) return 0;
  return allowDecimals ? Math.round(value * 100) / 100 : Math.round(value);
}

export function clampBetAmount(value: number, options: BetClampOptions) {
  const minBet = Number.isFinite(options.minBet) ? Math.max(0, options.minBet) : 0;
  const effectiveMax = getEffectiveBetMax(options.maxBet, options.balance);
  const normalized = normalizeBetAmount(value, options.allowDecimals);
  const fallback = effectiveMax >= minBet ? minBet : effectiveMax;
  const candidate = Number.isFinite(normalized) ? normalized : fallback;
  if (effectiveMax < minBet) return normalizeBetAmount(effectiveMax, options.allowDecimals);
  return normalizeBetAmount(Math.max(minBet, Math.min(effectiveMax, candidate)), options.allowDecimals);
}

export function parseBetInputValue(value: string, allowDecimals: boolean) {
  const normalized = value.trim().replace(/,/g, "");
  if (!normalized || normalized === ".") return null;
  const numericPattern = allowDecimals ? /^\d+(?:\.\d*)?$|^\.\d+$/ : /^\d+$/;
  if (!numericPattern.test(normalized)) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return allowDecimals ? parsed : Math.round(parsed);
}

export function isValidBetInputDraft(value: string, allowDecimals: boolean) {
  const normalized = value.trim().replace(/,/g, "");
  if (normalized === "") return true;
  return allowDecimals ? /^\d*(?:\.\d*)?$/.test(normalized) : /^\d*$/.test(normalized);
}

export function formatBetInputValue(amount: number, allowDecimals: boolean) {
  if (!Number.isFinite(amount)) return "0";
  return allowDecimals ? Number(amount.toFixed(2)).toString() : Math.round(amount).toString();
}

export function BetControls({
  currentBet,
  minBet,
  maxBet,
  balance,
  currency,
  onBetChange,
  increment,
  allowDecimals = currency === "BONUS",
  showHalfDoubleControls = true,
  disabled = false,
  className = "",
  leadingInfo,
  notice,
  noticeTone = "default",
}: BetControlsProps) {
  const [draftValue, setDraftValue] = useState(() => formatBetInputValue(currentBet, allowDecimals));
  const [editing, setEditing] = useState(false);
  const currencyLabel = currencyCopy[currency].short;
  const fullBalance = formatCurrencyFullDisplay(balance, currency);
  const effectiveMax = getEffectiveBetMax(maxBet, balance);
  const warning = currentBet > effectiveMax || currentBet < minBet || noticeTone === "warning";
  const formattedBet = useMemo(() => formatBetInputValue(currentBet, allowDecimals), [allowDecimals, currentBet]);
  const fitClass = getCurrencyAmountFitClass(draftValue || formattedBet);

  useEffect(() => {
    if (!editing) setDraftValue(formattedBet);
  }, [editing, formattedBet]);

  useEffect(() => {
    if (editing) return;
    const clamped = clampBetAmount(currentBet, { minBet, maxBet, balance, allowDecimals });
    if (Math.abs(clamped - currentBet) > 0.0001) onBetChange(clamped);
  }, [allowDecimals, balance, currentBet, editing, maxBet, minBet, onBetChange]);

  function applyBet(value: number) {
    const next = clampBetAmount(value, { minBet, maxBet, balance, allowDecimals });
    setDraftValue(formatBetInputValue(next, allowDecimals));
    onBetChange(next);
  }

  function commitDraft() {
    const parsed = parseBetInputValue(draftValue, allowDecimals);
    if (parsed === null) {
      setDraftValue(formattedBet);
      return;
    }
    applyBet(parsed);
  }

  function updateDraft(value: string) {
    if (!isValidBetInputDraft(value, allowDecimals)) return;
    setDraftValue(value);
  }

  return (
    <article className={`bet-controls currency-${currency === "BONUS" ? "sc" : "gc"} ${warning ? "warning" : ""} ${className}`.trim()}>
      <div className="bet-controls-balance" aria-label={`${currencyLabel} balance`}>
        <span>{currencyLabel} Balance</span>
        <strong title={fullBalance}>{fullBalance}</strong>
      </div>

      <div className="bet-controls-grid">
        <div className="bet-controls-side left" aria-label="Decrease bet controls">
          <button type="button" aria-label="Decrease bet" disabled={disabled} onClick={() => applyBet(currentBet - increment)}>
            <Minus size={16} />
          </button>
          {showHalfDoubleControls && (
            <button type="button" aria-label="Halve bet" disabled={disabled} onClick={() => applyBet(currentBet / 2)}>
              1/2
            </button>
          )}
        </div>

        <label className="bet-controls-center">
          <span>Bet</span>
          <input
            aria-label="Bet amount"
            className={fitClass}
            inputMode={allowDecimals ? "decimal" : "numeric"}
            type="text"
            value={draftValue}
            disabled={disabled}
            onFocus={() => setEditing(true)}
            onChange={(event) => updateDraft(event.currentTarget.value)}
            onBlur={() => {
              commitDraft();
              setEditing(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitDraft();
                event.currentTarget.blur();
              }
              if (event.key === "Escape") {
                setDraftValue(formattedBet);
                event.currentTarget.blur();
              }
            }}
          />
        </label>

        <div className="bet-controls-side right" aria-label="Increase bet controls">
          <button type="button" aria-label="Increase bet" disabled={disabled} onClick={() => applyBet(currentBet + increment)}>
            <Plus size={16} />
          </button>
          {showHalfDoubleControls && (
            <button type="button" aria-label="Double bet" disabled={disabled} onClick={() => applyBet(currentBet * 2)}>
              2x
            </button>
          )}
        </div>
      </div>

      <div className={`bet-controls-note ${noticeTone === "warning" ? "warning" : ""}`.trim()}>
        {notice ? <span className="bet-controls-message">{notice}</span> : leadingInfo ? <span>{leadingInfo}</span> : null}
        <span className="bet-controls-limits">
          <strong>Min {currencyLabel}: {formatCurrencyDisplay(minBet, currency)}</strong>
          <strong>Max {currencyLabel}: {formatCurrencyDisplay(maxBet, currency)}</strong>
        </span>
      </div>
    </article>
  );
}
