import { Search } from "lucide-react";

interface SearchBarProps {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}

export default function SearchBar({ value, placeholder, onChange }: SearchBarProps) {
  return (
    <div className="search-bar">
      <Search />
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
