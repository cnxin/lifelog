import { useEffect, useRef, useState } from "react";
export default function useNotices() {
  const [notice, setNotice] = useState<{ message: string } | null>(null);
  const [noticeVisible, setNoticeVisible] = useState(false);
  const afterEditorNotice = useRef<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    setNoticeVisible(true);
    let clear: ReturnType<typeof setTimeout>;
    const timer = setTimeout(() => {
      setNoticeVisible(false);
      clear = setTimeout(
        () => setNotice(null),
        matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 200,
      );
    }, 4000);
    return () => {
      clearTimeout(timer);
      clearTimeout(clear);
    };
  }, [notice]);

  function onChanged(message: string, afterClose: boolean) {
    if (afterClose) afterEditorNotice.current = message;
    else setNotice({ message });
  }
  function editorClosed() {
    if (afterEditorNotice.current) {
      setNotice({ message: afterEditorNotice.current });
      afterEditorNotice.current = null;
    }
  }
  return { notice, noticeVisible, onChanged, editorClosed };
}
