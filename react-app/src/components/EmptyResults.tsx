import { Search } from "lucide-react";
import type { Category } from "../domain";
export default function EmptyResults({
  setFilter,
  setQuery,
}: {
  setFilter: (value: "全部" | Category) => void;
  setQuery: (value: string) => void;
}) {
  return (
    <div className="no-results">
      <Search size={28} />
      <h3>还没有找到这个日子</h3>
      <p>换个关键词，或者看看其他分类。</p>
      <button
        className="secondary"
        onClick={() => {
          setFilter("全部");
          setQuery("");
        }}
      >
        查看全部
      </button>
    </div>
  );
}
