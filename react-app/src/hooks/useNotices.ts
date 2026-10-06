import { useEffect, useRef, useState } from "react";
export type NoticeAction = { label: string; run: () => Promise<void> };
export type Notice = { message: string; action?: NoticeAction };
export default function useNotices() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [noticeVisible, setNoticeVisible] = useState(false);
  const afterEditorNotice = useRef<Notice | null>(null);
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
    }, notice.action ? 5000 : 4000);
    return () => {
      clearTimeout(timer);
      clearTimeout(clear);
    };
  }, [notice]);

  function onChanged(message: string, afterClose: boolean, action?: NoticeAction) {
    if (afterClose) afterEditorNotice.current = { message, action };
    else setNotice({ message, action });
  }
  function editorClosed() {
    if (afterEditorNotice.current) {
      setNotice(afterEditorNotice.current);
      afterEditorNotice.current = null;
    }
  }
  return { notice, noticeVisible, onChanged, editorClosed };
}
