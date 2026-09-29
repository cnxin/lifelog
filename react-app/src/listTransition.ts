import { flushSync } from "react-dom";

type Transition = {
  ready: Promise<void>;
  updateCallbackDone: Promise<void>;
  finished: Promise<void>;
  skipTransition: () => void;
};
let active: Transition | undefined;

// Optional browser enhancement: the data update must never depend on animation support.
export async function commitWithTransition(update: () => void) {
  const doc = document as Document & {
    startViewTransition?: (callback: () => void) => Transition;
  };
  active?.skipTransition();
  if (
    matchMedia("(prefers-reduced-motion: reduce)").matches ||
    typeof doc.startViewTransition !== "function"
  ) {
    update();
    return;
  }
  let updated = false;
  const commit = () => {
    if (updated) return;
    updated = true;
    flushSync(update);
  };
  try {
    const transition = doc.startViewTransition(commit);
    active = transition;
    // Hidden documents and superseded snapshots can reject ready, not the data write.
    void transition.ready.catch(() => {});
    void transition.finished
      .catch(() => {})
      .then(() => {
        if (active === transition) active = undefined;
      });
    await transition.updateCallbackDone;
  } catch {
    if (!updated) commit();
  }
}

// Unlike punctuation replacement, this cannot collide for imported non-UUID IDs.
export function dayTransitionName(id: string) {
  return `day-${Array.from(id, (char) => char.codePointAt(0)!.toString(16)).join("_")}`;
}
