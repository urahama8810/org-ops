/* ============================================================
   19-diagnosis.js  組織の健康診断
   ------------------------------------------------------------
   売上は結果なので、変化が数字に出るまでに時間がかかる。
   その手前で動く6つの数字を、日々の記録から自動で計算して見る画面。
     ・売上より先に動く6つの数字
     ・組織が陥りやすい5つの悪循環の、いまの度合い
     ・半年に一度の振り返り質問
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
    value: ds.checkRate===null ? '記録なし' : '中間確認 '+ds.checkRate+'%',
    note: ds.total ? '委任'+ds.total+'件／6項目記入 '+(ds.fullRate===null?'—':ds.fullRate+'%')+'／再挑戦 '+ds.retry+'件'
                   : '任せた仕事をカードにすると測れます' };

  /* 人材定着 */
  var oo = oneOnOneRate();
  var emps = d.employees.filter(function(e){ return !e.isTop; });
  var nextRole = emps.length ? Math.round(emps.filter(function(e){ return String(e.nextRole||'').trim(); }).length/emps.length*100) : null;
  out.retain = { score:_avg([oo.total?oo.rate:null, nextRole]),
    value: oo.total ? '1on1実施 '+oo.rate+'%' : '対象者なし',
    note: (nextRole===null?'':'これからの役割を伝えられている人 '+nextRole+'%') };

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
    note: (dec.holdRate===null?'':'手順どおりに確定 '+dec.holdRate+'%')+
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
  out.R2 = { score:_avg([nextRole, visionScore, grade, oo.total?oo.rate:null]),
    facts:[
      { label:'これからの役割を伝えられている人', v:nextRole===null?'—':nextRole+'%' },
      { label:'等級が決まっている人', v:grade===null?'—':grade+'%' },
      { label:'会社目標（進む方向）の数', v:comp.length+'個' },
      { label:'中身を知っているのが1人だけの仕事', v:d.employees.filter(function(e){return e.ceoOnlyKnows;}).length+'件' }
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
  title:'組織の健康診断',
  desc:'売上の手前にある数字を見て、良い流れが始まっているかを確かめます。',
  render:function(){
    var h = '';
    var total = positiveCycleScore();
    var m = leadingMetrics();
    var q = diagnosisSummary();

    h += '<div class="notice">'+
      '<b>ここに出る数字は、誰かを採点するためのものではありません。</b>'+
      '会社が「目の前の困りごとをその場でしのぐ方向」ではなく、'+
      '「時間をかけて強くなる方向」へ動いているかどうかを、日々の記録から確かめるためのものです。'+
      '仕組みでできた状態は、仕組みで変えられます。'+
      '</div>';

    h += '<div class="grid c4" style="margin-bottom:16px;">'+
      tile('良い流れの度合い', total===null?'—':total+'<small>%</small>',
           progressBar(total||0, scoreCls(total)), scoreCls(total), 'pulse')+
      tile('6つの数字（記録から）', _avg(LEADING_INDICATORS.map(function(x){return m[x.key].score;}))===null?'—':
           _avg(LEADING_INDICATORS.map(function(x){return m[x.key].score;}))+'<small>%</small>',
           '6領域の平均', scoreCls(_avg(LEADING_INDICATORS.map(function(x){return m[x.key].score;}))))+
      tile('振り返り質問', q.rate===null?'—':q.rate+'<small>%</small>',
           q.answered+' / '+q.total+'問に回答', scoreCls(q.rate))+
      tile('先に手を打ちたい項目', q.upstreamNo.length+'<small>件</small>',
           '他の項目にも影響が広がりやすいもの', q.upstreamNo.length?'bad':'ok', 'alert')+
      '</div>';

    h += '<div class="tabs">'+
      '<button type="button" class="tab '+(diagTab==='indicator'?'active':'')+'" data-act="diagTab" data-t="indicator">6つの数字</button>'+
      '<button type="button" class="tab '+(diagTab==='loop'?'active':'')+'" data-act="diagTab" data-t="loop">陥りやすい5つの悪循環</button>'+
      '<button type="button" class="tab '+(diagTab==='check'?'active':'')+'" data-act="diagTab" data-t="check">振り返り質問（'+q.answered+'/'+q.total+'）</button>'+
      '</div>';

    if(diagTab==='loop')        h += renderLoops();
    else if(diagTab==='check')  h += renderDiagChecks();
    else                        h += renderLeading(m);
    return h;
  }
};
VIEWS.diagnosis.setTab = function(t){ diagTab = t; };   /* 他の画面からタブを指定できるようにする */


function renderLeading(m){
  var h = '';
  h += card('売上より先に動く6つの数字',
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
    { icon:'pulse', tight:true });

  h += card('この3つは、ほかの項目にも影響が広がります',
    '<div class="grid c3">'+
    [['よくない情報が早く届くか','報告・承認ルール','reports'],
     ['任せるときに確認日を決めているか','仕事の任せ方','delegation'],
     ['大きな決定を手順どおりに進めているか','重要な決定','decisions']]
    .map(function(x){
      return '<div class="tile accent"><div class="label">先に効く項目</div>'+
        '<div class="headline">'+esc(x[0])+'</div>'+
        '<div class="foot"><button class="btn sm" data-act="go" data-view="'+x[2]+'">'+esc(x[1])+'を開く</button></div></div>';
    }).join('')+'</div>',
    { icon:'sparkle' });
  return h;
}

function renderLoops(){
  var sc = loopScores(), h = '';
  h += '<div class="help-block">'+
    '<b>悪循環とは、結果が次の原因になって、回るほど大きくなっていく流れのことです。</b>'+
    '一つひとつを人の性格の問題として直そうとしても、なかなか続きません。'+
    'ループのどこか1か所を仕組みで止めると、その先が連鎖的に弱まります。'+
    '</div>';

  NEGATIVE_LOOPS.forEach(function(lp){
    var s = sc[lp.id] ? sc[lp.id].score : null;
    var facts = (sc[lp.id]||{}).facts || [];
    var body =
      '<div class="alert '+(s===null?'':(s>=75?'ok':s>=50?'warn':'bad'))+'">'+
        '<span class="ic">'+(s===null?'<span class="muted">—</span>':ic(s>=75?'check':'alert',15))+'</span>'+
        '<div style="flex:1;"><div class="t">'+(s===null?'まだ記録が足りません':'防止スコア '+s+'%')+'</div>'+
        '<div class="d">'+esc(lp.chain)+'</div></div></div>'+
      '<div class="grid c2" style="margin-top:10px;">'+
        '<div class="col"><div class="small muted" style="margin-bottom:4px;">いまの記録</div>'+
          '<table class="tbl"><tbody>'+facts.map(function(f){
            return '<tr><td class="small">'+esc(f.label)+'</td><td class="num mono" style="width:110px;">'+esc(f.v)+'</td></tr>';
          }).join('')+'</tbody></table></div>'+
        '<div class="col"><div class="small muted" style="margin-bottom:4px;">なぜ起きるのか</div>'+
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
    'とくに「よくない情報が早く届くか」「任せるときに確認日を決めているか」「大きな決定を手順どおりに進めているか」の3つは、'+
    'ほかの項目にも影響が広がります。ここから先に手を付けると、全体が動きやすくなります。'+
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
    intro:'今日の結果を日付つきで残します。数か月後に見返すと、流れが変わったかどうかが分かります。',
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
