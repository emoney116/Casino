import type { WalletBalances } from "../types";

type AuthProviderName = "Supabase" | "Local fallback";
type WalletSource = "supabase" | "local";

interface AuthDebugContext {
  authUserId?: string;
  profileId?: string;
  username?: string;
  supabaseConfigured: boolean;
}

interface WalletDebugState {
  source?: WalletSource;
  userId?: string;
  fetchedRow?: string;
  renderedBalance?: string;
  renderSurface?: string;
}

interface DebugState {
  authProvider: AuthProviderName;
  authContext?: AuthDebugContext;
  lastAuthError?: string;
  lastMirrorError?: string;
  wallet?: WalletDebugState;
}

const debugState: DebugState = {
  authProvider: "Local fallback",
};

export function setDebugAuthProvider(provider: AuthProviderName) {
  debugState.authProvider = provider;
}

export function setDebugAuthContext(context: AuthDebugContext) {
  debugState.authContext = context;
  logDevWalletDebug("auth/profile", context);
}

export function setLastAuthError(error?: unknown) {
  debugState.lastAuthError = error instanceof Error ? error.message : typeof error === "string" ? error : undefined;
}

export function setLastMirrorError(error?: unknown) {
  debugState.lastMirrorError = error instanceof Error ? error.message : typeof error === "string" ? error : undefined;
}

export function setDebugWalletFetch(input: { userId: string; source: WalletSource; fetchedRow?: unknown }) {
  debugState.wallet = {
    ...debugState.wallet,
    userId: input.userId,
    source: input.source,
    fetchedRow: stringifyDebugValue(input.fetchedRow),
  };
  logDevWalletDebug("wallet fetch", {
    userId: input.userId,
    supabaseConfigured: input.source === "supabase",
    walletSource: input.source,
    fetchedWalletRow: input.fetchedRow ?? null,
  });
}

export function setDebugRenderedWalletBalance(input: {
  userId: string;
  surface: string;
  storedBalances: WalletBalances;
  renderedBalances: WalletBalances;
}) {
  debugState.wallet = {
    ...debugState.wallet,
    userId: input.userId,
    renderSurface: input.surface,
    renderedBalance: stringifyDebugValue({
      stored: input.storedBalances,
      rendered: input.renderedBalances,
    }),
  };
  logDevWalletDebug("final rendered wallet balance", {
    currentUserId: input.userId,
    surface: input.surface,
    storedWalletBalance: input.storedBalances,
    finalRenderedWalletBalance: input.renderedBalances,
  });
}

export function getDebugState() {
  return { ...debugState };
}

function stringifyDebugValue(value: unknown) {
  if (value === undefined) return undefined;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function logDevWalletDebug(label: string, payload: unknown) {
  const env = (import.meta as ImportMeta & { env?: Record<string, unknown> }).env;
  if (!env?.DEV) return;
  console.log(`[wallet-debug] ${label}`, payload);
}
