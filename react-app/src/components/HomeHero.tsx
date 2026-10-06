import type { RefObject } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Heart,
  Hourglass,
  Plus,
  Flower2,
} from "lucide-react";
import { dayStatus, lunarLabel, type Day } from "../domain";
import { tones, formatDate, yearsLabel, elapsedLabel } from "../dayMeta";
export default function HomeHero({
  compact,
  today,
  featured,
  status,
  heroRef,
  total,
  upcoming,
  add,
  setDetailId,
  replayCelebration,
}: {
  compact: boolean;
  today: string;
  featured: Day | undefined;
  status: ReturnType<typeof dayStatus> | null;
  heroRef: RefObject<HTMLDivElement>;
  total: number;
  upcoming: number;
  add: () => void;
  setDetailId: (id: string) => void;
  replayCelebration: () => void;
}) {
  const years = featured && status ? yearsLabel(featured, status) : "";
  const elapsed = featured && status && featured.date < today ? elapsedLabel(featured, status) : null;
  return (
    <section className="overview" aria-label="日子概览">
      <div
        ref={heroRef}
        className={`hero ${featured ? tones[featured.category] : "rose"}`}
        data-populated={!!featured}
        style={{ viewTransitionName: "hero" }}
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
              aria-label={`查看：${featured.title}`}
              onClick={() => setDetailId(featured.id)}
            >
              <h2>{featured.title}</h2>
              <ArrowUpRight size={23} />
            </button>
            {status.delta === 0 ? (
              <button
                type="button"
                className="hero-count"
                aria-label="再放一次庆祝"
                onClick={replayCelebration}
              >
                <span>{status.label}</span>
              </button>
            ) : (
              <div className="hero-count">
                <span>{status.label}</span>
                {status.delta !== 0 && (
                  <>
                    <strong>{status.count.toLocaleString()}</strong>
                    <span>天</span>
                  </>
                )}
              </div>
            )}
            {(!compact || status.delta === 0) && (
              <p className="hero-caption">
                {status.delta === 0
                  ? "今天，记得为这个日子留一点仪式感。"
                  : featured.note || "平凡的日历里，藏着独一无二的意义。"}
              </p>
            )}
            <div className={`hero-bottom${years ? " has-years" : ""}`}>
              <span>
                <CalendarDays size={15} />
                {formatDate(featured.date)}
                {featured.calendar === "lunar"
                  ? ` · ${lunarLabel(featured.date)}`
                  : ""}
              </span>
              <span className={elapsed ? "hero-elapsed" : years ? "hero-years" : undefined} title={elapsed && years ? years : undefined}>
                {elapsed || years || (featured.repeat === "yearly"
                  ? "每年都值得纪念"
                  : "每一天，都算数")}
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
            {total.toString().padStart(2, "0")}
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
  );
}
