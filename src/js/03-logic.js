/* ============================================================
   03-logic.js  判定ロジック
   会社で決めたルールに照らして「抜け・遅れ・違反」を自動で洗い出す
   ============================================================ */

/* ---------- 社員台帳の記入状況 ----------
   ★ が付いた5項目は、これがないと目標・KPI・評価が動かない土台。
   それ以外は、落ち着いてから埋めればよい項目。 */
var LEDGER_CHECKS = [
  { key:'manager',   label:'直属の上司',      core:true, test:function(e){ return !!e.manager || e.isTop; } },
  { key:'role',      label:'役割',            core:true, test:function(e){ return !!(e.roleTitle||'').trim(); } },
  { key:'output',    label:'成果物',          core:true, test:function(e){ return !!(e.deliverables||'').trim(); } },
  { key:'kpi',       label:'KPI',             core:true, test:function(e){ return lines(e.kpis).length >= 1; } },
  { key:'approval',  label:'承認が必要なこと',core:true, test:function(e){ return !!(e.approvals||'').trim(); } },
  { key:'duties',    label:'主な仕事',        test:function(e){ return lines(e.mainDuties).length >= 3; } },
  { key:'target',    label:'目標値',          test:function(e){ return !!(e.kpiTarget||'').trim(); } },
  { key:'dataSrc',   label:'数字の出どころ',  test:function(e){ return !!(e.dataSource||'').trim(); } },
  { key:'authority', label:'決めてよい範囲',  test:function(e){ return !!(e.authority||'').trim(); } },
  { key:'handover',  label:'資料の保存場所',  test:function(e){ return !!(e.handover||'').trim(); } }
];

/* 土台の5項目が埋まっているか */
function ledgerCoreDone(e){
  return LEDGER_CHECKS.filter(function(c){ return c.core; }).every(function(c){ return c.test(e); });
}

function ledgerStatus(e){
  var missing = [];
  LEDGER_CHECKS.forEach(function(c){ if(!c.test(e)) missing.push(c.label); });
  return {
    done: LEDGER_CHECKS.length - missing.length,
    total: LEDGER_CHECKS.length,
    rate: Math.round((LEDGER_CHECKS.length-missing.length)/LEDGER_CHECKS.length*100),
    missing: missing
  };
}

/* 直属部下の一覧 */
function directReports(empId){
  return DB.data.employees.filter(function(e){ return e.manager === empId; });
}

/* 最終決裁者の社員ID：設定の ceoEmpId または isTop フラグ */
function topPerson(){
  var d = DB.data;
  if(d.settings.ceoEmpId){ var e = byId(d.employees, d.settings.ceoEmpId); if(e) return e; }
  for(var i=0;i<d.employees.length;i++) if(d.employees[i].isTop) return d.employees[i];
  return null;
}

/* ---------- 90日計画の進捗 ---------- */
function planProgress(){
  var checks = DB.data.planChecks || {};
  var total = 0, done = 0, perWeek = {};
  PLAN_WEEKS.forEach(function(w){
    var d = 0;
    w.items.forEach(function(it, i){
      total++;
      if(checks[w.id+'_'+i]){ done++; d++; }
    });
    perWeek[w.id] = { done:d, total:w.items.length, rate:Math.round(d/w.items.length*100) };
  });
  return { done:done, total:total, rate: total? Math.round(done/total*100):0, perWeek:perWeek };
}

/* プロジェクト開始からの経過日数と、いま居るべき週 */
function projectDay(){
  var st = DB.data.settings.startDate;
  if(!st) return { day:0, week:0 };
  var d = daysBetween(st, todayStr()) + 1;
  return { day:d, week: Math.max(1, Math.ceil(d/7)) };
}

/* ---------- 1on1 の実施状況 ---------- */
function oneOnOneStatusOf(empId, month){
  month = month || monthStr();
  var rec = DB.data.oneOnOnes.filter(function(o){ return o.employeeId===empId && o.month===month; });
  return rec.length ? rec[0] : null;
}
function oneOnOneRate(month){
  month = month || monthStr();
  var targets = DB.data.employees.filter(function(e){ return e.manager; });
  if(!targets.length) return { done:0, total:0, rate:0, missing:[] };
  var missing = targets.filter(function(e){ return !oneOnOneStatusOf(e.id, month); });
  return { done:targets.length-missing.length, total:targets.length,
           rate:Math.round((targets.length-missing.length)/targets.length*100), missing:missing };
}

/* ---------- 週次KPI会議 ---------- */
function kpiRowStatus(row){
  if(row.actual === '' || row.actual === undefined || row.actual === null) return 'none';
  if(row.target === '' || row.target === undefined || row.target === null) return 'none';
  var t = num(row.target), a = num(row.actual);
  var achieved = row.lowerIsBetter ? (a <= t) : (a >= t);
  if(achieved) return 'ok';
  var ratio = row.lowerIsBetter ? (t===0?1:t/a) : (t===0?1:a/t);
  return ratio >= 0.9 ? 'watch' : 'ng';
}
function kpiGap(row){
  if(row.actual === '' || row.target === '') return '';
  var g = num(row.actual) - num(row.target);
  return (g>0?'+':'') + Math.round(g*100)/100;
}
function latestKpiWeek(){
  if(!DB.data.kpiWeeks.length) return null;
  return sortBy(DB.data.kpiWeeks, function(w){ return w.weekOf; }).slice(-1)[0];
}
function kpiWeekSummary(w){
  if(!w) return { ok:0, watch:0, ng:0, none:0, total:0, unresolved:0 };
  var s = { ok:0, watch:0, ng:0, none:0, total:w.rows.length, unresolved:0 };
  w.rows.forEach(function(r){
    var st = kpiRowStatus(r);
    s[st]++;
    if((st==='ng'||st==='watch') && (!String(r.action||'').trim() || !String(r.owner||'').trim() || !String(r.due||'').trim())) s.unresolved++;
  });
  return s;
}

/* ---------- 報告ルールの遵守判定 ---------- */
function reportDeadlineStatus(rep){
  var rule = null;
  for(var i=0;i<REPORT_RULES.length;i++) if(REPORT_RULES[i].key === rep.ruleKey) rule = REPORT_RULES[i];
  if(!rule) return { cls:'neutral', label:'—' };
  if(rule.hours === 0){
    /* 事前承認・記録が要件のもの */
    if(rep.approvedAt || rep.status === 'approved') return { cls:'ok', label:'事前承認済み' };
    if(rep.status === 'rejected') return { cls:'bad', label:'否認' };
    if(rep.status === 'after')    return { cls:'bad', label:'事後報告（ルール違反）' };
    return { cls:'warn', label:'承認待ち' };
  }
  if(!rep.knownAt || !rep.reportedAt) return { cls:'warn', label:'未報告' };
  var h = hoursBetween(rep.knownAt, rep.reportedAt);
  if(h <= rule.hours) return { cls:'ok', label:'期限内（'+Math.max(0,Math.round(h*10)/10)+'時間）' };
  return { cls:'bad', label:'遅延（'+Math.round(h)+'時間）' };
}
function reportCompliance(){
  var reps = DB.data.reports;
  if(!reps.length) return { rate:100, ok:0, total:0, late:[] };
  var ok = 0, late = [];
  reps.forEach(function(r){
    var s = reportDeadlineStatus(r);
    if(s.cls === 'ok') ok++;
    else if(s.cls === 'bad') late.push(r);
  });
  return { rate:Math.round(ok/reps.length*100), ok:ok, total:reps.length, late:late };
}

/* ---------- 評価の計算 ---------- */
function evalItemsFor(type){ return type === 'manager' ? EVAL_ITEMS_MANAGER : EVAL_ITEMS_GENERAL; }

function evalScore(ev){
  var items = evalItemsFor(ev.type);
  var sum = 0, weight = 0;
  items.forEach(function(it){
    var v = num((ev.scores||{})[it.key], 0);
    if(v > 0){ sum += v*it.weight; weight += it.weight; }
  });
  if(!weight) return null;
  return Math.round(sum/weight*100)/100;
}
function evalSelfScore(ev){
  var items = evalItemsFor(ev.type);
  var sum = 0, weight = 0;
  items.forEach(function(it){
    var v = num((ev.selfScores||{})[it.key], 0);
    if(v > 0){ sum += v*it.weight; weight += it.weight; }
  });
  if(!weight) return null;
  return Math.round(sum/weight*100)/100;
}
function evalGradeLabel(score){
  if(score === null) return { label:'未評価', cls:'neutral' };
  if(score >= 3.5) return { label:'4 期待を上回る', cls:'ok' };
  if(score >= 2.75) return { label:'3 期待どおり',   cls:'ok' };
  if(score >= 1.75) return { label:'2 一部未達',     cls:'warn' };
  return { label:'1 未達', cls:'bad' };
}
function evalStageIndex(ev){
  for(var i=0;i<EVAL_STAGES.length;i++) if(EVAL_STAGES[i].key === (ev.stage||'self')) return i;
  return 0;
}
/* 評価2以下 → 改善計画が必要か */
function needsImprovementPlan(empId){
  var evs = sortBy(DB.data.evaluations.filter(function(e){ return e.employeeId===empId; }),
                   function(e){ return e.period; });
  if(!evs.length) return false;
  var last = evs[evs.length-1];
  var s = evalScore(last);
  if(s === null) return false;
  if(s < 1.75) return true;                              /* 評価1 は即時 */
  if(s < 2.75 && evs.length >= 2){                       /* 評価2 が継続 */
    var prev = evalScore(evs[evs.length-2]);
    if(prev !== null && prev < 2.75) return true;
  }
  return false;
}
function hasActivePlan(empId){
  return DB.data.improvementPlans.some(function(p){
    return p.employeeId === empId && p.status !== 'closed';
  });
}

/* ---------- 目標の進捗 ---------- */
function goalProgress(g){
  var base = num(g.baseline, 0), cur = num(g.current, 0), tgt = num(g.target90, 0);
  if(g.target90 === '' || g.target90 === undefined) return null;
  if(tgt === base) return cur >= tgt ? 100 : 0;
  var p = (cur - base) / (tgt - base) * 100;
  return clamp(Math.round(p), 0, 100);
}

/* ============================================================
   アラート（ダッシュボードの中心）
   level: bad = ルール違反・停止要因 / warn = 未整備・遅れ
   ============================================================ */
function buildAlerts(){
  var d = DB.data, a = [];
  function add(level, title, detail, view, count, tab){
    a.push({ level:level, title:title, detail:detail, view:view, count:count||0, tab:tab||'' });
  }

  /* --- 体制 --- */
  if(!d.settings.projectLead)
    add('bad','進行役がまだ決まっていません','この取り組みを進める担当を1名決めてください。設定画面で入力できます。','settings');
  if(!d.employees.length)
    add('bad','まだ誰も登録されていません','はじめに「社員・役割台帳」でメンバーを登録します。','employees');

  /* --- Week1 台帳の抜け --- */
  var noMgr = d.employees.filter(function(e){ return !e.manager && !e.isTop; });
  if(noMgr.length)
    add('bad','直属の上司が未記入の人が'+noMgr.length+'名',
        noMgr.map(function(e){return e.name;}).join('、')+' — 誰に報告し、誰に相談するかを決めます。','employees',noMgr.length);

  var noOut = d.employees.filter(function(e){ return !(e.deliverables||'').trim(); });
  if(noOut.length)
    add('warn','成果物が未記入の人が'+noOut.length+'名',
        '「何ができていれば、その仕事は終わりか」を決めて記入します。','employees',noOut.length);

  var noKpi = d.employees.filter(function(e){ return lines(e.kpis).length === 0; });
  if(noKpi.length)
    add('warn','KPIが未記入の人が'+noKpi.length+'名',
        '数字で成果を確かめられる指標を、1〜3個決めます。','employees',noKpi.length);

  var noData = d.employees.filter(function(e){ return lines(e.kpis).length>0 && !(e.dataSource||'').trim(); });
  if(noData.length)
    add('warn','数字の出どころが未記入の人が'+noData.length+'名',
        'KPIはあるものの、どのファイルの数字を基準にするかが決まっていません。','employees',noData.length);

  var onlyCeo = d.employees.filter(function(e){ return e.ceoOnlyKnows; });
  if(onlyCeo.length)
    add('warn','中身を知っているのが1人だけの仕事が'+onlyCeo.length+'件',
        '手順の記録と引き継ぎ先を決めておくと、休みや異動があっても仕事が止まりません。','employees',onlyCeo.length);

  var noBackup = d.employees.filter(function(e){ return !(e.backup||'').trim(); });
  if(noBackup.length >= Math.max(1, Math.ceil(d.employees.length*0.5)) && d.employees.length)
    add('warn','引き継ぎ先が未記入の人が'+noBackup.length+'名',
        '休みや急な異動のときに、誰が引き継ぐかを決めておきます。','employees',noBackup.length);

  /* --- 管理スパン（第14章：直属部下は4〜6人以内） --- */
  var maxDr = num(d.settings.maxDirectReports, 6);
  d.employees.forEach(function(e){
    var n = directReports(e.id).length;
    if(n > maxDr)
      add('warn','【'+e.name+'】の直属部下が'+n+'名',
          '上限'+maxDr+'名を超えています。中間層への委任を検討してください。','org',n);
  });

  /* --- 会社目標（第5章：3〜5個） --- */
  var comp = d.goals.filter(function(g){ return g.level === 'company'; });
  if(!comp.length)
    add('bad','会社の90日目標が未設定','3〜5個に絞って決めます。','goals');
  else if(comp.length > 5)
    add('warn','会社目標が'+comp.length+'個あります','3〜5個に絞ってください。目標が多いと全部が中途半端になります。','goals',comp.length);
  var goalNoOwner = d.goals.filter(function(g){ return !g.owner; });
  if(goalNoOwner.length)
    add('warn','責任者が未設定の目標が'+goalNoOwner.length+'件','目標には必ず1名の責任者を置きます。','goals',goalNoOwner.length);
  var goalNoData = d.goals.filter(function(g){ return !(g.dataSource||'').trim(); });
  if(goalNoData.length)
    add('warn','「正とするデータ」が未設定の目標が'+goalNoData.length+'件','どの数字を正とするかで揉めなくなります。','goals',goalNoData.length);

  /* --- 役割スコアカード（第6章：6〜8職種） --- */
  if(d.scorecards.length < 6)
    add('warn','役割スコアカードが'+d.scorecards.length+'職種のみ','6〜8区分の作成が目安です。','scorecards',d.scorecards.length);
  var empNoJob = d.employees.filter(function(e){ return !e.jobType; });
  if(empNoJob.length && d.scorecards.length)
    add('warn','職種が未設定の社員が'+empNoJob.length+'名','役割スコアカードと紐づきません。','employees',empNoJob.length);

  /* --- 週次KPI会議（第7章） --- */
  var lw = latestKpiWeek();
  if(!lw){
    if(projectDay().week >= 3) add('bad','週次KPI会議が未開始','Week 3〜5で開始する予定です。','kpi');
  }else{
    var gapDays = daysBetween(lw.weekOf, weekMonday());
    if(gapDays >= 14)
      add('bad','週次KPI会議が'+Math.floor(gapDays/7)+'週間実施されていません','最終記録：'+lw.weekOf,'kpi');
    else if(gapDays >= 7)
      add('warn','今週の週次KPI会議が未記録','最終記録：'+lw.weekOf,'kpi');
    var sm = kpiWeekSummary(lw);
    if(sm.unresolved)
      add('bad','対策・担当者・期限が未記入のKPIが'+sm.unresolved+'件',
          '未達項目は必ず「対策・担当者・期限」をその場で決めます。','kpi',sm.unresolved);
    if(sm.ng)
      add('warn','未達のKPIが'+sm.ng+'件','最新週（'+lw.weekOf+'）の状況です。','kpi',sm.ng);
  }

  /* --- 期限切れの対策 --- */
  var overdue = [];
  d.kpiWeeks.forEach(function(w){
    w.rows.forEach(function(r){
      if(r.due && !r.doneAt && r.due < todayStr() && String(r.action||'').trim())
        overdue.push({ week:w.weekOf, ind:r.indicator, owner:r.owner, due:r.due });
    });
  });
  if(overdue.length)
    add('bad','期限を過ぎた対策が'+overdue.length+'件',
        overdue.slice(0,3).map(function(o){
          return o.ind+'（'+(o.owner?empName(o.owner):'担当未定')+'・'+o.due+'）'; }).join(' / '),'kpi',overdue.length);

  /* --- 1on1（第9章） --- */
  var oo = oneOnOneRate();
  if(oo.total && oo.missing.length){
    var lvl = projectDay().week >= 4 ? 'warn' : 'warn';
    add(lvl,'今月の1on1がまだの人が'+oo.missing.length+'名',
        oo.missing.slice(0,6).map(function(e){return e.name;}).join('、')+(oo.missing.length>6?' ほか':''),'oneonone',oo.missing.length);
  }
  /* 約束の未確認 */
  var openPromises = 0;
  d.oneOnOnes.forEach(function(o){ (o.promises||[]).forEach(function(p){ if(!p.done) openPromises++; }); });
  if(openPromises >= 5)
    add('warn','未完了の「翌月の約束」が'+openPromises+'件','次回1on1で必ず結果を確認します。','oneonone',openPromises);

  /* --- 報告ルール（第8章） --- */
  var rc = reportCompliance();
  if(rc.late.length)
    add('bad','報告期限を守れなかった案件が'+rc.late.length+'件',
        '報告が遅れる原因（言いにくい・忘れる・判断に迷う）を1on1で扱ってください。','reports',rc.late.length,'log');
  var pending = d.reports.filter(function(r){ return r.needApproval && !r.approvedAt && r.status!=='rejected'; });
  if(pending.length)
    add('warn','承認待ちが'+pending.length+'件','承認が滞ると現場が止まります。','reports',pending.length,'approval');

  /* --- 評価（第10・12章） --- */
  var period = d.settings.currentPeriod;
  var evs = d.evaluations.filter(function(e){ return e.period === period; });
  if(d.employees.length && projectDay().week >= 8 && !evs.length)
    add('warn','今期（'+period+'）の評価が未着手','Week 8〜12で初回試験評価を行います。','evaluations');
  var stuck = evs.filter(function(e){ return e.stage !== 'explained'; });
  if(evs.length && stuck.length)
    add('warn','評価が未完了の社員が'+stuck.length+'名','本人説明まで完了して1サイクルです。','evaluations',stuck.length);

  /* --- 改善計画（第13章） --- */
  d.employees.forEach(function(e){
    if(needsImprovementPlan(e.id) && !hasActivePlan(e.id))
      add('bad','【'+e.name+'】改善計画が必要','評価1、または評価2が継続しています。30〜60日の改善計画を作成してください。','improvement');
  });

  /* --- 等級 --- */
  var noGrade = d.employees.filter(function(e){ return !e.grade; });
  if(noGrade.length && projectDay().week >= 6)
    add('warn','等級が未設定の社員が'+noGrade.length+'名','G1〜G5への仮格付けを行います。','grades',noGrade.length);

  /* ============================================================
     ここから下は、決め方・任せ方・お金の使い方についての判定
     ============================================================ */

  /* --- 重要な決定（24時間おいてから確定する） --- */
  var readyDec = d.decisions.filter(function(x){
    return (x.stage==='holding'||x.stage==='draft') && hoursLeft(holdUntil(x, 24)) <= 0;
  });
  if(readyDec.length)
    add('warn','待ち時間が明けた決定が'+readyDec.length+'件',
        readyDec.slice(0,3).map(function(x){return x.title;}).join('／')+' — 24時間が過ぎました。確定するか見送るかを決めてください。','decisions',readyDec.length);

  var noDevil = d.decisions.filter(function(x){
    return x.stage!=='decided' && x.stage!=='dropped' && (!x.devilName || !String(x.devilNote||'').trim());
  });
  if(noDevil.length)
    add('warn','反対意見の確認が済んでいない決定が'+noDevil.length+'件',
        '大きな決定には、反対の立場から意見を言う人を1名置きます。反論が出ないときは、納得ではなく言いにくいだけかもしれません。','decisions',noDevil.length);

  var forced = d.decisions.filter(function(x){ return x.stage==='decided' && x.heldOk===false; });
  if(forced.length >= 2)
    add('warn','待ち時間をおかずに確定した決定が'+forced.length+'件',
        '急ぎの事情が続いているのかもしれません。手順のほうに無理がないか、一度見直してみてください。','decisions',forced.length);

  var readyVen = d.ventures.filter(function(v){
    return (!v.stage||v.stage==='draft') && hoursLeft(holdUntil(v, 48)) <= 0;
  });
  if(readyVen.length)
    add('warn','判断待ちの新しい取り組みが'+readyVen.length+'件',
        '48時間が過ぎました。企画書を見て、始めるか見送るかを決めてください。','decisions',readyVen.length);

  var noExit = d.ventures.filter(function(v){
    return (v.stage==='approved'||v.stage==='running') && !String(v.exitCond||'').trim();
  });
  if(noExit.length)
    add('bad','撤退の条件が決まっていない取り組みが'+noExit.length+'件',
        'いつ・何を見てやめるかは、始める前に決めておきます。あとからでは決めにくくなります。','decisions',noExit.length);

  /* --- 任せた仕事（6項目と中間確認） --- */
  var openDlg = d.delegations.filter(function(x){ return !x.state || x.state==='open'; });
  var noCheck = openDlg.filter(function(x){ return !nextCheckDate(x); });
  if(noCheck.length)
    add('bad','途中の確認日が決まっていない仕事が'+noCheck.length+'件',
        noCheck.slice(0,3).map(function(x){return x.title;}).join('／')+' — 確認日がないと、状況が見えないまま期限を迎えがちです。','delegation',noCheck.length);

  var lateCheck = openDlg.filter(function(x){
    var nc = nextCheckDate(x); return nc && nc < todayStr();
  });
  if(lateCheck.length)
    add('bad','中間確認の期日を過ぎた委任が'+lateCheck.length+'件',
        '問題を小さいうちに見つける機会です。遅れるほど、発覚時の損失が大きくなります。','delegation',lateCheck.length);

  var todayCheck = openDlg.filter(function(x){ return nextCheckDate(x) === todayStr(); });
  if(todayCheck.length)
    add('warn','今日が中間確認日の委任が'+todayCheck.length+'件',
        todayCheck.map(function(x){return x.title;}).join('／'),'delegation',todayCheck.length);

  var thinDlg = openDlg.filter(function(x){ return delegationFill(x).rate < 100; });
  if(thinDlg.length)
    add('warn','6項目が埋まっていない委任が'+thinDlg.length+'件',
        '成果・期限・裁量・禁止事項・中間確認・相談条件のどれかが空欄です。','delegation',thinDlg.length);

  /* --- 人材の定着（第7章 逆選抜） --- */
  var noPath = d.employees.filter(function(e){
    return !e.isTop && !String(e.nextRole||'').trim() && !String(e.growthTalkAt||'').trim();
  });
  if(noPath.length && d.employees.length >= 3)
    add('warn','これからの役割をまだ話せていない人が'+noPath.length+'名',
        '半年後・1年後に何を任せたいかを伝えると、次に何を伸ばせばよいかが見えます。1on1で話す内容の候補です。',
        'employees',noPath.length);

  /* --- ガバナンス（第11章 第4層） --- */
  var noContract = d.partners.filter(function(p){ return !p.contractDone; });
  if(noContract.length)
    add('bad','契約・合意が文書化されていない関係者が'+noContract.length+'件',
        noContract.map(function(p){return p.name;}).join('、')+
        ' — 信頼できる相手だから契約が要らないのではなく、信頼を長く保つために契約します。','capital',noContract.length,'partner');

  var noInterest = d.partners.filter(function(p){ return !String(p.interest||'').trim(); });
  if(noInterest.length)
    add('warn','相手の利害を書けていない関係者が'+noInterest.length+'件',
        'ここを書けない相手とは、必ずどこかで期待値がずれます。','capital',noInterest.length,'partner');

  var dueCheck = d.partners.filter(function(p){ return p.nextCheck && p.nextCheck < todayStr(); });
  if(dueCheck.length)
    add('warn','定期確認の期日を過ぎた関係者が'+dueCheck.length+'件',
        dueCheck.map(function(p){return p.name;}).join('、'),'capital',dueCheck.length,'partner');

  /* --- 資本配分（第11章 第4層） --- */
  var capRule = (d.capital && d.capital.rule) || {};
  var capPeriod = currentCapPeriod();
  if(capPeriod){
    var cs = capitalSummary(capPeriod);
    if(cs.rate !== null && cs.rate < num(capRule.reinvestRate,50))
      add('warn','再投資率が目標を下回っています（'+cs.rate+'% ／ 目標'+num(capRule.reinvestRate,50)+'%）',
          '利益を人材・営業・商品・仕組みへ戻さないと、組織能力の複利が止まります。','capital');
    if(num(capRule.nonBizCap,0) > 0 && cs.nonbiz > num(capRule.nonBizCap,0))
      add('bad','事業と関係ない支出が年間上限を超えています',
          yen(cs.nonbiz)+'円 ／ 上限 '+yen(capRule.nonBizCap)+'円','capital');
  }

  /* --- 診断の上流指標 --- */
  var dq = diagnosisSummary();
  dq.upstreamNo.forEach(function(it){
    add('bad','上流指標の警告：'+it.q,
        'この項目は、他の多くの問題へ波及します。ここから先に手を付けてください。','diagnosis');
  });

  /* --- 報酬連動の注意（第12章・注意書き） --- */
  if(d.settings.payLinked && !d.settings.laborCheckDone)
    add('bad','報酬連動を有効にしていますが、就業規則等の確認が未完了です',
        '減給・賞与・降格への連動前に、就業規則・賃金規程との整合を社労士等へ確認してください。','settings');

  var order = { bad:0, warn:1 };
  return a.sort(function(x,y){ return order[x.level]-order[y.level]; });
}

/* ダッシュボードの「導入完成度」 */
function readinessScore(){
  var d = DB.data, parts = [];
  /* 1) 台帳の完成度 */
  var lg = d.employees.length ?
    Math.round(d.employees.reduce(function(s,e){ return s+ledgerStatus(e).rate; },0)/d.employees.length) : 0;
  parts.push({ key:'ledger', label:'社員・役割台帳', rate:lg, view:'employees' });
  /* 2) 目標 */
  var comp = d.goals.filter(function(g){ return g.level==='company'; });
  var gRate = 0;
  if(comp.length){
    var full = comp.filter(function(g){ return g.metric && g.target90!=='' && g.owner && g.dataSource; }).length;
    gRate = Math.round(full/comp.length*100 * clamp(comp.length/3,0,1));
  }
  parts.push({ key:'goals', label:'会社・部門目標', rate:gRate, view:'goals' });
  /* 3) 役割スコアカード */
  var scRate = clamp(Math.round(d.scorecards.length/6*100),0,100);
  parts.push({ key:'scorecards', label:'職種別役割表', rate:scRate, view:'scorecards' });
  /* 4) 週次KPI（直近4週の実施率） */
  var weeks = 0, mon = weekMonday();
  for(var i=0;i<4;i++){
    var target = fmtDate(new Date(new Date(mon).getTime() - i*7*86400000));
    if(d.kpiWeeks.some(function(w){ return w.weekOf === target; })) weeks++;
  }
  parts.push({ key:'kpi', label:'週次KPI会議', rate:Math.round(weeks/4*100), view:'kpi' });
  /* 5) 1on1 */
  parts.push({ key:'oneonone', label:'月次1on1', rate:oneOnOneRate().rate, view:'oneonone' });
  /* 6) 評価 */
  var period = d.settings.currentPeriod;
  var evs = d.evaluations.filter(function(e){ return e.period===period; });
  var eRate = d.employees.length ? Math.round(evs.filter(function(e){ return e.stage==='explained'; }).length/d.employees.length*100) : 0;
  parts.push({ key:'evaluations', label:'評価（当期）', rate:eRate, view:'evaluations' });
  /* 7) 等級 */
  var gr = d.employees.length ? Math.round(d.employees.filter(function(e){return !!e.grade;}).length/d.employees.length*100) : 0;
  parts.push({ key:'grades', label:'等級格付け', rate:gr, view:'grades' });
  /* 8) 報告ルール（記録が1件もない場合は「未評価」として平均から除外する） */
  var rc = reportCompliance();
  parts.push({ key:'reports', label:'報告・承認の遵守', rate:rc.total?rc.rate:0, na:!rc.total, view:'reports' });

  var counted = parts.filter(function(p){ return !p.na; });
  var total = counted.length ? Math.round(counted.reduce(function(s,p){ return s+p.rate; },0)/counted.length) : 0;
  return { total:total, parts:parts };
}
