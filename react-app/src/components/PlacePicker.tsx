import { MapPin, Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

interface PlacePickerProps {
  places: Array<{
    id: string;
    name: string;
    storeName?: string;
    mall?: string;
    area?: string;
    city?: string;
    address?: string;
  }>;
  defaultSelected?: string[];
  value?: string[];
  onChange?: (ids: string[]) => void;
  name?: string;
  onCreate?: (name: string) => Promise<string>;
  includeEmptyMarker?: boolean;
  recommendedIds?: string[];
}

export default function PlacePicker({
  places,
  defaultSelected = [],
  value,
  onChange,
  name = "placeIds",
  onCreate,
  includeEmptyMarker = false,
  recommendedIds = []
}: PlacePickerProps) {
  const isControlled = value !== undefined;
  const [internalSelected, setInternalSelected] = useState<string[]>(() =>
    defaultSelected.filter((id) => places.some((place) => place.id === id))
  );
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const selected = isControlled ? value : internalSelected;

  const selectedPlaces = useMemo(
    () => selected.map((id) => places.find((place) => place.id === id)).filter(Boolean) as typeof places,
    [places, selected]
  );

  const filtered = useMemo(() => {
    const tokens = normalizePickerTokens(query);
    return places
      .filter((place) => !selected.includes(place.id))
      .map((place) => ({ place, score: scorePlaceOption(place, tokens) }))
      .filter((item) => !tokens.length || item.score > 0)
      .sort((left, right) => right.score - left.score || left.place.name.localeCompare(right.place.name, "zh-CN"))
      .map((item) => item.place)
      .slice(0, 12);
  }, [places, selected, query]);
  const recommendedPlaces = useMemo(
    () => recommendedIds
      .map((id) => places.find((place) => place.id === id))
      .filter((place): place is typeof places[number] => Boolean(place && !selected.includes(place.id)))
      .slice(0, 6),
    [places, recommendedIds, selected]
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
    <div className={isOpen ? "person-picker place-picker open" : "person-picker place-picker"}>
      {includeEmptyMarker && selected.length === 0 && <input type="hidden" name={name} value="" />}
      {selected.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}

      <div className={`picker-surface place-picker-surface ${selectedPlaces.length || recommendedPlaces.length ? "has-context" : "empty-context"}`}>
        <div className="picker-context-head">
          <span>{selectedPlaces.length ? `已关联 ${selectedPlaces.length} 处` : recommendedPlaces.length ? "最近用过" : "可先不关联地点"}</span>
          {!isOpen && (
            <button className="picker-inline-add" type="button" onClick={openSearch}>
              <Plus size={14} />
              {selected.length ? "继续加" : "添加"}
            </button>
          )}
        </div>
        {selectedPlaces.length > 0 && (
          <div className="person-picker-selected">
            {selectedPlaces.map((place) => (
              <button
                type="button"
                key={place.id}
                className="picker-chip"
                onClick={() => remove(place.id)}
                aria-label={`移除 ${place.name}`}
              >
                <MapPin size={13} />
                <span>{place.name}</span>
                <X size={14} />
              </button>
            ))}
          </div>
        )}

        {places.length === 0 ? (
          <div className="picker-empty-action inline">
            <span>还没有地点</span>
            {onCreate && (
              <button type="button" onClick={openSearch}>
                先写地点并关联
              </button>
            )}
          </div>
        ) : (
          <>
            {!query.trim() && recommendedPlaces.length > 0 && (
              <div className="picker-recommendations">
                <div className="picker-recommendation-row">
                  {recommendedPlaces.map((place) => (
                    <button type="button" key={place.id} onMouseDown={(event) => event.preventDefault()} onClick={() => add(place.id)}>
                      {formatPlaceOptionTitle(place)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!isOpen && !selectedPlaces.length && !recommendedPlaces.length && (
              <button className="picker-add-button" type="button" onClick={openSearch}>
                <Plus size={15} />
                {selected.length ? "继续添加地点" : "添加地点"}
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
              placeholder={selected.length ? "继续添加地点" : "搜索店名、商场、城市或地址"}
              aria-label="搜索地点"
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
              {filtered.map((place) => (
                <li key={place.id}>
                  <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => add(place.id)}>
                    <span className="place-option-title">
                      <MapPin size={14} />
                      <strong>{formatPlaceOptionTitle(place)}</strong>
                    </span>
                    <span className="place-option-subtitle">{formatPlaceOptionSubtitle(place)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {isOpen && !filtered.length && query.trim() && (
            <div className="picker-empty-action">
              <span>没有匹配的地点</span>
              {onCreate ? (
                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => void createAndAdd()} disabled={isCreating}>
                  {isCreating ? "创建中..." : `新增“${query.trim()}”并关联`}
                </button>
              ) : (
                <small>去“地点”页可以新增。</small>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

type PickerPlace = PlacePickerProps["places"][number];

function getPlaceSearchText(place: PickerPlace) {
  return [
    place.name,
    place.storeName,
    place.mall,
    place.area,
    place.city,
    place.address
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function scorePlaceOption(place: PickerPlace, tokens: string[]) {
  if (!tokens.length) return 0;

  const fields = [
    { value: place.name, score: 80 },
    { value: place.storeName, score: 60 },
    { value: place.mall, score: 45 },
    { value: place.city, score: 30 },
    { value: place.area, score: 25 },
    { value: place.address, score: 20 }
  ];

  const compactSearch = normalizePickerText(getPlaceSearchText(place));
  const tokenScore = tokens.reduce((score, token) => {
    if (!compactSearch.includes(token)) return score;
    return score + 8;
  }, 0);

  if (!tokenScore) return 0;

  return fields.reduce((score, field) => {
    const value = normalizePickerText(field.value || "");
    if (!value) return score;
    const fieldScore = tokens.reduce((sum, token) => {
      if (!value.includes(token)) return sum;
      return sum + field.score + (value.startsWith(token) ? 14 : 0) + (value === token ? 24 : 0);
    }, 0);
    return score + fieldScore;
  }, tokenScore);
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

function formatPlaceOptionTitle(place: PickerPlace) {
  return [place.name, place.storeName].filter(Boolean).join(" · ");
}

function formatPlaceOptionSubtitle(place: PickerPlace) {
  const subtitle = uniqueParts([place.mall, place.area, place.city, place.address]).join(" · ");
  return subtitle || "未设置地址";
}

function uniqueParts(parts: Array<string | undefined>) {
  const seen = new Set<string>();

  return parts
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .filter((part) => {
      if (seen.has(part)) return false;
      seen.add(part);
      return true;
    });
}
