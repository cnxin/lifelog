const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadTs } = require('./load-ts.cjs');
const { buildCalendarIntentPayload } = loadTs('src/calendarIntent.ts');
const { validateDay, nextOccurrence, lunarLabel } = loadTs('src/domain.ts');
const day = patch => validateDay({id:'calendar',title:'特别的日子',date:'2020-05-20',category:'纪念日',
  repeat:'none',calendar:'solar',note:'一起走过的路',pinned:false,reminders:[0],reminderTime:'10:37',...patch});
const today='2026-10-06';
test('solar annual calendar intent uses next occurrence and only FREQ=YEARLY',()=>{
  const payload=buildCalendarIntentPayload(day({repeat:'yearly'}),today);
  assert.deepEqual(payload,{title:'特别的日子',description:'一起走过的路\n\n来自 LifeLog · 日子',startDate:'2027-05-20',allDay:true,rrule:'FREQ=YEARLY'});
  assert.equal(Object.hasOwn(payload,'reminderMinutes'),false);
});
test('lunar annual calendar intent adds only the next solar occurrence and explains yearly re-add',()=>{
  const source=day({repeat:'yearly',calendar:'lunar',date:'2024-02-10'}),payload=buildCalendarIntentPayload(source,today);
  assert.equal(payload.startDate,nextOccurrence(source,today));
  assert.equal(Object.hasOwn(payload,'rrule'),false);
  assert.equal(payload.description,`一起走过的路\n\n来自 LifeLog · 日子\n农历 ${lunarLabel(source.date).replace(/^农历/,'')} · 每年需重新加入`);
  assert.equal(payload.allDay,true);assert.equal(Object.hasOwn(payload,'reminderMinutes'),false);
});
test('non-repeating calendar intent keeps original date even in the past; empty note has source only',()=>{
  const payload=buildCalendarIntentPayload(day({note:''}),today);
  assert.deepEqual(payload,{title:'特别的日子',description:'来自 LifeLog · 日子',startDate:'2020-05-20',allDay:true});
  assert.equal(Object.hasOwn(payload,'reminderMinutes'),false);
});
test('CalendarBridge stays insert-only, native-only, with scoped package visibility and no calendar permissions',()=>{
  const read=p=>fs.readFileSync(p,'utf8');
  const manifest=read('android/app/src/main/AndroidManifest.xml');
  assert.doesNotMatch(manifest,/android\.permission\.(?:READ|WRITE)_CALENDAR/);
  assert.match(manifest,/<queries>[\s\S]*android\.intent\.action\.INSERT[\s\S]*vnd\.android\.cursor\.dir\/event[\s\S]*<\/queries>/);
  const helper=read('android/app/src/main/java/com/cnxin/lifelog/CalendarInsertIntent.java');
  const plugin=read('android/app/src/main/java/com/cnxin/lifelog/CalendarBridgePlugin.java');
  assert.match(helper,/Intent\.ACTION_INSERT/);assert.match(helper,/CalendarContract\.Events\.CONTENT_URI/);
  assert.match(helper,/resolveActivity\(context\.getPackageManager\(\)\) != null/);
  assert.doesNotMatch(helper+plugin,/getContentResolver\(|ContentResolver|requestPermissions\(/);
  assert.match(plugin,/reason", "no-calendar-app"/);assert.match(plugin,/getActivity\(\)\.startActivity\(intent\)/);
  assert.match(read('android/app/src/main/java/com/cnxin/lifelog/MainActivity.java'),/registerPlugin\(CalendarBridgePlugin.class\)/);
  for(const native of [false,true]) {
    const api=loadTs('src/calendarBridge.ts',{'@capacitor/core':{
      Capacitor:{isNativePlatform:()=>native,getPlatform:()=>native?'android':'web'},
      registerPlugin:name=>{assert.equal(name,'CalendarBridge');return {};},
    }});
    assert.equal(api.hasNativeCalendar(),native);
  }
});
