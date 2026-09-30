const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const {pickDate} = require('./date-picker-helper.cjs');
const {hitTarget} = require('./hit-target.cjs');
exports.checkReminderUI = async function(browser) {
  const page = await browser.newPage({viewport:{width:390,height:740},reducedMotion:'reduce',timezoneId:'Asia/Shanghai'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    window.CapacitorCustomPlatform={name:'android'};
    window.__notif={display:'prompt',request:'denied',pending:[],calls:[],listeners:{}};
  });
  await page.route('**/*local-notifications*',route=>route.fulfill({contentType:'text/javascript',body:`
    const n=window.__notif;
    export const LocalNotifications={
      checkPermissions:async()=>({display:n.display}),
      requestPermissions:async()=>{n.calls.push('request');n.display=n.request;return {display:n.display}},
      getPending:async()=>({notifications:n.pending}),
      cancel:async()=>{n.pending=[];n.calls.push('cancel')},
      schedule:async({notifications})=>{n.pending=notifications;n.calls.push('schedule')},
      createChannel:async()=>{n.calls.push('channel')},
      addListener:async(name,cb)=>{n.listeners[name]=cb;return {remove:async()=>{if(n.listeners[name]===cb)delete n.listeners[name]}}},
    };` }));
  const audit=async label=>{
    await page.evaluate(await fs.readFile(require.resolve('axe-core'),'utf8'));
    const v=await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})));
    assert.deepEqual(v,[],label);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+' page overflow');
    assert.ok(await page.locator('dialog[open]').evaluateAll(els=>els.every(el=>el.scrollWidth<=el.clientWidth+1)),label+' dialog overflow');
  };
  try {
    await page.goto(process.env.BASE_URL||'http://127.0.0.1:5188');
    await page.getByRole('button',{name:'新增日子',exact:true}).click();
    await page.getByLabel('日子名称').fill('提醒测试');
    await pickDate(page,'2099-06-01');
    const toggle=page.getByRole('checkbox',{name:'提醒我',exact:true});
    await toggle.check();
    await page.getByText('系统未允许通知，提醒会在你到系统设置里开启后生效',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.__notif.calls.filter(x=>x==='request').length),1);
    const group=page.getByRole('group',{name:'提醒提前天数',exact:true});
    assert.equal(await group.getByRole('button').count(),4);
    await group.getByRole('button',{name:'提前1天',exact:true}).click();
    for(const width of [320,360,412,430,1440]) {
      await page.setViewportSize({width,height:900});
      await group.scrollIntoViewIfNeeded();
      const rows = await group.getByRole('button').evaluateAll(els => els.map(el => el.getBoundingClientRect().top));
      assert.ok(rows.every(y => Math.abs(y - rows[0]) < .5), 'all four reminder offsets remain on one row');
      for(const button of await group.getByRole('button').all()) {
        await button.scrollIntoViewIfNeeded();const hit=await hitTarget(button);
        assert.ok(hit.width>=44&&hit.height>=44&&hit.painted,`reminder chip >=44px actual hit area at ${width}`);
      }
      await audit('native reminder editor '+width);
    }
    await page.setViewportSize({width:320,height:740});
    await page.addStyleTag({content:':root{font-size:200% !important}'});
    await group.getByRole('button').last().scrollIntoViewIfNeeded();
    await audit('native reminder editor large text');
    await page.locator('style').filter({hasText:':root{font-size:200%'}).evaluateAll(els=>els.forEach(el=>el.remove()));
    await page.getByRole('button',{name:'记下这个日子',exact:true}).click();
    await page.locator('.editor-modal').waitFor({state:'hidden'});
    await page.waitForTimeout(700);
    const saved=await page.evaluate(async()=>{const {db}=await import('/src/storage.ts');return (await db.days.toArray())[0]});
    assert.deepEqual(saved.reminders,[0,1],'denied permission still saves reminder settings');
    assert.ok(await page.locator('.day-card').getByRole('img',{name:'已设置提醒'}).isVisible());
    assert.equal(await page.evaluate(()=>window.__notif.calls.filter(x=>x==='schedule').length),0,'no schedule while denied');
    await page.evaluate(()=>{window.__notif.display='granted'});
    await page.getByRole('button',{name:'数据与备份',exact:true}).click();
    for(const width of [320,430,1440]) {
      await page.setViewportSize({width,height:900});
      await audit('native reminder time '+width);
    }
    await page.getByRole('radio',{name:'20:00',exact:true}).check();
    await page.waitForFunction(()=>window.__notif.pending.length===2);
    assert.equal(await page.evaluate(()=>localStorage.getItem('lifelog-days:reminder-time')),'20:00');
    assert.ok(await page.evaluate(()=>window.__notif.pending.every(n=>!n.isExactNotification&&!n.schedule.allowWhileIdle&&!n.schedule.repeats)));
    await page.getByRole('button',{name:'关闭',exact:true}).click();
    await page.evaluate(id=>window.__notif.listeners.localNotificationActionPerformed({notification:{extra:{dayId:id}}}),saved.id);
    await page.locator('.detail-modal').waitFor();
    assert.ok(await page.locator('.detail-modal').getByRole('img',{name:'已设置提醒'}).isVisible());
    await page.getByRole('button',{name:'编辑',exact:true}).click();
    await page.getByRole('group',{name:'提醒提前天数'}).getByRole('button',{name:'当天',exact:true}).click();
    await page.getByRole('group',{name:'提醒提前天数'}).getByRole('button',{name:'提前1天',exact:true}).click();
    assert.equal(await toggle.isChecked(),false,'deselecting the last offset turns reminders off');
    await page.getByRole('button',{name:'保存修改',exact:true}).click();
    await page.locator('.editor-modal').waitFor({state:'hidden'});
    await page.waitForFunction(()=>window.__notif.pending.length===0);
    await page.locator('.detail-modal').getByRole('button',{name:'关闭',exact:true}).click();
    await page.evaluate(()=>window.__notif.listeners.localNotificationActionPerformed({notification:{extra:{dayId:'deleted'}}}));
    await page.waitForTimeout(100);assert.equal(await page.locator('dialog[open]').count(),0,'deleted notification ID is ignored');
    assert.deepEqual(errors,[]);
  } finally {await page.close();}
  const web=await browser.newPage();
  try {
    await web.goto(process.env.BASE_URL||'http://127.0.0.1:5188');
    await web.getByRole('button',{name:'新增日子',exact:true}).click();
    assert.equal(await web.getByRole('checkbox',{name:'提醒我'}).count(),0);
    await web.keyboard.press('Escape');await web.locator('dialog').waitFor({state:'hidden'});
    await web.getByRole('button',{name:'数据与备份',exact:true}).click();
    assert.equal(await web.getByRole('group',{name:'提醒时间'}).count(),0);
    await web.getByRole('button',{name:'关闭',exact:true}).click();
    await web.locator('dialog').waitFor({state:'hidden'});
    await web.evaluate(async()=>{const {mergeDays}=await import('/src/storage.ts');await mergeDays([{id:'web-reminder',title:'Web 不展示提醒',date:'2099-06-01',category:'纪念日',repeat:'none',calendar:'solar',note:'',pinned:false,reminders:[0]}])});
    await web.reload();await web.locator('.day-card').waitFor();
    assert.equal(await web.getByRole('img',{name:'已设置提醒'}).count(),0,'Web hides reminder badges even for imported reminder settings');
  }finally{await web.close();}
};
