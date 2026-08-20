/* ============================================================
   17-delegation.js  仕事の任せ方
   ------------------------------------------------------------
   任せきりにするのでも、細かく口を出すのでもなく、
   渡すときに6項目を決めて、決めた日に一度だけ確認する。
   その記録をここに残す。
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
  title:'仕事の任せ方',
  desc:'仕事を渡すときに決める6項目と、途中で確認した記録です。',
  render:function(){
    var d = DB.data, st = delegationStats(), h = '';

    h += '<div class="notice">'+
      '<b>まだできないことを任せるのは、それ自体はよい機会です。</b>'+
      'ただし、事前の説明、完了の条件、決めてよい範囲、練習の機会、途中の確認、具体的な助言。'+
      'これらがないまま渡すと、育つ機会ではなく「できるかどうかの試験」になってしまいます。'+
      '仕事を渡すときは、次の6項目を決めてからにしましょう。'+
      '</div>';

    h += '<div class="grid c4" style="margin-bottom:16px;">'+
      tile('進行中の仕事', st.open+'<small>件</small>', '全'+st.total+'件', 'accent', 'handoff')+
      tile('6項目の記入率', st.fullRate===null?'—':st.fullRate+'<small>%</small>',
           '空欄のまま渡すと、任せきりになりやすくなります', st.fullRate===null?'':(st.fullRate>=80?'ok':'bad'))+
      tile('途中確認の実施率', st.checkRate===null?'—':st.checkRate+'<small>%</small>',
           '育成が回っているかが、ここに出ます', st.checkRate===null?'':(st.checkRate>=80?'ok':st.checkRate>=50?'warn':'bad'))+
      tile('対応が必要', st.late+'<small>件</small>', '確認の遅れ・期限超過・確認日が未設定', st.late?'bad':'ok', 'alert')+
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
      { label:'次の確認日', width:'130px', render:function(r){
          var nc = nextCheckDate(r);
          if(!nc) return badge('未設定','bad');
          var left = daysBetween(todayStr(), nc);
          return esc(nc)+'<div class="small '+(left<0?'':'muted')+'" '+(left<0?'style="color:var(--bad-solid);font-weight:600;"':'')+'>'+
                 (left<0?(-left)+'日超過':left===0?'今日':'あと'+left+'日')+'</div>'; } },
      { label:'確認回数', cls:'num', width:'80px', render:function(r){
          var cs = r.checks||[];
          return cs.filter(function(c){return c.doneAt;}).length+' / '+cs.length; } },
      { label:'状態', width:'120px', render:function(r){
          var s = delegationState(r); return badge(s.label, s.cls); } },
      { label:'', cls:'actions', width:'210px', render:function(r){
          var b = btn('開く','dlgEdit',{id:r.id});
          if(!r.state || r.state==='open'){
            b += ' '+btn('確認を記録','dlgCheck',{id:r.id},'primary','check');
            b += ' '+btn('終了','dlgClose',{id:r.id});
          }
          return b+' '+btn('削除','dlgDel',{id:r.id},'danger'); } }
    ], rows, {
      emptyTitle:'まだ登録がありません',
      emptyText:'次に誰かへ仕事を渡すとき、その場で1件つくってみてください。',
      emptyIcon:'handoff'
    });

    h += card('任せている仕事', body, {
      icon:'handoff',
      sub:'うまくいかなかったときは、本人だけでなく、渡し方のほうも一緒に見直します',
      tools: btn('仕事を渡す','dlgNew',{},'primary','plus')+' '+btn('CSV','dlgCsv',{},'','download')
    });

    /* 6項目の説明 */
    h += card('任せるときに決める6項目',
      '<div class="grid c2">'+
      DELEGATION_FIELDS.map(function(f){
        return '<div class="field"><label>'+esc(f.label)+'</label>'+
               '<div class="small muted">'+esc(f.hint||'')+'</div></div>';
      }).join('')+'</div>'+
      '<div class="help-block" style="margin-top:6px;">'+esc(MGMT_DEFINITION)+'</div>',
      {icon:'clipboard'});

    h += '<details class="help"><summary>'+ic('users',14)+
      '同じ「管理」でも、続く関わり方と続かない関わり方があります</summary><div class="in">'+
      '<table class="tbl"><thead><tr>'+
      '<th style="width:50%;">続けたい関わり方</th><th>やりすぎになりやすい関わり方</th>'+
      '</tr></thead><tbody>'+
      MGMT_VS_CONTROL.map(function(r){
        return '<tr><td><b>'+esc(r.mgmt)+'</b></td><td class="muted">'+esc(r.ctrl)+'</td></tr>'; }).join('')+
      '</tbody></table>'+
      '<p style="margin:10px 0 0;">中間の確認がないと、状況が見えないまま期限を迎え、'+
      'その段階で急いで細かく指示することになりがちです。すると質問や報告が出にくくなり、'+
      'また状況が見えなくなります。決めた日に一度だけ確認する。それだけで、この流れは止まります。</p>'+
      '</div></details>';


    return h;
  }
};

/* ---------- 操作 ---------- */
var DELEGATION_FORM = function(){
  var f = [
    { key:'title', label:'渡す仕事', required:true, full:true, placeholder:'例：新規のお客様向け提案書をつくって提出する' },
    { key:'employeeId', label:'担当する人', type:'select', options:empOptions(true), required:true },
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
    title:'仕事を渡す', wide:true,
    intro:'<b>この6項目が空欄のまま渡すと、途中でつまずきやすくなります。</b>'+
          'とくに⑤の中間確認日は、任せきりになるかどうかの分かれ目です。',
    fields:DELEGATION_FORM(), value:v,
    onSubmit:function(v2){
      v2.id = uid('dlg'); v2.createdAt = nowIso(); v2.state = 'open'; v2.checks = [];
      if(v2.checkAt) v2.checks.push({ id:uid('chk'), date:v2.checkAt, doneAt:'', note:'' });
      DB.data.delegations.push(v2); DB.save(); render();
      toast('登録しました','ok');
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
    title:'任せている仕事', wide:true,
    intro:'<div class="help-block"><b>これまでの確認の記録</b>'+hist+'</div>',
    fields:DELEGATION_FORM().concat([
      { type:'heading', label:'結果と、渡し方の振り返り' },
      { key:'feedback', label:'本人に伝えた具体的な内容', type:'textarea', rows:2, full:true,
        hint:'人柄や姿勢ではなく、行動と結果について書きます。' },
      { key:'retryCount', label:'もう一度やってもらった回数', type:'number', min:0,
        hint:'一度うまくいかなかっただけで手を離すと、身につく前に終わってしまいます。' },
      { key:'designNote', label:'渡し方のほうに足りないところはなかったか', type:'textarea', rows:2, full:true,
        hint:'成果の定義・決めてよい範囲・情報・練習・期限のどれが足りなかったかを書きます。' }
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
    title:'この仕事を終了する', wide:true,
    intro:'<b>結果が出なかったときも、まず渡し方のほうを振り返ります。</b>'+
          '説明・基準・途中の確認・決めてよい範囲。'+
          'これらが足りずに起きたことを本人の力不足として扱うと、同じことがくり返されます。',
    fields:[
      { key:'state', label:'結果', type:'select', required:true,
        options:DELEGATION_STATES.filter(function(s){return s.key!=='open';})
                                 .map(function(s){return {value:s.key,label:s.label};}) },
      { key:'result', label:'何ができて、何ができなかったか', type:'textarea', rows:3, full:true, required:true },
      { key:'designNote', label:'渡し方で足りなかったもの', type:'textarea', rows:2, full:true,
        hint:'成果の定義／決めてよい範囲／情報／練習／途中の確認／期限 のどれか。' },
      { key:'learn', label:'次に同じ仕事を渡すときに変えること', type:'textarea', rows:2, full:true }
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
  confirmDialog('削除', 'この記録を削除します。よろしいですか？', function(){
    DB.data.delegations = DB.data.delegations.filter(function(x){ return x.id!==ds.id; });
    DB.save(); render(); toast('削除しました','ok');
  }, '削除する');
});

action('dlgCsv', function(){
  var rows = [['渡した仕事','担当する人','渡した日','期限','途中の確認日','成果物・数値','本人が決めてよい範囲','やらないこと','相談の条件','確認の実施/予定','状態','結果','渡し方の振り返り']];
  DB.data.delegations.forEach(function(r){
    var cs = r.checks||[];
    rows.push([r.title, r.employeeId?empName(r.employeeId):'', r.startDate, r.due, r.checkAt,
      r.outcome, r.ownArea, r.noGo, r.helpAt,
      cs.filter(function(c){return c.doneAt;}).length+'/'+cs.length,
      delegationState(r).label, r.result, r.designNote]);
  });
  downloadCsv('仕事の任せ方_'+todayStr()+'.csv', rows);
  toast('CSVを書き出しました','ok');
});
