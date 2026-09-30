// Measure the actual pseudo-element box and intersect it with clipping
// ancestors. A theoretical visual-box + 8px is not enough to prove a hit area.
exports.hitTarget = async (locator) => locator.evaluate(el => {
  const r = el.getBoundingClientRect(), css = getComputedStyle(el);
  const area = {left: r.left, top: r.top, right: r.right, bottom: r.bottom};
  const before = getComputedStyle(el, '::before');
  if (before.content !== 'none' && before.content !== 'normal' && before.position === 'absolute') {
    const left = r.left + parseFloat(css.borderLeftWidth) + parseFloat(before.left);
    const top = r.top + parseFloat(css.borderTopWidth) + parseFloat(before.top);
    area.left = Math.min(area.left, left);
    area.top = Math.min(area.top, top);
    area.right = Math.max(area.right, left + parseFloat(before.width));
    area.bottom = Math.max(area.bottom, top + parseFloat(before.height));
  }
  for (let parent = el.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent), box = parent.getBoundingClientRect();
    if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
      area.left = Math.max(area.left, box.left + parent.clientLeft);
      area.right = Math.min(area.right, box.left + parent.clientLeft + parent.clientWidth);
    }
    if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
      area.top = Math.max(area.top, box.top + parent.clientTop);
      area.bottom = Math.min(area.bottom, box.top + parent.clientTop + parent.clientHeight);
    }
  }
  area.left = Math.max(0, area.left);
  area.top = Math.max(0, area.top);
  area.right = Math.min(innerWidth, area.right);
  area.bottom = Math.min(innerHeight, area.bottom);
  const x = (area.left + area.right) / 2, y = (area.top + area.bottom) / 2;
  const points = [[area.left + .5, y], [area.right - .5, y], [x, area.top + .5], [x, area.bottom - .5]];
  return {
    ...area, width: area.right - area.left, height: area.bottom - area.top,
    painted: points.every(([px, py]) => {
      const hit = document.elementFromPoint(px, py);
      return hit === el || el.contains(hit);
    }),
  };
});
