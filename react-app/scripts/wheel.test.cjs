const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
const mod = { exports: {} };
new Function('exports','module',ts.transpileModule(fs.readFileSync('src/wheel.ts','utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(mod.exports,mod);
const { nearestWheelIndex, wheelKeyIndex } = mod.exports;
test('wheel rounds the centered offset at half-row boundaries',()=>{
  assert.equal(nearestWheelIndex(21.99,24),0); assert.equal(nearestWheelIndex(22,24),1);
  assert.equal(nearestWheelIndex(440,24),10); assert.equal(nearestWheelIndex(1630,60),37);
});
test('wheel clamps overscroll, endpoints and empty/nonfinite positions',()=>{
  assert.equal(nearestWheelIndex(-100,24),0); assert.equal(nearestWheelIndex(1e6,24),23);
  assert.equal(nearestWheelIndex(59*44,60),59); assert.equal(nearestWheelIndex(Infinity,24),0);
  assert.equal(nearestWheelIndex(NaN,24),0); assert.equal(nearestWheelIndex(500,0),0);
});
test('wheel keyboard steps, pages and endpoints never wrap',()=>{
  assert.equal(wheelKeyIndex(10,'ArrowUp',24),9); assert.equal(wheelKeyIndex(10,'ArrowDown',24),11);
  assert.equal(wheelKeyIndex(10,'PageUp',24),5); assert.equal(wheelKeyIndex(10,'PageDown',24),15);
  assert.equal(wheelKeyIndex(10,'Home',24),0); assert.equal(wheelKeyIndex(10,'End',24),23);
  assert.equal(wheelKeyIndex(0,'ArrowUp',24),0); assert.equal(wheelKeyIndex(23,'ArrowDown',24),23);
  assert.equal(wheelKeyIndex(2,'PageUp',24),0); assert.equal(wheelKeyIndex(58,'PageDown',60),59);
  assert.equal(wheelKeyIndex(10,'Escape',24),null);
});
