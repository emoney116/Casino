import { COMPLIANCE_COPY } from "../lib/compliance";

export function ComplianceNotice({ compact = false }: { compact?: boolean }) {
  return (
    <footer className={compact ? "compliance compact" : "compliance"}>
      {COMPLIANCE_COPY}
    </footer>
  );
}
