import { Plus } from "lucide-react";

export default function FloatingActionButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="fab-container">
      <button className="fab" aria-label="新增" onClick={onClick}>
        <Plus />
      </button>
    </div>
  );
}
