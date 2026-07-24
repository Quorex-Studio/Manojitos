// Find files that USE reicon icons but have NO import from reicon-react
const fs = require('fs');
const path = require('path');

const reiconContent = fs.readFileSync('node_modules/reicon-react/index.js', 'utf8');
const exportedIcons = new Set([...reiconContent.matchAll(/exports\.(\w+)\s*=/g)].map(m => m[1]).filter(n => /^[A-Z]/.test(n)));

function scanDir(dir) {
  const r = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) r.push(...scanDir(full));
    else if (f.endsWith('.tsx') || f.endsWith('.ts')) r.push(full);
  }
  return r;
}

const files = scanDir('src');

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const hasReiconImport = /from\s*['"]reicon-react['"]/.test(src);
  if (hasReiconImport) continue;

  // Check if it uses JSX that looks like icons
  const jsxMatches = [...src.matchAll(/<([A-Z][A-Za-z0-9]+)\s/g)].map(m => m[1]).filter(n => exportedIcons.has(n));
  // Check icon: patterns
  const iconObjMatches = [...src.matchAll(/icon:\s*([A-Z][A-Za-z0-9]+)/g)].map(m => m[1]).filter(n => exportedIcons.has(n));
  const all = [...new Set([...jsxMatches, ...iconObjMatches])];
  
  if (all.length > 0) {
    console.log(`FILE (no reicon import): ${file}`);
    console.log(`  Uses: ${all.join(', ')}`);
  }
}
console.log('Done');
