/* org-ops アプリの描画テスト（簡易DOMスタブ） */
const fs = require('fs'), path = require('path'), vm = require('vm');

const DIR = path.join(__dirname, '..', 'src', 'js');

/* ---------- 最小DOMスタブ ---------- */
function mkNode(tag){
  const n = {
    tagName:(tag||'div').toUpperCase(), nodeName:(tag||'div').toUpperCase(),
    _html:'', textContent:'', value:'', checked:false, files:[], dataset:{}, style:{},
    children:[], parentNode:null, scrollTop:0, type:'',
    classList:{ add(){}, remove(){}, contains(){return false;} },
    set innerHTML(v){ this._html = String(v); },
    get innerHTML(){ return this._html; },
    addEventListener(){}, removeEventListener(){}, click(){}, focus(){}, blur(){},
    setAttribute(){}, getAttribute(){ return null; }, hasAttribute(){ return false; },
    appendChild(c){ this.children.push(c); c.parentNode = this; return c; },
    removeChild(c){ this.children = this.children.filter(x=>x!==c); return c; },
    insertAdjacentHTML(){}, closest(){ return null; },
    querySelector(){ return mkNode('div'); },
    querySelectorAll(){ const a = []; a.forEach = Array.prototype.forEach; return a; }
  };
  Object.defineProperty(n,'onclick',{ set(){}, get(){ return null; } });
  return n;
}
const doc = {
  readyState:'complete', title:'',
  body: mkNode('body'),
  documentElement: mkNode('html'),
  _els:{},
  getElementById(id){ if(!this._els[id]) this._els[id] = mkNode('div'); return this._els[id]; },
  createElement(t){ return mkNode(t); },
  addEventListener(){}, querySelector(){ return mkNode('div'); },
  querySelectorAll(){ return []; },
  write(){}, close(){}
};
const store = {};
const sandbox = {
  document: doc,
  window: { addEventListener(){}, scrollTo(){}, print(){}, open(){ return null; }, location:{ hash:'' } },
  localStorage:{
    getItem(k){ return k in store ? store[k] : null; },
    setItem(k,v){ store[k] = String(v); },
    removeItem(k){ delete store[k]; }
  },
  location:{ hash:'' },
  navigator:{ userAgent:'node' },
  console, JSON, Math, Date, Array, Object, String, Number, Boolean, RegExp, Error, isFinite, parseFloat, parseInt,
  Promise,
  setTimeout:()=>0, clearTimeout:()=>{}, setInterval:()=>0, clearInterval:()=>{},
  Blob: function(){}, URL:{ createObjectURL(){ return 'blob:x'; }, revokeObjectURL(){} },
  FileReader: function(){ this.readAsText = ()=>{}; },
  alert(){}, confirm(){ return true; }
};
sandbox.window.document = doc;
sandbox.globalThis = sandbox;

const files = fs.readdirSync(DIR).filter(f=>f.endsWith('.js')).sort();
const code = files.map(f=>'\n/* == '+f+' == */\n'+fs.readFileSync(path.join(DIR,f),'utf8')).join('\n');

const ctx = vm.createContext(sandbox);
let fail = 0;
function t(name, fn){
  try{ fn(); console.log('  OK   '+name); }
  catch(e){ fail++; console.log('  NG   '+name+'\n       → '+e.message+'\n'+String(e.stack).split('\n').slice(1,4).map(s=>'         '+s.trim()).join('\n')); }
}

console.log('■ 読み込み');
t('全JSの読み込みと起動', ()=>{ vm.runInContext(code, ctx, {filename:'app.js'}); });
if(fail){ process.exit(1); }

const VIEWS = ctx.VIEWS, ACTIONS = ctx.ACTIONS, DB = ctx.DB;
const viewKeys = Object.keys(VIEWS);

console.log('\n■ 空データでの全画面描画（'+viewKeys.length+'画面）');
viewKeys.forEach(k=>{
  t(k, ()=>{
    const h = VIEWS[k].render();
    if(typeof h !== 'string' || h.length < 20) throw new Error('HTMLが生成されていない (len='+(h||'').length+')');
    if(/undefined|NaN|\[object Object\]/.test(h)) {
      const m = h.match(/.{0,60}(undefined|NaN|\[object Object\]).{0,40}/);
      throw new Error('出力に不正な値: ...'+m[0].replace(/\s+/g,' ')+'...');
    }
  });
});

console.log('\n■ サンプルデータの投入');
t('buildDemoData()', ()=>{ ctx.buildDemoData(); DB.save(); });
t('社員8名/目標7件/職種8件が入っている', ()=>{
  const d = DB.data;
  if(d.employees.length !== 8) throw new Error('社員数='+d.employees.length);
  if(d.goals.length !== 7) throw new Error('目標数='+d.goals.length);
  if(d.scorecards.length !== 8) throw new Error('職種数='+d.scorecards.length);
  if(d.kpiWeeks.length !== 2) throw new Error('KPI週数='+d.kpiWeeks.length);
  if(d.evaluations.length !== 7) throw new Error('評価数='+d.evaluations.length);
});

console.log('\n■ サンプルデータでの全画面描画');
viewKeys.forEach(k=>{
  t(k, ()=>{
    const h = VIEWS[k].render();
    if(typeof h !== 'string' || h.length < 20) throw new Error('HTMLが生成されていない');
    if(/undefined|NaN|\[object Object\]/.test(h)) {
      const m = h.match(/.{0,60}(undefined|NaN|\[object Object\]).{0,40}/);
      throw new Error('出力に不正な値: ...'+m[0].replace(/\s+/g,' ')+'...');
    }
  });
});

console.log('\n■ タブ切替のある画面');
['rules','log','approval','incidents','exceptions'].forEach(tab=>{
  t('報告画面 タブ='+tab, ()=>{ ACTIONS.repTab({t:tab}); VIEWS.reports.render(); });
});
['decision','venture','rule'].forEach(tab=>{
  t('意思決定の防波堤 タブ='+tab, ()=>{ ACTIONS.decTab({t:tab}); VIEWS.decisions.render(); });
});
['capital','partner'].forEach(tab=>{
  t('資本配分・関係者 タブ='+tab, ()=>{ ACTIONS.capTab({t:tab}); VIEWS.capital.render(); });
});
['indicator','loop','check','structure'].forEach(tab=>{
  t('健全度診断 タブ='+tab, ()=>{ ACTIONS.diagTab({t:tab}); VIEWS.diagnosis.render(); });
});

console.log('\n■ 判定ロジック');
t('アラート生成', ()=>{ const a = ctx.buildAlerts(); if(!Array.isArray(a)) throw new Error('配列でない'); });
t('導入完成度の算出', ()=>{
  const r = ctx.readinessScore();
  if(!(r.total >= 0 && r.total <= 100)) throw new Error('範囲外: '+r.total);
  r.parts.forEach(p=>{ if(!(p.rate>=0 && p.rate<=100)) throw new Error(p.label+'='+p.rate); });
});
t('評価点の加重平均（一般社員 3,3,3 → 3.00）', ()=>{
  const s = ctx.evalScore({type:'general', scores:{kpi:3,process:3,growth:3}});
  if(s !== 3) throw new Error('結果='+s);
});
t('評価点の加重平均（管理職 4,3,3,2 → 3.40）', ()=>{
  /* 4*50 + 3*25 + 3*15 + 2*10 = 340 → 3.40 */
  const s = ctx.evalScore({type:'manager', scores:{team:4,people:3,risk:3,improve:2}});
  if(Math.abs(s - 3.40) > 0.001) throw new Error('結果='+s);
});
t('未入力項目は加重から除外される', ()=>{
  const s = ctx.evalScore({type:'general', scores:{kpi:4}});
  if(s !== 4) throw new Error('結果='+s);
  const n = ctx.evalScore({type:'general', scores:{}});
  if(n !== null) throw new Error('未入力はnullであるべき: '+n);
});
t('KPI状態判定（小さいほど良い指標）', ()=>{
  if(ctx.kpiRowStatus({target:20000, actual:19000, lowerIsBetter:true}) !== 'ok') throw new Error('達成判定が誤り');
  if(ctx.kpiRowStatus({target:20000, actual:21000, lowerIsBetter:true}) !== 'watch') throw new Error('注意判定が誤り');
  if(ctx.kpiRowStatus({target:20000, actual:40000, lowerIsBetter:true}) !== 'ng') throw new Error('未達判定が誤り');
  if(ctx.kpiRowStatus({target:100, actual:100}) !== 'ok') throw new Error('同値は達成であるべき');
  if(ctx.kpiRowStatus({target:100, actual:95}) !== 'watch') throw new Error('95%は注意であるべき');
  if(ctx.kpiRowStatus({target:100, actual:50}) !== 'ng') throw new Error('50%は未達であるべき');
  if(ctx.kpiRowStatus({target:100, actual:''}) !== 'none') throw new Error('空欄は未入力であるべき');
});
t('報告期限の判定（24時間ルール）', ()=>{
  const base = new Date('2026-08-01T09:00:00');
  const in10 = new Date('2026-08-01T19:00:00'), over = new Date('2026-08-03T09:00:00');
  const a = ctx.reportDeadlineStatus({ruleKey:'bad_number', knownAt:base.toISOString(), reportedAt:in10.toISOString()});
  if(a.cls !== 'ok') throw new Error('10時間後は期限内のはず: '+a.label);
  const b = ctx.reportDeadlineStatus({ruleKey:'bad_number', knownAt:base.toISOString(), reportedAt:over.toISOString()});
  if(b.cls !== 'bad') throw new Error('48時間後は遅延のはず: '+b.label);
  const c = ctx.reportDeadlineStatus({ruleKey:'contract', status:'after'});
  if(c.cls !== 'bad') throw new Error('事後報告は違反のはず');
});
t('目標進捗（小さいほど良い指標も正しく進捗する）', ()=>{
  const p = ctx.goalProgress({baseline:28000, current:23000, target90:20000, lowerIsBetter:true});
  if(Math.abs(p - 63) > 1) throw new Error('CPA進捗='+p);
});
t('改善計画の要否判定', ()=>{
  const d = DB.data;
  const emp = d.employees[0];
  d.evaluations = d.evaluations.filter(e=>e.employeeId!==emp.id);
  d.evaluations.push({id:'x1', employeeId:emp.id, period:'2026-Q1', type:'general', scores:{kpi:2,process:2,growth:2}});
  if(ctx.needsImprovementPlan(emp.id)) throw new Error('評価2が1回だけでは不要のはず');
  d.evaluations.push({id:'x2', employeeId:emp.id, period:'2026-Q2', type:'general', scores:{kpi:2,process:2,growth:2}});
  if(!ctx.needsImprovementPlan(emp.id)) throw new Error('評価2が2期連続なら必要のはず');
  d.evaluations = d.evaluations.filter(e=>e.id!=='x1' && e.id!=='x2');
  d.evaluations.push({id:'x3', employeeId:emp.id, period:'2026-Q2', type:'general', scores:{kpi:1,process:1,growth:1}});
  if(!ctx.needsImprovementPlan(emp.id)) throw new Error('評価1は即時必要のはず');
  d.evaluations = d.evaluations.filter(e=>e.id!=='x3');
});
t('管理スパン超過を検知する', ()=>{
  const d = DB.data;
  const boss = d.employees[0];
  const added = [];
  for(let i=0;i<8;i++){ const e = {id:'tmp'+i, name:'臨時'+i, manager:boss.id}; d.employees.push(e); added.push(e); }
  const alerts = ctx.buildAlerts();
  const hit = alerts.some(a=>a.title.indexOf('直属部下が') >= 0);
  d.employees = d.employees.filter(e=>added.indexOf(e) < 0);
  if(!hit) throw new Error('部下9名でも警告が出ていない');
});

console.log('\n■ 入力フォームの生成（モーダル）');
const formTests = [
  ['社員の追加', ()=>ACTIONS.empNew({})],
  ['社員の編集', ()=>ACTIONS.empEdit({id:DB.data.employees[1].id})],
  ['社員の詳細', ()=>ACTIONS.empView({id:DB.data.employees[1].id})],
  ['目標の追加', ()=>ACTIONS.goalNew({level:'company'})],
  ['目標の編集', ()=>ACTIONS.goalEdit({id:DB.data.goals[0].id})],
  ['目標の実績更新', ()=>ACTIONS.goalUpdate({id:DB.data.goals[0].id})],
  ['職種の追加', ()=>ACTIONS.scNew({})],
  ['職種の編集', ()=>ACTIONS.scEdit({id:DB.data.scorecards[0].id})],
  ['KPI行の追加', ()=>ACTIONS.kpiRowNew({w:DB.data.kpiWeeks[0].id})],
  ['KPI行の編集', ()=>ACTIONS.kpiRowEdit({w:DB.data.kpiWeeks[0].id, r:DB.data.kpiWeeks[0].rows[0].id})],
  ['KPI取り込み', ()=>ACTIONS.kpiImport({w:DB.data.kpiWeeks[0].id})],
  ['議事記録', ()=>ACTIONS.kpiMinutes({w:DB.data.kpiWeeks[0].id})],
  ['会議モード', ()=>ACTIONS.kpiMeetingMode({w:DB.data.kpiWeeks[0].id})],
  ['1on1の新規', ()=>ACTIONS.oooNewFor({emp:DB.data.employees[2].id})],
  ['1on1の編集', ()=>ACTIONS.oooEdit({id:DB.data.oneOnOnes[0].id})],
  ['1on1履歴', ()=>ACTIONS.oooHistory({emp:DB.data.oneOnOnes[0].employeeId})],
  ['評価シート（一般）', ()=>ACTIONS.evalOpen({id:DB.data.evaluations.filter(e=>e.type==='general')[0].id})],
  ['評価シート（管理職）', ()=>ACTIONS.evalOpen({id:DB.data.evaluations.filter(e=>e.type==='manager')[0].id})],
  ['評価者差の確認', ()=>ACTIONS.evalDist({})],
  ['等級の編集', ()=>ACTIONS.gradeEdit({code:'G3'})],
  ['昇格の検討', ()=>ACTIONS.gradePromote({id:DB.data.employees[1].id})],
  ['報告の登録', ()=>ACTIONS.repNew({rule:'claim'})],
  ['承認申請の登録', ()=>ACTIONS.repNewApproval({})],
  ['承認の記録', ()=>ACTIONS.repApprove({id:DB.data.reports.filter(r=>r.needApproval)[0].id})],
  ['問題処理の記録', ()=>ACTIONS.incNew({})],
  ['問題処理の編集', ()=>ACTIONS.incEdit({id:DB.data.incidents[0].id})],
  ['例外の記録', ()=>ACTIONS.excNew({})],
  ['例外の編集', ()=>ACTIONS.excEdit({id:DB.data.exceptions[0].id})],
  ['改善計画の作成', ()=>ACTIONS.impNewFor({emp:DB.data.employees[3].id})],
  ['確認ダイアログ（一括作成）', ()=>ACTIONS.evalCreateAll({})],
  ['確認ダイアログ（標準職種）', ()=>ACTIONS.scCreateDefaults({})],
  ['確認ダイアログ（全削除）', ()=>ACTIONS.dataClear({})],
  ['仕事を渡す操作', ()=>ACTIONS.dlgNew({})],
  ['任せた仕事の編集', ()=>ACTIONS.dlgEdit({id:DB.data.delegations[0].id})],
  ['中間確認の記録', ()=>ACTIONS.dlgCheck({id:DB.data.delegations[0].id})],
  ['委任の終了', ()=>ACTIONS.dlgClose({id:DB.data.delegations[0].id})],
  ['重大決裁の登録', ()=>ACTIONS.decNew({})],
  ['重大決裁の編集', ()=>ACTIONS.decEdit({id:DB.data.decisions[0].id})],
  ['重大決裁の確定（防波堤が働く）', ()=>ACTIONS.decDecide({id:DB.data.decisions[0].id})],
  ['重大決裁の確定（条件を満たす）', ()=>ACTIONS.decDecide({id:DB.data.decisions[1].id})],
  ['1枚企画書の作成', ()=>ACTIONS.venNew({})],
  ['1枚企画書の編集', ()=>ACTIONS.venEdit({id:DB.data.ventures[0].id})],
  ['新規案件の審査', ()=>ACTIONS.venApprove({id:DB.data.ventures[0].id})],
  ['期の追加', ()=>ACTIONS.capPeriodNew({})],
  ['期の編集', ()=>ACTIONS.capPeriodEdit({id:DB.data.capital.periods[0].id})],
  ['支出の記録', ()=>ACTIONS.capSpendNew({})],
  ['支出の編集', ()=>ACTIONS.capSpendEdit({id:DB.data.capital.spends[0].id})],
  ['関係者の追加', ()=>ACTIONS.parNew({})],
  ['関係者の編集', ()=>ACTIONS.parEdit({id:DB.data.partners[0].id})],
  ['関係者の定期確認', ()=>ACTIONS.parCheck({id:DB.data.partners[0].id})],
  ['診断結果の記録', ()=>ACTIONS.diagSnapshot({})]
];
formTests.forEach(([name, fn])=>{
  t(name, ()=>{ fn(); ctx.closeAllModals(); });
});

console.log('\n■ 会議モードの再描画');
t('会議モードを開くと再描画関数が登録される', ()=>{
  ACTIONS.kpiMeetingMode({w:DB.data.kpiWeeks[0].id});
  const modal = ctx._modalStack[ctx._modalStack.length-1];
  if(!modal || typeof modal._redraw !== 'function') throw new Error('_redraw が登録されていない');
  modal._redraw();
  ctx.closeAllModals();
});
t('会議モード中に行を編集しても落ちない', ()=>{
  const w = DB.data.kpiWeeks[0];
  ACTIONS.kpiMeetingMode({w:w.id});
  ACTIONS.kpiMeetRowEdit({w:w.id, r:w.rows[2].id});
  ctx.closeAllModals();
});

console.log('\n■ 改善計画の作成〜週次確認〜終了');
t('改善計画を作って週次確認を追加する', ()=>{
  const emp = DB.data.employees[3];
  DB.data.improvementPlans.push({ id:'ip1', employeeId:emp.id, managerId:emp.manager,
    startDate:'2026-08-01', endDate:'2026-09-15', facts:'a', expected:'b', measure:'c', support:'d',
    items:['x','y'], weeklyChecks:[], status:'open', result:'' });
  ACTIONS.impCheckNew({id:'ip1'}); ctx.closeAllModals();
  DB.data.improvementPlans[0].weeklyChecks.push({date:'2026-08-08', note:'改善傾向', judge:'part'});
  const h = VIEWS.improvement.render();
  if(h.indexOf('改善傾向') < 0) throw new Error('週次確認が表示されていない');
  ACTIONS.impClose({id:'ip1'}); ctx.closeAllModals();
});

console.log('\n■ 決め方・任せ方・お金の使い方');
t('24時間ルール：待ち時間が残っていると確定できない', ()=>{
  const now = new Date();
  const rec = { title:'x', kind:'people', raisedAt:new Date(now.getTime()-2*3600000).toISOString(),
                devilName:'A', devilNote:'反対理由', lossNow:'a', lossWait:'b' };
  const r = ctx.decisionCanDecide(rec);
  if(r.ok) throw new Error('2時間後は確定できないはず');
  if(!r.reasons.some(x=>x.indexOf('待ち時間')>=0)) throw new Error('理由に待ち時間が含まれない: '+r.reasons.join('/'));
});
t('24時間ルール：条件がそろえば確定できる', ()=>{
  const now = new Date();
  const rec = { title:'x', kind:'people', raisedAt:new Date(now.getTime()-30*3600000).toISOString(),
                devilName:'A', devilNote:'反対理由', lossNow:'a', lossWait:'b' };
  if(!ctx.decisionCanDecide(rec).ok) throw new Error('30時間後・全項目記入なら確定できるはず');
});
t('反対意見が未記録なら、時間が経っても確定できない', ()=>{
  const now = new Date();
  const rec = { title:'x', kind:'people', raisedAt:new Date(now.getTime()-30*3600000).toISOString(),
                devilName:'A', devilNote:'', lossNow:'a', lossWait:'b' };
  if(ctx.decisionCanDecide(rec).ok) throw new Error('反対意見が空なら確定できないはず');
  rec.devilNote = '費用が想定より膨らむ可能性がある';
  if(!ctx.decisionCanDecide(rec).ok) throw new Error('記録されていれば確定できるはず');
});
t('決定の記録に、心理状態を残す項目がない', ()=>{
  if(typeof ctx.EMOTION_LEVELS !== 'undefined') throw new Error('EMOTION_LEVELS が残っている');
  const src = fs.readFileSync(path.join(DIR,'16-decisions.js'),'utf8');
  if(/emotion/i.test(src)) throw new Error('16-decisions.js に emotion が残っている');
});
t('社員台帳に、給与と離職リスクの項目がない', ()=>{
  const src = fs.readFileSync(path.join(DIR,'05-employees.js'),'utf8');
  if(/salary|retentionRisk/.test(src)) throw new Error('05-employees.js に salary / retentionRisk が残っている');
});
t('指摘の文面に、特定の人を評価する語が混ざらない', ()=>{
  const bad = ['社長だけ','離職リスク','放置','激昂','支配'];
  ctx.buildAlerts().forEach(a=>{
    const line = (a.title||'')+' '+(a.detail||'');
    bad.forEach(w=>{ if(line.indexOf(w)>=0) throw new Error('「'+w+'」が指摘文にある: '+line); });
  });
});
t('48時間ルール：1枚企画書が埋まっていないと着手できない', ()=>{
  const v = DB.data.ventures.filter(x=>!x.gain)[0];
  if(!v) throw new Error('未記入のサンプルがない');
  if(ctx.ventureCanStart(v).ok) throw new Error('未記入なのに着手できてしまう');
  if(ctx.ventureFill(v).rate === 100) throw new Error('記入率の計算が誤り');
});
t('任せた仕事：6項目の記入率と中間確認の状態', ()=>{
  const full = DB.data.delegations[0];
  if(ctx.delegationFill(full).rate !== 100) throw new Error('6項目そろって100%のはず: '+ctx.delegationFill(full).rate);
  const thin = DB.data.delegations[2];
  if(ctx.delegationFill(thin).rate === 100) throw new Error('空欄があるのに100%');
  if(ctx.delegationState(thin).key !== 'noCheck') throw new Error('中間確認日なしを検知できていない: '+ctx.delegationState(thin).key);
});
t('任せた仕事：中間確認の実施率が集計される', ()=>{
  const st = ctx.delegationStats();
  if(st.total !== 4) throw new Error('件数='+st.total);
  if(st.checkRate === null || st.checkRate < 0 || st.checkRate > 100) throw new Error('実施率='+st.checkRate);
});
t('先行指標6領域がすべて計算できる', ()=>{
  const m = ctx.leadingMetrics();
  ctx.LEADING_INDICATORS.forEach(x=>{
    if(!m[x.key]) throw new Error('未計算: '+x.key);
    const s = m[x.key].score;
    if(s !== null && (s < 0 || s > 100)) throw new Error(x.label+'のスコアが範囲外: '+s);
    if(typeof m[x.key].value !== 'string') throw new Error(x.label+'の表示値がない');
  });
});
t('5つの強化ループのスコアが範囲内', ()=>{
  const sc = ctx.loopScores();
  ctx.NEGATIVE_LOOPS.forEach(lp=>{
    const s = sc[lp.id] && sc[lp.id].score;
    if(s !== null && s !== undefined && (s < 0 || s > 100)) throw new Error(lp.id+'='+s);
    if(!sc[lp.id] || !sc[lp.id].facts.length) throw new Error(lp.id+' の根拠が空');
  });
});
t('正の循環スコアが算出される', ()=>{
  const v = ctx.positiveCycleScore();
  if(v === null || v < 0 || v > 100) throw new Error('スコア='+v);
});
t('検証質問の回答が保存され、上流指標の警告が出る', ()=>{
  ACTIONS.diagAns({k:'e1', v:'yes'});
  if(DB.data.diagnosis.answers.e1 !== 'yes') throw new Error('「できている」が保存されていない');
  if(ctx.diagnosisSummary().upstreamNo.some(x=>x.key==='e1')) throw new Error('できているのに警告が出ている');
  ACTIONS.diagAns({k:'e1', v:'no'});
  const q = ctx.diagnosisSummary();
  if(DB.data.diagnosis.answers.e1 !== 'no') throw new Error('回答が保存されていない');
  if(!q.upstreamNo.some(x=>x.key==='e1')) throw new Error('上流指標の警告が出ていない');
  ACTIONS.diagAns({k:'e1', v:'no'});
  if(DB.data.diagnosis.answers.e1 !== '') throw new Error('もう一度押しても取り消しできていない');
  ACTIONS.diagAns({k:'e1', v:'no'});
});
t('再投資率と非事業支出が集計される', ()=>{
  const p = ctx.currentCapPeriod();
  const s = ctx.capitalSummary(p);
  if(!(s.profit > 0)) throw new Error('利益が集計されていない');
  if(s.rate === null || s.rate < 0) throw new Error('再投資率='+s.rate);
  if(!(s.nonbiz >= 0)) throw new Error('非事業支出='+s.nonbiz);
});
t('アラートの文面に内部IDが混ざらない', ()=>{
  ctx.buildAlerts().forEach(a=>{
    const s = (a.title||'') + ' ' + (a.detail||'');
    const m = s.match(/[a-z]{2,4}_[a-z0-9]{6,}_[a-z0-9]{3,}/);
    if(m) throw new Error('内部IDがそのまま出ている: ' + m[0] + '\n       文面: ' + s);
  });
});
t('新しいアラートが検出される', ()=>{
  const titles = ctx.buildAlerts().map(a=>a.title).join('｜');
  ['途中の確認日が決まっていない','反対意見の確認','契約・合意が文書化されていない','これからの役割'].forEach(k=>{
    if(titles.indexOf(k) < 0) throw new Error('検出されていない: '+k);
  });
});

console.log('\n■ 共有（オンラインで一緒に使う）');
t('共有モードの初期値はこのPCのみ', ()=>{
  ctx.syncLoadCfg();
  if(ctx.SYNC.cfg.mode !== 'local') throw new Error('mode='+ctx.SYNC.cfg.mode);
  if(ctx.syncModeLabel() !== 'このパソコンのみ') throw new Error(ctx.syncModeLabel());
});
t('共有設定が保存・復元される', ()=>{
  ctx.SYNC.cfg.mode = 'server';
  ctx.SYNC.cfg.serverUrl = 'https://example.workers.dev';
  ctx.SYNC.cfg.teamKey = 'aikotoba';
  ctx.SYNC.cfg.userName = '山田';
  ctx.syncSaveCfg();
  ctx.SYNC.cfg = { mode:'local', serverUrl:'', teamKey:'', userName:'', fileName:'', auto:true };
  ctx.syncLoadCfg();
  if(ctx.SYNC.cfg.serverUrl !== 'https://example.workers.dev') throw new Error('復元失敗');
  if(ctx.syncModeLabel() !== '共有サーバー') throw new Error(ctx.syncModeLabel());
  if(typeof ctx.syncStatusHtml() !== 'string') throw new Error('状態表示が作れない');
  VIEWS.settings.render();
  ctx.SYNC.cfg.mode = 'local'; ctx.syncSaveCfg();
});
t('保存のたびに同期が予約される（連打しても1回）', ()=>{
  ctx.SYNC.cfg.mode = 'folder';
  ctx.syncAfterSave(); ctx.syncAfterSave();
  ctx.SYNC.cfg.mode = 'local'; ctx.syncSaveCfg();
});
t('共有データの受け取りでデータが置き換わる', ()=>{
  const snapshot = JSON.parse(JSON.stringify(DB.data));
  const payload = { app:'org-ops', updatedAt:new Date().toISOString(), updatedBy:'佐藤',
                    data: Object.assign({}, snapshot, { employees:[{id:'e9', name:'共有からの社員'}] }) };
  ctx.syncApply(payload, '共有フォルダ');
  if(DB.data.employees.length !== 1 || DB.data.employees[0].name !== '共有からの社員') throw new Error('取り込めていない');
  DB.data = ctx.mergeDefaults(snapshot, ctx.emptyData());
  DB.save();
});

console.log('\n■ 画面遷移');
t('わたしの画面：自分を選ぶ前は選択の案内が出る', ()=>{
  ctx.setMyEmpId('');
  const html = ctx.VIEWS.me.render();
  if(html.indexOf('あなたが誰かを選んで') < 0 && html.indexOf('まだメンバーが登録されていません') < 0)
    throw new Error('選択の案内が出ていない');
});
t('わたしの画面：自分を選ぶと、自分の情報だけが出る', ()=>{
  const emp = DB.data.employees.filter(e=>!e.isTop)[0];
  ctx.setMyEmpId(emp.id);
  const html = ctx.VIEWS.me.render();
  if(html.indexOf(emp.name) < 0) throw new Error('自分の名前が出ていない');
  const other = DB.data.employees.filter(e=>e.id !== emp.id && !e.isTop)[0];
  if(other && html.indexOf('<b>'+other.name+'</b>') >= 0) throw new Error('他の人の情報が混ざっている');
  ctx.setMyEmpId('');
});
t('存在しない記録を指すボタンを押しても落ちない', ()=>{
  /* 共有で使っていると、他の人が消した記録のボタンが画面に残っていることがある。
     そのとき押しても、例外で止まらないこと。 */
  ctx.buildDemoData();
  const bad = [];
  Object.keys(ACTIONS).forEach(k=>{
    [{}, {id:'ありえないID'}, {w:'x', r:'y'}, {code:'ありえない等級'}].forEach(ds=>{
      try{ ACTIONS[k](ds, mkNode('button'), {preventDefault(){}}); }
      catch(e){ if(!bad.some(b=>b.startsWith(k+' '))) bad.push(k+' → '+e.message); }
    });
  });
  if(bad.length) throw new Error(bad.length+'個の操作が落ちる: '+bad.slice(0,6).join(' / '));
});
t('画面に undefined や NaN が出ない', ()=>{
  const states = [
    ['何もない', ()=>{ DB.data = ctx.emptyData(); ctx.setMyEmpId(''); }],
    ['サンプル', ()=>{ ctx.buildDemoData(); }],
    ['社員1名だけ', ()=>{ DB.data = ctx.emptyData(); DB.data.employees.push({id:'emp_x', name:'テスト太郎'}); }]
  ];
  const bad = [];
  states.forEach(([label, setup])=>{
    setup();
    Object.keys(VIEWS).forEach(k=>{
      if(!VIEWS[k] || typeof VIEWS[k].render !== 'function') return;
      let h;
      try{ h = VIEWS[k].render(); }catch(e){ bad.push(label+'/'+k+'（例外: '+e.message+'）'); return; }
      if(typeof h !== 'string'){ bad.push(label+'/'+k+'（文字列でない）'); return; }
      ['undefined','NaN','[object Object]'].forEach(w=>{
        if(h.indexOf(w) >= 0) bad.push(label+'/'+k+'（'+w+' が出ている）');
      });
    });
  });
  if(bad.length) throw new Error(bad.slice(0,6).join(' / '));
});
t('わたしの画面：選んだ人がいなくなっても落ちない', ()=>{
  ctx.buildDemoData();
  const emp = DB.data.employees[0];
  ctx.setMyEmpId(emp.id);
  DB.data.employees = DB.data.employees.filter(e=>e.id !== emp.id);
  const h = VIEWS.me.render();
  if(typeof h !== 'string' || !h.length) throw new Error('描画できない');
  if(typeof ctx.navCount('me') !== 'number') throw new Error('navCount が数値でない');
  ctx.setMyEmpId('');
});
t('消したタブを指定されても画面が空にならない', ()=>{
  ctx.buildDemoData();
  [['decisions','rule'], ['diagnosis','structure']].forEach(([v, tab])=>{
    if(VIEWS[v].setTab) VIEWS[v].setTab(tab);
    const h = VIEWS[v].render();
    if(!h || h.length < 200) throw new Error(v+' に「'+tab+'」を指定すると中身が消える');
  });
});
t('古い形式のデータでも、消したはずの項目が表に出ない', ()=>{
  const old = {
    meta:{ version:'2.0.0', updatedAt:new Date().toISOString() },
    settings:{ companyName:'旧データ社' },
    employees:[{ id:'emp_1', name:'旧 太郎', salary:'月給30万円', retentionRisk:'高い' }],
    decisions:[{ id:'dec_1', title:'旧い決定', kind:'people', emotion:2, stage:'holding' }],
    goals:[], scorecards:[], kpiWeeks:[], oneOnOnes:[], evaluations:[], grades:[],
    reports:[], incidents:[], improvementPlans:[], planChecks:{}, firstSteps:{}
  };
  store['hyokaSeido_v1'] = JSON.stringify(old);
  DB.load();
  const emp = VIEWS.employees.render();
  if(emp.indexOf('月給30万円') >= 0) throw new Error('給与が画面に出てしまう');
  const dec = VIEWS.decisions.render();
  if(/強い怒り|今すぐ決めてしまいたい/.test(dec)) throw new Error('心理状態が画面に出てしまう');
});
t('CSVの見出しとデータの列数が合っている', ()=>{
  /* 項目を消したときに見出しだけ残ると、全列が1つずれたCSVができてしまう */
  ctx.buildDemoData();
  const caught = [];
  const origCsv = ctx.downloadCsv;
  ctx.downloadCsv = function(name, rows){ caught.push({name, rows}); };
  const bad = [];
  try{
    Object.keys(ACTIONS).filter(k=>/Csv$/i.test(k)).forEach(k=>{
      caught.length = 0;
      try{ ACTIONS[k]({}, mkNode('button'), {preventDefault(){}}); }catch(e){ return; }
      caught.forEach(c=>{
        if(!c.rows || !c.rows.length) return;
        const head = c.rows[0].length;
        const ng = c.rows.slice(1).filter(r=>r.length !== head).length;
        if(ng) bad.push(k+'（見出し'+head+'列 / ずれた行'+ng+'件）');
      });
    });
  } finally { ctx.downloadCsv = origCsv; }
  if(bad.length) throw new Error(bad.join(' / '));
});
t('CSVの見出しに、消したはずの項目が残っていない', ()=>{
  ctx.buildDemoData();
  const caught = [];
  const origCsv = ctx.downloadCsv;
  ctx.downloadCsv = function(name, rows){ caught.push({name, rows}); };
  const bad = [];
  try{
    Object.keys(ACTIONS).filter(k=>/Csv$/i.test(k)).forEach(k=>{
      try{ ACTIONS[k]({}, mkNode('button'), {preventDefault(){}}); }catch(e){}
    });
    caught.forEach(c=>{
      if(!c.rows || !c.rows.length) return;
      c.rows[0].forEach(h=>{
        ['給与','年収','離職','心理状態'].forEach(g=>{
          if(String(h).indexOf(g) >= 0) bad.push(c.name+' の見出し「'+h+'」');
        });
      });
    });
  } finally { ctx.downloadCsv = origCsv; }
  if(bad.length) throw new Error(bad.join(' / '));
});
t('共有：保存すると未送信の印が立ち、送ると下りる', ()=>{
  ctx.buildDemoData();
  DB.save();
  if(!ctx.SYNC.dirty) throw new Error('保存しても未送信の印が立たない');
  ctx.syncApply({ data: JSON.parse(JSON.stringify(DB.data)), updatedAt: ctx.nowIso() }, 'テスト');
  if(ctx.SYNC.dirty) throw new Error('取り込んでも未送信の印が下りない');
});
t('共有：初回接続の処理がある（黙って上書きしない）', ()=>{
  if(typeof ctx.folderFirstSync !== 'function') throw new Error('folderFirstSync がない');
  const src = fs.readFileSync(path.join(DIR,'20-sync.js'),'utf8');
  if(!/folderFirstSync()/.test(src)) throw new Error('接続時に folderFirstSync を呼んでいない');
  if(src.indexOf("SYNC.cfg.mode = 'folder'; syncSaveCfg();") >= 0 && /return folderSync(true);/.test(src))
    throw new Error('接続時に、確認せず同期する古い処理が残っている');
});
t('他の人が入れたタグが、そのまま画面に出ない', ()=>{
  /* 共有アプリなので、誰かが名前や記録に入れたHTMLが、他の人の画面で動いてはいけない */
  const XSS = '<img src=x onerror=BAD>';
  ctx.buildDemoData();
  function plant(obj, depth){
    if(!obj || typeof obj !== 'object' || depth > 4) return;
    Object.keys(obj).forEach(k=>{
      const v = obj[k];
      if(typeof v === 'string' && v.length > 1 && k !== 'id' && !/Id$/.test(k) 
         && !/^(emp|dec|ven|dlg|par|cp|sp|row|wk|ooo|ev|rep|inc|exc|imp|chk|g)_/.test(v)){
        obj[k] = XSS + v;
      }else if(Array.isArray(v)){ v.forEach(x=>{ if(x && typeof x === 'object') plant(x, depth+1); }); }
      else if(v && typeof v === 'object'){ plant(v, depth+1); }
    });
  }
  Object.keys(DB.data).forEach(k=>{
    const v = DB.data[k];
    if(Array.isArray(v)) v.forEach(x=>plant(x,0));
    else if(v && typeof v === 'object') plant(v,0);
  });
  const leaky = [];
  Object.keys(VIEWS).forEach(k=>{
    if(!VIEWS[k] || typeof VIEWS[k].render !== 'function') return;
    let h;
    try{ h = VIEWS[k].render(); }catch(e){ return; }
    if(h.indexOf(XSS) >= 0) leaky.push(k);
  });
  if(leaky.length) throw new Error('タグがそのまま出る画面: '+leaky.join(', '));
});
t('引用符を入れても、属性が壊れない', ()=>{
  const Q = '" onmouseover=BAD "';
  ctx.buildDemoData();
  DB.data.employees[0].name = Q;
  DB.data.employees[0].dept = Q;
  if(DB.data.grades[0]) DB.data.grades[0].code = Q;
  const broken = [];
  Object.keys(VIEWS).forEach(k=>{
    if(!VIEWS[k] || typeof VIEWS[k].render !== 'function') return;
    let h;
    try{ h = VIEWS[k].render(); }catch(e){ return; }
    if(h.indexOf(Q) >= 0) broken.push(k);
  });
  if(broken.length) throw new Error('引用符が抜ける画面: '+broken.join(', '));
});
t('記号が二重にエスケープされない', ()=>{
  ctx.buildDemoData();
  const emp = DB.data.employees[0];
  emp.name = 'A&B<C>D'; emp.roleTitle = 'A&B'; emp.deliverables = 'A&B'; emp.authority = 'A&B';
  ctx.setMyEmpId(emp.id);
  const dbl = [];
  Object.keys(VIEWS).forEach(k=>{
    if(!VIEWS[k] || typeof VIEWS[k].render !== 'function') return;
    let h;
    try{ h = VIEWS[k].render(); }catch(e){ return; }
    if(h.indexOf('&amp;amp;') >= 0 || h.indexOf('&amp;lt;') >= 0) dbl.push(k);
  });
  ctx.setMyEmpId('');
  if(dbl.length) throw new Error('二重エスケープの画面: '+dbl.join(', '));
});
t('新しい構文が混ざっていない（古いブラウザ対策）', ()=>{
  /* アプリ本体は ES5 相当で書く方針。混ざると古いブラウザで画面が真っ白になる */
  const ARROW = String.fromCharCode(61, 62);
  const BACKTICK = String.fromCharCode(96);
  const bad = [];
  fs.readdirSync(DIR).filter(f=>f.endsWith('.js')).forEach(f=>{
    const src = fs.readFileSync(path.join(DIR,f),'utf8');
    if(src.indexOf(ARROW) >= 0) bad.push(f+': アロー関数');
    if(src.indexOf(BACKTICK) >= 0) bad.push(f+': テンプレートリテラル');
    if(/[^A-Za-z0-9_$]let[ 	]+[A-Za-z_$]/.test(src)) bad.push(f+': let');
    if(/[^A-Za-z0-9_$]const[ 	]+[A-Za-z_$]/.test(src)) bad.push(f+': const');
    if(/[^A-Za-z0-9_$]class[ 	]+[A-Za-z_$]/.test(src)) bad.push(f+': class');
  });
  if(bad.length) throw new Error(bad.join(' / '));
});
t('評価シートは、どの段階でも保存できる', ()=>{
  /* 段階によっては上司評価の欄が描かれない。それを読もうとして落ちないこと。
     このDOMスタブは querySelector が必ずノードを返すので、
     ここでは実際のHTMLに存在する name= だけを返すものを用意して確かめる */
  function rootFor(bodyHtml){
    const names = {};
    const re = /name="([^"]+)"/g;
    let m;
    while((m = re.exec(bodyHtml))) names[m[1]] = true;
    const saveBtn = mkNode('button');
    saveBtn._h = [];
    saveBtn.addEventListener = function(ev,fn){ if(ev==='click') saveBtn._h.push(fn); };
    saveBtn.click = function(){ saveBtn._h.forEach(f=>f({preventDefault(){}})); };
    const form = {
      querySelector(sel){
        const nm = (sel.match(/\[name="([^"]+)"\]/)||[])[1];
        if(nm && !names[nm]) return null;
        const n = mkNode('input'); n.value = '記入テスト'; return n;
      },
      querySelectorAll(sel){
        const nm = (sel.match(/\[name="([^"]+)"\]/)||[])[1];
        const a = []; a.forEach = Array.prototype.forEach;
        if(nm && names[nm]){ const n = mkNode('input'); n.checked = true; n.value = '3'; a.push(n); }
        return a;
      },
      addEventListener(){}
    };
    return { querySelector(sel){
      if(sel === '#evSave') return saveBtn;
      if(sel === '#evForm' || sel === '#mForm') return form;
      return form.querySelector(sel);
    }, _saveBtn: saveBtn };
  }
  const bad = [];
  ['self','manager','calibration','final','explained'].forEach(stage=>{
    ctx.buildDemoData();
    const ev = DB.data.evaluations[0];
    ev.stage = stage;
    ev.evidence = '前からある根拠'; ev.calibrationNote = '前からある調整メモ'; ev.finalNote = '前からある説明';
    let captured = null;
    const orig = ctx.openModal;
    ctx.openModal = function(opts){
      const root = rootFor(String(opts.body||''));
      captured = root;
      if(opts.onMount) opts.onMount(root);
      return root;
    };
    try{ ACTIONS.evalOpen({id:ev.id}, mkNode('button'), {preventDefault(){}}); }
    catch(e){ ctx.openModal = orig; bad.push(stage+'（開く時点で落ちる: '+e.message+'）'); return; }
    ctx.openModal = orig;
    if(!captured){ bad.push(stage+'（シートが開かない）'); return; }
    try{ captured._saveBtn.click(); }
    catch(e){ bad.push(stage+'（保存で落ちる: '+e.message+'）'); return; }
    const after = ctx.byId(DB.data.evaluations, ev.id);
    if(after.evidence !== '前からある根拠' && !/記入テスト/.test(after.evidence||''))
      bad.push(stage+'（根拠が空で上書きされた）');
    if(after.finalNote !== '前からある説明' && !/記入テスト/.test(after.finalNote||''))
      bad.push(stage+'（本人への説明が空で上書きされた）');
  });
  if(bad.length) throw new Error(bad.join(' / '));
});
t('目標0のKPIは、届かなければ未達になる', ()=>{
  /* クレーム0件・事故0件のような目標は、1件でも出たら未達 */
  if(ctx.kpiRowStatus({target:0, actual:8, lowerIsBetter:true}) !== 'ng')
    throw new Error('目標0件で8件発生したのに未達にならない');
  if(ctx.kpiRowStatus({target:0, actual:0, lowerIsBetter:true}) !== 'ok')
    throw new Error('目標0件で0件なら達成のはず');
  if(ctx.kpiRowStatus({target:0, actual:-5}) !== 'ng')
    throw new Error('目標0でマイナスなら未達のはず');
  if(ctx.kpiRowStatus({target:0, actual:0}) !== 'ok')
    throw new Error('目標0で0なら達成のはず');
});
t('決定を編集しても、持ち上がった日時が消えない', ()=>{
  ctx.buildDemoData();
  const rec = DB.data.decisions.filter(x=>x.raisedAt)[0];
  const before = rec.raisedAt;
  let captured = null;
  const orig = ctx.openForm;
  ctx.openForm = function(opts){ captured = opts; };
  try{ ACTIONS.decEdit({id:rec.id}, mkNode('button'), {preventDefault(){}}); }
  finally{ ctx.openForm = orig; }
  if(!captured) throw new Error('編集フォームが開かない');
  const v = captured.value || {};
  if(!v.raisedAt) throw new Error('日時がフォームに渡っていない');
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v.raisedAt))
    throw new Error('日時入力欄が読める形になっていない: '+v.raisedAt);
  captured.onSubmit(Object.assign({}, v));
  const after = ctx.byId(DB.data.decisions, rec.id);
  if(!after.raisedAt) throw new Error('保存したら日時が消えた');
  if(Math.abs(new Date(after.raisedAt) - new Date(before)) > 60000)
    throw new Error('日時がずれた: '+before+' → '+after.raisedAt);
});
t('全ナビ項目に対応する画面がある', ()=>{
  ctx.NAV.forEach(g=>g.items.forEach(it=>{
    if(!VIEWS[it.key]) throw new Error('画面が存在しない: '+it.key);
  }));
});
t('アラートの遷移先がすべて実在する', ()=>{
  ctx.buildAlerts().forEach(a=>{ if(a.view && !VIEWS[a.view]) throw new Error('遷移先なし: '+a.view); });
});
t('go アクションで画面が切り替わる', ()=>{
  viewKeys.forEach(k=>{ ACTIONS.go({view:k}); if(ctx.currentView !== k) throw new Error('切替失敗: '+k); });
});

console.log('\n■ 保存と復元');
t('保存 → 読込でデータが保持される', ()=>{
  DB.save();
  const before = DB.data.employees.length;
  DB.data = ctx.emptyData();
  DB.load();
  if(DB.data.employees.length !== before) throw new Error('復元後='+DB.data.employees.length+' 期待='+before);
});
t('古い形式のデータでも壊れない（項目欠落）', ()=>{
  store['hyokaSeido_v1'] = JSON.stringify({ meta:{version:'0.1'}, employees:[{id:'e1', name:'旧データ'}] });
  DB.load();
  if(!DB.data.settings || DB.data.settings.maxDirectReports !== 6) throw new Error('既定値が補完されていない');
  if(!Array.isArray(DB.data.grades) || DB.data.grades.length !== 5) throw new Error('等級定義が補完されていない');
  viewKeys.forEach(k=>VIEWS[k].render());
});
t('壊れたJSONでも起動する', ()=>{
  store['hyokaSeido_v1'] = '{壊れています';
  DB.load();
  if(DB.data.employees.length !== 0) throw new Error('初期化されていない');
});

console.log('\n================================');
console.log(fail ? '失敗 '+fail+' 件' : 'すべて成功');
process.exit(fail ? 1 : 0);
