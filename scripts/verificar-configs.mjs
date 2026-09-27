// Candado contra el malware de `postcss.config.js` (docs/SEGURIDAD-2026-09-incidente-postcss.md).
// Corre ANTES de `vite` (npm lo llama solo por `predev` y `prebuild`): si algún archivo de
// configuración que Vite/Node carga al compilar trae código ofuscado, corta el proceso y así ni
// tu computadora ni Vercel lo ejecutan. No importa nada del proyecto: solo lee texto.
import fs from 'node:fs';

const FILES = [
  'postcss.config.js', 'postcss.config.cjs', 'postcss.config.mjs',
  'tailwind.config.ts', 'tailwind.config.js', 'vite.config.ts', 'vite.config.js',
  'eslint.config.js', 'vitest.config.ts', 'index.html',
];
const SIGNS = [/A8-1359/, /global\s*\[\s*['"]_V['"]\s*\]/, /166\.88\.134\.75/, /_0x[0-9a-f]{4,}\s*\(/i, /child_process/, /\beval\s*\(/];
const problems = [];

for (const file of FILES) {
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, 'utf8');
  const long = text.split('\n').findIndex(l => l.length > 1000);
  if (long >= 0) problems.push(`${file}: la línea ${long + 1} tiene ${text.split('\n')[long].length} caracteres (código escondido detrás de espacios)`);
  const hit = SIGNS.find(re => re.test(text));
  if (hit) problems.push(`${file}: contiene ${hit} (firma del malware)`);
}
// postcss.config.js limpio pesa 81 bytes; con malware, ~32 KB
if (fs.existsSync('postcss.config.js') && fs.statSync('postcss.config.js').size > 1024) {
  problems.push(`postcss.config.js pesa ${fs.statSync('postcss.config.js').size} bytes (limpio: 81)`);
}

if (problems.length) {
  console.error('\n⛔ ALTO: archivo de configuración infectado. No se compila.\n');
  [...new Set(problems)].forEach(p => console.error('  • ' + p));
  console.error('\nRestaura el archivo limpio (git show origin/main:postcss.config.js > postcss.config.js),');
  console.error('revisa la computadora desde donde se hizo el commit y lee docs/SEGURIDAD-2026-09-incidente-postcss.md.\n');
  process.exit(1);
}
