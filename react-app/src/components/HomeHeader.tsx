import type { RefObject } from "react";
import { CalendarDays, Settings2, Plus, Search } from "lucide-react";
import SearchField from "./SearchField";
import type useHomeSearch from "../hooks/useHomeSearch";
export default function HomeHeader({
  headerRef,
  calendarButtonRef,
  loaded,
  today,
  setCalendarDate,
  setSettings,
  add,
  compact,
  query,
  setQuery,
  search,
}: {
  headerRef: RefObject<HTMLElement>;
  calendarButtonRef: RefObject<HTMLButtonElement>;
  loaded: boolean;
  today: string;
  setCalendarDate: (date: string) => void;
  setSettings: (open: boolean) => void;
  add: () => void;
  compact: boolean;
  query: string;
  setQuery: (query: string) => void;
  search: ReturnType<typeof useHomeSearch>;
}) {
  return (
    <header ref={headerRef} className="site-header" data-search-open={compact ? search.open : undefined}>
      <div className="header-inner">
        <div className="brand">
          <button
            ref={calendarButtonRef}
            type="button"
            className="brand-icon brand-calendar"
            aria-label="打开日历"
            title="打开日历"
            aria-haspopup="dialog"
            disabled={!loaded}
            onClick={() => setCalendarDate(today)}
          >
            <CalendarDays size={23} strokeWidth={1.7} aria-hidden="true" />
          </button>
          <a className="brand-label" href="/" aria-label="LifeLog 日子首页">
            <span className="brand-cn">日子</span>
            <span className="brand-caption">LifeLog</span>
          </a>
        </div>
        <div className="header-actions">
          <span className="local-indicator">
            <i />
            本地记录，安心珍藏
          </span>
          {compact && <button ref={search.buttonRef} type="button" className="header-search icon-button"
            aria-label="打开搜索" aria-expanded={search.open} aria-controls="days-search"
            disabled={!loaded} onClick={search.toggle}>
            <Search size={18} aria-hidden="true" />
          </button>}
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
            <Plus size={18} aria-hidden="true" />
            <span>新增</span>
          </button>
        </div>
      </div>
      {compact && (search.open || search.exiting) && <div className="toolbar-search"
        aria-hidden={search.open ? undefined : true}
        ref={row => row?.toggleAttribute("inert", !search.open)}>
        <SearchField compact query={query} setQuery={setQuery} inputRef={search.inputRef} close={search.close} />
      </div>}
    </header>
  );
}
