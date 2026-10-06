const {assert,installAxe} = require('./lib/browser.cjs');
const {setWheel} = require('./wheel-helper.cjs');
exports.checkWheelInteractions = async function(page) {
  const hour=page.getByRole('spinbutton',{name:'小时',exact:true});
  const minute=page.getByRole('spinbutton',{name:'分钟',exact:true});
  await hour.focus(); await page.keyboard.press('Tab');
  assert.ok(await minute.evaluate(el=>el===document.activeElement),'Tab goes directly between spinbuttons, not hidden scroll containers');
  assert.equal(await hour.getAttribute('aria-valuemin'),'0');
  assert.equal(await hour.getAttribute('aria-valuemax'),'23');
  assert.equal(await minute.getAttribute('aria-valuemax'),'59');
  for(const wheel of [hour,minute]) {
    const geometry=await wheel.evaluate(el=>{
      const scroll=el.querySelector('.wheel-scroll'),item=el.querySelector('.wheel-option'),selection=el.querySelector('.wheel-selection');
      return {height:el.getBoundingClientRect().height,item:item.getBoundingClientRect().height,band:selection.getBoundingClientRect().height,
        snap:getComputedStyle(scroll).scrollSnapType,touch:getComputedStyle(scroll).touchAction,overscroll:getComputedStyle(scroll).overscrollBehaviorY};
    });
    assert.deepEqual(geometry,{height:220,item:44,band:44,snap:'y mandatory',touch:'pan-y',overscroll:'contain'});
  }
  await setWheel(page,'小时',10); await setWheel(page,'分钟',37);
  assert.match(await page.locator('.reminder-field .time-trigger').innerText(),/10:37/,'programmatic scrolling delivers selected values through onChange');
  await minute.press('ArrowUp'); assert.equal(await minute.getAttribute('aria-valuenow'),'36');
  await minute.press('ArrowDown'); assert.equal(await minute.getAttribute('aria-valuenow'),'37');
  await minute.press('PageDown'); assert.equal(await minute.getAttribute('aria-valuenow'),'42');
  await minute.press('PageUp'); assert.equal(await minute.getAttribute('aria-valuenow'),'37');
  await minute.press('Home'); assert.equal(await minute.getAttribute('aria-valuenow'),'0');
  await minute.press('ArrowUp'); assert.equal(await minute.getAttribute('aria-valuenow'),'0');
  await minute.press('End'); assert.equal(await minute.getAttribute('aria-valuenow'),'59');
  await minute.press('ArrowDown'); assert.equal(await minute.getAttribute('aria-valuenow'),'59');
  await page.waitForFunction(()=>document.querySelector('[aria-label="分钟"] .wheel-scroll').scrollTop===59*44);
  const centered=await minute.evaluate(el=>{
    const r=el.getBoundingClientRect(),s=el.querySelector('[data-selected="true"]').getBoundingClientRect();return Math.abs((r.top+r.bottom)/2-(s.top+s.bottom)/2);
  });
  assert.ok(centered<=.5,'last minute centers between two blank rows');
  // Capture real programmatic calls without changing their implementation.
  await page.evaluate(()=>{
    window.__wheelScrollCalls=[];window.__wheelScrollTo=HTMLElement.prototype.scrollTo;
    HTMLElement.prototype.scrollTo=function(opts,...args){if(this.matches('.wheel-scroll'))window.__wheelScrollCalls.push(opts);return window.__wheelScrollTo.call(this,opts,...args)};
  });
  try {
    await page.emulateMedia({reducedMotion:'reduce'});await minute.press('ArrowUp');
    assert.equal(await page.evaluate(()=>window.__wheelScrollCalls.at(-1).behavior),'auto');
    await page.emulateMedia({reducedMotion:'no-preference'});await minute.press('ArrowUp');
    assert.equal(await page.evaluate(()=>window.__wheelScrollCalls.at(-1).behavior),'smooth');
    await page.waitForFunction(()=>Math.abs(document.querySelector('[aria-label="分钟"] .wheel-scroll').scrollTop-57*44)<.5);
  } finally {
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(()=>{HTMLElement.prototype.scrollTo=window.__wheelScrollTo;delete window.__wheelScrollTo;});
  }
  // Explicitly exercise the 120ms scroll fallback even if scrollend exists.
  await minute.locator('.wheel-scroll').evaluate(el=>{
    el.addEventListener('scrollend',event=>event.stopImmediatePropagation(),{capture:true});
    el.scrollTo({top:13*44,behavior:'auto'});
  });
  await page.waitForFunction(()=>document.querySelector('[role="spinbutton"][aria-label="分钟"]').getAttribute('aria-valuenow')==='13');
  assert.match(await page.locator('.reminder-field .time-trigger').innerText(),/10:13/,'fallback delivers the nearest minute');
  // At the sheet's scrollTop=0, downward dragging inside the wheel never owns sheet drag.
  await hour.press('Home');
  await page.locator('.editor-modal .modal-body').evaluate(el=>el.scrollTop=0);
  await hour.locator('.wheel-scroll').dispatchEvent('pointerdown',{pointerId:87,isPrimary:true,button:0,clientX:100,clientY:100});
  await hour.locator('.wheel-scroll').dispatchEvent('pointermove',{pointerId:87,isPrimary:true,button:0,clientX:100,clientY:260});
  await hour.locator('.wheel-scroll').dispatchEvent('pointerup',{pointerId:87,isPrimary:true,button:0,clientX:100,clientY:260});
  assert.equal(await page.locator('.editor-modal').evaluate(el=>el.open&&!el.hasAttribute('data-dragging')),true,'wheel at its endpoint cannot drag the sheet');
  await setWheel(page,'小时',10);await setWheel(page,'分钟',37);
  await hour.focus();
  await installAxe(page);
  assert.deepEqual(await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>v.id)),[],'wheel keyboard focus and ARIA pass axe');
};
