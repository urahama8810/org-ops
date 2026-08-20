/* ============================================================
   04b-me.js  わたしの画面
   ------------------------------------------------------------
   自分に関係するものだけを集めた画面。
   全社の数字ではなく、「自分は今週なにをすればいいか」が分かる場所。

   誰としてこのアプリを見るかは、このパソコンごとに覚える。
   （共有データには入れないので、他の人には見えない）
   ============================================================ */

var ME_KEY = 'hyokaSeido_me';

/* 今日からn日後の日付（YYYY-MM-DD） */
function meDayOff(n){ return fmtDate(new Date(Date.now() + n*86400000)); }

function myEmpId(){
  try{ return localStorage.getItem(ME_KEY) || ''; }catch(e){ return ''; }
}
function setMyEmpId(id){
  try{ id ? localStorage.setItem(ME_KEY, id) : localStorage.removeItem(ME_KEY); }catch(e){}
}
function me(){
  var id = myEmpId();
  return id ? byId(DB.data.employees, id) : null;
}

/* 自分が責任者になっている、直近の週のKPI行 */
function myKpiRows(){
  var id = myEmpId();
  if(!id || !DB.data.kpiWeeks.length) return { week:null, rows:[] };
  var w = latestKpiWeek();
  if(!w) return { week:null, rows:[] };
  return { week:w, rows:(w.rows||[]).filter(function(r){ return r.owner === id; }) };
}

/* 自分あての対策で、期限が来ているもの（今週の分だけでなく全週から） */
function myOpenActions(){
  var id = myEmpId(), out = [];
  if(!id) return out;
  DB.data.kpiWeeks.forEach(function(w){
    (w.rows||[]).forEach(function(r){
      if(r.owner !== id) return;
      if(!String(r.action||'').trim() || r.doneAt) return;
      out.push({ week:w.weekOf, ind:r.indicator, action:r.action, due:r.due||'' });
    });
  });
  return sortBy(out, function(x){ return x.due || '9999'; });
}

/* 自分が任されている仕事 */
function myDelegations(){
  var id = myEmpId();
  if(!id) return [];
  return DB.data.delegations.filter(function(x){
    return x.employeeId === id && (!x.state || x.state === 'open');
  });
}

/* 今月の1on1と、前回までの未完了の約束 */
function myOneOnOne(){
  var id = myEmpId();
  if(!id) return { thisMonth:null, promises:[] };
  var mine = sortBy(DB.data.oneOnOnes.filter(function(o){ return o.employeeId === id; }),
                    function(o){ return o.month; });
  var thisMonth = mine.filter(function(o){ return o.month === monthStr(); })[0] || null;
  var promises = [];
  mine.forEach(function(o){
    (o.promises||[]).forEach(function(p){ if(!p.done) promises.push({ text:p.text, month:o.month }); });
  });
  return { thisMonth:thisMonth, promises:promises, all:mine };
}

/* ---------- 画面 ---------- */
VIEWS.me = {
  title:'わたしの画面',
  desc:'自分に関係するものだけを集めました。まずここを見てください。',
  render:function(){
    var m = me();
    if(!m) return renderMePicker();

    var h = '';
    var acts = myOpenActions();
    var dlgs = myDelegations();
    var ooo  = myOneOnOne();
    var kw   = myKpiRows();
    var late = acts.filter(function(a){ return a.due && a.due < todayStr(); });
    var checkSoon = dlgs.filter(function(x){
      var nc = nextCheckDate(x); return nc && nc <= meDayOff(3);
    });

    /* --- あいさつと、今週の要点 --- */
    h += '<div class="me-head">'+
      '<div class="me-who">'+
        '<div class="me-avatar">'+esc(m.name.charAt(0))+'</div>'+
        '<div><div class="me-name">'+esc(m.name)+'</div>'+
        '<div class="small muted">'+esc([m.dept, m.roleTitle, m.grade].filter(Boolean).join('　/　'))+'</div></div>'+
      '</div>'+
      '<span class="spacer"></span>'+
      btn('自分を選び直す','mePick',{},'ghost','users')+
      '</div>';

    /* --- 今週やること --- */
    var todo = [];
    if(late.length) todo.push({ lv:'bad', t:'期限が過ぎた対策が'+late.length+'件', d:late.map(function(a){return a.ind;}).slice(0,3).join('／'), view:'kpi' });
    if(checkSoon.length) todo.push({ lv:'warn', t:'まもなく途中確認の日です（'+checkSoon.length+'件）', d:checkSoon.map(function(x){return x.title;}).slice(0,3).join('／'), view:'delegation' });
    if(!ooo.thisMonth) todo.push({ lv:'warn', t:'今月の1on1がまだです', d:'上司と日程を決めてください。', view:'oneonone' });
    if(ooo.promises.length) todo.push({ lv:'warn', t:'前回の1on1で決めたことが'+ooo.promises.length+'件、まだ完了していません', d:ooo.promises.slice(0,2).map(function(p){return p.text;}).join('／'), view:'oneonone' });

    var todoBody = todo.length
      ? todo.map(function(x){
          return '<div class="alert '+x.lv+'"><span class="ic">'+ic(x.lv==='bad'?'alert':'info',15)+'</span>'+
                 '<div class="body"><div class="t">'+esc(x.t)+'</div>'+
                 (x.d?'<div class="d">'+esc(x.d)+'</div>':'')+'</div>'+
                 '<div class="go">'+btn('開く','go',{view:x.view},'','arrowRight')+'</div></div>';
        }).join('')
      : '<div class="alert ok"><span class="ic">'+ic('check',15)+'</span><div class="body">'+
        '<div class="t">いま急ぎの用件はありません</div>'+
        '<div class="d">週次KPIの数字を入れて、任されている仕事を進めましょう。</div></div></div>';

    h += '<div class="section-title">今週やること</div>';
    h += card(null, todoBody, {});

    /* --- 数字・仕事・面談 --- */
    h += '<div class="section-title">わたしの数字と仕事</div>';
    h += '<div class="grid c2">';

    /* 自分のKPI */
    var kpiBody;
    if(!kw.week){
      kpiBody = '<div class="empty">'+ic('trending',26)+'<div class="big">週次KPIがまだありません</div>'+
                '<div>週次KPI会議の記録が作られると、ここに自分の担当分が出ます。</div></div>';
    }else if(!kw.rows.length){
      kpiBody = '<div class="empty">'+ic('trending',26)+'<div class="big">担当している指標はありません</div>'+
                '<div>週次KPI表で自分が責任者になっている指標が、ここに出ます。</div></div>';
    }else{
      kpiBody = tableHtml([
        { label:'指標', render:function(r){ return '<b>'+esc(r.indicator)+'</b>'; } },
        { label:'目標', cls:'num', width:'80px', render:function(r){ return esc(r.target); } },
        { label:'実績', cls:'num', width:'80px', render:function(r){ return r.actual===''||r.actual===undefined ? '<span class="muted">未入力</span>' : esc(r.actual); } },
        { label:'状態', width:'92px', render:function(r){
            var st = kpiRowStatus(r);
            var k = KPI_STATUS.filter(function(x){ return x.key===st; })[0];
            return badge(k.label, k.cls); } }
      ], kw.rows, {});
    }
    h += card('今週のKPI', kpiBody, {
      icon:'trending', sub: kw.week ? kw.week.weekOf+' の週' : '',
      tools: btn('KPI会議を開く','go',{view:'kpi'},'','arrowRight') });

    /* 任されている仕事 */
    var dlgBody = dlgs.length ? tableHtml([
      { label:'仕事', render:function(r){
          return '<b>'+esc(r.title)+'</b>'+(r.outcome?'<div class="small muted">'+esc(String(r.outcome).slice(0,60))+'</div>':''); } },
      { label:'期限', width:'104px', render:function(r){ return r.due ? esc(r.due) : '<span class="muted">—</span>'; } },
      { label:'次の確認', width:'116px', render:function(r){
          var nc = nextCheckDate(r);
          if(!nc) return badge('未設定','warn');
          var left = daysBetween(todayStr(), nc);
          return esc(nc)+'<div class="small '+(left<0?'':'muted')+'"'+(left<0?' style="color:var(--bad-solid);font-weight:600;"':'')+'>'+
                 (left<0?(-left)+'日超過':left===0?'今日':'あと'+left+'日')+'</div>'; } }
    ], dlgs, {}) : '<div class="empty">'+ic('handoff',26)+'<div class="big">いま任されている仕事はありません</div>'+
      '<div>上司から仕事を渡されると、ここに出ます。</div></div>';
    h += card('任されている仕事', dlgBody, {
      icon:'handoff', sub: dlgs.length ? dlgs.length+'件' : '',
      tools: btn('一覧を開く','go',{view:'delegation'},'','arrowRight') });

    h += '</div>';

    /* --- 自分の役割 --- */
    h += '<div class="section-title">わたしの役割<span class="note">迷ったらここに戻ってきてください</span></div>';
    function row(k, v){
      return '<dt>'+esc(k)+'</dt><dd>'+(String(v||'').trim() ? nl2br(esc(v)) : '<span class="muted">未記入</span>')+'</dd>';
    }
    h += '<div class="grid c2">'+
      card('担当していること',
        '<dl class="kv">'+
        row('役割', m.roleTitle)+
        row('主な仕事', lines(m.mainDuties).join('\n'))+
        row('成果物', m.deliverables)+
        row('KPI', lines(m.kpis).join('\n'))+
        row('目標値', m.kpiTarget)+
        '</dl>', {icon:'clipboard'})+
      card('決めてよいこと・確認すること',
        '<dl class="kv">'+
        row('自分で決めてよいこと', m.authority)+
        row('承認をもらう必要があること', m.approvals)+
        row('直属の上司', m.manager ? empName(m.manager) : '')+
        row('困ったときの相談先', m.manager ? empName(m.manager) : '')+
        row('これから任せたい役割', m.nextRole)+
        '</dl>', {icon:'shield'})+
      '</div>';

    /* --- 1on1の履歴 --- */
    if(ooo.all && ooo.all.length){
      var last = ooo.all.slice(-3).reverse();
      h += '<div class="section-title">これまでの1on1</div>';
      h += card(null, tableHtml([
        { label:'月', width:'96px', render:function(o){ return esc(o.month); } },
        { label:'話したこと', render:function(o){ return '<span class="small">'+esc(String(o.wins||o.feedback||o.kpiReview||'').slice(0,80))+'</span>'; } },
        { label:'決めたこと', render:function(o){
            var ps = o.promises||[];
            return ps.length ? '<span class="small">'+ps.map(function(p){
              return (p.done?'✓ ':'□ ')+esc(p.text); }).join('<br>')+'</span>' : '<span class="muted small">—</span>'; } }
      ], last, {}), {tight:true});
    }

    return h;
  }
};

/* 自分がまだ決まっていないときの案内 */
function renderMePicker(){
  var emps = DB.data.employees;
  if(!emps.length){
    return '<div class="empty" style="padding:60px 20px;">'+ic('users',34)+
      '<div class="big">まだメンバーが登録されていません</div>'+
      '<div>先に「社員・役割台帳」でメンバーを登録してください。</div>'+
      '<div class="btn-row">'+btn('社員・役割台帳を開く','go',{view:'employees'},'primary','users')+'</div></div>';
  }
  var h = '<div class="notice"><b>はじめに、あなたが誰かを選んでください。</b>'+
    'ここで選んだ人の予定・数字・任されている仕事だけを表示します。'+
    'この選択はこのパソコンにだけ残るので、ほかの人には見えません。あとから変更できます。</div>';

  var byDept = {};
  emps.forEach(function(e){ (byDept[e.dept||'その他'] = byDept[e.dept||'その他'] || []).push(e); });

  h += card('この中から選んでください', Object.keys(byDept).map(function(dept){
    return '<div class="pick-dept">'+esc(dept)+'</div><div class="pick-grid">'+
      byDept[dept].map(function(e){
        return '<button class="pick-card" data-act="meSet" data-id="'+esc(e.id)+'">'+
          '<span class="av">'+esc(e.name.charAt(0))+'</span>'+
          '<span class="nm">'+esc(e.name)+'</span>'+
          '<span class="rl">'+esc(e.roleTitle||e.jobType||'')+'</span></button>';
      }).join('')+'</div>';
  }).join(''), {icon:'users', sub:DB.data.employees.length+'名'});
  return h;
}

/* ---------- 操作 ---------- */
action('meSet', function(ds){
  setMyEmpId(ds.id);
  render();
  toast(empName(ds.id)+' として表示します','ok');
});

action('mePick', function(){
  setMyEmpId('');
  render();
});
