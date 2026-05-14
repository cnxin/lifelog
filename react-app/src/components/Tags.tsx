export default function Tags({ items }: { items: string[] }) {
  return (
    <div className="tags">
      {items.map((item, index) => (
        <span key={`${item}-${index}`} className={`tag ${index % 2 ? "orange" : ""}`}>
          {item}
        </span>
      ))}
    </div>
  );
}
