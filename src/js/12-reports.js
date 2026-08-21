/* ============================================================
   12-reports.js  必須報告・承認ルール（第8章）／問題処理・例外記録（第14章）
   ============================================================ */

var repTab = 'rules';

VIEWS.reports = {
  title:'報告・承認ルール',
  desc:'よくない情報ほど早く共有する仕組みをつくります。早く分かるほど、打てる手が多く残ります。',
  render:function(){
    var h = '';
    var tabs = [
      {key:'rules',      label:'ルール'},
      {key:'log',        label:'報告ログ'},
      {key:'approval',   label:'承認申請'},
      {key:'incidents',  label:'問題処理記録'},
      {key:'exceptions', label:'例外の記録'}
    ];
    h += '<div class="tabs" role="tablist">'+tabs.map(function(t){
      var n = '';
      if(t.key==='log') n = ' ('+DB.data.reports.filter(function(r){return !r.needApproval;}).length+')';
      if(t.key==='approval') n = ' ('+DB.data.reports.filter(function(r){return r.needApproval;}).length+')';
      if(t.key==='incidents') n = ' ('+DB.data.incidents.length+')';
      if(t.key==='exceptions') n = ' ('+DB.data.exceptions.length+')';
      return '<button type="button" class="tab '+(repTab===t.key?'active':'')+'" data-act="repTab" data-t="'+t.key+'">'+esc(t.label)+n+'</button>';
    }).join('')+'</div>';

    /* どのタブにも当たらないとき（保存された値が古い等）は、最初のタブを出す。
       else でつなぐことで、中身が丸ごと空になるのを防ぐ */
    if(repTab === 'log')             h += renderReportLog(false);
    else if(repTab === 'approval')   h += renderReportLog(true);
    else if(repTab === 'incidents')  h += renderIncidents();
    else if(repTab === 'exceptions') h += renderExceptions();
    else                             h += renderRules();
    return h;
  }
};
VIEWS.reports.setTab = function(t){ repTab = t; };   /* 他の画面からタブを指定できるようにする */

action('repTab', function(ds){ repTab = ds.t; render(); });

/* ---------- ルール一覧 ---------- */
function renderRules(){
  var d = DB.data;
  var h = '<div class="help-block">'+
    '<b>報告ルールの本質：</b> 悪い情報を早く上げた人が損をしない仕組みにすること。'+
    '報告が遅れた場合は、人を責める前に「なぜ言えなかったか（言いにくい・忘れる・判断に迷う）」を1on1で扱ってください。</div>';

  h += card('必須報告・承認ルール', tableHtml([
    {label:'種類', width:'220px', render:function(r){ return '<b>'+esc(r.label)+'</b>'; }},
    {label:'期限', width:'220px', render:function(r){ return badge(r.limit, r.hours>0?'warn':'accent'); }},
    {label:'内容', render:function(r){ return esc(r.detail); }},
    {label:'', cls:'actions', width:'110px', render:function(r){
      return btn('この報告を登録','repNew',{rule:r.key},'primary'); }}
  ], REPORT_RULES, {}), {tight:true});

  /* 承認基準 */
  h += card('承認の基準', '<dl class="kv">'+
    '<dt>事前承認が必要な金額</dt><dd>'+esc(num(d.settings.approvalAmount,0).toLocaleString())+' 円以上の支出'+
      ' <span class="small muted">（設定で変更できます）</span></dd>'+
    '<dt>承認者</dt><dd>'+(d.settings.ceoName?esc(d.settings.ceoName):'<span class="badge warn">未設定</span>')+
      ' <span class="small muted">／ 部門内は各部門責任者</span></dd>'+
    '<dt>記録の原則</dt><dd>重要判断は口頭で終わらせず記録する。会社データ・契約・成果物を個人環境だけに保存しない。</dd>'+
    '</dl>', {tools: btn('設定を変更','go',{view:'settings'})});

  /* 遵守状況 */
  var rc = reportCompliance();
  h += '<div class="grid c3">'+
    '<div>'+tile('報告の期限遵守率', rc.rate+'<small>%</small>', rc.ok+' / '+rc.total+' 件',
      rc.rate>=90?'ok':rc.rate>=70?'warn':'bad')+'</div>'+
    '<div>'+tile('期限を過ぎた報告', rc.late.length+'<small>件</small>','', rc.late.length?'bad':'ok')+'</div>'+
    '<div>'+tile('承認待ち', d.reports.filter(function(r){return r.needApproval && !r.approvedAt && r.status!=='rejected';}).length+'<small>件</small>','','')+'</div>'+
    '</div>';
  return h;
}

/* ---------- 報告ログ／承認申請 ---------- */
function reportFields(needApproval){
  var f = [
    { key:'ruleKey', label:'種類', type:'select', required:true,
      options:REPORT_RULES.map(function(r){ return {value:r.key, label:r.label+'（'+r.limit+'）'}; }) },
    { key:'title', label:'件名', required:true, full:true },
    { key:'detail', label:'内容', type:'textarea', rows:3, full:true,
      hint:'原因が分からなくても、事実だけ先に報告する。' },
    { key:'reporterId', label:'報告者', type:'select', options:empOptions(true) },
    { key:'toId', label:'報告先', type:'select', options:empOptions(true) }
  ];
  if(needApproval){
    f = f.concat([
      { key:'amount', label:'金額（円）', type:'number', hint:'支出・契約金額。該当しない場合は空欄。' },
      { key:'requestedAt', label:'申請日時', type:'datetime', required:true },
      { key:'approverId', label:'承認者', type:'select', options:empOptions(true) },
      { key:'status', label:'状態', type:'select', options:[
        {value:'pending', label:'承認待ち'},
        {value:'approved',label:'承認済み（事前）'},
        {value:'rejected',label:'否認'},
        {value:'after',   label:'事後報告（ルール違反）'} ] },
      { key:'approvedAt', label:'承認日時', type:'datetime' },
      { key:'decision', label:'決定内容・条件', type:'textarea', rows:2, full:true,
        hint:'重要判断は口頭で終わらせず、ここに記録します。' }
    ]);
  }else{
    f = f.concat([
      { key:'occurredAt', label:'発生日時', type:'datetime' },
      { key:'knownAt',    label:'判明日時', type:'datetime', required:true,
        hint:'報告期限はここが起点になります。' },
      { key:'reportedAt', label:'報告日時', type:'datetime',
        hint:'空欄の場合「未報告」として扱われます。' },
      { key:'decision', label:'対応・決定内容', type:'textarea', rows:2, full:true }
    ]);
  }
  return f;
}

function renderReportLog(needApproval){
  var d = DB.data;
  var list = sortBy(d.reports.filter(function(r){ return !!r.needApproval === needApproval; }),
                    function(r){ return r.knownAt || r.requestedAt || ''; }).reverse();
  var h = '';
  h += '<div class="card"><div class="card-body" style="padding:12px 16px;"><div class="inline-form">'+
    '<button class="btn primary" data-act="'+(needApproval?'repNewApproval':'repNew')+'">＋ '+
      (needApproval?'承認申請を登録':'報告を登録')+'</button>'+
    '<span style="flex:1"></span>'+
    '<button class="btn" data-act="repCsv">CSVで書き出す</button>'+
    '</div></div></div>';

  var cols = needApproval ? [
    { label:'件名', render:function(r){ return '<b>'+esc(r.title)+'</b><div class="small muted">'+esc(r.detail||'').slice(0,60)+'</div>'; } },
    { label:'種類', width:'150px', render:function(r){
        var ru = REPORT_RULES.filter(function(x){return x.key===r.ruleKey;})[0];
        return ru?esc(ru.label):'—'; } },
    { label:'金額', cls:'num', width:'110px', render:function(r){ return r.amount?num(r.amount).toLocaleString()+' 円':'—'; } },
    { label:'申請', width:'120px', render:function(r){ return fmtJp(r.requestedAt); } },
    { label:'承認者', width:'100px', render:function(r){ return r.approverId?esc(empName(r.approverId)):'—'; } },
    { label:'判定', width:'150px', render:function(r){
        var s = reportDeadlineStatus(r); return badge(s.label, s.cls); } },
    { label:'', cls:'actions', width:'170px', render:function(r){
        return (r.status!=='approved'?btn('承認','repApprove',{id:r.id},'primary')+' ':'')+
               btn('編集','repEdit',{id:r.id})+'<span class="sep-x"></span>'+btn('削除','repDel',{id:r.id},'danger'); } }
  ] : [
    { label:'件名', render:function(r){ return '<b>'+esc(r.title)+'</b><div class="small muted">'+esc(r.detail||'').slice(0,70)+'</div>'; } },
    { label:'種類', width:'150px', render:function(r){
        var ru = REPORT_RULES.filter(function(x){return x.key===r.ruleKey;})[0];
        return ru?esc(ru.label)+'<div class="small muted">'+esc(ru.limit)+'</div>':'—'; } },
    { label:'判明', width:'120px', render:function(r){ return fmtJp(r.knownAt); } },
    { label:'報告', width:'120px', render:function(r){ return r.reportedAt?fmtJp(r.reportedAt):badge('未報告','warn'); } },
    { label:'報告者→報告先', width:'160px', render:function(r){
        return esc(r.reporterId?empName(r.reporterId):'—')+' → '+esc(r.toId?empName(r.toId):'—'); } },
    { label:'判定', width:'160px', render:function(r){
        var s = reportDeadlineStatus(r); return badge(s.label, s.cls); } },
    { label:'', cls:'actions', width:'130px', render:function(r){
        return btn('編集','repEdit',{id:r.id})+'<span class="sep-x"></span>'+btn('削除','repDel',{id:r.id},'danger'); } }
  ];

  h += card(needApproval?'承認申請':'報告ログ', tableHtml(cols, list, {
    emptyTitle: needApproval?'承認申請の記録がありません':'報告の記録がありません',
    emptyText: needApproval?'重要契約・一定額以上の支出は、事前承認を記録します。':
      '重大な数値悪化・納期遅延・クレームなどを記録します。記録が残ることで「言った・言わない」がなくなります。'
  }), {tight:true, sub:list.length+'件'});
  return h;
}

action('repNew', function(ds){
  openForm({ title:'報告を登録', wide:true, fields:reportFields(false),
    value:{ ruleKey:ds.rule||'bad_number', knownAt:fmtDateTimeLocal(new Date()),
            reportedAt:fmtDateTimeLocal(new Date()), occurredAt:'' },
    intro:'<b>報告期限は「判明日時」が起点です。</b> 原因が分からなくても、事実だけ先に報告してください。',
    onSubmit:function(v){
      v.id = uid('rep'); v.needApproval = false;
      DB.data.reports.push(v); DB.save(); render(); toast('報告を登録しました','ok');
    } });
});
action('repNewApproval', function(){
  openForm({ title:'承認申請を登録', wide:true, fields:reportFields(true),
    value:{ ruleKey:'contract', requestedAt:fmtDateTimeLocal(new Date()), status:'pending',
            approverId:DB.data.settings.ceoEmpId||'' },
    intro:'<b>支出後の報告は不可。</b> 超えそうな時点・契約前に承認を取ります。',
    onSubmit:function(v){
      v.id = uid('rep'); v.needApproval = true;
      DB.data.reports.push(v); DB.save(); render(); toast('承認申請を登録しました','ok');
    } });
});
action('repEdit', function(ds){
  var r = byId(DB.data.reports, ds.id); if(!r) return;
  openForm({ title:'記録の編集', wide:true, fields:reportFields(!!r.needApproval), value:r,
    onSubmit:function(v){
      v.id = r.id; v.needApproval = r.needApproval;
      if(!replaceById(DB.data.reports, r.id, v)){ toast(RECORD_GONE,'bad'); return false; }
      DB.save(); render(); toast('保存しました','ok');
    } });
});
action('repApprove', function(ds){
  var r = byId(DB.data.reports, ds.id); if(!r) return;
  openForm({ title:'承認：'+r.title,
    fields:[
      { key:'status', label:'判定', type:'select', required:true, options:[
        {value:'approved',label:'承認する'},{value:'rejected',label:'否認する'}] },
      { key:'approverId', label:'承認者', type:'select', options:empOptions(true), required:true },
      { key:'approvedAt', label:'日時', type:'datetime', required:true },
      { key:'decision', label:'決定内容・条件', type:'textarea', rows:3, full:true,
        hint:'条件付き承認の場合、条件と期限を必ず書く。' }
    ],
    value:{ status:'approved', approverId:r.approverId||DB.data.settings.ceoEmpId||'',
            approvedAt:fmtDateTimeLocal(new Date()), decision:r.decision||'' },
    submitLabel:'記録する',
    onSubmit:function(v){
      r.status = v.status; r.approverId = v.approverId;
      r.approvedAt = v.status==='approved' ? v.approvedAt : '';
      r.decision = v.decision;
      DB.save(); render(); toast(v.status==='approved'?'承認しました':'否認を記録しました','ok');
    } });
});
action('repDel', function(ds){
  var r = byId(DB.data.reports, ds.id); if(!r) return;
  confirmDialog('記録の削除','「'+r.title+'」を削除します。よろしいですか？', function(){
    DB.data.reports = DB.data.reports.filter(function(x){ return x.id !== r.id; });
    DB.save(); render(); toast('削除しました','ok');
  }, '削除する');
});
action('repCsv', function(){
  var rows = [['区分','種類','件名','内容','報告者','報告先','発生','判明','報告','申請','金額','承認者','承認日時','状態','判定','決定内容']];
  DB.data.reports.forEach(function(r){
    var ru = REPORT_RULES.filter(function(x){return x.key===r.ruleKey;})[0];
    rows.push([r.needApproval?'承認申請':'報告', ru?ru.label:'', r.title, r.detail,
      r.reporterId?empName(r.reporterId):'', r.toId?empName(r.toId):'',
      r.occurredAt, r.knownAt, r.reportedAt, r.requestedAt, r.amount,
      r.approverId?empName(r.approverId):'', r.approvedAt, r.status,
      reportDeadlineStatus(r).label, r.decision]);
  });
  downloadCsv('報告・承認ログ_'+todayStr()+'.csv', rows);
  toast('CSVを書き出しました','ok');
});

/* ---------- 問題処理記録（①事実 ②影響 ③止血 ④原因 ⑤再発防止） ---------- */
function renderIncidents(){
  var d = DB.data;
  var h = '<div class="help-block">'+
    '<b>問題が起きたときの処理順：</b> '+INCIDENT_STEPS.map(function(s){ return s.label; }).join(' → ')+'。<br>'+
    'この順番を守ると、犯人探しではなく仕組みの修正になります。感情で処理すると同じ問題が繰り返します。</div>';

  h += '<div class="card"><div class="card-body" style="padding:12px 16px;"><div class="inline-form">'+
    '<button class="btn primary" data-act="incNew">＋ 問題処理を記録</button>'+
    '<span style="flex:1"></span><button class="btn" data-act="incPrint">印刷</button>'+
    '</div></div></div>';

  var list = sortBy(d.incidents, function(i){ return i.date; }).reverse();
  if(!list.length){
    return h + card('問題処理記録','<div class="empty"><div class="big">記録がありません</div>'+
      '<div>トラブルが起きたら、5つのステップで記録してください。</div></div>',{tight:true});
  }
  list.forEach(function(i){
    var body = '<div class="grid c2" style="gap:12px;">'+
      INCIDENT_STEPS.map(function(s){
        return '<div><div class="small muted">'+esc(s.label)+'</div><div>'+(nl2br(i[s.key])||'<span class="muted">未記入</span>')+'</div></div>';
      }).join('')+'</div>'+
      '<div class="sep"></div><div class="small">'+
      '再発防止の担当：<b>'+esc(i.owner?empName(i.owner):'未定')+'</b>　期限：<b>'+esc(i.due||'未定')+'</b>　'+
      (i.doneAt?badge('完了 '+i.doneAt,'ok'):(i.due && i.due<todayStr()?badge('期限超過','bad'):badge('対応中','warn')))+
      '</div>';
    h += card(i.title, body, {
      sub:i.date,
      tools:(i.doneAt?'':btn('完了にする','incDone',{id:i.id}))+' '+btn('編集','incEdit',{id:i.id})+' '+btn('削除','incDel',{id:i.id},'danger')
    });
  });
  return h;
}
function incidentFields(){
  var f = [
    { key:'title', label:'件名', required:true, full:true },
    { key:'date',  label:'発生日', type:'date', required:true }
  ];
  INCIDENT_STEPS.forEach(function(s){
    f.push({ key:s.key, label:s.label, type:'textarea', rows:2, full:true, hint:s.hint });
  });
  f.push({ key:'owner', label:'再発防止の担当', type:'select', options:empOptions(true) });
  f.push({ key:'due',   label:'期限', type:'date' });
  return f;
}
action('incNew', function(){
  openForm({ title:'問題処理を記録', wide:true, fields:incidentFields(), value:{date:todayStr()},
    intro:'順番が大事です。<b>事実 → 影響 → 止血 → 原因 → 再発防止</b>。原因の前に止血を決めてください。',
    onSubmit:function(v){ v.id = uid('inc'); DB.data.incidents.push(v); DB.save(); render(); toast('記録しました','ok'); } });
});
action('incEdit', function(ds){
  var i = byId(DB.data.incidents, ds.id); if(!i) return;
  openForm({ title:'問題処理の編集', wide:true, fields:incidentFields(), value:i,
    onSubmit:function(v){ v.id=i.id; v.doneAt=i.doneAt;
      if(!replaceById(DB.data.incidents, i.id, v)){ toast(RECORD_GONE,'bad'); return false; }
      DB.save(); render(); toast('保存しました','ok'); } });
});
action('incDone', function(ds){
  var i = byId(DB.data.incidents, ds.id); if(!i) return;
  i.doneAt = todayStr(); DB.save(); render(); toast('完了にしました','ok');
});
action('incDel', function(ds){
  var i = byId(DB.data.incidents, ds.id); if(!i) return;
  confirmDialog('記録の削除','「'+i.title+'」を削除します。よろしいですか？', function(){
    DB.data.incidents = DB.data.incidents.filter(function(x){ return x.id!==i.id; });
    DB.save(); render(); toast('削除しました','ok');
  }, '削除する');
});
action('incPrint', function(){
  var h = sortBy(DB.data.incidents, function(i){ return i.date; }).reverse().map(function(i){
    return '<div class="card"><div class="card-head"><h2>'+esc(i.title)+'</h2><span class="sub">'+esc(i.date)+'</span></div>'+
      '<div class="card-body"><dl class="kv">'+
      INCIDENT_STEPS.map(function(s){ return '<dt>'+esc(s.label)+'</dt><dd>'+(nl2br(i[s.key])||'—')+'</dd>'; }).join('')+
      '<dt>担当・期限</dt><dd>'+esc(i.owner?empName(i.owner):'未定')+' / '+esc(i.due||'未定')+'</dd>'+
      '</dl></div></div>';
  }).join('');
  printHtml('問題処理記録', h||'<p>記録がありません。</p>');
});

/* ---------- 例外の記録（第14章：理由・決定者・適用期間・見直し日） ---------- */
function renderExceptions(){
  var d = DB.data;
  var h = '<div class="help-block">'+
    '<b>例外を認める場合は、必ず記録します。</b> '+
    '理由・決定者・適用期間・見直し日を残さない例外は、いつのまにか「新しいルール」になり、制度が崩れます。</div>';
  h += '<div class="card"><div class="card-body" style="padding:12px 16px;">'+
    '<button class="btn primary" data-act="excNew">＋ 例外を記録</button></div></div>';

  var list = sortBy(d.exceptions, function(x){ return x.reviewDate||'9999'; });
  h += card('例外の記録', tableHtml([
    {label:'内容', render:function(x){ return '<b>'+esc(x.title)+'</b><div class="small muted">'+esc(x.note||'')+'</div>'; }},
    {label:'理由', render:function(x){ return '<span class="small">'+esc(x.reason)+'</span>'; }},
    {label:'決定者', width:'110px', render:function(x){ return esc(x.decidedBy||'—'); }},
    {label:'適用期間', width:'170px', render:function(x){ return esc(x.periodFrom||'')+' 〜 '+esc(x.periodTo||''); }},
    {label:'見直し日', width:'120px', render:function(x){
      if(!x.reviewDate) return badge('未設定','bad');
      return x.reviewDate < todayStr() ? badge(x.reviewDate+' 超過','bad') : esc(x.reviewDate); }},
    {label:'', cls:'actions', width:'130px', render:function(x){
      return btn('編集','excEdit',{id:x.id})+'<span class="sep-x"></span>'+btn('削除','excDel',{id:x.id},'danger'); }}
  ], list, {emptyTitle:'例外の記録はありません', emptyText:'ルールの例外を認めたら、必ずここに記録します。'}),
  {tight:true});
  return h;
}
var EXC_FIELDS = [
  { key:'title', label:'例外の内容', required:true, full:true, hint:'例：A社への支払サイトを60日に延長' },
  { key:'reason', label:'理由', type:'textarea', rows:2, full:true, required:true },
  { key:'decidedBy', label:'決定者', required:true },
  { key:'periodFrom', label:'適用開始', type:'date' },
  { key:'periodTo', label:'適用終了', type:'date' },
  { key:'reviewDate', label:'見直し日', type:'date', required:true,
    hint:'この日に「継続するか、やめるか、正式ルールにするか」を判断します。' },
  { key:'note', label:'補足', type:'textarea', rows:2, full:true }
];
action('excNew', function(){
  openForm({ title:'例外を記録', wide:true, fields:EXC_FIELDS, value:{periodFrom:todayStr()},
    onSubmit:function(v){ v.id=uid('exc'); DB.data.exceptions.push(v); DB.save(); render(); toast('記録しました','ok'); } });
});
action('excEdit', function(ds){
  var x = byId(DB.data.exceptions, ds.id); if(!x) return;
  openForm({ title:'例外の編集', wide:true, fields:EXC_FIELDS, value:x,
    onSubmit:function(v){ v.id=x.id;
      if(!replaceById(DB.data.exceptions, x.id, v)){ toast(RECORD_GONE,'bad'); return false; }
      DB.save(); render(); toast('保存しました','ok'); } });
});
action('excDel', function(ds){
  var x = byId(DB.data.exceptions, ds.id); if(!x) return;
  confirmDialog('例外記録の削除','「'+x.title+'」を削除します。よろしいですか？', function(){
    DB.data.exceptions = DB.data.exceptions.filter(function(y){ return y.id!==x.id; });
    DB.save(); render(); toast('削除しました','ok');
  }, '削除する');
});
