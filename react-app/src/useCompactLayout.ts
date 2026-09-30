import { useEffect, useState } from "react";
import { flushSync } from "react-dom";

export default function useCompactLayout() {
  const [compact, setCompact] = useState(
    () => matchMedia("(max-width: 760px)").matches,
  );
  useEffect(() => {
    const media = matchMedia("(max-width: 760px)");
    const update = () => flushSync(() => setCompact(media.matches));
    setCompact(media.matches);
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);
  return compact;
}
