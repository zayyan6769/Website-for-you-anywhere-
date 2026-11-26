// Bundles src/intro3d.js (plus the parts of Three.js it uses) into one minified script
// and inlines it into index.html, so the 3D walk-in works without downloading anything.
// Usage: npm install && npm run build
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

const START = '<!-- intro3d:start (built by tools/build-intro.mjs, do not edit) -->';
const END = '<!-- intro3d:end -->';

const out = await build({
  entryPoints: ['src/intro3d.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2019'],
  legalComments: 'none',
  write: false
});
// Keep "</script" from closing the inline tag early.
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const block = `${START}\n<script>\n/* Three.js r160 © three.js authors, MIT License: https://github.com/mrdoob/three.js */\n${js}</script>\n${END}`;

const html = readFileSync('index.html', 'utf8');
const a = html.indexOf(START), b = html.indexOf(END);
if (a < 0 || b < 0) throw new Error('intro3d markers not found in index.html');
writeFileSync('index.html', html.slice(0, a) + block + html.slice(b + END.length));
console.log(`Inlined 3D intro: ${(js.length / 1024).toFixed(0)} KB`);
