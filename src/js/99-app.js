/* ============================================================
   99-app.js  ナビゲーション・画面切替・起動
   ============================================================ */

var NAV = [
  { group:'全体' , items:[
    { key:'dashboard',   label:'ダッシュボード', ic:'■' },
    { key:'plan',        label:'90日計画',       ic:'▤' }
  ]},
  { group:'体制をつくる', items:[
    { key:'employees',   label:'社員・役割台帳', ic:'人' },
    { key:'org',         label:'組織・権限マップ', ic:'⑃' },
    { key:'scorecards',  label:'職種別役割表',   ic:'▣' }
  ]},
  { group:'数字で動かす', items:[
    { key:'goals',       label:'会社・部門目標', ic:'◎' },
    { key:'kpi',         label:'週次KPI会議',    ic:'▲' }
  ]},
  { group:'人を育てる・評価する', items:[
    { key:'delegation',  label:'委任カード',     ic:'⇢' },
    { key:'oneonone',    label:'月次1on1',       ic:'話' },
    { key:'evaluations', label:'四半期評価',     ic:'★' },
    { key:'grades',      label:'等級制度',       ic:'G' },
    { key:'improvement', label:'改善計画',       ic:'↑' }
  ]},
  { group:'ルールを守る', items:[
    { key:'reports',     label:'報告・承認ルール', ic:'!' },
    { key:'decisions',   label:'意思決定の防波堤', ic:'⏸' },
    { key:'capital',     label:'資本配分・関係者', ic:'¥' }
  ]},
  { group:'経営を点検する', items:[
    { key:'diagnosis',   label:'経営の健全度診断', ic:'◈' }
  ]},
  { group:'その他', items:[
    { key:'settings',    label:'設定・データ',   ic:'⚙' }
  ]}
];

var currentView = 'dashboard';

function navCount(key){
  var d = DB.data;
  switch(key){
    case 'employees':   return d.employees.length;
    case 'goals':       return d.goals.length;
    case 'scorecards':  return d.scorecards.length;
    case 'kpi':         return d.kpiWeeks.length;
    case 'oneonone':    return d.oneOnOnes.filter(function(o){ return o.month === monthStr(); }).length;
    case 'evaluations': return d.evaluations.filter(function(e){ return e.period === currentPeriod(); }).length;
    case 'improvement': return d.improvementPlans.filter(function(p){ return p.status !== 'closed'; }).length;
    case 'reports':     return d.reports.length;
    case 'delegation':  return d.delegations.filter(function(x){ return !x.state || x.state==='open'; }).length;
    case 'decisions':   return d.decisions.filter(function(x){ return x.stage!=='decided' && x.stage!=='dropped'; }).length;
    case 'capital':     return d.partners.length;
    default: return 0;
  }
}

function renderNav(){
  var alerts = buildAlerts();
  var badCount = {};
  alerts.forEach(function(a){ if(a.level==='bad') badCount[a.view] = (badCount[a.view]||0)+1; });

  var h = '';
  NAV.forEach(function(g){
    h += '<div class="nav-group">'+esc(g.group)+'</div>';
    g.items.forEach(function(it){
      var n = navCount(it.key);
      var bad = badCount[it.key];
      h += '<div class="nav-item '+(currentView===it.key?'active':'')+'" data-act="go" data-view="'+it.key+'">'+
        '<span class="ic">'+it.ic+'</span><span>'+esc(it.label)+'</span>'+
        (bad ? '<span class="count" style="background:#c8352b;color:#fff;">'+bad+'</span>' :
         (n ? '<span class="count">'+n+'</span>' : ''))+
        '</div>';
    });
  });
  return h;
}

function render(){
  var v = VIEWS[currentView] || VIEWS.dashboard;
  document.getElementById('nav').innerHTML = renderNav();

  var d = DB.data;
  var company = d.settings.companyName;
  document.getElementById('brandTitle').textContent = company || '評価制度・組織管理';
  document.getElementById('brandSub').textContent = company ? '評価制度・組織管理体制' : '90日導入プロジェクト';

  document.getElementById('topTitle').textContent = v.title;
  document.getElementById('topDesc').textContent = v.desc || '';

  var pd = projectDay();
  var r = readinessScore();
  document.getElementById('topMeta').innerHTML =
    (pd.day>0 ? '<span class="badge accent">Week '+pd.week+'／'+pd.day+'日目</span> ' : '')+
    '<span class="badge '+(r.total>=80?'ok':r.total>=50?'warn':'bad')+'">導入完成度 '+r.total+'%</span> '+
    '<span id="syncBadge">'+(typeof syncStatusHtml==='function'?syncStatusHtml():'')+'</span>';

  var foot = document.getElementById('sideFoot');
  if(foot){
    var mode = (typeof SYNC !== 'undefined') ? SYNC.cfg.mode : 'local';
    foot.innerHTML = mode === 'folder'
      ? '会社の共有フォルダと同期しています。<br>週に1回はバックアップも保存してください。'
      : mode === 'server'
      ? '共有サーバーと同期しています。<br>週に1回はバックアップも保存してください。'
      : 'データはこのPCのブラウザ内に保存されます。<br>定期的にバックアップを保存してください。';
  }

  var view = document.getElementById('view');
  view.innerHTML = v.render();
  view.scrollTop = 0;
  window.scrollTo(0,0);
  document.title = v.title + '｜' + (company ? company+' ' : '') + '評価制度・組織管理体制';
}

action('go', function(ds){
  if(!VIEWS[ds.view]) return;
  if(ds.tab && VIEWS[ds.view].setTab) VIEWS[ds.view].setTab(ds.tab);
  currentView = ds.view;
  closeAllModals();
  try{ location.hash = '#'+ds.view; }catch(e){}
  render();
});

window.addEventListener('hashchange', function(){
  var v = location.hash.replace('#','');
  if(v && VIEWS[v] && v !== currentView){ currentView = v; render(); }
});

/* 印刷ボタン（現在の画面） */
action('printView', function(){ window.print(); });

/* ---------- 起動 ---------- */
function boot(){
  if(typeof syncLoadCfg === 'function') syncLoadCfg();
  DB.load();
  var v = location.hash.replace('#','');
  if(v && VIEWS[v]) currentView = v;
  render();
  if(typeof syncInit === 'function') syncInit();

  /* 未保存のまま閉じる事故を防ぐため、変更のたびに保存している旨をログに残す */
  console.log('%c'+APP_NAME+' v'+APP_VERSION,
    'font-weight:bold;color:#0f4c81;',
    '\nデータはこのブラウザ内（localStorage）に保存されます。定期的に「設定・データ」からバックアップを保存してください。');
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
