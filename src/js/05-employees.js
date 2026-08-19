/* ============================================================
   05-employees.js  社員・役割台帳（指示書 第4章／シート1）
   ============================================================ */

var empFilter = { dept:'', q:'', onlyIncomplete:false };

function employeeFields(){
  return [
    { type:'heading', label:'基本' },
    { key:'name',      label:'氏名', required:true },
    { key:'dept',      label:'部署', hint:'例：営業部／管理部' },
    { key:'empType',   label:'雇用形態', type:'select', options:[''].concat(EMPLOYMENT_TYPES) },
    { key:'joinDate',  label:'入社日', type:'date' },
    { key:'salary',    label:'給与・年収', hint:'例：月給30万円／年収450万円。空欄でも構いません。' },
    { key:'jobType',   label:'職種区分', type:'select', options:[''].concat(jobTypeList()),
      hint:'職種別役割スコアカードと紐づきます。' },
    { key:'grade',     label:'等級', type:'select', options:[''].concat(DB.data.grades.map(function(g){return g.code;})) },

    { type:'heading', label:'組織' },
    { key:'manager',   label:'直属上司', type:'select', options:empOptions(true),
      hint:'指示書の重点確認項目。曖昧なまま放置しないでください。' },
    { key:'isTop',     label:'最終責任者（この人に上司はいない）', type:'checkbox' },
    { key:'backup',    label:'代替要員', hint:'この人が抜けた時に誰が引き継ぐか。', full:true },

    { type:'heading', label:'役割' },
    { key:'roleTitle',    label:'役割', hint:'肩書ではなく「会社の中で担っている機能」を書く。', full:true },
    { key:'mainDuties',   label:'主要業務（3〜5個）', type:'list', rows:5, full:true,
      hint:'1行に1つ。多すぎる場合は重要な5つに絞る。' },
    { key:'deliverables', label:'成果物', type:'textarea', rows:2, full:true,
      hint:'「何ができていれば仕事をしたと言えるか」。定義できない場合は上司と決める。' },

    { type:'heading', label:'数字' },
    { key:'kpis',       label:'KPI', type:'list', rows:4, full:true, hint:'1行に1つ。最大5個。' },
    { key:'kpiTarget',  label:'目標値', type:'textarea', rows:2, full:true, hint:'KPIごとの目標値。例：受注件数 月8件／粗利率 35%以上' },
    { key:'dataSource', label:'実績データの所在', full:true,
      hint:'どのファイル・システムの数字を「正」とするか。ここが曖昧だと評価で揉めます。' },

    { type:'heading', label:'権限と承認' },
    { key:'authority', label:'本人判断で決めてよいこと', type:'textarea', rows:3, full:true },
    { key:'approvals', label:'上司・社長承認が必要なこと', type:'textarea', rows:3, full:true },

    { type:'heading', label:'定着と将来像' },
    { key:'nextRole', label:'半年後・1年後の役割と権限の拡張案', type:'textarea', rows:2, full:true,
      hint:'能力が上がるほど仕事と責任だけが増え、尊重・権限・報酬・将来像が増えなければ、退職が合理的な選択になります。' },
    { key:'growthTalkAt', label:'将来像を本人と話した日', type:'date',
      hint:'「育てると辞める」のではなく、育った人に残る理由を示せていないことが問題です。' },
    { key:'retentionRisk', label:'離職リスクの見立て', type:'select',
      options:['','低い','中くらい','高い'],
      hint:'外部でも通用する人ほど、退職という選択肢を持っています。' },

    { type:'heading', label:'引継ぎ' },
    { key:'handover',    label:'資料・データの保存場所', type:'textarea', rows:2, full:true,
      hint:'個人PC・個人アカウントのみの保存は不可（指示書 第8章）。' },
    { key:'replaceable', label:'代替可能性', type:'select',
      options:['','高い（すぐ代替できる）','中（引継ぎ期間が必要）','低い（この人しかできない）'] },
    { key:'ceoOnlyKnows',label:'社長だけが仕事内容を把握している', type:'checkbox',
      hint:'指示書の重点確認項目。チェックが付く人は属人化のリスクが高い状態です。' },
    { key:'notes',       label:'備考', type:'textarea', rows:2, full:true }
  ];
}

VIEWS.employees = {
  title:'社員・役割台帳',
  desc:'Week 1／シート1。人・役割・上司・権限を一元管理します。空欄を放置しないでください。',
  render:function(){
    var d = DB.data;
    var list = d.employees.slice();
    if(empFilter.dept) list = list.filter(function(e){ return e.dept === empFilter.dept; });
    if(empFilter.q){
      var q = empFilter.q.toLowerCase();
      list = list.filter(function(e){
        return (e.name+' '+(e.dept||'')+' '+(e.roleTitle||'')+' '+(e.jobType||'')).toLowerCase().indexOf(q) >= 0;
      });
    }
    if(empFilter.onlyIncomplete) list = list.filter(function(e){ return ledgerStatus(e).rate < 100; });
    list = sortBy(list, function(e){ return (e.dept||'zzz')+'_'+e.name; });

    var h = '';
    h += '<div class="help-block">'+
      '<b>重点確認（指示書 第4章）：</b> 直属上司が曖昧／成果物が定義できない／数値で成果を確認できない／社長だけが仕事内容を把握している社員。'+
      'この4つに当てはまる人が、組織が社長の記憶に依存している原因です。</div>';

    /* 操作バー */
    var deptOpts = ['<option value="">すべての部署</option>'].concat(deptList().map(function(dp){
      return '<option value="'+esc(dp)+'"'+(empFilter.dept===dp?' selected':'')+'>'+esc(dp)+'</option>';
    })).join('');
    h += '<div class="card"><div class="card-body" style="padding:12px 16px;">'+
      '<div class="inline-form">'+
        '<button class="btn primary" data-act="empNew">＋ 社員を追加</button>'+
        '<select data-change="empDept">'+deptOpts+'</select>'+
        '<input type="text" placeholder="氏名・役割で検索" value="'+esc(empFilter.q)+'" data-change="empSearch" style="min-width:180px;">'+
        '<label class="chk" style="margin:0;"><input type="checkbox" data-change="empIncomplete"'+(empFilter.onlyIncomplete?' checked':'')+'><span>未完成のみ表示</span></label>'+
        '<span style="flex:1"></span>'+
        '<button class="btn" data-act="empCsv">CSVで書き出す</button>'+
        '<button class="btn" data-act="empPrint">印刷</button>'+
      '</div></div></div>';

    /* 一覧 */
    var cols = [
      { label:'氏名', width:'150px', render:function(e){
          return '<b>'+esc(e.name)+'</b>'+(e.isTop?' '+badge('最終責任者','accent'):'')+
                 '<div class="small muted">'+esc(e.dept||'部署未設定')+(e.grade?' / '+esc(e.grade):'')+'</div>'; } },
      { label:'役割・職種', render:function(e){
          return esc(e.roleTitle||'—')+'<div class="small muted">'+esc(e.jobType||'職種未設定')+'</div>'; } },
      { label:'直属上司', width:'120px', render:function(e){
          if(e.isTop) return '<span class="small muted">—</span>';
          return e.manager ? esc(empName(e.manager)) : badge('未確定','bad'); } },
      { label:'部下', width:'54px', cls:'num', render:function(e){
          var n = directReports(e.id).length;
          if(!n) return '<span class="muted">0</span>';
          var over = n > num(DB.data.settings.maxDirectReports,6);
          return '<span class="'+(over?'badge bad':'')+'">'+n+'</span>'; } },
      { label:'成果物', render:function(e){
          return e.deliverables ? '<span class="small">'+esc(e.deliverables).slice(0,50)+'</span>' : badge('未定義','bad'); } },
      { label:'KPI', render:function(e){
          var k = lines(e.kpis);
          if(!k.length) return badge('未設定','bad');
          return '<span class="small">'+esc(k.slice(0,3).join('、'))+(k.length>3?' ほか':'')+'</span>'; } },
      { label:'記入率', width:'120px', render:function(e){
          var st = ledgerStatus(e);
          return progressBar(st.rate, st.rate>=100?'ok':st.rate>=50?'warn':'bad')+
            '<span class="small mono">'+st.done+'/'+st.total+'</span>'+
            (st.missing.length?'<div class="small muted" title="'+esc(st.missing.join('、'))+'">不足：'+esc(st.missing.slice(0,2).join('、'))+(st.missing.length>2?'…':'')+'</div>':''); } },
      { label:'', cls:'actions', width:'150px', render:function(e){
          return btn('詳細','empView',{id:e.id})+' '+btn('編集','empEdit',{id:e.id})+' '+
                 btn('削除','empDel',{id:e.id},'danger'); } }
    ];
    h += card('社員一覧', tableHtml(cols, list, {
      emptyTitle:'社員が登録されていません',
      emptyText:'「＋ 社員を追加」から、全社員を入力してください。曖昧な項目は本人と直属上司に確認します。'
    }), { tight:true, sub:list.length+'名 表示中（全'+d.employees.length+'名）' });

    /* 重点確認リスト */
    var risk = d.employees.filter(function(e){
      return (!e.manager && !e.isTop) || !(e.deliverables||'').trim() || lines(e.kpis).length===0 || e.ceoOnlyKnows;
    });
    if(risk.length){
      h += card('重点確認が必要な社員（'+risk.length+'名）', tableHtml([
        {label:'氏名', render:function(e){ return '<b>'+esc(e.name)+'</b><div class="small muted">'+esc(e.dept||'')+'</div>'; }},
        {label:'直属上司が曖昧', render:function(e){ return (!e.manager&&!e.isTop) ? badge('該当','bad') : '<span class="muted">—</span>'; }},
        {label:'成果物が未定義', render:function(e){ return !(e.deliverables||'').trim() ? badge('該当','bad') : '<span class="muted">—</span>'; }},
        {label:'数値で確認できない', render:function(e){ return lines(e.kpis).length===0 ? badge('該当','bad') : '<span class="muted">—</span>'; }},
        {label:'社長だけが把握', render:function(e){ return e.ceoOnlyKnows ? badge('該当','bad') : '<span class="muted">—</span>'; }},
        {label:'', cls:'actions', render:function(e){ return btn('編集','empEdit',{id:e.id}); }}
      ], risk, {}), { tight:true, sub:'指示書 第4章の重点確認' });
    }
    return h;
  }
};

/* ---------- 操作 ---------- */
action('empNew', function(){
  openForm({
    title:'社員を追加', wide:true, fields:employeeFields(), value:{},
    intro:'指示書 第4章の項目です。<b>分からない項目は空欄のままにせず</b>、本人と直属上司に確認して埋めてください。',
    onSubmit:function(v){
      v.id = uid('emp');
      DB.data.employees.push(v); DB.save(); render();
      toast('登録しました：'+v.name, 'ok');
    }
  });
});

action('empEdit', function(ds){
  var e = byId(DB.data.employees, ds.id);
  if(!e) return;
  openForm({
    title:'社員の編集：'+e.name, wide:true, fields:employeeFields(), value:e,
    headNote:'記入率 '+ledgerStatus(e).rate+'%',
    onSubmit:function(v){
      v.id = e.id;
      var i = DB.data.employees.indexOf(e);
      DB.data.employees[i] = v; DB.save(); render();
      toast('保存しました', 'ok');
    }
  });
});

action('empDel', function(ds){
  var e = byId(DB.data.employees, ds.id);
  if(!e) return;
  var reports = directReports(e.id);
  var warn = reports.length ? '\n\n※ この社員を上司としている部下が'+reports.length+'名います（'+
             reports.map(function(x){return x.name;}).join('、')+'）。削除すると直属上司が未確定になります。' : '';
  confirmDialog('社員の削除', '「'+e.name+'」を削除します。1on1記録・評価記録は残りますが、氏名が表示されなくなります。'+warn+'\n\nよろしいですか？',
    function(){
      DB.data.employees = DB.data.employees.filter(function(x){ return x.id !== e.id; });
      DB.data.employees.forEach(function(x){ if(x.manager === e.id) x.manager = ''; });
      DB.save(); render(); toast('削除しました','ok');
    }, '削除する');
});

action('empView', function(ds){
  var e = byId(DB.data.employees, ds.id);
  if(!e) return;
  openModal({
    title:e.name+'　役割シート', wide:true,
    headNote:(e.dept||'')+(e.grade?' / '+e.grade:''),
    body:employeeDetailHtml(e),
    foot:'<button class="btn left" data-act="empPrintOne" data-id="'+e.id+'">印刷</button>'+
         '<button class="btn" data-modal-close>閉じる</button>'+
         '<button class="btn primary" data-act="empEditFromView" data-id="'+e.id+'">編集する</button>'
  });
});
action('empEditFromView', function(ds){ closeModal(); ACTIONS.empEdit(ds); });
action('empPrintOne', function(ds){
  var e = byId(DB.data.employees, ds.id);
  printHtml(e.name+' 役割シート', '<div class="card"><div class="card-head"><h2>'+esc(e.name)+'　役割シート</h2></div>'+
    '<div class="card-body">'+employeeDetailHtml(e)+'</div></div>');
});

function employeeDetailHtml(e){
  var st = ledgerStatus(e);
  var sc = DB.data.scorecards.filter(function(s){ return s.jobType === e.jobType; })[0];
  var h = '';
  h += '<div style="margin-bottom:12px;">'+progressBar(st.rate, st.rate>=100?'ok':'warn')+
       '<div class="small muted" style="margin-top:4px;">台帳の記入率 '+st.rate+'%'+
       (st.missing.length?'／不足：'+esc(st.missing.join('、')):'')+'</div></div>';
  function row(k,v){ return '<dt>'+esc(k)+'</dt><dd>'+(v||'<span class="muted">未記入</span>')+'</dd>'; }
  h += '<fieldset><legend>基本・組織</legend><dl class="kv">'+
    row('部署', esc(e.dept))+ row('雇用形態', esc(e.empType))+ row('入社日', esc(e.joinDate))+
    row('給与・年収', esc(e.salary))+ row('職種区分', esc(e.jobType))+ row('等級', esc(e.grade))+
    row('直属上司', e.isTop?'—（最終責任者）':(e.manager?esc(empName(e.manager)):'<span class="badge bad">未確定</span>'))+
    row('部下', directReports(e.id).map(function(x){return esc(x.name);}).join('、'))+
    row('代替要員', esc(e.backup))+
    '</dl></fieldset>';
  h += '<fieldset><legend>役割・成果物</legend><dl class="kv">'+
    row('役割', esc(e.roleTitle))+
    row('主要業務', lines(e.mainDuties).length?'<ul class="list-plain">'+lines(e.mainDuties).map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul>':'')+
    row('成果物', nl2br(e.deliverables))+
    '</dl></fieldset>';
  h += '<fieldset><legend>数字</legend><dl class="kv">'+
    row('KPI', lines(e.kpis).length?'<ul class="list-plain">'+lines(e.kpis).map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul>':'')+
    row('目標値', nl2br(e.kpiTarget))+
    row('実績データの所在', esc(e.dataSource))+
    '</dl></fieldset>';
  h += '<fieldset><legend>権限・承認</legend><dl class="kv">'+
    row('本人判断で決めてよいこと', nl2br(e.authority))+
    row('承認が必要なこと', nl2br(e.approvals))+
    '</dl></fieldset>';
  h += '<fieldset><legend>引継ぎ</legend><dl class="kv">'+
    row('資料・データ保存場所', nl2br(e.handover))+
    row('代替可能性', esc(e.replaceable))+
    row('属人化', e.ceoOnlyKnows?'<span class="badge bad">社長だけが把握している</span>':'—')+
    row('備考', nl2br(e.notes))+
    '</dl></fieldset>';
  if(sc){
    h += '<fieldset><legend>職種の役割スコアカード（'+esc(sc.jobType)+'）</legend>'+
      '<div class="small">'+esc(sc.purpose)+'</div>'+
      '<div class="small muted" style="margin-top:6px;">必須報告：'+esc(sc.reports||'—')+'</div></fieldset>';
  }
  return h;
}

action('empDept', function(ds, el){ empFilter.dept = el.value; render(); });
action('empSearch', function(ds, el){ empFilter.q = el.value; render(); });
action('empIncomplete', function(ds, el){ empFilter.onlyIncomplete = el.checked; render(); });

action('empCsv', function(){
  var head = ['氏名','部署','雇用形態','入社日','給与・年収','職種区分','等級','直属上司','部下','代替要員',
              '役割','主要業務','成果物','KPI','目標値','実績データの所在','本人判断で決めてよいこと',
              '承認が必要なこと','資料・データ保存場所','代替可能性','社長だけが把握','記入率','備考'];
  var rows = [head];
  sortBy(DB.data.employees, function(e){ return (e.dept||'')+e.name; }).forEach(function(e){
    rows.push([e.name,e.dept,e.empType,e.joinDate,e.salary,e.jobType,e.grade,
      e.isTop?'（最終責任者）':empName(e.manager),
      directReports(e.id).map(function(x){return x.name;}).join('、'), e.backup,
      e.roleTitle, lines(e.mainDuties).join('\n'), e.deliverables, lines(e.kpis).join('\n'),
      e.kpiTarget, e.dataSource, e.authority, e.approvals, e.handover, e.replaceable,
      e.ceoOnlyKnows?'該当':'', ledgerStatus(e).rate+'%', e.notes]);
  });
  downloadCsv('社員・役割台帳_'+todayStr()+'.csv', rows);
  toast('CSVを書き出しました','ok');
});

action('empPrint', function(){
  var h = '';
  sortBy(DB.data.employees, function(e){ return (e.dept||'')+e.name; }).forEach(function(e){
    h += '<div class="card"><div class="card-head"><h2>'+esc(e.name)+'　役割シート</h2>'+
         '<span class="sub">'+esc(e.dept||'')+'</span></div>'+
         '<div class="card-body">'+employeeDetailHtml(e)+'</div></div>';
  });
  printHtml('社員・役割台帳', h || '<p>社員が登録されていません。</p>');
});

/* ============================================================
   組織図ビュー
   ============================================================ */
VIEWS.org = {
  title:'組織・権限マップ',
  desc:'直属上司の関係と、管理スパン（社長の直属部下は4〜6人以内）を確認します。',
  render:function(){
    var d = DB.data;
    if(!d.employees.length) return card('組織図','<div class="empty"><div class="big">社員が登録されていません</div></div>',{tight:true});

    var maxDr = num(d.settings.maxDirectReports, 6);
    var roots = d.employees.filter(function(e){ return e.isTop || !e.manager; });
    var seen = {};
    function node(e, depth){
      if(seen[e.id] || depth > 8) return '';
      seen[e.id] = 1;
      var kids = sortBy(directReports(e.id), function(x){ return x.name; });
      var over = kids.length > maxDr;
      var st = ledgerStatus(e);
      var h = '<div style="margin-left:'+(depth*22)+'px;border-left:'+(depth?'2px solid #dfe4ea':'none')+';padding-left:'+(depth?12:0)+'px;">'+
        '<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid var(--border);border-radius:8px;background:#fff;margin:4px 0;flex-wrap:wrap;">'+
        '<b>'+esc(e.name)+'</b>'+
        '<span class="small muted">'+esc(e.roleTitle||e.jobType||'')+'</span>'+
        (e.grade?badge(e.grade,'accent'):'')+
        (kids.length?'<span class="badge '+(over?'bad':'neutral')+'">部下'+kids.length+'名</span>':'')+
        (st.rate<100?'<span class="badge warn">台帳'+st.rate+'%</span>':'')+
        '<span style="flex:1"></span>'+ btn('詳細','empView',{id:e.id})+
        '</div>';
      if(over)
        h += '<div class="alert warn" style="margin-left:12px;"><span class="ic">▲</span><div><div class="t">直属部下が'+kids.length+'名（上限'+maxDr+'名）</div>'+
             '<div class="d">指示書 第14章：一般社員を直接管理しすぎない。中間の管理職に委任してください。</div></div></div>';
      kids.forEach(function(k){ h += node(k, depth+1); });
      return h + '</div>';
    }
    var tree = roots.map(function(r){ return node(r, 0); }).join('');
    var orphans = d.employees.filter(function(e){ return !seen[e.id]; });
    if(orphans.length){
      tree += '<div class="sep"></div><div class="small muted">上司の設定が循環している、または未確定の社員</div>';
      orphans.forEach(function(e){
        tree += '<div style="padding:6px 10px;border:1px solid #f0c4bf;border-radius:8px;background:#fbe9e7;margin:4px 0;">'+
          esc(e.name)+' '+badge('直属上司を確認','bad')+' '+btn('編集','empEdit',{id:e.id})+'</div>';
      });
    }

    var h = '';
    h += '<div class="help-block"><b>指示書 第14章：</b> 社長の直属部下は原則4〜6人以内に絞り、一般社員を直接管理しすぎないこと。'+
         '直接見る人数が増えるほど、記憶と感覚での管理に戻ります。</div>';
    h += card('組織図（直属上司ベース）', tree, {});

    /* 権限一覧 */
    var rows = sortBy(d.employees.filter(function(e){ return (e.authority||'').trim() || (e.approvals||'').trim(); }),
                      function(e){ return (e.dept||'')+e.name; });
    h += card('権限・承認の一覧', tableHtml([
      {label:'氏名', width:'130px', render:function(e){ return '<b>'+esc(e.name)+'</b><div class="small muted">'+esc(e.dept||'')+'</div>'; }},
      {label:'本人判断で決めてよいこと', render:function(e){ return nl2br(e.authority)||'<span class="badge warn">未記入</span>'; }},
      {label:'承認が必要なこと', render:function(e){ return nl2br(e.approvals)||'<span class="badge warn">未記入</span>'; }}
    ], rows, {emptyTitle:'権限が記入されていません', emptyText:'台帳で「本人判断で決めてよいこと」「承認が必要なこと」を記入してください。'}),
    {tight:true, sub:'権限が曖昧だと、判断が全部社長に戻ります'});
    return h;
  }
};
