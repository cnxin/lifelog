import { ArrowLeft, Building2, MapPin, Store } from "lucide-react";
import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import GlassCard from "../../components/GlassCard";
import Tags from "../../components/Tags";
import { useLifeLog } from "../../context/LifeLogContext";
import {
  buildPlaceContextLine,
  buildPlaceDisplayName,
  buildPlaceGeoLine,
  isSameMall,
  parseMallKey,
} from "../../utils/placeMeta";

export default function MallDetail() {
  const navigate = useNavigate();
  const { mallKey } = useParams();
  const { state } = useLifeLog();

  const mallInfo = useMemo(() => parseMallKey(mallKey || ""), [mallKey]);
  const places = useMemo(
    () =>
      state.places
        .filter((place) => isSameMall(place, mallInfo))
        .sort((a, b) => a.name.localeCompare(b.name, "zh-CN")),
    [mallInfo, state.places],
  );

  const summary = places[0];
  const categories = Array.from(new Set(places.map((place) => place.category)));

  if (!summary) {
    return (
      <section className="section">
        <GlassCard className="empty">没有找到这个商场</GlassCard>
      </section>
    );
  }

  return (
    <>
      <section className="section">
        <button className="back-button" onClick={() => navigate("/places")}>
          <ArrowLeft /> 返回地点
        </button>
        <GlassCard className="profile-card">
          <div className="profile-photo">
            <Building2 />
          </div>
          <div className="profile-main">
            <div className="profile-title">
              <h2>{summary.mall}</h2>
            </div>
            <p>{buildPlaceGeoLine(summary)}</p>
            <p>{summary.area || "未设置区位"}</p>
            <Tags items={categories} />
          </div>
        </GlassCard>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>
            <Store /> 里面的地点
          </h2>
        </div>
        <div className="list">
          {places.map((place) => (
            <button
              className="vertical-detail-card detail-button glass-card"
              key={place.id}
              onClick={() => navigate(`/places/${place.id}`)}
            >
              <strong className="truncate-text" style={{ width: "100%" }}>
                {buildPlaceDisplayName(place)}
              </strong>
              <span className="truncate-lines-2">
                {[place.category, buildPlaceContextLine(place), place.address]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>
            <MapPin /> 关联回忆
          </h2>
        </div>
        <div className="list">
          {state.memories
            .filter((memory) =>
              places.some((place) => place.id === memory.placeId),
            )
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 8)
            .map((memory) => (
              <button
                className="vertical-detail-card detail-button glass-card"
                key={memory.id}
                onClick={() => navigate(`/memories/${memory.id}`)}
              >
                <strong className="truncate-text" style={{ width: "100%" }}>
                  {memory.title}
                </strong>
                <span className="truncate-lines-2">
                  {memory.content || "查看回忆详情"}
                </span>
              </button>
            ))}
        </div>
      </section>
    </>
  );
}
