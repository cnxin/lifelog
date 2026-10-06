const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {geometryDiff,renderDiff}=require('./baseline-diff.cjs');
test('baseline diff pairs unchanged controls when a toolbar control is inserted',()=>{
  const button={tag:'BUTTON',role:null,className:'primary',label:'保存',rect:{x:8,y:10,width:44,height:44}};
  const added={...button,className:'calendar-mode',label:'农历'};
  const diff=geometryDiff([button],[added,button]);
  assert.equal(diff.length,1);
  assert.match(diff[0],/calendar-mode/);
  assert.match(diff[0],/before: null/);
});
test('baseline diff reports DOM context, selector property values and exact coordinates',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'baseline-diff-test-'));
  try{
    const before={html:'<section><p>a</p><p>b</p><p>c</p><p>old</p><p>d</p><p>e</p><p>f</p></section>',
      styles:{'.card-date':[{color:'red'}]},clickable:[{tag:'BUTTON',role:null,className:'test',label:'go',rect:{x:1,y:2}}]};
    const after={html:before.html.replace('old','new'),styles:{'.card-date':[{color:'green'}]},
      clickable:[{...before.clickable[0],rect:{x:1,y:3}}]};
    const diff=await renderDiff(before,after,directory);
    assert.match(diff,/ <p>a<\/p>\n <p>b<\/p>\n <p>c<\/p>/);
    assert.match(diff,/#### `\.card-date`\n- \[1\] color: "red" → "green"/);
    assert.match(diff,/before: {"x":1,"y":2}\n  - after: {"x":1,"y":3}/);
    assert.equal(await renderDiff(before,before,directory),'No differences.');
  }finally{await fs.rm(directory,{recursive:true,force:true});}
});
test('element-keyed style report does not mislabel an existing input after radio insertion',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'baseline-diff-test-'));
  try{
    const oldInput={color:'green'},newRadio={color:'black'};
    const before={html:'same',styles:{input:[oldInput]},clickable:[]},
      after={html:'same',styles:{input:[newRadio,oldInput]},clickable:[]};
    const metadata={before:{styles:{input:['existing']},clickable:[]},after:{styles:{input:['calendar-radio','existing']},clickable:[]}};
    const diff=await renderDiff(before,after,directory,metadata);
    assert.match(diff,/calendar-radio #1\] color: null → "black"/);
    assert.doesNotMatch(diff,/existing/);
  }finally{await fs.rm(directory,{recursive:true,force:true});}
});
