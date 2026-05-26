import { useLocation } from "react-router-dom";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { EntryType, Place } from "../types";
import { todayLabel } from "../utils/date";
import BottomNav from "./BottomNav";
import EntrySheet from "./EntrySheet";
import FloatingActionButton, { type FloatingAction } from "./FloatingActionButton";
import GlobalSearchPanel from "./GlobalSearchPanel";
import Header from "./Header";
import NetworkBanner from "./NetworkBanner";
import { Camera, CalendarPlus, ClipboardPaste, MapPinPlus, PenLine, UserPlus } from "lucide-react";
import { useAndroidBackButton } from "../hooks/useAndroidBackButton";
import { useStatusBar } from "../hooks/useStatusBar";
import { useLifeLog } from "../context/LifeLogContext";
import { useToast } from "../context/ToastContext";
import { useReminderScheduling } from "../hooks/useReminderScheduling";
import { parsePlaceShare, type PlaceDraft } from "../utils/placeShareParser";

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "下午好", subtitle: "今天有新的回忆值得记录" },
  "/people": { title: "人物", subtitle: "记录喜好、禁忌和纪念日" },
  "/places": { title: "地点", subtitle: "餐厅、酒店、景点和电影院" },
  "/memories": { title: "回忆", subtitle: "把人物和地点串起来" },
  "/calendar": { title: "日历", subtitle: "生日、纪念日和回忆时间线" },
  "/settings": { title: "设置", subtitle: "默认值、提醒和视觉风格" },
  "/account": { title: "账号管理", subtitle: "本地资料、备份和应用信息" }
};

function getPageMeta(pathname: string) {
  if (pageMeta[pathname]) return pageMeta[pathname];
  if (pathname.startsWith("/people/")) return { title: "人物详情", subtitle: "查看完整档案和相关回忆" };
  if (pathname.startsWith("/places/malls/")) return { title: "商场详情", subtitle: "查看商场里的店铺和关联回忆" };
  if (pathname.startsWith("/places/")) return { title: "地点详情", subtitle: "定位、链接、评价和回忆" };
  if (pathname.startsWith("/memories/")) return { title: "回忆详情", subtitle: "查看一次经历的完整记录" };
  return pageMeta["/"];
}

function entryTypeForPath(pathname: string): EntryType {
  if (pathname.startsWith("/people")) return "person";
  if (pathname.startsWith("/places")) return "place";
  return "memory";
}

function isUtilityPage(pathname: string) {
  return pathname === "/settings" || pathname === "/account";
}

type SheetMode = "quick" | "full";

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
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
  const seenShareTextsRef = useRef(new Set<string>());
  const meta = getPageMeta(location.pathname);
  const { isLoading, settings } = useLifeLog();
  const notify = useToast();

  useLayoutEffect(() => {
    document.querySelector<HTMLElement>(".main-content")?.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location.pathname]);
  useAndroidBackButton(() => {
    if (searchOpen) {
      setSearchOpen(false);
      return true;
    }
    if (!sheetType) return false;
    setSheetType(null);
    return true;
  });
  useEffect(() => {
    document.documentElement.dataset.themeStyle = settings.themeStyle;
    return () => {
      delete document.documentElement.dataset.themeStyle;
    };
  }, [settings.themeStyle]);
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
    onQuickMemory: () => openSheet("memory", "quick"),
    onPhotoMemory: () => openSheet("memory", "full"),
    onPerson: () => openSheet("person"),
    onPlace: () => openSheet("place"),
    onPastePlaceShare: () => void openPlaceShareFromClipboard(),
    onMemoryForPerson: (personId) => openSheet("memory", "quick", { personIds: [personId] }),
    onEditPerson: (personId) => openSheet("person", "full", { itemId: personId }),
    onMemoryForPlace: (placeId) => openSheet("memory", "quick", { placeIds: [placeId] }),
    onMemoryForDate: (date) => openSheet("memory", "quick", { date })
  });

  return (
    <div className={`app-container theme-${settings.themeStyle}`}>
      <NetworkBanner />
      <Header dateLabel={location.pathname === "/" ? todayLabel() : ""} title={meta.title} subtitle={meta.subtitle} onSearch={() => setSearchOpen(true)} />
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
    </div>
  );
}

function buildFloatingActions({
  pathname,
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
        label: "记录和 TA 的回忆",
        desc: "自动关联当前人物",
        icon: <CalendarPlus />,
        primary: true,
        onClick: () => onMemoryForPerson(personId)
      },
      {
        id: "edit-person",
        label: "编辑 TA 的资料",
        desc: "补充生日、喜好、雷区和纪念日",
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
        label: "记录在这里发生的事",
        desc: "自动关联当前地点",
        icon: <CalendarPlus />,
        primary: true,
        onClick: () => onMemoryForPlace(placeId)
      },
      {
        id: "new-place",
        label: "新增地点",
        desc: "保存另一个店铺或场所",
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
        label: "新增人物",
        desc: "先记姓名和关系",
        icon: <UserPlus />,
        primary: true,
        onClick: onPerson
      },
      {
        id: "memory",
        label: "记录一次互动",
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
        label: "新增地点",
        desc: "手动填写或粘贴分享",
        icon: <MapPinPlus />,
        primary: true,
        onClick: onPlace
      },
      placeShareAction(onPastePlaceShare),
      {
        id: "memory-for-place-list",
        label: "记录到访",
        desc: "先记一条回忆",
        icon: <PenLine />,
        onClick: onQuickMemory
      }
    ];
  }

  if (pathname.startsWith("/memories")) {
    return [
      quickMemoryAction(onQuickMemory, true),
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
    return [
      {
        id: "memory-for-date",
        label: "补记选中日期",
        desc: selectedDate,
        icon: <CalendarPlus />,
        primary: true,
        onClick: () => onMemoryForDate(selectedDate)
      },
      {
        id: "new-person",
        label: "新增人物",
        desc: "让生日和纪念日进入日历",
        icon: <UserPlus />,
        onClick: onPerson
      }
    ];
  }

  return [
    quickMemoryAction(onQuickMemory, true),
    {
      id: "photo-memory",
      label: "带照片记录",
      desc: "打开完整表单和照片上传",
      icon: <Camera />,
      onClick: onPhotoMemory
    },
    {
      id: "new-person",
      label: "新增人物",
      desc: "先记姓名和关系",
      icon: <UserPlus />,
      onClick: onPerson
    },
    {
      id: "new-place",
      label: "新增地点",
      desc: "手动填写或粘贴分享",
      icon: <MapPinPlus />,
      onClick: onPlace
    },
    placeShareAction(onPastePlaceShare)
  ];
}

function quickMemoryAction(onClick: () => void, primary = false): FloatingAction {
  return {
    id: "quick-memory",
    label: "快速记回忆",
    desc: "一句话先保存下来",
    icon: <PenLine />,
    primary,
    onClick
  };
}

function placeShareAction(onClick: () => void): FloatingAction {
  return {
    id: "paste-place-share",
    label: "粘贴地点分享",
    desc: "读取剪贴板并预填地点",
    icon: <ClipboardPaste />,
    onClick
  };
}

function matchRouteId(pathname: string, pattern: RegExp) {
  const match = pathname.match(pattern);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}
