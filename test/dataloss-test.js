/* ============================================================
   データが減っていないかの検査
   ------------------------------------------------------------
   いちばん困るのは「操作したら記録が消えていた」です。
   例外は出ないので、ほかの検査では気づけません。

   そこで、削除以外のあらゆる操作をしたあと、
   記録の件数が減っていないかを毎回数えます。
   ============================================================ */
var createApp = require('./dom.js').createApp;

var ng = 0, checked = 0;
function ok(m){ console.log('  OK   ' + m); }
function fail(m){ ng++; console.log('  NG   ' + m); }
function note(m){ console.log('       ' + m); }

/* 記録が入っている入れ物を、まとめて数える */
function census(d){
  var c = {};
  if(!d || typeof d !== 'object') return c;
  Object.keys(d).forEach(function(k){
    if(Array.isArray(d[k])) c[k] = d[k].length;
  });
  if(d.capital){
    if(Array.isArray(d.capital.periods)) c['capital.periods'] = d.capital.periods.length;
    if(Array.isArray(d.capital.spends))  c['capital.spends']  = d.capital.spends.length;
  }
  return c;
}

/* 減った項目だけを返す */
function shrunk(before, after){
  var lost = [];
  Object.keys(before).forEach(function(k){
    var b = before[k], a = (k in after) ? after[k] : 0;
    if(a < b) lost.push(k + ' が ' + b + '件 → ' + a + '件');
  });
  return lost;
}

/* 消す操作は、減って当たり前なので対象外にする */
function isDeleting(act){
  return /del|remove|clear|reset|archive|discard|drop|trash/i.test(act);
}

console.log('■ 削除以外の操作で、記録が減らないか');

var app = createApp({ quiet:true });
var ctx = app.ctx;
var bad = [];

Object.keys(ctx.VIEWS).forEach(function(v){
  if(!ctx.VIEWS[v] || typeof ctx.VIEWS[v].render !== 'function') return;

  ctx.buildDemoData();
  var root;
  try { root = app.render(v); } catch(e){ return; }

  root.querySelectorAll('[data-act]').forEach(function(b){
    var act = b.getAttribute('data-act');
    if(isDeleting(act) || act === 'loadDemo') return;

    /* 毎回まっさらなサンプルから始める（前の操作の影響を受けないように） */
    ctx.buildDemoData();
    var fresh;
    try { fresh = app.render(v); } catch(e){ return; }
    var el = null;
    fresh.querySelectorAll('[data-act]').forEach(function(x){
      if(!el && x.getAttribute('data-act') === act) el = x;
    });
    if(!el) return;

    var before = census(ctx.DB.data);
    checked++;
    try {
      el.click();
      /* ふきだしが開いたら、そのまま保存まで押してみる */
      if(ctx._modalStack && ctx._modalStack.length){
        var modal = app.modal();
        if(modal){
          var submit = modal.querySelector('[type="submit"]') || modal.querySelector('form button');
          if(submit){ try { submit.click(); } catch(e){} }
        }
        while(ctx._modalStack && ctx._modalStack.length) ctx.closeModal();
      }
    } catch(e){
      return;                         /* 例外は sweep.js の担当 */
    }

    var lost = shrunk(before, census(ctx.DB.data));
    if(lost.length){
      bad.push(v + ' の「' + String(el.textContent||act).slice(0,14) + '」（' + act + '）で ' + lost.join(' / '));
    }
  });
});

/* 保存 → 読み込みで、記録が減らないか（保存の形が壊れていないか） */
console.log('\n■ 保存して読み直しても、記録が減らないか');
var app2 = createApp({ quiet:true });
var ctx2 = app2.ctx;
ctx2.buildDemoData();
var beforeSave = census(ctx2.DB.data);
ctx2.DB.save();
ctx2.DB.data = null;
ctx2.DB.load();
var afterLoad = census(ctx2.DB.data);
checked++;
var lost2 = shrunk(beforeSave, afterLoad);
if(lost2.length) fail('保存して読み直すと ' + lost2.join(' / '));
else ok(Object.keys(beforeSave).length + '種類の記録が、保存前と同じ件数で戻ってきた');

/* 共有データを受け取ったときに、こちらの記録が減らないか */
console.log('\n■ 共有データを受け取っても、記録が減らないか');
var app3 = createApp({ quiet:true });
var ctx3 = app3.ctx;
ctx3.buildDemoData();
var mine = census(ctx3.DB.data);
if(typeof ctx3.syncApply === 'function'){
  /* 相手から、途中までしか入っていないデータが届いた場合 */
  var partial = JSON.parse(JSON.stringify(ctx3.DB.data));
  delete partial.employees;
  delete partial.goals;
  partial.kpiWeeks = null;
  checked++;
  try {
    ctx3.syncApply({ data: partial, rev: 2 });
    var after3 = census(ctx3.DB.data);
    /* 相手のデータで置き換わるのは正しい動き。ここで見たいのは「壊れて数えられなくなる」こと */
    if(!ctx3.DB.data || !Array.isArray(ctx3.DB.data.employees)){
      fail('欠けたデータを受け取ると、社員の入れ物が壊れる');
    } else {
      ok('欠けたデータを受け取っても、入れ物は壊れない（形が整えられる）');
    }
  } catch(e){
    fail('欠けたデータを受け取ると例外: ' + e.message);
  }
} else {
  note('共有の取り込み関数が見つからないため、この検査は飛ばしました');
}

console.log('\n■ 操作ごとの結果');
if(bad.length){
  var uniq = bad.filter(function(x,i){ return bad.indexOf(x) === i; });
  uniq.slice(0,12).forEach(fail);
  if(uniq.length > 12) note('…ほか ' + (uniq.length-12) + '件');
} else {
  ok(checked + '回の操作で、記録が減ったものはない');
}

console.log('\n================================');
console.log(ng ? '見つかった問題: ' + ng + '件' : '調べた操作: ' + checked + '回、記録は減っていません');
process.exit(ng ? 1 : 0);
