import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownUp,
  ArrowUpRight,
  CalendarDays,
  Cake,
  ChevronRight,
  Heart,
  Hourglass,
  Plus,
  Search,
  Settings2,
  Pin,
  X,
  Flower2,
} from "lucide-react";
import { Capacitor, SystemBars, SystemBarsStyle } from "@capacitor/core";
import {
  categories,
  compareDays,
  dayStatus,
  lunarLabel,
  todayKey,
  type Category,
  type Day,
} from "./domain";
import { db, saveDay } from "./storage";
import DayEditor from "./DayEditor";
import DataPanel from "./DataPanel";

const icons = { 纪念日: Heart, 生日: Cake, 倒数日: Hourglass };
const tones = { 纪念日: "rose", 生日: "amber", 倒数日: "sage" };
function formatDate(date: string) {
  return date.replace(/-/g, ".");
}
function Icon({ category, size = 22 }: { category: Category; size?: number }) {
  const Component = icons[category];
  return <Component size={size} strokeWidth={1.7} aria-hidden="true" />;
}

export default function App() {
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const header = headerRef.current!;
    const update = () =>
      document.documentElement.style.setProperty(
        "--header-offset",
        `${header.getBoundingClientRect().height}px`,
      );
    const observer = new ResizeObserver(update);
    observer.observe(header);
    update();
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--header-offset");
    };
  }, []);
  const [days, setDays] = useState<Day[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [today, setToday] = useState(todayKey());
  const [filter, setFilter] = useState<"全部" | Category>("全部");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("upcoming");
  const [editor, setEditor] = useState<Day | null>(null);
  const [settings, setSettings] = useState(false);
  const [notice, setNotice] = useState("");
  const reload = useCallback(async () => {
    setDays(await db.days.toArray());
  }, []);
  const load = useCallback(async () => {
    setError("");
    try {
      await reload();
      setLoaded(true);
    } catch {
      setError(
        "无法读取本地数据。请检查浏览器是否允许本地存储，然后重试；原数据没有被清除。",
      );
    }
  }, [reload]);
  useEffect(() => {
    void load();
    const channel = new BroadcastChannel("lifelog-days");
    channel.onmessage = () => void load();
    return () => channel.close();
  }, [load]);
  useEffect(() => {
    const update = () => setToday(todayKey());
    const timer = window.setInterval(update, 30000);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = import("@capacitor/app").then(({ App }) =>
      App.addListener("backButton", () => {
        const dialog = document.querySelector("dialog[open]");
        if (dialog)
          dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
        else void App.minimizeApp();
      }),
    );
    void SystemBars.setStyle({ style: SystemBarsStyle.Light }).catch(() => {});
    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, []);
  async function changed(message: string) {
    await reload();
    const channel = new BroadcastChannel("lifelog-days");
    channel.postMessage("updated");
    channel.close();
    setNotice(message);
  }
  function add(category: Category = "纪念日") {
    setEditor({
      id: crypto.randomUUID(),
      title: "",
      date: today,
      category,
      repeat: category === "生日" ? "yearly" : "none",
      calendar: "solar",
      note: "",
      pinned: false,
    });
  }
  const ordered = useMemo(
    () => [...days].sort((a, b) => compareDays(a, b, today)),
    [days, today],
  );
  const visible = useMemo(
    () =>
      ordered
        .filter(
          (day) =>
            (filter === "全部" || day.category === filter) &&
            `${day.title} ${day.note}`
              .toLocaleLowerCase()
              .includes(query.trim().toLocaleLowerCase()),
        )
        .sort((a, b) => (sort === "date" ? b.date.localeCompare(a.date) : 0)),
    [ordered, filter, query, sort],
  );
  const upcoming = days.filter((day) => {
    const delta = dayStatus(day, today).delta;
    return delta >= 0 && delta <= 30;
  }).length;
  const featured = ordered[0];
  const status = featured ? dayStatus(featured, today) : null;
  const date = new Date(`${today}T12:00:00`);
  return (
    <>
      <a className="skip-link" href="#main-content">
        跳到日子列表
      </a>
      <header ref={headerRef} className="site-header">
        <div className="header-inner">
          <a className="brand" href="/" aria-label="LifeLog 日子首页">
            <span className="brand-icon">
              <CalendarDays size={23} strokeWidth={1.7} aria-hidden="true" />
            </span>
            <span className="brand-label">
              <span className="brand-cn">日子</span>
              <span className="brand-caption">LifeLog</span>
            </span>
          </a>
          <div className="header-actions">
            <span className="local-indicator">
              <i />
              本地记录，安心珍藏
            </span>
            <button
              className="header-backup"
              aria-label="数据与备份"
              title="数据与备份"
              disabled={!loaded}
              onClick={() => setSettings(true)}
            >
              <Settings2 size={20} aria-hidden="true" />
              <span>备份</span>
            </button>
            <button
              className="primary header-add"
              aria-label="新增日子"
              disabled={!loaded}
              onClick={() => add()}
            >
              <Plus size={20} aria-hidden="true" />
              <span>新增</span>
            </button>
          </div>
        </div>
      </header>
      <div className="app-shell">
        <main id="main-content" tabIndex={-1}>
          <section className="page-heading">
            <div>
              <p className="eyebrow heading-date">
                {date.toLocaleDateString("zh-CN", {
                  month: "long",
                  day: "numeric",
                  weekday: "long",
                })}
              </p>
              <h1>
                把日子，放在心上<span>。</span>
              </h1>
              <p className="subtitle">有些日子值得期待，有些时光值得记住。</p>
            </div>
            <div className="today">
              <span>
                {date.toLocaleDateString("zh-CN", {
                  month: "long",
                  day: "numeric",
                })}
              </span>
              <small>
                {date.toLocaleDateString("zh-CN", {
                  year: "numeric",
                  weekday: "long",
                })}
              </small>
            </div>
          </section>
          {error && (
            <div className="error-box" role="alert">
              {error}
              <button className="secondary" onClick={() => void load()}>
                重试
              </button>
            </div>
          )}
          {!loaded && !error && (
            <p role="status" className="loading">
              正在打开你的日子…
            </p>
          )}
          {loaded && (
            <>
              <section className="overview" aria-label="日子概览">
                <div
                  className={`hero ${featured ? tones[featured.category] : "rose"}`}
                >
                  <div className="hero-orbit" aria-hidden="true">
                    <Heart />
                  </div>
                  {featured && status ? (
                    <>
                      <div className="hero-kicker">
                        <span className="hero-dot" />
                        {featured.pinned
                          ? "放在心上的日子"
                          : status.delta >= 0
                            ? "下一个值得期待的日子"
                            : "时光留下的印记"}
                        <span className="hero-tag">{featured.category}</span>
                      </div>
                      <button
                        className="hero-link"
                        onClick={() => setEditor(featured)}
                      >
                        <h2>{featured.title}</h2>
                        <ArrowUpRight size={23} />
                      </button>
                      <div className="hero-count">
                        <span>{status.label}</span>
                        {status.delta !== 0 && (
                          <>
                            <strong>{status.count.toLocaleString()}</strong>
                            <span>天</span>
                          </>
                        )}
                      </div>
                      <p className="hero-caption">
                        {status.delta === 0
                          ? "今天，记得为这个日子留一点仪式感。"
                          : featured.note ||
                            "平凡的日历里，藏着独一无二的意义。"}
                      </p>
                      <div className="hero-bottom">
                        <span>
                          <CalendarDays size={15} />
                          {formatDate(featured.date)}
                          {featured.calendar === "lunar"
                            ? ` · ${lunarLabel(featured.date)}`
                            : ""}
                        </span>
                        <span>
                          {featured.repeat === "yearly"
                            ? "每年都值得纪念"
                            : "每一天，都算数"}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="hero-kicker">
                        <span className="hero-dot" />
                        让时间有一点意义
                      </div>
                      <h2 className="empty-hero-title">
                        生活中的小日子，
                        <br />
                        都是大事。
                      </h2>
                      <p className="hero-caption">
                        一个生日，一次相遇，一场期待已久的旅行。
                        <br />
                        从记下第一个日子开始。
                      </p>
                      <button className="hero-add" onClick={() => add()}>
                        <Plus size={18} />
                        记下第一个日子
                        <ArrowUpRight size={18} />
                      </button>
                    </>
                  )}
                </div>
                <aside className="overview-side">
                  <div className="summary-card">
                    <div className="summary-icon">
                      <CalendarDays size={20} />
                    </div>
                    <div className="summary-title">
                      珍藏的日子<span>每一个，都很特别</span>
                    </div>
                    <strong>
                      {days.length.toString().padStart(2, "0")}
                      <small>个</small>
                    </strong>
                  </div>
                  <div className="summary-card">
                    <div className="summary-icon sage">
                      <Hourglass size={20} />
                    </div>
                    <div className="summary-title">
                      即将到来<span>未来 30 天内，含今天</span>
                    </div>
                    <strong>
                      {upcoming.toString().padStart(2, "0")}
                      <small>个</small>
                    </strong>
                  </div>
                  <div className="little-note">
                    <Flower2 size={25} strokeWidth={1.3} />
                    <p>
                      日子慢慢过，
                      <br />
                      美好好好记。
                    </p>
                    <span>ONE DAY AT A TIME</span>
                  </div>
                </aside>
              </section>
              <section className="days-section" aria-labelledby="days-title">
                <div className="section-heading">
                  <div>
                    <h2 id="days-title">
                      我的日子 <span>{days.length}</span>
                    </h2>
                    <p>将期待和想念，收进这一页。</p>
                  </div>
                  <span className="section-caption">每一个，都特别</span>
                </div>
                <div className="toolbar">
                  <div className="filters" role="group" aria-label="按分类筛选">
                    {(["全部", ...categories] as const).map((item) => (
                      <button
                        key={item}
                        aria-pressed={filter === item}
                        className={filter === item ? "active" : ""}
                        onClick={() => setFilter(item)}
                      >
                        {item === "全部" ? (
                          <CalendarDays size={16} />
                        ) : (
                          <Icon category={item} size={16} />
                        )}
                        {item}
                      </button>
                    ))}
                  </div>
                  <div className="list-tools">
                    <div className="search">
                      <Search size={16} />
                      <input
                        aria-label="搜索日子"
                        placeholder="搜索日子…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                      {query && (
                        <button
                          aria-label="清除搜索"
                          onClick={() => setQuery("")}
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>
                    <label className="sort">
                      <ArrowDownUp size={16} />
                      <select
                        aria-label="排序方式"
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                      >
                        <option value="upcoming">临近优先</option>
                        <option value="date">日期从新到旧</option>
                      </select>
                    </label>
                  </div>
                </div>
                {visible.length > 0 ? (
                  <ul className="day-grid">
                    {visible.map((day) => {
                      const item = dayStatus(day, today);
                      return (
                        <li
                          className={`day-card ${tones[day.category]}`}
                          key={day.id}
                        >
                          <div className="card-top">
                            <span className="category-icon">
                              <Icon category={day.category} />
                            </span>
                            <span className="card-category">
                              {day.category}
                            </span>
                            <button
                              className={`pin-button ${day.pinned ? "is-pinned" : ""}`}
                              aria-label={`${day.pinned ? "取消置顶" : "置顶"}：${day.title}`}
                              aria-pressed={day.pinned}
                              onClick={() =>
                                void saveDay({ ...day, pinned: !day.pinned })
                                  .then(() =>
                                    changed(
                                      day.pinned ? "已取消置顶" : "已置顶",
                                    ),
                                  )
                                  .catch(() =>
                                    setError("置顶更新失败，请重试。"),
                                  )
                              }
                            >
                              <Pin size={16} />
                            </button>
                          </div>
                          <button
                            className="card-main"
                            aria-label={`编辑：${day.title}`}
                            onClick={() => setEditor(day)}
                          >
                            <div className="card-copy">
                              <h3>{day.title}</h3>
                              <p className="card-date">
                                {formatDate(day.date)}
                                {day.repeat === "yearly" && (
                                  <span>
                                    {" "}
                                    ·{" "}
                                    {day.calendar === "lunar"
                                      ? lunarLabel(day.date)
                                      : "每年重复"}
                                  </span>
                                )}
                              </p>
                            </div>
                            <div className="card-count">
                              <span>{item.label}</span>
                              {item.delta !== 0 && (
                                <>
                                  <strong>{item.count.toLocaleString()}</strong>
                                  <span>天</span>
                                </>
                              )}
                            </div>
                            <div className="card-bottom">
                              <span>
                                {day.repeat === "yearly"
                                  ? `下次 · ${formatDate(item.next)}`
                                  : day.note ||
                                    (item.delta < 0
                                      ? "一起走过的时光"
                                      : "好好期待这一天")}
                              </span>
                              <ChevronRight size={16} />
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : days.length ? (
                  <div className="no-results">
                    <Search size={28} />
                    <h3>还没有找到这个日子</h3>
                    <p>换个关键词，或者看看其他分类。</p>
                    <button
                      className="secondary"
                      onClick={() => {
                        setFilter("全部");
                        setQuery("");
                      }}
                    >
                      查看全部
                    </button>
                  </div>
                ) : (
                  <div className="starter-grid">
                    {categories.map((category) => (
                      <button
                        className={`starter-card ${tones[category]}`}
                        key={category}
                        onClick={() => add(category)}
                      >
                        <span className="category-icon">
                          <Icon category={category} />
                        </span>
                        <strong>
                          {category === "纪念日"
                            ? "纪念一次相遇"
                            : category === "生日"
                              ? "记住一个生日"
                              : "期待一件好事"}
                        </strong>
                        <span>
                          {category === "纪念日"
                            ? "那些一起走过的日子"
                            : category === "生日"
                              ? "重要的人，不会忘记"
                              : "让等待也变得美好"}
                        </span>
                        <Plus size={18} />
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
          <footer className="footer">
            <span>
              <Heart size={13} />
              为在意的日子，留一个位置。
            </span>
            <span>简单记录 · 本地保存</span>
          </footer>
        </main>
        <div className="toast" role="status">
          {notice}
        </div>
        {editor && (
          <DayEditor
            key={editor.id}
            day={editor}
            existing={days.some((day) => day.id === editor.id)}
            onClose={() => setEditor(null)}
            onSave={async (day) => {
              await saveDay(day);
              await changed("这个日子，记下了。");
            }}
            onDelete={async () => {
              await db.days.delete(editor.id);
              await changed("已删除这个日子");
            }}
          />
        )}
        {settings && (
          <DataPanel
            days={days}
            onClose={() => setSettings(false)}
            onImported={() => changed("日子已更新")}
          />
        )}
      </div>
    </>
  );
}
