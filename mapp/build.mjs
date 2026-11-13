import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pack } from './vendor/pack.mjs';
import { configureManifest } from './config.mjs';

if (!process.versions.bun) throw new Error('请使用 bun mapp/build.mjs');
const root = new URL('../', import.meta.url);
const manifest = configureManifest(JSON.parse(await readFile(new URL('mapp/manifest.template.json', root), 'utf8')), {
  publicOrigin: process.env.PUBLIC_ORIGIN,
});
const project = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
manifest.version = project.version;
const result = await Bun.build({
  entrypoints: [fileURLToPath(new URL('mapp/entry.mjs', root))],
  target: 'browser', format: 'iife', minify: true, sourcemap: 'none',
  env: 'disable', macros: false,
});
if (!result.success) throw new AggregateError(result.logs, '平台包构建失败');
const script = result.outputs.find(file => file.path.endsWith('.js'));
const style = result.outputs.find(file => file.path.endsWith('.css'));
if (!script || !style || result.outputs.length !== 2) throw new Error('预期单个 JS 和 CSS 文件');
const output = await pack({
  outputDirectory: fileURLToPath(new URL('dist/mapp-package/', root)),
  manifest,
  files: {
    'index.html': Buffer.from('<div id="app"><p>正在载入小站…</p></div>'),
    'app.js': Buffer.from(await script.arrayBuffer()),
    'app.css': Buffer.from(await style.arrayBuffer()),
    'strings.json': Buffer.from('{}'),
    'assets/community-sharing-day-v2.png': await readFile(new URL('public/assets/community-sharing-day-v2.png', root)),
  },
});
console.log(`App ZIP: ${output.file} (${output.size} bytes), SHA-256 ${output.zipSha256}`);
console.log('同一运行包用于沙箱与正式版。');
