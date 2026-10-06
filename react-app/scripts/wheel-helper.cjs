exports.setWheel = async function(page, label, index) {
  const wheel = page.getByRole('spinbutton', {name:label,exact:true});
  await wheel.locator('.wheel-scroll').evaluate((el,n)=>el.scrollTo({top:n*44,behavior:'auto'}),index);
  await page.waitForFunction(({label,index})=>document.querySelector(`[role="spinbutton"][aria-label="${label}"]`)?.getAttribute('aria-valuenow')===String(index),{label,index});
};
