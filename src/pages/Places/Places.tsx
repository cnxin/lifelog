import { MapPin, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import CardActions from "../../components/CardActions";
import EntrySheet from "../../components/EntrySheet";
import GlassCard from "../../components/GlassCard";
import SearchBar from "../../components/SearchBar";
import Tags from "../../components/Tags";
import { useConfirm } from "../../context/ConfirmContext";
import { useLifeLog } from "../../context/LifeLogContext";

export default function Places() {
  const { state, deleteEntry } = useLifeLog();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const countries = useMemo(() => ["全部", ...new Set(state.places.map((place) => place.country || "中国"))], [state.places]);
  const defaultCity = state.places[0]?.city || "杭州";
  const [country, setCountry] = useState("全部");
  const [city, setCity] = useState(defaultCity);
  const [area, setArea] = useState("全部");
  const [category, setCategory] = useState("全部");
  const [editingId, setEditingId] = useState<string | undefined>();

  const cityOptions = useMemo(() => {
    return ["全部", ...new Set(
      state.places
        .filter((place) => country === "全部" || place.country === country)
        .map((place) => place.city || "杭州")
    )];
  }, [country, state.places]);

  const areaOptions = useMemo(() => {
    return ["全部", ...new Set(
      state.places
        .filter((place) => (country === "全部" || place.country === country) && (city === "全部" || place.city === city))
        .map((place) => place.area || "未分组")
    )];
  }, [city, country, state.places]);

  const categories = useMemo(() => {
    return ["全部", ...new Set(state.places.map((place) => place.category))];
  }, [state.places]);

  const places = useMemo(() => {
    return state.places.filter((place) => {
      const inCountry = country === "全部" || place.country === country;
      const inCity = city === "全部" || place.city === city;
      const inArea = area === "全部" || place.area === area;
      const inCategory = category === "全部" || place.category === category;
      const content = [
        place.name,
        place.storeName,
        place.area,
        place.city,
        place.country,
        place.category,
        place.desc,
        place.tags.join(",")
      ].join(" ");
      return inCountry && inCity && inArea && inCategory && content.toLowerCase().includes(query.toLowerCase());
    });
  }, [area, category, city, country, query, state.places]);

  async function handleDelete(id: string) {
    const accepted = await confirm({
      title: "删除地点",
      message: "确认删除这个地点？相关回忆中的地点关联也会被清空。",
      confirmText: "删除"
    });
    if (!accepted) return;
    await deleteEntry("place", id);
  }

  return (
    <>
      <SearchBar value={query} placeholder="搜索店家、商场、城市、标签" onChange={setQuery} />
      <div className="location-switcher">
        <label>
          国家
          <select value={country} onChange={(event) => setCountry(event.target.value)}>
            {countries.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          城市
          <select value={city} onChange={(event) => setCity(event.target.value)}>
            {cityOptions.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="category-row">
        {areaOptions.map((item) => (
          <button className={`category-pill ${item === area ? "active" : ""}`} key={item} onClick={() => setArea(item)}>
            {item}
          </button>
        ))}
      </div>
      <div className="category-row">
        {categories.map((item) => (
          <button
            className={`category-pill ${item === category ? "active" : ""}`}
            key={item}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <section className="section">
        <div className="list">
          {places.map((place) => (
            <GlassCard className="place-card" key={place.id}>
              <button className="place-tap" onClick={() => navigate(`/places/${place.id}`)}>
                <div className="place-img">
                  <MapPin />
                </div>
              </button>
              <div className="place-info" onClick={() => navigate(`/places/${place.id}`)}>
                <div className="place-name">
                  <span>{place.name}{place.storeName ? ` · ${place.storeName}` : ""}</span>
                  <span className="place-rating">
                    <Star /> {place.rating}
                  </span>
                </div>
                <p className="place-desc">
                  {place.country} · {place.city} · {place.area || "未分组"}
                </p>
                <p className="place-desc">
                  {place.category} · {place.address || place.desc}
                </p>
                <Tags items={place.tags} />
              </div>
              <div className="person-side-actions">
                <CardActions onEdit={() => setEditingId(place.id)} onDelete={() => handleDelete(place.id)} />
              </div>
            </GlassCard>
          ))}
          {!places.length && <GlassCard className="empty">没有找到地点</GlassCard>}
        </div>
      </section>
      <EntrySheet type={editingId ? "place" : null} itemId={editingId} onClose={() => setEditingId(undefined)} />
    </>
  );
}
