const assert = require('node:assert/strict');
const test = require('node:test');
const {loadTs} = require('./load-ts.cjs');
const {CELEBRATED_KEY, shouldCelebrate} = loadTs('src/celebrate.ts');
const {validateDay} = loadTs('src/domain.ts');
const day = (patch={}) => validateDay({id:'today',title:'值得纪念',date:'2026-10-02',category:'纪念日',repeat:'none',calendar:'solar',note:'',pinned:false,...patch});
test('celebration uses the requested local-only key and exact featured/day marker',()=>{
  assert.equal(CELEBRATED_KEY,'lifelog-days:celebrated');
  assert.equal(shouldCelebrate(day(),'2026-10-02',null),true);
  assert.equal(shouldCelebrate(day(),'2026-10-02','today:2026-10-02'),false);
  assert.equal(shouldCelebrate(day(),'2026-10-02','today:2026-10-01'),true);
  assert.equal(shouldCelebrate(day(),'2026-10-02','another:2026-10-02'),true);
});
test('missing featured, invalid today, future and elapsed records do not celebrate',()=>{
  for(const featured of [null,undefined]) assert.equal(shouldCelebrate(featured,'2026-10-02',null),false);
  assert.equal(shouldCelebrate(day(),'bad',null),false);
  assert.equal(shouldCelebrate(day({date:'2026-10-03'}),'2026-10-02',null),false);
  assert.equal(shouldCelebrate(day({date:'2026-10-01'}),'2026-10-02',null),false);
});
test('solar yearly records celebrate the occurrence instead of the original year',()=>{
  assert.equal(shouldCelebrate(day({date:'2020-10-02',repeat:'yearly'}),'2026-10-02',null),true);
  assert.equal(shouldCelebrate(day({date:'2020-10-02',repeat:'yearly'}),'2026-10-03',null),false);
  assert.equal(shouldCelebrate(day({date:'2028-10-02',repeat:'yearly'}),'2026-10-02',null),false);
});
test('lunar yearly and February leap fallback use the existing domain occurrence',()=>{
  assert.equal(shouldCelebrate(day({date:'2024-02-10',repeat:'yearly',calendar:'lunar'}),'2026-02-17',null),true);
  assert.equal(shouldCelebrate(day({date:'2024-02-29',repeat:'yearly'}),'2027-02-28',null),true);
});
test('the pure predicate never mutates the record or adds transient marker data',()=>{
  const featured = Object.freeze(day());
  const before = JSON.stringify(featured);
  assert.equal(shouldCelebrate(featured,'2026-10-02',null),true);
  assert.equal(JSON.stringify(featured),before);
});
