import { DRAFT_LEGAL_PLACEHOLDER, eligibilityConfig } from "../config/complianceConfig";

export type LegalPageKind = "terms" | "sweepstakesRules" | "privacy" | "responsiblePlay" | "eligibility";

const pageContent: Record<LegalPageKind, { title: string; sections: Array<{ title: string; body: string }> }> = {
  terms: {
    title: "Terms",
    sections: [
      { title: "Prototype Terms Placeholder", body: "Terms content will define account use, virtual currency rules, promotional currency rules, dispute handling, and platform restrictions." },
    ],
  },
  sweepstakesRules: {
    title: "Sweepstakes Rules",
    sections: [
      { title: "No Purchase Necessary Placeholder", body: "Future rules must describe Alternate Method of Entry, free promotional coin request mechanics, mail-in/free entry rules, odds, eligibility, and prize/redemption limitations before launch." },
      { title: "Free Promotional Coin Request", body: "Processing is not enabled. This section is reserved for a compliance-reviewed request flow." },
      { title: "Mail-In / Free Entry Rules", body: "Draft placeholder for future AMOE instructions. No mail-in processing exists in this prototype." },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    sections: [
      { title: "Privacy Placeholder", body: "Future policy must describe data collection, identity checks, analytics, retention, user rights, and processor disclosures." },
    ],
  },
  responsiblePlay: {
    title: "Responsible Play",
    sections: [
      { title: "Responsible Play Placeholder", body: "Future controls may include reminders, limits, cooldowns, self-exclusion, support resources, and account restrictions." },
    ],
  },
  eligibility: {
    title: "Eligibility",
    sections: [
      { title: "Eligibility Placeholder", body: `Minimum age placeholder: ${eligibilityConfig.minimumAge}. TODO: future geofencing should evaluate allowed states, restricted states, redemption-restricted states, and country support when reliable location data exists.` },
      { title: "Geo Configuration Placeholder", body: `Allowed states: ${eligibilityConfig.allowedStates.join(", ") || "not configured"}. Restricted states: ${eligibilityConfig.restrictedStates.join(", ") || "not configured"}. Redemption restricted states: ${eligibilityConfig.redemptionRestrictedStates.join(", ") || "not configured"}. Countries: ${eligibilityConfig.countrySupport.join(", ") || "not configured"}.` },
    ],
  },
};

export function LegalPage({ kind }: { kind: LegalPageKind }) {
  const page = pageContent[kind];
  return (
    <section className="page-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Draft placeholder</p>
          <h1>{page.title}</h1>
          <p className="muted">{DRAFT_LEGAL_PLACEHOLDER}</p>
        </div>
      </div>
      {page.sections.map((section) => (
        <article className="card" key={section.title}>
          <h2>{section.title}</h2>
          <p className="muted">{section.body}</p>
          <div className="warning">{DRAFT_LEGAL_PLACEHOLDER}</div>
        </article>
      ))}
    </section>
  );
}
