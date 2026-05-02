import type { AppView } from "./navigation";
import { visibleNavItems } from "./navigation";
import type { Role } from "../types";

export function MobileTabBar({
  activeView,
  roles,
  onChange,
}: {
  activeView: AppView;
  roles: Role[];
  onChange: (view: AppView) => void;
}) {
  const hasAdmin = roles.includes("ADMIN");
  return (
    <nav className={hasAdmin ? "mobile-tabbar has-admin" : "mobile-tabbar"} aria-label="Mobile navigation">
      {visibleNavItems(roles).map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            className={activeView === item.id ? "active" : ""}
            onClick={() => onChange(item.id)}
            title={item.label}
          >
            <Icon size={hasAdmin ? 17 : 20} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
