import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";

interface PersonPickerProps {
  people: Array<{ id: string; name: string }>;
  defaultSelected?: string[];
  value?: string[];
  onChange?: (ids: string[]) => void;
  name?: string;
}

export default function PersonPicker({
  people,
  defaultSelected = [],
  value,
  onChange,
  name = "personIds"
}: PersonPickerProps) {
  const isControlled = value !== undefined;
  const [internalSelected, setInternalSelected] = useState<string[]>(() =>
    defaultSelected.filter((id) => people.some((person) => person.id === id))
  );
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const selected = isControlled ? value : internalSelected;

  const selectedPeople = useMemo(
    () => selected.map((id) => people.find((person) => person.id === id)).filter(Boolean) as typeof people,
    [people, selected]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people
      .filter((person) => !selected.includes(person.id))
      .filter((person) => (q ? person.name.toLowerCase().includes(q) : true))
      .slice(0, 12);
  }, [people, selected, query]);

  function setSelected(nextSelected: string[]) {
    if (!isControlled) setInternalSelected(nextSelected);
    onChange?.(nextSelected);
  }

  function add(id: string) {
    setSelected(selected.includes(id) ? selected : [...selected, id]);
    setQuery("");
    setIsOpen(false);
  }

  function remove(id: string) {
    setSelected(selected.filter((item) => item !== id));
  }

  function handleBlur() {
    window.setTimeout(() => setIsOpen(false), 120);
  }

  return (
    <div className={isOpen ? "person-picker open" : "person-picker"}>
      {selected.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}

      {selectedPeople.length > 0 && (
        <div className="person-picker-selected">
          {selectedPeople.map((person) => (
            <button
              type="button"
              key={person.id}
              className="picker-chip"
              onClick={() => remove(person.id)}
              aria-label={`移除 ${person.name}`}
            >
              <span>{person.name}</span>
              <X size={14} />
            </button>
          ))}
        </div>
      )}

      {people.length === 0 ? (
        <p className="form-hint">还没有人物，可以先保存回忆，后续再关联。</p>
      ) : (
        <>
          <div className="person-picker-search">
            <Search size={16} />
            <input
              type="text"
              value={query}
              onFocus={() => setIsOpen(true)}
              onBlur={handleBlur}
              onChange={(event) => {
                setQuery(event.target.value);
                setIsOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") setIsOpen(false);
              }}
              placeholder={selected.length ? "继续添加人物" : "搜索人物名字"}
              aria-label="搜索人物"
            />
          </div>

          {isOpen && filtered.length > 0 && (
            <ul className="person-picker-results" role="listbox">
              {filtered.map((person) => (
                <li key={person.id}>
                  <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => add(person.id)}>
                    {person.name}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {isOpen && !filtered.length && query.trim() && (
            <p className="form-hint">没有匹配的人物，去“人物”页可以新增。</p>
          )}
        </>
      )}
    </div>
  );
}
