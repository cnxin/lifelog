import { ArrowLeft, Camera, ExternalLink, MapPin, Navigation, Sparkles, Star, Store, Users } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import EntrySheet from "../../components/EntrySheet";
import GlassCard from "../../components/GlassCard";
import Tags from "../../components/Tags";
import { useLifeLog } from "../../context/LifeLogContext";
import { formatMonthDay } from "../../utils/date";
import { openExternalUrl, openNativeStoreUrl, openPlaceMap } from "../../utils/externalLinks";

export default function PlaceDetail() {
  const { placeId } = useParams();
  const navigate = useNavigate();
  const { state, getPersonName } = useLifeLog();
  const [editing, setEditing] = useState(false);
  const [addingMemory, setAddingMemory] = useState(false);
  const place = state.places.find((item) => item.id === placeId);

  if (!place) {
    return (
      <section className="section">
        <GlassCard className="empty">没有找到这个地点</GlassCard>
      </section>
    );
  }

  const relatedMemories = state.memories
    .filter((memory) => memory.placeId === place.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const relatedPeople = Array.from(
    new Set(relatedMemories.flatMap((memory) => memory.personIds).filter(Boolean))
  );
  const photos = (place.photos || []).slice(0, 3);
  const meituanLink = place.platformLinks.find((link) => link.platform === "meituan");
  const completionTips = [
    {
      id: "mapLink",
      icon: <MapPin />,
      title: "补充高德入口",
      desc: "保存高德分享链接后可以直接打开高德。",
      visible: !place.mapUrl && !(place.latitude && place.longitude)
    },
    {
      id: "photos",
      icon: <Camera />,
      title: "补充照片",
      desc: "添加图片链接后详情页会展示前三张照片。",
      visible: !place.photos.length
    },
    {
      id: "address",
      icon: <Navigation />,
      title: "补充地址",
      desc: "地址和所在区域能让地点列表更好搜索。",
      visible: !place.address || !place.area
    }
  ].filter((tip) => tip.visible);

  return (
    <>
      <section className="section">
        <button className="back-button" onClick={() => navigate("/places")}>
          <ArrowLeft /> 返回地点
        </button>
        <GlassCard className="profile-card">
          <div className="profile-photo">
            <MapPin />
          </div>
          <div className="profile-main">
            <div className="profile-title">
              <h2>
                {place.name}
                {place.storeName ? ` · ${place.storeName}` : ""}
              </h2>
              {place.favorite && <Star />}
            </div>
            <p>
              {place.country} · {place.city} · {place.area || "未设置区域"}
            </p>
            <button className="category-pill active" onClick={() => setEditing(true)}>
              编辑地点
            </button>
          </div>
        </GlassCard>
      </section>

      {completionTips.length > 0 && (
        <section className="section">
          <div className="section-header">
            <h2>
              <Sparkles /> 建议补充
            </h2>
            <button className="see-all" onClick={() => setEditing(true)}>
              去编辑
            </button>
          </div>
          <div className="completion-list">
            {completionTips.map((tip) => (
              <button className="completion-card" key={tip.id} onClick={() => setEditing(true)}>
                <div className="task-icon">{tip.icon}</div>
                <div>
                  <strong>{tip.title}</strong>
                  <span>{tip.desc}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-header">
          <h2>
            <MapPin /> 地点信息
          </h2>
        </div>
        <div className="list">
          <GlassCard className="detail-row">
            <strong>国家 / 城市</strong>
            <span>
              {place.country} · {place.city}
            </span>
          </GlassCard>
          <GlassCard className="detail-row">
            <strong>所在区域</strong>
            <span>{place.area || "未设置"}</span>
          </GlassCard>
          <GlassCard className="detail-row">
            <strong>具体店铺 / 场所</strong>
            <span>{place.storeName || "未设置"}</span>
          </GlassCard>
          <GlassCard className="detail-row">
            <strong>类型</strong>
            <span>{place.category}</span>
          </GlassCard>
          <GlassCard className="detail-row">
            <strong>地址</strong>
            <span>{place.address || "未设置"}</span>
          </GlassCard>
          <GlassCard className="detail-row">
            <strong>评分</strong>
            <span>{place.rating}</span>
          </GlassCard>
        </div>
      </section>

      <section className="section">
        <div className="action-grid">
          {place.mapUrl || (place.latitude && place.longitude) ? (
            <button className="link-action" type="button" onClick={() => void openPlaceMap(place)}>
              <Navigation /> 打开高德
            </button>
          ) : (
            <span className="link-action disabled">
              <Navigation /> 未设置地图
            </span>
          )}
          {meituanLink ? (
            <button className="link-action secondary" type="button" onClick={() => void openNativeStoreUrl(meituanLink.url)}>
              <Store /> 打开美团
            </button>
          ) : null}
          {place.sourceUrl ? (
            <button className="link-action" type="button" onClick={() => void openExternalUrl(place.sourceUrl)}>
              <ExternalLink /> 参考链接
            </button>
          ) : (
            <span className="link-action disabled">
              <ExternalLink /> 未设置链接
            </span>
          )}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>
            <Camera /> 照片
          </h2>
        </div>
        {photos.length ? (
          <div className="place-photo-strip">
            {photos.map((photo) => (
              <img
                alt={place.name}
                className="place-photo"
                key={photo}
                loading="lazy"
                referrerPolicy="no-referrer"
                src={photo}
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            ))}
          </div>
        ) : (
          <GlassCard className="empty">还没有照片，可以编辑地点添加图片链接</GlassCard>
        )}
      </section>

      <section className="section">
        <div className="section-header">
          <h2>评价</h2>
        </div>
        <GlassCard className="pref-block">
          <p className="memory-desc">{place.desc || "还没有评价"}</p>
          <Tags items={place.tags} />
        </GlassCard>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>
            <Users /> 一起去过的人
          </h2>
        </div>
        {relatedPeople.length ? (
          <div className="tap-chip-row">
            {relatedPeople.map((personId) => (
              <button className="tap-chip" key={personId} onClick={() => navigate(`/people/${personId}`)}>
                {getPersonName(personId)}
              </button>
            ))}
          </div>
        ) : (
          <GlassCard className="empty">还没有关联人物</GlassCard>
        )}
      </section>

      <section className="section">
        <div className="section-header">
          <h2>相关回忆</h2>
          <button className="see-all" onClick={() => setAddingMemory(true)}>
            新增
          </button>
        </div>
        <div className="list">
          {relatedMemories.map((memory) => (
            <GlassCard className="memory-card" key={memory.id}>
              <div className="memory-badge">♡</div>
              <div className="memory-info" onClick={() => navigate(`/memories/${memory.id}`)}>
                <div className="memory-title">
                  <span>{memory.title}</span>
                  <span className="place-rating">{formatMonthDay(memory.date)}</span>
                </div>
                <p className="memory-desc">
                  {memory.personIds.map(getPersonName).join("、")} · {memory.content}
                </p>
                <Tags items={[memory.mood, ...memory.tags]} />
              </div>
            </GlassCard>
          ))}
          {!relatedMemories.length && <GlassCard className="empty">还没有相关回忆</GlassCard>}
        </div>
      </section>

      <EntrySheet type={editing ? "place" : null} itemId={place.id} onClose={() => setEditing(false)} />
      <EntrySheet
        type={addingMemory ? "memory" : null}
        initialPlaceId={place.id}
        onClose={() => setAddingMemory(false)}
      />
    </>
  );
}
