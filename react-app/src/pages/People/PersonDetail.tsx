import { ArrowLeft, Calendar, CheckCircle2, Gift, Heart, MapPin, MessageCircle, Sparkles, Star } from "lucide-react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import AnniversaryPlanSheet from "../../components/AnniversaryPlanSheet";
import CompletionTipsSection, { type CompletionTip } from "../../components/CompletionTipsSection";
import EntrySheet from "../../components/EntrySheet";
import GlassCard from "../../components/GlassCard";
import MemoryTimelineSection from "../../components/MemoryTimelineSection";
import PersonPreferenceSheet, { type PersonPreferenceMode } from "../../components/PersonPreferenceSheet";
import { useLifeLog } from "../../context/LifeLogContext";
import { useCollapsingDetailHeader } from "../../hooks/useCollapsingDetailHeader";
import type { Anniversary, AnniversaryPlan, AnniversaryPlanTargetKind } from "../../types";
import { buildAnnualPlanTarget, buildMilestonePlanTarget, findAnnualPlanHistory, findPlanForAnniversaryTarget } from "../../utils/anniversaryPlans";
import { anniversaryRelativeLabel, anniversaryYearLabel, birthdayAgeLabel, buildNextAnniversaryMilestone, daysUntil, formatDaysUntilLabel, formatMonthDay, getLunarDateInfo } from "../../utils/date";
import { groupMemoriesByMonth, getTopRelatedItems } from "../../utils/detailHelpers";
import { getMemoryPlaceIds } from "../../utils/memoryPlaces";
import { buildRelationshipHealth } from "../../utils/relationshipHealth";
import { initials } from "../../utils/text";
import { useEffect, useRef, useState } from "react";

interface PlanningTarget {
  anniversaryKey: string;
  targetKind: AnniversaryPlanTargetKind;
}

export default function PersonDetail() {
  const { personId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { state, getPersonName, getPlaceName, saveAnniversaryPlan, deleteAnniversaryPlan, updatePersonProfile } = useLifeLog();
  const headerCollapsed = useCollapsingDetailHeader();
  const [editing, setEditing] = useState(false);
  const [addingMemory, setAddingMemory] = useState(false);
  const [memoryInitialDate, setMemoryInitialDate] = useState<string | undefined>();
  const [memoryInitialPlaceIds, setMemoryInitialPlaceIds] = useState<string[]>([]);
  const [planningTarget, setPlanningTarget] = useState<PlanningTarget | null>(null);
  const [historyAnniversaryKey, setHistoryAnniversaryKey] = useState<string | null>(null);
  const [memoryPlanId, setMemoryPlanId] = useState<string | undefined>();
  const [editingPreferenceMode, setEditingPreferenceMode] = useState<PersonPreferenceMode | null>(null);
  const anniversariesRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (location.hash !== "#anniversaries" || !anniversariesRef.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frameId = requestAnimationFrame(() => {
      anniversariesRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
    });
    return () => cancelAnimationFrame(frameId);
  }, [location.hash, personId]);

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

  const relatedMemories = state.memories
    .filter((memory) => (memory.personIds || []).includes(person.id))
    .sort((a, b) => b.date.localeCompare(a.date));

  const relatedPlaces = Array.from(
    new Set(relatedMemories.flatMap(getMemoryPlaceIds).filter(Boolean))
  );
  const relationshipHealth = buildRelationshipHealth(person.id, state.memories);
  const topPlaces = getTopRelatedItems(
    relatedMemories.flatMap(getMemoryPlaceIds).filter(Boolean),
    getPlaceName
  );
  const groupedMemories = groupMemoriesByMonth(relatedMemories);
  const latestMemory = relatedMemories[0];
  const actionCenter = buildPersonActionCenter({
    person,
    relatedMemories,
    relatedPlaces,
    anniversaryPlans: state.anniversaryPlans,
    getPlaceName
  });
  const selectedAnniversary = person.anniversaries.find((item) => getAnniversaryKey(item) === planningTarget?.anniversaryKey);
  const selectedOccurrence = selectedAnniversary ? buildAnniversaryOccurrence(selectedAnniversary.date) : null;
  const selectedMilestone = selectedAnniversary ? buildNextAnniversaryMilestone(selectedAnniversary) : null;
  const selectedPlanTarget = selectedAnniversary && planningTarget?.targetKind === "milestone"
    ? selectedMilestone
      ? buildMilestonePlanTarget(selectedMilestone)
      : null
    : selectedOccurrence
    ? buildAnnualPlanTarget(selectedOccurrence)
    : null;
  const selectedPlan = selectedAnniversary && selectedPlanTarget
    ? findPlanForAnniversaryTarget(state.anniversaryPlans, person.id, selectedAnniversary, selectedPlanTarget)
    : undefined;
  const selectedPlanHistory = selectedAnniversary && selectedPlanTarget?.targetKind === "annual"
    ? findAnnualPlanHistory(state.anniversaryPlans, person.id, selectedAnniversary, selectedPlanTarget.occurrenceYear)
    : [];
  const selectedHistoryAnniversary = person.anniversaries.find((item) => getAnniversaryKey(item) === historyAnniversaryKey);
  const selectedHistoryOccurrence = selectedHistoryAnniversary ? buildAnniversaryOccurrence(selectedHistoryAnniversary.date) : null;
  const selectedHistoryPlans = selectedHistoryAnniversary && selectedHistoryOccurrence
    ? findAnnualPlanHistory(state.anniversaryPlans, person.id, selectedHistoryAnniversary, selectedHistoryOccurrence.year)
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
              <button className="category-pill active person-profile-edit" onClick={() => setEditing(true)}>
                编辑资料
              </button>
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
            <MessageCircle /> 行动中心
          </h2>
          <button className="see-all" onClick={() => setAddingMemory(true)}>
            记录
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
            return (
              <GlassCard className="anniversary-detail-card" key={`${item.title}-${item.date}`}>
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
                    onClick={() => setPlanningTarget({ anniversaryKey: getAnniversaryKey(item), targetKind: "milestone" })}
                  >
                    <span>{milestone.label}</span>
                    <strong>{milestonePlan ? planStatusLabel(milestonePlan.status) : formatDaysUntilLabel(milestone.days)}</strong>
                    <small>{milestone.date}</small>
                  </button>
                )}
                <AnniversaryPlanSummary plan={plan} />
                <div className="anniversary-plan-actions">
                  <button type="button" onClick={() => setPlanningTarget({ anniversaryKey: getAnniversaryKey(item), targetKind: "annual" })}>
                    {plan ? "查看安排" : "添加安排"}
                  </button>
                  {milestone && (
                    <button type="button" onClick={() => setPlanningTarget({ anniversaryKey: getAnniversaryKey(item), targetKind: "milestone" })}>
                      {milestonePlan ? "查看节点安排" : "添加节点安排"}
                    </button>
                  )}
                  <button type="button" onClick={() => setHistoryAnniversaryKey(getAnniversaryKey(item))}>
                    {historyPlans.length ? `往年安排 ${historyPlans.length}` : "往年安排"}
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
        title="回忆时间线"
        groupedMemories={groupedMemories}
        getPersonName={getPersonName}
        getPlaceName={getPlaceName}
        onAddMemory={() => setAddingMemory(true)}
        emptyTitle="还没有和 TA 相关的回忆"
        emptyDesc="记录一次相处，让这个人物变得更完整。"
        emptyAction="记录和 TA 的回忆"
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
      {selectedHistoryAnniversary && (
        <AnniversaryPlanHistorySheet
          person={person}
          anniversary={selectedHistoryAnniversary}
          plans={selectedHistoryPlans}
          onClose={() => setHistoryAnniversaryKey(null)}
          onOpenMemory={(memoryId) => {
            setHistoryAnniversaryKey(null);
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
  getPlaceName
}: {
  person: { id: string; name: string; birthday?: string; anniversaries: Anniversary[]; preferences: Array<{ category: string; items: string[] }>; dislikes: Array<{ category: string; items: string[] }> };
  relatedMemories: Array<{ id: string; date: string }>;
  relatedPlaces: string[];
  anniversaryPlans: AnniversaryPlan[];
  getPlaceName: (id: string) => string;
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

  return [
    {
      id: "contact",
      icon: <MessageCircle />,
      title: daysSince === null ? "还没有共同回忆" : daysSince >= 21 ? `${daysSince} 天没记录互动` : "近期有互动记录",
      desc: daysSince === null ? "可以从第一次相处开始记录。" : latestMemory ? `上次记录：${formatMonthDay(latestMemory.date)}` : "",
      tone: daysSince === null || (daysSince ?? 0) >= 21 ? "warm" : "cool",
      onClick: () => undefined
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
      onClick: () => {
        document.getElementById("person-anniversaries")?.scrollIntoView({ behavior: "smooth" });
      }
    },
    {
      id: "places",
      icon: <MapPin />,
      title: relatedPlaces.length ? `一起去过 ${relatedPlaces.length} 个地点` : "还没有共同地点",
      desc: relatedPlaces.length ? relatedPlaces.slice(0, 3).map(getPlaceName).join("、") : "记录回忆时关联地点后会自动汇总。",
      tone: "cool",
      onClick: () => undefined
    },
    {
      id: "hints",
      icon: giftHints.length ? <Gift /> : <CheckCircle2 />,
      title: giftHints.length ? "送礼和避雷线索" : "还没有偏好线索",
      desc: giftHints.length ? giftHints.join("、") : "补充喜好和雷区后，安排纪念日更省心。",
      tone: giftHints.length ? "cool" : "warm",
      onClick: () => undefined
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

function AnniversaryPlanHistorySheet({
  person,
  anniversary,
  plans,
  onClose,
  onOpenMemory
}: {
  person: { name: string };
  anniversary: Anniversary;
  plans: AnniversaryPlan[];
  onClose: () => void;
  onOpenMemory: (memoryId: string) => void;
}) {
  return (
    <div className="sheet anniversary-plan-history-sheet">
      <button className="sheet-backdrop" type="button" aria-label="关闭往年安排" onClick={onClose} />
      <section className="sheet-panel">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div>
            <p className="date-label">{person.name} · {anniversary.title}</p>
            <h2>往年安排</h2>
          </div>
          <button className="sheet-close" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>
        {plans.length ? (
          <div className="plan-history-list expanded">
            {plans.map((plan) => (
              <div className={`plan-history-item ${plan.status}`} key={plan.id}>
                <div className="plan-history-meta">
                  <strong>{plan.occurrenceYear}</strong>
                  <span>{planStatusLabel(plan.status)} · {plan.targetDate}</span>
                </div>
                <div className="plan-history-main">
                  <strong>{plan.title}</strong>
                  <span>
                    {formatPlanProgress(plan)}
                    {plan.budget ? ` · ${plan.budget}` : ""}
                  </span>
                </div>
                {plan.memoryId && (
                  <button type="button" className="plan-history-action" onClick={() => onOpenMemory(plan.memoryId!)}>
                    查看回忆
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <GlassCard className="empty">还没有往年安排</GlassCard>
        )}
      </section>
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

function getAnniversaryKey(anniversary: Anniversary) {
  return `${anniversary.title}|${anniversary.date}`;
}

function formatDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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
