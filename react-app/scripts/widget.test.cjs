const test=require('node:test'),assert=require('node:assert/strict');
const {loadTs}=require('./load-ts.cjs');
const {buildWidgetPayload}=loadTs('src/widget.ts');
const {validateDay,nextOccurrence,compareDays}=loadTs('src/domain.ts');
const day=(patch={})=>validateDay({id:'one',title:'日子',date:'2026-10-01',category:'纪念日',repeat:'none',calendar:'solar',note:'',pinned:false,...patch});
test('empty widget payload clears the featured record and remains deterministic',()=>{
  assert.deepEqual(buildWidgetPayload([],'2026-09-30'),{version:1,updatedAt:'2026-09-30T00:00:00.000Z',featured:null,list:[]});
  assert.equal(buildWidgetPayload([],'invalid'),null);
});
test('widget uses exactly the same ordered hero rule, ignores UI filters and takes only three',()=>{
  const days=[day({id:'future'}),day({id:'past',date:'2020-01-01'}),day({id:'today',date:'2026-09-30'}),day({id:'pinned',pinned:true,date:'2000-01-01'})];
  const before=JSON.stringify(days),payload=buildWidgetPayload(days,'2026-09-30');
  assert.equal(payload.featured.id,'pinned');
  assert.deepEqual(payload.list.map(d=>d.id),[...days].sort((a,b)=>compareDays(a,b,'2026-09-30')).slice(0,3).map(d=>d.id));
  assert.equal(JSON.stringify(days),before);assert.equal(payload.list.length,3);
});
test('widget lunar nextDate is computed by the Web domain nextOccurrence',()=>{
  const d=day({date:'2024-02-10',repeat:'yearly',calendar:'lunar'});
  assert.equal(buildWidgetPayload([d],'2026-09-30').featured.nextDate,nextOccurrence(d,'2026-09-30'));
});
test('Web widget bridge is a no-op with a null launch ID',async()=>{
  let implementation;
  const {WidgetBridge}=loadTs('src/widgetBridge.ts',{'@capacitor/core':{registerPlugin:(name,impl)=>{assert.equal(name,'WidgetBridge');implementation=impl;return impl.web()}}});
  assert.ok(implementation.web);await WidgetBridge.update({json:'{}'});assert.deepEqual(await WidgetBridge.consumeLaunchDayId(),{dayId:null});
});
test('cold widget launch is captured by the current BridgeActivity initial-intent path only once',()=>{
  const fs=require('node:fs');
  const base=fs.readFileSync('node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/BridgeActivity.java','utf8');
  assert.match(base,/this.onNewIntent\(getIntent\(\)\)/);
  const activity=fs.readFileSync('android/app/src/main/java/com/cnxin/lifelog/MainActivity.java','utf8');
  const create=activity.split('protected void onCreate')[1].split('@Override')[0];
  assert.doesNotMatch(create,/captureWidgetDayId\(getIntent\(\)\)/);
  assert.match(activity,/captureWidgetDayId\(intent\);\s*super.onNewIntent\(intent\)/);
});
