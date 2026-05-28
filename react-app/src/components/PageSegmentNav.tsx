import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

interface PageSegmentNavItem {
  to: string;
  label: string;
  icon?: ReactNode;
  end?: boolean;
}

export default function PageSegmentNav({ items, ariaLabel }: { items: PageSegmentNavItem[]; ariaLabel: string }) {
  return (
    <nav className="page-segment-nav" aria-label={ariaLabel}>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `page-segment-item ${isActive ? "active" : ""}`}
        >
          {item.icon}
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
