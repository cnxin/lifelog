import { useNavigate } from "react-router-dom";

interface HeaderProps {
  dateLabel: string;
  title: string;
  subtitle: string;
}

export default function Header({ dateLabel, title, subtitle }: HeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="header">
      <div className="greeting">
        {dateLabel && <p className="date-label">{dateLabel}</p>}
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <button className="avatar" aria-label="账号管理" onClick={() => navigate("/account")}>
        L
      </button>
    </header>
  );
}
