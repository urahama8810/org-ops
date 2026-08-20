/* ============================================================
   16-decisions.js  重要な決定
   ------------------------------------------------------------
   会社として大きな決定をするときの、共通の手順。
     ・重要な決定は、話が持ち上がってから24時間おいて確定する
     ・新しい取り組みは、1枚にまとめて48時間おいてから判断する
     ・大きな決定には、反対の立場から意見を言う人を1名置く
   ============================================================ */

/* ---------- 判定ロジック ---------- */

function decisionKind(key){
  for(var i=0;i<DECISION_KINDS.length;i++) if(DECISION_KINDS[i].key===key) return DECISION_KINDS[i];
  return DECISION_KINDS[DECISION_KINDS.length-1];
}
/* 待ち時間が明ける時刻 */
function holdUntil(rec, hours){
  var base = rec.raisedAt || rec.createdAt;
  if(!base) return '';
  var t = new Date(base);
  if(isNaN(t.getTime())) return '';
  t.setHours(t.getHours() + num(hours, 24));
  return t.toISOString();
}
function hoursLeft(iso){
  if(!iso) return 0;
  return Math.max(0, hoursBetween(nowIso(), iso));
}
function holdLabel(iso){
  var h = hoursLeft(iso);
  if(h <= 0) return '<span class="badge ok">待ち時間が明けました</span>';
  if(h < 1) return '<span class="badge warn">あと'+Math.ceil(h*60)+'分</span>';
  return '<span class="badge warn">あと'+Math.ceil(h)+'時間</span>';
}

/* 確定してよい状態か。理由をつけて返す */
function decisionCanDecide(dec){
  var reasons = [];
  var until = holdUntil(dec, decisionKind(dec.kind).hold);
  if(hoursLeft(until) > 0)
    reasons.push('まだ24時間の待ち時間の中です（'+fmtJp(until)+'まで）。');
  if(!dec.devilName)
    reasons.push('反対の立場から意見を言う人が決まっていません。');
  if(!String(dec.devilNote||'').trim())
    reasons.push('反対意見の内容が記録されていません。');
  if(!String(dec.lossNow||'').trim() || !String(dec.lossWait||'').trim())
    reasons.push('「いま決めないことで失うもの」と「急いで決めて外したときに失うもの」の両方を書いてください。');
  return { ok:reasons.length===0, reasons:reasons };
}

/* 1枚企画書の充足度 */
function ventureFill(v){
  var miss = [];
  VENTURE_FIELDS.forEach(function(f){
    if(!String(v[f.key]||'').trim()) miss.push(f.label.replace(/（.*$/,''));
  });
  return { done:VENTURE_FIELDS.length-miss.length, total:VENTURE_FIELDS.length,
           rate:Math.round((VENTURE_FIELDS.length-miss.length)/VENTURE_FIELDS.length*100), missing:miss };
}
function ventureCanStart(v){
  var reasons = [];
  var fill = ventureFill(v);
  if(fill.missing.length) reasons.push('企画書の未記入：'+fill.missing.join('、'));
  var until = holdUntil(v, 48);
  if(hoursLeft(until) > 0) reasons.push('まだ48時間の待ち時間の中です（'+fmtJp(until)+'まで）。');
  return { ok:reasons.length===0, reasons:reasons, fill:fill };
}

/* 決定まわりの集計 */
function decisionStats(){
  var d = DB.data;
  var decs = d.decisions, vens = d.ventures;
  var decided = decs.filter(function(x){ return x.stage==='decided'; });
  /* 手順どおりの割合＝確定したもののうち、待ち時間を守ったもの */
  var kept = decided.filter(function(x){ return x.heldOk; }).length;
  var vStarted = vens.filter(function(v){ return v.stage==='approved'||v.stage==='running'||v.stage==='closed'; });
  var vFull = vens.filter(function(v){ return ventureFill(v).rate===100; }).length;
  var vExit = vens.filter(function(v){ return String(v.exitCond||'').trim(); }).length;
  return {
    total:decs.length, decided:decided.length, holding:decs.filter(function(x){return x.stage==='holding'||x.stage==='draft';}).length,
    holdRate: decided.length ? Math.round(kept/decided.length*100) : null,
    ventures:vens.length, started:vStarted.length,
    sheetRate: vens.length ? Math.round(vFull/vens.length*100) : null,
    exitRate:  vens.length ? Math.round(vExit/vens.length*100) : null
  };
}

/* ---------- 画面 ---------- */
var decTab = 'decision';

VIEWS.decisions = {
  title:'重要な決定',
  desc:'大きな決定を、その場の勢いではなく、決めた手順で進めるための画面です。',
  render:function(){
    var d = DB.data, st = decisionStats(), h = '';

    h += '<div class="notice">'+
      '<b>急いで決めたくなるときほど、いったんおいてから決めます。</b>'+
      '人の配置、契約の解除、大きな支出のように、あとから戻しにくい決定は、'+
      'ここに登録して<b>24時間おいてから</b>確定します。'+
      '新しい取り組みは、目的と撤退の条件を1枚にまとめ、<b>48時間おいてから</b>判断します。'+
      'この手順は、役職に関係なく全員に同じように当てはまります。'+
      '</div>';

    h += '<div class="grid c4" style="margin-bottom:16px;">'+
      tile('検討中の決定', st.holding+'<small>件</small>', '時間をおいている、または論点を整理中', st.holding?'warn':'ok', 'clock')+
      tile('確定した決定', st.decided+'<small>件</small>',
           st.holdRate===null?'—':'手順どおり '+st.holdRate+'%',
           st.holdRate===null?'':(st.holdRate>=80?'ok':'bad'))+
      tile('新しい取り組み', st.ventures+'<small>件</small>',
           st.sheetRate===null?'—':'記入完了 '+st.sheetRate+'%',
           st.sheetRate===null?'':(st.sheetRate>=80?'ok':'warn'), 'sparkle')+
      tile('撤退条件を決めた割合', st.exitRate===null?'—':st.exitRate+'<small>%</small>',
           '「様子を見る」は条件になりません', st.exitRate===null?'':(st.exitRate>=80?'ok':'bad'))+
      '</div>';

    h += '<div class="tabs">'+
      '<button type="button" class="tab '+(decTab==='decision'?'active':'')+'" data-act="decTab" data-t="decision">重要な決定（24時間おく） ('+d.decisions.length+')</button>'+
      '<button type="button" class="tab '+(decTab==='venture'?'active':'')+'" data-act="decTab" data-t="venture">新しい取り組み（48時間おく） ('+d.ventures.length+')</button>'+
      '</div>';

    if(decTab==='venture') h += renderVentureList();
    else                   h += renderDecisionList();
    h += renderThirdOptions();
    return h;
  }
};
VIEWS.decisions.setTab = function(t){ decTab = t; };   /* 他の画面からタブを指定できるようにする */


/* やり方を見直すとき、正反対に振れないための目安。読みたい人だけが開く */
function renderThirdOptions(){
  return '<details class="help"><summary>'+ic('route',14)+
    'やり方を見直すときの目安（どちらにも振り切らない）</summary><div class="in">'+
    'やり方を変えるときによくあるのは、任せきりだった反省から細かく縛りすぎる方へ、'+
    '取り決めを省いていた反省から相手を疑う方へ、いきなり振れてしまうことです。'+
    '必要なのは正反対に振ることではなく、その間にある三つめの選び方です。'+
    '<table class="tbl" style="margin-top:10px;"><thead><tr>'+
    '<th>やめたい状態</th><th>行きすぎた反動</th><th>目指す進め方</th></tr></thead><tbody>'+
    THIRD_OPTIONS.map(function(r){
      return '<tr><td>'+esc(r.bad)+'</td><td class="muted">'+esc(r.wrong)+'</td>'+
             '<td><b>'+esc(r.right)+'</b></td></tr>'; }).join('')+
    '</tbody></table></div></details>';
}

function renderDecisionList(){
  var d = DB.data;
  var rows = sortBy(d.decisions, function(x){ return x.raisedAt||x.createdAt; }).reverse();

  var body = tableHtml([
    { label:'件名', render:function(r){
        return '<b>'+esc(r.title)+'</b><div class="small muted">'+esc(decisionKind(r.kind).label)+'</div>'; } },
    { label:'待ち時間', width:'150px', render:function(r){
        if(r.stage==='decided') return '<span class="small">'+(r.heldOk?'手順どおり':'<b style="color:var(--bad-solid);">時間をおかず確定</b>')+'</span>';
        if(r.stage==='dropped') return '<span class="small muted">見送り</span>';
        return holdLabel(holdUntil(r, decisionKind(r.kind).hold))+
               '<div class="small muted">'+fmtJp(holdUntil(r, decisionKind(r.kind).hold))+'まで</div>'; } },
    { label:'反対意見を言う人', width:'130px', render:function(r){
        return r.devilName ? esc(r.devilName)+(String(r.devilNote||'').trim()?'':'<div class="small" style="color:var(--bad-solid);">意見が未記入</div>')
                           : badge('未定','bad'); } },
    { label:'段階', width:'110px', render:function(r){
        var s = r.stage||'draft';
        var lb = DECISION_STAGES.filter(function(x){return x.key===s;})[0];
        var cls = s==='decided'?'ok':(s==='dropped'?'neutral':'warn');
        return badge(lb?lb.label:s, cls); } },
    { label:'', cls:'actions', width:'200px', render:function(r){
        var b = btn('開く','decEdit',{id:r.id});
        if(r.stage!=='decided' && r.stage!=='dropped'){
          b += ' '+btn('確定する','decDecide',{id:r.id},'primary');
          b += ' '+btn('見送り','decDrop',{id:r.id});
        }
        return b + ' ' + btn('削除','decDel',{id:r.id},'danger'); } }
  ], rows, {
    emptyTitle:'まだ記録がありません',
    emptyText:'人の配置、契約の解除、大きな支出などを決める前に、まずここに登録してください。',
    emptyIcon:'shield'
  });

  return card('重要な決定', body, {
    icon:'shield',
    sub:'急いで決めたくなっているときは、その日は論点の整理までにします',
    tools: btn('決定を登録する','decNew',{},'primary','plus')+' '+btn('CSV','decCsv',{},'','download')
  });
}

function renderVentureList(){
  var rows = sortBy(DB.data.ventures, function(x){ return x.raisedAt||x.createdAt; }).reverse();
  var body = tableHtml([
    { label:'案件名', render:function(r){
        return '<b>'+esc(r.title)+'</b><div class="small muted">'+esc(String(r.purpose||'').slice(0,50))+'</div>'; } },
    { label:'記入状況', width:'160px', render:function(r){
        var f = ventureFill(r);
        return progressBar(f.rate, f.rate===100?'ok':f.rate>=60?'warn':'bad')+
          '<span class="small mono">'+f.done+'/'+f.total+'</span>'+
          (f.missing.length?'<div class="small muted">未記入：'+esc(f.missing.slice(0,3).join('、'))+'</div>':''); } },
    { label:'48時間の待ち', width:'140px', render:function(r){
        if(r.stage&&r.stage!=='draft') return '<span class="small muted">—</span>';
        return holdLabel(holdUntil(r, 48)); } },
    { label:'撤退条件', render:function(r){
        return String(r.exitCond||'').trim() ? '<span class="small">'+esc(r.exitCond)+'</span>' : badge('未設定','bad'); } },
    { label:'状態', width:'100px', render:function(r){
        var m = { draft:['審査待ち','warn'], approved:['着手可','ok'], running:['進行中','accent'],
                  closed:['終了','neutral'], dropped:['見送り','neutral'] };
        var x = m[r.stage||'draft'];
        return badge(x[0], x[1]); } },
    { label:'', cls:'actions', width:'190px', render:function(r){
        var b = btn('開く','venEdit',{id:r.id});
        if((r.stage||'draft')==='draft') b += ' '+btn('審査する','venApprove',{id:r.id},'primary');
        return b + ' ' + btn('削除','venDel',{id:r.id},'danger'); } }
  ], rows, {
    emptyTitle:'まだ企画書がありません',
    emptyText:'思いついた取り組みは、まず1枚に書いて48時間おいてから判断します。',
    emptyIcon:'sparkle'
  });

  return card('新しい取り組み', body, {
    icon:'sparkle',
    sub:'口約束で始めず、目的・期待する成果・必要な資源・撤退の条件・責任者・上限を1枚に書きます',
    tools: btn('企画書を書く','venNew',{},'primary','plus')
  });
}

/* ---------- 操作 ---------- */
action('decTab', function(ds){ decTab = ds.t; render(); });

var DECISION_FORM = function(v){
  return [
    { key:'title', label:'決めようとしていること', required:true, full:true,
      placeholder:'例：営業部の担当を入れ替える／B社との取引を見直す' },
    { key:'kind', label:'種別', type:'select', options:DECISION_KINDS.map(function(k){return {value:k.key,label:k.label};}) },
    { key:'raisedAt', label:'この件が持ち上がった日時', type:'datetime',
      hint:'ここから24時間は確定できません。' },
    { key:'facts', label:'分かっている事実（推測とは分けて書く）', type:'textarea', rows:3, full:true,
      hint:'いつ・どこで・何が起きたか。解釈や人物の評価は入れません。' },
    { key:'lossNow', label:'いま決めないことで失うもの', type:'textarea', rows:2,
      hint:'待つことで失うものを、金額や日数で書きます。' },
    { key:'lossWait', label:'急いで決めて外したときに失うもの', type:'textarea', rows:2,
      hint:'判断を誤った場合に失うものを、金額・人・信用で書きます。' },
    { key:'devilName', label:'反対の立場から意見を言う人（1名）',
      hint:'その人には「反対の見方を出すのが役割」だと先に伝えます。' },
    { key:'devilNote', label:'その人が挙げた反対意見', type:'textarea', rows:2,
      hint:'反論が出ない決定は、納得されたのではなく、言いにくかっただけかもしれません。' },
    { key:'options', label:'考えられる案（2つ以上）', type:'textarea', rows:3, full:true,
      hint:'「やる／やらない」だけでなく、条件つき・小さく試す・期限つきの案も書きます。' }
  ];
};

action('decNew', function(){
  openForm({
    title:'重要な決定を登録する', wide:true,
    intro:'<b>人の配置、契約の解除、大きな支出などは、その場では確定しません。</b>'+
          'ここに登録すると24時間の待ち時間が始まります。その間に、事実の確認と論点の整理を進めます。',
    fields:DECISION_FORM(),
    value:{ kind:'people', raisedAt:fmtDateTimeLocal(new Date()) },
    onSubmit:function(v){
      v.id = uid('dec'); v.createdAt = nowIso(); v.stage = 'holding'; v.cooled = false;
      if(v.raisedAt) v.raisedAt = new Date(v.raisedAt).toISOString();
      DB.data.decisions.push(v); DB.save(); render();
      toast('登録しました。24時間おいてから確定できます。','ok');
    }
  });
});

action('decEdit', function(ds){
  var rec = byId(DB.data.decisions, ds.id); if(!rec) return;
  var chk = decisionCanDecide(rec);
  var extra = '<div class="help-block" style="margin-bottom:10px;">'+
    (rec.stage==='decided'
      ? '<b>確定済み：</b>'+esc(fmtJp(rec.decidedAt))+(rec.heldOk?'（手順どおりに確定）':'（<b style="color:var(--bad-solid);">待ち時間をおかずに確定</b>）')
      : (chk.ok ? '<b>確定できます。</b>待ち時間が過ぎ、反対意見の確認も済んでいます。'
                : '<b>まだ確定できません。</b><ul style="margin:6px 0 0 18px;">'+
                  chk.reasons.map(function(r){return '<li>'+esc(r)+'</li>';}).join('')+'</ul>'))+
    '</div>';
  openForm({
    title:'重要な決定', wide:true, intro:extra,
    fields:DECISION_FORM().concat([
      { type:'heading', label:'確定するときに記入する' },
      { key:'cooled', type:'checkbox', label:'時間をおいて見直した', full:true,
        checkLabel:'時間をおいてから、もう一度この件を見直した' },
      { key:'decision', label:'決めた内容', type:'textarea', rows:2, full:true },
      { key:'reason', label:'そう決めた理由（記録に残す）', type:'textarea', rows:2, full:true },
      { key:'review', label:'この判断を見直す日', type:'date' }
    ]),
    value:rec,
    submitLabel:'保存',
    onSubmit:function(v){
      for(var k in v) rec[k] = v[k];
      if(rec.raisedAt) rec.raisedAt = new Date(rec.raisedAt).toISOString();
      DB.save(); render(); toast('保存しました','ok');
    }
  });
});

action('decDecide', function(ds){
  var rec = byId(DB.data.decisions, ds.id); if(!rec) return;
  var chk = decisionCanDecide(rec);
  if(!chk.ok){
    openModal({
      title:'まだ確定できません',
      body:'<div class="alert bad"><span class="ic">'+ic('alert',15)+'</span><div class="body"><div class="t">まだ確定できない項目があります</div>'+
           '<div class="d">'+chk.reasons.map(function(r){return esc(r);}).join('<br>')+'</div></div></div>'+
           '<div class="help-block" style="margin-top:12px;">'+
           'この手順は、判断を止めるためではなく、後から戻せない決定をゆっくり進めるためのものです。'+
           '失うものを両方書き出し、反対の見方を1人から聞いてから、もう一度開いてください。</div>',
      foot:'<button class="btn" data-modal-close>閉じる</button>'+
           '<button class="btn danger" data-act="decForce" data-id="'+esc(rec.id)+'">手順を飛ばして確定する（記録に残ります）</button>'
    });
    return;
  }
  confirmDialog('この決定を確定する',
    '件名：'+rec.title+'\n\n待ち時間が過ぎ、反対意見の確認も済んでいます。確定して記録に残しますか？',
    function(){
      rec.stage='decided'; rec.decidedAt=nowIso(); rec.heldOk=true;
      DB.save(); render(); toast('確定しました','ok');
    }, '確定する');
});

action('decForce', function(ds){
  var rec = byId(DB.data.decisions, ds.id); if(!rec) return;
  closeModal();
  confirmDialog('手順を飛ばして確定します',
    'この確定は「待ち時間をおかずに確定した決定」として記録に残り、組織の健康診断の数値にも反映されます。\n\n'+
    '急を要する場合だけにしてください。',
    function(){
      rec.stage='decided'; rec.decidedAt=nowIso(); rec.heldOk=false;
      DB.save(); render(); toast('記録しました（手順を飛ばした確定）','bad');
    }, 'それでも確定する');
});

action('decDrop', function(ds){
  var rec = byId(DB.data.decisions, ds.id); if(!rec) return;
  rec.stage='dropped'; rec.decidedAt=nowIso();
  DB.save(); render(); toast('見送りとして記録しました','ok');
});

action('decDel', function(ds){
  confirmDialog('削除', 'この決定の記録を削除します。よろしいですか？', function(){
    DB.data.decisions = DB.data.decisions.filter(function(x){ return x.id!==ds.id; });
    DB.save(); render(); toast('削除しました','ok');
  }, '削除する');
});

/* ---------- 新規案件（1枚企画書） ---------- */
var VENTURE_FORM = function(){
  var f = [
    { key:'title', label:'案件名', required:true, full:true },
    { key:'raisedAt', label:'思いついた日時', type:'datetime', hint:'ここから48時間は着手しません。' }
  ];
  VENTURE_FIELDS.forEach(function(x){
    f.push({ key:x.key, label:x.label, hint:x.hint,
             type:(x.key==='ownerName'||x.key==='cap') ? 'text' : 'textarea',
             rows:2, full:(x.key!=='ownerName'&&x.key!=='cap') });
  });
  f.push({ key:'impact', label:'既存事業への影響', type:'textarea', rows:2, full:true,
           hint:'この案件に人と時間を割いた場合、本業のどの改善が止まるかを書く。' });
  return f;
};

action('venNew', function(){
  openForm({
    title:'新規案件の1枚企画書', wide:true,
    intro:'<b>新規事業への衝動は、挑戦心だけとは限りません。</b>'+
          '地味で反復的な営業や、既存事業の改善から逃れるための新鮮な刺激になっている場合があります。'+
          '思いついたら、まずこの1枚を書いて48時間置いてください。それでもやるべきだと思えたら、進めます。',
    fields:VENTURE_FORM(),
    value:{ raisedAt:fmtDateTimeLocal(new Date()) },
    onSubmit:function(v){
      v.id = uid('ven'); v.createdAt = nowIso(); v.stage = 'draft';
      if(v.raisedAt) v.raisedAt = new Date(v.raisedAt).toISOString();
      DB.data.ventures.push(v); DB.save(); render();
      toast('登録しました。48時間の保留に入ります。','ok');
    }
  });
});

action('venEdit', function(ds){
  var rec = byId(DB.data.ventures, ds.id); if(!rec) return;
  var chk = ventureCanStart(rec);
  openForm({
    title:'新規案件の1枚企画書', wide:true,
    intro:'<div class="help-block">'+(chk.ok?'<b>審査できます。</b>':'<b>まだ着手できません。</b><br>'+chk.reasons.map(esc).join('<br>'))+'</div>',
    fields:VENTURE_FORM().concat([
      { type:'heading', label:'審査の記録' },
      { key:'reviewNote', label:'審査で出た意見', type:'textarea', rows:2, full:true },
      { key:'result', label:'結果・実績', type:'textarea', rows:2, full:true }
    ]),
    value:rec, submitLabel:'保存',
    onSubmit:function(v){
      for(var k in v) rec[k] = v[k];
      if(rec.raisedAt) rec.raisedAt = new Date(rec.raisedAt).toISOString();
      DB.save(); render(); toast('保存しました','ok');
    }
  });
});

action('venApprove', function(ds){
  var rec = byId(DB.data.ventures, ds.id); if(!rec) return;
  var chk = ventureCanStart(rec);
  if(!chk.ok){
    toast('まだ審査できません：'+chk.reasons[0], 'bad');
    ACTIONS.venEdit(ds);
    return;
  }
  openModal({
    title:'新規案件の審査',
    body:'<div class="help-block"><b>'+esc(rec.title)+'</b></div>'+
         '<table class="tbl"><tbody>'+
         VENTURE_FIELDS.map(function(f){
           return '<tr><td style="width:180px;">'+esc(f.label)+'</td><td>'+nl2br(rec[f.key]||'')+'</td></tr>'; }).join('')+
         '</tbody></table>'+
         '<div class="help-block" style="margin-top:12px;">'+
         '着手を決めるときは、資源上限を超えた時点で自動的に撤退条件の判断に入ることを、責任者と共有してください。</div>',
    foot:'<button class="btn" data-modal-close>閉じる</button>'+
         '<button class="btn" data-act="venSet" data-id="'+esc(rec.id)+'" data-s="dropped">見送る</button>'+
         '<button class="btn primary" data-act="venSet" data-id="'+esc(rec.id)+'" data-s="approved">着手を承認する</button>'
  });
});

action('venSet', function(ds){
  var rec = byId(DB.data.ventures, ds.id); if(!rec) return;
  rec.stage = ds.s; rec.decidedAt = nowIso();
  closeModal(); DB.save(); render();
  toast(ds.s==='approved' ? '着手を承認しました' : '見送りとして記録しました', 'ok');
});

action('decCsv', function(){
  var rows = [['種別','件名','分類','持ち上がった日時','待ち時間を守ったか','段階',
               '反対意見を言う人','反対意見','いま決めないと失うもの','急いで決めて外すと失うもの','決めた内容','理由','見直し日']];
  sortBy(DB.data.decisions, function(x){ return x.raisedAt||x.createdAt; }).forEach(function(r){
    rows.push(['重要な決定', r.title, decisionKind(r.kind).label, fmtJp(r.raisedAt),
      r.stage==='decided' ? (r.heldOk?'手順どおり':'時間をおかず確定') : '',
      (DECISION_STAGES.filter(function(x){return x.key===(r.stage||'draft');})[0]||{}).label,
      r.devilName, r.devilNote, r.lossNow, r.lossWait, r.decision, r.reason, r.review]);
  });
  var vrows = [['案件名','思いついた日時','記入率','目的','期待利益','必要資源','失敗条件','撤退条件','責任者','資源上限','状態','審査で出た意見','結果']];
  sortBy(DB.data.ventures, function(x){ return x.raisedAt||x.createdAt; }).forEach(function(r){
    vrows.push([r.title, fmtJp(r.raisedAt), ventureFill(r).rate+'%', r.purpose, r.gain, r.resource,
      r.failCond, r.exitCond, r.ownerName, r.cap, r.stage||'draft', r.reviewNote, r.result]);
  });
  downloadCsv('重要な決定_'+todayStr()+'.csv', rows);
  setTimeout(function(){ downloadCsv('新規案件の企画書_'+todayStr()+'.csv', vrows); }, 300);
  toast('CSVを書き出しました','ok');
});

action('venDel', function(ds){
  confirmDialog('削除', 'この企画書を削除します。よろしいですか？', function(){
    DB.data.ventures = DB.data.ventures.filter(function(x){ return x.id!==ds.id; });
    DB.save(); render(); toast('削除しました','ok');
  }, '削除する');
});
