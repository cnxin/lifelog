import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface HeaderProps {
  dateLabel: string;
  title: string;
  subtitle: string;
  onSearch: () => void;
  createActions?: HeaderCreateAction[];
}

export interface HeaderCreateAction {
  id: string;
  label: string;
  desc: string;
  icon: ReactNode;
  onClick: () => void;
}

export default function Header({ dateLabel, title, subtitle, onSearch, createActions = [] }: HeaderProps) {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!createOpen) return;
    function handleRequestClose(event: Event) {
      event.preventDefault();
      setCreateOpen(false);
    }
    window.addEventListener("lifelog:request-close-header-create-menu", handleRequestClose);
    return () => window.removeEventListener("lifelog:request-close-header-create-menu", handleRequestClose);
  }, [createOpen]);

  function runCreateAction(action: HeaderCreateAction) {
    setCreateOpen(false);
    action.onClick();
  }

  return (
    <header className="header">
      <div className="greeting">
        {dateLabel && <p className="date-label">{dateLabel}</p>}
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="header-actions">
        <button className="header-icon-button" type="button" aria-label="全局搜索" title="全局搜索 Ctrl/Cmd+K" onClick={onSearch}>
          <Search />
        </button>
        {createActions.length > 0 && (
          <div className="header-create-menu">
            <button
              className={`header-icon-button ${createOpen ? "active" : ""}`}
              type="button"
              aria-label={createOpen ? "关闭新增菜单" : "更多新增"}
              aria-expanded={createOpen}
              onClick={() => setCreateOpen((open) => !open)}
            >
              {createOpen ? <X /> : <Plus />}
            </button>
            {createOpen && (
              <>
                <button className="header-menu-backdrop" type="button" aria-label="关闭新增菜单" onClick={() => setCreateOpen(false)} />
                <div className="header-create-panel" role="menu" aria-label="更多新增">
                  {createActions.map((action) => (
                    <button type="button" role="menuitem" key={action.id} onClick={() => runCreateAction(action)}>
                      <span className="header-create-icon">{action.icon}</span>
                      <span>
                        <strong>{action.label}</strong>
                        <small>{action.desc}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        <button className="avatar" aria-label="账号管理" onClick={() => navigate("/account")}>
          <img
            src="/ingot.png"
            alt="金元宝"
            style={{
              width: '90%',
              height: '90%',
              objectFit: 'contain'
            }}
          />
        </button>
      </div>
    </header>
  );
}
