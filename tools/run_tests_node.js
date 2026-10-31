#!/usr/bin/env node
/**
 * Code.gs / Tests.gs をローカルの Node.js で検証する（K-49）
 *
 *   node tools/run_tests_node.js          … pure テスト＋フェイク上の結合テスト（reference のマスタCSVを取り込む）
 *   node tools/run_tests_node.js --pure   … pure テストだけ
 *
 * GAS のサービスは tools/gas_fakes.js のフェイクで代用する。
 * Shift_JIS・ドライブ・ロック・トリガーの実際の動きは、GAS の開発環境で確認すること。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createGasFakes } = require('./gas_fakes.js');

const ROOT = path.resolve(__dirname, '..');
const pureOnly = process.argv.includes('--pure');
const verbose = process.argv.includes('--verbose');

const fakes = createGasFakes({ spreadsheetName: '物品購入届DB_開発', log: verbose ? (m) => console.log('  ' + m) : () => {} });
const sandbox = Object.assign({ console: console, TextEncoder: TextEncoder, TextDecoder: TextDecoder }, fakes);
delete sandbox.helpers;
const context = vm.createContext(sandbox);
for (const f of ['gas_app/Code.gs', 'gas_app/Tests.gs']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), context, { filename: f });
}
const run = (code) => vm.runInContext(code, context);

function section(title) { console.log('\n=== ' + title + ' ==='); }

let failed = 0;
section('pure テスト');
const pure = run('runAllTests({pureOnly: true})');
failed += pure.failed;

if (!pureOnly) {
  section('初期セットアップ（フェイク）');
  run('menuSetup()');
  console.log(fakes.helpers.uiLog.slice(-1)[0]);

  section('マスタ取込（reference/各種マスタ のCSV）');
  const importFolderId = run("resetExecutionCache_(); getSetting('IMPORT_FOLDER_ID')");
  const srcDir = path.join(ROOT, 'reference', '各種マスタ');
  for (const name of ['資材マスター.csv', '取引先マスター.csv', '365User.csv']) {
    const p = path.join(srcDir, name);
    if (!fs.existsSync(p)) { console.log('  見つかりません: ' + p); continue; }
    fakes.helpers.addFile(importFolderId, name, new Uint8Array(fs.readFileSync(p)));
  }
  const results = run("resetExecutionCache_(); importMasters('ALL', '')");
  results.forEach((r) => console.log(`  ${r.target}: ${r.rows}件（追加 ${r.inserted} / 更新 ${r.updated} / 無効化 ${r.disabled}）`));

  section('開発用サンプルデータ投入');
  console.log(run('seedDevData()'));

  section('全テスト（フェイク上）');
  const all = run('runAllTests()');
  failed = all.failed;
}

console.log('\n' + (failed ? `NG が ${failed} 件あります` : 'すべて OK です'));
process.exit(failed ? 1 : 0);
