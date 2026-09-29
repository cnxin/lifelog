import { Pencil, Trash2 } from "lucide-react";

interface CardActionsProps {
  onEdit: () => void;
  onDelete: () => void;
}

export default function CardActions({ onEdit, onDelete }: CardActionsProps) {
  return (
    <div className="card-actions">
      <button className="icon-action" aria-label="编辑" onClick={onEdit}>
        <Pencil />
      </button>
      <button className="icon-action danger" aria-label="删除" onClick={onDelete}>
        <Trash2 />
      </button>
    </div>
  );
}
