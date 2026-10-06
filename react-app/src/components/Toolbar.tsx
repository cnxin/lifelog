import { useRef } from "react";
import { CalendarDays } from "lucide-react";
import { categories, type Category } from "../domain";
import FilterStrip from "../FilterStrip";
import SortMenu from "../SortMenu";
import Icon from "./CategoryIcon";
import SearchField from "./SearchField";
import type useHomeSearch from "../hooks/useHomeSearch";
export default function Toolbar({
  compact,
  filter,
  setFilter,
  query,
  setQuery,
  sort,
  setSort,
  sortMenuOpen,
  setSortMenuOpen,
  search,
}: {
  compact: boolean;
  filter: "全部" | Category;
  setFilter: (filter: "全部" | Category) => void;
  query: string;
  setQuery: (query: string) => void;
  sort: string;
  setSort: (sort: string) => void;
  sortMenuOpen: boolean;
  setSortMenuOpen: (open: boolean) => void;
  search: ReturnType<typeof useHomeSearch>;
}) {
  const sortButtonRef = useRef<HTMLButtonElement>(null);

  const filters = (
    <FilterStrip>
      {(["全部", ...categories] as const).map((item) => (
        <button
          key={item}
          aria-pressed={filter === item}
          className={filter === item ? "active" : ""}
          onClick={() => setFilter(item)}
        >
          {item === "全部" ? (
            <CalendarDays size={16} />
          ) : (
            <Icon category={item} size={16} />
          )}
          {item}
        </button>
      ))}
    </FilterStrip>
  );
  const tools = (
    <div className="list-tools">
      {!compact && <SearchField compact={false} query={query} setQuery={setQuery}
        inputRef={search.inputRef} close={search.close} />}
      <SortMenu
        value={sort}
        onChange={setSort}
        open={sortMenuOpen}
        onOpenChange={setSortMenuOpen}
        triggerRef={sortButtonRef}
      />
    </div>
  );
  return (
    <div className="toolbar" data-search-open={search.open}>
      {compact ? (
        <>
          <div className="toolbar-row">
            {filters}
            {tools}
          </div>
        </>
      ) : (
        <>{filters}{tools}</>
      )}
    </div>
  );
}
