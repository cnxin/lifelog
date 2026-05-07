import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import Home from "./pages/Home/Home";
import People from "./pages/People/People";
import PersonDetail from "./pages/People/PersonDetail";
import Places from "./pages/Places/Places";
import PlaceDetail from "./pages/Places/PlaceDetail";
import MallDetail from "./pages/Places/MallDetail";
import Memories from "./pages/Memories/Memories";
import MemoryDetail from "./pages/Memories/MemoryDetail";
import Calendar from "./pages/Calendar/Calendar";
import Settings from "./pages/Settings/Settings";

export default function App() {
  return (
    <AppLayout>
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}
