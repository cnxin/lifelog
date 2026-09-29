import { Command, X } from "lucide-react";

interface ShortcutHelpPanelProps {
  open: boolean;
  onClose: () => void;
}

const shortcuts = [
  { keys: "Ctrl / Cmd + K", label: "全局搜索" },
  { keys: "Ctrl / Cmd + N", label: "按默认方式记录" },
  { keys: "Ctrl / Cmd + Shift + N", label: "完整记录" },
  { keys: "Ctrl / Cmd + 1", label: "首页" },
  { keys: "Ctrl / Cmd + 2", label: "档案" },
  { keys: "Ctrl / Cmd + 3", label: "记录" },
  { keys: "Ctrl / Cmd + 4", label: "地点" },
  { keys: "Ctrl / Cmd + 5", label: "日历" },
  { keys: "Esc", label: "关闭弹窗或面板" }
];

export default function ShortcutHelpPanel({ open, onClose }: ShortcutHelpPanelProps) {
  if (!open) return null;

  return (
    <div className="shortcut-help-layer" role="dialog" aria-modal="true" aria-label="快捷键帮助">
      <button className="shortcut-help-backdrop" type="button" aria-label="关闭快捷键帮助" onClick={onClose} />
      <section className="shortcut-help-panel">
        <div className="shortcut-help-head">
          <span>
            <Command />
            <strong>快捷键</strong>
          </span>
          <button type="button" aria-label="关闭快捷键帮助" onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="shortcut-help-list">
          {shortcuts.map((shortcut) => (
            <div className="shortcut-help-row" key={shortcut.keys}>
              <kbd>{shortcut.keys}</kbd>
              <span>{shortcut.label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
