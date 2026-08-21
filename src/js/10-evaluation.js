/* ============================================================
   10-evaluation.js  評価制度
   ============================================================ */

var evalSel = { period:null };

function currentPeriod(){ return evalSel.period || DB.data.settings.currentPeriod || quarterOf(todayStr()); }
function periodList(){
  var ps = uniq(DB.data.evaluations.map(function(e){ return e.period; }).concat([currentPeriod(), quarterOf(todayStr())]));
  return sortBy(ps, function(x){ return x; }).reverse();
}

VIEWS.evaluations = {
  title:'四半期評価',
  desc:'Week 5〜7で基準を確定し、Week 8〜12で初回試験評価。第1四半期は報酬に連動させません。',
  render:function(){
    var d = DB.data;
    var period = currentPeriod();
    var evs = d.evaluations.filter(function(e){ return e.period === period; });
    var h = '';

    /* 配点と4段階の定義 */
    h += '<div class="grid c2">';
    h += '<div>'+card('配点',
      '<div class="small muted">一般社員</div>'+
      EVAL_ITEMS_GENERAL.map(function(i){
        return '<div style="display:flex;gap:8px;align-items:center;padding:3px 0;">'+
          '<span style="width:180px;">'+esc(i.label)+'</span>'+progressBar(i.weight)+
          '<b class="mono" style="width:44px;text-align:right;">'+i.weight+'%</b></div>'; }).join('')+
      '<div class="sep"></div><div class="small muted">管理職</div>'+
      EVAL_ITEMS_MANAGER.map(function(i){
        return '<div style="display:flex;gap:8px;align-items:center;padding:3px 0;">'+
          '<span style="width:180px;">'+esc(i.label)+'</span>'+progressBar(i.weight)+
          '<b class="mono" style="width:44px;text-align:right;">'+i.weight+'%</b></div>'; }).join(''),
      {})+'</div>';
    h += '<div>'+card('4段階の定義',
      '<div class="rating-scale">'+RATING_DEFS.map(function(r){
        return '<div class="r"><b>'+r.v+'</b><div>'+esc(r.desc)+'</div></div>'; }).join('')+'</div>'+
      '<div class="sep"></div>'+
      '<div class="small muted">手順</div>'+
      '<div class="step-flow" style="margin-top:4px;">'+EVAL_STAGES.map(function(s,i){
        return '<span class="s">'+(i+1)+'. '+esc(s.label)+'</span>'; }).join('<span>→</span>')+'</div>',
      {sub:'点数ではなく「定義」で合わせる'})+'</div>';
    h += '</div>';

    /* 第1四半期の注意 */
    if(!d.settings.payLinked){
      h += '<div class="notice"><b>試験運用中（報酬に連動していません）。</b> '+
        '第1四半期は評価のみを行い、基準と評価者差を修正します。第2四半期以降、制度が安定した場合に賞与の一部への連動を検討してください。'+
        '報酬連動の前に、就業規則・賃金規程との整合を社労士等へ確認します。</div>';
    }else{
      h += '<div class="alert '+(d.settings.laborCheckDone?'warn':'bad')+'"><span class="ic">'+ic('alert',15)+'</span><div class="body">'+
        '<div class="t">報酬連動が有効になっています</div>'+
        '<div class="d">'+(d.settings.laborCheckDone?
          '就業規則等の確認済みとして記録されています。運用は慎重に。':
          '就業規則・賃金規程との整合が未確認です。減給・賞与・降格への連動前に社労士等へ確認してください。')+'</div></div>'+
        '<div class="go">'+btn('設定','go',{view:'settings'})+'</div></div>';
    }

    /* 操作バー */
    var opts = periodList().map(function(p){ return '<option value="'+esc(p)+'"'+(p===period?' selected':'')+'>'+esc(p)+'</option>'; }).join('');
    h += '<div class="card"><div class="card-body" style="padding:12px 16px;"><div class="inline-form">'+
      '<label>評価期間</label><select data-change="evalPeriod">'+opts+'</select>'+
      '<button class="btn primary" data-act="evalCreateAll">この期間の評価シートを一括作成</button>'+
      '<span style="flex:1"></span>'+
      '<button class="btn" data-act="evalCsv">CSVで書き出す</button>'+
      '<button class="btn" data-act="evalDist">評価者差を確認</button>'+
      '</div></div></div>';

    if(!evs.length){
      h += card(period+' の評価','<div class="empty"><div class="big">この期間の評価シートがありません</div>'+
        '<div>「一括作成」で全社員分の評価シートを作ります。管理職（部下がいる人）は自動で管理職用の配点になります。</div>'+
        '<div class="btn-row" style="justify-content:center;margin-top:10px;">'+
        '<button class="btn primary" data-act="evalCreateAll">評価シートを一括作成</button></div></div>',{tight:true});
      return h;
    }

    /* 進捗サマリー */
    var stageCount = {};
    EVAL_STAGES.forEach(function(s){ stageCount[s.key] = 0; });
    evs.forEach(function(e){ stageCount[e.stage||'self']++; });
    h += '<div class="grid c4" style="margin-bottom:18px;">'+
      EVAL_STAGES.slice(0,4).map(function(s){
        return tile(s.label, stageCount[s.key]+'<small>名</small>','',''); }).join('')+
      '</div>';

    /* 評価一覧 */
    var rows = sortBy(evs, function(e){ var emp = byId(d.employees, e.employeeId); return (emp?(emp.dept||'')+emp.name:''); });
    var cols = [
      { label:'社員', width:'150px', render:function(ev){
          var e = byId(d.employees, ev.employeeId);
          return '<b>'+esc(empName(ev.employeeId))+'</b><div class="small muted">'+esc(e?(e.dept||''):'')+
                 (e&&e.grade?' / '+esc(e.grade):'')+'</div>'; } },
      { label:'評価区分', width:'90px', render:function(ev){
          return badge(ev.type==='manager'?'管理職':'一般社員', ev.type==='manager'?'accent':'neutral'); } },
      { label:'自己評価', width:'80px', cls:'num', render:function(ev){
          var s = evalSelfScore(ev); return s===null?'<span class="muted">—</span>':'<span class="mono">'+s.toFixed(2)+'</span>'; } },
      { label:'上司評価', width:'80px', cls:'num', render:function(ev){
          var s = evalScore(ev); return s===null?'<span class="muted">—</span>':'<b class="mono">'+s.toFixed(2)+'</b>'; } },
      { label:'差', width:'60px', cls:'num', render:function(ev){
          var a = evalSelfScore(ev), b = evalScore(ev);
          if(a===null||b===null) return '<span class="muted">—</span>';
          var g = Math.round((b-a)*100)/100;
          return '<span class="'+(Math.abs(g)>=1?'badge warn':'mono')+'">'+(g>0?'+':'')+g.toFixed(2)+'</span>'; } },
      { label:'判定', width:'120px', render:function(ev){
          var g = evalGradeLabel(evalScore(ev)); return badge(g.label, g.cls); } },
      { label:'進行状況', render:function(ev){
          var idx = evalStageIndex(ev);
          return '<div class="step-flow">'+EVAL_STAGES.map(function(s,i){
            return '<span class="s '+(i<idx?'done':i===idx?'cur':'')+'">'+esc(s.label)+'</span>'; }).join('')+'</div>'; } },
      { label:'', cls:'actions', width:'190px', render:function(ev){
          var idx = evalStageIndex(ev);
          var next = idx < EVAL_STAGES.length-1 ? EVAL_STAGES[idx+1] : null;
          return btn('評価シート','evalOpen',{id:ev.id},'primary')+' '+
                 (next?btn(next.label+'へ','evalNext',{id:ev.id}):'')+' '+
                 '<span class="sep-x"></span>'+btn('削除','evalDel',{id:ev.id},'danger'); } }
    ];
    h += card(period+' の評価（'+evs.length+'名）', tableHtml(cols, rows, {}), {tight:true,
      sub:'自己評価 → 直属上司評価 → 管理職間で調整 → 確定 → 本人説明'});

    /* 低評価者と改善計画 */
    var low = evs.filter(function(ev){ var s = evalScore(ev); return s!==null && s < 2.75; });
    if(low.length){
      h += card('評価2以下の社員（'+low.length+'名）',
        '<div class="help-block">評価2は<b>翌月の改善項目を3つ以内</b>にします。評価1、または評価2が継続する場合は'+
        '<b>30〜60日の改善計画</b>を作成してください。</div>'+
        tableHtml([
          {label:'社員', render:function(ev){ return esc(empName(ev.employeeId)); }},
          {label:'点数', cls:'num', render:function(ev){ return evalScore(ev).toFixed(2); }},
          {label:'判定', render:function(ev){ var g=evalGradeLabel(evalScore(ev)); return badge(g.label,g.cls); }},
          {label:'改善計画', render:function(ev){
            return hasActivePlan(ev.employeeId) ? badge('作成済み','ok') :
              (needsImprovementPlan(ev.employeeId) ? badge('要作成','bad') : badge('翌月の改善項目3つ以内で対応','warn')); }},
          {label:'', cls:'actions', render:function(ev){
            return btn('改善計画を作る','impNewFor',{emp:ev.employeeId}); }}
        ], low, {}), {tight:true});
    }
    return h;
  }
};

action('evalPeriod', function(ds, el){ evalSel.period = el.value; render(); });

action('evalCreateAll', function(){
  var period = currentPeriod();
  var d = DB.data;
  if(!d.employees.length){ toast('先に社員を登録してください','bad'); return; }
  confirmDialog('評価シートの一括作成',
    period+' の評価シートを全社員分（'+d.employees.length+'名）作成します。\n'+
    '部下がいる社員は「管理職」の配点、それ以外は「一般社員」の配点で作成されます。\n\n'+
    '既に作成済みの社員はそのまま残ります。',
    function(){
      var n = 0;
      d.employees.forEach(function(e){
        if(d.evaluations.some(function(x){ return x.employeeId===e.id && x.period===period; })) return;
        d.evaluations.push({
          id:uid('ev'), employeeId:e.id, period:period,
          type: directReports(e.id).length > 0 ? 'manager' : 'general',
          evaluatorId: e.manager || '',
          selfScores:{}, selfComments:{}, scores:{}, comments:{},
          evidence:'', calibrationNote:'', finalNote:'', stage:'self', createdAt:nowIso()
        });
        n++;
      });
      DB.save(); render(); toast(n+'名分の評価シートを作成しました','ok');
    }, '作成する');
});

action('evalDel', function(ds){
  var ev = byId(DB.data.evaluations, ds.id); if(!ev) return;
  confirmDialog('評価シートの削除', empName(ev.employeeId)+'さんの'+ev.period+'の評価を削除します。よろしいですか？', function(){
    DB.data.evaluations = DB.data.evaluations.filter(function(x){ return x.id !== ev.id; });
    DB.save(); render(); toast('削除しました','ok');
  }, '削除する');
});

action('evalNext', function(ds){
  var ev = byId(DB.data.evaluations, ds.id); if(!ev) return;
  var idx = evalStageIndex(ev);
  if(idx >= EVAL_STAGES.length-1) return;
  var next = EVAL_STAGES[idx+1];
  /* 進める前の確認 */
  if(next.key === 'manager' && evalSelfScore(ev) === null){
    toast('自己評価が未入力です。評価シートで入力してください。','bad'); return;
  }
  if(next.key === 'calibration' && evalScore(ev) === null){
    toast('上司評価が未入力です。評価シートで入力してください。','bad'); return;
  }
  if(next.key === 'final' && !String(ev.evidence||'').trim()){
    toast('評価の根拠が未記入です。KPI・週次記録・1on1・成果物を根拠として記入してください。','bad'); return;
  }
  if(next.key === 'explained'){
    ev.explainedAt = todayStr();
  }
  ev.stage = next.key; DB.save(); render();
  toast(next.label+'にしました','ok');
});

/* ---------- 評価シート ---------- */
action('evalOpen', function(ds){
  var ev = byId(DB.data.evaluations, ds.id); if(!ev) return;
  var emp = byId(DB.data.employees, ev.employeeId);
  var items = evalItemsFor(ev.type);

  function scoreInput(name, key, val){
    return '<div class="score-input">'+RATING_DEFS.slice().reverse().map(function(r){
      return '<label title="'+esc(r.desc)+'"><input type="radio" name="'+name+'_'+key+'" value="'+r.v+'"'+
        (num(val)===r.v?' checked':'')+'><span>'+r.v+'</span></label>'; }).join('')+'</div>';
  }
  function section(title, prefix, scores, comments, note){
    return '<fieldset><legend>'+esc(title)+'</legend>'+
      (note?'<div class="small muted" style="margin-bottom:8px;">'+esc(note)+'</div>':'')+
      items.map(function(it){
        return '<div style="margin-bottom:12px;">'+
          '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">'+
            '<b style="min-width:200px;">'+esc(it.label)+'</b>'+
            '<span class="badge accent">'+it.weight+'%</span>'+
            '<div style="flex:1;min-width:180px;max-width:280px;">'+scoreInput(prefix, it.key, (scores||{})[it.key])+'</div>'+
          '</div>'+
          '<div class="small muted" style="margin:3px 0 4px;">'+esc(it.desc)+'</div>'+
          '<textarea name="'+prefix+'c_'+it.key+'" rows="2" placeholder="根拠（数字・事実・具体例）">'+esc((comments||{})[it.key]||'')+'</textarea>'+
        '</div>';
      }).join('')+'</fieldset>';
  }

  /* 参考情報：KPI・1on1・報告 */
  var refs = '';
  if(emp){
    var kpiRows = [];
    DB.data.kpiWeeks.forEach(function(w){
      w.rows.forEach(function(r){ if(r.owner === emp.id) kpiRows.push({w:w.weekOf, r:r}); });
    });
    var oo = DB.data.oneOnOnes.filter(function(o){ return o.employeeId === emp.id; });
    var promiseTotal = 0, promiseDone = 0;
    oo.forEach(function(o){ (o.promises||[]).forEach(function(p){ promiseTotal++; if(p.done) promiseDone++; }); });
    var myReports = DB.data.reports.filter(function(r){ return r.reporterId === emp.id; });
    var lateReports = myReports.filter(function(r){ return reportDeadlineStatus(r).cls === 'bad'; });
    refs = '<fieldset><legend>評価のもとになる記録（記憶ではなく、この記録を見ます）</legend>'+
      '<div class="grid c4" style="gap:10px;">'+
        tile('担当KPIの行数', kpiRows.length+'', '週次KPI会議での担当','')+
        tile('1on1実施', oo.length+'<small>回</small>','','')+
        tile('約束の達成', promiseTotal?Math.round(promiseDone/promiseTotal*100)+'<small>%</small>':'—', promiseDone+'/'+promiseTotal,'')+
        tile('報告の遅延', lateReports.length+'<small>件</small>', '報告'+myReports.length+'件中', lateReports.length?'bad':'ok')+
      '</div>'+
      (kpiRows.length ? '<div class="sep"></div>'+tableHtml([
        {label:'週', render:function(x){ return esc(x.w); }},
        {label:'指標', render:function(x){ return esc(x.r.indicator); }},
        {label:'目標', cls:'num', render:function(x){ return esc(x.r.target); }},
        {label:'実績', cls:'num', render:function(x){ return esc(x.r.actual); }},
        {label:'状態', render:function(x){ var k=KPI_STATUS.filter(function(y){return y.key===kpiRowStatus(x.r);})[0]; return badge(k.label,k.cls); }}
      ], kpiRows.slice(-10), {}) : '')+
      '</fieldset>';
  }

  var idx = evalStageIndex(ev);
  /* 自己評価を書いている間は、上司の評価も調整メモも見えないようにする。
     先に見えてしまうと、自己評価がそれに引きずられ、両者を突き合わせる意味がなくなる。 */
  var stage = ev.stage || 'self';
  var showMgr   = stage !== 'self';
  var showCalib = (stage === 'calib' || stage === 'final' || stage === 'explained');
  var showFinal = (stage === 'final' || stage === 'explained');

  var stageNote = '';
  if(!showMgr){
    stageNote = '<div class="notice"><b>いまは自己評価の段階です。</b>'+
      '上司の評価は、上司が入力して次の段階に進んだあとで表示されます。'+
      '自分の記録（KPI・1on1・成果物）を見ながら、4段階の定義に照らして点数を付けてください。</div>';
  }else if(!showFinal){
    stageNote = '<div class="notice"><b>本人への説明内容は、確定後に表示されます。</b>'+
      '調整の途中の記録は、決まってから伝えます。</div>';
  }

  var body =
    '<div class="step-flow" style="margin-bottom:14px;">'+EVAL_STAGES.map(function(s,i){
      return '<span class="s '+(i<idx?'done':i===idx?'cur':'')+'">'+esc(s.label)+'</span>'; }).join('')+'</div>'+
    stageNote+
    '<div class="help-block">配点：'+items.map(function(i){ return esc(i.label)+' '+i.weight+'%'; }).join(' ／ ')+
      '<br>点数は<b>4段階の定義</b>に照らして付けます。印象ではなく、KPI・週次の記録・1on1・成果物を根拠にします。</div>'+
    refs+
    '<form id="evForm">'+
      section('① 自己評価', 'self', ev.selfScores, ev.selfComments, '本人が記入します。')+
      (showMgr ? section('② 直属上司の評価', 'mgr', ev.scores, ev.comments,
                         '評価する人：'+(ev.evaluatorId?empName(ev.evaluatorId):'未設定')) : '')+
      (showMgr ?
      '<fieldset><legend>③ 根拠・調整・確定</legend>'+
        '<div class="field"><label>評価の根拠（必須）</label>'+
          '<textarea name="evidence" rows="3" placeholder="例：受注8件（目標8件）、週次の対策3件すべて期限内に完了、1on1で決めたこと4件中4件が完了">'+esc(ev.evidence||'')+'</textarea>'+
          '<div class="hint">記憶や直近の印象だけで動かさないようにします。KPI・週次の記録・1on1・成果物を根拠にします。</div></div>'+
        (showCalib ?
        '<div class="field"><label>評価者どうしの調整メモ</label>'+
          '<textarea name="calibrationNote" rows="2" placeholder="評価する人による甘さ・辛さの差を、どう調整したか">'+esc(ev.calibrationNote||'')+'</textarea></div>' : '')+
        (showFinal ?
        '<div class="field"><label>本人への説明内容</label>'+
          '<textarea name="finalNote" rows="3" placeholder="良かった点、次に期待すること、来期の重点（3つ以内）">'+esc(ev.finalNote||'')+'</textarea></div>' : '')+
      '</fieldset>' : '')+
    '</form>';

  openModal({
    title:'評価シート：'+empName(ev.employeeId)+'（'+ev.period+'）', wide:true,
    headNote:(ev.type==='manager'?'管理職':'一般社員')+'　'+EVAL_STAGES[idx].label,
    wide:true,
    body:body,
    foot:'<button class="btn left" data-act="evalPrint" data-id="'+ev.id+'">印刷</button>'+
         '<button class="btn" data-modal-close>閉じる</button>'+
         '<button class="btn primary" id="evSave">保存</button>',
    onMount:function(root){
      root.querySelector('#evSave').addEventListener('click', function(){
        var f = root.querySelector('#evForm');
        items.forEach(function(it){
          var s = f.querySelector('input[name="self_'+it.key+'"]:checked');
          var m = f.querySelector('input[name="mgr_'+it.key+'"]:checked');
          ev.selfScores = ev.selfScores||{}; ev.scores = ev.scores||{};
          ev.selfComments = ev.selfComments||{}; ev.comments = ev.comments||{};
          if(s) ev.selfScores[it.key] = num(s.value);
          if(m) ev.scores[it.key] = num(m.value);
          ev.selfComments[it.key] = f.querySelector('[name="selfc_'+it.key+'"]').value;
          ev.comments[it.key] = f.querySelector('[name="mgrc_'+it.key+'"]').value;
        });
        ev.evidence = f.querySelector('[name="evidence"]').value;
        ev.calibrationNote = f.querySelector('[name="calibrationNote"]').value;
        ev.finalNote = f.querySelector('[name="finalNote"]').value;
        DB.save(); closeModal(); render(); toast('保存しました','ok');
      });
    }
  });
});

action('evalPrint', function(ds){
  var ev = byId(DB.data.evaluations, ds.id); if(!ev) return;
  var items = evalItemsFor(ev.type);
  var score = evalScore(ev), self = evalSelfScore(ev);
  var rows = items.map(function(it){
    return '<tr><td>'+esc(it.label)+'</td><td class="num">'+it.weight+'%</td>'+
      '<td class="num">'+((ev.selfScores||{})[it.key]||'—')+'</td>'+
      '<td class="num">'+((ev.scores||{})[it.key]||'—')+'</td>'+
      '<td>'+esc((ev.comments||{})[it.key]||'')+'</td></tr>';
  }).join('');
  printHtml('評価シート '+empName(ev.employeeId),
    '<div class="card"><div class="card-head"><h2>'+esc(ev.period)+'　評価シート　'+esc(empName(ev.employeeId))+'</h2>'+
    '<span class="sub">'+(ev.type==='manager'?'管理職':'一般社員')+'</span></div><div class="card-body">'+
    '<table class="tbl"><thead><tr><th>評価項目</th><th class="num">配点</th><th class="num">自己</th><th class="num">上司</th><th>根拠・コメント</th></tr></thead>'+
    '<tbody>'+rows+'</tbody></table>'+
    '<div class="sep"></div><dl class="kv">'+
    '<dt>自己評価（加重平均）</dt><dd>'+(self!==null?self.toFixed(2):'—')+'</dd>'+
    '<dt>上司評価（加重平均）</dt><dd><b>'+(score!==null?score.toFixed(2):'—')+'</b>　'+esc(evalGradeLabel(score).label)+'</dd>'+
    '<dt>評価の根拠</dt><dd>'+(nl2br(ev.evidence)||'—')+'</dd>'+
    '<dt>調整メモ</dt><dd>'+(nl2br(ev.calibrationNote)||'—')+'</dd>'+
    '<dt>本人への説明</dt><dd>'+(nl2br(ev.finalNote)||'—')+'</dd>'+
    '<dt>進行状況</dt><dd>'+esc(EVAL_STAGES[evalStageIndex(ev)].label)+(ev.explainedAt?'（'+esc(ev.explainedAt)+'）':'')+'</dd>'+
    '</dl></div></div>');
});

/* 評価者差の確認（第12章：評価者差を修正する） */
action('evalDist', function(){
  var period = currentPeriod();
  var evs = DB.data.evaluations.filter(function(e){ return e.period===period && evalScore(e)!==null; });
  if(!evs.length){ toast('この期間に採点済みの評価がありません','bad'); return; }
  var byEvaluator = {};
  evs.forEach(function(ev){
    var k = ev.evaluatorId || '（評価者未設定）';
    byEvaluator[k] = byEvaluator[k] || [];
    byEvaluator[k].push(evalScore(ev));
  });
  var rows = Object.keys(byEvaluator).map(function(k){
    var arr = byEvaluator[k];
    var avg = arr.reduce(function(a,b){return a+b;},0)/arr.length;
    return { name: k==='（評価者未設定）'?k:empName(k), n:arr.length, avg:Math.round(avg*100)/100,
             min:Math.min.apply(null,arr), max:Math.max.apply(null,arr) };
  });
  var all = evs.map(function(e){ return evalScore(e); });
  var allAvg = all.reduce(function(a,b){return a+b;},0)/all.length;
  var dist = [0,0,0,0];
  all.forEach(function(s){
    if(s>=3.5) dist[3]++; else if(s>=2.75) dist[2]++; else if(s>=1.75) dist[1]++; else dist[0]++;
  });
  openModal({
    title:'評価者差の確認（'+period+'）', wide:true,
    body:'<div class="help-block">評価者ごとの平均点に大きな差がある場合、基準の理解がずれています。'+
      '管理職間の調整（キャリブレーション）で、<b>点数ではなく4段階の定義</b>を突き合わせてください。</div>'+
      '<div class="grid c4" style="margin-bottom:14px;">'+
        tile('全体平均', allAvg.toFixed(2), '対象'+all.length+'名','accent')+
        tile('4（上回る）', dist[3]+'名','','ok')+
        tile('3（期待どおり）', dist[2]+'名','','')+
        tile('2以下', (dist[1]+dist[0])+'名','',(dist[1]+dist[0])?'warn':'')+
      '</div>'+
      tableHtml([
        {label:'評価者', render:function(r){ return esc(r.name); }},
        {label:'人数', cls:'num', render:function(r){ return r.n; }},
        {label:'平均', cls:'num', render:function(r){
          var diff = r.avg - allAvg;
          return '<b>'+r.avg.toFixed(2)+'</b>'+(Math.abs(diff)>=0.5?' '+badge((diff>0?'+':'')+diff.toFixed(2)+' 差','warn'):''); }},
        {label:'最低', cls:'num', render:function(r){ return r.min.toFixed(2); }},
        {label:'最高', cls:'num', render:function(r){ return r.max.toFixed(2); }}
      ], rows, {}),
    foot:'<button class="btn" data-modal-close>閉じる</button>'
  });
});

action('evalCsv', function(){
  var period = currentPeriod();
  var evs = DB.data.evaluations.filter(function(e){ return e.period===period; });
  var maxItems = EVAL_ITEMS_MANAGER.length;
  var head = ['期間','社員','部署','等級','評価区分','評価者'];
  for(var i=1;i<=maxItems;i++) head.push('項目'+i,'配点'+i,'自己'+i,'上司'+i,'根拠'+i);
  head = head.concat(['自己評価','上司評価','判定','評価の根拠','調整メモ','本人説明','進行状況']);
  var rows = [head];
  evs.forEach(function(ev){
    var emp = byId(DB.data.employees, ev.employeeId);
    var items = evalItemsFor(ev.type);
    var r = [ev.period, empName(ev.employeeId), emp?emp.dept:'', emp?emp.grade:'',
             ev.type==='manager'?'管理職':'一般社員', ev.evaluatorId?empName(ev.evaluatorId):''];
    for(var i=0;i<maxItems;i++){
      var it = items[i];
      if(it) r.push(it.label, it.weight+'%', (ev.selfScores||{})[it.key]||'', (ev.scores||{})[it.key]||'', (ev.comments||{})[it.key]||'');
      else r.push('','','','','');
    }
    var s = evalScore(ev), sf = evalSelfScore(ev);
    r.push(sf!==null?sf.toFixed(2):'', s!==null?s.toFixed(2):'', evalGradeLabel(s).label,
           ev.evidence, ev.calibrationNote, ev.finalNote, EVAL_STAGES[evalStageIndex(ev)].label);
    rows.push(r);
  });
  downloadCsv('四半期評価_'+period+'.csv', rows);
  toast('CSVを書き出しました','ok');
});
