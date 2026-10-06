const {assert,installAxe} = require('./lib/browser.cjs');
const {setWheel} = require('./wheel-helper.cjs');
exports.checkTimePanelStructure = async function(page, hasGlobal) {
  const panel = page.locator('.time-wheel.time-picker');
  assert.equal(await panel.evaluate(el => el.classList.contains('date-picker')), true, 'time panel reuses date-picker frame');
  assert.equal(await panel.locator('.time-picker-footer').count(), 0, 'old time-only footer removed');
  const footer = panel.locator('.date-picker-footer');
  const close = footer.getByRole('button', {name:'收起',exact:true});
  assert.equal(await close.getAttribute('class'), 'date-collapse', 'close reuses date footer class');
  assert.equal(await footer.getByRole('button').count(), hasGlobal ? 2 : 1);
  if (hasGlobal) {
    assert.equal(await footer.locator('button').first().getAttribute('class'), 'calendar-today');
    assert.equal(await footer.locator('span').textContent(), '滑动选择 · 精确到分钟');
  } else {
    assert.equal(await footer.textContent(), '收起', 'global panel footer only shows close');
    assert.equal(await footer.locator('span').getAttribute('aria-hidden'), 'true', 'empty spacer is decorative');
  }
  const geometry = await panel.evaluate(el => {
    const css = getComputedStyle(el), footer = el.querySelector('.date-picker-footer');
    const buttons = [...footer.querySelectorAll('button')].map(button => button.getBoundingClientRect().toJSON());
    const labels = [...el.querySelectorAll('.time-wheel-label')].map(label => ({font:getComputedStyle(label).fontSize, color:getComputedStyle(label).color}));
    const hint = getComputedStyle(footer.querySelector('span')), box = footer.getBoundingClientRect();
    return {padding:css.padding, radius:css.borderRadius, border:css.borderTopWidth,
      rem:parseFloat(getComputedStyle(document.documentElement).fontSize),
      footerHeight:box.height, footerRight:box.right, buttons, labels, muted:hint.color};
  });
  assert.equal(geometry.padding, '3px 8px');
  assert.equal(parseFloat(geometry.radius), 1.25 * geometry.rem, 'frame uses the unchanged 1.25rem date-picker radius');
  assert.equal(geometry.border, '1px');
  assert.ok(geometry.footerHeight >= 44, 'shared footer retains its 44px minimum with large text');
  assert.ok(geometry.labels.every(label => parseFloat(label.font) === .75 * geometry.rem && label.color === geometry.muted), 'hour/minute labels use .75rem and muted token');
  assert.equal(geometry.buttons.at(-1).right, geometry.footerRight, 'close stays at right without new footer CSS');
};
exports.checkWheelInteractions = async function(page) {
  await exports.checkTimePanelStructure(page, true);
  const useGlobal = page.locator('.time-wheel .calendar-today');
  assert.equal(await useGlobal.isDisabled(), true, 'inherited global time disables redundant reset');
  assert.equal(await useGlobal.evaluate(el => getComputedStyle(el).opacity), '0.55');
  await useGlobal.evaluate(el => el.click());
  assert.equal(await page.locator('.time-wheel').isVisible(), true, 'disabled global reset does not close panel');
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
  assert.equal(await useGlobal.isEnabled(), true, 'custom time enables global reset');
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
  await setWheel(page,'小时',20);await setWheel(page,'分钟',0);
  assert.equal(await useGlobal.isDisabled(), true, 'explicit custom value equal to global is also disabled');
  await setWheel(page,'小时',10);await setWheel(page,'分钟',37);
  await hour.focus();
  await installAxe(page);
  assert.deepEqual(await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>v.id)),[],'wheel keyboard focus and ARIA pass axe');
};
