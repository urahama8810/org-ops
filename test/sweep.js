/* ============================================================
   test/sweep.js  総当たり検査
   ------------------------------------------------------------
   「思いついた観点をテストにする」やり方をやめ、
   機械的に全部の組み合わせを試す。

     1. 全画面 × 全データ状態を描く
     2. 画面に出ている全ボタンを実際に押す
     3. 開いたふきだしの保存ボタンまで押し、値が壊れないか見る
     4. 全項目に細工した文字を入れて、画面が壊れないか見る
     5. 計算関数に境界値を総当たりする
     6. タグの対応・重複IDを調べる

   使い方:  node test/sweep.js
   ============================================================ */
var path = require('path');
var { createApp } = require('./dom.js');

var ng = 0, checks = 0, combos = 0;
function fail(msg){ ng++; console.log('  NG   ' + msg); }
function ok(msg){ checks++; console.log('  OK   ' + msg); }
function note(msg){ console.log('       ' + msg); }

/* ---------- データ状態のパターン ---------- */
function makeStates(ctx){
  var DB = ctx.DB;
  return [
    ['何もない', function(){ DB.data = ctx.emptyData(); ctx.setMyEmpId(''); }],
    ['サンプル', function(){ ctx.buildDemoData(); }],
    ['社員1名だけ', function(){
      DB.data = ctx.emptyData();
      DB.data.employees.push({ id:'emp_x', name:'テスト太郎' });
    }],
    ['全項目が空文字', function(){
      ctx.buildDemoData();
      eachRecord(DB.data, function(o){
        Object.keys(o).forEach(function(k){ if(k !== 'id' && typeof o[k] === 'string') o[k] = ''; });
      });
    }],
    ['全項目が null', function(){
      ctx.buildDemoData();
      eachRecord(DB.data, function(o){
        Object.keys(o).forEach(function(k){ if(k !== 'id') o[k] = null; });
      });
      ctx.normalizeData(DB.data);
    }],
    ['数値が0', function(){
      ctx.buildDemoData();
      eachRecord(DB.data, function(o){
        Object.keys(o).forEach(function(k){ if(typeof o[k] === 'number') o[k] = 0; });
      });
    }],
    ['数値が負', function(){
      ctx.buildDemoData();
      eachRecord(DB.data, function(o){
        Object.keys(o).forEach(function(k){ if(typeof o[k] === 'number') o[k] = -1; });
      });
      ctx.normalizeData(DB.data);
    }],
    ['古い形式(v2)', function(){
      DB.data = ctx.mergeDefaults({
        meta:{ version:'2.0.0', updatedAt:new Date().toISOString() },
        settings:{ companyName:'旧データ社' },
        employees:[{ id:'emp_1', name:'旧 太郎', salary:'月給30万円', retentionRisk:'高い' }],
        decisions:[{ id:'dec_1', title:'旧い決定', kind:'people', emotion:2, stage:'holding' }]
      }, ctx.emptyData());
    }],
    ['社員100名', function(){
      DB.data = ctx.emptyData();
      for(var i=0;i<100;i++) DB.data.employees.push({ id:'emp_'+i, name:'社員'+i, dept:'部'+(i%5) });
    }]
  ];
}

function eachRecord(data, fn){
  Object.keys(data).forEach(function(k){
    var v = data[k];
    if(Array.isArray(v)) v.forEach(function(x){ if(x && typeof x === 'object') fn(x); });
    else if(v && typeof v === 'object' && k !== 'meta') fn(v);
  });
}

/* ---------- 1. 全画面 × 全データ状態 ---------- */
function sweepScreens(){
  console.log('■ 全画面 × 全データ状態');
  var app = createApp({ quiet:true });
  var ctx = app.ctx;
  var views = Object.keys(ctx.VIEWS).filter(function(k){
    return ctx.VIEWS[k] && typeof ctx.VIEWS[k].render === 'function';
  });
  var states = makeStates(ctx);
  var bad = [];
  states.forEach(function(pair){
    pair[1]();
    views.forEach(function(v){
      combos++;
      var h;
      try { h = ctx.VIEWS[v].render(); }
      catch(e){ bad.push(pair[0] + ' / ' + v + '（例外: ' + e.message + '）'); return; }
      if(typeof h !== 'string'){ bad.push(pair[0] + ' / ' + v + '（文字列でない）'); return; }
      if(h.length < 100){ bad.push(pair[0] + ' / ' + v + '（中身がほぼ空: ' + h.length + '文字）'); return; }
      ['undefined','NaN','[object Object]'].forEach(function(w){
        if(h.indexOf(w) >= 0){
          var at = h.indexOf(w);
          bad.push(pair[0] + ' / ' + v + '（' + w + ' が出る: …' +
                   h.slice(Math.max(0,at-40), at+20).replace(/\s+/g,' ') + '…）');
        }
      });
      /* タグの対応 */
      var open = (h.match(/<div\b/g)||[]).length, close = (h.match(/<\/div>/g)||[]).length;
      if(open !== close) bad.push(pair[0] + ' / ' + v + '（divの開閉が合わない: ' + open + ' 対 ' + close + '）');
    });
  });
  /* タブのある画面は全タブ分 */
  ctx.buildDemoData();
  [['reports','repTab',['rules','log','approval','incidents','exceptions','ありえない']],
   ['decisions','decTab',['decision','venture','rule','ありえない']],
   ['capital','capTab',['capital','partner','ありえない']],
   ['diagnosis','diagTab',['indicator','loop','check','structure','ありえない']]].forEach(function(t){
    t[2].forEach(function(tab){
      combos++;
      try {
        ctx.ACTIONS[t[1]]({ t:tab });
        var h = ctx.VIEWS[t[0]].render();
        if(!h || h.length < 100) bad.push(t[0] + ' のタブ「' + tab + '」で中身が消える');
      } catch(e){ bad.push(t[0] + ' のタブ「' + tab + '」で例外: ' + e.message); }
    });
  });
  if(bad.length){ bad.slice(0,10).forEach(fail); if(bad.length>10) note('…ほか ' + (bad.length-10) + '件'); }
  else ok(views.length + '画面 × ' + states.length + '状態 ＋ タブ全通り = ' + combos + '通り、すべて正常');
}

/* ---------- 2. 画面のボタンを全部押す ---------- */
function sweepButtons(){
  console.log('\n■ 画面に出ているボタンを、実際に全部押す');
  var app = createApp({ quiet:true });
  var ctx = app.ctx;
  var views = Object.keys(ctx.VIEWS).filter(function(k){
    return ctx.VIEWS[k] && typeof ctx.VIEWS[k].render === 'function';
  });
  var bad = [], pressed = 0;
  views.forEach(function(v){
    ctx.buildDemoData();
    var root;
    try { root = app.render(v); } catch(e){ bad.push(v + ' の描画で例外: ' + e.message); return; }
    var btns = root.querySelectorAll('[data-act]');
    btns.forEach(function(b){
      var act = b.getAttribute('data-act');
      if(act === 'dataClear' || act === 'gradeReset' || act === 'loadDemo') return;  /* 全消しは別で見る */
      pressed++;
      try {
        b.click();
        /* 開いたふきだしは閉じる */
        while(ctx._modalStack && ctx._modalStack.length) ctx.closeModal();
      } catch(e){
        bad.push(v + ' の「' + (b.textContent||act).slice(0,14) + '」（' + act + '）で例外: ' + e.message);
      }
    });
  });
  combos += pressed;
  if(bad.length){ bad.slice(0,10).forEach(fail); if(bad.length>10) note('…ほか ' + (bad.length-10) + '件'); }
  else ok(pressed + '個のボタンを押して、すべて正常');
}

/* ---------- 3. ふきだしを開いて保存まで ---------- */
function sweepModals(){
  console.log('\n■ ふきだしを開いて、保存ボタンまで押す');
  var app = createApp({ quiet:true });
  var ctx = app.ctx;
  var bad = [], opened = 0;

  /* 段階のあるものは、全段階で開く */
  var cases = [];
  ['self','manager','calibration','final','explained'].forEach(function(st){
    cases.push({ label:'評価シート('+st+')', prep:function(){
      ctx.buildDemoData();
      var ev = ctx.DB.data.evaluations[0]; ev.stage = st;
      return ['evalOpen', { id:ev.id }];
    }});
  });
  ['draft','holding','reviewed','decided','dropped'].forEach(function(st){
    cases.push({ label:'重要な決定('+st+')', prep:function(){
      ctx.buildDemoData();
      var r = ctx.DB.data.decisions[0]; r.stage = st;
      return ['decEdit', { id:r.id }];
    }});
  });
  ['open','done','failed','stopped'].forEach(function(st){
    cases.push({ label:'任せた仕事('+st+')', prep:function(){
      ctx.buildDemoData();
      var r = ctx.DB.data.delegations[0]; r.state = st;
      return ['dlgEdit', { id:r.id }];
    }});
  });
  ['draft','approved','running','closed','dropped'].forEach(function(st){
    cases.push({ label:'新しい取り組み('+st+')', prep:function(){
      ctx.buildDemoData();
      var r = ctx.DB.data.ventures[0]; r.stage = st;
      return ['venEdit', { id:r.id }];
    }});
  });
  /* 主要な追加・編集フォーム */
  [['社員の追加','empNew',{}], ['社員の編集','empEdit','emp'], ['目標の追加','goalNew',{}],
   ['1on1の記録','oooNew',{}], ['報告の登録','repNew',{}], ['仕事を渡す','dlgNew',{}],
   ['決定の登録','decNew',{}], ['企画書','venNew',{}], ['関係者','parNew',{}],
   ['お金のかんたん入力','capQuick',{}], ['改善計画','impNew',{}]
  ].forEach(function(c){
    cases.push({ label:c[0], prep:function(){
      ctx.buildDemoData();
      var ds = c[2] === 'emp' ? { id:ctx.DB.data.employees[0].id } : c[2];
      return [c[1], ds];
    }});
  });

  cases.forEach(function(c){
    var pair;
    try { pair = c.prep(); } catch(e){ bad.push(c.label + ' の準備で例外: ' + e.message); return; }
    opened++;
    var before = JSON.stringify(ctx.DB.data);
    try {
      ctx.ACTIONS[pair[0]](pair[1], app.doc.createElement('button'), { preventDefault:function(){} });
    } catch(e){ bad.push(c.label + ' を開くと例外: ' + e.message); return; }

    var modal = app.modal();
    if(!modal){ bad.push(c.label + ' がふきだしを開かない'); return; }

    /* 入力欄を埋める */
    modal.querySelectorAll('input,select,textarea').forEach(function(el){
      if(el.type === 'checkbox'){ el.checked = true; return; }
      if(el.tagName === 'SELECT'){
        var op = el.querySelectorAll('option');
        if(op.length > 1) el.value = op[1].getAttribute('value') || '';
        return;
      }
      if(el.type === 'number'){ el.value = '3'; return; }
      if(el.type === 'date'){ el.value = '2026-08-21'; return; }
      if(el.type === 'month'){ el.value = '2026-08'; return; }
      if(el.type === 'datetime-local'){ el.value = '2026-08-21T10:00'; return; }
      if(!el.value) el.value = 'テスト入力';
    });

    /* 保存ボタンを探して押す */
    var save = modal.querySelector('#mSave') || modal.querySelector('#evSave') ||
               modal.querySelector('.btn.primary');
    if(!save){ while(ctx._modalStack && ctx._modalStack.length) ctx.closeModal(); return; }
    try { save.click(); }
    catch(e){ bad.push(c.label + ' の保存で例外: ' + e.message); }

    /* 保存後にデータが壊れていないか */
    try {
      var after = ctx.DB.data;
      if(!after || !Array.isArray(after.employees)) bad.push(c.label + ' の保存でデータが壊れた');
    } catch(e){ bad.push(c.label + ' の保存後にデータが読めない'); }

    while(ctx._modalStack && ctx._modalStack.length) ctx.closeModal();
  });
  combos += opened;
  if(bad.length){ bad.slice(0,10).forEach(fail); if(bad.length>10) note('…ほか ' + (bad.length-10) + '件'); }
  else ok(opened + '種類のふきだしを開いて保存し、すべて正常');
}

/* ---------- 4. 細工した文字を全項目に入れる ---------- */
function sweepEscape(){
  console.log('\n■ 全項目に細工した文字を入れて、画面が壊れないか');
  var TRAPS = [
    ['タグ', '<img src=x onerror=BAD>'],
    ['引用符', '" onmouseover=BAD "'],
    ['単引用符', "' onfocus=BAD '"],
    ['閉じタグ', '</div><script>BAD</script>'],
    ['記号', 'A&B<C>D"E\'F']
  ];
  var bad = [], tried = 0;
  TRAPS.forEach(function(trap){
    var app = createApp({ quiet:true });
    var ctx = app.ctx;
    ctx.buildDemoData();
    eachRecord(ctx.DB.data, function(o){
      Object.keys(o).forEach(function(k){
        if(typeof o[k] === 'string' && k !== 'id' && !/Id$/.test(k)) o[k] = trap[1] + o[k];
      });
    });
    /* 設定も */
    Object.keys(ctx.DB.data.settings).forEach(function(k){
      if(typeof ctx.DB.data.settings[k] === 'string') ctx.DB.data.settings[k] = trap[1];
    });
    Object.keys(ctx.VIEWS).forEach(function(v){
      if(!ctx.VIEWS[v] || typeof ctx.VIEWS[v].render !== 'function') return;
      tried++;
      var h;
      try { h = ctx.VIEWS[v].render(); } catch(e){ return; }
      if(h.indexOf(trap[1]) >= 0) bad.push(v + ' に「' + trap[0] + '」がそのまま出る');
    });
  });
  combos += tried;
  if(bad.length){
    var uniq = bad.filter(function(x,i){ return bad.indexOf(x) === i; });
    uniq.slice(0,10).forEach(fail);
    if(uniq.length>10) note('…ほか ' + (uniq.length-10) + '件');
  }
  else ok(TRAPS.length + '種類 × 全画面 = ' + tried + '通り、すべてエスケープされている');
}

/* ---------- 5. 計算の境界値 ---------- */
function sweepNumbers(){
  console.log('\n■ 計算関数に境界値を総当たり');
  var app = createApp({ quiet:true });
  var ctx = app.ctx;
  var VALUES = [0, 1, -1, 0.5, -0.5, 100, -100, 1e308, 1e-308,
                '', '0', 'abc', null, undefined, NaN, Infinity, -Infinity];
  /* 値を2つ受け取る関数（記録ではなく素の値を扱うもの） */
  var PAIR_FNS = ['daysBetween','hoursBetween','clamp','num'];
  /* 値を1つ受け取る関数 */
  var ONE_FNS = ['quarterOf','prevMonth','monthStr','pct','esc','nl2br','lines',
                 'fmtJp','fmtDate','hoursLeft','empName','positiveCycleScore'];
  /* 記録（オブジェクト）を受け取る関数は、記録の形で渡す */
  var REC_FNS = [
    ['kpiGap', function(v){ return { target:v, actual:v }; }],
    ['kpiRowStatus', function(v){ return { target:v, actual:v }; }],
    ['evalScore', function(v){ return { type:'general', scores:{ kpi:v, process:v, growth:v } }; }],
    ['goalProgress', function(v){ return { baseline:v, current:v, target90:v }; }],
    ['ledgerStatus', function(v){ return { name:v, manager:v, kpis:v }; }],
    ['delegationFill', function(v){ return { outcome:v, due:v, checkAt:v }; }],
    ['ventureFill', function(v){ return { purpose:v, gain:v, exitCond:v }; }],
    ['partnerFill', function(v){ return { interest:v, authority:v }; }],
    ['kpiWeekSummary', function(v){ return { weekOf:v, rows:[{ target:v, actual:v }] }; }]
  ];
  var bad = [], tried = 0;

  ONE_FNS.forEach(function(name){
    var fn = ctx[name];
    if(typeof fn !== 'function') return;
    VALUES.forEach(function(a){
      tried++;
      var r;
      try { r = fn(a); }
      catch(e){ bad.push(name + '(' + show(a) + ') が落ちる: ' + e.message); return; }
      if(typeof r === 'number' && !isFinite(r) && !isNaN(r))
        bad.push(name + '(' + show(a) + ') が ' + r + ' を返す');
    });
  });
  PAIR_FNS.forEach(function(name){
    var fn = ctx[name];
    if(typeof fn !== 'function') return;
    VALUES.forEach(function(a){
      VALUES.forEach(function(b){
        tried++;
        try { fn(a, b); }
        catch(e){ bad.push(name + '(' + show(a) + ', ' + show(b) + ') が落ちる: ' + e.message); }
      });
    });
  });
  REC_FNS.forEach(function(pair){
    var fn = ctx[pair[0]];
    if(typeof fn !== 'function') return;
    VALUES.forEach(function(v){
      tried++;
      var r;
      try { r = fn(pair[1](v)); }
      catch(e){ bad.push(pair[0] + '（項目が ' + show(v) + ' の記録）で落ちる: ' + e.message); return; }
      if(typeof r === 'number' && !isFinite(r) && !isNaN(r))
        bad.push(pair[0] + '（項目が ' + show(v) + '）が ' + r + ' を返す');
      if(r && typeof r === 'object' && typeof r.rate === 'number' && (r.rate < 0 || r.rate > 100))
        bad.push(pair[0] + '（項目が ' + show(v) + '）の割合が範囲外: ' + r.rate);
    });
  });

  /* KPIの判定は、目標と実績の全組み合わせ */
  var NUMS = [0, 1, -1, 0.9, 100, 90, 99, 1e9];
  NUMS.forEach(function(t){
    NUMS.forEach(function(a){
      [true,false].forEach(function(low){
        tried++;
        var st;
        try { st = ctx.kpiRowStatus({ target:t, actual:a, lowerIsBetter:low }); }
        catch(e){ bad.push('kpiRowStatus(目標'+t+' 実績'+a+' 小さいほど良い='+low+') が落ちる'); return; }
        if(['ok','watch','ng','none'].indexOf(st) < 0)
          bad.push('kpiRowStatus(目標'+t+' 実績'+a+') が想定外の値: ' + st);
        /* 達成しているのに未達、未達なのに達成、を機械的に調べる */
        var achieved = low ? (a <= t) : (a >= t);
        if(achieved && st !== 'ok')
          bad.push('kpiRowStatus(目標'+t+' 実績'+a+' 小さいほど良い='+low+') 達成のはずが「'+st+'」');
        if(!achieved && st === 'ok')
          bad.push('kpiRowStatus(目標'+t+' 実績'+a+' 小さいほど良い='+low+') 未達のはずが「達成」');
      });
    });
  });
  combos += tried;
  function show(v){
    if(v === null) return 'null';
    if(v === undefined) return 'undefined';
    if(typeof v === 'number' && isNaN(v)) return 'NaN';
    if(Array.isArray(v)) return '[]';
    if(typeof v === 'object') return '{}';
    return JSON.stringify(v);
  }
  if(bad.length){
    var uniq = bad.filter(function(x,i){ return bad.indexOf(x) === i; });
    uniq.slice(0,12).forEach(fail);
    if(uniq.length>12) note('…ほか ' + (uniq.length-12) + '件');
  }
  else ok((ONE_FNS.length + PAIR_FNS.length + REC_FNS.length) +
          '関数 × 値の組み合わせ = ' + tried + '通り、すべて正常');
}

/* ---------- 6. 重複ID・アクセシビリティ ---------- */
function sweepStructure(){
  console.log('\n■ 画面の作り（重複ID・押せる要素）');
  var app = createApp({ quiet:true });
  var ctx = app.ctx;
  ctx.buildDemoData();
  var bad = [];
  Object.keys(ctx.VIEWS).forEach(function(v){
    if(!ctx.VIEWS[v] || typeof ctx.VIEWS[v].render !== 'function') return;
    combos++;
    var root;
    try { root = app.render(v); } catch(e){ return; }
    /* 同じ id が2つ以上 */
    var ids = {};
    root.querySelectorAll('[id]').forEach(function(el){
      var id = el.getAttribute('id');
      ids[id] = (ids[id]||0) + 1;
    });
    Object.keys(ids).forEach(function(id){
      if(ids[id] > 1) bad.push(v + ' に同じ id が' + ids[id] + '個: ' + id);
    });
    /* data-act が付いているのに、キーボードで押せない要素 */
    root.querySelectorAll('[data-act]').forEach(function(el){
      var tag = el.tagName;
      if(tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'SELECT') return;
      if(el.getAttribute('tabindex') !== null) return;
      bad.push(v + ' の「' + (el.textContent||'').slice(0,12) + '」がキーボードで押せない（' + tag + '）');
    });
  });
  if(bad.length){
    var uniq = bad.filter(function(x,i){ return bad.indexOf(x) === i; });
    uniq.slice(0,10).forEach(fail);
    if(uniq.length>10) note('…ほか ' + (uniq.length-10) + '件');
  }
  else ok('全画面で、id の重複もキーボードで押せない操作もない');
}

/* ---------- 実行 ---------- */
sweepScreens();
sweepButtons();
sweepModals();
sweepEscape();
sweepNumbers();
sweepStructure();

console.log('\n================================');
console.log('試した組み合わせ: ' + combos.toLocaleString() + '通り');
console.log(ng ? '見つかった問題: ' + ng + '件' : 'すべて問題なし');
process.exit(ng ? 1 : 0);
