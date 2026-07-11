import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { EntryType, Place } from "../types";
import { todayLabel } from "../utils/date";
import BottomNav from "./BottomNav";
import BackToTopButton from "./BackToTopButton";
import EntrySheet from "./EntrySheet";
import FloatingActionButton, { type FloatingAction } from "./FloatingActionButton";
import GlobalSearchPanel from "./GlobalSearchPanel";
import Header from "./Header";
import NetworkBanner from "./NetworkBanner";
import ShortcutHelpPanel from "./ShortcutHelpPanel";
import { Camera, CalendarPlus, ClipboardPaste, MapPinPlus, PenLine, UserPlus } from "lucide-react";
import { useAndroidBackButton } from "../hooks/useAndroidBackButton";
import { useStatusBar } from "../hooks/useStatusBar";
import { useLifeLog } from "../context/LifeLogContext";
import { useToast } from "../context/ToastContext";
import { useReminderScheduling } from "../hooks/useReminderScheduling";
import { useUserPreferences } from "../hooks/useUserPreferences";
import { buildLifeLogShareImportPathFromUrl } from "../utils/lifelogShareLink";
import { parsePlaceShare, type PlaceDraft } from "../utils/placeShareParser";

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "下午好", subtitle: "从今天的一件小事开始" },
  "/people": { title: "人物", subtitle: "记住重要的人和相处细节" },
  "/places": { title: "地点", subtitle: "收藏想再去的地方" },
  "/memories": { title: "记录", subtitle: "回看回忆，也提前安排想做的事" },
  "/calendar": { title: "日历", subtitle: "重要日子和想提前准备的事" },
  "/settings": { title: "设置", subtitle: "默认值、提醒和视觉风格" },
  "/account": { title: "设置", subtitle: "账号、应用、数据和关于" },
  "/stats": { title: "统计", subtitle: "用轻量视角回看记录节奏" }
};

function getPageMeta(pathname: string) {
  if (pageMeta[pathname]) return pageMeta[pathname];
  if (pathname.startsWith("/people/")) return { title: "人物详情", subtitle: "和 TA 有关的细节都在这里" };
  if (pathname.startsWith("/places/malls/")) return { title: "商场详情", subtitle: "这里去过的店和发生过的事" };
  if (pathname.startsWith("/places/")) return { title: "地点详情", subtitle: "适合谁、发生过什么、下次还想不想去" };
  if (pathname.startsWith("/memories/")) return { title: "记录详情", subtitle: "这一次经历或计划的完整记录" };
  return pageMeta["/"];
}

function entryTypeForPath(pathname: string): EntryType {
  if (pathname.startsWith("/people")) return "person";
  if (pathname.startsWith("/places")) return "place";
  return "memory";
}

function isUtilityPage(pathname: string) {
  return pathname === "/settings" || pathname === "/account" || pathname.startsWith("/share/import");
}

type SheetMode = "quick" | "full";

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sheetType, setSheetType] = useState<EntryType | null>(null);
  const [sheetMode, setSheetMode] = useState<SheetMode>("full");
  const [initialMemoryPersonIds, setInitialMemoryPersonIds] = useState<string[]>([]);
  const [initialMemoryPlaceIds, setInitialMemoryPlaceIds] = useState<string[]>([]);
  const [initialMemoryDate, setInitialMemoryDate] = useState<string | undefined>();
  const [editingItemId, setEditingItemId] = useState<string | undefined>();
  const [initialPlaceDraft, setInitialPlaceDraft] = useState<Partial<Place> | undefined>();
  const [initialPlaceShareReview, setInitialPlaceShareReview] = useState<PlaceDraft | undefined>();
  const [placeDraftKey, setPlaceDraftKey] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const seenShareTextsRef = useRef(new Set<string>());
  const meta = getPageMeta(location.pathname);
  const { isLoading, settings } = useLifeLog();
  const { prefs } = useUserPreferences();
  const notify = useToast();

  useLayoutEffect(() => {
    document.querySelector<HTMLElement>(".main-content")?.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location.pathname]);
  useAndroidBackButton(() => {
    if (searchOpen) {
      setSearchOpen(false);
      return true;
    }
    if (shortcutHelpOpen) {
      setShortcutHelpOpen(false);
      return true;
    }
    const closeFabMenuEvent = new Event("lifelog:request-close-fab-menu", { cancelable: true });
    window.dispatchEvent(closeFabMenuEvent);
    if (closeFabMenuEvent.defaultPrevented) return true;
    const closeSheetEvent = new Event("lifelog:request-close-entry-sheet", { cancelable: true });
    window.dispatchEvent(closeSheetEvent);
    if (closeSheetEvent.defaultPrevented) return true;
    const closeFloatingPanelEvent = new Event("lifelog:request-close-floating-panel", { cancelable: true });
    window.dispatchEvent(closeFloatingPanelEvent);
    return closeFloatingPanelEvent.defaultPrevented;
  });
  useEffect(() => {
    document.documentElement.dataset.themeStyle = settings.themeStyle;
    return () => {
      delete document.documentElement.dataset.themeStyle;
    };
  }, [settings.themeStyle]);
  useEffect(() => {
    function handleGlobalShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isEditable = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      const isCommand = (event.metaKey || event.ctrlKey) && !event.altKey;
      const key = event.key.toLowerCase();
      if (isCommand && key === "k") {
        event.preventDefault();
        setSearchOpen(true);
        return;
      }

      if (isCommand && key === "/") {
        event.preventDefault();
        setShortcutHelpOpen(true);
        return;
      }

      if (isCommand && !isEditable && key === "n") {
        event.preventDefault();
        openSheet("memory", event.shiftKey ? "full" : prefs.defaultMemoryMode);
        return;
      }

      if (isCommand && !isEditable) {
        const shortcutRoutes: Record<string, string> = {
          "1": "/",
          "2": "/people",
          "3": "/memories",
          "4": "/places",
          "5": "/calendar"
        };
        const route = shortcutRoutes[key];
        if (route) {
          event.preventDefault();
          navigate(route);
          return;
        }
      }

      if (!isEditable && event.key === "Escape" && searchOpen) {
        event.preventDefault();
        setSearchOpen(false);
        return;
      }

      if (!isEditable && event.key === "Escape" && shortcutHelpOpen) {
        event.preventDefault();
        setShortcutHelpOpen(false);
      }
    }

    document.addEventListener("keydown", handleGlobalShortcut);
    return () => document.removeEventListener("keydown", handleGlobalShortcut);
  }, [navigate, prefs.defaultMemoryMode, searchOpen, shortcutHelpOpen]);
  useEffect(() => {
    function handleDeepLink(event: Event) {
      const url = String((event as CustomEvent<{ url?: unknown }>).detail?.url || "");
      const path = buildLifeLogShareImportPathFromUrl(url);
      if (path) navigate(path);
    }

    window.addEventListener("lifelog:deep-link", handleDeepLink);
    return () => window.removeEventListener("lifelog:deep-link", handleDeepLink);
  }, [navigate]);
  useEffect(() => {
    function handleAndroidShare(event: Event) {
      const text = String((event as CustomEvent<{ text?: unknown }>).detail?.text || "").trim();
      const seenShares = seenShareTextsRef.current;
      if (!text || seenShares.has(text)) return;
      seenShares.add(text);
      window.setTimeout(() => seenShares.delete(text), 5000);

      const parsed = parsePlaceShare(text);
      if (!parsed.name && !parsed.address && !parsed.mapUrl && !parsed.sourceUrl && !parsed.platformLinks) {
        notify({ message: "没有识别到明确地点，可手动粘贴分享内容", tone: "info" });
        return;
      }

      setInitialPlaceDraft(undefined);
      setInitialPlaceShareReview(parsed);
      setSheetMode("full");
      setPlaceDraftKey((current) => current + 1);
      setSheetType("place");
      notify({
        message: parsed.name ? `已识别分享地点：${parsed.name}，请确认后应用` : "已读取分享内容，请确认识别结果",
        tone: "success"
      });
    }

    window.addEventListener("lifelog:android-share-text", handleAndroidShare);
    return () => window.removeEventListener("lifelog:android-share-text", handleAndroidShare);
  }, [notify]);
  useReminderScheduling();
  useStatusBar(settings.themeStyle);

  function openSheet(type: EntryType, mode: SheetMode = "full", options: { personIds?: string[]; placeIds?: string[]; date?: string; itemId?: string } = {}) {
    setInitialPlaceDraft(undefined);
    setInitialPlaceShareReview(undefined);
    setInitialMemoryPersonIds(options.personIds || []);
    setInitialMemoryPlaceIds(options.placeIds || []);
    setInitialMemoryDate(options.date);
    setEditingItemId(options.itemId);
    setSheetMode(mode);
    setSheetType(type);
  }

  async function openPlaceShareFromClipboard() {
    setInitialPlaceDraft(undefined);
    setInitialPlaceShareReview(undefined);
    setInitialMemoryPersonIds([]);
    setInitialMemoryPlaceIds([]);
    setInitialMemoryDate(undefined);
    setSheetMode("full");

    if (!navigator.clipboard?.readText) {
      setSheetType("place");
      notify({ message: "当前环境无法读取剪贴板，可以手动粘贴分享内容", tone: "info" });
      return;
    }

    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) {
        setSheetType("place");
        notify({ message: "剪贴板为空，可以手动粘贴地点分享", tone: "info" });
        return;
      }

      const parsed = parsePlaceShare(text);
      if (!parsed.name && !parsed.address && !parsed.mapUrl && !parsed.sourceUrl && !parsed.platformLinks) {
        setSheetType("place");
        notify({ message: "剪贴板里没有识别到明确地点，可在表单里手动粘贴", tone: "info" });
        return;
      }

      setInitialPlaceShareReview(parsed);
      setPlaceDraftKey((current) => current + 1);
      setSheetType("place");
      notify({ message: parsed.name ? `已识别地点：${parsed.name}` : "已读取剪贴板地点分享", tone: "success" });
    } catch {
      setSheetType("place");
      notify({ message: "无法读取剪贴板，可以手动粘贴地点分享", tone: "info" });
    }
  }

  const floatingActions = buildFloatingActions({
    pathname: location.pathname,
    defaultMemoryMode: prefs.defaultMemoryMode,
    onQuickMemory: () => openSheet("memory", prefs.defaultMemoryMode),
    onPhotoMemory: () => openSheet("memory", "full"),
    onPerson: () => openSheet("person"),
    onPlace: () => openSheet("place"),
    onPastePlaceShare: () => void openPlaceShareFromClipboard(),
    onMemoryForPerson: (personId) => openSheet("memory", prefs.defaultMemoryMode, { personIds: [personId] }),
    onEditPerson: (personId) => openSheet("person", "full", { itemId: personId }),
    onMemoryForPlace: (placeId) => openSheet("memory", prefs.defaultMemoryMode, { placeIds: [placeId] }),
    onMemoryForDate: (date) => openSheet("memory", prefs.defaultMemoryMode, { date })
  });
  return (
    <div className={`app-container theme-${settings.themeStyle} ${settings.privacyMode ? "privacy-mode" : ""} ${settings.hidePhotoThumbnails ? "hide-photo-thumbnails" : ""}`}>
      <NetworkBanner />
      <Header
        dateLabel={location.pathname === "/" ? todayLabel() : ""}
        title={meta.title}
        subtitle={meta.subtitle}
        onSearch={() => setSearchOpen(true)}
      />
      <main className="main-content">
        {isLoading ? (
          <div className="app-loading" role="status" aria-live="polite">
            <div className="app-loading-spinner" />
            <p>正在加载本地数据…</p>
          </div>
        ) : (
          children
        )}
      </main>
      {!isUtilityPage(location.pathname) && (
        <FloatingActionButton actions={floatingActions} />
      )}
      <BackToTopButton />
      <BottomNav />
      <EntrySheet
        key={`entry-sheet-${sheetType || "closed"}-${sheetMode}-${placeDraftKey}`}
        type={sheetType}
        itemId={editingItemId}
        initialPlaceDraft={sheetType === "place" ? initialPlaceDraft : undefined}
        initialPlaceShareReview={sheetType === "place" ? initialPlaceShareReview : undefined}
        initialPersonIds={sheetType === "memory" ? initialMemoryPersonIds : []}
        initialPlaceIds={sheetType === "memory" ? initialMemoryPlaceIds : []}
        initialDate={sheetType === "memory" ? initialMemoryDate : undefined}
        memoryMode={sheetType === "memory" ? sheetMode : entryTypeForPath(location.pathname) === "memory" ? "quick" : "full"}
        onClose={() => {
          setSheetType(null);
          setInitialMemoryPersonIds([]);
          setInitialMemoryPlaceIds([]);
          setInitialMemoryDate(undefined);
          setEditingItemId(undefined);
          setInitialPlaceDraft(undefined);
          setInitialPlaceShareReview(undefined);
          setSheetMode("full");
        }}
      />
      <GlobalSearchPanel open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ShortcutHelpPanel open={shortcutHelpOpen} onClose={() => setShortcutHelpOpen(false)} />
    </div>
  );
}

function buildFloatingActions({
  pathname,
  defaultMemoryMode,
  onQuickMemory,
  onPhotoMemory,
  onPerson,
  onPlace,
  onPastePlaceShare,
  onMemoryForPerson,
  onEditPerson,
  onMemoryForPlace,
  onMemoryForDate
}: {
  pathname: string;
  defaultMemoryMode: SheetMode;
  onQuickMemory: () => void;
  onPhotoMemory: () => void;
  onPerson: () => void;
  onPlace: () => void;
  onPastePlaceShare: () => void;
  onMemoryForPerson: (personId: string) => void;
  onEditPerson: (personId: string) => void;
  onMemoryForPlace: (placeId: string) => void;
  onMemoryForDate: (date: string) => void;
}): FloatingAction[] {
  const personId = matchRouteId(pathname, /^\/people\/([^/]+)$/);
  if (personId) {
    return [
      {
        id: "memory-for-person",
        label: "记和 TA 的事",
        desc: "自动带上这个人",
        icon: <CalendarPlus />,
        primary: true,
        onClick: () => onMemoryForPerson(personId)
      },
      {
        id: "edit-person",
        label: "补 TA 的细节",
        desc: "生日、喜好、雷区和重要日子",
        icon: <UserPlus />,
        onClick: () => onEditPerson(personId)
      }
    ];
  }

  const placeId = matchRouteId(pathname, /^\/places\/([^/]+)$/);
  if (placeId) {
    return [
      {
        id: "memory-for-place",
        label: "记这里发生的事",
        desc: "自动带上这个地方",
        icon: <CalendarPlus />,
        primary: true,
        onClick: () => onMemoryForPlace(placeId)
      },
      {
        id: "new-place",
        label: "记一个新地方",
        desc: "保存另一个想记住的地方",
        icon: <MapPinPlus />,
        onClick: onPlace
      },
      placeShareAction(onPastePlaceShare)
    ];
  }

  if (pathname.startsWith("/people")) {
    return [
      {
        id: "new-person",
        label: "记一个人",
        desc: "先记名字和关系",
        icon: <UserPlus />,
        primary: true,
        onClick: onPerson
      },
      {
        id: "memory",
        label: "记和 TA 的事",
        desc: "从一句话开始",
        icon: <PenLine />,
        onClick: onQuickMemory
      }
    ];
  }

  if (pathname.startsWith("/places")) {
    return [
      {
        id: "new-place",
        label: "记一个地方",
        desc: "餐厅、店铺、景点都可以",
        icon: <MapPinPlus />,
        primary: true,
        onClick: onPlace
      },
      placeShareAction(onPastePlaceShare),
      {
        id: "memory-for-place-list",
        label: "记一次到访",
        desc: "先写一句发生了什么",
        icon: <PenLine />,
        onClick: onQuickMemory
      }
    ];
  }

  if (pathname.startsWith("/memories")) {
    return [
      quickMemoryAction(onQuickMemory, true, defaultMemoryMode),
      {
        id: "photo-memory",
        label: "带照片记录",
        desc: "打开完整表单和照片上传",
        icon: <Camera />,
        onClick: onPhotoMemory
      }
    ];
  }

  if (pathname.startsWith("/calendar")) {
    const selectedDate = new URLSearchParams(window.location.search).get("date") || new Date().toISOString().slice(0, 10);
    const actionCopy = getCalendarFabActionCopy(selectedDate);
    return [
      {
        id: "memory-for-date",
        label: actionCopy.label,
        desc: selectedDate,
        icon: <CalendarPlus />,
        primary: true,
        onClick: () => onMemoryForDate(selectedDate)
      },
      {
        id: "new-person",
        label: "记一个人",
        desc: "让生日和重要日子进入日历",
        icon: <UserPlus />,
        onClick: onPerson
      }
    ];
  }

  return [
    quickMemoryAction(onQuickMemory, true, defaultMemoryMode),
    {
      id: "photo-memory",
      label: "带照片记录",
      desc: "打开完整表单和照片上传",
      icon: <Camera />,
      onClick: onPhotoMemory
    },
    placeShareAction(onPastePlaceShare)
  ];
}

function quickMemoryAction(onClick: () => void, primary = false, mode: SheetMode = "quick"): FloatingAction {
  return {
    id: "quick-memory",
    label: mode === "full" ? "完整记录" : "记一件事",
    desc: mode === "full" ? "直接打开完整表单" : "先写一句今天发生了什么",
    icon: <PenLine />,
    primary,
    onClick
  };
}

function getCalendarFabActionCopy(dateKey: string) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const delta = diffDateKeys(dateKey, todayKey);
  if (delta > 0) return { label: "安排这一天" };
  if (delta === 0) return { label: "记录今天" };
  return { label: "补记这一天" };
}

function diffDateKeys(targetDateKey: string, baseDateKey: string) {
  return Math.round((dateKeyToUtcTime(targetDateKey) - dateKeyToUtcTime(baseDateKey)) / 86400000);
}

function dateKeyToUtcTime(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return 0;
  return Date.UTC(year, month - 1, day);
}

function placeShareAction(onClick: () => void): FloatingAction {
  return {
    id: "paste-place-share",
    label: "识别地点分享",
    desc: "从美团、高德、点评里带入地点",
    icon: <ClipboardPaste />,
    onClick
  };
}

function matchRouteId(pathname: string, pattern: RegExp) {
  const match = pathname.match(pattern);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}
