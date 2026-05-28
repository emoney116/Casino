import { ArrowLeft, ExternalLink } from "lucide-react";
import type { MouseEvent } from "react";
import { PlayheaterMark } from "../branding/playheater";
import { DRAFT_LEGAL_PLACEHOLDER, eligibilityConfig } from "../config/complianceConfig";

export type LegalPageKind = "support" | "terms" | "sweepstakesRules" | "privacy" | "responsiblePlay" | "eligibility";

interface LegalSection {
  title: string;
  points: string[];
}

const pageContent: Record<LegalPageKind, { title: string; eyebrow: string; intro: string; sections: LegalSection[] }> = {
  support: {
    title: "Support",
    eyebrow: "Player Care",
    intro: "Fast answers for account access, profile settings, wallet questions, and responsible play controls in this prototype.",
    sections: [
      {
        title: "Common Help",
        points: [
          "Account and profile changes are handled from the Account page.",
          "Wallet activity can be reviewed from Wallet history.",
          "Redemptions are not enabled in prototype mode.",
        ],
      },
      {
        title: "Contact",
        points: [
          "Use support@playheater.com as the draft support inbox.",
          "Include your display name and a short description of the issue.",
          "Never send passwords or sensitive identity documents through this prototype.",
        ],
      },
    ],
  },
  terms: {
    title: "Terms",
    eyebrow: "Account Rules",
    intro: "These draft terms outline expected account behavior, virtual coin usage, and prototype restrictions.",
    sections: [
      {
        title: "Account Use",
        points: [
          "Players are responsible for keeping account access secure.",
          "One account per person is expected unless approved by PLAYHEATER.",
          "Abusive behavior, fraud, automation, or attempts to manipulate game systems may lead to suspension.",
        ],
      },
      {
        title: "Virtual Coins",
        points: [
          "Gold Coins are entertainment-only virtual credits and have no cash value.",
          "Sweeps Coins are shown for prototype testing and redemptions are not currently enabled.",
          "Balances, purchases, and bonuses may be reset while the prototype is under development.",
        ],
      },
      {
        title: "Prototype Limits",
        points: [
          "Features may change, break, or be removed before launch.",
          "No real-money gambling, deposits, or redemptions are available in this prototype.",
        ],
      },
    ],
  },
  sweepstakesRules: {
    title: "Sweeps Rules",
    eyebrow: "Promotional Play",
    intro: "Draft sweepstakes rules for future counsel review before any public launch or redemption flow.",
    sections: [
      {
        title: "No Purchase Necessary",
        points: [
          "A compliant Alternate Method of Entry must be defined before launch.",
          "Free promotional coin request mechanics are not enabled in this prototype.",
          "Odds, prize limits, expiration, and request processing rules require legal review.",
        ],
      },
      {
        title: "Eligibility",
        points: [
          "Players must meet minimum age and location requirements.",
          "Restricted states, territories, and countries must be enforced before launch.",
          "Identity review may be required before any future redemption.",
        ],
      },
      {
        title: "Redemption",
        points: [
          "Redemptions are not currently enabled.",
          "Future redemption rules must cover minimums, verification, timing, rejection reasons, and tax handling.",
        ],
      },
    ],
  },
  privacy: {
    title: "Privacy",
    eyebrow: "Data Practices",
    intro: "Draft privacy content describing the categories of data PLAYHEATER expects to handle.",
    sections: [
      {
        title: "Data We Collect",
        points: [
          "Account details such as email, display name, avatar, and login state.",
          "Wallet, reward, game session, and responsible play settings.",
          "Device, diagnostics, analytics, and support communications where enabled.",
        ],
      },
      {
        title: "How Data Is Used",
        points: [
          "To operate accounts, balances, gameplay, rewards, and support workflows.",
          "To detect abuse, troubleshoot issues, and improve product quality.",
          "To support future compliance, identity, eligibility, and redemption reviews.",
        ],
      },
      {
        title: "Choices",
        points: [
          "Players can update display name and avatar from Account.",
          "Responsible play settings are stored locally in this prototype.",
          "A launch privacy policy must describe deletion, access, and opt-out rights.",
        ],
      },
    ],
  },
  responsiblePlay: {
    title: "Responsible Play",
    eyebrow: "Player Safety",
    intro: "Practical controls and support resources for keeping play intentional and entertainment-focused.",
    sections: [
      {
        title: "Available Controls",
        points: [
          "Session reminders can be set for 15, 30, or 60 minute intervals.",
          "Daily Gold Coin spending limits can be configured from Account.",
          "Self-exclusion locks game launch in this prototype once confirmed.",
        ],
      },
      {
        title: "Healthy Play",
        points: [
          "Set a time and budget before starting a session.",
          "Take breaks when play stops feeling fun.",
          "Do not treat virtual coin play as income or financial strategy.",
        ],
      },
      {
        title: "Support Resources",
        points: [
          "If gambling or gaming no longer feels controlled, consider speaking with a trusted person or professional support provider.",
          "Launch content should include jurisdiction-specific responsible gaming resources.",
        ],
      },
    ],
  },
  eligibility: {
    title: "Eligibility",
    eyebrow: "Who Can Play",
    intro: "Draft eligibility rules for age, location, account standing, and future redemption access.",
    sections: [
      {
        title: "Minimum Requirements",
        points: [
          `Minimum age placeholder: ${eligibilityConfig.minimumAge}.`,
          "Players must be in a supported jurisdiction and comply with local rules.",
          "Accounts must remain in good standing to use gameplay and rewards features.",
        ],
      },
      {
        title: "Location Rules",
        points: [
          `Allowed states: ${eligibilityConfig.allowedStates.join(", ") || "not configured"}.`,
          `Restricted states: ${eligibilityConfig.restrictedStates.join(", ") || "not configured"}.`,
          `Redemption restricted states: ${eligibilityConfig.redemptionRestrictedStates.join(", ") || "not configured"}.`,
          `Supported countries: ${eligibilityConfig.countrySupport.join(", ") || "not configured"}.`,
        ],
      },
      {
        title: "Future Verification",
        points: [
          "Geolocation and identity checks must be reliable before launch.",
          "Redemption eligibility may require additional review and documentation.",
        ],
      },
    ],
  },
};

export function LegalPage({ kind, onBack }: { kind: LegalPageKind; onBack?: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  const page = pageContent[kind];
  return (
    <section className="legal-page page-stack">
      <header className="legal-hero">
        <a className="legal-back-button" href="/account" onClick={onBack}>
          <ArrowLeft size={18} />
          Account
        </a>
        <div className="legal-brand-line">
          <PlayheaterMark />
          <span>{page.eyebrow}</span>
        </div>
        <h1>{page.title}</h1>
        <p>{page.intro}</p>
        <div className="legal-disclaimer">{DRAFT_LEGAL_PLACEHOLDER}</div>
      </header>

      <div className="legal-section-list">
        {page.sections.map((section) => (
          <article className="legal-section-card" key={section.title}>
            <h2>{section.title}</h2>
            <ul>
              {section.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      {kind === "support" && (
        <a className="legal-support-link" href="mailto:support@playheater.com">
          <span>Email Support</span>
          <ExternalLink size={16} />
        </a>
      )}
    </section>
  );
}
