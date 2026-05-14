import { Search, X } from "lucide-react";
import type { KeyboardEvent } from "react";

interface SearchBarProps {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}

export default function SearchBar({ value, placeholder, onChange }: SearchBarProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    }
  }

  return (
    <div className="search-bar">
      <Search />
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      {value && (
        <button type="button" className="search-clear" aria-label="清除搜索" onClick={() => onChange("")}>
          <X size={16} />
        </button>
      )}
    </div>
  );
}
