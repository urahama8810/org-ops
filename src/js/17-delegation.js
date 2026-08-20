/* ============================================================
   17-delegation.js  委任カード（任せ方の6項目）
   ------------------------------------------------------------
   構造分析レポート 第11章 第2層／第6章
     「任せっぱなし」と「細部への介入」の中間にある、継続的なマネジメント。
     任せるときに6項目を決め、中間確認日を必ず入れる。
   ============================================================ */

function delegationFill(dl){
  var miss = [];
  DELEGATION_FIELDS.forEach(function(f){
    if(!String(dl[f.key]||'').trim()) miss.push(f.label.replace(/^[①-⑥]\s*/,''));
  });
  return { done:DELEGATION_FIELDS.length-miss.length, total:DELEGATION_FIELDS.length,
           rate:Math.round((DELEGATION_FIELDS.length-miss.length)/DELEGATION_FIELDS.length*100),
           missing:miss };
}

/* 次の中間確認日（未実施のうち最も早いもの） */
function nextCheckDate(dl){
  var list = (dl.checks||[]).filter(function(c){ return !c.doneAt; });
  if(list.length) return sortBy(list, function(c){ return c.date; })[0].date;
  return dl.checkAt || '';
}

function delegationState(dl){
  if(dl.state && dl.state!=='open'){
    var s = DELEGATION_STATES.filter(function(x){ return x.key===dl.state; })[0];
    return { key:dl.state, label:s?s.label:dl.state, cls:s?s.cls:'neutral' };
  }
  var today = todayStr();
  var nc = nextCheckDate(dl);
  if(dl.due && dl.due < today) return { key:'overdue', label:'期限超過', cls:'bad' };
  if(nc && nc < today)         return { key:'checkLate', label:'中間確認が遅れ', cls:'bad' };
  if(nc && nc === today)       return { key:'checkToday', label:'今日が中間確認日', cls:'warn' };
  if(!nc)                      return { key:'noCheck', label:'中間確認日が未設定', cls:'bad' };
  return { key:'open', label:'進行中', cls:'accent' };
}

function delegationStats(){
  var list = DB.data.delegations;
  var open = list.filter(function(x){ return !x.state || x.state==='open'; });
  var checksAll = 0, checksDone = 0;
  list.forEach(function(dl){
    (dl.checks||[]).forEach(function(c){
      if(c.date <= todayStr()){ checksAll++; if(c.doneAt) checksDone++; }
    });
  });
  var full = list.filter(function(x){ return delegationFill(x).rate===100; }).length;
  var retry = list.filter(function(x){ return num(x.retryCount,0) > 0; }).length;
  return {
    total:list.length, open:open.length,
    fullRate: list.length ? Math.round(full/list.length*100) : null,
    checkRate: checksAll ? Math.round(checksDone/checksAll*100) : null,
    late: open.filter(function(x){ var s=delegationState(x); return s.cls==='bad'; }).length,
    retry:retry,
    feedback: list.filter(function(x){ return String(x.feedback||'').trim(); }).length
  };
}

/* ---------- 画面 ---------- */
VIEWS.delegation = {
  title:'委任カード（任せ方）',
  desc:'任せるときに決める6項目と、中間確認の記録です。',
  render:function(){
    var d = DB.data, st = delegationStats(), h = '';

    h += '<div class="notice">'+
      '<b>「できないことをやらせる」こと自体は、育成になり得ます。</b>'+
      'しかし事前説明・成功条件・権限・練習・中間確認・具体的なフィードバックがない状態では、'+
      'それは育成ではなく<b>能力テスト</b>になります。任せるときは、次の6項目をこのカードに書いてから渡してください。'+
      '</div>';

    h += '<div class="grid c4" style="margin-bottom:16px;">'+
      tile('進行中の委任', st.open+'<small>件</small>', '全'+st.total+'件', 'accent')+
      tile('6項目の記入率', st.fullRate===null?'—':st.fullRate+'<small>%</small>',
           '空欄のまま渡すと「任せっぱなし」になります', st.fullRate===null?'':(st.fullRate>=80?'ok':'bad'))+
      tile('中間確認の実施率', st.checkRate===null?'—':st.checkRate+'<small>%</small>',
           '育成が動いているかの先行指標', st.checkRate===null?'':(st.checkRate>=80?'ok':st.checkRate>=50?'warn':'bad'))+
      tile('対応が必要', st.late+'<small>件</small>', '中間確認の遅れ・期限超過・確認日未設定', st.late?'bad':'ok')+
      '</div>';

    var rows = sortBy(d.delegations, function(x){
      var s = delegationState(x);
      return (s.cls==='bad'?'0':s.cls==='warn'?'1':s.key==='open'?'2':'3') + (nextCheckDate(x)||'9999');
    });

    var body = tableHtml([
      { label:'任せた仕事', render:function(r){
          return '<b>'+esc(r.title)+'</b>'+
            '<div class="small muted">'+esc(r.employeeId?empName(r.employeeId):'担当者未設定')+
            (r.due?'／期限 '+esc(r.due):'')+'</div>'; } },
      { label:'6項目', width:'140px', render:function(r){
          var f = delegationFill(r);
          return progressBar(f.rate, f.rate===100?'ok':f.rate>=60?'warn':'bad')+
                 '<span class="small mono">'+f.done+'/6</span>'+
                 (f.missing.length?'<div class="small muted">未：'+esc(f.missing.slice(0,2).join('、'))+'</div>':''); } },
      { label:'次の中間確認', width:'130px', render:function(r){
          var nc = nextCheckDate(r);
          if(!nc) return badge('未設定','bad');
          var left = daysBetween(todayStr(), nc);
          return esc(nc)+'<div class="small '+(left<0?'':'muted')+'" '+(left<0?'style="color:#c8352b;font-weight:600;"':'')+'>'+
                 (left<0?(-left)+'日超過':left===0?'今日':'あと'+left+'日')+'</div>'; } },
      { label:'確認回数', cls:'num', width:'80px', render:function(r){
          var cs = r.checks||[];
          return cs.filter(function(c){return c.doneAt;}).length+' / '+cs.length; } },
      { label:'状態', width:'120px', render:function(r){
          var s = delegationState(r); return badge(s.label, s.cls); } },
      { label:'', cls:'actions', width:'210px', render:function(r){
          var b = btn('開く','dlgEdit',{id:r.id});
          if(!r.state || r.state==='open'){
            b += ' '+btn('中間確認','dlgCheck',{id:r.id},'primary');
            b += ' '+btn('終了','dlgClose',{id:r.id});
          }
          return b+' '+btn('削除','dlgDel',{id:r.id},'danger'); } }
    ], rows, {
      emptyTitle:'委任カードがありません',
      emptyText:'次に誰かへ仕事を任せるとき、その場でこのカードを1枚作ってください。'
    });

    h += card('委任カード一覧', body, {
      sub:'任せた後に問題が起きたときは、本人だけでなく「任せ方の設計」も検証します',
      tools: btn('仕事を任せる（カードを作る）','dlgNew',{},'primary')+' '+btn('CSV','dlgCsv',{})
    });

    /* 6項目の説明 */
    h += card('任せるときに決める6項目',
      '<div class="grid c2">'+
      DELEGATION_FIELDS.map(function(f){
        return '<div class="field"><label>'+esc(f.label)+'</label>'+
               '<div class="small muted">'+esc(f.hint||'')+'</div></div>';
      }).join('')+'</div>'+
      '<div class="help-block" style="margin-top:6px;">'+esc(MGMT_DEFINITION)+'</div>',
      {sub:'構造分析レポート 第11章 第2層'});

    /* マネジメントと支配の違い */
    h += card('避けている「管理」と、求めている「管理」は別物です',
      '<table class="tbl"><thead><tr>'+
      '<th style="width:50%;">避けている管理：マネジメント</th><th>求めている管理：支配・統制</th>'+
      '</tr></thead><tbody>'+
      MGMT_VS_CONTROL.map(function(r){
        return '<tr><td><b>'+esc(r.mgmt)+'</b></td><td class="muted">'+esc(r.ctrl)+'</td></tr>'; }).join('')+
      '</tbody></table>'+
      '<div class="help-block" style="margin-top:12px;">'+
      '<b>いまの振り子：</b>平時は放置 → 中間確認がないので問題が見えない → 納期や結果の段階で大きな問題として発覚 → '+
      '激昂・過剰指示 → 現場が萎縮して質問と報告が減る → 疲弊して再び放置へ戻る。'+
      '<br>必要なのは、放任でも支配でもなく、<b>その中間にある継続的なマネジメント</b>です。</div>',
      {sub:'構造分析レポート 第6章'});

    return h;
  }
};

/* ---------- 操作 ---------- */
var DELEGATION_FORM = function(){
  var f = [
    { key:'title', label:'任せる仕事', required:true, full:true, placeholder:'例：新規顧客向け提案書の作成と提出' },
    { key:'employeeId', label:'任せる相手', type:'select', options:empOptions(true), required:true },
    { key:'startDate', label:'渡した日', type:'date' }
  ];
  DELEGATION_FIELDS.forEach(function(x){
    var t = (x.key==='due'||x.key==='checkAt') ? 'date' : 'textarea';
    f.push({ key:x.key, label:x.label, hint:x.hint, type:t, rows:2,
             full:(t==='textarea'), required:(x.key==='outcome'||x.key==='due'||x.key==='checkAt') });
  });
  return f;
};

action('dlgNew', function(ds){
  var v = { startDate:todayStr() };
  if(ds && ds.emp) v.employeeId = ds.emp;
  openForm({
    title:'委任カードを作る', wide:true,
    intro:'<b>この6項目を空欄のまま渡すと、失敗の確率が上がります。</b>'+
          '特に⑤中間確認日が「任せっぱなし」と「継続的なマネジメント」の分かれ目です。',
    fields:DELEGATION_FORM(), value:v,
    onSubmit:function(v2){
      v2.id = uid('dlg'); v2.createdAt = nowIso(); v2.state = 'open'; v2.checks = [];
      if(v2.checkAt) v2.checks.push({ id:uid('chk'), date:v2.checkAt, doneAt:'', note:'' });
      DB.data.delegations.push(v2); DB.save(); render();
      toast('委任カードを作りました','ok');
    }
  });
});

action('dlgEdit', function(ds){
  var rec = byId(DB.data.delegations, ds.id); if(!rec) return;
  var checks = (rec.checks||[]);
  var hist = checks.length ?
    '<table class="tbl"><thead><tr><th>予定日</th><th>実施</th><th>確認内容・具体的なフィードバック</th></tr></thead><tbody>'+
    sortBy(checks, function(c){return c.date;}).map(function(c){
      return '<tr><td>'+esc(c.date)+'</td><td>'+(c.doneAt?badge('実施 '+fmtJp(c.doneAt),'ok'):badge('未実施','bad'))+'</td>'+
             '<td class="small">'+nl2br(c.note||'')+'</td></tr>'; }).join('')+'</tbody></table>'
    : '<div class="small muted">中間確認の記録はまだありません。</div>';

  openForm({
    title:'委任カード', wide:true,
    intro:'<div class="help-block"><b>中間確認の記録</b>'+hist+'</div>',
    fields:DELEGATION_FORM().concat([
      { type:'heading', label:'結果と、任せ方の検証' },
      { key:'feedback', label:'渡した具体的なフィードバック', type:'textarea', rows:2, full:true,
        hint:'人格や姿勢ではなく、行動と結果に対して書く。' },
      { key:'retryCount', label:'再挑戦させた回数', type:'number', min:0,
        hint:'1回の失敗で取り上げると、学習が止まります。' },
      { key:'designNote', label:'任せ方の設計に問題はなかったか', type:'textarea', rows:2, full:true,
        hint:'成果の定義・裁量・情報・練習・期限のどれが足りなかったかを書く。' }
    ]),
    value:rec, submitLabel:'保存',
    onSubmit:function(v){
      var oldCheck = rec.checkAt;
      for(var k in v) rec[k] = v[k];
      /* 中間確認日を変えたら、未実施の予定に反映する */
      if(rec.checkAt && rec.checkAt !== oldCheck){
        rec.checks = rec.checks || [];
        var open = rec.checks.filter(function(c){ return !c.doneAt; });
        if(open.length) open[0].date = rec.checkAt;
        else rec.checks.push({ id:uid('chk'), date:rec.checkAt, doneAt:'', note:'' });
      }
      DB.save(); render(); toast('保存しました','ok');
    }
  });
});

action('dlgCheck', function(ds){
  var rec = byId(DB.data.delegations, ds.id); if(!rec) return;
  openForm({
    title:'中間確認の記録', wide:true,
    intro:'<b>ここで聞くのは「進んでいますか」ではありません。</b>'+
          '成果物の現物を見て、詰まっている点と、次の一歩を一緒に決めます。'+
          '問題を小さいうちに見つけることが、この確認の目的です。',
    fields:[
      { key:'note', label:'確認した内容・気づいたこと', type:'textarea', rows:3, full:true, required:true },
      { key:'feedback', label:'本人に渡したフィードバック（行動と結果で）', type:'textarea', rows:3, full:true },
      { key:'blocker', label:'詰まっていること・こちらが外すべき障害', type:'textarea', rows:2, full:true },
      { key:'nextDate', label:'次の中間確認日', type:'date',
        hint:'まだ終わっていなければ、必ず次の日付を入れます。' }
    ],
    value:{ nextDate:'' },
    onSubmit:function(v){
      rec.checks = rec.checks || [];
      var open = rec.checks.filter(function(c){ return !c.doneAt; });
      var target = open.length ? open[0] : null;
      if(!target){ target = { id:uid('chk'), date:todayStr(), doneAt:'', note:'' }; rec.checks.push(target); }
      target.doneAt = nowIso();
      target.note = v.note + (v.blocker ? '\n【障害】'+v.blocker : '');
      if(v.feedback){ rec.feedback = (rec.feedback?rec.feedback+'\n':'') + fmtJp(nowIso())+'：'+v.feedback; }
      if(v.nextDate){
        rec.checks.push({ id:uid('chk'), date:v.nextDate, doneAt:'', note:'' });
        rec.checkAt = v.nextDate;
      }
      DB.save(); render(); toast('中間確認を記録しました','ok');
    }
  });
});

action('dlgClose', function(ds){
  var rec = byId(DB.data.delegations, ds.id); if(!rec) return;
  openForm({
    title:'委任を終了する', wide:true,
    intro:'<b>結果が出なかった場合でも、まず「任せ方の設計」を検証してください。</b>'+
          '育成・基準・中間確認・権限設計を作らなかった結果として能力不足が起きたのに、'+
          'それを本人の資質として罰すると、同じことが繰り返されます。',
    fields:[
      { key:'state', label:'結果', type:'select', required:true,
        options:DELEGATION_STATES.filter(function(s){return s.key!=='open';})
                                 .map(function(s){return {value:s.key,label:s.label};}) },
      { key:'result', label:'何ができて、何ができなかったか', type:'textarea', rows:3, full:true, required:true },
      { key:'designNote', label:'任せ方の設計で足りなかったもの', type:'textarea', rows:2, full:true,
        hint:'成果の定義／裁量／情報／練習／中間確認／期限 のどれか。' },
      { key:'learn', label:'次に同じ仕事を任せるときに変えること', type:'textarea', rows:2, full:true }
    ],
    value:{ state:'done', result:rec.result||'', designNote:rec.designNote||'' },
    submitLabel:'終了する',
    onSubmit:function(v){
      for(var k in v) rec[k] = v[k];
      rec.closedAt = nowIso();
      DB.save(); render(); toast('終了しました','ok');
    }
  });
});

action('dlgDel', function(ds){
  confirmDialog('削除', 'この委任カードを削除します。よろしいですか？', function(){
    DB.data.delegations = DB.data.delegations.filter(function(x){ return x.id!==ds.id; });
    DB.save(); render(); toast('削除しました','ok');
  }, '削除する');
});

action('dlgCsv', function(){
  var rows = [['任せた仕事','相手','渡した日','期限','中間確認日','成果物・数値','本人の裁量','禁止事項','相談条件','確認実施/予定','状態','結果','任せ方の検証']];
  DB.data.delegations.forEach(function(r){
    var cs = r.checks||[];
    rows.push([r.title, r.employeeId?empName(r.employeeId):'', r.startDate, r.due, r.checkAt,
      r.outcome, r.ownArea, r.noGo, r.helpAt,
      cs.filter(function(c){return c.doneAt;}).length+'/'+cs.length,
      delegationState(r).label, r.result, r.designNote]);
  });
  downloadCsv('委任カード_'+todayStr()+'.csv', rows);
  toast('CSVを書き出しました','ok');
});
