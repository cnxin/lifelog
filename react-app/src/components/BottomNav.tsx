import { Archive, Heart, Home } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

const navItems = [
  { to: "/", label: "首页", icon: Home, match: (pathname: string) => pathname === "/" },
  { to: "/people", label: "档案", icon: Archive, match: (pathname: string) => pathname.startsWith("/people") || pathname.startsWith("/places") },
  { to: "/memories", label: "记录", icon: Heart, match: (pathname: string) => pathname.startsWith("/memories") || pathname.startsWith("/calendar") }
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="bottom-nav" aria-label="主导航">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = item.match(location.pathname);
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={`nav-item ${active ? "active" : ""}`}
          >
            <Icon />
            <span>{item.label}</span>
            <div className="nav-dot" />
          </NavLink>
        );
      })}
    </nav>
  );
}
