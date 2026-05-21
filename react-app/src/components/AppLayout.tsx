import { useLocation } from "react-router-dom";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { EntryType, Place } from "../types";
import { todayLabel } from "../utils/date";
import BottomNav from "./BottomNav";
import EntrySheet from "./EntrySheet";
import FloatingActionButton from "./FloatingActionButton";
import Header from "./Header";
import NetworkBanner from "./NetworkBanner";
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

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [sheetType, setSheetType] = useState<EntryType | null>(null);
  const [initialPlaceDraft, setInitialPlaceDraft] = useState<Partial<Place> | undefined>();
  const [initialPlaceShareReview, setInitialPlaceShareReview] = useState<PlaceDraft | undefined>();
  const [placeDraftKey, setPlaceDraftKey] = useState(0);
  const seenShareTextsRef = useRef(new Set<string>());
  const meta = getPageMeta(location.pathname);
  const { isLoading, settings } = useLifeLog();
  const notify = useToast();

  useLayoutEffect(() => {
    document.querySelector<HTMLElement>(".main-content")?.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location.pathname]);
  useAndroidBackButton(() => {
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

  return (
    <div className={`app-container theme-${settings.themeStyle}`}>
      <NetworkBanner />
      <Header dateLabel={location.pathname === "/" ? todayLabel() : ""} title={meta.title} subtitle={meta.subtitle} />
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
        <FloatingActionButton
          onClick={() => {
            setInitialPlaceDraft(undefined);
            setInitialPlaceShareReview(undefined);
            setSheetType(entryTypeForPath(location.pathname));
          }}
        />
      )}
      <BottomNav />
      <EntrySheet
        key={`entry-sheet-${sheetType || "closed"}-${placeDraftKey}`}
        type={sheetType}
        initialPlaceDraft={sheetType === "place" ? initialPlaceDraft : undefined}
        initialPlaceShareReview={sheetType === "place" ? initialPlaceShareReview : undefined}
        onClose={() => {
          setSheetType(null);
          setInitialPlaceDraft(undefined);
          setInitialPlaceShareReview(undefined);
        }}
      />
    </div>
  );
}
