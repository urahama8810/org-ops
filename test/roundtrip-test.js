/* ============================================================
   入力した値が、本当に保存されるかの検査（往復の検査）
   ------------------------------------------------------------
   今回いちばん多かった不具合の型は、これです：

     ・「保存しました」と出るのに、実は残っていない
     ・選択肢から消えた値（辞めた人・改名した職種）が黙って消える
     ・カンマ付きの数字を入れると、元の数字ごと消える
     ・ふきだしを開いている間に共有データが届くと、書いた内容が消える

   どれも例外が出ないので、ほかの検査は素通りしてしまいます。
   そこでここでは「入れた値を、そのまま読み返せるか」を1つずつ確かめます。
   ============================================================ */
var createApp = require('./dom.js').createApp;

var ng = 0, checked = 0;
function ok(m){ console.log('  OK   ' + m); }
function fail(m){ ng++; console.log('  NG   ' + m); }
function note(m){ console.log('       ' + m); }

/* ふきだしの中のフォームに値を入れて、保存ボタンを押す */
function fillAndSubmit(app, values){
  var m = app.modal();
  if(!m) return { ok:false, why:'ふきだしが開かなかった' };
  var form = m.querySelector('form');
  if(!form) return { ok:false, why:'入力欄が見つからない' };
  Object.keys(values || {}).forEach(function(k){
    var el = form.querySelector('[name="f_'+k+'"]');
    if(el) el.value = values[k];
  });
  var msgs = [];
  var prevToast = app.ctx.toast;
  app.ctx.toast = function(t){ msgs.push(String(t)); };
  var hs = form._handlers && form._handlers.submit;
  if(hs && hs.length) hs[0].call(form, { type:'submit', target:form, preventDefault:function(){} });
  app.ctx.toast = prevToast;
  return { ok:true, msgs:msgs };
}

/* ---------- 1. 選択欄の値が、開いて保存しただけで変わらないか ---------- */
console.log('■ 開いて保存しただけで、選択の内容が変わらないか');
(function(){
  var app = createApp({ quiet:true });
  var ctx = app.ctx;
  ctx.buildDemoData();

  /* 社員・目標・役割表・関係者など、選択欄を持つ主な記録で確かめる */
  var cases = [
    { label:'社員',   list:'employees', act:'empEdit',      keys:['dept','jobType','grade','replaceable','manager'] },
    { label:'目標',   list:'goals',     act:'goalEdit',     keys:['kind','owner'] },
    { label:'関係者', list:'partners',  act:'capPartnerEdit', keys:['kind','checkCycle'] }
  ];
  var bad = [];
  cases.forEach(function(c){
    var list = ctx.DB.data[c.list] || [];
    if(!list.length || typeof ctx.ACTIONS[c.act] !== 'function') return;
    list.slice(0, 3).forEach(function(rec){
      var before = {};
      c.keys.forEach(function(k){ before[k] = rec[k]; });
      checked++;
      try {
        ctx.ACTIONS[c.act]({ id:rec.id });
        var r = fillAndSubmit(app, {});      /* 何も触らずに保存 */
        while(ctx._modalStack && ctx._modalStack.length) ctx.closeModal();
        if(!r.ok){ return; }
        var after = null;
        (ctx.DB.data[c.list] || []).forEach(function(x){ if(x && x.id === rec.id) after = x; });
        if(!after){ bad.push(c.label + '「' + (rec.name||rec.id) + '」が保存後に消えた'); return; }
        c.keys.forEach(function(k){
          var b = before[k], a = after[k];
          if(b !== undefined && b !== '' && String(a||'') !== String(b)){
            bad.push(c.label + '「' + (rec.name||rec.id) + '」の ' + k + ' が ' +
                     JSON.stringify(b) + ' → ' + JSON.stringify(a) + ' に変わった');
          }
        });
      } catch(e){
        while(ctx._modalStack && ctx._modalStack.length) ctx.closeModal();
      }
    });
  });
  if(bad.length){
    var u = bad.filter(function(x,i){ return bad.indexOf(x)===i; });
    u.slice(0,10).forEach(fail);
    if(u.length>10) note('…ほか ' + (u.length-10) + '件');
  } else ok(checked + '件の記録を開いて保存し、選択の内容は変わらなかった');
})();

/* ---------- 2. 選択肢から消えた値が、保存で消えないか ---------- */
console.log('\n■ 選択肢から消えた値（辞めた人・改名した職種）が、保存で消えないか');
(function(){
  var app = createApp({ quiet:true });
  var ctx = app.ctx;
  ctx.buildDemoData();
  var bad = [];

  var emp = ctx.DB.data.employees[1];
  if(emp){
    /* いま選ばれている職種を、選択肢から消えた名前にしてしまう */
    emp.jobType = 'すでに廃止した職種';
    checked++;
    try {
      ctx.ACTIONS.empEdit({ id:emp.id });
      fillAndSubmit(app, {});
      while(ctx._modalStack && ctx._modalStack.length) ctx.closeModal();
      var after = null;
      ctx.DB.data.employees.forEach(function(x){ if(x && x.id === emp.id) after = x; });
      if(!after || after.jobType !== 'すでに廃止した職種')
        bad.push('職種が「' + (after ? after.jobType : '(消滅)') + '」に化けた（期待：そのまま残る）');
    } catch(e){
      while(ctx._modalStack && ctx._modalStack.length) ctx.closeModal();
      bad.push('例外: ' + e.message);
    }
  }

  /* 上司として選ばれていた人がいなくなった場合 */
  var e2 = ctx.DB.data.employees[2];
  if(e2){
    e2.manager = '退職した人の名前';
    checked++;
    try {
      ctx.ACTIONS.empEdit({ id:e2.id });
      fillAndSubmit(app, {});
      while(ctx._modalStack && ctx._modalStack.length) ctx.closeModal();
      var a2 = null;
      ctx.DB.data.employees.forEach(function(x){ if(x && x.id === e2.id) a2 = x; });
      if(!a2 || a2.manager !== '退職した人の名前')
        bad.push('上司が「' + (a2 ? a2.manager : '(消滅)') + '」に化けた（期待：そのまま残る）');
    } catch(e){
      while(ctx._modalStack && ctx._modalStack.length) ctx.closeModal();
    }
  }

  if(bad.length) bad.forEach(fail);
  else ok('選択肢に無くなった値も、開いて保存したときに残る');
})();

/* ---------- 3. 数字として読めない入力で、元の数字が消えないか ---------- */
console.log('\n■ カンマ付きなどの入力で、元の数字が消えないか');
(function(){
  var app = createApp({ quiet:true });
  var ctx = app.ctx;
  ctx.buildDemoData();
  var bad = [];
  var badValues = ['1,000', '１２３', '6人', '約50', '10 000'];

  var goal = ctx.DB.data.goals[0];
  if(goal){
    badValues.forEach(function(v){
      ctx.buildDemoData();
      var g = ctx.DB.data.goals[0];
      var before = g.target90;
      checked++;
      try {
        ctx.ACTIONS.goalEdit({ id:g.id });
        var r = fillAndSubmit(app, { target90:v });
        while(ctx._modalStack && ctx._modalStack.length) ctx.closeModal();
        var after = null;
        ctx.DB.data.goals.forEach(function(x){ if(x && x.id === g.id) after = x; });
        var now = after ? after.target90 : undefined;
        if(String(now||'') !== String(before||'')){
          bad.push('「' + v + '」を入れたら、90日目標が ' + before + ' → ' + now + ' になった');
        }
        var told = (r.msgs||[]).some(function(m){ return m.indexOf('数字として読めない') >= 0; });
        if(!told) bad.push('「' + v + '」を入れても、読めないことが伝わらない');
      } catch(e){
        while(ctx._modalStack && ctx._modalStack.length) ctx.closeModal();
      }
    });
  }
  if(bad.length){
    var u = bad.filter(function(x,i){ return bad.indexOf(x)===i; });
    u.slice(0,10).forEach(fail);
  } else ok(badValues.length + '種類の読めない入力で、元の数字は守られ、理由も伝わる');
})();

/* ---------- 4. 開いている間に共有データが届いたとき ---------- */
console.log('\n■ ふきだしを開いている間に、共有データが届いたとき');
(function(){
  var app = createApp({ quiet:true });
  var ctx = app.ctx;
  ctx.buildDemoData();
  if(typeof ctx.syncApply !== 'function'){ note('共有の取り込みが無いため飛ばしました'); return; }

  var g = ctx.DB.data.goals[0];
  if(!g){ note('目標が無いため飛ばしました'); return; }
  var origName = g.name;
  checked++;
  try {
    ctx.ACTIONS.goalEdit({ id:g.id });
    /* ここで、ほかの端末から新しいデータが届いたことにする */
    ctx.syncApply({ data: JSON.parse(JSON.stringify(ctx.DB.data)), rev:2 });
    var r = fillAndSubmit(app, { name:'書き換えたつもりの名前' });
    while(ctx._modalStack && ctx._modalStack.length) ctx.closeModal();

    var after = null;
    ctx.DB.data.goals.forEach(function(x){ if(x && x.id === g.id) after = x; });
    var told = (r.msgs||[]).some(function(m){ return m.indexOf('古くなりました') >= 0; });

    if(after && after.name === '書き換えたつもりの名前'){
      ok('新しいデータに、そのまま書き込めた');
    } else if(told){
      ok('保存できないことを、その場で伝えている（黙って消えない）');
    } else {
      fail('保存されていないのに、何も伝わらない（「保存しました」と出て消える型の不具合）');
    }
    if(after && after.name !== origName && after.name !== '書き換えたつもりの名前')
      fail('関係のない値に化けた: ' + after.name);
  } catch(e){
    while(ctx._modalStack && ctx._modalStack.length) ctx.closeModal();
    fail('例外: ' + e.message);
  }
})();

/* ---------- 5. 1on1の約束の期限が、開いて保存しただけで消えないか ---------- */
console.log('\n■ 1on1の「約束の期限」が、開いて保存しただけで消えないか');
(function(){
  var app = createApp({ quiet:true });
  var ctx = app.ctx;
  ctx.buildDemoData();
  var rec = (ctx.DB.data.oneOnOnes || []).filter(function(o){
    return o && o.promises && o.promises.length && o.promises.some(function(p){ return p && p.due; });
  })[0];
  if(!rec){ note('期限つきの約束を含む記録が無いため飛ばしました'); return; }

  var before = rec.promises.map(function(p){ return p.due || ''; });
  checked++;
  try {
    ctx.ACTIONS.oooEdit({ id:rec.id });
    fillAndSubmit(app, {});                 /* 何も触らず保存 */
    while(ctx._modalStack && ctx._modalStack.length) ctx.closeModal();
    var after = null;
    ctx.DB.data.oneOnOnes.forEach(function(x){ if(x && x.id === rec.id) after = x; });
    var now = after ? (after.promises||[]).map(function(p){ return p.due || ''; }) : [];
    var lost = before.filter(function(d, i){ return d && !now[i]; });
    if(lost.length) fail(lost.length + '件の期限が消えた（' + before.join('/') + ' → ' + now.join('/') + '）');
    else ok('約束の期限は、開いて保存しても残る');
  } catch(e){
    while(ctx._modalStack && ctx._modalStack.length) ctx.closeModal();
    fail('例外: ' + e.message);
  }
})();

/* ---------- 6. 設定の数字を空欄で保存しても、0にならないか ---------- */
console.log('\n■ 設定の数字を空欄で保存しても、0にならないか');
(function(){
  var app = createApp({ quiet:true });
  var ctx = app.ctx;
  ctx.buildDemoData();
  var before = {
    maxDirectReports: ctx.DB.data.settings.maxDirectReports,
    approvalAmount:   ctx.DB.data.settings.approvalAmount
  };
  var view = app.render('settings');
  var bad = [];
  [['', '空欄'], ['1,000', 'カンマ付き'], ['６', '全角数字']].forEach(function(pair){
    ctx.DB.data.settings.maxDirectReports = before.maxDirectReports;
    ctx.DB.data.settings.approvalAmount   = before.approvalAmount;
    view = app.render('settings');
    var el = view.querySelector('[name="f_maxDirectReports"]');
    if(!el) return;
    el.value = pair[0];
    checked++;
    var msgs = []; var prev = ctx.toast; ctx.toast = function(t){ msgs.push(String(t)); };
    try { ctx.ACTIONS.setSave({}, el, { preventDefault:function(){} }); } catch(e){}
    ctx.toast = prev;
    var now = ctx.DB.data.settings.maxDirectReports;
    if(String(now) !== String(before.maxDirectReports))
      bad.push(pair[1] + 'で保存したら、上限人数が ' + before.maxDirectReports + ' → ' + now + ' になった');
  });
  if(bad.length) bad.forEach(fail);
  else ok('空欄・カンマ付き・全角数字では保存されず、元の設定が守られる');
})();

console.log('\n================================');
console.log(ng ? '見つかった問題: ' + ng + '件' : '確かめた往復: ' + checked + '通り、すべて正しく保存される');
process.exit(ng ? 1 : 0);
