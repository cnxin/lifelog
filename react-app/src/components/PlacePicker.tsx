import { MapPin, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

interface PlacePickerProps {
  places: Array<{ id: string; name: string }>;
  defaultSelected?: string[];
  value?: string[];
  onChange?: (ids: string[]) => void;
  name?: string;
}

export default function PlacePicker({
  places,
  defaultSelected = [],
  value,
  onChange,
  name = "placeIds"
}: PlacePickerProps) {
  const isControlled = value !== undefined;
  const [internalSelected, setInternalSelected] = useState<string[]>(() =>
    defaultSelected.filter((id) => places.some((place) => place.id === id))
  );
  const [query, setQuery] = useState("");
  const selected = isControlled ? value : internalSelected;

  const selectedPlaces = useMemo(
    () => selected.map((id) => places.find((place) => place.id === id)).filter(Boolean) as typeof places,
    [places, selected]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return places
      .filter((place) => !selected.includes(place.id))
      .filter((place) => (q ? place.name.toLowerCase().includes(q) : true))
      .slice(0, 12);
  }, [places, selected, query]);

  function setSelected(nextSelected: string[]) {
    if (!isControlled) setInternalSelected(nextSelected);
    onChange?.(nextSelected);
  }

  function add(id: string) {
    setSelected(selected.includes(id) ? selected : [...selected, id]);
    setQuery("");
  }

  function remove(id: string) {
    setSelected(selected.filter((item) => item !== id));
  }

  return (
    <div className="person-picker place-picker">
      {selected.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}

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
        <p className="form-hint">还没有地点，可以先保存回忆，后续再关联。</p>
      ) : (
        <>
          <div className="person-picker-search">
            <Search size={16} />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={selected.length ? "继续添加地点" : "搜索地点名称"}
              aria-label="搜索地点"
            />
          </div>

          {filtered.length > 0 && (
            <ul className="person-picker-results">
              {filtered.map((place) => (
                <li key={place.id}>
                  <button type="button" onClick={() => add(place.id)}>
                    {place.name}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!filtered.length && query.trim() && (
            <p className="form-hint">没有匹配的地点，去“地点”页可以新增。</p>
          )}
        </>
      )}
    </div>
  );
}
