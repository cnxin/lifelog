import { icons } from "../dayMeta";
import type { Category } from "../domain";

export default function Icon({
  category,
  size = 22,
}: {
  category: Category;
  size?: number;
}) {
  const Component = icons[category];
  return <Component size={size} strokeWidth={1.7} aria-hidden="true" />;
}
