/* ============================================================
   操作のつながりの検査
   ------------------------------------------------------------
   「押しても何も起きないボタン」「行き先のない画面リンク」を探します。
   この種の不具合は例外を出さないため、ほかの検査は素通りしてしまいます。
   （ボタンの名札 data-act が、登録先 ACTIONS に無い状態）
   ============================================================ */
var createApp = require('./dom.js').createApp;

var ng = 0, checked = 0;
function ok(m){ console.log('  OK   ' + m); }
function fail(m){ ng++; console.log('  NG   ' + m); }
function note(m){ console.log('       ' + m); }

var app = createApp({ quiet:true });
var ctx = app.ctx;
var bad = [], seenAct = {};

/* データの状態で出るボタンが変わるので、空とサンプルの両方で見る */
var states = [
  { name:'空データ',   prep:function(){ ctx.DB.data = ctx.emptyData(); } },
  { name:'サンプル',   prep:function(){ ctx.buildDemoData(); } }
];

console.log('■ 押しても何も起きないボタン・行き先のないリンク');

states.forEach(function(st){
  st.prep();
  Object.keys(ctx.VIEWS).forEach(function(v){
    if(!ctx.VIEWS[v] || typeof ctx.VIEWS[v].render !== 'function') return;
    var root;
    try { root = app.render(v); } catch(e){ bad.push(st.name + '/' + v + ' の描画で例外: ' + e.message); return; }

    /* ① ボタンの名札に、対応する動きが登録されているか */
    root.querySelectorAll('[data-act]').forEach(function(el){
      var act = el.getAttribute('data-act');
      checked++;
      seenAct[act] = true;
      if(typeof ctx.ACTIONS[act] !== 'function'){
        bad.push(v + ' の「' + String(el.textContent||'').slice(0,14) + '」は押しても何も起きない（未登録: ' + act + '）');
      }
    });

    /* ② 画面を切り替えるリンクの行き先が実在するか */
    root.querySelectorAll('[data-go]').forEach(function(el){
      var go = String(el.getAttribute('data-go') || '').split(':')[0];
      checked++;
      if(go && !ctx.VIEWS[go]){
        bad.push(v + ' の「' + String(el.textContent||'').slice(0,14) + '」の行き先が無い画面（' + go + '）');
      }
    });

    /* ③ 昔ながらの onclick= が残っていないか（イベント委譲に統一しているため） */
    root.querySelectorAll('[onclick]').forEach(function(el){
      checked++;
      bad.push(v + ' に onclick が直接書かれている（' + el.tagName + '）');
    });
  });
});

if(bad.length){
  var uniq = bad.filter(function(x,i){ return bad.indexOf(x) === i; });
  uniq.slice(0,12).forEach(fail);
  if(uniq.length > 12) note('…ほか ' + (uniq.length-12) + '件');
} else {
  ok(checked + '個の操作すべてに、対応する動きが登録されている');
  /* 参考情報：登録したのに、どの画面にも出てこない操作（消し忘れ） */
  var unused = Object.keys(ctx.ACTIONS).filter(function(a){ return !seenAct[a]; });
  if(unused.length){
    note('（参考）画面に出てこない操作が ' + unused.length + '件');
    note('  ' + unused.slice(0,8).join(', ') + (unused.length > 8 ? ' ほか' : ''));
    note('  ふきだしの中だけで使う操作は、ここに出るのが正常です');
  }
}

console.log('\n================================');
console.log(ng ? '見つかった問題: ' + ng + '件' : '調べた操作: ' + checked + '個、すべて問題なし');
process.exit(ng ? 1 : 0);
