/* ============================================================
   19-diagnosis.js  経営の健全度診断
   ------------------------------------------------------------
   企業成長を阻害する「負のシステム」構造分析レポート（2026年8月）を
   実データで測るための画面。
     ・90日で追うべき先行指標（表7）
     ・5つの強化ループ（R1〜R5）のリスク判定
     ・読み込み時の検証質問（第13章）
   売上ではなく「正の循環が始まった証拠」を追う。
   ============================================================ */

/* 0〜100 に丸めるヘルパー */
function _sc(v){ return v===null||v===undefined||!isFinite(v) ? null : clamp(Math.round(v),0,100); }
function _avg(arr){
  var a = arr.filter(function(x){ return x!==null && x!==undefined && isFinite(x); });
  return a.length ? Math.round(a.reduce(function(s,x){return s+x;},0)/a.length) : null;
}
function scoreCls(v){ return v===null?'':(v>=75?'ok':v>=50?'warn':'bad'); }

/* 営業の先行指標が週次KPIに載っているか（接触・商談・提案・失注） */
function salesLeadingUse(){
  var re = /(接触|架電|訪問|アポ|商談|提案|失注|リード|問い合わせ)/;
  var weeks = sortBy(DB.data.kpiWeeks, function(w){ return w.weekOf; }).slice(-4);
  if(!weeks.length) return { weeks:0, hit:0, rate:null };
  var hit = weeks.filter(function(w){
    return (w.rows||[]).some(function(r){ return re.test(String(r.indicator||'')); });
  }).length;
  return { weeks:weeks.length, hit:hit, rate:Math.round(hit/weeks.length*100) };
}

/* 悪い情報が上がるまでの平均時間 */
function reportSpeed(){
  var reps = DB.data.reports.filter(function(r){ return !r.needApproval && r.knownAt && r.reportedAt; });
  if(!reps.length) return { n:0, avg:null };
  var sum = reps.reduce(function(s,r){ return s + Math.max(0, hoursBetween(r.knownAt, r.reportedAt)); }, 0);
  return { n:reps.length, avg:Math.round(sum/reps.length*10)/10 };
}

/* 評価者ごとの平均点の開き（甘辛の差） */
function evaluatorSpread(){
  var period = DB.data.settings.currentPeriod;
  var byEval = {};
  DB.data.evaluations.filter(function(e){ return e.period===period; }).forEach(function(e){
    var s = evalScore(e); if(s===null) return;
    var k = e.evaluatorId || '_';
    (byEval[k] = byEval[k] || []).push(s);
  });
  var avgs = [];
  for(var k in byEval){
    var a = byEval[k];
    avgs.push(a.reduce(function(s,x){return s+x;},0)/a.length);
  }
  if(avgs.length < 2) return null;
  return Math.round((Math.max.apply(null,avgs) - Math.min.apply(null,avgs))*100)/100;
}

/* ---------- 表7：90日で追うべき先行指標 ---------- */
function leadingMetrics(){
  var d = DB.data;
  var out = {};

  /* 情報流通 */
  var rs = reportSpeed(), rc = reportCompliance();
  var infoScore = rs.avg===null ? null :
    _sc(clamp(100 - rs.avg*3, 0, 100)*0.5 + (rc.total?rc.rate:0)*0.5);
  out.info = { score:infoScore,
    value: rs.avg===null ? '記録なし' : '平均 '+rs.avg+'時間で第一報',
    note: rc.total ? '期限遵守 '+rc.rate+'%（'+rc.total+'件）' : '報告ログがまだありません' };

  /* 育成 */
  var ds = delegationStats();
  out.growth = { score:_avg([ds.checkRate, ds.fullRate]),
    value: ds.checkRate===null ? '委任カードなし' : '中間確認 '+ds.checkRate+'%',
    note: ds.total ? '委任'+ds.total+'件／6項目記入 '+(ds.fullRate===null?'—':ds.fullRate+'%')+'／再挑戦 '+ds.retry+'件'
                   : '任せた仕事をカードにすると測れます' };

  /* 人材定着 */
  var oo = oneOnOneRate();
  var emps = d.employees.filter(function(e){ return !e.isTop; });
  var nextRole = emps.length ? Math.round(emps.filter(function(e){ return String(e.nextRole||'').trim(); }).length/emps.length*100) : null;
  var risky = emps.filter(function(e){ return e.retentionRisk==='高い'; }).length;
  out.retain = { score:_avg([oo.total?oo.rate:null, nextRole]),
    value: oo.total ? '1on1実施 '+oo.rate+'%' : '対象者なし',
    note: (nextRole===null?'':'将来像の提示 '+nextRole+'%')+(risky?'／離職リスク高 '+risky+'名':'') };

  /* 営業 */
  var sl = salesLeadingUse();
  out.sales = { score:sl.rate,
    value: sl.rate===null ? '週次KPIの記録なし' : '直近'+sl.weeks+'週中'+sl.hit+'週で先行指標を確認',
    note: '接触・商談・提案・失注理由を、売上より先に見る' };

  /* 資本配分 */
  var period = currentCapPeriod();
  var cs = capitalSummary(period);
  var rule = capitalRule();
  var capScore = cs.rate===null ? null : _sc(cs.rate / Math.max(1, num(rule.reinvestRate,50)) * 100);
  out.capital = { score:capScore,
    value: cs.rate===null ? '利益の登録なし' : '再投資率 '+cs.rate+'%',
    note: '目標 '+num(rule.reinvestRate,50)+'%'+(cs.nonbiz?'／非事業支出 '+yen(cs.nonbiz)+'円':'') };

  /* 意思決定 */
  var dec = decisionStats();
  out.decision = { score:_avg([dec.holdRate, dec.sheetRate, dec.exitRate]),
    value: dec.total||dec.ventures ? '決裁'+dec.total+'件／企画書'+dec.ventures+'件' : '記録なし',
    note: (dec.holdRate===null?'':'冷却期間の遵守 '+dec.holdRate+'%')+
          (dec.exitRate===null?'':'／撤退条件 '+dec.exitRate+'%') };

  return out;
}

/* ---------- 5つの強化ループのリスク判定 ---------- */
function loopScores(){
  var d = DB.data, m = leadingMetrics(), out = {};
  var ds = delegationStats(), oo = oneOnOneRate();

  /* R1 育成放棄 */
  var fbRate = d.oneOnOnes.length ?
    Math.round(d.oneOnOnes.filter(function(o){ return String(o.feedback||'').trim(); }).length/d.oneOnOnes.length*100) : null;
  out.R1 = { score:_avg([ds.checkRate, ds.fullRate, fbRate]),
    facts:[
      { label:'中間確認の実施率', v:ds.checkRate===null?'—':ds.checkRate+'%' },
      { label:'委任6項目の記入率', v:ds.fullRate===null?'—':ds.fullRate+'%' },
      { label:'1on1で具体的なフィードバックを残した割合', v:fbRate===null?'—':fbRate+'%' },
      { label:'再挑戦の機会を作った委任', v:ds.retry+'件' }
    ]};

  /* R2 優秀者流出 */
  var emps = d.employees.filter(function(e){ return !e.isTop; });
  var nextRole = emps.length ? Math.round(emps.filter(function(e){ return String(e.nextRole||'').trim(); }).length/emps.length*100) : null;
  var comp = d.goals.filter(function(g){ return g.level==='company'; });
  var visionScore = comp.length ? clamp(Math.round(comp.length/3*100),0,100) : 0;
  var grade = emps.length ? Math.round(emps.filter(function(e){ return !!e.grade; }).length/emps.length*100) : null;
  var risky = emps.filter(function(e){ return e.retentionRisk==='高い'; }).length;
  out.R2 = { score:_avg([nextRole, visionScore, grade, oo.total?oo.rate:null]),
    facts:[
      { label:'将来の役割・権限を提示できている社員', v:nextRole===null?'—':nextRole+'%' },
      { label:'等級の格付けが済んだ社員', v:grade===null?'—':grade+'%' },
      { label:'会社目標（方向性）の設定', v:comp.length+'個' },
      { label:'離職リスクが高いと見ている社員', v:risky+'名' },
      { label:'社長だけが仕事内容を把握している社員', v:d.employees.filter(function(e){return e.ceoOnlyKnows;}).length+'名' }
    ]};

  /* R3 営業・再投資回避 */
  var sl = salesLeadingUse();
  var dec = decisionStats();
  var rule = capitalRule();
  out.R3 = { score:_avg([sl.rate, m.capital.score, dec.sheetRate]),
    facts:[
      { label:'週次で営業の先行指標を見た週', v:sl.rate===null?'—':sl.hit+'/'+sl.weeks+'週' },
      { label:'再投資率', v:m.capital.value },
      { label:'非事業支出の年間上限', v:num(rule.nonBizCap,0)>0 ? yen(rule.nonBizCap)+'円' : '未設定' },
      { label:'新規案件の1枚企画書の記入率', v:dec.sheetRate===null?'—':dec.sheetRate+'%' }
    ]};

  /* R4 ガバナンス崩壊 */
  var gr = governanceRate();
  var rc = reportCompliance();
  var noContract = d.partners.filter(function(p){ return !p.contractDone; }).length;
  out.R4 = { score:_avg([gr, rc.total?rc.rate:null]),
    facts:[
      { label:'関係者台帳の文書化', v:gr===null?'—（未登録）':gr+'%' },
      { label:'契約・合意が文書化されていない相手', v:noContract+'件' },
      { label:'報告期限の遵守率', v:rc.total?rc.rate+'%':'—' },
      { label:'期限を守れなかった報告', v:rc.late.length+'件' },
      { label:'例外の記録', v:d.exceptions.length+'件' }
    ]};

  /* R5 低基準固定 */
  var scRate = clamp(Math.round(d.scorecards.length/6*100),0,100);
  var period = d.settings.currentPeriod;
  var evs = d.evaluations.filter(function(e){ return e.period===period; });
  var evRate = d.employees.length ? Math.round(evs.length/d.employees.length*100) : null;
  var spread = evaluatorSpread();
  var spreadScore = spread===null ? null : _sc(100 - spread*80);
  var goalFull = d.goals.length ?
    Math.round(d.goals.filter(function(g){ return g.owner && g.dataSource; }).length/d.goals.length*100) : null;
  out.R5 = { score:_avg([scRate, evRate, spreadScore, goalFull]),
    facts:[
      { label:'職種別役割表（良い状態の定義）', v:d.scorecards.length+'職種' },
      { label:'当期の評価シート作成率', v:evRate===null?'—':evRate+'%' },
      { label:'評価者ごとの平均点の開き', v:spread===null?'—':spread+'点' },
      { label:'責任者と正とするデータが揃った目標', v:goalFull===null?'—':goalFull+'%' }
    ]};

  return out;
}

/* 検証質問の集計 */
function diagnosisAnswers(){
  return (DB.data.diagnosis && DB.data.diagnosis.answers) || {};
}
function diagnosisSummary(){
  var a = diagnosisAnswers(), yes=0, no=0, mid=0, total=0, upstreamNo=[];
  DIAGNOSIS_SECTIONS.forEach(function(s){
    s.items.forEach(function(it){
      total++;
      var v = a[it.key];
      if(v==='yes') yes++;
      else if(v==='no'){ no++; if(it.up) upstreamNo.push(it); }
      else if(v==='mid') mid++;
    });
  });
  var answered = yes+no+mid;
  return { total:total, answered:answered, yes:yes, no:no, mid:mid,
           rate: answered ? Math.round((yes + mid*0.5)/answered*100) : null,
           upstreamNo:upstreamNo };
}

/* 総合：正の循環スコア */
function positiveCycleScore(){
  var m = leadingMetrics();
  var arr = LEADING_INDICATORS.map(function(x){ return m[x.key].score; });
  var data = _avg(arr);
  var q = diagnosisSummary();
  if(data===null && q.rate===null) return null;
  if(data===null) return q.rate;
  if(q.rate===null) return data;
  return Math.round(data*0.65 + q.rate*0.35);
}

/* ---------- 画面 ---------- */
var diagTab = 'indicator';

VIEWS.diagnosis = {
  title:'経営の健全度診断',
  desc:'売上ではなく「正の循環が始まった証拠」を測ります。',
  render:function(){
    var h = '';
    var total = positiveCycleScore();
    var m = leadingMetrics();
    var q = diagnosisSummary();

    h += '<div class="notice">'+
      '<b>ここに出る数字は、あなたを採点するためのものではありません。</b>'+
      '会社が「経営者のその場の不安・面倒・不快感を早く下げる方向」ではなく、'+
      '「長期的に強くなる方向」へ動いているかを、記録から確かめるためのものです。'+
      'システムとして形成された問題は、システムとして作り替えられます。'+
      '</div>';

    h += '<div class="grid c4" style="margin-bottom:16px;">'+
      tile('正の循環スコア', total===null?'—':total+'<small>%</small>',
           progressBar(total||0, scoreCls(total)), scoreCls(total))+
      tile('先行指標（記録から）', _avg(LEADING_INDICATORS.map(function(x){return m[x.key].score;}))===null?'—':
           _avg(LEADING_INDICATORS.map(function(x){return m[x.key].score;}))+'<small>%</small>',
           '6領域の平均', scoreCls(_avg(LEADING_INDICATORS.map(function(x){return m[x.key].score;}))))+
      tile('検証質問（自己確認）', q.rate===null?'—':q.rate+'<small>%</small>',
           q.answered+' / '+q.total+'問に回答', scoreCls(q.rate))+
      tile('上流3指標の警告', q.upstreamNo.length+'<small>件</small>',
           '他の項目へ波及する項目', q.upstreamNo.length?'bad':'ok')+
      '</div>';

    h += '<div class="tabs">'+
      '<div class="tab '+(diagTab==='indicator'?'active':'')+'" data-act="diagTab" data-t="indicator">先行指標</div>'+
      '<div class="tab '+(diagTab==='loop'?'active':'')+'" data-act="diagTab" data-t="loop">5つの強化ループ</div>'+
      '<div class="tab '+(diagTab==='check'?'active':'')+'" data-act="diagTab" data-t="check">検証質問（'+q.answered+'/'+q.total+'）</div>'+
      '<div class="tab '+(diagTab==='structure'?'active':'')+'" data-act="diagTab" data-t="structure">負のシステムとは</div>'+
      '</div>';

    if(diagTab==='indicator')      h += renderLeading(m);
    else if(diagTab==='loop')      h += renderLoops();
    else if(diagTab==='check')     h += renderDiagChecks();
    else                           h += renderStructure();
    return h;
  }
};

function renderLeading(m){
  var h = '';
  h += card('90日で追うべき先行指標',
    tableHtml([
      { label:'領域', width:'110px', render:function(r){ return '<b>'+esc(r.label)+'</b>'; } },
      { label:'見る数字', render:function(r){ return '<span class="small">'+esc(r.metric)+'</span>'; } },
      { label:'いまの記録', width:'190px', render:function(r){
          var x = m[r.key];
          return '<b>'+esc(x.value)+'</b><div class="small muted">'+esc(x.note)+'</div>'; } },
      { label:'状態', width:'140px', render:function(r){
          var s = m[r.key].score;
          return s===null ? '<span class="small muted">記録待ち</span>'
                          : progressBar(s, scoreCls(s))+'<span class="small mono">'+s+'%</span>'; } },
      { label:'改善の兆候', render:function(r){ return '<span class="small">'+esc(r.good)+'</span>'; } },
      { label:'', cls:'actions', width:'80px', render:function(r){ return btn('開く','go',{view:r.view}); } }
    ], LEADING_INDICATORS, {}),
    { sub:'構造分析レポート 表7', tight:true });

  h += card('この3つが、他のすべてに波及します',
    '<div class="grid c3">'+
    [['悪い情報が早く上がるか','報告・承認ルール','reports'],
     ['任せる際に中間確認があるか','委任カード','delegation'],
     ['感情と重大決裁が分離されているか','意思決定の防波堤','decisions']]
    .map(function(x){
      return '<div class="tile accent"><div class="label">上流指標</div>'+
        '<div style="font-size:15px;font-weight:700;line-height:1.5;margin:4px 0 8px;">'+esc(x[0])+'</div>'+
        '<button class="btn sm" data-act="go" data-view="'+x[2]+'">'+esc(x[1])+'を開く</button></div>';
    }).join('')+'</div>',
    { sub:'構造分析レポート 第13章' });
  return h;
}

function renderLoops(){
  var sc = loopScores(), h = '';
  h += '<div class="help-block">'+
    '<b>強化ループとは、結果が次の原因を強め、回るほど大きくなる循環のことです。</b>'+
    '一つひとつを性格の問題として直そうとしても続きません。'+
    'ループのどこか1か所を仕組みで止めると、その先が連鎖的に弱まります。'+
    '</div>';

  NEGATIVE_LOOPS.forEach(function(lp){
    var s = sc[lp.id] ? sc[lp.id].score : null;
    var facts = (sc[lp.id]||{}).facts || [];
    var body =
      '<div class="alert '+(s===null?'':(s>=75?'ok':s>=50?'warn':'bad'))+'">'+
        '<span class="ic">'+(s===null?'—':(s>=75?'✓':'!'))+'</span>'+
        '<div style="flex:1;"><div class="t">'+(s===null?'まだ記録が足りません':'防止スコア '+s+'%')+'</div>'+
        '<div class="d">'+esc(lp.chain)+'</div></div></div>'+
      '<div class="grid c2" style="margin-top:10px;">'+
        '<div><div class="small muted" style="margin-bottom:4px;">いまの記録</div>'+
          '<table class="tbl"><tbody>'+facts.map(function(f){
            return '<tr><td class="small">'+esc(f.label)+'</td><td class="num mono" style="width:110px;">'+esc(f.v)+'</td></tr>';
          }).join('')+'</tbody></table></div>'+
        '<div><div class="small muted" style="margin-bottom:4px;">なぜ起きるのか</div>'+
          '<div class="small" style="line-height:1.8;">'+esc(lp.why)+'</div>'+
          '<div class="small muted" style="margin:10px 0 4px;">断ち切り方</div>'+
          '<div class="small" style="line-height:1.8;"><b>'+esc(lp.breaker)+'</b></div>'+
          '<div class="btn-row" style="margin-top:10px;">'+
          '<button class="btn sm primary" data-act="go" data-view="'+lp.view+'"'+(lp.tab?' data-tab="'+lp.tab+'"':'')+'>対応する画面を開く</button>'+
          '</div></div>'+
      '</div>';
    h += card(lp.id+'：'+lp.name, body, { sub:s===null?'記録待ち':(s>=75?'防げています':s>=50?'注意':'このループが回っている可能性') });
  });
  return h;
}

function renderDiagChecks(){
  var a = diagnosisAnswers(), h = '';
  h += '<div class="help-block">'+
    '<b>チェックが付かない項目を、一度に全部改善する必要はありません。</b>'+
    '特に「悪い情報が早く上がるか」「任せる際に中間確認があるか」「感情と重大決裁が分離されているか」の3点は、'+
    '他の項目へ波及する上流指標です。ここから先に手を付けてください。'+
    '</div>';

  DIAGNOSIS_SECTIONS.forEach(function(s){
    var body = '<table class="tbl"><tbody>';
    s.items.forEach(function(it){
      var v = a[it.key]||'';
      body += '<tr><td>'+(it.up?'<span class="badge accent">上流</span> ':'')+esc(it.q)+'</td>'+
        '<td style="width:270px;" class="no-print">'+
        ['yes|できている|ok','mid|どちらとも言えない|warn','no|できていない|bad'].map(function(o){
          var p = o.split('|');
          return '<button class="btn sm '+(v===p[0]?'primary':'')+'" data-act="diagAns" data-k="'+it.key+'" data-v="'+p[0]+'">'+p[1]+'</button>';
        }).join(' ')+
        '</td></tr>';
    });
    body += '</tbody></table>';
    h += card(s.label, body, { tight:true, tools: btn('関連画面を開く','go',{view:s.view, tab:s.tab||''}) });
  });

  h += '<div class="btn-row" style="margin-top:6px;">'+
    '<button class="btn" data-act="diagReset">回答をやり直す</button>'+
    '<button class="btn" data-act="diagSnapshot">今日の結果を記録に残す</button>'+
    '</div>';

  var hist = ((DB.data.diagnosis||{}).history)||[];
  if(hist.length){
    h += card('診断の推移', tableHtml([
      { label:'日付', key:'date', width:'110px' },
      { label:'正の循環スコア', width:'160px', render:function(r){
          return progressBar(r.total||0, scoreCls(r.total))+'<span class="small mono">'+(r.total===null?'—':r.total+'%')+'</span>'; } },
      { label:'先行指標', cls:'num', width:'90px', render:function(r){ return r.data===null?'—':r.data+'%'; } },
      { label:'検証質問', cls:'num', width:'90px', render:function(r){ return r.quiz===null?'—':r.quiz+'%'; } },
      { label:'メモ', render:function(r){ return '<span class="small">'+esc(r.note||'')+'</span>'; } }
    ], sortBy(hist, function(r){ return r.date; }).reverse(), {}), { tight:true });
  }
  return h;
}

function renderStructure(){
  var h = '';
  h += card('この会社に起きている可能性のある循環',
    '<div class="help-block" style="font-size:13.5px;">'+
    '<b>不確実性への弱さ</b> → 管理・育成・営業・対話の回避 → 経営システムの欠落 → '+
    '人材未成熟・情報隠蔽・優秀者流出 → 成果悪化・想定外 → 激昂・責任転嫁・過剰統制 → '+
    'さらに管理・育成・対話が難しくなる'+
    '</div>'+
    '<div class="grid c2">'+
    [['① 根本の心理・判断傾向',
      'わからない状態への耐性が弱い／成果を急ぐ／面倒・苦手・拒絶される行為を避ける／'+
      '信頼・文化・育成など目に見えない資産を軽視する／人を独立した主体より管理対象として見やすい'],
     ['② 短期的な安心を得る行動',
      'ビジョンや高い基準を明示しない／育成・管理・営業・対話を後回しにする／任せっぱなし／'+
      '失敗時に激昂・嫌味／衝動的に新規案件へ飛びつく／状態を固定して統制しようとする'],
     ['③ 経営システムの欠落',
      '目的・優先順位・判断基準が曖昧／役割・権限・責任・評価が曖昧／育成と中間確認が仕組み化されない／'+
      '営業が再現可能な型にならない／資本配分・契約・監督の規律が弱い'],
     ['④ 従業員・取引先の合理的な反応',
      '失敗を避け、指示待ち・自己防衛になる／質問・報告・異論・挑戦が減る／表面上は従うが本音を隠す／'+
      '選択肢のある有能人材ほど離れやすい'],
     ['⑤ 経営上の結果',
      '低い基準が社内の標準になる／同じ失敗が繰り返される／営業パイプラインが弱い／'+
      '経営者がボトルネックになる／再投資不足で機会損失／優秀者流出と組織能力低下'],
     ['⑥ 経営者側の誤った学習',
      '「人は育たない」「任せると失敗する」「自分が細かく管理するしかない」「育成や対話は時間の無駄」'+
      '「次の新しい案件に賭けた方が早い」という信念が強化される']]
    .map(function(x){
      return '<div class="card" style="margin-bottom:0;"><div class="card-body">'+
        '<div style="font-weight:700;color:#0f4c81;margin-bottom:6px;">'+esc(x[0])+'</div>'+
        '<div class="small" style="line-height:1.8;">'+esc(x[1])+'</div></div></div>';
    }).join('')+
    '</div>'+
    '<div class="alert bad" style="margin-top:14px;"><span class="ic">!</span><div>'+
    '<div class="t">核心：「管理」は避けるが、「支配」は強める</div>'+
    '<div class="d">平時は基準を示さず任せっぱなしにし、問題が見えた瞬間だけ強く介入する。'+
    'そのため、問題の予防も人材育成も起きず、次の問題はさらに見えにくくなります。</div></div></div>',
    { sub:'構造分析レポート 第3章' });

  h += card('反転後の正の循環',
    '<div class="help-block" style="font-size:13.5px;">'+
    '不確実性を言語化する → 基準・役割・期限を明示する → 中間確認と育成を行う → '+
    '質問・報告・挑戦が増える → 成果と組織能力が上がる → 利益を再投資する → より高い基準と自律が可能になる'+
    '</div>'+
    '<div class="grid c2">'+
    [['自分がすべてを解く人から','問題が早く見える仕組みを作る人へ'],
     ['人を動かす人から','人が自分で成果を出せる条件を作る人へ'],
     ['利益を使う人から','利益を組織能力へ変換する人へ'],
     ['信頼か不信かで判断する人から','信頼と規律を両立させる人へ'],
     ['即断する人から','即断すべき領域と待つべき領域を分ける人へ']]
    .map(function(x){
      return '<div class="alert ok"><span class="ic">→</span><div><div class="d">'+esc(x[0])+'</div>'+
             '<div class="t">'+esc(x[1])+'</div></div></div>'; }).join('')+
    '</div>'+
    '<div class="notice" style="margin:14px 0 0;">'+
    'この転換が始まると、<b>経営者が頑張るほど会社が依存する状態</b>から、'+
    '<b>会社が強くなるほど経営者の自由度も高まる状態</b>へ移行できます。</div>',
    { sub:'構造分析レポート 第10章・第14章' });
  return h;
}

/* ---------- 操作 ---------- */
action('diagTab', function(ds){ diagTab = ds.t; render(); });

action('diagAns', function(ds){
  DB.data.diagnosis = DB.data.diagnosis || { answers:{}, history:[] };
  DB.data.diagnosis.answers = DB.data.diagnosis.answers || {};
  var cur = DB.data.diagnosis.answers[ds.k];
  DB.data.diagnosis.answers[ds.k] = (cur===ds.v) ? '' : ds.v;
  DB.data.diagnosis.updatedAt = nowIso();
  DB.save(); render();
});

action('diagReset', function(){
  confirmDialog('回答をやり直す','検証質問の回答をすべて消します。よろしいですか？', function(){
    DB.data.diagnosis.answers = {};
    DB.save(); render(); toast('回答を消しました','ok');
  }, '消す');
});

action('diagSnapshot', function(){
  openForm({
    title:'今日の結果を記録に残す',
    intro:'診断結果を日付付きで残します。90日後に見返すと、正の循環が始まったかどうかが分かります。',
    fields:[{ key:'note', label:'メモ', type:'textarea', rows:3, full:true,
              placeholder:'例：中間確認を始めた。報告が早くなったが、再投資はまだできていない。' }],
    value:{},
    onSubmit:function(v){
      var m = leadingMetrics();
      DB.data.diagnosis.history = DB.data.diagnosis.history || [];
      DB.data.diagnosis.history.push({
        date: todayStr(),
        total: positiveCycleScore(),
        data: _avg(LEADING_INDICATORS.map(function(x){ return m[x.key].score; })),
        quiz: diagnosisSummary().rate,
        note: v.note
      });
      DB.save(); render(); toast('記録しました','ok');
    }
  });
});
