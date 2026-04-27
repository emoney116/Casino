const ONBOARDING_KEY = "casino-onboarding-dismissed-v1";

export function hasDismissedOnboarding(userId: string) {
  return localStorage.getItem(`${ONBOARDING_KEY}:${userId}`) === "true";
}

export function dismissOnboarding(userId: string) {
  localStorage.setItem(`${ONBOARDING_KEY}:${userId}`, "true");
}
