import type { RefObject } from "react";
import { Search, X } from "lucide-react";

export default function SearchField({ compact, query, setQuery, inputRef, close }: {
  compact: boolean;
  query: string;
  setQuery: (query: string) => void;
  inputRef: RefObject<HTMLInputElement>;
  close: () => void;
}) {
  return <div className="search" id="days-search">
    <Search size={16} aria-hidden="true" />
    <input ref={inputRef} autoFocus={compact} type="search" enterKeyHint="search" autoComplete="off"
      aria-label="搜索日子" placeholder="搜索日子…" value={query}
      onChange={event => setQuery(event.target.value)}
      onKeyDown={event => {
        if (compact && event.key === "Escape") { event.preventDefault(); close(); }
      }} />
    {(query || compact) && <button aria-label={query ? "清除搜索" : "收起搜索"} onClick={close}>
      <X size={15} />
    </button>}
  </div>;
}
