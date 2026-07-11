import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { animateOrSnap, prefersReducedMotion, SPRING_BOUNCY, SPRING_DEFAULT } from "../utils/motion";
import { isFluidFeatureEnabled } from "../utils/features";

export interface FloatingAction {
  id: string;
  label: string;
  desc: string;
  icon: ReactNode;
  primary?: boolean;
  onClick: () => void;
}

export default function FloatingActionButton({ actions }: { actions: FloatingAction[] }) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const closingRef = useRef(false);
  const fluid = isFluidFeatureEnabled("fluidFab");
  const primaryAction = actions.find((action) => action.primary) || actions[0];

  useEffect(() => {
    if (!open) return;
    function handleRequestClose(event: Event) {
      event.preventDefault();
      closeMenu();
    }
    window.addEventListener("lifelog:request-close-fab-menu", handleRequestClose);
    return () => window.removeEventListener("lifelog:request-close-fab-menu", handleRequestClose);
  }, [open]);

  useEffect(() => {
    if (!visible || !open || !fluid || !menuRef.current || closingRef.current) return;
    const items = Array.from(menuRef.current.querySelectorAll<HTMLElement>(".fab-menu button"));
    const reduced = prefersReducedMotion();
    items.forEach((item, index) => {
      item.style.opacity = "0";
      item.style.transform = "translateY(12px) scale(0.92)";
      window.setTimeout(() => {
        if (closingRef.current) return;
        animateOrSnap(reduced, {
          from: 0,
          to: 1,
          spring: SPRING_BOUNCY,
          onUpdate: (t) => {
            item.style.opacity = String(t);
            item.style.transform = `translateY(${(1 - t) * 12}px) scale(${0.92 + 0.08 * t})`;
          }
        });
      }, index * 40);
    });
  }, [visible, open, fluid, actions.length]);

  function runAction(action: FloatingAction) {
    closeMenu();
    window.setTimeout(() => action.onClick(), fluid ? 40 : 0);
  }

  function openMenu() {
    closingRef.current = false;
    setOpen(true);
    setVisible(true);
  }

  function closeMenu() {
    if (!open && !visible) return;
    if (!fluid || !menuRef.current || prefersReducedMotion()) {
      closingRef.current = false;
      setOpen(false);
      setVisible(false);
      return;
    }
    if (closingRef.current) return;
    closingRef.current = true;
    const items = Array.from(menuRef.current.querySelectorAll<HTMLElement>(".fab-menu button"));
    if (!items.length) {
      closingRef.current = false;
      setOpen(false);
      setVisible(false);
      return;
    }
    items.forEach((item, index) => {
      window.setTimeout(() => {
        animateOrSnap(false, {
          from: 1,
          to: 0,
          spring: SPRING_DEFAULT,
          onUpdate: (t) => {
            item.style.opacity = String(t);
            item.style.transform = `translateY(${(1 - t) * 10}px) scale(${0.94 + 0.06 * t})`;
          },
          onComplete: () => {
            if (index === items.length - 1) {
              closingRef.current = false;
              setOpen(false);
              setVisible(false);
            }
          }
        });
      }, (items.length - 1 - index) * 30);
    });
  }

  if (!actions.length) return null;

  return (
    <div className="fab-container">
      {visible && (
        <>
          <button className="fab-backdrop" aria-label="关闭快捷新增" onClick={closeMenu} type="button" />
          <div className={`fab-menu${fluid ? " fab-menu--fluid" : ""}`} role="menu" aria-label="快捷操作" ref={menuRef}>
            {actions.map((action) => (
              <button
                type="button"
                role="menuitem"
                className={`pressable${action.primary ? " primary" : ""}`}
                key={action.id}
                onClick={() => runAction(action)}
              >
                <span className="fab-menu-icon">{action.icon}</span>
                <span>
                  <strong>{action.label}</strong>
                  <small>{action.desc}</small>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
      <button
        className={`fab pressable ${open ? "open" : ""}`}
        aria-label={open ? "关闭快捷操作" : primaryAction.label}
        aria-expanded={open}
        type="button"
        onClick={() => (open ? closeMenu() : openMenu())}
      >
        {open ? <X /> : <Plus />}
      </button>
    </div>
  );
}
