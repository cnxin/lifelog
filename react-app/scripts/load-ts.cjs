const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
exports.loadTs = function loadTs(file, mocks = {}, cache = new Map()) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
  }}).outputText;
  const localRequire = name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('.')
    ? loadTs(path.resolve(path.dirname(file), name + (path.extname(name) ? '' : '.ts')), mocks, cache)
    : require(name);
  new Function('require', 'exports', 'module', code)(localRequire, mod.exports, mod);
  return mod.exports;
};
