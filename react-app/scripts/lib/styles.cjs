const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');

// Expand every import at its original position, including nested continuations.
// No token-only shortcut: cross-file assertions receive the entire ordered text.
function readStyles(file, ancestry = []) {
  const absolute = path.resolve(root, file);
  if (ancestry.includes(absolute)) throw new Error('Cyclic CSS import: ' + [...ancestry, absolute].join(' -> '));
  return fs.readFileSync(absolute, 'utf8').replace(/@import\s+(?:url\()?['"]([^'"]+)['"]\)?\s*;/g, (_, imported) => {
    if (/^(?:https?:|\/\/|data:)/.test(imported)) throw new Error('Unexpected remote CSS import: ' + imported);
    return readStyles(path.resolve(path.dirname(absolute), imported), [...ancestry, absolute]);
  });
}

exports.readStyles = readStyles;
