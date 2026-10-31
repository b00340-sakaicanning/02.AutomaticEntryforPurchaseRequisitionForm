#!/usr/bin/env node
/**
 * local_preview.html を生成する（K-43。plan/05 §9）
 *
 *   node tools/build_local_preview.js
 *
 * gas_app/index.html の include を css.html・js.html の中身に置き換え、
 * js.html の直前に「GAS のフェイク＋本物の Code.gs / Tests.gs＋モック」を差し込む。
 * 画面の見た目や表示内容を変えたら、必ず作り直す（CLAUDE.md）。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const index = read('gas_app/index.html');
const css = read('gas_app/css.html');
const js = read('gas_app/js.html');
const code = read('gas_app/Code.gs');
const tests = read('gas_app/Tests.gs');
const fakes = read('tools/gas_fakes.js');
const mock = read('tools/preview_mock.js');

for (const [name, src] of [['Code.gs', code], ['Tests.gs', tests]]) {
  if (/<\/script/i.test(src)) throw new Error(name + ' に </script が含まれています');
}

const names = Array.from(new Set(Array.from((code + '\n' + tests).matchAll(/^function\s+([A-Za-z0-9_$]+)\s*\(/gm)).map((m) => m[1])));

const gasScript = [
  '<script>',
  fakes,
  '</script>',
  '<script>',
  'window.__GAS__ = (function () {',
  "  var __fakes = createGasFakes({ spreadsheetName: '物品購入届DB_開発（プレビュー）', log: function (m) { console.log('[GAS] ' + m); } });",
  '  var Utilities = __fakes.Utilities, SpreadsheetApp = __fakes.SpreadsheetApp, DriveApp = __fakes.DriveApp, CacheService = __fakes.CacheService,',
  '      LockService = __fakes.LockService, Session = __fakes.Session, ScriptApp = __fakes.ScriptApp, HtmlService = __fakes.HtmlService, Logger = __fakes.Logger;',
  '  // ===== gas_app/Code.gs =====',
  code,
  '  // ===== gas_app/Tests.gs =====',
  tests,
  '  return { fakes: __fakes, fns: { ' + names.map((n) => n + ': ' + n).join(', ') + ' } };',
  '})();',
  '</script>',
  '<script>',
  mock,
  '</script>'
].join('\n');

const banner = [
  '<style>',
  '  body { padding-top: 46px; }',
  '  .preview-banner { position: fixed; top: 0; left: 0; right: 0; z-index: 4000; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;',
  '    padding: 0.4rem 0.9rem; background: #1e293b; color: #e2e8f0; font-size: 0.78rem; min-height: 46px; }',
  '  .preview-banner .pv-badge { background: #0284c7; color: #fff; font-weight: 800; letter-spacing: 0.05em; padding: 0.2rem 0.55rem; border-radius: 6px; font-family: Outfit, sans-serif; }',
  '  .preview-banner button { background: #334155; color: #f8fafc; border: 1px solid #475569; border-radius: 6px; height: 28px; padding: 0 0.6rem; font-size: 0.75rem; cursor: pointer; font-family: inherit; }',
  '  .preview-banner button:hover { background: #475569; }',
  '  .preview-banner .pv-note { color: #94a3b8; }',
  '  @media (max-width: 640px) { body { padding-top: 92px; } .preview-banner .pv-note { display: none; } }',
  '</style>',
  '<div class="preview-banner">',
  '  <span class="pv-badge">LOCAL MOCK PREVIEW</span>',
  '  <span class="pv-note">架空のデータで本物の Code.gs を動かしています。暗証番号は 123456。データはこのブラウザに保存されます。</span>',
  '  <span style="flex:1"></span>',
  '  <span>操作者:</span>',
  '  <button type="button" onclick="mockSwitch(\'nyuryoku\')">入力者（山田）</button>',
  '  <button type="button" onclick="mockSwitch(\'kacho\')">承認者（佐藤）</button>',
  '  <button type="button" onclick="mockSwitch(\'admin\')">管理者（高橋）</button>',
  '  <button type="button" onclick="mockSwitch(\'keiri\')">経理（田中）</button>',
  '  <button type="button" onclick="mockReset()">データ初期化</button>',
  '</div>',
  '<script>',
  '  (function () {',
  '    function fit() { var b = document.querySelector(".preview-banner"); if (b) document.body.style.paddingTop = b.offsetHeight + "px"; }',
  '    window.addEventListener("resize", fit); document.addEventListener("DOMContentLoaded", fit); fit();',
  '  })();',
  '</script>'
].join('\n');

let html = index;
const replaceOnce = (pattern, replacement, label) => {
  if (!pattern.test(html)) throw new Error('index.html に ' + label + ' が見つかりません');
  html = html.replace(pattern, () => replacement);
};
replaceOnce(/<\?!=\s*include\('css'\);?\s*\?>/, css, "include('css')");
replaceOnce(/<\?!=\s*include\('js'\);?\s*\?>/, gasScript + '\n' + js, "include('js')");
replaceOnce(/<body>/, '<body>\n' + banner, '<body>');
if (/<\?/.test(html)) throw new Error('置き換えていないテンプレートの式が残っています');
html = html.replace('<title>物品購入届</title>', '<title>物品購入届（ローカルプレビュー）</title>');
html = html.replace(/^<!DOCTYPE html>/i, '<!DOCTYPE html>\n<!-- 自動生成: node tools/build_local_preview.js（直接編集しない） -->');

const out = path.join(ROOT, 'local_preview.html');
fs.writeFileSync(out, html);
console.log('生成しました: ' + path.relative(ROOT, out) + '（' + Math.round(html.length / 1024) + 'KB、サーバー関数 ' + names.length + '個）');
