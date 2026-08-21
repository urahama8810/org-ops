/* ============================================================
   13-improvement.js  成績が低い場合の対応
   ============================================================ */

VIEWS.improvement = {
  title:'改善計画',
  desc:'評価2は翌月の改善項目を3つ以内に。評価1または評価2が継続する場合は30〜60日の改善計画を作成します。',
  render:function(){
    var d = DB.data;
    var h = '';

    h += '<div class="help-block">'+
      '<b>改善計画に必ず書くこと：</b> ①改善が必要な事実 ②期待水準 ③測定方法 ④会社の支援 ⑤毎週の確認 ⑥期限。<br>'+
      '「やる気を出す」「意識を変える」は改善計画になりません。<b>行動と数字</b>で書いてください。</div>';

    h += '<div class="alert warn"><span class="ic">'+ic('info',15)+'</span><div class="body">'+
      '<div class="t">通常の評価と分けて扱うもの</div>'+
      '<div class="d">虚偽報告・無断契約・資金流出・データ持出し等は、評価制度ではなく<b>就業規則・規程・法的手続</b>に基づいて扱います。'+
      '改善計画の対象にしないでください。</div></div></div>';

    /* 対象者 */
    var needs = d.employees.filter(function(e){ return needsImprovementPlan(e.id); });
    if(needs.length){
      h += card('改善計画が必要な社員（'+needs.length+'名）', tableHtml([
        {label:'社員', render:function(e){ return '<b>'+esc(e.name)+'</b><div class="small muted">'+esc(e.dept||'')+'</div>'; }},
        {label:'評価履歴', render:function(e){
          var evs = sortBy(d.evaluations.filter(function(x){ return x.employeeId===e.id && evalScore(x)!==null; }),
                           function(x){ return x.period; }).slice(-3);
          return evs.map(function(x){ var s=evalScore(x); var g=evalGradeLabel(s);
            return '<span class="small">'+esc(x.period)+' '+badge(s.toFixed(2),g.cls)+'</span>'; }).join(' '); }},
        {label:'状態', width:'140px', render:function(e){
          return hasActivePlan(e.id) ? badge('計画あり','ok') : badge('計画が未作成','bad'); }},
        {label:'', cls:'actions', width:'150px', render:function(e){
          return hasActivePlan(e.id) ? '' : btn('改善計画を作る','impNewFor',{emp:e.id},'primary'); }}
      ], needs, {}), {tight:true});
    }

    h += '<div class="card"><div class="card-body" style="padding:12px 16px;"><div class="inline-form">'+
      '<button class="btn primary" data-act="impNew">＋ 改善計画を作成</button>'+
      '<span style="flex:1"></span><button class="btn" data-act="impCsv">CSVで書き出す</button>'+
      '</div></div></div>';

    var list = sortBy(d.improvementPlans, function(p){ return p.status==='closed'?'z':'a'; });
    if(!list.length){
      h += card('改善計画','<div class="empty"><div class="big">改善計画はありません</div>'+
        '<div>評価2以下の社員が出た場合に作成します。</div></div>',{tight:true});
      return h;
    }

    list.forEach(function(p){
      var days = p.startDate && p.endDate ? daysBetween(p.startDate, p.endDate) : 0;
      var elapsed = p.startDate ? daysBetween(p.startDate, todayStr()) : 0;
      var rate = days ? clamp(Math.round(elapsed/days*100),0,100) : 0;
      var body = '<div class="grid c2" style="gap:14px;">'+
        '<div>'+
          '<div class="small muted">① 改善が必要な事実</div><div>'+(nl2br(p.facts)||'<span class="muted">未記入</span>')+'</div>'+
          '<div class="small muted" style="margin-top:8px;">② 期待水準</div><div>'+(nl2br(p.expected)||'<span class="muted">未記入</span>')+'</div>'+
          '<div class="small muted" style="margin-top:8px;">③ 測定方法</div><div>'+(nl2br(p.measure)||'<span class="muted">未記入</span>')+'</div>'+
        '</div><div>'+
          '<div class="small muted">④ 会社の支援</div><div>'+(nl2br(p.support)||'<span class="muted">未記入</span>')+'</div>'+
          '<div class="small muted" style="margin-top:8px;">改善項目（3つ以内）</div>'+
          '<ul class="list-plain">'+(lines(p.items).map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')||'<li class="muted">未記入</li>')+'</ul>'+
          '<div class="small muted" style="margin-top:8px;">期間</div>'+
          '<div>'+esc(p.startDate||'')+' 〜 '+esc(p.endDate||'')+'（'+days+'日間）</div>'+
          progressBar(rate, rate>80?'warn':'')+
        '</div></div>';

      /* 毎週の確認 */
      body += '<div class="sep"></div><div class="small muted" style="margin-bottom:5px;">⑤ 毎週の確認</div>';
      var checks = p.weeklyChecks || [];
      body += tableHtml([
        {label:'日付', width:'110px', render:function(c){ return esc(c.date); }},
        {label:'確認内容（事実）', render:function(c){ return nl2br(c.note); }},
        {label:'判定', width:'110px', render:function(c){
          return badge(c.judge==='ok'?'改善している':c.judge==='ng'?'改善していない':'一部改善',
                       c.judge==='ok'?'ok':c.judge==='ng'?'bad':'warn'); }},
        {label:'', cls:'actions', width:'50px', render:function(c, i){
          return btn('削除','impCheckDel',{id:p.id,i:i},'danger'); }}
      ], checks, {emptyTitle:'週次の確認記録がありません', emptyText:'毎週、事実で確認して記録します。'});

      if(p.status === 'closed'){
        body += '<div class="sep"></div><div class="small muted">結果</div><div>'+(nl2br(p.result)||'—')+'</div>';
      }

      h += card(empName(p.employeeId)+'　改善計画', body, {
        sub:(p.status==='closed'?'終了':'実施中')+'　'+esc(p.startDate||'')+' 〜 '+esc(p.endDate||''),
        tools:(p.status==='closed'?'':
          btn('週次確認を追加','impCheckNew',{id:p.id},'primary')+' '+btn('終了する','impClose',{id:p.id}))+' '+
          btn('編集','impEdit',{id:p.id})+' '+btn('印刷','impPrint',{id:p.id})+' '+btn('削除','impDel',{id:p.id},'danger'),
        cls: p.status==='closed'?'':'',
      });
    });
    return h;
  }
};

function impFields(){
  return [
    { key:'employeeId', label:'対象社員', type:'select', options:empOptions(true), required:true },
    { key:'managerId',  label:'担当上司', type:'select', options:empOptions(true) },
    { key:'startDate',  label:'開始日', type:'date', required:true },
    { key:'endDate',    label:'終了日', type:'date', required:true, hint:'30〜60日の範囲で設定します。' },
    { key:'facts',    label:'① 改善が必要な事実', type:'textarea', rows:3, full:true, required:true,
      hint:'性格ではなく、期限・行動・結果・影響の事実で書く。例：直近3か月の受注が目標8件に対し3件、失注理由の記録が未提出。' },
    { key:'expected', label:'② 期待水準', type:'textarea', rows:2, full:true, required:true,
      hint:'どうなれば「改善した」と言えるか。数値で書く。' },
    { key:'measure',  label:'③ 測定方法', type:'textarea', rows:2, full:true, required:true,
      hint:'どのデータで、誰が、いつ確認するか。' },
    { key:'support',  label:'④ 会社の支援', type:'textarea', rows:2, full:true,
      hint:'同行、研修、業務量の調整、情報の提供など。会社側の約束も書く。' },
    { key:'items',    label:'改善項目（3つ以内）', type:'list', rows:3, full:true,
      hint:'多くしないこと。3つを超えると、どれも実行されません。' },
    { key:'note',     label:'補足', type:'textarea', rows:2, full:true }
  ];
}

action('impNew', function(){ openImpForm(null, ''); });
action('impNewFor', function(ds){ openImpForm(null, ds.emp); });
function openImpForm(rec, empId){
  var e = byId(DB.data.employees, empId || (rec?rec.employeeId:''));
  var end = new Date(); end.setDate(end.getDate()+45);
  var val = rec || { employeeId:empId||'', managerId:e?e.manager:'', startDate:todayStr(), endDate:fmtDate(end),
                     facts:'', expected:'', measure:'', support:'', items:[], note:'' };
  openForm({
    title: rec?'改善計画の編集':'改善計画の作成', wide:true, value:val, fields:impFields(),
    intro:'期間は<b>30〜60日</b>。改善項目は<b>3つ以内</b>。毎週確認し、事実で記録します。'+
      '<br>虚偽報告・無断契約・資金流出・データ持出し等はこの制度で扱わず、規程・法的手続に基づいて処理してください。',
    onSubmit:function(v){
      var days = daysBetween(v.startDate, v.endDate);
      if(days < 25 || days > 70){
        if(!confirm('期間が'+days+'日です。社内ルールでは30〜60日を想定しています。このまま保存しますか？')) return false;
      }
      if(lines(v.items).length > 3){
        toast('改善項目は3つ以内にしてください（現在'+lines(v.items).length+'個）','bad'); return false;
      }
      if(rec){
        v.id = rec.id; v.weeklyChecks = rec.weeklyChecks; v.status = rec.status; v.result = rec.result;
        if(!replaceById(DB.data.improvementPlans, rec.id, v)){ toast(RECORD_GONE,'bad'); return false; }
      }else{
        v.id = uid('imp'); v.weeklyChecks = []; v.status = 'open'; v.result = '';
        DB.data.improvementPlans.push(v);
      }
      DB.save(); render(); toast('保存しました','ok');
    }
  });
}
action('impEdit', function(ds){
  var p = byId(DB.data.improvementPlans, ds.id); if(!p) return;
  openImpForm(p, p.employeeId);
});
action('impCheckNew', function(ds){
  var p = byId(DB.data.improvementPlans, ds.id); if(!p) return;
  openForm({ title:'週次確認の記録',
    fields:[
      { key:'date', label:'確認日', type:'date', required:true },
      { key:'note', label:'確認内容（事実）', type:'textarea', rows:3, full:true, required:true,
        hint:'期待水準に対して、今週どうだったか。数字と事実で書く。' },
      { key:'judge', label:'判定', type:'select', required:true, options:[
        {value:'ok', label:'改善している'},
        {value:'part', label:'一部改善'},
        {value:'ng', label:'改善していない'} ] }
    ],
    value:{ date:todayStr(), judge:'part' },
    submitLabel:'記録する',
    onSubmit:function(v){
      p.weeklyChecks = p.weeklyChecks || [];
      p.weeklyChecks.push(v); DB.save(); render(); toast('記録しました','ok');
    } });
});
action('impCheckDel', function(ds){
  var p = byId(DB.data.improvementPlans, ds.id); if(!p) return;
  confirmDialog('この週の記録を削除する',
    'この週の確認記録を削除します。よろしいですか？',
    function(){ p.weeklyChecks.splice(num(ds.i),1); DB.save(); render(); toast('削除しました','ok'); },
    '削除する');
});
action('impClose', function(ds){
  var p = byId(DB.data.improvementPlans, ds.id); if(!p) return;
  openForm({ title:'改善計画の終了', wide:true,
    fields:[
      { key:'result', label:'結果', type:'textarea', rows:4, full:true, required:true,
        hint:'期待水準に到達したか。到達していない場合、次にどうするかを明記する（配置転換・再計画・規程に基づく手続など）。' },
      { key:'judge', label:'判定', type:'select', required:true, options:[
        {value:'achieved', label:'改善した（通常運用に戻す）'},
        {value:'partial',  label:'一部改善（再計画）'},
        {value:'failed',   label:'改善しなかった'} ] },
      { key:'closedAt', label:'終了日', type:'date', required:true }
    ],
    value:{ closedAt:todayStr(), judge:'achieved', result:'' },
    submitLabel:'終了する',
    onSubmit:function(v){
      p.status = 'closed'; p.result = v.result; p.judge = v.judge; p.closedAt = v.closedAt;
      DB.save(); render(); toast('改善計画を終了しました','ok');
    } });
});
action('impDel', function(ds){
  var p = byId(DB.data.improvementPlans, ds.id); if(!p) return;
  confirmDialog('改善計画の削除', empName(p.employeeId)+'さんの改善計画を削除します。よろしいですか？', function(){
    DB.data.improvementPlans = DB.data.improvementPlans.filter(function(x){ return x.id!==p.id; });
    DB.save(); render(); toast('削除しました','ok');
  }, '削除する');
});
action('impPrint', function(ds){
  var p = byId(DB.data.improvementPlans, ds.id); if(!p) return;
  printHtml('改善計画 '+empName(p.employeeId),
    '<div class="card"><div class="card-head"><h2>改善計画　'+esc(empName(p.employeeId))+'</h2>'+
    '<span class="sub">'+esc(p.startDate)+' 〜 '+esc(p.endDate)+'</span></div><div class="card-body"><dl class="kv">'+
    '<dt>担当上司</dt><dd>'+esc(p.managerId?empName(p.managerId):'—')+'</dd>'+
    '<dt>① 改善が必要な事実</dt><dd>'+(nl2br(p.facts)||'—')+'</dd>'+
    '<dt>② 期待水準</dt><dd>'+(nl2br(p.expected)||'—')+'</dd>'+
    '<dt>③ 測定方法</dt><dd>'+(nl2br(p.measure)||'—')+'</dd>'+
    '<dt>④ 会社の支援</dt><dd>'+(nl2br(p.support)||'—')+'</dd>'+
    '<dt>改善項目</dt><dd>'+(lines(p.items).map(function(x){return esc(x);}).join('<br>')||'—')+'</dd>'+
    '<dt>⑤ 毎週の確認</dt><dd>'+((p.weeklyChecks||[]).map(function(c){
      return esc(c.date)+'　'+esc(c.judge==='ok'?'改善している':c.judge==='ng'?'改善していない':'一部改善')+'　'+esc(c.note); }).join('<br>')||'—')+'</dd>'+
    '<dt>⑥ 期限</dt><dd>'+esc(p.endDate||'—')+'</dd>'+
    (p.status==='closed'?'<dt>結果</dt><dd>'+(nl2br(p.result)||'—')+'</dd>':'')+
    '</dl></div></div>');
});
action('impCsv', function(){
  var rows = [['社員','担当上司','開始','終了','状態','改善が必要な事実','期待水準','測定方法','会社の支援','改善項目','週次確認','結果']];
  DB.data.improvementPlans.forEach(function(p){
    rows.push([empName(p.employeeId), p.managerId?empName(p.managerId):'', p.startDate, p.endDate,
      p.status==='closed'?'終了':'実施中', p.facts, p.expected, p.measure, p.support,
      lines(p.items).join('\n'),
      (p.weeklyChecks||[]).map(function(c){ return c.date+' '+(c.judge==='ok'?'改善':c.judge==='ng'?'未改善':'一部')+' '+c.note; }).join('\n'),
      p.result]);
  });
  downloadCsv('改善計画_'+todayStr()+'.csv', rows);
  toast('CSVを書き出しました','ok');
});
