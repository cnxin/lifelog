const test = require('node:test');
const assert = require('node:assert/strict');
require('fake-indexeddb/auto');
const Dexie = require('dexie');
const { loadTs } = require('./load-ts.cjs');
const { db, saveDay, deleteDay, restoreDay, purgeTrash, mergeDays } = loadTs('src/storage.ts');
const { makeBackup } = loadTs('src/domain.ts');
const day = (id, patch = {}) => ({ id, title: `日子 ${id}`, date: '2020-06-01',
  category: '纪念日', repeat: 'yearly', calendar: 'solar', note: '一起走过',
  pinned: true, reminders: [0, 1, 7], reminderTime: '10:37', ...patch });

test.beforeEach(async () => { await db.days.clear(); await purgeTrash(); });
test.after(async () => { db.close(); await Dexie.delete('LifeLogDays'); });

test('four deletions keep only the most recent three, in one database transaction', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-05T00:00:00Z') });
  for (let i = 1; i <= 4; i++) {
    await saveDay(day(String(i)));
    t.mock.timers.tick(60_000);
    await deleteDay(String(i));
  }
  assert.equal(await db.days.count(), 0);
  assert.deepEqual((await db.trash.orderBy('deletedAt').reverse().toArray()).map(d => d.id), ['4', '3', '2']);
  assert.equal(await deleteDay('absent'), null);
  assert.equal(await db.trash.count(), 3);
});

test('restore preserves every Day field, including reminders and per-record minute time', async () => {
  const original = day('roundtrip');
  await saveDay(original);
  await deleteDay(original.id);
  assert.equal(await restoreDay(original.id), 'restored');
  assert.deepEqual(await db.days.get(original.id), original);
  assert.equal(await db.trash.count(), 0);
  assert.equal(await restoreDay(original.id), 'missing');
});

test('restore collision returns exists without overwriting days or discarding trash', async () => {
  await saveDay(day('collision'));
  await deleteDay('collision');
  const current = day('collision', { title: '当前修改', reminders: [], reminderTime: '21:03' });
  await saveDay(current);
  assert.equal(await restoreDay('collision'), 'exists');
  assert.deepEqual(await db.days.get('collision'), current);
  assert.equal((await db.trash.get('collision')).title, '日子 collision');
});

test('purge clears trash only; imports and backup never include or write trash', async () => {
  await saveDay(day('deleted'));
  await deleteDay('deleted');
  await mergeDays([day('kept')]);
  const backup = makeBackup(await db.days.toArray());
  assert.deepEqual(backup.days.map(d => d.id), ['kept']);
  assert.equal(Object.hasOwn(backup, 'trash'), false);
  assert.equal(await db.trash.count(), 1);
  await purgeTrash();
  assert.equal(await db.trash.count(), 0);
  assert.equal(await db.days.count(), 1);
});

test('v1 upgrade adds empty trash and preserves the raw days store byte-for-byte', async () => {
  db.close();
  await Dexie.delete('LifeLogDays');
  const old = new Dexie('LifeLogDays');
  old.version(1).stores({ days: 'id, date, category' });
  const original = day('old', { reminders: [] });
  await old.table('days').put(original);
  old.close();
  await db.open();
  assert.equal(db.verno, 2);
  assert.deepEqual(await db.days.get('old'), original);
  assert.equal(await db.trash.count(), 0);
});
