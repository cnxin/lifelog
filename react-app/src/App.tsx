import { useEffect, useRef, useState } from "react";
import { Heart } from "lucide-react";
import type { Category, Day } from "./domain";
import DayEditor from "./DayEditor";
import DayDetail from "./DayDetail";
import CalendarView from "./CalendarView";
import DataPanel from "./DataPanel";
import useCompactLayout from "./useCompactLayout";
import HomeHeader from "./components/HomeHeader";
import useHomeSearch from "./hooks/useHomeSearch";
import PageHeading from "./components/PageHeading";
import HomeHero from "./components/HomeHero";
import Toolbar from "./components/Toolbar";
import DayCard from "./components/DayCard";
import StarterGrid from "./components/StarterGrid";
import EmptyResults from "./components/EmptyResults";
import useDays from "./hooks/useDays";
import useToday from "./hooks/useToday";
import useNotices from "./hooks/useNotices";
import useDayList from "./hooks/useDayList";
import useCardFocus from "./hooks/useCardFocus";
import useWidgetSync from "./hooks/useWidgetSync";
import useReminderSync from "./hooks/useReminderSync";
import useNativeShell from "./hooks/useNativeShell";
import useCelebration from "./hooks/useCelebration";
import useEditorActions from "./hooks/useEditorActions";
import Toast from "./Toast";

export default function App() {
 const compact = useCompactLayout();
 const calendarButtonRef = useRef<HTMLButtonElement>(null);
 const headerRef = useRef<HTMLElement>(null);
 const heroRef = useRef<HTMLDivElement>(null);
 const [filter, setFilter] = useState<"全部" | Category>("全部");
 const [query, setQuery] = useState("");
 const search = useHomeSearch(compact, query, setQuery);
 const [sort, setSort] = useState("upcoming");
 const [sortMenuOpen, setSortMenuOpen] = useState(false);
 const [editor, setEditor] = useState<Day | null>(null);
 const [detailId, setDetailId] = useState<string | null>(null);
 const [calendarDate, setCalendarDate] = useState<string | null>(null);
 const [settings, setSettings] = useState(false);
 const { notice, noticeVisible, onChanged, editorClosed } = useNotices();
 const { days, loaded, error, setError, load, changed } = useDays(onChanged);
 const { today, setToday } = useToday();
 const { visible, upcoming, featured, status } = useDayList(days, today, filter, query, sort);
 const detail = days.find(day => day.id === detailId);
 useEffect(() => { if (detailId && !detail) setDetailId(null); }, [detailId, detail]);
 const { setFocusId, highlightId, setHighlightId } = useCardFocus(editor, detailId, calendarDate, settings);
 const { prepareWidgetUpdate, setWidgetLaunchTick } = useWidgetSync(days, loaded, setDetailId);
 const setNativeSyncTick = useReminderSync({ days, loaded, today, load, setError, setDetailId, prepareWidgetUpdate });
 useNativeShell({ headerRef, sortMenuOpen, setSortMenuOpen, load, setToday, setNativeSyncTick, setWidgetLaunchTick });
 const replayCelebration = useCelebration(loaded, featured, today, status, heroRef);
 const { add, togglePin, save, remove, restore } = useEditorActions({ today, filter, query, calendarDate, detailId,
  setEditor, setFilter, setQuery, setFocusId, changed });
 return (<>
  <a className="skip-link" href="#main-content">跳到日子列表</a>
  <HomeHeader headerRef={headerRef} calendarButtonRef={calendarButtonRef} loaded={loaded} today={today}
   setCalendarDate={setCalendarDate} setSettings={setSettings} add={add}
   compact={compact} query={query} setQuery={setQuery} search={search} />
  <div className="app-shell">
   <main id="main-content" tabIndex={-1}>
    <PageHeading today={today} compact={compact} />
    {error && <div className="error-box" role="alert">{error}<button className="secondary" onClick={() => void load()}>重试</button></div>}
    {!loaded && !error && <p role="status" className="loading">正在打开你的日子…</p>}
    {loaded && <>
     <HomeHero compact={compact} featured={featured} status={status} heroRef={heroRef} total={days.length}
      upcoming={upcoming} add={add} setDetailId={setDetailId} replayCelebration={replayCelebration} />
     <section className="days-section" aria-labelledby="days-title">
      <div className="section-heading"><div><h2 id="days-title">我的日子 <span>{days.length}</span></h2>
       <p>将期待和想念，收进这一页。</p></div><span className="section-caption">每一个，都特别</span></div>
      <Toolbar compact={compact} filter={filter} setFilter={setFilter} query={query} setQuery={setQuery}
       sort={sort} setSort={setSort} sortMenuOpen={sortMenuOpen} setSortMenuOpen={setSortMenuOpen} search={search} />
      {visible.length > 0 ? <ul className="day-grid">{visible.map(day => <DayCard key={day.id} day={day} today={today}
       highlightId={highlightId} setHighlightId={setHighlightId} togglePin={togglePin} setError={setError} setDetailId={setDetailId} />)}</ul>
       : days.length ? <EmptyResults setFilter={setFilter} setQuery={setQuery} /> : <StarterGrid add={add} />}
     </section>
    </>}
    <footer className="footer"><span><Heart size={13} />为在意的日子，留一个位置。</span><span>简单记录 · 本地保存</span></footer>
   </main>
   <Toast notice={notice} visible={noticeVisible} />
   {calendarDate && <CalendarView days={days} today={today} selectedDate={calendarDate} onSelect={setCalendarDate}
    onClose={() => { setCalendarDate(null); requestAnimationFrame(() => calendarButtonRef.current?.focus()); }}
    onAdd={date => add("纪念日", date)} onOpen={day => setDetailId(day.id)} />}
   {detail && <DayDetail day={detail} today={today} onClose={() => setDetailId(null)} onEdit={setEditor} onTogglePin={togglePin}
    onDelete={async id => {
     await remove(id, false);
     setDetailId(null);
     requestAnimationFrame(() => {
      if (!document.querySelector('dialog[open]'))
       (document.querySelector<HTMLElement>(".day-card .card-main") ?? document.querySelector<HTMLElement>(".header-add"))?.focus({ preventScroll: true });
     });
    }} />}
   {editor && <DayEditor key={editor.id} day={editor} existing={days.some(day => day.id === editor.id)}
    onClose={() => { setEditor(null); editorClosed(); }} onSave={save} onDelete={() => remove(editor.id)} />}
   {settings && <DataPanel days={days} onClose={() => setSettings(false)} onImported={() => changed("日子已更新")} onRestore={restore} />}
  </div>
 </>);
}
