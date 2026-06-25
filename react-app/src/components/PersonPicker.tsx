import { Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

interface PersonPickerProps {
  people: Array<{ id: string; name: string }>;
  defaultSelected?: string[];
  value?: string[];
  onChange?: (ids: string[]) => void;
  name?: string;
  onCreate?: (name: string) => Promise<string>;
  includeEmptyMarker?: boolean;
  recommendedIds?: string[];
}

export default function PersonPicker({
  people,
  defaultSelected = [],
  value,
  onChange,
  name = "personIds",
  onCreate,
  includeEmptyMarker = false,
  recommendedIds = []
}: PersonPickerProps) {
  const isControlled = value !== undefined;
  const [internalSelected, setInternalSelected] = useState<string[]>(() =>
    defaultSelected.filter((id) => people.some((person) => person.id === id))
  );
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const selected = isControlled ? value : internalSelected;

  const selectedPeople = useMemo(
    () => selected.map((id) => people.find((person) => person.id === id)).filter(Boolean) as typeof people,
    [people, selected]
  );

  const filtered = useMemo(() => {
    const tokens = normalizePickerTokens(query);
    return people
      .filter((person) => !selected.includes(person.id))
      .map((person) => ({ person, score: scorePersonOption(person, tokens) }))
      .filter((item) => !tokens.length || item.score > 0)
      .sort((left, right) => right.score - left.score || left.person.name.localeCompare(right.person.name, "zh-CN"))
      .map((item) => item.person)
      .slice(0, 12);
  }, [people, selected, query]);
  const recommendedPeople = useMemo(
    () => recommendedIds
      .map((id) => people.find((person) => person.id === id))
      .filter((person): person is typeof people[number] => Boolean(person && !selected.includes(person.id)))
      .slice(0, 6),
    [people, recommendedIds, selected]
  );

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

  function openSearch() {
    setIsOpen(true);
  }

  async function createAndAdd() {
    const name = query.trim();
    if (!name || !onCreate || isCreating) return;
    setIsCreating(true);
    try {
      const id = await onCreate(name);
      if (id) add(id);
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className={isOpen ? "person-picker open" : "person-picker"}>
      {includeEmptyMarker && selected.length === 0 && <input type="hidden" name={name} value="" />}
      {selected.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}

      <div className="picker-surface">
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
          <div className="picker-empty-action inline">
            <span>还没有人物</span>
            {onCreate && (
              <button type="button" onClick={openSearch}>
                先写名字并关联
              </button>
            )}
          </div>
        ) : (
          <>
            {!query.trim() && recommendedPeople.length > 0 && (
              <div className="picker-recommendations">
                <span>常用推荐</span>
                <div className="picker-recommendation-row">
                  {recommendedPeople.map((person) => (
                    <button type="button" key={person.id} onMouseDown={(event) => event.preventDefault()} onClick={() => add(person.id)}>
                      {person.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!isOpen && (
              <button className="picker-add-button" type="button" onClick={openSearch}>
                <Plus size={15} />
                {selected.length ? "继续添加人物" : "添加人物"}
              </button>
            )}
          </>
        )}
      </div>

      {(isOpen || query.trim()) && (
        <>
          <div className="person-picker-search compact">
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
              placeholder={selected.length ? "继续添加人物" : "搜索姓名、昵称或多个关键词"}
              aria-label="搜索人物"
            />
            {isOpen && (
              <button className="picker-search-close" type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => {
                setQuery("");
                setIsOpen(false);
              }}>
                <X size={14} />
              </button>
            )}
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
            <div className="picker-empty-action">
              <span>没有匹配的人物</span>
              {onCreate ? (
                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => void createAndAdd()} disabled={isCreating}>
                  {isCreating ? "创建中..." : `新增“${query.trim()}”并关联`}
                </button>
              ) : (
                <small>去“人物”页可以新增。</small>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function normalizePickerText(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

function normalizePickerTokens(value: string) {
  const compact = normalizePickerText(value);
  const loose = value
    .toLowerCase()
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  return Array.from(new Set([compact, ...loose].filter(Boolean)));
}

function scorePersonOption(person: { name: string }, tokens: string[]) {
  if (!tokens.length) return 0;
  const name = normalizePickerText(person.name);
  return tokens.reduce((score, token) => {
    if (!name.includes(token)) return score;
    return score + 40 + (name.startsWith(token) ? 20 : 0) + (name === token ? 40 : 0);
  }, 0);
}
