import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

export default function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".main-content");
    if (!root) return;
    const scrollRoot = root;

    function handleScroll() {
      setVisible(scrollRoot.scrollTop > 360);
    }

    handleScroll();
    scrollRoot.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollRoot.removeEventListener("scroll", handleScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      className="back-to-top-fab"
      aria-label="回到顶部"
      onClick={() => {
        document.querySelector<HTMLElement>(".main-content")?.scrollTo({ top: 0, left: 0, behavior: "smooth" });
      }}
    >
      <ArrowUp size={18} />
    </button>
  );
}
