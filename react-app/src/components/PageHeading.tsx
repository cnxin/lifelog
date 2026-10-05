export default function PageHeading({
  today,
  compact,
}: {
  today: string;
  compact: boolean;
}) {
  const date = new Date(`${today}T12:00:00`);
  return (
    <section className="page-heading">
      <div>
        <p className="eyebrow heading-date">
          {date.toLocaleDateString("zh-CN", {
            month: "long",
            day: "numeric",
            weekday: "long",
          })}
        </p>
        <h1 className={compact ? "sr-only" : undefined}>
          把日子，放在心上<span>。</span>
        </h1>
        <p className="subtitle">有些日子值得期待，有些时光值得记住。</p>
      </div>
      <div className="today">
        <span>
          {date.toLocaleDateString("zh-CN", {
            month: "long",
            day: "numeric",
          })}
        </span>
        <small>
          {date.toLocaleDateString("zh-CN", {
            year: "numeric",
            weekday: "long",
          })}
        </small>
      </div>
    </section>
  );
}
