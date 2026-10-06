// Read-only report. The baseline comparator and normalization live in baseline.cjs.
const { chromium, assert } = require('./lib/browser.cjs');
const { snapshot, differences, seed, openState, states, viewports } = require('./baseline.cjs');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { isDeepStrictEqual } = require('node:util');

function domSelectors({before,after}) {
  const parser=new DOMParser(), left=parser.parseFromString(before,'text/html').body,
    right=parser.parseFromString(after,'text/html').body, changed=new Set();
  const signature=node=>node.nodeType===1 ? node.tagName+'|'+(node.id || node.classList[0] || '') : '#'+node.nodeType;
  const selector=node=>{
    if(node.nodeType!==1) node=node.parentElement;
    const parts=[];
    for(let el=node;el&&el.tagName!=='BODY';el=el.parentElement){
      parts.unshift(el.id ? '#'+el.id : el.tagName.toLowerCase()+(el.classList.length ? '.'+[...el.classList].join('.') : ''));
      if(el.classList.length || el.id) break;
    }
    return parts.join(' > ') || 'body';
  };
  function visit(a,b){
    if(a.isEqualNode(b))return;
    if(a.nodeType!==1 || b.nodeType!==1){changed.add(selector(b));return;}
    if(JSON.stringify([...a.attributes].map(x=>[x.name,x.value]))!==JSON.stringify([...b.attributes].map(x=>[x.name,x.value])))
      changed.add(selector(b));
    const x=[...a.childNodes],y=[...b.childNodes];let i=0,j=0;
    while(i<x.length || j<y.length){
      if(!x[i]){changed.add(selector(y[j++]));continue;}
      if(!y[j]){changed.add(selector(x[i++]));continue;}
      if(signature(x[i])===signature(y[j])){visit(x[i++],y[j++]);continue;}
      if(y.slice(j+1).some(n=>signature(n)===signature(x[i]))){changed.add(selector(y[j++]));continue;}
      if(x.slice(i+1).some(n=>signature(n)===signature(y[j]))){changed.add(selector(x[i++]));continue;}
      changed.add(selector(x[i++]));changed.add(selector(y[j++]));
    }
  }
  visit(left,right);return [...changed];
}

function geometryDiff(expected, actual) {
  // Pair by exact element metadata plus occurrence, not global array index:
  // adding a toolbar button must not manufacture changes to every later button.
  const group = items => {
    const result = new Map();
    for (const item of items) {
      const key = JSON.stringify([item.tag, item.role, item.className, item.label]);
      if (!result.has(key)) result.set(key, []);
      result.get(key).push(item.rect);
    }
    return result;
  };
  const before = group(expected), after = group(actual), lines = [];
  for (const key of new Set([...before.keys(), ...after.keys()])) {
    const [tag, role, className, label] = JSON.parse(key);
    const old = before.get(key) || [], next = after.get(key) || [];
    for (let i = 0; i < Math.max(old.length, next.length); i++) {
      if (isDeepStrictEqual(old[i], next[i])) continue;
      lines.push(`- ${tag}${className ? '.' + className.split(' ').join('.') : ''}` +
        `${role ? ' [role="' + role + '"]' : ''} #${i + 1} ${JSON.stringify(label)}\n` +
        `  - before: ${JSON.stringify(old[i] ?? null)}\n  - after: ${JSON.stringify(next[i] ?? null)}`);
    }
  }
  return lines;
}

async function renderDiff(expected, actual, directory) {
  const lines = [];
  if (expected.html !== actual.html) {
    // Formatting is for the report only; exact HTML comparison remains unchanged.
    const pretty = html => html.replace(/></g, '>\n<') + '\n';
    const before = path.join(directory, 'before.html'), after = path.join(directory, 'after.html');
    await fs.writeFile(before, pretty(expected.html));
    await fs.writeFile(after, pretty(actual.html));
    const diff = spawnSync('git', ['diff', '--no-index', '--no-ext-diff', '--no-color', '--unified=3', before, after], { encoding:'utf8' });
    if (diff.error || ![0,1].includes(diff.status)) throw diff.error || new Error(diff.stderr);
    const hunks = diff.stdout.slice(diff.stdout.indexOf('@@'));
    lines.push('### DOM (3 context lines per hunk)', '```diff', hunks.trimEnd(), '```');
  }
  const styleLines = [];
  for (const selector of new Set([...Object.keys(expected.styles), ...Object.keys(actual.styles)])) {
    const old = expected.styles[selector] || [], next = actual.styles[selector] || [];
    const changes = [];
    for (let i=0; i<Math.max(old.length,next.length); i++) {
      for (const property of new Set([...Object.keys(old[i] || {}), ...Object.keys(next[i] || {})])) {
        if (old[i]?.[property] !== next[i]?.[property])
          changes.push(`- [${i + 1}] ${property}: ${JSON.stringify(old[i]?.[property] ?? null)} → ${JSON.stringify(next[i]?.[property] ?? null)}`);
      }
    }
    if (changes.length) styleLines.push(`#### \`${selector}\``, ...changes);
  }
  if (styleLines.length) lines.push('### Computed styles by selector', ...styleLines);
  const geometry = geometryDiff(expected.clickable, actual.clickable);
  if (geometry.length) lines.push('### Clickable geometry by element', ...geometry);
  if (!lines.length) lines.push('No differences.');
  return lines.join('\n');
}

async function runDiff(browser, { scheme='light', output='.artifacts/baseline-diff.md' }={}) {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'lifelog-baseline-diff-'));
  const report = [`# Baseline diff (${scheme})`, '',
    'Read-only comparison with the current committed baseline. No capture, exclusions or normalization changes.', '',
    'The unchanged comparator determines exact differences; DOM formatting only adds line breaks for this report.', ''];
  let changed=0;
  try {
    for (const viewport of viewports) for (const state of states) {
      const context = await browser.newContext({ viewport, timezoneId:'Asia/Shanghai', reducedMotion:'reduce', colorScheme:scheme });
      try {
        const page = await context.newPage(), errors=[];
        page.on('pageerror', e=>errors.push(e.message));
        await page.clock.setFixedTime(new Date('2026-10-05T12:00:00+08:00'));
        await seed(page);
        await openState(page,state);
        const actual = await snapshot(page);
        assert.deepEqual(errors, [], `${state} browser errors`);
        const name=`${viewport.width}x${viewport.height}-${state}`;
        const expected=JSON.parse(await fs.readFile(path.join('.artifacts/baseline',scheme,name+'.json'),'utf8'));
        if (differences(expected,actual).length) changed++;
        const dom=expected.html===actual.html ? [] : await page.evaluate(domSelectors,{before:expected.html,after:actual.html});
        report.push(`## ${name}`, ...(dom.length ? ['DOM selectors: '+dom.map(s=>'`'+s+'`').join(', ')] : []),
          await renderDiff(expected,actual,temporary), '');
      } finally { await context.close(); }
    }
    report.push(`Changed snapshots: ${changed}/${viewports.length * states.length}.`, '');
    await fs.mkdir(path.dirname(output), { recursive:true });
    await fs.writeFile(output, report.join('\n'));
    console.log(`Baseline diff: ${changed} changed snapshots; report ${path.resolve(output)}. Baseline not modified.`);
    return changed;
  } finally { await fs.rm(temporary, { recursive:true, force:true }); }
}
exports.geometryDiff=geometryDiff;
exports.renderDiff=renderDiff;
exports.runDiff=runDiff;
if (require.main === module) (async()=>{
  const browser=await chromium.launch();
  try { await runDiff(browser, { scheme: process.argv.includes('--scheme') ? process.argv[process.argv.indexOf('--scheme')+1] : 'light' }); }
  finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
