import { ArrowLeft, Calendar, CheckCircle2, Gift, Heart, MapPin, MessageCircle, Sparkles, Star } from "lucide-react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import AnniversaryPlanSheet from "../../components/AnniversaryPlanSheet";
import CompletionTipsSection, { type CompletionTip } from "../../components/CompletionTipsSection";
import EntrySheet from "../../components/EntrySheet";
import GlassCard from "../../components/GlassCard";
import MemoryTimelineSection from "../../components/MemoryTimelineSection";
import NotionRecordAction from "../../components/NotionRecordAction";
import PersonPreferenceSheet, { type PersonPreferenceMode } from "../../components/PersonPreferenceSheet";
import { useConfirm } from "../../context/ConfirmContext";
import { useLifeLog } from "../../context/LifeLogContext";
import { useCollapsingDetailHeader } from "../../hooks/useCollapsingDetailHeader";
import type { Anniversary, AnniversaryPlan, AnniversaryPlanTargetKind } from "../../types";
import { getAnniversaryKey } from "../../utils/anniversaryLinks";
import { buildAnnualPlanTarget, buildMilestonePlanTarget, findAnnualPlanHistory, findMilestonePlanHistory, findPlanForAnniversaryTarget, normalizeAnniversaryPlanTargetKind, type AnniversaryPlanTarget } from "../../utils/anniversaryPlans";
import { anniversaryRelativeLabel, anniversaryYearLabel, birthdayAgeLabel, buildNextAnniversaryMilestone, daysUntil, formatDaysUntilLabel, formatMonthDay, getLunarDateInfo } from "../../utils/date";
import { groupMemoriesByMonth, getTopRelatedItems } from "../../utils/detailHelpers";
import { isMemoryPlan } from "../../utils/memoryDisplay";
import { getMemoryPlaceIds } from "../../utils/memoryPlaces";
import { buildRelationshipHealth } from "../../utils/relationshipHealth";
import { initials } from "../../utils/text";
import { useEffect, useRef, useState } from "react";

interface PlanningTarget {
  anniversaryKey: string;
  targetKind: AnniversaryPlanTargetKind;
  planId?: string;
}

interface HistoryTarget {
  anniversaryKey: string;
}

interface PlanListTarget {
  anniversaryKey: string;
}

export default function PersonDetail() {
  const { personId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const confirm = useConfirm();
  const { state, getPersonName, getPlaceName, saveAnniversaryPlan, deleteAnniversaryPlan, updatePersonProfile } = useLifeLog();
  const headerCollapsed = useCollapsingDetailHeader();
  const [editing, setEditing] = useState(false);
  const [addingMemory, setAddingMemory] = useState(false);
  const [memoryInitialDate, setMemoryInitialDate] = useState<string | undefined>();
  const [memoryInitialPlaceIds, setMemoryInitialPlaceIds] = useState<string[]>([]);
  const [planningTarget, setPlanningTarget] = useState<PlanningTarget | null>(null);
  const [historyTarget, setHistoryTarget] = useState<HistoryTarget | null>(null);
  const [planListTarget, setPlanListTarget] = useState<PlanListTarget | null>(null);
  const [memoryPlanId, setMemoryPlanId] = useState<string | undefined>();
  const [editingPreferenceMode, setEditingPreferenceMode] = useState<PersonPreferenceMode | null>(null);
  const anniversariesRef = useRef<HTMLElement>(null);
  const anniversaryCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const selectedAnniversaryKey = searchParams.get("anniversary") || "";

  useEffect(() => {
    if (location.hash !== "#anniversaries" || !anniversariesRef.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behavior: ScrollBehavior = reduced ? "auto" : "smooth";
    const frameId = requestAnimationFrame(() => {
      const target = selectedAnniversaryKey ? anniversaryCardRefs.current[selectedAnniversaryKey] : null;
      scrollDetailTarget(target || anniversariesRef.current, behavior);
    });
    return () => cancelAnimationFrame(frameId);
  }, [location.hash, personId, selectedAnniversaryKey]);

  useEffect(() => {
    const planId = searchParams.get("recordPlan");
    if (!planId || !personId) return;
    const plan = state.anniversaryPlans.find((item) => item.id === planId && item.personId === personId);
    if (!plan) return;

    setMemoryInitialDate(plan.targetDate);
    setMemoryInitialPlaceIds(plan.placeIds);
    setMemoryPlanId(plan.id);
    setAddingMemory(true);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("recordPlan");
    setSearchParams(nextParams, { replace: true });
  }, [personId, searchParams, setSearchParams, state.anniversaryPlans]);
  const person = state.people.find((item) => item.id === personId);

  if (!person) {
    return (
      <section className="section">
        <GlassCard className="empty">没有找到这个人物</GlassCard>
      </section>
    );
  }

  const relatedEntries = state.memories
    .filter((memory) => (memory.personIds || []).includes(person.id))
    .sort((a, b) => b.date.localeCompare(a.date));
  const relatedMemories = relatedEntries.filter((memory) => !isMemoryPlan(memory));
  const relatedPlans = relatedEntries.filter(isMemoryPlan);

  const relatedPlaces = Array.from(
    new Set(relatedMemories.flatMap(getMemoryPlaceIds).filter(Boolean))
  );
  const relationshipHealth = buildRelationshipHealth(person.id, state.memories);
  const topPlaces = getTopRelatedItems(
    relatedMemories.flatMap(getMemoryPlaceIds).filter(Boolean),
    getPlaceName
  );
  const groupedMemories = groupMemoriesByMonth(relatedEntries);
  const latestMemory = relatedMemories[0];
  const actionCenter = buildPersonActionCenter({
    person,
    relatedMemories,
    relatedPlaces,
    anniversaryPlans: state.anniversaryPlans,
    getPlaceName,
    onRecordMemory: () => setAddingMemory(true),
    onOpenAnniversaries: () => {
      scrollDetailTarget(anniversariesRef.current, "smooth");
    },
    onOpenPlace: (placeId) => navigate(`/places/${placeId}`),
    onEditPreference: (mode) => setEditingPreferenceMode(mode)
  });
  const selectedAnniversary = person.anniversaries.find((item) => getAnniversaryKey(item) === planningTarget?.anniversaryKey);
  const selectedExistingPlan = planningTarget?.planId
    ? state.anniversaryPlans.find((item) => item.id === planningTarget.planId && item.personId === person.id)
    : undefined;
  const selectedPlanTarget = selectedAnniversary
    ? buildPlanningTargetForSheet(selectedAnniversary, planningTarget, selectedExistingPlan)
    : null;
  const selectedPlan = selectedExistingPlan || (selectedAnniversary && selectedPlanTarget
    ? findPlanForAnniversaryTarget(state.anniversaryPlans, person.id, selectedAnniversary, selectedPlanTarget)
    : undefined);
  const selectedPlanHistory = selectedAnniversary && selectedPlanTarget?.targetKind === "annual"
    ? findAnnualPlanHistory(state.anniversaryPlans, person.id, selectedAnniversary, selectedPlanTarget.occurrenceYear)
    : [];
  const selectedListAnniversary = person.anniversaries.find((item) => getAnniversaryKey(item) === planListTarget?.anniversaryKey);
  const selectedListPlans = selectedListAnniversary ? buildAnniversaryPlanList(state.anniversaryPlans, person.id, selectedListAnniversary) : [];
  const selectedHistoryAnniversary = person.anniversaries.find((item) => getAnniversaryKey(item) === historyTarget?.anniversaryKey);
  const selectedHistoryOccurrence = selectedHistoryAnniversary ? buildAnniversaryOccurrence(selectedHistoryAnniversary.date) : null;
  const selectedHistoryMilestone = selectedHistoryAnniversary ? buildNextAnniversaryMilestone(selectedHistoryAnniversary) : null;
  const selectedAnnualHistoryPlans = selectedHistoryAnniversary && selectedHistoryOccurrence
    ? findAnnualPlanHistory(state.anniversaryPlans, person.id, selectedHistoryAnniversary, selectedHistoryOccurrence.year)
    : [];
  const selectedMilestoneHistoryPlans = selectedHistoryAnniversary
    ? findMilestonePlanHistory(state.anniversaryPlans, person.id, selectedHistoryAnniversary, selectedHistoryMilestone ? {
        targetDate: selectedHistoryMilestone.date,
        milestoneDay: selectedHistoryMilestone.milestoneDay
      } : undefined)
    : [];
  const completionTips: CompletionTip[] = [
    {
      id: "birthday",
      icon: <Calendar />,
      title: "补充生日",
      desc: "生日会自动出现在纪念日、日历和首页提醒。",
      visible: !person.birthday
    },
    {
      id: "preferences",
      icon: <Heart />,
      title: "补充喜好",
      desc: "记录颜色、食物、饮品、活动等偏好。",
      visible: !person.preferences.length
    },
    {
      id: "dislikes",
      icon: <Sparkles />,
      title: "补充禁忌",
      desc: "把过敏、口味、雷区提前记下来。",
      visible: !person.dislikes.length
    },
    {
      id: "anniversaries",
      icon: <Gift />,
      title: "补充纪念日",
      desc: "相识日、重要节点会自动计算农历和周年。",
      visible: person.anniversaries.length <= (person.birthday ? 1 : 0)
    }
  ];

  return (
    <>
      <section className={`section detail-hero-section ${headerCollapsed ? "collapsed" : ""}`}>
        <GlassCard className="profile-card detail-profile-card person-detail-profile-card">
          {person.favorite && <Star className="person-profile-favorite" />}
          <div className="detail-profile-nav">
            <button className="back-button" type="button" onClick={() => navigate("/people")}>
              <ArrowLeft /> 返回人物
            </button>
            <strong className="detail-compact-title">
              {person.name}
              {person.nickname ? ` · ${person.nickname}` : ""}
            </strong>
          </div>
          <div className="detail-profile-body">
            <div className="profile-photo">{initials(person.name)}</div>
            <div className="profile-main">
              <div className="profile-title">
                <h2>
                  {person.name}
                  {person.nickname ? ` · ${person.nickname}` : ""}
                </h2>
              </div>
              <p>{person.relationship}</p>
              {person.birthday && <BirthdaySummary date={person.birthday} />}
              <div className="detail-profile-actions">
                <button className="category-pill active person-profile-edit" onClick={() => setEditing(true)}>
                  编辑资料
                </button>
                <NotionRecordAction entityType="person" entityId={person.id} />
              </div>
            </div>
          </div>
        </GlassCard>
      </section>

      <section className="section person-detail-section">
        <div className="section-header">
          <h2>
            <Heart /> 关系摘要
          </h2>
          <button className="see-all" onClick={() => setAddingMemory(true)}>
            记录
          </button>
        </div>
        <GlassCard className="detail-summary-card relation-card">
          <div className={`wave-container ${relationshipHealth.temperature}`} aria-hidden="true">
            <svg viewBox="0 0 120 28">
              <path className="wave-1" d="M0 15 C 30 15, 30 5, 60 5 C 90 5, 90 15, 120 15 L 120 28 L 0 28 Z" />
              <path className="wave-2" d="M0 10 C 30 10, 30 20, 60 20 C 90 20, 90 10, 120 10 L 120 28 L 0 28 Z" />
            </svg>
          </div>
          <div className="relation-card-content">
            <div className="summary-grid">
              <div className="summary-metric">
                <strong>{relatedMemories.length}</strong>
                <span>共同回忆</span>
              </div>
              <div className="summary-metric">
                <strong>{latestMemory ? formatMonthDay(latestMemory.date) : "暂无"}</strong>
                <span>最近一次</span>
              </div>
            </div>
            {relatedPlans.length > 0 && (
              <div className="summary-line">
                <strong>计划</strong>
                <span>{relatedPlans.length} 条待发生记录</span>
              </div>
            )}
            <div className="summary-line">
              <strong>关系</strong>
              <span>{person.relationship || "未设置"}</span>
            </div>
            <div className="summary-line">
              <strong>关系温度</strong>
              <span>
                <span className={`relationship-health-pill inline ${relationshipHealth.temperature}`}>{relationshipHealth.label}</span>
                {" "}{relationshipHealth.detail}
              </span>
            </div>
            <div className="summary-line">
              <strong>常出现地点</strong>
              <span>{topPlaces.length ? topPlaces.map((item) => item.label).join("、") : "还没有共同地点"}</span>
            </div>
          </div>
        </GlassCard>
      </section>

      <CompletionTipsSection tips={completionTips} onAction={() => setEditing(true)} />

      <section className="section person-detail-section">
        <div className="section-header">
          <h2>
            <MessageCircle /> 相处小抄
          </h2>
          <button className="see-all" onClick={() => setAddingMemory(true)}>
            记一件事
          </button>
        </div>
        <div className="person-action-grid">
          {actionCenter.map((action) => (
            <button className={`person-action-card glass-card ${action.tone}`} type="button" key={action.id} onClick={action.onClick}>
              <span>{action.icon}</span>
              <strong>{action.title}</strong>
              <small>{action.desc}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>
            <Heart /> 喜好档案
          </h2>
          <button className="see-all" type="button" onClick={() => setEditingPreferenceMode("preferences")}>
            编辑
          </button>
        </div>
        <PreferenceBlocks groups={person.preferences} emptyText="还没有记录喜好" />
      </section>

      <section className="section">
        <div className="section-header">
          <h2>禁忌 / 雷区</h2>
          <button className="see-all" type="button" onClick={() => setEditingPreferenceMode("dislikes")}>
            编辑
          </button>
        </div>
        <PreferenceBlocks groups={person.dislikes} emptyText="还没有记录禁忌" danger />
      </section>

      <section className="section person-detail-section" ref={anniversariesRef} id="person-anniversaries">
        <div className="section-header">
          <h2>
            <Calendar /> 纪念日
          </h2>
        </div>
        <div className="list">
          {person.anniversaries.map((item) => {
            const occurrence = buildAnniversaryOccurrence(item.date);
            const milestone = buildNextAnniversaryMilestone(item);
            const annualTarget = buildAnnualPlanTarget(occurrence);
            const milestoneTarget = milestone ? buildMilestonePlanTarget(milestone) : null;
            const plan = findPlanForAnniversaryTarget(state.anniversaryPlans, person.id, item, annualTarget);
            const milestonePlan = milestoneTarget
              ? findPlanForAnniversaryTarget(state.anniversaryPlans, person.id, item, milestoneTarget)
              : undefined;
            const historyPlans = findAnnualPlanHistory(state.anniversaryPlans, person.id, item, occurrence.year);
            const milestoneHistoryPlans = findMilestonePlanHistory(state.anniversaryPlans, person.id, item, milestone ? {
              targetDate: milestone.date,
              milestoneDay: milestone.milestoneDay
            } : undefined);
            const allPlans = buildAnniversaryPlanList(state.anniversaryPlans, person.id, item);
            const historyCount = historyPlans.length + milestoneHistoryPlans.length;
            const anniversaryKey = getAnniversaryKey(item);
            const isSelectedAnniversary = anniversaryKey === selectedAnniversaryKey;
            return (
              <div
                className="anniversary-card-anchor"
                id={`person-anniversary-${encodeURIComponent(anniversaryKey)}`}
                key={`${item.title}-${item.date}`}
                ref={(node) => {
                  anniversaryCardRefs.current[anniversaryKey] = node;
                }}
              >
                <GlassCard className={`anniversary-detail-card ${isSelectedAnniversary ? "targeted" : ""}`}>
                  <div className="anniversary-detail-head">
                    <strong>{item.title}</strong>
                    <span className="anniversary-detail-date">{item.date}</span>
                  </div>
                  <div className="anniversary-detail-meta">
                    {anniversaryRelativeLabel(item.date)} · {item.title === "生日" ? birthdayAgeLabel(item.date) : anniversaryYearLabel(item.date)}
                  </div>
                  {milestone && (
                    <button
                      className={`anniversary-milestone-line ${milestonePlan ? "has-plan" : ""}`}
                      type="button"
                      onClick={() => setPlanningTarget({ anniversaryKey, targetKind: "milestone" })}
                    >
                      <span>{milestone.label}</span>
                      <strong>{milestonePlan ? planStatusLabel(milestonePlan.status) : formatDaysUntilLabel(milestone.days)}</strong>
                      <small>{milestone.date}</small>
                    </button>
                  )}
                  <AnniversaryPlanSummary plan={plan} />
                  <div className="anniversary-plan-actions">
                    <button type="button" onClick={() => setPlanListTarget({ anniversaryKey })}>
                      {allPlans.length ? `安排 ${allPlans.length}` : "添加安排"}
                    </button>
                    <button type="button" onClick={() => setHistoryTarget({ anniversaryKey })}>
                      {historyCount ? `历史 ${historyCount}` : "历史"}
                    </button>
                    {plan?.memoryId && (
                      <button type="button" onClick={() => navigate(`/memories/${plan.memoryId}`)}>
                        已记录回忆
                      </button>
                    )}
                    {milestonePlan?.memoryId && (
                      <button type="button" onClick={() => navigate(`/memories/${milestonePlan.memoryId}`)}>
                        已记录节点回忆
                      </button>
                    )}
                  </div>
                </GlassCard>
              </div>
            );
          })}
          {!person.anniversaries.length && (
            <GlassCard className="empty">
              还没有纪念日，点击上方“编辑资料”补充。
            </GlassCard>
          )}
        </div>
      </section>

      <section className="section person-detail-section">
        <div className="section-header">
          <h2>
            <MapPin /> 一起去过
          </h2>
        </div>
        <div className="related-places-row">
          {relatedPlaces.map((placeId) => (
            <button
              key={placeId}
              className="tap-chip"
              onClick={() => navigate(`/places/${placeId}`)}
            >
              {getPlaceName(placeId)}
            </button>
          ))}
          {!relatedPlaces.length && <GlassCard className="empty">还没有一起去过的地点</GlassCard>}
        </div>
      </section>

      <MemoryTimelineSection
        title="相关记录"
        groupedMemories={groupedMemories}
        getPersonName={getPersonName}
        getPlaceName={getPlaceName}
        onAddMemory={() => setAddingMemory(true)}
        emptyTitle="还没有和 TA 相关的记录"
        emptyDesc="记录一次相处，让这个人物变得更完整。"
        emptyAction="记录和 TA 的事"
      />

      <EntrySheet type={editing ? "person" : null} itemId={person.id} onClose={() => setEditing(false)} />
      <PersonPreferenceSheet
        person={editingPreferenceMode ? person : null}
        mode={editingPreferenceMode || "preferences"}
        onClose={() => setEditingPreferenceMode(null)}
        onSave={async (personId, patch) => {
          await updatePersonProfile(personId, patch);
        }}
      />
      <EntrySheet
        type={addingMemory ? "memory" : null}
        initialPersonId={person.id}
        initialPlaceIds={memoryInitialPlaceIds}
        initialDate={memoryInitialDate}
        memoryMode="quick"
        onClose={() => {
          setAddingMemory(false);
          setMemoryInitialDate(undefined);
          setMemoryInitialPlaceIds([]);
          setMemoryPlanId(undefined);
        }}
        onSaved={async (result) => {
          if (result.type !== "memory" || !memoryPlanId) return;
          const plan = state.anniversaryPlans.find((item) => item.id === memoryPlanId);
          if (!plan) return;
          await saveAnniversaryPlan({
            ...plan,
            status: "done",
            memoryId: result.id,
            updatedAt: new Date().toISOString()
          });
        }}
      />
      {selectedAnniversary && selectedPlanTarget && (
        <AnniversaryPlanSheet
          person={person}
          anniversary={selectedAnniversary}
          occurrenceYear={selectedPlanTarget.occurrenceYear}
          targetKind={selectedPlanTarget.targetKind}
          milestoneDay={selectedPlanTarget.milestoneDay}
          milestoneLabel={selectedPlanTarget.milestoneLabel}
          targetDate={selectedPlanTarget.targetDate}
          daysUntilTarget={selectedPlanTarget.daysUntilTarget}
          plan={selectedPlan}
          historicalPlans={selectedPlanHistory}
          places={state.places}
          onClose={() => setPlanningTarget(null)}
          onSave={async (plan) => {
            await saveAnniversaryPlan(plan);
          }}
          onDelete={async (planId) => {
            const accepted = await confirm({
              title: "删除纪念日安排",
              message: "确认删除这条安排？待办、预算、地点和关联回忆信息都会从安排中移除。",
              confirmText: "删除"
            });
            if (!accepted) return;
            await deleteAnniversaryPlan(planId);
            setPlanningTarget(null);
          }}
          onCreateMemory={(plan) => {
            setPlanningTarget(null);
            setMemoryInitialDate(plan.targetDate);
            setMemoryInitialPlaceIds(plan.placeIds);
            setMemoryPlanId(plan.id);
            setAddingMemory(true);
          }}
        />
      )}
      {selectedListAnniversary && (
        <AnniversaryPlanListSheet
          person={person}
          anniversary={selectedListAnniversary}
          plans={selectedListPlans}
          onClose={() => setPlanListTarget(null)}
          onCreateAnnual={() => {
            setPlanListTarget(null);
            setPlanningTarget({ anniversaryKey: getAnniversaryKey(selectedListAnniversary), targetKind: "annual" });
          }}
          onCreateMilestone={() => {
            setPlanListTarget(null);
            setPlanningTarget({ anniversaryKey: getAnniversaryKey(selectedListAnniversary), targetKind: "milestone" });
          }}
          onEditPlan={(plan) => {
            setPlanListTarget(null);
            setPlanningTarget({
              anniversaryKey: getAnniversaryKey(selectedListAnniversary),
              targetKind: normalizeAnniversaryPlanTargetKind(plan),
              planId: plan.id
            });
          }}
          onDeletePlan={async (plan) => {
            const accepted = await confirm({
              title: "删除纪念日安排",
              message: `确认删除「${plan.title}」？待办、预算、地点和关联回忆信息都会从安排中移除。`,
              confirmText: "删除"
            });
            if (!accepted) return;
            await deleteAnniversaryPlan(plan.id);
          }}
          onOpenMemory={(memoryId) => {
            setPlanListTarget(null);
            navigate(`/memories/${memoryId}`);
          }}
        />
      )}
      {selectedHistoryAnniversary && (
        <AnniversaryPlanHistorySheet
          person={person}
          anniversary={selectedHistoryAnniversary}
          annualPlans={selectedAnnualHistoryPlans}
          milestonePlans={selectedMilestoneHistoryPlans}
          onClose={() => setHistoryTarget(null)}
          onEditPlan={(plan) => {
            setHistoryTarget(null);
            setPlanningTarget({
              anniversaryKey: getAnniversaryKey(selectedHistoryAnniversary),
              targetKind: normalizeAnniversaryPlanTargetKind(plan),
              planId: plan.id
            });
          }}
          onOpenMemory={(memoryId) => {
            setHistoryTarget(null);
            navigate(`/memories/${memoryId}`);
          }}
        />
      )}
    </>
  );
}

function buildPersonActionCenter({
  person,
  relatedMemories,
  relatedPlaces,
  anniversaryPlans,
  getPlaceName,
  onRecordMemory,
  onOpenAnniversaries,
  onOpenPlace,
  onEditPreference
}: {
  person: { id: string; name: string; birthday?: string; anniversaries: Anniversary[]; preferences: Array<{ category: string; items: string[] }>; dislikes: Array<{ category: string; items: string[] }> };
  relatedMemories: Array<{ id: string; date: string }>;
  relatedPlaces: string[];
  anniversaryPlans: AnniversaryPlan[];
  getPlaceName: (id: string) => string;
  onRecordMemory: () => void;
  onOpenAnniversaries: () => void;
  onOpenPlace: (placeId: string) => void;
  onEditPreference: (mode: PersonPreferenceMode) => void;
}) {
  const latestMemory = relatedMemories[0];
  const daysSince = latestMemory ? daysSinceDate(latestMemory.date) : null;
  const nextAnniversary = buildNextPersonAnniversaryAction(person.anniversaries);
  const nextPlanTarget = nextAnniversary
    ? nextAnniversary.kind === "milestone"
      ? buildMilestonePlanTarget(nextAnniversary)
      : buildAnnualPlanTarget(nextAnniversary.occurrence)
    : null;
  const nextPlan = nextAnniversary && nextPlanTarget
    ? findPlanForAnniversaryTarget(anniversaryPlans, person.id, nextAnniversary.anniversary, nextPlanTarget)
    : undefined;
  const giftHints = [
    ...person.preferences.flatMap((group) => group.items),
    ...person.dislikes.flatMap((group) => group.items).map((item) => `避开 ${item}`)
  ].slice(0, 4);
  const hasDislikeHints = person.dislikes.some((group) => group.items.length > 0);

  return [
    {
      id: "contact",
      icon: <MessageCircle />,
      title: daysSince === null ? "从第一次相处开始" : daysSince >= 21 ? `${daysSince} 天没记录互动` : "近期有互动记录",
      desc: daysSince === null ? "点这里先记一件和 TA 有关的小事。" : latestMemory ? `上次记录：${formatMonthDay(latestMemory.date)}，可以继续补一条。` : "",
      tone: daysSince === null || (daysSince ?? 0) >= 21 ? "warm" : "cool",
      onClick: onRecordMemory
    },
    {
      id: "anniversary",
      icon: <Calendar />,
      title: nextAnniversary
        ? `${formatDaysUntilLabel(nextAnniversary.days)} · ${nextAnniversary.anniversary.title}${nextAnniversary.kind === "milestone" ? nextAnniversary.label : ""}`
        : "还没有纪念日",
      desc: nextAnniversary
        ? nextPlan
          ? `安排状态：${planStatusLabel(nextPlan.status)}`
          : nextAnniversary.kind === "milestone"
          ? `天数节点：${nextAnniversary.label}，适合记录或提前准备。`
          : "还没有安排，可以提前准备。"
        : "补充生日或纪念日后会自动提醒。",
      tone: nextAnniversary && !nextPlan ? "warm" : "cool",
      onClick: onOpenAnniversaries
    },
    {
      id: "places",
      icon: <MapPin />,
      title: relatedPlaces.length ? `一起去过 ${relatedPlaces.length} 个地点` : "还没有共同地点",
      desc: relatedPlaces.length ? `${relatedPlaces.slice(0, 3).map(getPlaceName).join("、")}，点开常去地点。` : "记录回忆时关联地点后会自动汇总。",
      tone: "cool",
      onClick: relatedPlaces[0] ? () => onOpenPlace(relatedPlaces[0]) : onRecordMemory
    },
    {
      id: "hints",
      icon: giftHints.length ? <Gift /> : <CheckCircle2 />,
      title: giftHints.length ? "送礼和避雷线索" : "还没有偏好线索",
      desc: giftHints.length ? `${giftHints.join("、")}，点这里继续整理。` : "补充喜好和雷区后，安排纪念日更省心。",
      tone: giftHints.length ? "cool" : "warm",
      onClick: () => onEditPreference(hasDislikeHints ? "dislikes" : "preferences")
    }
  ];
}

function buildNextPersonAnniversaryAction(anniversaries: Anniversary[]) {
  return anniversaries
    .flatMap((anniversary) => {
      const annual = {
        kind: "annual" as const,
        anniversary,
        days: daysUntil(anniversary.date),
        occurrence: buildAnniversaryOccurrence(anniversary.date)
      };
      const milestone = buildNextAnniversaryMilestone(anniversary);
      if (!milestone) return [annual];
      return [
        annual,
        {
          kind: "milestone" as const,
          anniversary,
          milestoneDay: milestone.milestoneDay,
          days: milestone.days,
          label: milestone.label,
          date: milestone.date
        }
      ];
    })
    .sort((left, right) => left.days - right.days)[0];
}

function daysSinceDate(date: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${date}T00:00:00`);
  target.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - target.getTime()) / 86400000);
}

function buildPlanningTargetForSheet(
  anniversary: Anniversary,
  planningTarget: PlanningTarget | null,
  existingPlan?: AnniversaryPlan
): AnniversaryPlanTarget | null {
  if (existingPlan) return planToTarget(existingPlan);

  const occurrence = buildAnniversaryOccurrence(anniversary.date);
  if (planningTarget?.targetKind === "milestone") {
    const milestone = buildNextAnniversaryMilestone(anniversary);
    return milestone ? buildMilestonePlanTarget(milestone) : null;
  }

  return buildAnnualPlanTarget(occurrence);
}

function planToTarget(plan: AnniversaryPlan): AnniversaryPlanTarget {
  const targetKind = normalizeAnniversaryPlanTargetKind(plan);
  return {
    targetKind,
    occurrenceYear: plan.occurrenceYear,
    targetDate: plan.targetDate,
    daysUntilTarget: daysUntilDateValue(plan.targetDate),
    milestoneDay: targetKind === "milestone" ? plan.milestoneDay : undefined,
    milestoneLabel: targetKind === "milestone" ? plan.milestoneLabel : undefined
  };
}

function buildAnniversaryPlanList(plans: AnniversaryPlan[], personId: string, anniversary: Anniversary) {
  return plans
    .filter((plan) =>
      plan.personId === personId &&
      plan.anniversaryTitle === anniversary.title &&
      plan.anniversaryDate === anniversary.date
    )
    .sort((left, right) =>
      right.targetDate.localeCompare(left.targetDate) ||
      Number(normalizeAnniversaryPlanTargetKind(right) === "milestone") - Number(normalizeAnniversaryPlanTargetKind(left) === "milestone") ||
      (right.milestoneDay || 0) - (left.milestoneDay || 0)
    );
}

function daysUntilDateValue(date: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${date}T00:00:00`);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function AnniversaryPlanListSheet({
  person,
  anniversary,
  plans,
  onClose,
  onCreateAnnual,
  onCreateMilestone,
  onEditPlan,
  onDeletePlan,
  onOpenMemory
}: {
  person: { name: string };
  anniversary: Anniversary;
  plans: AnniversaryPlan[];
  onClose: () => void;
  onCreateAnnual: () => void;
  onCreateMilestone: () => void;
  onEditPlan: (plan: AnniversaryPlan) => void;
  onDeletePlan: (plan: AnniversaryPlan) => Promise<void>;
  onOpenMemory: (memoryId: string) => void;
}) {
  const hasMilestone = Boolean(buildNextAnniversaryMilestone(anniversary));
  const annualPlans = plans.filter((plan) => normalizeAnniversaryPlanTargetKind(plan) === "annual");
  const milestonePlans = plans.filter((plan) => normalizeAnniversaryPlanTargetKind(plan) === "milestone");

  return (
    <div className="sheet anniversary-plan-list-sheet">
      <button className="sheet-backdrop" type="button" aria-label="关闭全部安排" onClick={onClose} />
      <section className="sheet-panel">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div>
            <p className="date-label">{person.name} · {anniversary.title}</p>
            <h2>管理安排</h2>
          </div>
          <button className="sheet-close" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="plan-list-actions">
          <button type="button" onClick={onCreateAnnual}>添加年度安排</button>
          {hasMilestone && <button type="button" onClick={onCreateMilestone}>添加节点安排</button>}
        </div>
        {plans.length ? (
          <div className="plan-list-groups">
            <PlanListGroup
              title={`年度安排 ${annualPlans.length}`}
              emptyText="还没有年度安排"
              plans={annualPlans}
              onEditPlan={onEditPlan}
              onDeletePlan={onDeletePlan}
              onOpenMemory={onOpenMemory}
            />
            <PlanListGroup
              title={`节点安排 ${milestonePlans.length}`}
              emptyText="还没有节点安排"
              plans={milestonePlans}
              onEditPlan={onEditPlan}
              onDeletePlan={onDeletePlan}
              onOpenMemory={onOpenMemory}
            />
          </div>
        ) : (
          <GlassCard className="empty">还没有保存过安排，可以先添加年度安排或节点安排。</GlassCard>
        )}
      </section>
    </div>
  );
}

function PlanListGroup({
  title,
  emptyText,
  plans,
  onEditPlan,
  onDeletePlan,
  onOpenMemory
}: {
  title: string;
  emptyText: string;
  plans: AnniversaryPlan[];
  onEditPlan: (plan: AnniversaryPlan) => void;
  onDeletePlan: (plan: AnniversaryPlan) => Promise<void>;
  onOpenMemory: (memoryId: string) => void;
}) {
  return (
    <div className="plan-list-group">
      <strong>{title}</strong>
      {plans.length ? (
        <div className="plan-history-list expanded">
          {plans.map((plan) => (
            <PlanListItem
              plan={plan}
              key={plan.id}
              onEdit={() => onEditPlan(plan)}
              onDelete={() => void onDeletePlan(plan)}
              onOpenMemory={onOpenMemory}
            />
          ))}
        </div>
      ) : (
        <div className="plan-list-empty">{emptyText}</div>
      )}
    </div>
  );
}

function PlanListItem({
  plan,
  onEdit,
  onDelete,
  onOpenMemory
}: {
  plan: AnniversaryPlan;
  onEdit: () => void;
  onDelete?: () => void;
  onOpenMemory: (memoryId: string) => void;
}) {
  const isMilestone = normalizeAnniversaryPlanTargetKind(plan) === "milestone";

  return (
    <div className={`plan-history-item plan-list-item ${plan.status}`}>
      <button type="button" className="plan-list-open" onClick={onEdit}>
        <div className="plan-history-meta">
          <strong>{isMilestone ? (plan.milestoneLabel || "节点") : plan.occurrenceYear}</strong>
          <span>{planStatusLabel(plan.status)} · {plan.targetDate}</span>
        </div>
        <div className="plan-history-main">
          <strong>{plan.title}</strong>
          <span>
            {formatPlanProgress(plan)}
            {plan.budget ? ` · ${plan.budget}` : ""}
          </span>
        </div>
      </button>
      <div className="plan-list-row-actions">
        {plan.memoryId && (
          <button type="button" className="plan-history-action" onClick={() => onOpenMemory(plan.memoryId!)}>
            回忆
          </button>
        )}
        <button type="button" className="plan-history-action" onClick={onEdit}>
          编辑
        </button>
        {onDelete && (
          <button type="button" className="plan-history-action danger" onClick={onDelete}>
            删除
          </button>
        )}
      </div>
    </div>
  );
}

function AnniversaryPlanHistorySheet({
  person,
  anniversary,
  annualPlans,
  milestonePlans,
  onClose,
  onEditPlan,
  onOpenMemory
}: {
  person: { name: string };
  anniversary: Anniversary;
  annualPlans: AnniversaryPlan[];
  milestonePlans: AnniversaryPlan[];
  onClose: () => void;
  onEditPlan: (plan: AnniversaryPlan) => void;
  onOpenMemory: (memoryId: string) => void;
}) {
  const hasPlans = annualPlans.length > 0 || milestonePlans.length > 0;

  return (
    <div className="sheet anniversary-plan-history-sheet">
      <button className="sheet-backdrop" type="button" aria-label="关闭安排历史" onClick={onClose} />
      <section className="sheet-panel">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div>
            <p className="date-label">{person.name} · {anniversary.title}</p>
            <h2>安排历史</h2>
          </div>
          <button className="sheet-close" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>
        {hasPlans ? (
          <div className="plan-list-groups">
            <PlanHistoryGroup
              title={`往年安排 ${annualPlans.length}`}
              emptyText="还没有往年安排"
              plans={annualPlans}
              onEditPlan={onEditPlan}
              onOpenMemory={onOpenMemory}
            />
            <PlanHistoryGroup
              title={`节点历史 ${milestonePlans.length}`}
              emptyText="还没有节点历史"
              plans={milestonePlans}
              onEditPlan={onEditPlan}
              onOpenMemory={onOpenMemory}
            />
          </div>
        ) : (
          <GlassCard className="empty">还没有历史安排</GlassCard>
        )}
      </section>
    </div>
  );
}

function PlanHistoryGroup({
  title,
  emptyText,
  plans,
  onEditPlan,
  onOpenMemory
}: {
  title: string;
  emptyText: string;
  plans: AnniversaryPlan[];
  onEditPlan: (plan: AnniversaryPlan) => void;
  onOpenMemory: (memoryId: string) => void;
}) {
  return (
    <div className="plan-list-group">
      <strong>{title}</strong>
      {plans.length ? (
        <div className="plan-history-list expanded">
          {plans.map((plan) => (
            <PlanListItem
              plan={plan}
              key={plan.id}
              onEdit={() => onEditPlan(plan)}
              onDelete={undefined}
              onOpenMemory={onOpenMemory}
            />
          ))}
        </div>
      ) : (
        <div className="plan-list-empty">{emptyText}</div>
      )}
    </div>
  );
}

function BirthdaySummary({ date }: { date: string }) {
  const lunar = getLunarDateInfo(date);

  return (
    <p className="person-birthday-summary">
      <span>公历生日 · {date}</span>
      {lunar ? (
        <>
          <span>{lunar.lunarText}</span>
          <span>{lunar.ganZhiText}</span>
        </>
      ) : (
        <span>农历信息暂不可用</span>
      )}
    </p>
  );
}

function AnniversaryPlanSummary({ plan }: { plan?: AnniversaryPlan }) {
  if (!plan) {
    return <div className="anniversary-plan-summary empty-plan">还没有安排</div>;
  }

  const done = plan.checklist.filter((item) => item.done).length;
  const status = planStatusLabel(plan.status);
  return (
    <div className={`anniversary-plan-summary ${plan.status}`}>
      <span>{status}</span>
      <strong>{plan.title}</strong>
      <small>{plan.checklist.length ? `${done}/${plan.checklist.length} 项完成` : "暂无待办"}{plan.budget ? ` · ${plan.budget}` : ""}</small>
    </div>
  );
}

function formatPlanProgress(plan: AnniversaryPlan) {
  if (!plan.checklist.length) return "暂无待办";
  const done = plan.checklist.filter((item) => item.done).length;
  return `${done}/${plan.checklist.length} 项完成`;
}

function buildAnniversaryOccurrence(date: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const source = new Date(`${date}T00:00:00`);
  let target = new Date(today.getFullYear(), source.getMonth(), source.getDate());
  if (target < today) target = new Date(today.getFullYear() + 1, source.getMonth(), source.getDate());
  const targetDate = formatDateValue(target);
  return {
    year: target.getFullYear(),
    date: targetDate,
    days: daysUntil(date)
  };
}

function formatDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function scrollDetailTarget(element: HTMLElement | null, behavior: ScrollBehavior) {
  if (!element) return;
  const scrollRoot = document.querySelector<HTMLElement>(".main-content");
  if (!scrollRoot) {
    element.scrollIntoView({ behavior, block: "start" });
    return;
  }

  requestAnimationFrame(() => alignDetailTarget(element, scrollRoot, behavior));
}

function alignDetailTarget(element: HTMLElement, scrollRoot: HTMLElement, behavior: ScrollBehavior) {
  const rootRect = scrollRoot.getBoundingClientRect();
  const targetRect = element.getBoundingClientRect();
  scrollRoot.scrollTo({
    top: scrollRoot.scrollTop + targetRect.top - rootRect.top - getDetailScrollOffset(scrollRoot),
    behavior
  });
}

function getDetailScrollOffset(scrollRoot: HTMLElement | null) {
  const detailHeader = scrollRoot?.querySelector<HTMLElement>(".detail-hero-section");
  const headerHeight = detailHeader?.getBoundingClientRect().height || 76;
  const navHeight = detailHeader?.querySelector<HTMLElement>(".detail-profile-nav")?.getBoundingClientRect().height || 36;

  // The sticky profile header shrinks while the target scroll is running.
  // Capping this value too low lets the final card title slide under the collapsed back bar.
  return Math.max(headerHeight + 34, navHeight + 58, 112);
}

function planStatusLabel(status: AnniversaryPlan["status"]) {
  if (status === "doing") return "准备中";
  if (status === "done") return "已完成";
  if (status === "skipped") return "已跳过";
  return "未开始";
}

function PreferenceBlocks({
  groups,
  emptyText,
  danger = false
}: {
  groups: Array<{ category: string; items: string[] }>;
  emptyText: string;
  danger?: boolean;
}) {
  if (!groups.length) return <GlassCard className="empty">{emptyText}，可以点击“编辑资料”补充。</GlassCard>;

  return (
    <div className={`pref-grid ${danger ? "danger" : ""}`}>
      {groups.map((group) => (
        <GlassCard className={`pref-block ${danger ? "danger" : ""}`} key={group.category}>
          <strong>{group.category}</strong>
          <div className="tags">
            {group.items.map((item) => (
              <span className={`tag ${danger ? "orange" : ""}`} key={item}>
                {item}
              </span>
            ))}
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
