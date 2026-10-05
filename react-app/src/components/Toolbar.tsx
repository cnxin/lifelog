import { useRef, useState } from "react";
import { CalendarDays, Search, X } from "lucide-react";
import { categories, type Category } from "../domain";
import FilterStrip from "../FilterStrip";
import SortMenu from "../SortMenu";
import Icon from "./CategoryIcon";
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
}) {
  const searchInput = useRef<HTMLInputElement>(null);
  const searchButton = useRef<HTMLButtonElement>(null);
  const sortButtonRef = useRef<HTMLButtonElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const mobileSearchOpen = compact && (searchOpen || query.length > 0);
  function closeSearch() {
    setQuery("");
    if (!compact) return;
    setSearchOpen(false);
    requestAnimationFrame(() => searchButton.current?.focus());
  }

  return (
    <div className="toolbar" data-search-open={mobileSearchOpen}>
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
      <div className="list-tools">
        {compact && (
          <button
            ref={searchButton}
            type="button"
            className="search-toggle icon-button"
            aria-label="打开搜索"
            aria-expanded={mobileSearchOpen}
            aria-controls={mobileSearchOpen ? "days-search" : undefined}
            onClick={() => {
              setSearchOpen(true);
              requestAnimationFrame(() => searchInput.current?.focus());
            }}
          >
            <Search size={18} aria-hidden="true" />
          </button>
        )}
        {(!compact || mobileSearchOpen) && (
          <div className="search" id="days-search">
            <Search size={16} aria-hidden="true" />
            <input
              ref={searchInput}
              autoFocus={compact}
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              aria-label="搜索日子"
              placeholder="搜索日子…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(event) => {
                if (compact && event.key === "Escape") {
                  event.preventDefault();
                  if (!query) closeSearch();
                }
              }}
            />
            {(query || compact) && (
              <button
                aria-label={query ? "清除搜索" : "收起搜索"}
                onClick={closeSearch}
              >
                <X size={15} />
              </button>
            )}
          </div>
        )}
        <SortMenu
          value={sort}
          onChange={setSort}
          open={sortMenuOpen}
          onOpenChange={setSortMenuOpen}
          triggerRef={sortButtonRef}
        />
      </div>
    </div>
  );
}
