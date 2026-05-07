import { useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import type { EntryType } from "../types";
import { todayLabel } from "../utils/date";
import BottomNav from "./BottomNav";
import EntrySheet from "./EntrySheet";
import FloatingActionButton from "./FloatingActionButton";
import Header from "./Header";
import { useState } from "react";
import { useAndroidBackButton } from "../hooks/useAndroidBackButton";
import { useLifeLog } from "../context/LifeLogContext";

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "下午好", subtitle: "今天有新的回忆值得记录" },
  "/people": { title: "人物", subtitle: "记录喜好、禁忌和纪念日" },
  "/places": { title: "地点", subtitle: "餐厅、酒店、景点和电影院" },
  "/memories": { title: "回忆", subtitle: "把人物和地点串起来" },
  "/calendar": { title: "日历", subtitle: "生日、纪念日和回忆时间线" },
  "/settings": { title: "设置", subtitle: "本地数据和后续能力" }
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

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [sheetType, setSheetType] = useState<EntryType | null>(null);
  const meta = getPageMeta(location.pathname);
  const { isLoading } = useLifeLog();
  useAndroidBackButton(() => {
    if (!sheetType) return false;
    setSheetType(null);
    return true;
  });

  return (
    <div className="app-container">
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
      {location.pathname !== "/settings" && (
        <FloatingActionButton onClick={() => setSheetType(entryTypeForPath(location.pathname))} />
      )}
      <BottomNav />
      <EntrySheet type={sheetType} onClose={() => setSheetType(null)} />
    </div>
  );
}
