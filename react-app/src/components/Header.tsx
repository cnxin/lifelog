import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface HeaderProps {
  dateLabel: string;
  title: string;
  subtitle: string;
  onSearch: () => void;
}

export default function Header({ dateLabel, title, subtitle, onSearch }: HeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="header">
      <div className="greeting">
        {dateLabel && <p className="date-label">{dateLabel}</p>}
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="header-actions">
        <button className="header-icon-button" type="button" aria-label="全局搜索" onClick={onSearch}>
          <Search />
        </button>
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
