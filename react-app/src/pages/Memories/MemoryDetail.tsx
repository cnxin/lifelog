import { ArrowLeft, Calendar, CheckCircle2, Heart, Image as ImageIcon, MapPin, PenLine, QrCode, Sparkles, Tag, Users } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import EntrySheet from "../../components/EntrySheet";
import GlassCard from "../../components/GlassCard";
import LocalShareSheet from "../../components/LocalShareSheet";
import MemoryTags from "../../components/MemoryTags";
import MemoryTimelineSection from "../../components/MemoryTimelineSection";
import NotionRecordAction from "../../components/NotionRecordAction";
import { PhotoGrid } from "../../components/PhotoGrid";
import { PhotoViewer } from "../../components/PhotoViewer";
import { useLifeLog } from "../../context/LifeLogContext";
import { useCollapsingDetailHeader } from "../../hooks/useCollapsingDetailHeader";
import { buildPlanAnniversaryPath } from "../../utils/anniversaryLinks";
import { formatAnniversaryPlanTargetTitle, normalizeAnniversaryPlanTargetKind } from "../../utils/anniversaryPlans";
import { formatMonthDay } from "../../utils/date";
import { groupMemoriesByMonth } from "../../utils/detailHelpers";
import { buildPlaceContextLine } from "../../utils/placeMeta";
import { buildMemoryDisplayContext, buildMemoryMetaLine, getMemoryDisplayTitle, getMemoryKindLabel, isMemoryPlan } from "../../utils/memoryDisplay";
import { getMemoryPlaceIds } from "../../utils/memoryPlaces";
import { toCalendarDateKey } from "../../utils/calendarItems";
import type { AnniversaryPlan, MemoryEvent, Photo } from "../../types";

export default function MemoryDetail() {
  const { memoryId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { state, getPersonName, getPlaceName, loadMemoryPhotos } = useLifeLog();
  const headerCollapsed = useCollapsingDetailHeader();
  const [editing, setEditing] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [showAllPhotos, setShowAllPhotos] = useState(false);
  const [addingRelatedMemory, setAddingRelatedMemory] = useState(false);
  const [completingPlan, setCompletingPlan] = useState(false);
  const memory = state.memories.find((item) => item.id === memoryId);
  const personIds = memory?.personIds || [];
  const tags = memory?.tags || [];
  const photoIds = memory?.photos || [];
  const placeIds = memory ? getMemoryPlaceIds(memory) : [];
  const places = state.places.filter((item) => placeIds.includes(item.id));
  const linkedPlans = memory ? state.anniversaryPlans.filter((plan) => plan.memoryId === memory.id) : [];
  const visiblePhotos = showAllPhotos ? photos : photos.slice(0, 9);
  const hiddenPhotoCount = Math.max(0, photos.length - visiblePhotos.length);

  // 加载照片
  useEffect(() => {
    if (memory && photoIds.length > 0) {
      loadMemoryPhotos(memory.id, photoIds).then(setPhotos);
    } else {
      setPhotos([]);
    }
  }, [memory?.id, photoIds.length, loadMemoryPhotos]);

  useEffect(() => {
    if (!memory) return;
    const editTarget = searchParams.get("edit");
    if (editTarget === "photos" || editTarget === "details") {
      setEditing(true);
      setSearchParams({}, { replace: true });
      return;
    }
  }, [memory, searchParams, setSearchParams]);

  if (!memory) {
    return (
      <section className="section">
        <GlassCard className="empty">没有找到这条记录</GlassCard>
      </section>
    );
  }

  const memoryCtx = buildMemoryDisplayContext(memory, getPersonName, getPlaceName);
  const memoryTitle = getMemoryDisplayTitle(memory, memoryCtx);
  const copy = buildMemoryDetailCopy(memory);
  const completionTips = [
    {
      id: "content",
      icon: <Heart />,
      title: copy.contentTipTitle,
      desc: copy.contentTipDesc,
      visible: !memory.content.trim()
    },
    {
      id: "people",
      icon: <Users />,
      title: "关联人物",
      desc: copy.personTipDesc,
      visible: !personIds.length
    },
    {
      id: "place",
      icon: <MapPin />,
      title: "关联地点",
      desc: copy.placeTipDesc,
      visible: !placeIds.length
    },
    {
      id: "tags",
      icon: <Tag />,
      title: "补充心情和标签",
      desc: "让以后搜索和回看更容易。",
      visible: memory.mood === "日常" || !tags.length
    }
  ].filter((tip) => tip.visible);
  const relatedMemoryMatches = buildRelatedMemoryMatches(memory, state.memories);
  const relatedReasonById = new Map(relatedMemoryMatches.map((item) => [item.memory.id, item.reason]));
  const groupedRelatedMemories = groupMemoriesByMonth(relatedMemoryMatches.map((item) => item.memory));
  const storyFacts = buildMemoryStoryFacts(memory, memoryCtx, photoIds.length, linkedPlans.length);
  const firstPersonId = personIds[0];
  const firstPlaceId = placeIds[0];
  const planDueState = getPlanDueState(memory);

  return (
    <>
      <section className={`section detail-hero-section memory-detail-hero-section ${headerCollapsed ? "collapsed" : ""}`}>
        <GlassCard className="profile-card detail-profile-card memory-detail-profile-card">
          <div className="detail-profile-nav">
            <button className="back-button" type="button" onClick={() => navigate("/memories")}>
              <ArrowLeft /> 返回记录
            </button>
            <strong className="detail-compact-title">
              {memoryTitle}
            </strong>
          </div>
          <div className="detail-profile-body">
            <div className="profile-photo">
              <Heart />
            </div>
            <div className="profile-main">
              <div className="profile-title">
                <h2>{memoryTitle}</h2>
              </div>
              <p>
                {getMemoryKindLabel(memory)} · {formatMonthDay(memory.date)} · {memory.mood}
              </p>
              <button className="category-pill active" onClick={() => setEditing(true)}>
                {copy.editLabel}
              </button>
            </div>
          </div>
        </GlassCard>
      </section>

      <section className="section">
        <GlassCard className="memory-reader-card">
          <div className="memory-reader-head">
            <div>
              <span>{getMemoryKindLabel(memory)} · {formatMonthDay(memory.date)} · {memory.mood || "日常"}</span>
              <h2>{memoryTitle}</h2>
            </div>
            <button className="memory-reader-share" type="button" onClick={() => setShareOpen(true)}>
              <QrCode /> 分享
            </button>
          </div>
          <div className={`memory-reader-body ${memory.content.trim() ? "" : "empty"}`}>
            {memory.content.trim() || copy.emptyBody}
          </div>
          <MemoryTags mood={memory.mood} tags={tags} />
          <div className="memory-reader-facts">
            {storyFacts.map((fact) => (
              <span key={fact}>{fact}</span>
            ))}
          </div>
          <div className="memory-reader-actions">
            <button type="button" onClick={() => setEditing(true)}>
              <PenLine /> {memory.content.trim() ? copy.detailAction : copy.emptyAction}
            </button>
            {firstPersonId ? (
              <button type="button" onClick={() => navigate(`/people/${firstPersonId}`)}>
                <Users /> 看 TA
              </button>
            ) : firstPlaceId ? (
              <button type="button" onClick={() => navigate(`/places/${firstPlaceId}`)}>
                <MapPin /> 看地点
              </button>
            ) : (
              <button type="button" onClick={() => setEditing(true)}>
                <Sparkles /> 补关联
              </button>
            )}
            <NotionRecordAction entityType="memory" entityId={memory.id} label="打开 Notion" className="" />
          </div>
        </GlassCard>
      </section>

      {planDueState && (
        <section className="section">
          <GlassCard className="plan-completion-card">
            <div className="plan-completion-icon">
              <CheckCircle2 />
            </div>
            <div>
              <strong>{planDueState.title}</strong>
              <span>{planDueState.desc}</span>
            </div>
            <button type="button" onClick={() => setCompletingPlan(true)}>
              补成回忆
            </button>
          </GlassCard>
        </section>
      )}

      {!isMemoryPlan(memory) && memory.plannedContent?.trim() && (
        <section className="section">
          <GlassCard className="memory-plan-original-card">
            <span>原计划</span>
            <p>{memory.plannedContent.trim()}</p>
          </GlassCard>
        </section>
      )}

      {photos.length > 0 && (
        <section className="section" id="memory-photos">
          <div className="section-header">
            <h2>
              <ImageIcon /> 照片 ({photos.length})
            </h2>
          </div>
          <GlassCard>
            <PhotoGrid
              photos={visiblePhotos}
              columns={3}
              onClick={(index) => {
                setViewerIndex(index);
                setViewerOpen(true);
              }}
            />
            {photos.length > 9 && (
              <button className="photo-expand-button" type="button" onClick={() => setShowAllPhotos((value) => !value)}>
                {showAllPhotos ? "收起照片" : `展开全部照片（还有 ${hiddenPhotoCount} 张）`}
              </button>
            )}
          </GlassCard>
        </section>
      )}

      {linkedPlans.length > 0 && (
        <section className="section">
          <div className="section-header">
            <h2>
              <Calendar /> 关联安排
            </h2>
          </div>
          <div className="linked-plan-list">
            {linkedPlans.map((plan) => (
              <button className="linked-plan-card glass-card" type="button" key={plan.id} onClick={() => navigate(buildPlanAnniversaryPath(plan))}>
                <div>
                  <strong>{getPersonName(plan.personId)} · {formatAnniversaryPlanTargetTitle(plan)}</strong>
                  <span>{formatLinkedPlanMeta(plan)}</span>
                </div>
                <small>{formatLinkedPlanStatus(plan)}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-header">
          <h2>
            <Users /> 相关对象
          </h2>
        </div>
        <GlassCard className="memory-related-object-card">
          <div className="memory-related-object-group">
            <strong>人物</strong>
            <div className="tap-chip-row">
              {personIds.map((personId) => (
                <button className="tap-chip" key={personId} onClick={() => navigate(`/people/${personId}`)}>
                  {getPersonName(personId)}
                </button>
              ))}
              {!personIds.length && <span className="memory-related-empty">未关联人物</span>}
            </div>
          </div>
          <div className="memory-related-object-group">
            <strong>地点</strong>
            {places.length ? (
              <div className="memory-related-place-list">
                {places.map((place) => (
                  <button className="memory-place-row detail-button" key={place.id} onClick={() => navigate(`/places/${place.id}`)}>
                    <strong className="truncate-text">{getPlaceName(place.id)}</strong>
                    <span className="truncate-lines-2">{formatPlaceAddressLine(place)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <span className="memory-related-empty">未关联地点，点击“{copy.editLabel}”可以补充。</span>
            )}
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

      <MemoryTimelineSection
        title={isMemoryPlan(memory) ? "相关记录" : "相关回忆"}
        groupedMemories={groupedRelatedMemories}
        getPersonName={getPersonName}
        getPlaceName={getPlaceName}
        onAddMemory={() => setAddingRelatedMemory(true)}
        emptyTitle={isMemoryPlan(memory) ? "还没有找到相关记录" : "还没有找到相关回忆"}
        emptyDesc="同人物、同地点或同标签的记录会自动出现在这里。"
        emptyAction={isMemoryPlan(memory) ? "记录相关计划" : "记录相关回忆"}
        renderMeta={(relatedMemory, ctx, showContentLine) => (
          <>
            <p className="memory-desc memory-meta-line">
              {[relatedReasonById.get(relatedMemory.id), buildMemoryMetaLine(ctx)].filter(Boolean).join(" · ")}
            </p>
            {showContentLine && <p className="memory-desc">{relatedMemory.content}</p>}
          </>
        )}
      />

      {viewerOpen && photos.length > 0 && (
        <PhotoViewer
          photos={photos}
          initialIndex={viewerIndex}
          onClose={() => setViewerOpen(false)}
        />
      )}

      <EntrySheet type={editing ? "memory" : null} itemId={memory.id} onClose={() => setEditing(false)} />
      <EntrySheet
        type={completingPlan ? "memory" : null}
        itemId={memory.id}
        memoryKindOverride="memory"
        memoryTitleOverride="补成回忆"
        memoryKickerOverride="保留原计划，补上实际发生的事"
        onSaved={() => setCompletingPlan(false)}
        onClose={() => setCompletingPlan(false)}
      />
      <EntrySheet
        type={addingRelatedMemory ? "memory" : null}
        memoryMode="quick"
        initialPersonIds={personIds}
        initialPlaceIds={placeIds}
        onClose={() => setAddingRelatedMemory(false)}
      />
      <LocalShareSheet
        target={
          shareOpen
            ? {
                type: "memory",
                memoryId: memory.id,
                title: memoryTitle,
                photoCount: photoIds.length
              }
            : null
        }
        onClose={() => setShareOpen(false)}
      />
    </>
  );
}

function formatLinkedPlanMeta(plan: Pick<AnniversaryPlan, "targetKind" | "targetDate" | "occurrenceYear" | "milestoneLabel">) {
  const kind = normalizeAnniversaryPlanTargetKind(plan);
  if (kind === "milestone") {
    return [plan.milestoneLabel || "节点", plan.targetDate].filter(Boolean).join(" · ");
  }
  return [`${plan.occurrenceYear} 年`, plan.targetDate].join(" · ");
}

function formatLinkedPlanStatus(plan: Pick<AnniversaryPlan, "status" | "memoryId">) {
  if (plan.memoryId) return "已生成回忆";
  if (plan.status === "doing") return "准备中";
  if (plan.status === "done") return "已完成";
  if (plan.status === "skipped") return "已跳过";
  return "未开始";
}

function getPlanDueState(memory: MemoryEvent) {
  if (!isMemoryPlan(memory)) return null;
  const todayKey = toCalendarDateKey(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(memory.date) || memory.date > todayKey) return null;
  const days = Math.abs(diffDateKeys(memory.date, todayKey));
  if (days === 0) {
    return {
      title: "这条计划今天到了",
      desc: "完成后可以补上实际发生的事、照片和心情，保存后会变成回忆。"
    };
  }
  return {
    title: `这条计划已过去 ${days} 天`,
    desc: "可以把准备事项补成实际回忆，之后统计和常去地点会按真实到访计算。"
  };
}

function buildMemoryDetailCopy(memory: MemoryEvent) {
  if (isMemoryPlan(memory)) {
    return {
      editLabel: "编辑计划",
      contentTipTitle: "补充安排",
      contentTipDesc: "写下准备事项、时间地点和需要注意什么。",
      personTipDesc: "关联后人物详情会自动出现这条计划。",
      placeTipDesc: "关联后地点详情会自动串起想去哪里和后续回忆。",
      emptyBody: "还没有写具体安排，可以补充准备事项、想去哪里、和谁一起，或者到时需要注意什么。",
      detailAction: "补充安排",
      emptyAction: "写下计划"
    };
  }

  return {
    editLabel: "编辑回忆",
    contentTipTitle: "补充内容",
    contentTipDesc: "写下发生了什么、下次要注意什么。",
    personTipDesc: "关联后人物详情会自动出现这条回忆。",
    placeTipDesc: "关联后地点详情会自动串起去过的人和回忆。",
    emptyBody: "还没有记录内容，可以补充发生了什么、当时的感受，或者下次要注意的事。",
    detailAction: "补充细节",
    emptyAction: "写下发生了什么"
  };
}

function buildMemoryStoryFacts(memory: MemoryEvent, ctx: ReturnType<typeof buildMemoryDisplayContext>, photoCount: number, planCount: number) {
  return [
    getMemoryKindLabel(memory),
    ctx.personNames.length ? `${ctx.personNames.length} 位人物` : "未关联人物",
    ctx.placeNames.length ? `${ctx.placeNames.length} 个地点` : "未关联地点",
    photoCount ? `${photoCount} 张照片` : "暂无照片",
    memory.tags.length ? `${memory.tags.slice(0, 2).join("、")}${memory.tags.length > 2 ? "..." : ""}` : "未加标签",
    planCount ? `${planCount} 个安排来源` : ""
  ].filter(Boolean);
}

function formatPlaceAddressLine(place: {
  country: string;
  province: string;
  city: string;
  address: string;
  area: string;
  mall: string;
}) {
  return place.address || [place.province, place.city, buildPlaceContextLine(place)].filter(Boolean).join(" · ");
}

function buildRelatedMemoryMatches(source: MemoryEvent, memories: MemoryEvent[]) {
  return memories
    .filter((candidate) => candidate.id !== source.id)
    .map((candidate) => {
      const match = scoreRelatedMemory(source, candidate);
      return {
        memory: candidate,
        ...match
      };
    })
    .filter((item) => item.score >= 2)
    .sort((left, right) => (
      right.score - left.score ||
      left.dateDistance - right.dateDistance ||
      right.memory.date.localeCompare(left.memory.date)
    ))
    .slice(0, 8);
}

function scoreRelatedMemory(source: MemoryEvent, candidate: MemoryEvent) {
  const reasons: string[] = [];
  let score = 0;

  const personMatches = countIntersection(source.personIds || [], candidate.personIds || []);
  if (personMatches) {
    score += personMatches * 5;
    reasons.push(personMatches > 1 ? `同人物 ${personMatches} 位` : "同人物");
  }

  const placeMatches = countIntersection(getMemoryPlaceIds(source), getMemoryPlaceIds(candidate));
  if (placeMatches) {
    score += placeMatches * 5;
    reasons.push(placeMatches > 1 ? `同地点 ${placeMatches} 个` : "同地点");
  }

  const tagMatches = countIntersection(normalizeTags(source.tags), normalizeTags(candidate.tags));
  if (tagMatches) {
    score += tagMatches * 3;
    reasons.push(tagMatches > 1 ? `同标签 ${tagMatches} 个` : "同标签");
  }

  const dateDistance = getDateDistance(source.date, candidate.date);
  if (dateDistance <= 7) {
    score += 2;
    reasons.push(dateDistance === 0 ? "同一天" : "相近日期");
  } else if (isSameMonth(source.date, candidate.date)) {
    score += 1;
    reasons.push("同月");
  }

  if (source.mood && source.mood !== "日常" && source.mood === candidate.mood) {
    score += 1;
    reasons.push("同心情");
  }

  return {
    score,
    dateDistance,
    reason: uniqueLabels(reasons).slice(0, 3).join(" · ")
  };
}

function countIntersection(left: string[] = [], right: string[] = []) {
  const rightSet = new Set(right.map((item) => item.trim()).filter(Boolean));
  return uniqueLabels(left).filter((item) => rightSet.has(item)).length;
}

function normalizeTags(tags: string[] = []) {
  return tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean);
}

function uniqueLabels(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function getDateDistance(left: string, right: string) {
  const leftTime = Date.parse(`${left}T00:00:00`);
  const rightTime = Date.parse(`${right}T00:00:00`);
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.round((leftTime - rightTime) / 86400000));
}

function isSameMonth(left: string, right: string) {
  return /^\d{4}-\d{2}/.test(left) && left.slice(0, 7) === right.slice(0, 7);
}

function diffDateKeys(targetDateKey: string, baseDateKey: string) {
  return Math.round((dateKeyToUtcTime(targetDateKey) - dateKeyToUtcTime(baseDateKey)) / 86400000);
}

function dateKeyToUtcTime(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return 0;
  return Date.UTC(year, month - 1, day);
}
