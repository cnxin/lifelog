import { SmilePlus } from "lucide-react";
import Tags from "./Tags";

export default function MemoryTags({ mood, tags = [] }: { mood?: string; tags?: string[] }) {
  const cleanMood = mood?.trim();
  const cleanTags = tags.map((tag) => tag.trim()).filter(Boolean);

  if (!cleanMood && !cleanTags.length) return null;

  return (
    <div className="memory-tag-set">
      {cleanMood && (
        <span className="memory-mood-pill">
          <SmilePlus size={12} />
          {cleanMood}
        </span>
      )}
      {cleanTags.length > 0 && <Tags items={cleanTags} />}
    </div>
  );
}
