/* ============================================================
   04-dashboard.js  ダッシュボード
   ============================================================ */

var VIEWS = {};   /* 画面の登録先 */

VIEWS.dashboard = {
  title:'ダッシュボード',
  desc:'いまの状態と、次にやることが1画面で分かります。',
  render:function(){
    var d = DB.data;
    var r = readinessScore();
    var alerts = buildAlerts();
    var pd = projectDay();
    var pp = planProgress();
    var h = '';

    /* 会社名が未設定なら最初の案内 */
    if(!d.settings.companyName && !d.employees.length){
      h += '<div class="notice">'+
        '<b>はじめに。</b> このアプリは「評価制度・組織管理体制 90日導入プロジェクト指示書」を、そのまま運用するための道具です。'+
        'まず <b>設定</b> で会社名とプロジェクト責任者を入力し、次に <b>社員・役割台帳</b> に全社員を登録してください。'+
        '<div class="btn-row" style="margin-top:9px;">'+
        '<button class="btn primary" data-act="go" data-view="settings">① 設定を開く</button>'+
        '<button class="btn" data-act="go" data-view="employees">② 社員を登録する</button>'+
        '<button class="btn" data-act="loadDemo">操作を試す（サンプルデータを入れる）</button>'+
        '<a class="btn" href="'+GUIDE_URL+'" target="_blank" rel="noopener">使い方レクチャーを見る（動画・約13分）</a>'+
        '</div></div>';
    }

    /* --- 上段タイル --- */
    var badCount = alerts.filter(function(a){return a.level==='bad';}).length;
    h += '<div class="grid c4" style="margin-bottom:18px;">'+
      tile('導入完成度', r.total+'<small>%</small>',
           progressBar(r.total, r.total>=80?'ok':r.total>=50?'warn':'bad'),
           r.total>=80?'ok':r.total>=50?'warn':'bad')+
      tile('プロジェクト経過', pd.day>0? pd.day+'<small>日目</small>' : '<small>未開始</small>',
           pd.day>0 ? ('Week '+pd.week+' / 90日中 残り'+Math.max(0,90-pd.day)+'日') : '設定で開始日を入力',
           'accent')+
      tile('90日チェックリスト', pp.rate+'<small>%</small>', pp.done+' / '+pp.total+' 項目',
           pp.rate>=80?'ok':pp.rate>=40?'warn':'bad')+
      tile('要対応（ルール違反・停止要因）', badCount+'<small>件</small>',
           '注意 '+alerts.filter(function(a){return a.level==='warn';}).length+'件',
           badCount? 'bad':'ok')+
      '</div>';

    /* --- 今週やること --- */
    h += '<div class="grid c2">';
    h += '<div>' + card('いま対応すべきこと', renderAlerts(alerts), {
      sub: alerts.length ? alerts.length+'件' : '問題は検出されていません'
    }) + '</div>';

    /* --- 整備状況の内訳 --- */
    var parts = '<table class="tbl"><tbody>';
    r.parts.forEach(function(p){
      parts += '<tr><td style="width:150px;">'+esc(p.label)+'</td>'+
        '<td>'+(p.na ? '<span class="small muted">まだ記録がありません</span>'
                     : progressBar(p.rate, p.rate>=80?'ok':p.rate>=40?'warn':'bad'))+'</td>'+
        '<td class="num mono" style="width:52px;">'+(p.na?'—':p.rate+'%')+'</td>'+
        '<td class="actions" style="width:70px;">'+btn('開く','go',{view:p.view})+'</td></tr>';
    });
    parts += '</tbody></table>';
    h += '<div>' + card('6つのシートの整備状況', parts, {tight:true,
      sub:'指示書 第16章'}) + renderTodayFocus() + '</div>';
    h += '</div>';

    /* --- 正の循環（先行指標） --- */
    h += renderCycleSnapshot();

    /* --- 今週の会議・1on1 --- */
    h += '<div class="grid c2">'+
      '<div>'+renderWeeklySnapshot()+'</div>'+
      '<div>'+renderPeopleSnapshot()+'</div>'+
    '</div>';

    return h;
  }
};

function renderAlerts(alerts){
  if(!alerts.length){
    return '<div class="alert ok"><span class="ic">✓</span><div><div class="t">未対応の指摘はありません</div>'+
           '<div class="d">この状態を維持してください。週次KPI会議と月次1on1の記録を続けます。</div></div></div>';
  }
  var h = '';
  alerts.slice(0,14).forEach(function(a){
    h += '<div class="alert '+a.level+'">'+
      '<span class="ic">'+(a.level==='bad'?'!':'▲')+'</span>'+
      '<div style="flex:1;min-width:0;"><div class="t">'+esc(a.title)+'</div>'+
      '<div class="d">'+esc(a.detail)+'</div></div>'+
      '<div class="go">'+btn('対応','go',{view:a.view})+'</div></div>';
  });
  if(alerts.length > 14) h += '<div class="small muted center">ほか '+(alerts.length-14)+'件</div>';
  return h;
}

/* 今日の焦点：着手順（第15章）の未完了の先頭 */
function renderTodayFocus(){
  var fs = DB.data.firstSteps || {};
  var next = -1;
  for(var i=0;i<FIRST_STEPS.length;i++){ if(!fs[i]){ next = i; break; } }
  var body;
  if(next < 0){
    body = '<div class="alert ok"><span class="ic">✓</span><div><div class="t">着手順10項目はすべて完了しています</div>'+
           '<div class="d">運用フェーズです。週次KPI・月次1on1・四半期評価を回してください。</div></div></div>';
  }else{
    body = '<div style="font-size:13px;color:#6a7789;margin-bottom:4px;">次にやること（指示書 第15章）</div>'+
      '<div style="font-size:17px;font-weight:700;line-height:1.5;">'+(next+1)+'. '+esc(FIRST_STEPS[next])+'</div>'+
      '<div class="btn-row" style="margin-top:10px;">'+
        '<button class="btn primary" data-act="doneFirstStep" data-i="'+next+'">完了にする</button>'+
        '<button class="btn" data-act="go" data-view="plan">90日計画を見る</button>'+
      '</div>';
  }
  return card('次の一手', body, {sub:'着手順 '+Object.keys(fs).filter(function(k){return fs[k];}).length+' / '+FIRST_STEPS.length});
}

/* 正の循環メーター（構造分析レポート 表7の先行指標） */
function renderCycleSnapshot(){
  var m = leadingMetrics();
  var total = positiveCycleScore();
  var body = '';

  body += '<div class="help-block">'+
    '売上は<b>結果</b>なので、動き出したかどうかを早く教えてくれません。'+
    'ここに出る6つは、正の循環が始まった証拠として先に動く数字です。'+
    '</div>';

  body += '<div class="grid c3">';
  LEADING_INDICATORS.forEach(function(x){
    var s = m[x.key].score;
    body += '<div class="tile '+(s===null?'':scoreCls(s))+'">'+
      '<div class="label">'+esc(x.label)+'</div>'+
      '<div style="font-size:15px;font-weight:700;margin:3px 0 5px;line-height:1.4;">'+esc(m[x.key].value)+'</div>'+
      (s===null ? '<div class="note">記録が貯まると測れます</div>'
                : progressBar(s, scoreCls(s))+'<div class="note">'+esc(m[x.key].note)+'</div>')+
      '<div style="margin-top:7px;">'+btn('開く','go',{view:x.view})+'</div>'+
      '</div>';
  });
  body += '</div>';

  return card('正の循環メーター', body, {
    sub: total===null ? '記録待ち' : '正の循環スコア '+total+'%',
    tools: btn('健全度診断を開く','go',{view:'diagnosis'},'primary')
  });
}

function renderWeeklySnapshot(){
  var w = latestKpiWeek();
  var body;
  if(!w){
    body = '<div class="empty"><div class="big">週次KPI会議の記録がありません</div>'+
           '<div>Week 3〜5 で開始します。45分以内・未達項目中心で運用してください。</div>'+
           '<div class="btn-row" style="justify-content:center;margin-top:10px;">'+
           '<button class="btn primary" data-act="go" data-view="kpi">KPI会議を始める</button></div></div>';
  }else{
    var s = kpiWeekSummary(w);
    body = '<div class="grid c4" style="gap:10px;margin-bottom:12px;">'+
      tile('達成', s.ok+'', '', 'ok')+ tile('注意', s.watch+'', '', 'warn')+
      tile('未達', s.ng+'', '', 'bad')+ tile('未入力', s.none+'', '', '')+'</div>';
    var rows = w.rows.filter(function(r){ var st=kpiRowStatus(r); return st==='ng'||st==='watch'; });
    if(rows.length){
      body += tableHtml([
        {label:'指標', key:'indicator'},
        {label:'目標', cls:'num', render:function(r){ return esc(r.target); }},
        {label:'実績', cls:'num', render:function(r){ return esc(r.actual); }},
        {label:'状態', render:function(r){ var st=kpiRowStatus(r); var k=KPI_STATUS.filter(function(x){return x.key===st;})[0]; return badge(k.label,k.cls); }},
        {label:'対策', render:function(r){ return r.action ? esc(r.action) : badge('未記入','bad'); }},
        {label:'担当/期限', render:function(r){
          return esc(r.owner?empName(r.owner):'担当未定')+'<br><span class="small muted">'+esc(r.due||'期限未定')+'</span>'; }}
      ], rows, {});
    }else{
      body += '<div class="alert ok"><span class="ic">✓</span><div><div class="t">未達・注意の項目はありません</div></div></div>';
    }
  }
  return card('直近の週次KPI会議', body, {
    sub: w ? w.weekOf+' の週' : '未実施',
    tools: btn('KPI画面へ','go',{view:'kpi'})
  });
}

function renderPeopleSnapshot(){
  var d = DB.data;
  var oo = oneOnOneRate();
  var body = '';
  body += '<div class="grid c3" style="gap:10px;margin-bottom:12px;">'+
    tile('社員数', d.employees.length+'<small>名</small>','','accent')+
    tile('今月の1on1', oo.done+'<small>/'+oo.total+'</small>', oo.rate+'%', oo.rate>=90?'ok':oo.rate>=50?'warn':'bad')+
    tile('管理職', d.employees.filter(function(e){return directReports(e.id).length>0;}).length+'<small>名</small>','','')+
    '</div>';

  var risky = d.employees.map(function(e){
    var st = ledgerStatus(e);
    return { e:e, st:st };
  }).filter(function(x){ return x.st.rate < 100; });
  risky = sortBy(risky, function(x){ return x.st.rate; }).slice(0,6);

  if(risky.length){
    body += '<div class="small muted" style="margin-bottom:6px;">台帳の記入が不足している社員（上位6名）</div>';
    body += tableHtml([
      {label:'氏名', render:function(x){ return esc(x.e.name)+'<div class="small muted">'+esc(x.e.dept||'')+'</div>'; }},
      {label:'記入率', render:function(x){ return progressBar(x.st.rate, x.st.rate>=80?'ok':x.st.rate>=40?'warn':'bad')+
        '<span class="small mono">'+x.st.rate+'%</span>'; }, width:'130px'},
      {label:'不足している項目', render:function(x){ return '<span class="small">'+esc(x.st.missing.join('、'))+'</span>'; }},
      {label:'', cls:'actions', render:function(x){ return btn('編集','empEdit',{id:x.e.id}); }}
    ], risky, {});
  }else if(d.employees.length){
    body += '<div class="alert ok"><span class="ic">✓</span><div><div class="t">全社員の台帳が埋まっています</div>'+
            '<div class="d">Week 1 の完成条件を満たしています。</div></div></div>';
  }else{
    body += '<div class="empty"><div class="big">社員が未登録です</div><div>まず全社員一覧を作ります。</div>'+
            '<div class="btn-row" style="justify-content:center;margin-top:10px;">'+
            '<button class="btn primary" data-act="go" data-view="employees">社員を登録する</button></div></div>';
  }
  return card('人と台帳の状況', body, {tools: btn('台帳へ','go',{view:'employees'})});
}

action('doneFirstStep', function(ds){
  DB.data.firstSteps[ds.i] = true;
  DB.save(); render();
  toast('完了にしました：'+FIRST_STEPS[ds.i], 'ok');
});
