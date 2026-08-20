/* ============================================================
   99-app.js  ナビゲーション・画面切替・起動
   ============================================================ */

var NAV = [
  { group:'' , items:[
    { key:'me',          label:'わたしの画面',     icon:'home' },
    { key:'dashboard',   label:'会社全体',         icon:'chart' }
  ]},
  { group:'毎週・毎月つかう', items:[
    { key:'kpi',         label:'週次KPI会議',      icon:'trending' },
    { key:'delegation',  label:'仕事の任せ方',     icon:'handoff' },
    { key:'oneonone',    label:'月次1on1',         icon:'chat' },
    { key:'reports',     label:'報告・承認ルール', icon:'bell' }
  ]},
  { group:'折々につかう', items:[
    { key:'evaluations', label:'四半期評価',       icon:'star' },
    { key:'goals',       label:'会社・部門目標',   icon:'target' },
    { key:'improvement', label:'改善サポート',     icon:'rise' },
    { key:'decisions',   label:'重要な決定',       icon:'shield' }
  ]},
  { group:'台帳と基準', items:[
    { key:'employees',   label:'社員・役割台帳',   icon:'users' },
    { key:'org',         label:'組織・権限マップ', icon:'sitemap' },
    { key:'scorecards',  label:'職種別役割表',     icon:'clipboard' },
    { key:'grades',      label:'等級制度',         icon:'layers' }
  ]},
  { group:'経営の振り返り', items:[
    { key:'capital',     label:'お金の使い道',     icon:'wallet' },
    { key:'diagnosis',   label:'組織の健康診断',   icon:'pulse' }
  ]},
  { group:'', items:[
    { key:'settings',    label:'設定・データ',     icon:'settings' }
  ]}
];

var currentView = 'me';

function navCount(key){
  var d = DB.data;
  switch(key){
    case 'me': {
      if(typeof myEmpId !== 'function' || !myEmpId()) return 0;
      var n = myOpenActions().filter(function(a){ return a.due && a.due < todayStr(); }).length;
      n += myDelegations().filter(function(x){
        var nc = nextCheckDate(x); return nc && nc <= todayStr();
      }).length;
      if(!myOneOnOne().thisMonth) n += 1;
      return n;
    }
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
  var attn = {};
  alerts.forEach(function(a){ if(a.level==='bad') attn[a.view] = (attn[a.view]||0)+1; });

  var h = '';
  NAV.forEach(function(g){
    if(g.group) h += '<div class="nav-group">'+esc(g.group)+'</div>';
    g.items.forEach(function(it){
      var n = navCount(it.key);
      var bad = attn[it.key];
      var v = VIEWS[it.key];
      h += '<button type="button" class="nav-item '+(currentView===it.key?'active':'')+'" '+
        'data-act="go" data-view="'+it.key+'"'+(currentView===it.key?' aria-current="page"':'')+' '+
        'title="'+esc(v && v.desc ? v.desc : it.label)+'">'+
        ic(it.icon, 17)+
        '<span class="lb">'+esc(it.label)+'</span>'+
        (bad ? '<span class="count attn" title="対応が必要 '+bad+'件">'+bad+'</span>' :
         (n ? '<span class="count">'+n+'</span>' : ''))+
        '</button>';
    });
  });
  return h;
}

function render(){
  var v = VIEWS[currentView] || VIEWS.dashboard;
  document.getElementById('nav').innerHTML = renderNav();

  var d = DB.data;
  var company = d.settings.companyName;
  document.getElementById('brandTitle').textContent = company || '評価制度・組織運営';
  document.getElementById('brandSub').textContent = company ? '組織運営アプリ' : 'チームで使う運用アプリ';
  var mark = document.getElementById('brandMark');
  if(mark) mark.textContent = company ? company.replace(/^(株式会社|有限会社|合同会社)/,'').charAt(0) : '評';

  document.getElementById('topTitle').textContent = v.title;
  document.getElementById('topDesc').textContent = v.desc || '';

  var pd = projectDay();
  var r = readinessScore();
  document.getElementById('topMeta').innerHTML =
    (pd.day>0 ? '<span class="badge accent">Week '+pd.week+'／'+pd.day+'日目</span> ' : '')+
    '<span class="badge '+(r.total>=80?'ok':r.total>=50?'warn':'bad')+'" title="社員台帳・目標・KPI・1on1・評価・報告の記入が、どれだけ埋まっているか">記録の充実度 '+r.total+'%</span> '+
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
  document.title = v.title + '｜' + (company ? company+' ' : '') + '組織運営アプリ';
}

action('go', function(ds){
  if(!VIEWS[ds.view]) return;
  if(ds.tab && VIEWS[ds.view].setTab) VIEWS[ds.view].setTab(ds.tab);
  currentView = ds.view;
  closeAllModals();
  try{ location.hash = '#'+ds.view; }catch(e){}
  render();
  var vw = document.getElementById('view');
  if(vw && typeof vw.focus === 'function') vw.focus({preventScroll:true});
});



window.addEventListener('hashchange', function(){
  var v = location.hash.replace('#','');
  if(v && VIEWS[v] && v !== currentView){ currentView = v; render(); }
});

/* 印刷ボタン（現在の画面） */
action('printView', function(){ window.print(); });

/* ---------- 画面の明るさ（明るい配色／暗い配色） ---------- */
var THEME_KEY = 'hyokaSeido_theme';
function themeGet(){
  try{ return localStorage.getItem(THEME_KEY) || 'auto'; }catch(e){ return 'auto'; }
}
function themeApply(t){
  var root = document.documentElement;
  if(root && root.setAttribute){
    if(t === 'auto'){ if(root.removeAttribute) root.removeAttribute('data-theme'); }
    else root.setAttribute('data-theme', t);
  }
  var b = document.getElementById('themeBtn');
  if(b){
    b.innerHTML = t === 'dark' ? ic('sparkle',15) : t === 'light' ? ic('monitor',15) : ic('cloud',15);
    b.title = t === 'dark' ? '暗い配色（クリックで自動に戻す）'
            : t === 'light' ? '明るい配色（クリックで暗い配色へ）'
            : 'パソコンの設定に合わせる（クリックで明るい配色へ）';
  }
}
action('toggleTheme', function(){
  var order = ['auto','light','dark'];
  var next = order[(order.indexOf(themeGet())+1) % 3];
  try{ localStorage.setItem(THEME_KEY, next); }catch(e){}
  themeApply(next);
  toast(next==='dark'?'暗い配色にしました':next==='light'?'明るい配色にしました':'パソコンの設定に合わせます');
});

/* ---------- 起動 ---------- */
function boot(){
  themeApply(themeGet());
  if(typeof syncLoadCfg === 'function') syncLoadCfg();
  DB.load();
  var v = location.hash.replace('#','');
  if(v && VIEWS[v]) currentView = v;
  else if(!DB.data.employees.length) currentView = 'dashboard';
  render();
  if(typeof syncInit === 'function') syncInit();

  /* 未保存のまま閉じる事故を防ぐため、変更のたびに保存している旨をログに残す */
  console.log('%c'+APP_NAME+' v'+APP_VERSION,
    'font-weight:bold;color:var(--brand);',
    '\nデータはこのブラウザ内（localStorage）に保存されます。定期的に「設定・データ」からバックアップを保存してください。');
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
