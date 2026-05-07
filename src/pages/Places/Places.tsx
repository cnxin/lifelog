import { Building2, MapPin, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import CardActions from "../../components/CardActions";
import EntrySheet from "../../components/EntrySheet";
import GlassCard from "../../components/GlassCard";
import SearchBar from "../../components/SearchBar";
import Tags from "../../components/Tags";
import { useConfirm } from "../../context/ConfirmContext";
import { useLifeLog } from "../../context/LifeLogContext";
import { buildMallKey, buildPlaceContextLine, buildPlaceDisplayName, buildPlaceGeoLine } from "../../utils/placeMeta";

export default function Places() {
  const { state, deleteEntry } = useLifeLog();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const countries = useMemo(() => ["全部", ...new Set(state.places.map((place) => place.country || "中国"))], [state.places]);
  const [country, setCountry] = useState("全部");
  const [province, setProvince] = useState("全部");
  const [city, setCity] = useState("全部");
  const [area, setArea] = useState("全部");
  const [category, setCategory] = useState("全部");
  const [editingId, setEditingId] = useState<string | undefined>();

  const provinceOptions = useMemo(() => {
    return [
      "全部",
      ...new Set(
        state.places
          .filter((place) => country === "全部" || place.country === country)
          .map((place) => place.province || "未设置")
      )
    ];
  }, [country, state.places]);

  const cityOptions = useMemo(() => {
    return [
      "全部",
      ...new Set(
        state.places
          .filter((place) => {
            const inCountry = country === "全部" || place.country === country;
            const inProvince = province === "全部" || (place.province || "未设置") === province;
            return inCountry && inProvince;
          })
          .map((place) => place.city || "未设置")
      )
    ];
  }, [country, province, state.places]);

  const areaOptions = useMemo(() => {
    return [
      "全部",
      ...new Set(
        state.places
          .filter((place) => {
            const inCountry = country === "全部" || place.country === country;
            const inProvince = province === "全部" || (place.province || "未设置") === province;
            const inCity = city === "全部" || place.city === city;
            return inCountry && inProvince && inCity;
          })
          .map((place) => place.area || "未分组")
      )
    ];
  }, [city, country, province, state.places]);

  const categories = useMemo(() => {
    return ["全部", ...new Set(state.places.map((place) => place.category))];
  }, [state.places]);

  useEffect(() => {
    setProvince("全部");
    setCity("全部");
    setArea("全部");
  }, [country]);

  useEffect(() => {
    setCity("全部");
    setArea("全部");
  }, [province]);

  useEffect(() => {
    setArea("全部");
  }, [city]);

  const places = useMemo(() => {
    return state.places.filter((place) => {
      const inCountry = country === "全部" || place.country === country;
      const inProvince = province === "全部" || (place.province || "未设置") === province;
      const inCity = city === "全部" || place.city === city;
      const inArea = area === "全部" || place.area === area;
      const inCategory = category === "全部" || place.category === category;
      const content = [
        place.name,
        place.mall,
        place.storeName,
        place.area,
        place.province,
        place.city,
        place.country,
        place.category,
        place.address,
        place.desc,
        place.tags.join(",")
      ].join(" ");
      return inCountry && inProvince && inCity && inArea && inCategory && content.toLowerCase().includes(query.toLowerCase());
    });
  }, [area, category, city, country, province, query, state.places]);

  const mallGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        mall: string;
        country: string;
        province: string;
        city: string;
        count: number;
        categories: Set<string>;
      }
    >();

    for (const place of places) {
      if (!place.mall) continue;
      const key = buildMallKey(place);
      if (!key) continue;

      const current =
        groups.get(key) ||
        {
          key,
          mall: place.mall,
          country: place.country,
          province: place.province,
          city: place.city,
          count: 0,
          categories: new Set<string>()
        };
      current.count += 1;
      current.categories.add(place.category);
      groups.set(key, current);
    }

    return Array.from(groups.values()).sort((a, b) => a.mall.localeCompare(b.mall, "zh-CN"));
  }, [places]);

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
      <SearchBar value={query} placeholder="搜索地点、区域、城市、标签" onChange={setQuery} />
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
          省 / 州
          <select value={province} onChange={(event) => setProvince(event.target.value)}>
            {provinceOptions.map((item) => (
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
      {mallGroups.length > 0 && (
        <section className="section">
          <div className="section-header">
            <h2>
              <Building2 /> 商场 / 园区
            </h2>
          </div>
          <div className="list">
            {mallGroups.map((mall) => (
              <button
                className="detail-row detail-button glass-card"
                key={mall.key}
                onClick={() => navigate(`/places/malls/${encodeURIComponent(mall.key)}`)}
              >
                <strong>{mall.mall}</strong>
                <span>
                  {[mall.province, mall.city].filter(Boolean).join(" · ")} · {mall.count} 家店
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
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
                  <span>{buildPlaceDisplayName(place)}</span>
                  <span className="place-rating">
                    <Star /> {place.rating}
                  </span>
                </div>
                <p className="place-desc">{buildPlaceGeoLine(place)}</p>
                <p className="place-desc">
                  {place.category} · {buildPlaceContextLine(place)}
                </p>
                <p className="place-desc">
                  {place.address || place.desc}
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
