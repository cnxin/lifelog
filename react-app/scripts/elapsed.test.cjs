const test = require('node:test'), assert = require('node:assert/strict');
const { loadTs } = require('./load-ts.cjs');
const { dayStatus } = loadTs('src/domain.ts');
const { elapsedLabel } = loadTs('src/dayMeta.ts');
const { buildWidgetPayload } = loadTs('src/widget.ts');
const day = patch => ({ id: 'elapsed', title: '日子', date: '2026-06-01', category: '纪念日',
  repeat: 'yearly', calendar: 'solar', note: '', pinned: false, reminders: [], ...patch });
test('elapsed labels share dayStatus elapsed for the three categories', () => {
  for (const [category, expected] of [['生日', '已陪伴 3 天'], ['纪念日', '一起走过 3 天'], ['倒数日', '已过去 3 天']]) {
    const d = day({ category }); assert.equal(elapsedLabel(d, dayStatus(d, '2026-06-04')), expected);
  }
});
test('nonrepeating and future original dates have no elapsed label; origin day is zero', () => {
  const nonrepeat = day({ repeat: 'none' });
  assert.equal(elapsedLabel(nonrepeat, dayStatus(nonrepeat, '2026-06-04')), null);
  const future = day({ date: '2027-06-01' });
  assert.equal(elapsedLabel(future, dayStatus(future, '2026-06-04')), null);
  const d = day({}); assert.equal(elapsedLabel(d, dayStatus(d, d.date)), '一起走过 0 天');
});
test('widget exposes elapsedLabel only for strictly past yearly dates; layout is unchanged', () => {
  const d = day({});
  assert.equal(buildWidgetPayload([d], '2026-06-04').featured.elapsedLabel, '一起走过 3 天');
  assert.equal(buildWidgetPayload([d], d.date).featured.elapsedLabel, null);
  assert.equal(buildWidgetPayload([day({ repeat: 'none' })], '2026-06-04').featured.elapsedLabel, null);
  assert.equal(buildWidgetPayload([day({ date: '2027-06-01' })], '2026-06-04').featured.elapsedLabel, null);
});
