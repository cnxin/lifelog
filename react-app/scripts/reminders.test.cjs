const test = require('node:test');
const assert = require('node:assert/strict');
const {loadTs} = require('./load-ts.cjs');
const {validateDay, nextOccurrence, parseBackup, makeBackup} = loadTs('src/domain.ts');
const {planReminders, reminderId, normalizeReminderTime} = loadTs('src/reminders.ts');
const day = (patch={}) => validateDay({id:'one', title:'订婚', date:'2026-10-10',
  category:'纪念日', repeat:'none', calendar:'solar', note:'', pinned:false,
  reminders:[0,1,3,7], ...patch});
const now = new Date(2026,8,30,8,0);
test('past non-repeating dates and empty reminders do not schedule', () => {
  assert.deepEqual(planReminders([day({date:'2026-09-29'}), day({reminders:[]})], now, '09:00'), []);
});
test('future reminders use local date arithmetic and the selected time', () => {
  const planned = planReminders([day()],now,'09:00');
  assert.deepEqual(planned.map(x=>x.at), ['2026-10-03T09:00','2026-10-07T09:00','2026-10-09T09:00','2026-10-10T09:00']);
  assert.equal(planned[0].body,'「订婚」还有 7 天 · 2026.10.10');
  assert.equal(planned[3].body,'「订婚」就是今天');
  assert.ok(planned.every(x=>x.dayId==='one'&&x.title==='订婚'));
});
test('solar annual repeat only plans the next occurrence', () => {
  const d=day({date:'2020-01-01',repeat:'yearly'});
  assert.deepEqual(planReminders([d],now,'20:00').map(x=>x.at),
    ['2026-12-25T20:00','2026-12-29T20:00','2026-12-31T20:00','2027-01-01T20:00']);
});
test('lunar annual repeat uses nextOccurrence, not the source Gregorian date', () => {
  const d=day({date:'2024-02-10',repeat:'yearly',calendar:'lunar',reminders:[0]});
  assert.equal(planReminders([d],now,'12:00')[0].at, nextOccurrence(d,'2026-09-30')+'T12:00');
});
test('elapsed time today is skipped while other future reminders survive', () => {
  const d=day({date:'2026-09-30',reminders:[0]});
  assert.equal(planReminders([d],new Date(2026,8,30,8,59),'09:00').length,1);
  assert.deepEqual(planReminders([d],new Date(2026,8,30,9,1),'09:00'),[]);
  assert.equal(planReminders([d,day()],new Date(2026,8,30,9,1),'09:00').length,4);
});
test('plans are sorted and capped at the earliest 64 alarms', () => {
  const days=Array.from({length:30},(_,i)=>day({id:'day-'+i,date:'2026-11-'+String(i+1).padStart(2,'0')})).reverse();
  const plans=planReminders(days,now,'09:00');assert.equal(plans.length,64);
  assert.deepEqual(plans.map(x=>x.at), plans.map(x=>x.at).sort());
  assert.equal(plans[0].at,'2026-10-25T09:00');
  assert.deepEqual(plans,planReminders(days,now,'09:00'));
});
test('stable IDs are int32 and distinguish the four offsets', () => {
  for(const id of ['hello','纪念日', 'legacy:p:birthday', 'x'.repeat(500)]) {
    const ids=[0,1,3,7].map(offset=>reminderId(id,offset));assert.equal(new Set(ids).size,4);
    ids.forEach((n,i)=>{assert.equal(n,reminderId(id,[0,1,3,7][i]));assert.ok(Number.isInteger(n)&&n>=0&&n<=2147483647)});
  }
  assert.equal(reminderId('hello',0), ((0x4f9f2cab&0x0fffffff)<<3)>>>0);
  assert.throws(()=>reminderId('id',2));
});
test('old records/backup defaults, canonical offsets and invalid values', () => {
  const old={...day()};delete old.reminders;
  assert.deepEqual(validateDay(old).reminders,[]);
  assert.deepEqual(day({reminders:[7,1,0,1,3]}).reminders,[0,1,3,7]);
  for(const reminders of [null,{},'0',[2],[-1],[1.5],['1'],[NaN]]) assert.throws(()=>day({reminders}));
  assert.deepEqual(parseBackup({format:'lifelog-days',version:1,days:[old]}).days[0].reminders,[]);
  assert.equal(makeBackup([day()]).version,1);
  assert.deepEqual(parseBackup(makeBackup([day()])).days,[day()]);
});
test('global time accepts only four slots and defaults to 09:00', () => {
  for(const time of ['08:00','09:00','12:00','20:00']) assert.equal(normalizeReminderTime(time),time);
  for(const time of [null,'oops','9:00','02:00']) assert.equal(normalizeReminderTime(time),'09:00');
  assert.equal(planReminders([day()],now,'invalid')[0].at,'2026-10-03T09:00');
});
