import { isSupabaseConfigured } from "../lib/supabaseClient";
import { setLastMirrorError } from "../lib/debugState";
import { localRepository } from "./localRepository";
import { supabaseRepository } from "./supabaseRepository";
import type { CasinoRepository } from "./types";

let repositoryOverride: CasinoRepository | null = null;

export function getRepository() {
  return repositoryOverride ?? (isSupabaseConfigured ? supabaseRepository : localRepository);
}

export function mirrorToBackend(action: () => Promise<void>) {
  if (getRepository().mode !== "supabase") return;
  void action().catch((error) => {
    setLastMirrorError(error);
    console.warn("Supabase mirror failed; wallet cache may be out of sync with the database.", error);
  });
}

export function setRepositoryOverrideForTests(repository: CasinoRepository | null) {
  repositoryOverride = repository;
}
