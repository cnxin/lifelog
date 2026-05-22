import { MapPin, Search, X } from "lucide-react";
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
      .filter((place) => (q ? getPlaceSearchText(place).includes(q) : true))
      .sort((left, right) => scorePlaceOption(right, q) - scorePlaceOption(left, q) || left.name.localeCompare(right.name, "zh-CN"))
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
              placeholder={selected.length ? "继续添加地点" : "搜索地点、商场、地址"}
              aria-label="搜索地点"
            />
          </div>

          {filtered.length > 0 && (
            <ul className="person-picker-results">
              {filtered.map((place) => (
                <li key={place.id}>
                  <button type="button" onClick={() => add(place.id)}>
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

          {!filtered.length && query.trim() && (
            <p className="form-hint">没有匹配的地点，去“地点”页可以新增。</p>
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

function scorePlaceOption(place: PickerPlace, query: string) {
  if (!query) return 0;

  const fields = [
    { value: place.name, score: 80 },
    { value: place.storeName, score: 60 },
    { value: place.mall, score: 45 },
    { value: place.city, score: 30 },
    { value: place.area, score: 25 },
    { value: place.address, score: 20 }
  ];

  return fields.reduce((score, field) => {
    const value = field.value?.toLowerCase() || "";
    if (!value.includes(query)) return score;
    return score + field.score + (value.startsWith(query) ? 10 : 0);
  }, 0);
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
