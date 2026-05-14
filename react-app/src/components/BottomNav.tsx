import { CalendarDays, Heart, Home, MapPin, Settings, Users } from "lucide-react";
import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "首页", icon: Home },
  { to: "/people", label: "人物", icon: Users },
  { to: "/places", label: "地点", icon: MapPin },
  { to: "/memories", label: "回忆", icon: Heart },
  { to: "/calendar", label: "日历", icon: CalendarDays },
  { to: "/settings", label: "设置", icon: Settings }
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="主导航">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <Icon />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
