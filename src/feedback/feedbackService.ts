const SOUND_STORAGE_KEY = "casino-feedback-sound-enabled";

let soundEnabled = readStoredSoundEnabled();
let audioContext: AudioContext | null = null;

function readStoredSoundEnabled() {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(SOUND_STORAGE_KEY) === "true";
}

function persistSoundEnabled(value: boolean) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(SOUND_STORAGE_KEY, String(value));
}

function getAudioContext() {
  const AudioContextCtor = globalThis.AudioContext ?? (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return null;
  audioContext ??= new AudioContextCtor();
  return audioContext;
}

function tone(frequency: number, duration = 0.05, gainValue = 0.025, delay = 0) {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.frequency.value = frequency;
  gain.gain.value = gainValue;
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(ctx.currentTime + delay);
  oscillator.stop(ctx.currentTime + delay + duration);
}

export function setMuted(value: boolean) {
  setSoundEnabled(!value);
}

export function setSoundEnabled(value: boolean) {
  soundEnabled = value;
  persistSoundEnabled(value);
}

export function isSoundEnabled() {
  return soundEnabled;
}

export function toggleSoundEnabled() {
  setSoundEnabled(!soundEnabled);
  return soundEnabled;
}

export function playClick() { tone(320, 0.035); }
export function playBet() { tone(260, 0.04); tone(360, 0.035, 0.02, 0.035); }
export function playDeal() { tone(420, 0.045); }
export function playSpin() { tone(180, 0.06); tone(240, 0.08, 0.018, 0.045); }
export function playWin() { tone(520, 0.08); tone(680, 0.08, 0.025, 0.08); }
export function playBigWin() { tone(560, 0.09); tone(760, 0.12, 0.028, 0.09); tone(940, 0.14, 0.026, 0.19); }
export function playLose() { tone(190, 0.08, 0.018); tone(145, 0.08, 0.016, 0.08); }
export function playBonus() { tone(900, 0.12); tone(1120, 0.14, 0.024, 0.11); }
export function playError() { tone(120, 0.075, 0.018); tone(95, 0.09, 0.016, 0.085); }
