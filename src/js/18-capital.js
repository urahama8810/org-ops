/* ============================================================
   18-capital.js  お金の使い道と、社外の関係者
   ------------------------------------------------------------
     ・利益が出た時点で、人材・営業・商品・仕組みへ戻す枠を先に取る
     ・新しい取り組みと、事業と関係ない支出には、年間の上限と承認を決める
     ・社外の関係者とは、狙い・権限・責任・成果物・終わり方を文書にする

   入力は四半期に一度、4つの数字を写すだけで済むようにしてある。
   1件ずつ記録したい場合は「明細で記録する」から入力できる。
   ============================================================ */

var capTab = 'capital';

function yen(n){
  n = num(n,0);
  return n.toLocaleString ? n.toLocaleString('ja-JP') : String(n);
}
function capitalRule(){
  var c = DB.data.capital || {};
  return c.rule || { reinvestRate:50, nonBizCap:0, approver:'', note:'' };
}
function spendsOf(period){
  var all = (DB.data.capital && DB.data.capital.spends) || [];
  return period ? all.filter(function(s){ return s.period===period; }) : all;
}
function capitalSummary(period){
  var list = spendsOf(period);
  var sum = { reinvest:0, venture:0, nonbiz:0, total:0, byCat:{} };
  REINVEST_CATEGORIES.forEach(function(c){ sum.byCat[c.key] = 0; });
  list.forEach(function(s){
    var a = num(s.amount,0);
    sum[s.kind] = (sum[s.kind]||0) + a;
    sum.total += a;
    if(s.kind==='reinvest' && s.category) sum.byCat[s.category] = (sum.byCat[s.category]||0) + a;
  });
  var periods = (DB.data.capital && DB.data.capital.periods) || [];
  var p = period ? periods.filter(function(x){ return x.label===period; })[0] : null;
  var profit = p ? num(p.profit,0) : periods.reduce(function(s,x){ return s+num(x.profit,0); }, 0);
  sum.profit = profit;
  sum.rate = profit>0 ? Math.round(sum.reinvest/profit*100) : null;
  sum.nonBizRate = profit>0 ? Math.round(sum.nonbiz/profit*100) : null;
  return sum;
}
function currentCapPeriod(){
  var periods = (DB.data.capital && DB.data.capital.periods) || [];
  if(!periods.length) return '';
  return sortBy(periods, function(p){ return p.label; }).slice(-1)[0].label;
}

/* 関係者台帳の整備状況 */
function partnerFill(p){
  var miss = [];
  PARTNER_FIELDS.forEach(function(f){
    if(!String(p[f.key]||'').trim()) miss.push(f.label.replace(/（.*$/,''));
  });
  if(!p.contractDone) miss.push('契約・合意の文書');
  return { done:PARTNER_FIELDS.length+1-miss.length, total:PARTNER_FIELDS.length+1,
           rate:Math.round((PARTNER_FIELDS.length+1-miss.length)/(PARTNER_FIELDS.length+1)*100),
           missing:miss };
}
function governanceRate(){
  var list = DB.data.partners;
  if(!list.length) return null;
  return Math.round(list.reduce(function(s,p){ return s+partnerFill(p).rate; },0)/list.length);
}

/* ---------- 画面 ---------- */
VIEWS.capital = {
  title:'お金の使い道',
  desc:'利益を組織能力へ戻す仕組みと、関係者との期待値・出口の設計です。',
  render:function(){
    var h = '';
    h += '<div class="tabs">'+
      '<button type="button" class="tab '+(capTab==='capital'?'active':'')+'" data-act="capTab" data-t="capital">資本配分・再投資</button>'+
      '<button type="button" class="tab '+(capTab==='partner'?'active':'')+'" data-act="capTab" data-t="partner">関係者台帳 ('+DB.data.partners.length+')</button>'+
      '</div>';
    h += capTab==='capital' ? renderCapital() : renderPartners();
    return h;
  }
};
VIEWS.capital.setTab = function(t){ capTab = t; };   /* 他画面からタブを指定して開くため */

function renderCapital(){
  var rule = capitalRule();
  var period = currentCapPeriod();
  var sum = capitalSummary(period);
  var h = '';

  h += '<div class="notice">'+
    '<b>利益を人材・営業・商品・仕組みへ戻すと、組織の力が上がり、それが次の利益をつくります。</b>'+
    '利益を本業の外へ回すと、帳簿では黒字でも、この積み上がりが止まります。'+
    'だから「余ったら投資する」ではなく、<b>先に戻す枠を取って、残りの使い道を決めます</b>。'+
    '<br>入力は四半期に一度で十分です。会計ソフトの数字を4つ写すだけにしてあります。'+
    '</div>';

  h += '<div class="grid c4" style="margin-bottom:16px;">'+
    tile('対象の期', period||'<small>未登録</small>',
         period ? '利益 '+yen(sum.profit)+'円'
                : '<div class="foot">'+btn('この期の数字を入れる','capQuick',{},'primary','plus')+'</div>',
         'accent','calendar')+
    tile('本業へ戻した割合', sum.rate===null?'—':sum.rate+'<small>%</small>',
         '目標 '+num(rule.reinvestRate,50)+'% ／ '+yen(sum.reinvest)+'円',
         sum.rate===null?'':(sum.rate>=num(rule.reinvestRate,50)?'ok':'bad'),'wallet')+
    tile('新しい取り組みへ', yen(sum.venture)+'<small>円</small>', '企画書と撤退条件が前提', sum.venture?'warn':'','sparkle')+
    tile('事業と関係ない支出', yen(sum.nonbiz)+'<small>円</small>',
         num(rule.nonBizCap,0)>0 ? '年間の上限 '+yen(rule.nonBizCap)+'円' : '年間の上限が未設定',
         (num(rule.nonBizCap,0)>0 && sum.nonbiz>num(rule.nonBizCap,0))?'bad':(sum.nonbiz?'warn':'ok'))+
    '</div>';

  /* 再投資の内訳 */
  var inner = '<table class="tbl"><tbody>';
  REINVEST_CATEGORIES.forEach(function(c){
    var v = sum.byCat[c.key]||0;
    var p = sum.reinvest>0 ? Math.round(v/sum.reinvest*100) : 0;
    inner += '<tr><td style="width:200px;"><b>'+esc(c.label)+'</b><div class="small muted">'+esc(c.hint)+'</div></td>'+
      '<td>'+progressBar(p, p>0?'ok':'')+'</td>'+
      '<td class="num mono" style="width:130px;">'+yen(v)+' 円</td></tr>';
  });
  inner += '</tbody></table>';
  h += card('再投資の内訳', inner, { tight:true, sub:period||'全期間' });

  /* ルール */
  h += card('再投資ルール（先取り）',
    '<div class="form-grid">'+
    fieldHtml({key:'reinvestRate', label:'利益に対する再投資率（％）', type:'number', min:0, max:100,
               hint:'利益が出た時点で、この割合を人材・営業・商品・仕組みへ先に確保します。'}, rule.reinvestRate)+
    fieldHtml({key:'nonBizCap', label:'事業と関係ない支出の年間上限（円）', type:'number', min:0,
               hint:'0のままだと上限なしになります。先に決めておくと、その都度の判断が要らなくなります。'}, rule.nonBizCap)+
    fieldHtml({key:'approver', label:'非事業支出・新規案件の承認者',
               hint:'決める人が1人だけにならないようにすると、見落としが減ります。'}, rule.approver)+
    fieldHtml({key:'note', label:'補足', type:'textarea', rows:2, full:true}, rule.note)+
    '</div>'+
    '<div class="btn-row"><button class="btn primary" data-act="capRuleSave">ルールを保存</button></div>',
    {sub:'構造分析レポート 第11章 第4層'});

  /* 期と利益 */
  var periods = sortBy(((DB.data.capital||{}).periods)||[], function(p){ return p.label; }).reverse();
  h += card('期ごとの利益', tableHtml([
    { label:'期', key:'label', width:'120px' },
    { label:'利益（円）', cls:'num', render:function(r){ return yen(r.profit); } },
    { label:'再投資（円）', cls:'num', render:function(r){ return yen(capitalSummary(r.label).reinvest); } },
    { label:'再投資率', width:'150px', render:function(r){
        var s = capitalSummary(r.label);
        if(s.rate===null) return '<span class="small muted">—</span>';
        return progressBar(s.rate, s.rate>=num(rule.reinvestRate,50)?'ok':'bad')+'<span class="small mono">'+s.rate+'%</span>'; } },
    { label:'メモ', render:function(r){ return '<span class="small">'+esc(r.note||'')+'</span>'; } },
    { label:'', cls:'actions', width:'120px', render:function(r){
        return btn('編集','capPeriodEdit',{id:r.id})+' '+btn('削除','capPeriodDel',{id:r.id},'danger'); } }
  ], periods, { emptyTitle:'期の登録がありません', emptyText:'四半期または年度の利益を登録すると、再投資率が計算できます。' }),
  { tools: btn('期を追加','capPeriodNew',{},'primary') });

  /* 支出 */
  var spends = sortBy(spendsOf(''), function(s){ return s.date; }).reverse();
  h += card('支出の記録', tableHtml([
    { label:'日付', key:'date', width:'100px' },
    { label:'期', key:'period', width:'90px' },
    { label:'内容', render:function(r){
        return '<b>'+esc(r.title)+'</b>'+(r.note?'<div class="small muted">'+esc(r.note)+'</div>':''); } },
    { label:'区分', width:'150px', render:function(r){
        var k = SPEND_KINDS.filter(function(x){return x.key===r.kind;})[0];
        var cat = r.kind==='reinvest' && r.category ?
          (REINVEST_CATEGORIES.filter(function(c){return c.key===r.category;})[0]||{}).label : '';
        return badge(k?k.label:r.kind, k?k.cls:'neutral')+(cat?'<div class="small muted">'+esc(cat)+'</div>':''); } },
    { label:'金額（円）', cls:'num', width:'120px', render:function(r){ return yen(r.amount); } },
    { label:'承認', width:'110px', render:function(r){
        return r.approvedBy ? esc(r.approvedBy) : (r.kind==='reinvest'?'<span class="small muted">—</span>':badge('承認なし','warn')); } },
    { label:'', cls:'actions', width:'120px', render:function(r){
        return btn('編集','capSpendEdit',{id:r.id})+' '+btn('削除','capSpendDel',{id:r.id},'danger'); } }
  ], spends, { emptyTitle:'まだ記録がありません',
    emptyText:'四半期に一度、4つの数字を入れるだけで十分です。1件ずつ記録したい場合は「明細で記録する」から入力できます。',
    emptyIcon:'wallet',
    emptyAction: btn('この期の数字を入れる','capQuick',{},'primary','plus') }),
  { icon:'wallet',
    sub:'四半期に一度、数字を入れるだけで大丈夫です',
    tools: btn('この期の数字を入れる','capQuick',{},'primary','plus')+' '+
           btn('明細で記録する','capSpendNew',{},'','edit')+' '+
           btn('CSV','capCsv',{},'','download') });

  return h;
}

function renderPartners(){
  var h = '';
  var gr = governanceRate();
  h += '<div class="notice">'+
    '<b>相手を信じることと、取り決めを作らないことは、別のことです。</b>'+
    '長く続く関係では、信頼したうえで、相手が何を得たいのかを理解し、期待していることを言葉にし、'+
    '文書に残し、定期的に確認し、うまくいかなかったときの終わり方まで決めてあります。'+
    '<b>「信頼できる相手だから取り決めは要らない」ではなく、「信頼を長く保つために取り決めを残す」</b>と考えてください。'+
    '</div>';

  var today = todayStr();
  var due = DB.data.partners.filter(function(p){ return p.nextCheck && p.nextCheck <= today; });
  h += '<div class="grid c4" style="margin-bottom:16px;">'+
    tile('登録数', DB.data.partners.length+'<small>件</small>','','accent')+
    tile('文書化の完成度', gr===null?'—':gr+'<small>%</small>','利害・権限・責任・IP・撤退条件', gr===null?'':(gr>=80?'ok':gr>=50?'warn':'bad'))+
    tile('契約・合意が未文書', DB.data.partners.filter(function(p){return !p.contractDone;}).length+'<small>件</small>',
         '口頭合意のままの相手', DB.data.partners.filter(function(p){return !p.contractDone;}).length?'bad':'ok')+
    tile('定期確認が期限', due.length+'<small>件</small>','見直し日が来ています', due.length?'warn':'ok')+
    '</div>';

  h += card('関係者台帳', tableHtml([
    { label:'相手', render:function(r){
        return '<b>'+esc(r.name)+'</b><div class="small muted">'+esc(r.kind||'')+(r.contact?'／'+esc(r.contact):'')+'</div>'; } },
    { label:'文書化', width:'150px', render:function(r){
        var f = partnerFill(r);
        return progressBar(f.rate, f.rate>=80?'ok':f.rate>=50?'warn':'bad')+'<span class="small mono">'+f.done+'/'+f.total+'</span>'+
          (f.missing.length?'<div class="small muted">未：'+esc(f.missing.slice(0,2).join('、'))+'</div>':''); } },
    { label:'相手の利害', render:function(r){
        return String(r.interest||'').trim() ? '<span class="small">'+esc(r.interest)+'</span>' : badge('未記入','bad'); } },
    { label:'撤退条件', render:function(r){
        return String(r.exitCond||'').trim() ? '<span class="small">'+esc(r.exitCond)+'</span>' : badge('未設定','bad'); } },
    { label:'次回確認', width:'110px', render:function(r){
        if(!r.nextCheck) return badge('未設定','warn');
        var left = daysBetween(todayStr(), r.nextCheck);
        return esc(r.nextCheck)+'<div class="small '+(left<0?'':'muted')+'">'+(left<0?(-left)+'日超過':left+'日後')+'</div>'; } },
    { label:'', cls:'actions', width:'170px', render:function(r){
        return btn('開く','parEdit',{id:r.id})+' '+btn('確認した','parCheck',{id:r.id},'primary')+' '+btn('削除','parDel',{id:r.id},'danger'); } }
  ], sortBy(DB.data.partners, function(p){ return p.nextCheck||'9999'; }), {
    emptyTitle:'関係者が登録されていません',
    emptyText:'スポンサー・共同事業者・役員・外注先など、会社の外にいて利害を持つ相手を登録します。'
  }), { tools: btn('関係者を追加','parNew',{},'primary')+' '+btn('CSV','parCsv',{}) });

  return h;
}

/* ---------- 操作 ---------- */
action('capTab', function(ds){ capTab = ds.t; render(); });

action('capRuleSave', function(){
  var view = document.getElementById('view');
  var r = capitalRule();
  ['reinvestRate','nonBizCap','approver','note'].forEach(function(k){
    var el = view.querySelector('[name="f_'+k+'"]');
    if(!el) return;
    r[k] = (k==='reinvestRate'||k==='nonBizCap') ? num(el.value) : el.value;
  });
  DB.data.capital.rule = r;
  DB.save(); render(); toast('再投資ルールを保存しました','ok');
});

/* 四半期に一度、4つの数字を写すだけの入力。
   入れた数字は「まとめ」1件として記録に残す（明細と混ざらないように印を付ける）。 */
action('capQuick', function(){
  var period = currentCapPeriod() || quarterOf(todayStr());
  var sum = capitalSummary(period);
  openForm({
    title:'この期の数字を入れる', wide:true,
    intro:'<b>会計ソフトから、4つの数字を写すだけです。</b>'+
          '1件ずつ記録する必要はありません。四半期に一度、ここを更新してください。',
    fields:[
      { key:'label',    label:'期', required:true, placeholder:'例：2026-Q3',
        hint:'四半期でも年度でも構いません。' },
      { key:'profit',   label:'この期の利益（円）', type:'number', required:true,
        hint:'税引前の利益でかまいません。おおよその数字で十分です。' },
      { key:'reinvest', label:'人材・営業・商品・仕組みへ使った額（円）', type:'number',
        hint:'研修、採用、広告、開発、業務システムなど。本業の力を上げるために使った合計。' },
      { key:'venture',  label:'新しい取り組みへ使った額（円）', type:'number',
        hint:'まだ本業になっていない、新規の事業や案件に使った合計。' },
      { key:'nonbiz',   label:'事業と関係ない支出（円）', type:'number',
        hint:'社用車、会員権など。ここを正直に分けることが、この画面のいちばんの価値です。' }
    ],
    value:{ label:period, profit:sum.profit||'', reinvest:sum.reinvest||'',
            venture:sum.venture||'', nonbiz:sum.nonbiz||'' },
    submitLabel:'保存する',
    onSubmit:function(v){
      var c = DB.data.capital;
      /* 期（利益） */
      var p = c.periods.filter(function(x){ return x.label === v.label; })[0];
      if(p) p.profit = v.profit;
      else c.periods.push({ id:uid('cp'), label:v.label, profit:v.profit, note:'' });
      /* まとめの3行を作り直す（明細で入れたものは残す） */
      c.spends = c.spends.filter(function(x){ return !(x.rollup && x.period === v.label); });
      [['reinvest','人材・営業・商品・仕組みへ'],
       ['venture','新しい取り組みへ'],
       ['nonbiz','事業と関係ない支出']].forEach(function(pair){
        var amt = num(v[pair[0]], 0);
        if(!amt) return;
        c.spends.push({ id:uid('sp'), rollup:true, date:todayStr(), period:v.label,
                        title:pair[1]+'（'+v.label+' まとめ）', kind:pair[0], amount:amt, note:'' });
      });
      DB.save(); render(); toast('保存しました','ok');
    }
  });
});

action('capPeriodNew', function(){
  openForm({
    title:'期を追加する',
    fields:[
      { key:'label', label:'期', required:true, placeholder:'例：2026-Q3', hint:'四半期でも年度でも構いません。' },
      { key:'profit', label:'利益（円）', type:'number', required:true },
      { key:'note', label:'メモ', type:'textarea', rows:2, full:true }
    ],
    value:{ label:quarterOf(todayStr()) },
    onSubmit:function(v){
      v.id = uid('cp');
      DB.data.capital.periods.push(v); DB.save(); render(); toast('登録しました','ok');
    }
  });
});
action('capPeriodEdit', function(ds){
  var rec = byId(DB.data.capital.periods, ds.id); if(!rec) return;
  openForm({
    title:'期の編集',
    fields:[
      { key:'label', label:'期', required:true },
      { key:'profit', label:'利益（円）', type:'number', required:true },
      { key:'note', label:'メモ', type:'textarea', rows:2, full:true }
    ],
    value:rec,
    onSubmit:function(v){ for(var k in v) rec[k]=v[k]; DB.save(); render(); toast('保存しました','ok'); }
  });
});
action('capPeriodDel', function(ds){
  confirmDialog('削除','この期の記録を削除します。よろしいですか？', function(){
    DB.data.capital.periods = DB.data.capital.periods.filter(function(x){ return x.id!==ds.id; });
    DB.save(); render(); toast('削除しました','ok');
  }, '削除する');
});

var SPEND_FORM = function(){
  return [
    { key:'date', label:'日付', type:'date', required:true },
    { key:'period', label:'期', type:'select',
      options:[{value:'',label:'（未指定）'}].concat(
        (((DB.data.capital||{}).periods)||[]).map(function(p){ return {value:p.label,label:p.label}; })) },
    { key:'title', label:'内容', required:true, full:true },
    { key:'kind', label:'区分', type:'select', required:true,
      options:SPEND_KINDS.map(function(k){ return {value:k.key,label:k.label}; }),
      hint:'「事業と関係ない支出」を正直に分けることが、この表のいちばんの価値です。' },
    { key:'category', label:'再投資の内訳', type:'select',
      options:[{value:'',label:'（再投資の場合のみ選択）'}].concat(
        REINVEST_CATEGORIES.map(function(c){ return {value:c.key,label:c.label}; })) },
    { key:'amount', label:'金額（円）', type:'number', required:true },
    { key:'approvedBy', label:'承認者', hint:'新規案件・非事業支出は、承認者を必ず記録します。' },
    { key:'note', label:'メモ', type:'textarea', rows:2, full:true }
  ];
};
action('capSpendNew', function(){
  openForm({
    title:'支出を1件ずつ記録する', wide:true,
    fields:SPEND_FORM(),
    value:{ date:todayStr(), period:currentCapPeriod(), kind:'reinvest' },
    onSubmit:function(v){
      v.id = uid('sp');
      DB.data.capital.spends.push(v); DB.save(); render(); toast('記録しました','ok');
    }
  });
});
action('capSpendEdit', function(ds){
  var rec = byId(DB.data.capital.spends, ds.id); if(!rec) return;
  openForm({ title:'支出の編集', wide:true, fields:SPEND_FORM(), value:rec,
    onSubmit:function(v){ for(var k in v) rec[k]=v[k]; DB.save(); render(); toast('保存しました','ok'); } });
});
action('capSpendDel', function(ds){
  confirmDialog('削除','この支出の記録を削除します。よろしいですか？', function(){
    DB.data.capital.spends = DB.data.capital.spends.filter(function(x){ return x.id!==ds.id; });
    DB.save(); render(); toast('削除しました','ok');
  }, '削除する');
});

action('capCsv', function(){
  var rows = [['日付','期','内容','区分','再投資の内訳','金額','承認者','メモ']];
  sortBy(spendsOf(''), function(s){return s.date;}).forEach(function(s){
    var k = SPEND_KINDS.filter(function(x){return x.key===s.kind;})[0];
    var c = REINVEST_CATEGORIES.filter(function(x){return x.key===s.category;})[0];
    rows.push([s.date, s.period, s.title, k?k.label:s.kind, c?c.label:'', s.amount, s.approvedBy, s.note]);
  });
  downloadCsv('資本配分_'+todayStr()+'.csv', rows);
  toast('CSVを書き出しました','ok');
});

/* ---------- 関係者台帳 ---------- */
var PARTNER_FORM = function(){
  var f = [
    { key:'name', label:'相手の名称・氏名', required:true },
    { key:'kind', label:'区分', type:'select', options:PARTNER_KINDS },
    { key:'contact', label:'窓口・担当者' },
    { key:'startDate', label:'関係の開始日', type:'date' }
  ];
  PARTNER_FIELDS.forEach(function(x){
    f.push({ key:x.key, label:x.label, hint:x.hint, type:'textarea', rows:2, full:true });
  });
  f.push({ key:'contractDone', type:'checkbox', label:'契約・合意の文書', full:true,
           checkLabel:'契約書または合意メモが文書として残っている' });
  f.push({ key:'contractPlace', label:'契約書の保管場所' });
  f.push({ key:'nextCheck', label:'次回の定期確認日', type:'date' });
  f.push({ key:'note', label:'メモ', type:'textarea', rows:2, full:true });
  return f;
};

action('parNew', function(){
  openForm({
    title:'関係者を追加する', wide:true,
    intro:'<b>相手が何を得たいのかを書けない相手とは、どこかで期待のずれが出ます。</b>'+
          '想定と違ったときに慌てないよう、始める前に、お互いの狙いと終わり方を言葉にしておきます。',
    fields:PARTNER_FORM(),
    value:{ kind:'スポンサー', startDate:todayStr(), checkCycle:'3か月に1回' },
    onSubmit:function(v){
      v.id = uid('par'); v.createdAt = nowIso();
      DB.data.partners.push(v); DB.save(); render(); toast('登録しました','ok');
    }
  });
});
action('parEdit', function(ds){
  var rec = byId(DB.data.partners, ds.id); if(!rec) return;
  openForm({ title:'関係者', wide:true, fields:PARTNER_FORM(), value:rec,
    onSubmit:function(v){ for(var k in v) rec[k]=v[k]; DB.save(); render(); toast('保存しました','ok'); } });
});
action('parCheck', function(ds){
  var rec = byId(DB.data.partners, ds.id); if(!rec) return;
  openForm({
    title:'定期確認の記録',
    intro:'<b>期待していることのズレは、早い段階なら話し合いで直せます。</b>そのままにすると、感情の行き違いに変わっていきます。',
    fields:[
      { key:'note', label:'確認した内容・出てきたズレ', type:'textarea', rows:3, full:true, required:true },
      { key:'nextCheck', label:'次回の確認日', type:'date', required:true }
    ],
    value:{ nextCheck:'' },
    onSubmit:function(v){
      rec.lastCheck = todayStr();
      rec.nextCheck = v.nextCheck;
      rec.history = rec.history || [];
      rec.history.push({ date:todayStr(), note:v.note });
      rec.note = (rec.note?rec.note+'\n':'')+todayStr()+'：'+v.note;
      DB.save(); render(); toast('記録しました','ok');
    }
  });
});
action('parCsv', function(){
  var rows = [['相手','区分','窓口','開始日','相手の利害','権限','責任と成果物','知的財産','金銭条件',
               '撤退・解除の条件','確認の頻度','契約の文書化','保管場所','前回確認','次回確認','メモ']];
  sortBy(DB.data.partners, function(p){ return p.name; }).forEach(function(p){
    rows.push([p.name, p.kind, p.contact, p.startDate, p.interest, p.authority, p.duty, p.ip, p.money,
      p.exitCond, p.checkCycle, p.contractDone?'あり':'なし', p.contractPlace, p.lastCheck, p.nextCheck, p.note]);
  });
  downloadCsv('関係者台帳_'+todayStr()+'.csv', rows);
  toast('CSVを書き出しました','ok');
});

action('parDel', function(ds){
  confirmDialog('削除','この関係者の記録を削除します。よろしいですか？', function(){
    DB.data.partners = DB.data.partners.filter(function(x){ return x.id!==ds.id; });
    DB.save(); render(); toast('削除しました','ok');
  }, '削除する');
});
