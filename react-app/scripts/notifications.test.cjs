const test = require('node:test');
const assert = require('node:assert/strict');
const {loadTs} = require('./load-ts.cjs');
function setup(native=true) {
  const calls=[], state={display:'granted', request:'granted', pending:[{id:99}], fail:false, callback:null, removed:0, plans:[]};
  let imports=0;
  const plugin={
    checkPermissions:async()=>{calls.push('check');return {display:state.display}},
    requestPermissions:async()=>{calls.push('request');state.display=state.request;return {display:state.display}},
    getPending:async()=>{calls.push('pending');return {notifications:state.pending}},
    cancel:async options=>{calls.push(['cancel',options]);state.pending=[]},
    createChannel:async options=>calls.push(['channel',options]),
    schedule:async options=>{calls.push(['schedule',options]);if(state.fail){state.fail=false;throw Error('schedule failed')}state.pending=options.notifications.map(({id})=>({id}))},
    addListener:async(name,cb)=>{calls.push(name);state.callback=cb;return {remove:async()=>state.removed++}},
  };
  const mocks={'@capacitor/core':{Capacitor:{isNativePlatform:()=>native,getPlatform:()=>native?'android':'web'}},
    './reminders':{planReminders:(days,now,time)=>{state.plans.push({days,now,time});return days.flatMap(d=>(d.reminders||[]).map((offset,i)=>({id:i+1,dayId:d.id,title:d.title,body:'test',at:'2027-06-01T09:00'})))}}};
  Object.defineProperty(mocks,'@capacitor/local-notifications',{get(){imports++;return {LocalNotifications:plugin}}});
  return {api:loadTs('src/notifications.ts',mocks),state,calls,imports:()=>imports};
}
const day={id:'one',title:'订婚',reminders:[0]};
test('Web notification APIs are no-op and do not import the native plugin',async()=>{
  const m=setup(false);assert.equal(await m.api.ensurePermission(),'unavailable');await m.api.resync([day],'09:00');(await m.api.onOpenFromNotification(()=>assert.fail()))();assert.equal(m.imports(),0);assert.deepEqual(m.calls,[]);
});
test('permission prompts only in user permission flow, denied remains denied',async()=>{
  const m=setup();m.state.display='prompt';m.state.request='denied';assert.equal(await m.api.ensurePermission(),'denied');assert.equal(await m.api.ensurePermission(),'denied');assert.equal(m.calls.filter(x=>x==='request').length,1);
  await m.api.resync([day],'09:00');assert.equal(m.calls.filter(x=>Array.isArray(x)&&x[0]==='schedule').length,0);assert.equal(m.calls.filter(x=>x==='request').length,1);assert.ok(m.calls.some(x=>Array.isArray(x)&&x[0]==='cancel'));
});
test('resync cancels before scheduling, creates the channel once and is explicitly inexact',async()=>{
  const m=setup();await m.api.resync([day],'09:00');await m.api.resync([day],'20:00');
  const schedules=m.calls.filter(x=>Array.isArray(x)&&x[0]==='schedule');assert.equal(schedules.length,2);
  assert.equal(m.calls.filter(x=>Array.isArray(x)&&x[0]==='channel').length,1);
  const n=schedules[0][1].notifications[0];assert.equal(n.isExactNotification,false);assert.equal(n.schedule.allowWhileIdle,false);assert.equal(n.schedule.repeats,undefined);assert.ok(n.schedule.at instanceof Date);assert.equal(n.channelId,'days');assert.deepEqual(n.extra,{dayId:'one'});
  assert.ok(m.calls.findIndex(x=>Array.isArray(x)&&x[0]==='cancel')<m.calls.findIndex(x=>Array.isArray(x)&&x[0]==='schedule'));
});
test('concurrent resync is serialized, snapshots caller state and recovers after rejection',async()=>{
  const m=setup();const draft={...day,reminders:[0]};m.state.fail=true;const a=m.api.resync([draft],'09:00');draft.reminders.push(7);const b=m.api.resync([],'20:00');await assert.rejects(a);await b;assert.deepEqual(m.state.plans[0].days[0].reminders,[0]);assert.equal(m.state.pending.length,0);await m.api.resync([day],'12:00');assert.equal(m.state.pending.length,1);
});
test('notification actions forward valid day IDs and remove their own listener',async()=>{
  const m=setup(),ids=[];const remove=await m.api.onOpenFromNotification(id=>ids.push(id));for(const dayId of ['one',42,'', 'x'.repeat(501)])m.state.callback({notification:{extra:{dayId}}});assert.deepEqual(ids,['one']);remove();assert.equal(m.state.removed,1);
});
