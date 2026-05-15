const SOUND_STORAGE_KEY = "casino-feedback-sound-enabled";

let soundEnabled = readStoredSoundEnabled();
let audioContext: AudioContext | null = null;
const feedbackDebugCounts: Record<string, number> = {};

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
  try {
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
  } catch {
    audioContext = null;
  }
}

function swoosh(startFrequency: number, endFrequency: number, duration = 0.11, gainValue = 0.014) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(startFrequency, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, ctx.currentTime + duration);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(gainValue, ctx.currentTime + 0.014);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + duration + 0.015);
  } catch {
    audioContext = null;
  }
}

function mark(name: string) {
  feedbackDebugCounts[name] = (feedbackDebugCounts[name] ?? 0) + 1;
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

export function getFeedbackDebugCount(name: string) {
  return feedbackDebugCounts[name] ?? 0;
}

export function resetFeedbackDebugCounts() {
  Object.keys(feedbackDebugCounts).forEach((key) => delete feedbackDebugCounts[key]);
}

export function playClick() { mark("playClick"); tone(320, 0.035); }
export function playBet() { mark("playBet"); tone(260, 0.04); tone(360, 0.035, 0.02, 0.035); }
export function playDeal() { mark("playDeal"); tone(420, 0.045); }
export function playCardDeal() { mark("playCardDeal"); swoosh(760, 240, 0.105, 0.012); }
export function playCardFlip() { mark("playCardFlip"); tone(520, 0.035, 0.014); tone(310, 0.065, 0.011, 0.04); }
export function playChip() { mark("playChip"); tone(720, 0.025, 0.015); tone(480, 0.035, 0.012, 0.025); }
export function playSpin() { mark("playSpin"); tone(180, 0.06); tone(240, 0.08, 0.018, 0.045); }
export function playWin() { mark("playWin"); tone(520, 0.08); tone(680, 0.08, 0.025, 0.08); }
export function playBlackjackWin() { mark("playBlackjackWin"); tone(620, 0.08, 0.024); tone(820, 0.1, 0.025, 0.08); tone(1040, 0.12, 0.022, 0.17); }
export function playPush() { mark("playPush"); tone(330, 0.07, 0.014); tone(330, 0.055, 0.011, 0.075); }
export function playBigWin() { mark("playBigWin"); tone(560, 0.09); tone(760, 0.12, 0.028, 0.09); tone(940, 0.14, 0.026, 0.19); }
export function playLose() { mark("playLose"); tone(190, 0.08, 0.018); tone(145, 0.08, 0.016, 0.08); }
export function playBonus() { mark("playBonus"); tone(900, 0.12); tone(1120, 0.14, 0.024, 0.11); }
export function playExpansionHit() { mark("playExpansionHit"); swoosh(260, 820, 0.18, 0.018); tone(720, 0.08, 0.02, 0.09); }
export function playMultiplierTick() { mark("playMultiplierTick"); tone(680, 0.035, 0.012); tone(910, 0.04, 0.012, 0.035); }
export function playError() { mark("playError"); tone(120, 0.075, 0.018); tone(95, 0.09, 0.016, 0.085); }
export function playCrashTick(multiplier = 1) { mark("playCrashTick"); tone(Math.min(980, 250 + multiplier * 90), 0.025, 0.01); }
export function playCrashCashOut() { mark("playCrashCashOut"); tone(620, 0.07, 0.024); tone(920, 0.08, 0.022, 0.06); }
export function playCrashSound() { mark("playCrashSound"); tone(170, 0.08, 0.024); tone(85, 0.16, 0.022, 0.07); }
export function playRouletteTick(step = 1) { mark("playRouletteTick"); tone(Math.min(900, 360 + step * 26), 0.018, 0.008); }
export function playRouletteChipPlace() { mark("playRouletteChipPlace"); tone(580, 0.024, 0.018); tone(310, 0.035, 0.011, 0.018); }
export function playRouletteSpinStart() { mark("playRouletteSpinStart"); swoosh(180, 520, 0.32, 0.018); tone(130, 0.09, 0.018); tone(260, 0.11, 0.014, 0.08); }
export function playRouletteBounce(step = 1) { mark("playRouletteBounce"); tone(760 + step * 52, 0.026, 0.014); tone(390 + step * 24, 0.022, 0.009, 0.018); }
export function playRouletteReveal() { mark("playRouletteReveal"); tone(460, 0.065, 0.018); tone(680, 0.075, 0.018, 0.07); tone(940, 0.09, 0.016, 0.15); }
export function playRoulettePayout() { mark("playRoulettePayout"); tone(720, 0.055, 0.02); tone(980, 0.07, 0.018, 0.055); tone(1220, 0.08, 0.016, 0.125); }
export function playDartThrow() { mark("playDartThrow"); swoosh(860, 260, 0.12, 0.013); }
export function playBalloonPop() { mark("playBalloonPop"); tone(760, 0.026, 0.024); tone(240, 0.05, 0.014, 0.018); }
export function playConfettiBurst() { mark("playConfettiBurst"); tone(920, 0.04, 0.018); tone(1180, 0.045, 0.015, 0.035); }
export function playRareBalloonHit() { mark("playRareBalloonHit"); swoosh(340, 980, 0.18, 0.018); tone(1280, 0.12, 0.026, 0.08); }
export function playWinReveal() { mark("playWinReveal"); tone(540, 0.07, 0.018); tone(720, 0.07, 0.018, 0.075); tone(940, 0.09, 0.016, 0.15); }
export function playBrickPaddleHit() { mark("playBrickPaddleHit"); tone(210, 0.025, 0.018); tone(520, 0.036, 0.012, 0.018); }
export function playBrickBreakImpact() { mark("playBrickBreakImpact"); tone(640, 0.034, 0.02); tone(270, 0.055, 0.014, 0.022); }
export function playBrickExplosive() { mark("playBrickExplosive"); swoosh(220, 720, 0.16, 0.02); tone(110, 0.09, 0.022, 0.02); tone(960, 0.08, 0.018, 0.1); }
export function playBrickJackpot() { mark("playBrickJackpot"); swoosh(340, 1120, 0.2, 0.02); tone(720, 0.08, 0.024, 0.08); tone(980, 0.1, 0.022, 0.16); tone(1280, 0.12, 0.018, 0.25); }
export function playBrickCombo() { mark("playBrickCombo"); tone(620, 0.032, 0.014); tone(820, 0.034, 0.012, 0.032); }
