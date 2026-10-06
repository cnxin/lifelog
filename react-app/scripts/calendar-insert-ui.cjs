const { assert, installAxe } = require('./lib/browser.cjs');
const { hitTarget } = require('./hit-target.cjs');
const fs = require('node:fs/promises');
const {setWheel} = require('./wheel-helper.cjs');
exports.checkCalendarInsertUI = async function(browser) {
  const days=[
    {id:'calendar-solar',title:'公历日历测试',date:'2020-05-20',category:'纪念日',repeat:'yearly',calendar:'solar',note:'系统日历备注',pinned:false,reminders:[]},
    {id:'calendar-lunar',title:'农历日历测试',date:'2024-02-10',category:'生日',repeat:'yearly',calendar:'lunar',note:'',pinned:false,reminders:[]},
    {id:'calendar-once',title:'单次日历测试',date:'2020-01-01',category:'倒数日',repeat:'none',calendar:'solar',note:'',pinned:false,reminders:[]},
  ];
  const page=await browser.newPage({viewport:{width:390,height:740},timezoneId:'Asia/Shanghai',reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    window.CapacitorCustomPlatform={name:'android'};
    window.__calendar={calls:[],haptics:[],result:{ok:false,reason:'no-calendar-app'}};
    window.Capacitor={PluginHeaders:[{name:'CalendarBridge',methods:[{name:'insert',rtype:'promise'}]}],
      nativePromise:async(name,method,options)=>{
        if(name!=='CalendarBridge'||method!=='insert')throw Error('unexpected native call');
        window.__calendar.calls.push(options);return window.__calendar.result;
      }};
  });
  await page.route(/@capacitor(?:\/|_)haptics/,route=>route.fulfill({contentType:'text/javascript',body:`
    export const ImpactStyle={Light:'LIGHT',Medium:'MEDIUM'};export const NotificationType={Success:'SUCCESS'};
    export const Haptics={impact:async({style})=>window.__calendar.haptics.push(style),notification:async()=>{}};`}));
  await page.route('**/*local-notifications*',route=>route.fulfill({contentType:'text/javascript',body:`export const LocalNotifications={
    checkPermissions:async()=>({display:'denied'}),checkExactNotificationSetting:async()=>({exact_alarm:'denied'}),
    getPending:async()=>({notifications:[]}),addListener:async()=>({remove:async()=>{}})};`}));
  async function seed(target) {
    await target.goto(process.env.BASE_URL||'http://127.0.0.1:5188');
    await target.getByRole('button',{name:'新增日子',exact:true}).waitFor();
    await target.evaluate(async rows=>{const {db}=await import('/src/storage.ts');await db.days.clear();await db.days.bulkPut(rows)},days);
    await target.reload();await target.locator('.day-card').first().waitFor();
  }
  async function audit(label) {
    await installAxe(page);
    assert.deepEqual(await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))),[],label);
    assert.ok(await page.locator('dialog[open]').evaluateAll(els=>els.every(el=>el.scrollWidth<=el.clientWidth+1)),label+' no horizontal overflow');
  }
  try {
    await fs.mkdir('.artifacts/phase-k/visuals',{recursive:true});
    await page.clock.setFixedTime(new Date('2026-10-06T12:00:00+08:00'));
    await seed(page);
    for (const day of days) {
      await page.locator('.day-grid').getByRole('button',{name:'查看：'+day.title,exact:true}).click();
      const action=page.getByRole('button',{name:'加入日历',exact:true});
      assert.ok(await action.isVisible());
      assert.equal(await page.locator('.detail-footer button').count(),3);
      assert.equal(await page.locator('.calendar-insert-help').count(),day.calendar==='lunar'?1:0);
      if(day.calendar==='lunar')assert.match(await page.locator('.calendar-insert-help').textContent(),/每年需重新加入/);
      for(const scheme of ['light','dark']) {
        await page.emulateMedia({colorScheme:scheme});
        for(const width of [320,430,1440]) {
          await page.setViewportSize({width,height:740});await audit('K2 detail '+day.id+' '+scheme+' '+width);
          await action.scrollIntoViewIfNeeded();
          const hit=await hitTarget(action);assert.ok(hit.width>=44&&hit.height>=44&&hit.painted);
          if(width===430)await page.screenshot({path:`.artifacts/phase-k/visuals/${day.id}-${scheme}.png`});
        }
      }
      await action.click();
      await page.getByRole('status').filter({hasText:'此设备没有可用的日历应用'}).waitFor();
      const payload=await page.evaluate(()=>window.__calendar.calls.at(-1));
      assert.equal(payload.title,day.title);assert.equal(payload.allDay,true);
      assert.equal(Object.hasOwn(payload,'reminderMinutes'),false);
      if(day.calendar==='lunar'){assert.equal(Object.hasOwn(payload,'rrule'),false);assert.match(payload.description,/农历 正月初一 · 每年需重新加入/);}
      else if(day.repeat==='yearly'){assert.equal(payload.rrule,'FREQ=YEARLY');assert.equal(payload.startDate,'2027-05-20');}
      else {assert.equal(payload.startDate,day.date);assert.equal(Object.hasOwn(payload,'rrule'),false);}
      await page.getByRole('button',{name:'关闭',exact:true}).click();
    }
    await page.emulateMedia({colorScheme:'light'});await page.setViewportSize({width:390,height:740});
    await page.locator('.day-grid').getByRole('button',{name:'查看：公历日历测试',exact:true}).click();
    await page.evaluate(()=>{window.__calendar.result={ok:true}});
    await page.getByRole('button',{name:'加入日历',exact:true}).click();
    const count=await page.evaluate(()=>window.__calendar.calls.length);
    await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(700);
    assert.equal(await page.evaluate(()=>window.__calendar.calls.length),count,'returning active never inserts another calendar event');
    assert.ok(await page.evaluate(()=>window.__calendar.haptics.includes('LIGHT')),'calendar insert uses light haptic');
    // Native integration: returning to the editor preserves a visible last-hour focus.
    await page.getByRole('button',{name:'编辑',exact:true}).click();
    await page.getByRole('checkbox',{name:'提醒我',exact:true}).check();
    await page.locator('.reminder-field .time-trigger').click();
    await setWheel(page,'小时',23);
    await page.getByRole('button',{name:'收起',exact:true}).click();
    await page.locator('.reminder-field .time-trigger').click();
    await page.waitForFunction(()=>document.activeElement?.getAttribute('role')==='spinbutton'&&document.activeElement?.getAttribute('aria-label')==='小时');
    assert.equal(await page.getByRole('spinbutton',{name:'小时',exact:true}).getAttribute('aria-valuenow'),'23');
    assert.ok(await page.getByRole('spinbutton',{name:'小时',exact:true}).evaluate(el=>{
      const r=el.querySelector('[data-selected="true"]').getBoundingClientRect(),p=el.getBoundingClientRect();return r.top>=p.top&&r.bottom<=p.bottom;
    }),'the selected 23-hour wheel item and keyboard focus are not clipped');
    for(const scheme of ['light','dark']) {
      await page.emulateMedia({colorScheme:scheme});await audit('native last-hour time panel '+scheme);
      await page.screenshot({path:`.artifacts/phase-k/visuals/editor-time-${scheme}.png`});
    }
    assert.deepEqual(errors,[]);
  } finally {await page.close();}
  const web=await browser.newPage({reducedMotion:'reduce'});
  try {
    await seed(web);
    for(const day of days) {
      await web.locator('.day-grid').getByRole('button',{name:'查看：'+day.title,exact:true}).click();
      assert.equal(await web.getByRole('button',{name:'加入日历',exact:true}).count(),0,'Web does not render calendar action');
      assert.equal(await web.locator('.detail-footer button').count(),2,'Web retains original two footer actions');
      assert.equal(await web.locator('.calendar-insert-help').count(),0);
      await web.getByRole('button',{name:'关闭',exact:true}).click();
    }
  } finally {await web.close();}
};
