import { BarChart3, CalendarDays, Download, Heart, MapPin, Smile, Tags, Users } from "lucide-react";
import GlassCard from "../../components/GlassCard";
import { useLifeLog } from "../../context/LifeLogContext";
import { useToast } from "../../context/ToastContext";
import { isMemoryPlan } from "../../utils/memoryDisplay";
import { getMemoryPlaceIds } from "../../utils/memoryPlaces";
import { saveImageToGallery, shareImageFile } from "../../utils/imageShare";
import { buildPlaceDisplayName } from "../../utils/placeMeta";

export default function Stats() {
  const { state } = useLifeLog();
  const notify = useToast();
  const stats = buildStatsView(state);

  async function handleExportYearCard() {
    try {
      const dataUrl = await buildYearReviewCard(stats);
      await shareImageFile(`lifelog-year-review-${stats.year}.png`, dataUrl, "分享 LifeLog 年度回顾");
      notify({ message: "已打开年度回顾分享面板", tone: "success", durationMs: 2600 });
    } catch {
      try {
        const dataUrl = await buildYearReviewCard(stats);
        await saveImageToGallery(`lifelog-year-review-${stats.year}.png`, dataUrl);
        notify({ message: "年度回顾图已保存", tone: "success", durationMs: 3200 });
      } catch {
        notify({ message: "生成年度回顾图失败，请稍后重试", tone: "error" });
      }
    }
  }

  return (
    <>
      <section className="section">
        <div className="section-header">
          <h2>
            <BarChart3 /> 轻量统计
          </h2>
          <button className="see-all" type="button" onClick={() => void handleExportYearCard()}>
            <Download /> 年度图
          </button>
        </div>
        <GlassCard className="insight-card stats-summary-card">
          <div className="metric">
            <strong>{stats.memoryCount}</strong>
            <span>回忆</span>
          </div>
          <div className="metric">
            <strong>{stats.activeDays}</strong>
            <span>记录天数</span>
          </div>
          <div className="metric">
            <strong>{stats.peopleCount}</strong>
            <span>人物</span>
          </div>
          <div className="metric">
            <strong>{stats.placeCount}</strong>
            <span>地点</span>
          </div>
        </GlassCard>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>
            <CalendarDays /> 年度热力
          </h2>
        </div>
        <GlassCard className="stats-heatmap-card">
          <div className="stats-heatmap-grid" aria-label="最近一年记录热力">
            {stats.heatmap.map((day) => (
              <span
                key={day.date}
                className={`level-${day.level}`}
                title={`${day.date} · ${day.count} 条`}
              />
            ))}
          </div>
          <div className="stats-legend">
            <span>少</span>
            <i className="level-0" />
            <i className="level-1" />
            <i className="level-2" />
            <i className="level-3" />
            <span>多</span>
          </div>
        </GlassCard>
      </section>

      <section className="section stats-grid-section">
        <GlassCard className="stats-rank-card stats-chart-card">
          <h3>
            <CalendarDays /> 月度节奏
          </h3>
          <div className="stats-month-chart" aria-label="最近 12 个月记录数量">
            {stats.monthlyTrend.map((item) => (
              <span key={item.month} title={`${item.month} · ${item.count} 条`}>
                <i style={{ height: `${item.percent}%` }} />
                <small>{item.label}</small>
              </span>
            ))}
          </div>
        </GlassCard>
        <GlassCard className="stats-rank-card">
          <h3>
            <MapPin /> 足迹分布
          </h3>
          <StatsRankList items={stats.topCities} emptyText="还没有带城市的地点记录" />
        </GlassCard>
      </section>

      <section className="section stats-grid-section">
        <GlassCard className="stats-rank-card">
          <h3>
            <Users /> 人物互动
          </h3>
          <StatsRankList items={stats.topPeople} emptyText="还没有关联人物的回忆" />
        </GlassCard>
        <GlassCard className="stats-rank-card">
          <h3>
            <MapPin /> 地点分布
          </h3>
          <StatsRankList items={stats.topPlaces} emptyText="还没有关联地点的回忆" />
        </GlassCard>
      </section>

      <section className="section stats-grid-section">
        <GlassCard className="stats-rank-card">
          <h3>
            <Smile /> 心情趋势
          </h3>
          <StatsRankList items={stats.topMoods} emptyText="还没有心情记录" />
        </GlassCard>
        <GlassCard className="stats-rank-card">
          <h3>
            <Tags /> 地点分类
          </h3>
          <StatsRankList items={stats.topCategories} emptyText="还没有地点分类数据" />
        </GlassCard>
      </section>

      <section className="section stats-grid-section">
        <GlassCard className="stats-rank-card">
          <h3>
            <Heart /> 最近节奏
          </h3>
          <div className="stats-rhythm-list">
            <span>
              <strong>{stats.thisMonthCount}</strong>
              <small>本月回忆</small>
            </span>
            <span>
              <strong>{stats.last30DaysCount}</strong>
              <small>近 30 天</small>
            </span>
            <span>
              <strong>{stats.longestStreak}</strong>
              <small>最长连续天数</small>
            </span>
          </div>
        </GlassCard>
        <GlassCard className="stats-rank-card stats-review-card">
          <h3>
            <BarChart3 /> 年度摘要
          </h3>
          <p>{stats.reviewSentence}</p>
          <button className="mini-action add" type="button" onClick={() => void handleExportYearCard()}>
            <Download size={14} />
            生成年度回顾图
          </button>
        </GlassCard>
      </section>
    </>
  );
}

function StatsRankList({ items, emptyText }: { items: Array<{ label: string; count: number; percent: number }>; emptyText: string }) {
  if (!items.length) return <p className="stats-empty-text">{emptyText}</p>;
  return (
    <div className="stats-rank-list">
      {items.map((item) => (
        <div className="stats-rank-row" key={item.label}>
          <span>
            <strong>{item.label}</strong>
            <small>{item.count} 条</small>
          </span>
          <i>
            <em style={{ width: `${item.percent}%` }} />
          </i>
        </div>
      ))}
    </div>
  );
}

function buildStatsView(state: ReturnType<typeof useLifeLog>["state"]) {
  const actualMemories = state.memories.filter((memory) => !isMemoryPlan(memory));
  const memoryCountByDate = new Map<string, number>();
  const personCounts = new Map<string, number>();
  const placeCounts = new Map<string, number>();
  const moodCounts = new Map<string, number>();
  const cityCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();

  for (const memory of actualMemories) {
    addCount(memoryCountByDate, memory.date);
    (memory.personIds || []).forEach((id) => addCount(personCounts, id));
    getMemoryPlaceIds(memory).forEach((id) => addCount(placeCounts, id));
    if (memory.mood.trim()) addCount(moodCounts, memory.mood.trim());
  }

  for (const place of state.places) {
    if (place.city.trim()) addCount(cityCounts, place.city.trim());
    if (place.category.trim()) addCount(categoryCounts, place.category.trim());
  }

  const now = new Date();
  const todayKey = toDateKey(now);
  const thisMonthPrefix = todayKey.slice(0, 7);
  const heatmap = buildHeatmap(memoryCountByDate, now);
  const activeDates = Array.from(memoryCountByDate.keys()).sort();
  const monthlyTrend = buildMonthlyTrend(memoryCountByDate, now);
  const topPeople = buildRankItems(personCounts, (id) => state.people.find((person) => person.id === id)?.name || "未命名人物");
  const topPlaces = buildRankItems(placeCounts, (id) => {
    const place = state.places.find((item) => item.id === id);
    return place ? buildPlaceDisplayName(place) : "未命名地点";
  });
  const topMoods = buildRankItems(moodCounts, (mood) => mood);
  const topCities = buildRankItems(cityCounts, (city) => city);
  const topCategories = buildRankItems(categoryCounts, (category) => category);

  return {
    year: now.getFullYear(),
    memoryCount: actualMemories.length,
    peopleCount: state.people.length,
    placeCount: state.places.length,
    activeDays: memoryCountByDate.size,
    thisMonthCount: actualMemories.filter((memory) => memory.date.startsWith(thisMonthPrefix)).length,
    last30DaysCount: heatmap.slice(-30).reduce((sum, day) => sum + day.count, 0),
    longestStreak: buildLongestStreak(activeDates),
    heatmap,
    monthlyTrend,
    topPeople,
    topPlaces,
    topMoods,
    topCities,
    topCategories,
    reviewSentence: buildReviewSentence({
      memoryCount: actualMemories.length,
      activeDays: memoryCountByDate.size,
      topPerson: topPeople[0]?.label,
      topPlace: topPlaces[0]?.label,
      topMood: topMoods[0]?.label
    })
  };
}

function buildHeatmap(counts: Map<string, number>, now: Date) {
  const days = 365;
  const max = Math.max(1, ...Array.from(counts.values()));
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (days - index - 1));
    const key = toDateKey(date);
    const count = counts.get(key) || 0;
    return {
      date: key,
      count,
      level: count ? Math.max(1, Math.min(3, Math.ceil((count / max) * 3))) : 0
    };
  });
}

function buildMonthlyTrend(counts: Map<string, number>, now: Date) {
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return {
      month,
      label: `${date.getMonth() + 1}月`,
      count: 0,
      percent: 8
    };
  });
  const monthByKey = new Map(months.map((item) => [item.month, item]));
  counts.forEach((count, date) => {
    const month = date.slice(0, 7);
    const item = monthByKey.get(month);
    if (item) item.count += count;
  });
  const max = Math.max(1, ...months.map((item) => item.count));
  return months.map((item) => ({
    ...item,
    percent: item.count ? Math.max(12, Math.round((item.count / max) * 100)) : 8
  }));
}

function buildRankItems(counts: Map<string, number>, resolveLabel: (key: string) => string) {
  const max = Math.max(1, ...Array.from(counts.values()));
  return Array.from(counts.entries())
    .map(([key, count]) => ({
      label: resolveLabel(key) || key,
      count,
      percent: Math.max(8, Math.round((count / max) * 100))
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "zh-CN"))
    .slice(0, 8);
}

function buildLongestStreak(dates: string[]) {
  let best = 0;
  let current = 0;
  let previous = "";
  for (const date of dates) {
    current = previous && daysBetween(previous, date) === 1 ? current + 1 : 1;
    best = Math.max(best, current);
    previous = date;
  }
  return best;
}

function daysBetween(left: string, right: string) {
  const leftTime = new Date(`${left}T00:00:00`).getTime();
  const rightTime = new Date(`${right}T00:00:00`).getTime();
  return Math.round((rightTime - leftTime) / 86400000);
}

function addCount(map: Map<string, number>, key: string) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + 1);
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildReviewSentence({
  memoryCount,
  activeDays,
  topPerson,
  topPlace,
  topMood
}: {
  memoryCount: number;
  activeDays: number;
  topPerson?: string;
  topPlace?: string;
  topMood?: string;
}) {
  if (!memoryCount) return "今年还没有留下回忆，先从一件小事开始。";
  const parts = [`留下 ${memoryCount} 条回忆`, `点亮 ${activeDays} 天`];
  if (topPerson) parts.push(`最常出现的人是 ${topPerson}`);
  if (topPlace) parts.push(`常去 ${topPlace}`);
  if (topMood) parts.push(`心情关键词是 ${topMood}`);
  return parts.join("，") + "。";
}

async function buildYearReviewCard(stats: ReturnType<typeof buildStatsView>) {
  const width = 1080;
  const height = 1440;
  const scale = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("当前环境无法生成年度回顾图。");
  ctx.scale(scale, scale);

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#f7efe3");
  gradient.addColorStop(0.56, "#edf7f3");
  gradient.addColorStop(1, "#f4f0ff");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  drawRoundRect(ctx, 74, 74, width - 148, height - 148, 48);
  ctx.fill();

  ctx.fillStyle = "#7c4dff";
  ctx.font = "800 36px sans-serif";
  ctx.fillText("LifeLog", 132, 170);
  ctx.fillStyle = "#242033";
  ctx.font = "900 66px sans-serif";
  ctx.fillText(`${stats.year} 年度回顾`, 132, 270);
  ctx.fillStyle = "rgba(36,32,51,0.62)";
  ctx.font = "600 28px sans-serif";
  drawCanvasText(ctx, stats.reviewSentence, 132, 334, width - 264, 42, 3);

  const cards = [
    { label: "回忆", value: stats.memoryCount },
    { label: "记录天数", value: stats.activeDays },
    { label: "人物", value: stats.peopleCount },
    { label: "地点", value: stats.placeCount }
  ];
  cards.forEach((item, index) => {
    const x = 132 + (index % 2) * 408;
    const y = 500 + Math.floor(index / 2) * 180;
    ctx.fillStyle = index % 2 === 0 ? "rgba(124,77,255,0.1)" : "rgba(15,159,143,0.1)";
    drawRoundRect(ctx, x, y, 360, 138, 30);
    ctx.fill();
    ctx.fillStyle = "#242033";
    ctx.font = "900 52px sans-serif";
    ctx.fillText(String(item.value), x + 34, y + 66);
    ctx.fillStyle = "rgba(36,32,51,0.58)";
    ctx.font = "700 24px sans-serif";
    ctx.fillText(item.label, x + 34, y + 106);
  });

  ctx.fillStyle = "#242033";
  ctx.font = "800 30px sans-serif";
  ctx.fillText("月度节奏", 132, 930);
  const max = Math.max(1, ...stats.monthlyTrend.map((item) => item.count));
  stats.monthlyTrend.forEach((item, index) => {
    const barX = 132 + index * 68;
    const barHeight = item.count ? Math.max(18, Math.round((item.count / max) * 170)) : 8;
    ctx.fillStyle = item.count ? "#7c4dff" : "rgba(36,32,51,0.12)";
    drawRoundRect(ctx, barX, 1120 - barHeight, 36, barHeight, 18);
    ctx.fill();
    ctx.fillStyle = "rgba(36,32,51,0.52)";
    ctx.font = "700 18px sans-serif";
    ctx.fillText(item.label.replace("月", ""), barX + 8, 1160);
  });

  ctx.fillStyle = "rgba(36,32,51,0.72)";
  ctx.font = "700 24px sans-serif";
  const footer = [
    stats.topPeople[0]?.label ? `人物：${stats.topPeople[0].label}` : "",
    stats.topPlaces[0]?.label ? `地点：${stats.topPlaces[0].label}` : "",
    stats.topMoods[0]?.label ? `心情：${stats.topMoods[0].label}` : ""
  ].filter(Boolean).join(" · ");
  drawCanvasText(ctx, footer || "用 LifeLog 留下生活里的小事", 132, 1260, width - 264, 36, 2);

  return canvas.toDataURL("image/png", 0.95);
}

function drawCanvasText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const chars = Array.from(text);
  let line = "";
  let currentY = y;
  let lines = 0;
  for (const char of chars) {
    const next = line + char;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines += 1;
      ctx.fillText(lines >= maxLines ? `${line.slice(0, Math.max(1, line.length - 1))}…` : line, x, currentY);
      if (lines >= maxLines) return;
      line = char;
      currentY += lineHeight;
    } else {
      line = next;
    }
  }
  if (line && lines < maxLines) ctx.fillText(line, x, currentY);
}

function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}
