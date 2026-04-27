type AuthProviderName = "Supabase" | "Local fallback";

interface DebugState {
  authProvider: AuthProviderName;
  lastAuthError?: string;
  lastMirrorError?: string;
}

const debugState: DebugState = {
  authProvider: "Local fallback",
};

export function setDebugAuthProvider(provider: AuthProviderName) {
  debugState.authProvider = provider;
}

export function setLastAuthError(error?: unknown) {
  debugState.lastAuthError = error instanceof Error ? error.message : typeof error === "string" ? error : undefined;
}

export function setLastMirrorError(error?: unknown) {
  debugState.lastMirrorError = error instanceof Error ? error.message : typeof error === "string" ? error : undefined;
}

export function getDebugState() {
  return { ...debugState };
}
