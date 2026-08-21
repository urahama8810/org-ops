/* ============================================================
   すべての検査をまとめて実行する
   使い方:  node test/all.js
   1つでも失敗したら終了コード 1 で止まる（ビルドも止まる）
   ============================================================ */
var cp = require('child_process');
var path = require('path');

var TESTS = [
  { file:'render-test.js', name:'画面の描画・保存の検査' },
  { file:'player-test.js', name:'動画マニュアルの検査' },
  { file:'server-test.js', name:'共有サーバーの検査' },
  { file:'wiring-test.js', name:'操作のつながりの検査（無反応のボタンを探す）' },
  { file:'dataloss-test.js', name:'記録が減らないかの検査（データ消失を防ぐ）' },
  { file:'roundtrip-test.js', name:'往復の検査（入れた値が本当に保存されるか）' },
  { file:'sweep.js',       name:'総当たり検査（全画面×全データ×全ボタン）' }
];

var failed = [];
console.log('================================');
console.log(' 検査をまとめて実行します');
console.log('================================');

TESTS.forEach(function(t){
  var p = path.join(__dirname, t.file);
  var r = cp.spawnSync(process.execPath, [p], { encoding:'utf8' });
  var out = (r.stdout || '') + (r.stderr || '');
  if(r.status === 0){
    console.log('\n[OK] ' + t.name);
  } else {
    console.log('\n[NG] ' + t.name + '  ← ここで問題が見つかりました');
    console.log(out);
    failed.push(t.name);
  }
});

console.log('\n================================');
if(failed.length){
  console.log('  ' + failed.length + '件の検査で問題が見つかりました');
  failed.forEach(function(n){ console.log('   ・' + n); });
  console.log('  直してから、もう一度実行してください');
  process.exit(1);
} else {
  console.log('  すべての検査に合格しました');
  process.exit(0);
}
