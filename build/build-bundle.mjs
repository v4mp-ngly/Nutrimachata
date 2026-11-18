#!/usr/bin/env node
// NutriMachata · generador de bundles (v131)
// Uso:   node build/build-bundle.mjs           -> regenera js/app.bundle.js y css/app.bundle.css
//        node build/build-bundle.mjs --check   -> solo verifica que los bundles coinciden con las fuentes
// Sin dependencias externas. Las correcciones se hacen SIEMPRE en js/NN-*.js y css/NN-*.css;
// nunca editar los bundles a mano.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'build', 'bundle.config.json'), 'utf8'));
const check = process.argv.includes('--check');

function read(rel) {
  const f = path.join(root, rel);
  if (!fs.existsSync(f)) throw new Error('Falta el archivo fuente: ' + rel);
  return fs.readFileSync(f, 'utf8');
}

// JS: cada módulo se ejecutaba antes como <script> independiente; un error de arranque en uno no
// detenía a los demás. En un solo archivo eso ya no es así, por eso los módulos auto-contenidos
// (IIFE o asignaciones) se aíslan con try/catch. Los módulos con declaraciones globales
// (const/let/function de nivel superior) NO se envuelven, para no cambiar su alcance.
function buildJs() {
  let out = '';
  for (const name of cfg.js) {
    const src = read('js/' + name);
    const isolate = !cfg.jsNoIsolate.includes(name);
    out += `\n/* ===== ${name} ===== */\n`;
    out += isolate
      ? `try{\n${src.replace(/\n?$/, '\n')}}catch(nmModuleError){console.error('[NutriMachata] El módulo ${name} no pudo iniciar:',nmModuleError);}\n`
      : src;
    out += '\n';
  }
  return out;
}
function buildCss() {
  return cfg.css.map(name => `\n/* ===== SOURCE: css/${name} ===== */\n${read('css/' + name)}\n`).join('');
}

const outputs = [['js/app.bundle.js', buildJs()], ['css/app.bundle.css', buildCss()]];
let stale = 0;
for (const [rel, content] of outputs) {
  const f = path.join(root, rel);
  const current = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
  if (check) {
    const ok = current === content;
    if (!ok) stale++;
    console.log(`${ok ? 'OK   ' : 'DESACTUALIZADO'} ${rel}`);
  } else {
    fs.writeFileSync(f, content);
    console.log(`Generado ${rel} (${Buffer.byteLength(content)} bytes)`);
  }
}
// Archivos .js/.css numerados que no están en la configuración (posible olvido).
const listed = new Set([...cfg.js.map(n => 'js/' + n), ...cfg.css.map(n => 'css/' + n), ...(cfg.notBundled || []).map(n => n)]);
for (const dir of ['js', 'css']) {
  for (const n of fs.readdirSync(path.join(root, dir))) {
    if (/^\d+.*\.(js|css)$/.test(n) && !listed.has(dir + '/' + n)) console.warn(`AVISO: ${dir}/${n} no está en build/bundle.config.json`);
  }
}
if (check && stale) { console.error('Ejecuta: node build/build-bundle.mjs'); process.exit(1); }
