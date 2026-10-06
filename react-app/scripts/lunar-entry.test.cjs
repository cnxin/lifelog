// All reference dates, month lengths and labels are generated/checked with
// lunar-javascript, the same authoritative conversion library as the UI.
// No handwritten lunar date table or Gregorian approximation is used.
const test=require('node:test'), assert=require('node:assert/strict');
const {Lunar,LunarMonth,LunarYear,Solar}=require('lunar-javascript');
const {loadTs}=require('./load-ts.cjs');
const {lunarMonths,lunarDays,lunarCursor}=loadTs('src/lunarEntry.ts');
test('2025 leap sixth month follows its regular month and converts using the library',()=>{
  const months=lunarMonths(2025), leap=LunarYear.fromYear(2025).getLeapMonth();
  assert.equal(leap,6);
  assert.equal(months.length,13);
  assert.deepEqual(months.slice(5,8).map(m=>m.month),[6,-6,7]);
  const days=lunarDays(2025,-leap);
  assert.equal(days.length,LunarMonth.fromYm(2025,-leap).getDayCount());
  for(const d of days) assert.equal(d.date,Lunar.fromYmd(2025,-leap,d.day).getSolar().toYmd());
});
test('small and large lunar months render exactly 29 and 30 library-backed days',()=>{
  const small=lunarMonths(2025).find(m=>LunarMonth.fromYm(2025,m.month).getDayCount()===29);
  const large=lunarMonths(2025).find(m=>LunarMonth.fromYm(2025,m.month).getDayCount()===30);
  assert.equal(lunarDays(2025,small.month).length,29);
  assert.equal(lunarDays(2025,large.month).length,30);
  assert.equal(lunarDays(2025,small.month).at(-1).label,Lunar.fromYmd(2025,small.month,29).getDayInChinese());
  assert.equal(lunarDays(2025,large.month).at(-1).label,Lunar.fromYmd(2025,large.month,30).getDayInChinese());
});
test('last lunar month crosses Gregorian year and solar cursor reverses it',()=>{
  const lunar=Lunar.fromYmd(2025,12,15), date=lunar.getSolar().toYmd();
  assert.ok(date.startsWith('2026-'));
  assert.equal(lunarDays(2025,12)[14].date,date);
  assert.deepEqual(lunarCursor(date),{year:2025,month:12,day:15});
});
test('1901 and 2099 disable all out-of-range months/days and clamp the lower cursor',()=>{
  assert.deepEqual(lunarMonths(1900),[]);
  assert.deepEqual(lunarMonths(2100),[]);
  assert.deepEqual(lunarDays(2025,-3),[]);
  assert.deepEqual(lunarCursor('1901-01-01'),{year:1901,month:1,day:1});
  for(const y of [1901,2099]) for(const m of lunarMonths(y)) {
    assert.equal(m.enabled,lunarDays(y,m.month).some(d=>d.enabled));
    for(const d of lunarDays(y,m.month)) {
      const reference=Lunar.fromYmd(y,m.month,d.day).getSolar().toYmd();
      assert.equal(d.enabled,reference>='1901-01-01' && reference<='2099-12-31');
      const roundtrip=Solar.fromYmd(...d.date.split('-').map(Number)).getLunar();
      assert.equal(roundtrip.getYear(),y);
      assert.equal(roundtrip.getMonth(),m.month);
      assert.equal(roundtrip.getDay(),d.day);
    }
  }
  assert.equal(lunarMonths(2099).find(m=>m.month===12).enabled,false);
  assert.ok(lunarDays(2099,11).some(d=>d.enabled) && lunarDays(2099,11).some(d=>!d.enabled));
});
