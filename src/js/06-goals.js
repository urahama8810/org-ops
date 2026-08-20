/* ============================================================
   06-goals.js  会社・部門目標
   ============================================================ */

function goalFields(level){
  return [
    { key:'level', label:'区分', type:'select', required:true,
      options:[{value:'company',label:'会社目標'},{value:'dept',label:'部門目標'}] },
    { key:'dept',  label:'部門', type:'select', options:[''].concat(deptList()),
      hint:'部門目標の場合に指定します。' },
    { key:'category', label:'目標の種類', type:'select',
      options:[''].concat(GOAL_CATEGORIES.map(function(c){ return {value:c.key,label:c.label+'（'+c.metrics+'）'}; })) },
    { key:'title', label:'目標', required:true, full:true,
      hint:'例：既存事業の営業利益を月次で黒字化する' },
    { key:'metric', label:'指標', required:true,
      hint:'例：営業利益／CPA／解約率' },
    { key:'unit',   label:'単位', hint:'例：円・%・件' },
    { key:'baseline', label:'現在値（開始時点）', type:'number', step:'any' },
    { key:'current',  label:'最新値', type:'number', step:'any' },
    { key:'target90', label:'90日目標', type:'number', step:'any', required:true },
    { key:'lowerIsBetter', label:'小さいほど良い指標（CPA・解約率など）', type:'checkbox', full:true },
    { key:'owner', label:'責任者', type:'select', options:empOptions(true), required:true,
      hint:'目標には必ず1名の責任者を置きます。' },
    { key:'dataSource', label:'正とするデータ', required:true, full:true,
      hint:'どのファイル・システムの数字を正とするか。ここを決めないと会議が「数字の食い違い」で終わります。' },
    { key:'note', label:'補足', type:'textarea', rows:2, full:true }
  ];
}

VIEWS.goals = {
  title:'会社・部門目標',
  desc:'Week 2／シート2。会社目標は3〜5個に限定し、指標・現在値・90日目標・責任者・正とするデータを決めます。',
  render:function(){
    var d = DB.data;
    var comp = d.goals.filter(function(g){ return g.level === 'company'; });
    var dept = d.goals.filter(function(g){ return g.level === 'dept'; });
    var h = '';

    h += '<div class="help-block">'+
      '<b>目標は3〜5個まで。</b> 多いほど全部が中途半端になります。それぞれについて「指標・現在値・90日目標・責任者・正とするデータ」を必ず決めてください。'+
      '<div style="margin-top:6px;">'+GOAL_CATEGORIES.map(function(c){
        return '<span class="tag">'+esc(c.label)+'：'+esc(c.metrics)+'</span>';
      }).join(' ')+'</div></div>';

    if(comp.length > 5)
      h += '<div class="alert bad"><span class="ic">'+ic('alert',15)+'</span><div class="body"><div class="t">会社目標が'+comp.length+'個あります</div>'+
           '<div class="d">3〜5個に絞ってください。</div></div></div>';

    h += '<div class="card"><div class="card-body" style="padding:12px 16px;"><div class="inline-form">'+
      '<button class="btn primary" data-act="goalNew" data-level="company">＋ 会社目標を追加</button>'+
      '<button class="btn" data-act="goalNew" data-level="dept">＋ 部門目標を追加</button>'+
      '<span style="flex:1"></span>'+
      '<button class="btn" data-act="goalCsv">CSVで書き出す</button>'+
      '<button class="btn" data-act="goalPrint">印刷</button>'+
      '</div></div></div>';

    h += card('会社目標（'+comp.length+'／3〜5個）', goalTable(comp), {tight:true});
    h += card('部門目標（'+dept.length+'件）', goalTable(dept, true), {tight:true,
      sub:'会社目標 → 部門目標 → 個人KPI がつながっている状態をつくります'});

    /* つながりの確認 */
    h += renderGoalChain();
    return h;
  }
};

function goalTable(list, showDept){
  var cols = [];
  if(showDept) cols.push({label:'部門', width:'110px', render:function(g){ return esc(g.dept||'—'); }});
  cols = cols.concat([
    { label:'目標', render:function(g){
        var cat = GOAL_CATEGORIES.filter(function(c){return c.key===g.category;})[0];
        return '<b>'+esc(g.title)+'</b>'+(cat?' '+badge(cat.label,'accent'):'')+
               (g.note?'<div class="small muted">'+esc(g.note)+'</div>':''); } },
    { label:'指標', width:'110px', render:function(g){ return esc(g.metric)+(g.unit?'<div class="small muted">'+esc(g.unit)+'</div>':''); } },
    { label:'現在値', cls:'num', width:'80px', render:function(g){ return g.baseline===''?'—':esc(g.baseline); } },
    { label:'最新値', cls:'num', width:'80px', render:function(g){ return g.current===''?'—':'<b>'+esc(g.current)+'</b>'; } },
    { label:'90日目標', cls:'num', width:'90px', render:function(g){ return esc(g.target90); } },
    { label:'進捗', width:'130px', render:function(g){
        var p = goalProgress(g);
        if(p === null) return '<span class="muted small">—</span>';
        return progressBar(p, p>=80?'ok':p>=40?'warn':'bad')+'<span class="small mono">'+p+'%</span>'; } },
    { label:'責任者', width:'110px', render:function(g){ return g.owner ? esc(empName(g.owner)) : badge('未設定','bad'); } },
    { label:'正とするデータ', render:function(g){ return g.dataSource ? '<span class="small">'+esc(g.dataSource)+'</span>' : badge('未設定','bad'); } },
    { label:'', cls:'actions', width:'150px', render:function(g){
        return btn('実績更新','goalUpdate',{id:g.id})+' '+btn('編集','goalEdit',{id:g.id})+' '+btn('削除','goalDel',{id:g.id},'danger'); } }
  ]);
  return tableHtml(cols, list, {
    emptyTitle:'目標が登録されていません',
    emptyText:'「＋ 目標を追加」から登録してください。'
  });
}

function renderGoalChain(){
  var d = DB.data;
  var comp = d.goals.filter(function(g){ return g.level==='company'; });
  if(!comp.length) return '';
  var h = '<div class="small muted" style="margin-bottom:8px;">会社目標に紐づく部門目標と、その責任者の担当社員のKPIを表示します。</div>';
  comp.forEach(function(g){
    var kids = d.goals.filter(function(x){ return x.level==='dept' && x.parentId===g.id; });
    h += '<div style="border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:8px;background:var(--surface);">'+
      '<div><b>'+esc(g.title)+'</b> <span class="small muted">'+esc(g.metric)+'</span> '+
      (g.owner?badge(empName(g.owner),'accent'):badge('責任者未設定','bad'))+'</div>';
    if(kids.length){
      h += '<div style="margin-top:6px;padding-left:14px;border-left:2px solid var(--border);">';
      kids.forEach(function(k){
        h += '<div class="small">↳ ['+esc(k.dept||'部門未設定')+'] '+esc(k.title)+
             ' <span class="muted">'+esc(k.metric)+'</span> '+(k.owner?esc(empName(k.owner)):'<span class="badge bad">責任者未設定</span>')+'</div>';
      });
      h += '</div>';
    }else{
      h += '<div class="small muted" style="margin-top:4px;padding-left:14px;">↳ 紐づく部門目標がありません。'+
           '<button class="btn sm" data-act="goalNew" data-level="dept" data-parent="'+g.id+'">部門目標を追加</button></div>';
    }
    h += '</div>';
  });
  return card('会社目標 → 部門目標のつながり', h, {});
}

action('goalNew', function(ds){
  var fields = goalFields();
  var val = { level:ds.level||'company', baseline:'', current:'', target90:'' };
  if(ds.parent){
    var p = byId(DB.data.goals, ds.parent);
    if(p){ val.dept = p.dept; val.category = p.category; val.parentId = p.id; }
  }
  openForm({
    title:(val.level==='company'?'会社目標':'部門目標')+'を追加', wide:true, fields:fields, value:val,
    intro:'<b>「正とするデータ」を必ず決めてください。</b> どの数字を正とするかが決まっていないと、週次会議が数字の食い違いで終わります。',
    onSubmit:function(v){
      v.id = uid('goal');
      if(ds.parent) v.parentId = ds.parent;
      if(v.level === 'dept' && !v.parentId){
        var comp = DB.data.goals.filter(function(g){ return g.level==='company'; });
        if(comp.length === 1) v.parentId = comp[0].id;
      }
      DB.data.goals.push(v); DB.save(); render(); toast('目標を追加しました','ok');
    }
  });
});

action('goalEdit', function(ds){
  var g = byId(DB.data.goals, ds.id);
  if(!g) return;
  var fields = goalFields();
  var comp = DB.data.goals.filter(function(x){ return x.level==='company' && x.id!==g.id; });
  if(comp.length) fields.splice(2,0,{ key:'parentId', label:'紐づく会社目標', type:'select',
    options:[{value:'',label:'（なし）'}].concat(comp.map(function(c){ return {value:c.id,label:c.title}; })) });
  openForm({
    title:'目標の編集', wide:true, fields:fields, value:g,
    onSubmit:function(v){
      v.id = g.id;
      DB.data.goals[DB.data.goals.indexOf(g)] = v; DB.save(); render(); toast('保存しました','ok');
    }
  });
});

action('goalUpdate', function(ds){
  var g = byId(DB.data.goals, ds.id);
  if(!g) return;
  openForm({
    title:'実績の更新：'+g.title, submitLabel:'更新',
    fields:[
      { key:'current', label:'最新値（'+g.metric+(g.unit?' '+g.unit:'')+'）', type:'number', step:'any', required:true },
      { key:'asOf',    label:'基準日', type:'date' },
      { key:'note',    label:'コメント（差の原因など）', type:'textarea', rows:3, full:true }
    ],
    value:{ current:g.current, asOf:todayStr(), note:'' },
    intro:'正とするデータ：<b>'+esc(g.dataSource||'未設定')+'</b>',
    onSubmit:function(v){
      g.current = v.current;
      g.history = g.history || [];
      g.history.push({ date:v.asOf, value:v.current, note:v.note });
      DB.save(); render(); toast('更新しました','ok');
    }
  });
});

action('goalDel', function(ds){
  var g = byId(DB.data.goals, ds.id);
  if(!g) return;
  confirmDialog('目標の削除','「'+g.title+'」を削除します。よろしいですか？', function(){
    DB.data.goals = DB.data.goals.filter(function(x){ return x.id !== g.id; });
    DB.data.goals.forEach(function(x){ if(x.parentId === g.id) x.parentId = ''; });
    DB.save(); render(); toast('削除しました','ok');
  }, '削除する');
});

action('goalCsv', function(){
  var rows = [['区分','部門','種類','目標','指標','単位','現在値','最新値','90日目標','進捗%','責任者','正とするデータ','補足']];
  DB.data.goals.forEach(function(g){
    var cat = GOAL_CATEGORIES.filter(function(c){return c.key===g.category;})[0];
    rows.push([g.level==='company'?'会社':'部門', g.dept, cat?cat.label:'', g.title, g.metric, g.unit,
      g.baseline, g.current, g.target90, goalProgress(g), empName(g.owner), g.dataSource, g.note]);
  });
  downloadCsv('会社・部門目標_'+todayStr()+'.csv', rows);
  toast('CSVを書き出しました','ok');
});

action('goalPrint', function(){
  var d = DB.data;
  printHtml('会社・部門目標',
    '<div class="card"><div class="card-head"><h2>会社目標</h2></div><div class="card-body">'+
    goalTable(d.goals.filter(function(g){return g.level==='company';}))+'</div></div>'+
    '<div class="card"><div class="card-head"><h2>部門目標</h2></div><div class="card-body">'+
    goalTable(d.goals.filter(function(g){return g.level==='dept';}), true)+'</div></div>');
});
