/* ============================================================
   04-dashboard.js  ダッシュボード
   ============================================================ */

var VIEWS = {};   /* 画面の登録先 */

VIEWS.dashboard = {
  title:'会社全体',
  desc:'会社全体のいまの状態と、次にやることが1画面で分かります。',
  render:function(){
    var d = DB.data;
    var r = readinessScore();
    var alerts = buildAlerts();
    var pd = projectDay();
    var pp = planProgress();
    var h = '';

    /* このパソコンで初めて開いた人に案内を出す。
       ただし、まだ何も登録されていないときは、下の「ようこそ」に任せる */
    var isNew = !d.settings.companyName && !d.employees.length;
    if(!seenIntro() && !isNew){
      h += renderIntroCard();
    }

    if(isNew){
      h += '<div class="notice">'+
        '<b>ようこそ。</b> このアプリは、役割・目標・数字・報告のルールを1か所にまとめて、'+
        'チーム全員が同じ情報を見ながら会社を動かすための道具です。'+
        'まず <b>設定</b> で会社名を入れ、次に <b>社員・役割台帳</b> にメンバーを登録してください。'+
        '<div class="btn-row" style="margin-top:9px;">'+
        '<button class="btn primary" data-act="go" data-view="settings">'+ic('settings',14)+'① 設定を開く</button>'+
        '<button class="btn" data-act="go" data-view="employees">'+ic('users',14)+'② メンバーを登録する</button>'+
        '<button class="btn" data-act="loadDemo">'+ic('sparkle',14)+'操作を試す（サンプルデータを入れる）</button>'+
        '<a class="btn" href="'+GUIDE_URL+'" target="_blank" rel="noopener">'+ic('play',14)+'使い方の動画を見る（約17分）</a>'+
        '</div></div>';
    }

    /* --- 上段タイル --- */
    var badCount = alerts.filter(function(a){return a.level==='bad';}).length;
    h += '<div class="section-title">いまの状態</div>';
    h += '<div class="grid c4">'+
      tile('台帳と記録の充実度', r.total+'<small>%</small>',
           progressBar(r.total, r.total>=80?'ok':r.total>=50?'warn':'bad'),
           r.total>=80?'ok':r.total>=50?'warn':'bad', 'clipboard')+
      tile('導入からの経過', pd.day>0? pd.day+'<small>日目</small>' : '<small>未開始</small>',
           pd.day>0 ? ('Week '+pd.week+' / 90日中 残り'+Math.max(0,90-pd.day)+'日') : '設定で開始日を入力',
           'accent', 'calendar')+
      tile('導入の進み具合', pp.rate+'<small>%</small>',
           pp.done+' / '+pp.total+' 項目'+
           '<div class="foot">'+btn('導入の段取りを見る','go',{view:'plan'},'','arrowRight')+'</div>',
           pp.rate>=80?'ok':pp.rate>=40?'warn':'bad', 'route')+
      tile('いま手を打つこと', badCount+'<small>件</small>',
           'あわせて確認 '+alerts.filter(function(a){return a.level==='warn';}).length+'件',
           badCount? 'bad':'ok', 'alert')+
      '</div>';

    /* --- 対応すること --- */
    h += '<div class="section-title">気づいたこと'+
         '<span class="note">上から順に片づけていけば大丈夫です</span></div>';

    var parts = '<table class="tbl"><tbody>';
    r.parts.forEach(function(p){
      parts += '<tr><td style="width:150px;">'+esc(p.label)+'</td>'+
        '<td>'+(p.na ? '<span class="small muted">まだ記録がありません</span>'
                     : progressBar(p.rate, p.rate>=80?'ok':p.rate>=40?'warn':'bad'))+'</td>'+
        '<td class="num mono" style="width:52px;">'+(p.na?'—':p.rate+'%')+'</td>'+
        '<td class="actions" style="width:70px;">'+btn('開く','go',{view:p.view})+'</td></tr>';
    });
    parts += '</tbody></table>';

    h += '<div class="grid c21">'+
      '<div class="col">'+
        card('いま気になっていること', renderAlerts(alerts), {
          icon:'alert',
          sub: alerts.length ? alerts.length+'件' : '気になる点はありません' })+
      '</div>'+
      '<div class="col">'+
        renderTodayFocus()+
        card('6つの記録の埋まり具合', parts, {icon:'clipboard', tight:true})+
        renderRecentActivity()+
      '</div>'+
    '</div>';

    /* --- 正の循環（先行指標） --- */
    h += '<div class="section-title">良い流れの手ごたえ'+
         '<span class="note">売上より先に動く6つの数字</span></div>';
    h += renderCycleSnapshot();

    /* --- 今週の会議・1on1 --- */
    h += '<div class="section-title">今週と今月</div>';
    /* カード1枚ずつなので、グリッドに直接置いて高さをそろえる */
    h += '<div class="grid c2">'+ renderWeeklySnapshot() + renderPeopleSnapshot() +'</div>';

    return h;
  }
};

function renderAlerts(alerts){
  if(!alerts.length){
    return '<div class="alert ok"><span class="ic">'+ic('check',15)+'</span>'+
           '<div class="body"><div class="t">いま気になる点はありません</div>'+
           '<div class="d">この状態を保ちましょう。週次KPI会議と月次1on1の記録を続けてください。</div></div></div>';
  }
  var h = '';
  alerts.slice(0,10).forEach(function(a){
    h += '<div class="alert '+a.level+'">'+
      '<span class="ic">'+ic(a.level==='bad'?'alert':'info',15)+'</span>'+
      '<div class="body"><div class="t">'+esc(a.title)+'</div>'+
      '<div class="d">'+esc(a.detail)+'</div></div>'+
      '<div class="go">'+btn('開く','go',a.tab?{view:a.view,tab:a.tab}:{view:a.view},'','arrowRight')+'</div></div>';
  });
  if(alerts.length > 10)
    h += '<div class="small muted center" style="padding-top:6px;">'+
         'ほか '+(alerts.length-10)+'件。上から順に片づけると、下の項目も一緒に消えていきます。</div>';
  return h;
}

/* 今日の焦点：着手順（第15章）の未完了の先頭 */
function renderTodayFocus(){
  var fs = DB.data.firstSteps || {};
  var next = -1;
  for(var i=0;i<FIRST_STEPS.length;i++){ if(!fs[i]){ next = i; break; } }
  var body;
  if(next < 0){
    body = '<div class="alert ok"><span class="ic">'+ic('check',15)+'</span>'+
           '<div class="body"><div class="t">最初の10項目はすべて完了しています</div>'+
           '<div class="d">ここからは運用です。週次KPI・月次1on1・四半期評価を続けてください。</div></div></div>';
  }else{
    body = '<div class="small muted" style="margin-bottom:4px;">次にやること</div>'+
      '<div class="headline" style="font-size:var(--fs-lg);">'+(next+1)+'. '+esc(FIRST_STEPS[next])+'</div>'+
      '<div class="btn-row" style="margin-top:10px;">'+
        '<button class="btn primary" data-act="doneFirstStep" data-i="'+next+'">完了にする</button>'+
        '<button class="btn" data-act="go" data-view="plan">導入の段取りを見る</button>'+
      '</div>';
  }
  var doneN = Object.keys(fs).filter(function(k){ return fs[k]; }).length;
  return card('次の一手', body, {icon:'route', sub:FIRST_STEPS.length+'ステップ中 '+doneN+'つ完了'});
}

/* 最近の動き（誰が何を記録したかを、日付順に並べる） */
function renderRecentActivity(){
  var d = DB.data, items = [];
  function add(when, what, view){
    if(when) items.push({ when:String(when), what:what, view:view });
  }
  d.reports.forEach(function(r){ add(r.reportedAt||r.requestedAt, '報告：'+r.title, 'reports'); });
  d.incidents.forEach(function(r){ add(r.date, '問題処理：'+r.title, 'reports'); });
  d.oneOnOnes.forEach(function(o){ add(o.date, '1on1：'+empName(o.employeeId), 'oneonone'); });
  d.kpiWeeks.forEach(function(w){ add(w.weekOf, '週次KPI会議（'+w.weekOf+'の週）', 'kpi'); });
  d.evaluations.forEach(function(e){ if(e.stage==='explained') add(e.createdAt, '評価の説明完了：'+empName(e.employeeId), 'evaluations'); });
  d.decisions.forEach(function(x){ add(x.decidedAt||x.raisedAt, '重要な決定：'+x.title, 'decisions'); });
  d.ventures.forEach(function(x){ add(x.decidedAt||x.raisedAt, '新規案件：'+x.title, 'decisions'); });
  d.delegations.forEach(function(x){
    add(x.startDate, '委任：'+x.title, 'delegation');
    (x.checks||[]).forEach(function(c){ if(c.doneAt) add(c.doneAt, '中間確認：'+x.title, 'delegation'); });
  });
  d.partners.forEach(function(x){ if(x.lastCheck) add(x.lastCheck, '関係者の定期確認：'+x.name, 'capital'); });
  ((d.capital||{}).spends||[]).forEach(function(x){ add(x.date, '支出：'+x.title, 'capital'); });
  d.improvementPlans.forEach(function(x){ add(x.startDate, '改善計画：'+empName(x.employeeId), 'improvement'); });

  items = sortBy(items, function(i){ return i.when; }).reverse().slice(0,8);

  if(!items.length) return '';        /* 何も記録がないうちは出さない */

  var body = '<table class="tbl"><tbody>'+items.map(function(i){
    return '<tr><td class="small muted nowrap" style="width:52px;">'+esc(shortDate(i.when))+'</td>'+
           '<td class="small">'+esc(i.what)+'</td>'+
           '<td class="actions" style="width:56px;">'+btn('開く','go',{view:i.view})+'</td></tr>';
  }).join('')+'</tbody></table>';

  return card('最近の動き', body, { tight:true, sub:'新しい順' });
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
      '<div class="headline">'+esc(m[x.key].value)+'</div>'+
      (s===null ? '<div class="note">記録が貯まると測れます</div>'
                : progressBar(s, scoreCls(s))+'<div class="note">'+esc(m[x.key].note)+'</div>')+
      '<div class="foot">'+btn(x.label+'を開く','go',{view:x.view})+'</div>'+
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
      body += '<div class="alert ok"><span class="ic">'+ic('check',15)+'</span><div class="body"><div class="t">未達・注意の項目はありません</div></div></div>';
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

  /* 定着（育った人に残る理由を示せているか） */
  var others = d.employees.filter(function(e){ return !e.isTop; });
  var noPath = others.filter(function(e){ return !String(e.nextRole||'').trim(); });
  if(others.length){
    body += '<div class="small muted" style="margin-bottom:6px;">将来の役割・権限を示せている社員</div>'+
      progressBar(Math.round((others.length-noPath.length)/others.length*100),
                  noPath.length?'warn':'ok')+
      '<div class="small muted" style="margin:4px 0 12px;">'+
      (noPath.length ? '未提示 '+noPath.length+'名：'+esc(noPath.slice(0,4).map(function(e){return e.name;}).join('、'))+
                       (noPath.length>4?' ほか':'')
                     : '全員に将来像を示せています')+'</div>';
  }

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
    body += '<div class="alert ok"><span class="ic">'+ic('check',15)+'</span><div class="body"><div class="t">全社員の台帳が埋まっています</div>'+
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

/* ============================================================
   はじめての人への案内
   共有で後から参加した人にも出るよう、データの有無ではなく
   「このパソコンで読んだかどうか」で判定する。
   ============================================================ */
var INTRO_KEY = 'hyokaSeido_intro_v2';

function seenIntro(){
  try{ return localStorage.getItem(INTRO_KEY) === '1'; }catch(e){ return true; }
}
function setSeenIntro(v){
  try{ v ? localStorage.setItem(INTRO_KEY,'1') : localStorage.removeItem(INTRO_KEY); }catch(e){}
}

function renderIntroCard(){
  var mine = (typeof myEmpId === 'function' && myEmpId()) ? empName(myEmpId()) : '';
  return '<div class="intro-card">'+
    '<div class="ic">'+ic('sparkle',20)+'</div>'+
    '<div class="tx">'+
      '<div class="t">はじめての方へ</div>'+
      '<div class="d">このアプリは、会社の目標・毎週の数字・1on1・評価を、'+
      '<b>全員が同じ記録を見ながら</b>進めるための道具です。'+
      '毎週の入力は数分で終わります。'+
      (mine ? '' : '<br>まず「わたしの画面」で自分を選ぶと、自分に関係するものだけが表示されます。')+
      '</div>'+
      '<div class="btn-row">'+
        '<button class="btn primary" data-act="go" data-view="me">'+ic('home',14)+'わたしの画面を開く</button>'+
        '<a class="btn" href="'+GUIDE_URL+'" target="_blank" rel="noopener">'+ic('play',14)+'使い方の動画を見る</a>'+
        '<button class="btn ghost" data-act="introClose">'+ic('check',14)+'わかりました</button>'+
      '</div>'+
    '</div></div>';
}

action('introClose', function(){
  setSeenIntro(true);
  render();
  toast('この案内は「設定・データ」からいつでも開けます');
});
action('introShow', function(){
  setSeenIntro(false);
  currentView = 'dashboard';
  render();
});
