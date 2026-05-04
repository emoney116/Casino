export type KycStatus = "NOT_STARTED" | "REQUIRED" | "PENDING" | "APPROVED" | "REJECTED";

export interface EligibilityConfig {
  minimumAge: number;
  restrictedStates: string[];
  allowedStates: string[];
  redemptionRestrictedStates: string[];
  countrySupport: string[];
}

export const eligibilityConfig: EligibilityConfig = {
  minimumAge: 18,
  restrictedStates: [],
  allowedStates: [],
  redemptionRestrictedStates: [],
  countrySupport: ["US"],
};

export const redemptionConfig = {
  enabled: false,
  minimumRedemptionAmount: 100,
  redeemableCurrency: "BONUS" as const,
};

export const defaultKycStatus: KycStatus = "NOT_STARTED";

export const DRAFT_LEGAL_PLACEHOLDER =
  "Draft placeholder. Not legal advice. Must be reviewed by qualified counsel before launch.";
