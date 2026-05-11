const logoHorizontal = new URL("../assets/branding/playheater/logo_horizontal.png", import.meta.url).href;
const logoMain = new URL("../assets/branding/playheater/logo_main.png", import.meta.url).href;
const logoMark = new URL("../assets/branding/playheater/logo_mark_clean.png", import.meta.url).href;
const splashScreen = new URL("../assets/branding/playheater/splash_screen.png", import.meta.url).href;
const watermark = new URL("../assets/branding/playheater/watermark.png", import.meta.url).href;

export const PLAYHEATER_BRAND = {
  name: "PLAYHEATER",
  shortName: "HEATER",
  slogan: "Stay Hot.",
  phrases: ["Built for heaters.", "Ride the heater.", "One more spin."],
  assets: {
    logoHorizontal,
    logoMain,
    logoMark,
    splashScreen,
    watermark,
  },
} as const;

export function PlayheaterBrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? "playheater-lockup compact" : "playheater-lockup"}>
      <img src={logoMark} alt="" />
      <span>
        <strong>{compact ? PLAYHEATER_BRAND.shortName : PLAYHEATER_BRAND.name}</strong>
        <em>{PLAYHEATER_BRAND.slogan}</em>
      </span>
    </span>
  );
}

export function PlayheaterWordmark({ className = "" }: { className?: string }) {
  return <img className={`playheater-wordmark ${className}`.trim()} src={logoHorizontal} alt="PLAYHEATER - Stay Hot." />;
}

export function PlayheaterMark({ className = "" }: { className?: string }) {
  return <img className={`playheater-mark ${className}`.trim()} src={logoMark} alt="PLAYHEATER" />;
}
