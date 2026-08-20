/* ============================================================
   14-plan.js  90日プロジェクト計画（社内ルール 第1〜3・15・16章）
   ============================================================ */

var SHEET_LINKS = [
  { no:'1', name:'社員・役割台帳',  use:'人・役割・上司・権限を一元管理', view:'employees' },
  { no:'2', name:'会社・部門目標',  use:'90日目標と責任者',               view:'goals' },
  { no:'3', name:'職種別役割表',    use:'責任・KPI・権限・報告ルール',     view:'scorecards' },
  { no:'4', name:'週次KPI',         use:'目標差・原因・対策・期限',        view:'kpi' },
  { no:'5', name:'1on1記録',        use:'月次フィードバック',              view:'oneonone' },
  { no:'6', name:'四半期評価',      use:'評価根拠・点数・改善事項',        view:'evaluations' }
];

var GOAL_STATE = [
  '全社員の直属上司・役割・主要業務・成果物・権限・承認事項が明文化されている',
  '会社目標 → 部門目標 → 個人KPI がつながっている',
  '週次KPI会議と月次1on1が運用されている',
  '一般社員・管理職の評価基準が明文化され、初回試験評価が完了している',
  'G1〜G5の等級・昇格基準が完成している',
  '重要支出・契約・顧客問題・遅延・数値悪化の報告期限と承認権限が明確になっている'
];

/* 90日後の完成状態の自動判定 */
function goalStateCheck(){
  var d = DB.data, r = readinessScore();
  var comp = d.goals.filter(function(g){ return g.level==='company'; });
  var evs = d.evaluations.filter(function(e){ return e.period === d.settings.currentPeriod; });
  return [
    r.parts[0].rate >= 100,
    comp.length >= 3 && d.goals.some(function(g){ return g.level==='dept'; }) &&
      d.employees.some(function(e){ return lines(e.kpis).length > 0; }),
    d.kpiWeeks.length >= 4 && d.oneOnOnes.length >= 1,
    d.scorecards.length >= 6 && evs.length > 0 && evs.some(function(e){ return e.stage==='final'||e.stage==='explained'; }),
    d.grades.length === 5 && d.employees.length > 0 && d.employees.every(function(e){ return !!e.grade; }),
    d.scorecards.length > 0 && d.scorecards.every(function(s){ return (s.reports||'').trim(); })
  ];
}

VIEWS.plan = {
  title:'90日の導入計画',
  desc:'この仕組みを立ち上げるまでの段取りです。導入が終われば、この画面を開く機会はほとんどなくなります。',
  render:function(){
    var d = DB.data;
    var pp = planProgress();
    var pd = projectDay();
    var h = '';

    /* 目的 */
    h += '<div class="notice"><b>目指す状態：</b>特定の人の記憶や感覚に頼らなくても、'+
      '<b>役割・数字・権限・報告のルール</b>で会社が回るようにすること。</div>';

    /* 90日後の完成状態 */
    var chk = goalStateCheck();
    h += card('90日後の完成状態', GOAL_STATE.map(function(g,i){
      return '<div class="alert '+(chk[i]?'ok':'')+'" style="margin-bottom:6px;">'+
        '<span class="ic">'+ic(chk[i]?'check':'info',15)+'</span><div class="body"><div class="t" style="font-weight:'+(chk[i]?'600':'400')+';">'+esc(g)+'</div></div></div>';
    }).join(''), {sub:chk.filter(Boolean).length+' / '+GOAL_STATE.length+' 達成'});

    /* 進捗タイル */
    h += '<div class="grid c3" style="margin-bottom:18px;">'+
      tile('経過', pd.day>0?pd.day+'<small>日目 / 90日</small>':'<small>開始日未設定</small>',
        pd.day>0?progressBar(clamp(pd.day/90*100,0,100)):'設定画面で開始日を入力してください','accent')+
      tile('チェックリスト達成', pp.rate+'<small>%</small>', pp.done+' / '+pp.total+' 項目',
        pp.rate>=80?'ok':pp.rate>=40?'warn':'bad')+
      tile('着手順（第15章）',
        Object.keys(d.firstSteps||{}).filter(function(k){return d.firstSteps[k];}).length+'<small>/'+FIRST_STEPS.length+'</small>','','')+
      '</div>';

    /* 実行スケジュール */
    var sched = '';
    PLAN_WEEKS.forEach(function(w){
      var st = pp.perWeek[w.id];
      var isNow = pd.week >= w.range[0] && pd.week <= w.range[1];
      sched += '<div style="border:1px solid '+(isNow?'var(--brand)':'var(--border)')+';border-radius:8px;margin-bottom:10px;background:var(--surface);'+
        (isNow?'box-shadow:0 0 0 1px var(--brand);':'')+'">'+
        '<div style="display:flex;gap:10px;align-items:center;padding:9px 13px;background:'+(isNow?'var(--brand-soft)':'var(--surface-2)')+';border-bottom:1px solid var(--border);flex-wrap:wrap;">'+
          '<b style="min-width:90px;">'+esc(w.period)+'</b>'+
          '<span>'+esc(w.task)+'</span>'+
          (isNow?badge('今ここ','accent'):'')+
          '<span style="flex:1"></span>'+
          '<span class="tag">成果物：'+esc(w.output)+'</span>'+
          '<span class="badge '+(st.rate===100?'ok':st.rate>0?'warn':'neutral')+'">'+st.done+'/'+st.total+'</span>'+
        '</div>'+
        '<div style="padding:8px 13px;">'+
        w.items.map(function(it, i){
          var key = w.id+'_'+i;
          return '<label class="chk"><input type="checkbox" data-change="planCheck" data-k="'+key+'"'+
            (d.planChecks[key]?' checked':'')+'><span'+(d.planChecks[key]?' class="muted" style="text-decoration:line-through;"':'')+'>'+
            esc(it)+'</span></label>';
        }).join('')+
        '</div></div>';
    });
    h += card('90日実行スケジュール', sched, {});

    /* プロジェクト体制 */
    h += card('プロジェクト体制', tableHtml([
      {label:'役割', width:'150px', render:function(r){ return '<b>'+esc(r.role)+'</b>'; }},
      {label:'想定', width:'120px', render:function(r){ return esc(r.who); }},
      {label:'責任', render:function(r){ return esc(r.resp); }},
      {label:'担当者', width:'220px', render:function(r){
        var val = (DB.data.projectRoles||{})[r.key] || '';
        return '<input type="text" value="'+esc(val)+'" data-change="projRole" data-k="'+r.key+'" placeholder="氏名を入力">'; }}
    ], PROJECT_ROLES, {}), {tight:true});

    /* 着手順 */
    h += card('明日から着手する順番', FIRST_STEPS.map(function(s,i){
      return '<label class="chk"><input type="checkbox" data-change="firstStep" data-i="'+i+'"'+
        ((d.firstSteps||{})[i]?' checked':'')+'>'+
        '<span'+((d.firstSteps||{})[i]?' class="muted" style="text-decoration:line-through;"':'')+'><b>'+(i+1)+'.</b> '+esc(s)+'</span></label>';
    }).join(''), {});

    /* 6つのシート */
    h += card('最初に作成する6つのシート', tableHtml([
      {label:'シート', width:'200px', render:function(s){ return '<b>'+s.no+'. '+esc(s.name)+'</b>'; }},
      {label:'用途', render:function(s){ return esc(s.use); }},
      {label:'状態', width:'150px', render:function(s){
        var p = readinessScore().parts.filter(function(x){ return x.view === s.view; })[0];
        return p ? progressBar(p.rate, p.rate>=80?'ok':p.rate>=40?'warn':'bad')+'<span class="small mono">'+p.rate+'%</span>' : ''; }},
      {label:'', cls:'actions', width:'90px', render:function(s){ return btn('開く','go',{view:s.view},'primary'); }}
    ], SHEET_LINKS, {}), {tight:true});

    /* 注意 */
    h += '<div class="alert warn"><span class="ic">'+ic('info',15)+'</span><div class="body">'+
      '<div class="t">報酬連動の前に確認すること</div>'+
      '<div class="d">評価制度を減給・賞与・降格等へ連動させる前に、就業規則・賃金規程との整合や必要な手続を社労士等へ確認してください。'+
      '制度導入初期は「評価を正確に運用できること」を優先し、報酬変更を急がないこと。</div></div></div>';
    return h;
  }
};

action('planCheck', function(ds, el){
  DB.data.planChecks[ds.k] = el.checked;
  DB.save(); render();
});
action('firstStep', function(ds, el){
  DB.data.firstSteps[ds.i] = el.checked;
  DB.save(); render();
});
action('projRole', function(ds, el){
  DB.data.projectRoles = DB.data.projectRoles || {};
  DB.data.projectRoles[ds.k] = el.value;
  if(ds.k === 'lead') DB.data.settings.projectLead = el.value;
  if(ds.k === 'ceo')  DB.data.settings.ceoName = el.value;
  if(ds.k === 'hr')   DB.data.settings.hrOwner = el.value;
  if(ds.k === 'external') DB.data.settings.externalAdvisor = el.value;
  DB.save();
});
