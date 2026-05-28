import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";

// 懒加载所有页面 - 按访问频率分组
// 高频页面（首页、列表）
const Home = lazy(() => import("./pages/Home/Home"));
const People = lazy(() => import("./pages/People/People"));
const Places = lazy(() => import("./pages/Places/Places"));
const Memories = lazy(() => import("./pages/Memories/Memories"));
const Calendar = lazy(() => import("./pages/Calendar/Calendar"));

// 详情页（次频）
const PersonDetail = lazy(() => import("./pages/People/PersonDetail"));
const PlaceDetail = lazy(() => import("./pages/Places/PlaceDetail"));
const MallDetail = lazy(() => import("./pages/Places/MallDetail"));
const MemoryDetail = lazy(() => import("./pages/Memories/MemoryDetail"));

// 设置/账号页（低频）
const Settings = lazy(() => import("./pages/Settings/Settings"));
const Account = lazy(() => import("./pages/Account/Account"));
const ShareImport = lazy(() => import("./pages/ShareImport/ShareImport"));

function PageLoading() {
  return (
    <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-sub)" }}>
      加载中...
    </div>
  );
}

export default function App() {
  return (
    <AppLayout>
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/people" element={<People />} />
          <Route path="/people/:personId" element={<PersonDetail />} />
          <Route path="/places" element={<Places />} />
          <Route path="/places/malls/:mallKey" element={<MallDetail />} />
          <Route path="/places/:placeId" element={<PlaceDetail />} />
          <Route path="/memories" element={<Memories />} />
          <Route path="/memories/:memoryId" element={<MemoryDetail />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/account" element={<Account />} />
          <Route path="/share/import" element={<ShareImport />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppLayout>
  );
}
