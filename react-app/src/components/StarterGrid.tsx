import { Plus } from "lucide-react";
import { categories, type Category } from "../domain";
import { tones } from "../dayMeta";
import Icon from "./CategoryIcon";
export default function StarterGrid({
  add,
}: {
  add: (category: Category) => void;
}) {
  return (
    <div className="starter-grid">
      {categories.map((category) => (
        <button
          className={`starter-card ${tones[category]}`}
          key={category}
          onClick={() => add(category)}
        >
          <span className="category-icon">
            <Icon category={category} />
          </span>
          <strong>
            {category === "纪念日"
              ? "纪念一次相遇"
              : category === "生日"
                ? "记住一个生日"
                : "期待一件好事"}
          </strong>
          <span>
            {category === "纪念日"
              ? "那些一起走过的日子"
              : category === "生日"
                ? "重要的人，不会忘记"
                : "让等待也变得美好"}
          </span>
          <Plus size={18} />
        </button>
      ))}
    </div>
  );
}
