interface HeaderProps {
  dateLabel: string;
  title: string;
  subtitle: string;
}

export default function Header({ dateLabel, title, subtitle }: HeaderProps) {
  return (
    <header className="header">
      <div className="greeting">
        <p className="date-label">{dateLabel}</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <button className="avatar" aria-label="个人资料">
        L
      </button>
    </header>
  );
}
