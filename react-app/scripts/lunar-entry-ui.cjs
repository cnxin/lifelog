// Expected Gregorian dates and next annual occurrences are derived from
// lunar-javascript; no handwritten lunar reference table.
const {chromium,assert,installAxe}=require('./lib/browser.cjs');
const {Lunar}=require('lunar-javascript');
const {loadTs}=require('./load-ts.cjs');
const {nextOccurrence}=loadTs('src/domain.ts');
const fs=require('node:fs/promises');
exports.checkLunarEntryUI=async function(browser){
  const context=await browser.newContext({viewport:{width:360,height:740},timezoneId:'Asia/Shanghai',reducedMotion:'reduce'});
  try{
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.clock.setFixedTime(new Date('2026-10-05T12:00:00+08:00'));
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5188');
    await page.getByRole('button',{name:'新增日子',exact:true}).click();
    await page.getByLabel('日子名称',{exact:true}).fill('农历录入回归');
    await page.getByRole('radio',{name:'生日',exact:true}).check();
    await page.locator('.date-trigger').click();
    const picker=page.locator('.date-picker');
    await picker.getByRole('radio',{name:'农历',exact:true}).check();
    await picker.getByLabel('年份',{exact:true}).fill('2025');
    await picker.getByRole('button',{name:'八月',exact:true}).click();
    const expected=Lunar.fromYmd(2025,8,15).getSolar().toYmd();
    const day=picker.locator(`button[data-date="${expected}"]`);
    await day.focus();
    assert.equal(await picker.locator('.lunar-grid button[tabindex="0"]').count(),1);
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator(':focus').getAttribute('data-date'),Lunar.fromYmd(2025,8,16).getSolar().toYmd());
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator(':focus').getAttribute('data-date'),Lunar.fromYmd(2025,8,22).getSolar().toYmd());
    await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowLeft');
    assert.equal(await page.locator('.date-trigger').getAttribute('data-date'),'2026-10-05','browsing does not commit');
    assert.match(await picker.locator('.date-picker-footer').textContent(),/按农历选日期 · 保存为对应公历/);
    await installAxe(page);
    assert.deepEqual(await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))),[]);
    await fs.mkdir('.artifacts/lunar-entry',{recursive:true});
    await page.screenshot({path:'.artifacts/lunar-entry/360-panel.png',fullPage:true});
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.date-trigger').getAttribute('data-date'),expected);
    assert.ok(await page.getByRole('checkbox',{name:'每年重复',exact:true}).isChecked());
    assert.ok(await page.locator('.repeat-calendar').getByRole('radio',{name:'农历',exact:true}).isChecked());
    await page.locator('.date-trigger').click();
    assert.ok(await picker.getByRole('radio',{name:'农历',exact:true}).isChecked(),'lunar record defaults to lunar when opened');
    await picker.getByLabel('年份',{exact:true}).fill('2025');
    await picker.getByRole('button',{name:'闰六月',exact:true}).click();
    assert.equal(await picker.locator('.lunar-day').count(),29);
    for(const width of [320,360,412,1024]){
      await page.setViewportSize({width,height:900});
      const geometry=await picker.evaluate(el=>({pageFits:document.documentElement.scrollWidth<=innerWidth,
        cells:[...el.querySelectorAll('.lunar-day,.lunar-months button')].map(b=>{
          const r=b.getBoundingClientRect(),p=getComputedStyle(b,'::before');
          return {width:r.width+Math.max(0,-parseFloat(p.left))+Math.max(0,-parseFloat(p.right)),
            height:r.height+Math.max(0,-parseFloat(p.top))+Math.max(0,-parseFloat(p.bottom))};
        })}));
      assert.ok(geometry.pageFits,`lunar grid page geometry ${width}`);
      assert.ok(geometry.cells.every(r=>r.width>=44 && r.height>=44),`lunar hit areas ${width} >=44`);
      await fs.writeFile(`.artifacts/lunar-entry/${width}-geometry.json`,JSON.stringify(geometry,null,2)+'\n');
    }
    await picker.getByLabel('年份',{exact:true}).fill('1901');
    assert.ok(await picker.getByRole('button',{name:'上一年',exact:true}).isDisabled());
    await picker.getByLabel('年份',{exact:true}).fill('2099');
    assert.ok(await picker.getByRole('button',{name:'下一年',exact:true}).isDisabled());
    assert.ok(await picker.getByRole('button',{name:'腊月',exact:true}).isDisabled());
    await picker.getByRole('button',{name:'冬月',exact:true}).click();
    assert.ok(await picker.locator('.lunar-day:disabled').count()>0);
    await page.keyboard.press('Escape');
    await page.getByRole('checkbox',{name:'每年重复',exact:true}).uncheck();
    assert.ok(!await page.getByRole('checkbox',{name:'每年重复',exact:true}).isChecked(),'annual repeat remains manually cancellable');
    await page.locator('.date-trigger').click();
    await picker.getByRole('radio',{name:'农历',exact:true}).check();
    await picker.getByLabel('年份',{exact:true}).fill('2025');
    await picker.getByRole('button',{name:'八月',exact:true}).click();
    await picker.locator(`button[data-date="${expected}"]`).click();
    await page.getByRole('button',{name:'记下这个日子',exact:true}).click();
    await page.locator('.day-card').first().waitFor();
    assert.match(await page.locator('.card-date').first().textContent(),/农历八月十五/);
    const stored=await page.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('LifeLogDays');r.onsuccess=()=>resolve(r.result);});
      const days=await new Promise(resolve=>{const r=db.transaction('days').objectStore('days').getAll();r.onsuccess=()=>resolve(r.result);});db.close();return days[0];});
    assert.equal(stored.date,expected);assert.equal(stored.calendar,'lunar');assert.equal(stored.repeat,'yearly');
    const next=nextOccurrence(stored,'2026-10-05');
    assert.match(await page.locator('.card-bottom').first().textContent(),new RegExp(next.replaceAll('-','\\.')));
    assert.deepEqual(errors,[]);
    console.log('PASS: lunar entry conversion, roving arrows, annual autofill/cancel, leap month, boundaries, touch geometry, saved card and axe.');
  }finally{await context.close();}
};
if(require.main===module)(async()=>{const b=await chromium.launch();try{await exports.checkLunarEntryUI(b);}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
