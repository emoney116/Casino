import { isSupabaseConfigured } from "../lib/supabaseClient";
import { setLastMirrorError } from "../lib/debugState";
import { localRepository } from "./localRepository";
import { supabaseRepository } from "./supabaseRepository";

export function getRepository() {
  return isSupabaseConfigured ? supabaseRepository : localRepository;
}

export function mirrorToBackend(action: () => Promise<void>) {
  if (!isSupabaseConfigured) return;
  void action().catch((error) => {
    setLastMirrorError(error);
    console.warn("Supabase mirror failed; localStorage remains source of truth.", error);
  });
}
