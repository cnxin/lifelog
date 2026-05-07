import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";

interface PersonPickerProps {
  people: Array<{ id: string; name: string }>;
  defaultSelected?: string[];
  name?: string;
}

export default function PersonPicker({
  people,
  defaultSelected = [],
  name = "personIds"
}: PersonPickerProps) {
  const [selected, setSelected] = useState<string[]>(() =>
    defaultSelected.filter((id) => people.some((person) => person.id === id))
  );
  const [query, setQuery] = useState("");

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

  function add(id: string) {
    setSelected((current) => (current.includes(id) ? current : [...current, id]));
    setQuery("");
  }

  function remove(id: string) {
    setSelected((current) => current.filter((item) => item !== id));
  }

  return (
    <div className="person-picker">
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
              onChange={(event) => setQuery(event.target.value)}
              placeholder={selected.length ? "继续添加人物" : "搜索人物名字"}
              aria-label="搜索人物"
            />
          </div>

          {filtered.length > 0 && (
            <ul className="person-picker-results">
              {filtered.map((person) => (
                <li key={person.id}>
                  <button type="button" onClick={() => add(person.id)}>
                    {person.name}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!filtered.length && query.trim() && (
            <p className="form-hint">没有匹配的人物，去“人物”页可以新增。</p>
          )}
        </>
      )}
    </div>
  );
}
