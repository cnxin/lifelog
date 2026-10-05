import { useCallback, useEffect, useRef, useState } from "react";
import type { Day } from "../domain";
import { hasNativeNotifications } from "../notifications";
import { buildWidgetPayload } from "../widget";
import { WidgetBridge } from "../widgetBridge";
export default function useWidgetSync(
  days: Day[],
  loaded: boolean,
  setDetailId: (id: string) => void,
) {
  const daysRef = useRef(days);
  daysRef.current = days;
  const [widgetLaunchTick, setWidgetLaunchTick] = useState(0);
  useEffect(() => {
    if (!loaded || !hasNativeNotifications()) return;
    let disposed = false;
    void WidgetBridge.consumeLaunchDayId()
      .then(({ dayId }) => {
        if (
          !disposed &&
          dayId &&
          daysRef.current.some((day) => day.id === dayId)
        )
          setDetailId(dayId);
      })
      .catch(() => {});
    return () => {
      disposed = true;
    };
  }, [loaded, widgetLaunchTick]);

  // Prepare first, then invoke alongside reminder resync: keep the original shared debounce/order.
  const prepareWidgetUpdate = useCallback((records: Day[], today: string) => {
    const payload = buildWidgetPayload(records, today);
    return () =>
      payload
        ? WidgetBridge.update({ json: JSON.stringify(payload) })
        : Promise.resolve();
  }, []);
  return { prepareWidgetUpdate, setWidgetLaunchTick };
}
