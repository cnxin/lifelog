const test = require('node:test'), assert = require('node:assert/strict');
const { loadTs } = require('./load-ts.cjs');
const { deletedAgo } = loadTs('src/trashMeta.ts');
test('recent trash uses local calendar-relative copy for minutes and yesterday', () => {
  const now = new Date(2026, 9, 5, 12, 0);
  assert.equal(deletedAgo(new Date(2026, 9, 5, 11, 57).toISOString(), now), '3 分钟前');
  assert.equal(deletedAgo(new Date(2026, 9, 4, 13, 0).toISOString(), now), '昨天');
  assert.equal(deletedAgo(now.toISOString(), now), '刚刚');
  assert.equal(deletedAgo('invalid', now), '刚刚');
});
