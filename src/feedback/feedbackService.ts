let muted = false;

function tone(frequency: number, duration = 0.05) {
  if (muted || typeof AudioContext === "undefined") return;
  const ctx = new AudioContext();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.frequency.value = frequency;
  gain.gain.value = 0.025;
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + duration);
}

export function setMuted(value: boolean) {
  muted = value;
}

export function playClick() { tone(320, 0.035); }
export function playSpin() { tone(180, 0.06); }
export function playWin() { tone(520, 0.08); }
export function playBigWin() { tone(740, 0.11); }
export function playBonus() { tone(900, 0.12); }
