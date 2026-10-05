const { installAxe } = require("./lib/browser.cjs");
const { assert } = require("./lib/browser.cjs");
const fs = require('node:fs/promises');
const {hitTarget} = require('./hit-target.cjs');
const KEY = 'lifelog-days:celebrated';
const TODAY = '2026-10-02';
const MARKER = `celebrate-featured:${TODAY}`;
const url = process.env.BASE_URL || 'http://127.0.0.1:5188';
const fixture = (patch={}) => ({id:'celebrate-featured',title:'今天值得庆祝',date:TODAY,
  category:'纪念日',repeat:'none',calendar:'solar',note:'',pinned:true,reminders:[],...patch});

exports.checkCelebrationUI = async function (browser) {
  for (const reducedMotion of ['no-preference','reduce']) {
    const context = await browser.newContext({viewport:{width:390,height:740},
      timezoneId:'Asia/Shanghai',deviceScaleFactor:2,reducedMotion});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror',error=>errors.push(error.message));
    await page.clock.setFixedTime(new Date(`${TODAY}T12:00:00+08:00`));
    await page.addInitScript(native=>{
      window.__celebrationEvents=[];
      window.__celebrationHaptics=[];
      if(native) window.CapacitorCustomPlatform={name:'android'};
      new MutationObserver(records=>{
        for(const record of records) for(const [kind,nodes] of [['add',record.addedNodes],['remove',record.removedNodes]])
          for(const node of nodes) if(node instanceof Element && node.matches('canvas.celebration-canvas'))
            window.__celebrationEvents.push({kind,time:performance.now()});
      }).observe(document,{childList:true,subtree:true});
    },reducedMotion==='reduce');
    if(reducedMotion==='reduce') await page.route(/\/node_modules\/.*haptics.*\.js(?:\?.*)?$/,route=>route.fulfill({contentType:'text/javascript',body:`
      export const ImpactStyle={Light:'LIGHT'},NotificationType={Success:'SUCCESS'};
      export const Haptics={notification:async()=>window.__celebrationHaptics.push('success'),
        impact:async()=>window.__celebrationHaptics.push('light')};` }));
    // The Android simulation has no native notification bridge. Keep unrelated
    // E notifications isolated, as in the existing native reminder UI suite.
    if(reducedMotion==='reduce') await page.route('**/*local-notifications*',route=>route.fulfill({contentType:'text/javascript',body:`
      export const LocalNotifications={checkPermissions:async()=>({display:'granted'}),
        requestPermissions:async()=>({display:'granted'}),getPending:async()=>({notifications:[]}),
        cancel:async()=>{},schedule:async()=>{},createChannel:async()=>{},
        addListener:async()=>({remove:async()=>{}})};` }));
    const audit = async label => {
      await installAxe(page);
      const violations=await page.evaluate(async()=>(await window.axe.run(document,
        {runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})));
      assert.deepEqual(violations,[],label+' axe');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+' page overflow');
      const hit=await hitTarget(page.getByRole('button',{name:'再放一次庆祝',exact:true}));
      assert.ok(hit.width>=44&&hit.height>=44&&hit.painted,label+' replay hit area >=44px');
    };
    try {
      await page.goto(url);
      await page.locator('.hero').waitFor();
      await page.evaluate(async records=>{const {mergeDays}=await import('/src/storage.ts');await mergeDays(records)},
        [fixture(),fixture({id:'celebrate-other',title:'同一天的另一条',pinned:false})]);
      await page.reload();
      await page.waitForFunction(([key,marker])=>localStorage.getItem(key)===marker,[KEY,MARKER]);
      const canvas=page.locator('.hero > canvas.celebration-canvas');
      const replay=page.getByRole('button',{name:'再放一次庆祝',exact:true});
      assert.ok(await replay.isVisible());
      if(reducedMotion==='no-preference') {
        await canvas.waitFor();
        assert.equal(await page.locator('canvas.celebration-canvas').count(),1,'only the featured hero celebrates');
        const dimensions=await canvas.evaluate(el=>{
          const css=getComputedStyle(el),r=el.getBoundingClientRect(),h=el.parentElement.getBoundingClientRect();
          return {width:el.width,height:el.height,dpr:devicePixelRatio,hostWidth:h.width,hostHeight:h.height,
            left:r.left-h.left,top:r.top-h.top,cssWidth:r.width,cssHeight:r.height,
            position:css.position,pointer:css.pointerEvents,z:css.zIndex,ariaHidden:el.getAttribute('aria-hidden')};
        });
        assert.equal(dimensions.width,Math.round(dimensions.hostWidth*dimensions.dpr));
        assert.equal(dimensions.height,Math.round(dimensions.hostHeight*dimensions.dpr));
        assert.equal(dimensions.position,'absolute');assert.equal(dimensions.pointer,'none');
        assert.equal(dimensions.z,'2');assert.equal(dimensions.ariaHidden,'true');
        assert.ok(Math.abs(dimensions.left)<1&&Math.abs(dimensions.top)<1);
        assert.ok(Math.abs(dimensions.cssWidth-dimensions.hostWidth)<1&&Math.abs(dimensions.cssHeight-dimensions.hostHeight)<1);
        await canvas.waitFor({state:'hidden',timeout:4500});
        const events=await page.evaluate(()=>window.__celebrationEvents);
        assert.deepEqual(events.map(event=>event.kind),['add','remove']);
        const duration=events[1].time-events[0].time;
        assert.ok(duration>=2550&&duration<=3300,`default 2600ms canvas lifetime, measured ${duration}ms`);
        await page.reload();await replay.waitFor();await page.waitForTimeout(250);
        assert.equal(await canvas.count(),0,'reload never automatically celebrates the same marker');
        assert.deepEqual(await page.evaluate(()=>window.__celebrationEvents),[]);
        await replay.click();await canvas.waitFor();
        await replay.click();assert.equal(await canvas.count(),1,'rapid replays replace, never stack canvases');
        await replay.focus();await page.keyboard.press('Enter');
        assert.equal(await canvas.count(),1,'native replay button supports keyboard activation');
        assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY),MARKER);
        await page.emulateMedia({reducedMotion:'reduce'});
        await canvas.waitFor({state:'hidden'});
        await replay.click();assert.equal(await canvas.count(),0,'switching to reduced motion also prevents replay');
      } else {
        assert.equal(await canvas.count(),0,'reduced motion writes marker without a canvas');
        await page.waitForFunction(()=>window.__celebrationHaptics.includes('success'));
        await replay.click();
        await page.waitForFunction(()=>window.__celebrationHaptics.includes('light'));
        assert.equal(await canvas.count(),0);
        assert.deepEqual(await page.evaluate(()=>window.__celebrationEvents),[]);
        assert.deepEqual(await page.evaluate(()=>window.__celebrationHaptics),['success','light']);
      }
      for(const [width,scale] of [[320,1],[390,1],[1440,1],[320,2]]) {
        await page.setViewportSize({width,height:900});
        const style=await page.addStyleTag({content:`:root{font-size:${100*scale}% !important}`});
        await audit(`celebration ${reducedMotion} ${width}/${scale}`);
        const orbit=await page.locator('.hero-orbit').evaluate(el=>getComputedStyle(el).position);
        assert.equal(orbit,'absolute','existing hero-orbit decoration remains positioned independently');
        assert.equal(await page.locator('.hero').evaluate(el=>getComputedStyle(el).overflow),'hidden');
        await style.evaluate(el=>el.remove());
      }
      const exported=await page.evaluate(async()=>{
        const {db}=await import('/src/storage.ts'),{makeBackup}=await import('/src/domain.ts'),{buildWidgetPayload}=await import('/src/widget.ts');
        const days=await db.days.toArray();return JSON.stringify([makeBackup(days),buildWidgetPayload(days,'2026-10-02')]);
      });
      assert.ok(!exported.includes(KEY)&&!exported.includes(MARKER),'celebrated state is not in backup or widget payload');
      if(reducedMotion==='no-preference') for(const date of ['2026-10-01','2026-10-03']) {
        await page.evaluate(async record=>{const {db}=await import('/src/storage.ts');await db.days.clear();await db.days.put(record)},fixture({date}));
        await page.reload();await page.locator('.hero[data-populated="true"]').waitFor();
        assert.equal(await replay.count(),0,'non-today count has no replay button semantics');
        assert.equal(await canvas.count(),0,'non-today featured record never celebrates');
        assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY),MARKER,'non-today does not overwrite the marker');
      }
      assert.deepEqual(errors,[]);
    } finally {await context.close();}
  }

  // Exercise the reusable canvas API separately: all tones, DPR, resize,
  // idempotent cancellation, and a simulated document-visibility pause.
  const page=await browser.newPage({viewport:{width:390,height:740},deviceScaleFactor:2,reducedMotion:'no-preference'});
  try {
    await page.goto(url);
    await page.evaluate(async()=>{
      const {playCelebration}=await import('/src/celebrate.ts');
      const host=document.createElement('div');host.id='celebration-test-host';
      Object.assign(host.style,{width:'300px',height:'240px',overflow:'hidden'});document.body.append(host);
      window.__playCelebration=playCelebration;window.__celebrationHost=host;
    });
    for(const tone of ['rose','amber','sage']) {
      await page.evaluate(tone=>{window.__cancelCelebration=window.__playCelebration(window.__celebrationHost,tone,{duration:900})},tone);
      await page.waitForTimeout(180);
      const hasPaint=await page.locator('#celebration-test-host canvas').evaluate(el=>
        el.getContext('2d').getImageData(0,0,el.width,el.height).data.some((value,index)=>index%4===3&&value>0));
      assert.ok(hasPaint,tone+' particles are actually drawn');
      await page.evaluate(()=>window.__celebrationHost.style.width='340px');
      await page.waitForFunction(()=>document.querySelector('#celebration-test-host canvas').width===Math.round(340*devicePixelRatio));
      await page.evaluate(()=>{window.__cancelCelebration();window.__cancelCelebration()});
      assert.equal(await page.locator('#celebration-test-host canvas').count(),0,'cancel removes the canvas');
      assert.equal(await page.evaluate(()=>window.__celebrationHost.style.position),'','cancel restores a static host');
    }
    await page.evaluate(()=>{
      window.__hidden=false;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__hidden});
      window.__cancelCelebration=window.__playCelebration(window.__celebrationHost,'rose',{duration:300});
    });
    await page.waitForTimeout(80);
    await page.evaluate(()=>{window.__hidden=true;document.dispatchEvent(new Event('visibilitychange'))});
    await page.waitForTimeout(420);
    assert.equal(await page.locator('#celebration-test-host canvas').count(),1,'hidden document pauses elapsed animation time');
    await page.evaluate(()=>{window.__hidden=false;document.dispatchEvent(new Event('visibilitychange'))});
    await page.locator('#celebration-test-host canvas').waitFor({state:'hidden',timeout:1000});
    await page.evaluate(()=>{window.__cancelCelebration();delete document.hidden});
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(()=>{const cancel=window.__playCelebration(window.__celebrationHost,'rose');cancel();cancel()});
    assert.equal(await page.locator('#celebration-test-host canvas').count(),0,'the reusable API also respects reduced motion');
    await page.evaluate(()=>window.__celebrationHost.remove());
  } finally {await page.close();}
};
