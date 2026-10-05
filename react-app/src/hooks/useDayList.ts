import { useMemo } from "react";
import { compareDays, dayStatus, type Category, type Day } from "../domain";
export default function useDayList(
  days: Day[],
  today: string,
  filter: "全部" | Category,
  query: string,
  sort: string,
) {
  const ordered = useMemo(
    () => [...days].sort((a, b) => compareDays(a, b, today)),
    [days, today],
  );
  const visible = useMemo(
    () =>
      ordered
        .filter(
          (day) =>
            (filter === "全部" || day.category === filter) &&
            `${day.title} ${day.note}`
              .toLocaleLowerCase()
              .includes(query.trim().toLocaleLowerCase()),
        )
        .sort((a, b) => (sort === "date" ? b.date.localeCompare(a.date) : 0)),
    [ordered, filter, query, sort],
  );
  const upcoming = days.filter((day) => {
    const delta = dayStatus(day, today).delta;
    return delta >= 0 && delta <= 30;
  }).length;
  const featured = ordered[0];
  const status = featured ? dayStatus(featured, today) : null;

  return { visible, upcoming, featured, status };
}
