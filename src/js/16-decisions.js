/* ============================================================
   16-decisions.js  意思決定の防波堤
   ------------------------------------------------------------
   構造分析レポート 第11章 第1層／第12章 0〜3日
     ・重大決裁の24時間ルール（怒り・焦りが強いときは確定しない）
     ・新規案件の48時間ルール（口頭決裁の禁止・1枚企画書）
     ・重大判断には反対意見を言う役割を1人置く
   ============================================================ */

/* ---------- 判定ロジック ---------- */

function decisionKind(key){
  for(var i=0;i<DECISION_KINDS.length;i++) if(DECISION_KINDS[i].key===key) return DECISION_KINDS[i];
  return DECISION_KINDS[DECISION_KINDS.length-1];
}
function emotionOf(v){
  var n = num(v,0);
  for(var i=0;i<EMOTION_LEVELS.length;i++) if(EMOTION_LEVELS[i].v===n) return EMOTION_LEVELS[i];
  return EMOTION_LEVELS[0];
}
/* 冷却期間の終了時刻 */
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
  if(h <= 0) return '<span class="badge ok">冷却期間が明けました</span>';
  if(h < 1) return '<span class="badge warn">あと'+Math.ceil(h*60)+'分</span>';
  return '<span class="badge warn">あと'+Math.ceil(h)+'時間</span>';
}

/* 決裁を確定してよいか。理由付きで返す */
function decisionCanDecide(dec){
  var reasons = [];
  var em = emotionOf(dec.emotion);
  if(em.hold && !dec.cooled)
    reasons.push('登録時に「'+em.label+'」でした。落ち着いてから確定してください。');
  var until = holdUntil(dec, decisionKind(dec.kind).hold);
  if(hoursLeft(until) > 0)
    reasons.push('24時間ルールの冷却期間中です（'+fmtJp(until)+'まで）。');
  if(!dec.devilName)
    reasons.push('反対意見を言う役割が指名されていません。');
  if(!String(dec.devilNote||'').trim())
    reasons.push('反対意見の内容が記録されていません。');
  if(!String(dec.lossNow||'').trim() || !String(dec.lossWait||'').trim())
    reasons.push('「今すぐ決めない損失」と「衝動的に決める損失」の両方を書いてください。');
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
  if(fill.missing.length) reasons.push('1枚企画書の未記入：'+fill.missing.join('、'));
  var until = holdUntil(v, 48);
  if(hoursLeft(until) > 0) reasons.push('48時間ルールの保留中です（'+fmtJp(until)+'まで）。');
  return { ok:reasons.length===0, reasons:reasons, fill:fill };
}

/* 意思決定まわりの先行指標（レポート 表7） */
function decisionStats(){
  var d = DB.data;
  var decs = d.decisions, vens = d.ventures;
  var decided = decs.filter(function(x){ return x.stage==='decided'; });
  /* 保留率＝確定したもののうち、冷却期間を守って確定したもの */
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
  title:'意思決定の防波堤',
  desc:'感情が強いときに、重大な判断を確定させないための仕組みです。',
  render:function(){
    var d = DB.data, st = decisionStats(), h = '';

    h += '<div class="notice">'+
      '<b>目標は「怒らない経営者」になることではありません。</b>'+
      '怒りや衝動が、会社の人事・投資・契約・撤退の判断を<b>直接支配できない状態</b>をつくることです。'+
      '重大な判断は、ここに登録して24時間置いてから確定します。新規案件は1枚企画書を書いて48時間置きます。'+
      '</div>';

    h += '<div class="grid c4" style="margin-bottom:16px;">'+
      tile('保留中の重大決裁', st.holding+'<small>件</small>', '冷却期間または論点整理中', st.holding?'warn':'ok')+
      tile('確定した決裁', st.decided+'<small>件</small>',
           st.holdRate===null?'—':'ルール遵守 '+st.holdRate+'%',
           st.holdRate===null?'':(st.holdRate>=80?'ok':'bad'))+
      tile('新規案件（企画書）', st.ventures+'<small>件</small>',
           st.sheetRate===null?'—':'記入完了 '+st.sheetRate+'%',
           st.sheetRate===null?'':(st.sheetRate>=80?'ok':'warn'))+
      tile('撤退条件の設定率', st.exitRate===null?'—':st.exitRate+'<small>%</small>',
           '「様子を見る」は撤退条件ではありません', st.exitRate===null?'':(st.exitRate>=80?'ok':'bad'))+
      '</div>';

    h += '<div class="tabs">'+
      '<div class="tab '+(decTab==='decision'?'active':'')+'" data-act="decTab" data-t="decision">重大決裁（24時間ルール） ('+d.decisions.length+')</div>'+
      '<div class="tab '+(decTab==='venture'?'active':'')+'" data-act="decTab" data-t="venture">新規案件（1枚企画書・48時間） ('+d.ventures.length+')</div>'+
      '<div class="tab '+(decTab==='rule'?'active':'')+'" data-act="decTab" data-t="rule">ルールの考え方</div>'+
      '</div>';

    if(decTab==='decision')      h += renderDecisionList();
    else if(decTab==='venture')  h += renderVentureList();
    else                         h += renderDecisionRule();
    return h;
  }
};

function renderDecisionList(){
  var d = DB.data;
  var rows = sortBy(d.decisions, function(x){ return x.raisedAt||x.createdAt; }).reverse();

  var body = tableHtml([
    { label:'件名', render:function(r){
        return '<b>'+esc(r.title)+'</b><div class="small muted">'+esc(decisionKind(r.kind).label)+'</div>'; } },
    { label:'登録時の状態', width:'140px', render:function(r){
        var em = emotionOf(r.emotion);
        return badge(em.label, em.cls); } },
    { label:'冷却期間', width:'150px', render:function(r){
        if(r.stage==='decided') return '<span class="small">'+(r.heldOk?'守って確定':'<b style="color:#c8352b;">守らず確定</b>')+'</span>';
        if(r.stage==='dropped') return '<span class="small muted">見送り</span>';
        return holdLabel(holdUntil(r, decisionKind(r.kind).hold))+
               '<div class="small muted">'+fmtJp(holdUntil(r, decisionKind(r.kind).hold))+'まで</div>'; } },
    { label:'反対意見役', width:'120px', render:function(r){
        return r.devilName ? esc(r.devilName)+(String(r.devilNote||'').trim()?'':'<div class="small" style="color:#c8352b;">意見が未記録</div>')
                           : badge('未指名','bad'); } },
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
    emptyTitle:'重大決裁の記録がありません',
    emptyText:'人事・解約・大型支出・訴訟方針などを決める前に、まずここに登録してください。'
  });

  return card('重大決裁', body, {
    sub:'怒り・焦り・不信が強いときは、決定ではなく論点整理までにする',
    tools: btn('決裁を登録する','decNew',{},'primary')+' '+btn('CSV','decCsv',{})
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
    { label:'48時間保留', width:'140px', render:function(r){
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
    emptyTitle:'新規案件の企画書がありません',
    emptyText:'思いついた案件は、まず1枚に書いて48時間置いてから判断します。'
  });

  return card('新規案件・新規事業', body, {
    sub:'口頭決裁を禁止し、目的・期待利益・必要資源・失敗条件・撤退条件・責任者・資源上限を1枚に書く',
    tools: btn('企画書を書く','venNew',{},'primary')
  });
}

function renderDecisionRule(){
  var h = '';
  h += card('なぜ「保留」が必要か',
    '<div class="help-block">'+
    '短期的な安心は、その場ではっきり感じられます。一方、長期的な代償は、数週間から数年後に'+
    '離職・停滞・情報不足・機会損失として分散して現れます。<b>この時間差が、衝動的な判断を繰り返させます。</b></div>'+
    '<table class="tbl"><thead><tr><th>行動</th><th>その瞬間に得られる安心</th><th>会社が後から払う代償</th></tr></thead><tbody>'+
    [['激昂する','一瞬で主導権を取り戻せる','本音・報告・異論・挑戦が消え、問題が地下化する'],
     ['状態を固定する','予測不能感が下がる','自律性、変化対応、改善提案が失われる'],
     ['新規案件へ飛びつく','停滞感から抜け、期待と刺激を得られる','本業の地道な改善が止まり、人と資金が分散する'],
     ['利益を非事業へ使う','すぐに達成感・所有感が得られる','組織能力への再投資が止まり、利益の複利が働かない'],
     ['都合のよい性善説','契約・利害調整・監督の面倒を避けられる','想定外が起きた際の損失と裏切り感が大きくなる']]
    .map(function(r){ return '<tr><td><b>'+esc(r[0])+'</b></td><td class="small">'+esc(r[1])+'</td><td class="small">'+esc(r[2])+'</td></tr>'; }).join('')+
    '</tbody></table>', {sub:'構造分析レポート 第4章'});

  h += card('振り切らず、第三の選択肢へ',
    '<div class="help-block">改善するときによくある失敗は、放置の反省から<b>マイクロマネジメント</b>へ、'+
    '性善説の反省から<b>全面的な不信</b>へ振り切ることです。必要なのは正反対ではなく、第三の選択肢です。</div>'+
    '<table class="tbl"><thead><tr><th>いまの状態</th><th>誤った反動</th><th>健全な転換</th></tr></thead><tbody>'+
    THIRD_OPTIONS.map(function(r){
      return '<tr><td>'+esc(r.bad)+'</td><td class="small muted">'+esc(r.wrong)+'</td>'+
             '<td class="small"><b>'+esc(r.right)+'</b></td></tr>'; }).join('')+
    '</tbody></table>', {sub:'構造分析レポート 第10章'});
  return h;
}

/* ---------- 操作 ---------- */
action('decTab', function(ds){ decTab = ds.t; render(); });

var DECISION_FORM = function(v){
  return [
    { key:'title', label:'決めようとしていること', required:true, full:true,
      placeholder:'例：営業部のAさんを異動させる／B社との取引を打ち切る' },
    { key:'kind', label:'種別', type:'select', options:DECISION_KINDS.map(function(k){return {value:k.key,label:k.label};}) },
    { key:'raisedAt', label:'この件が持ち上がった日時', type:'datetime',
      hint:'ここから24時間は確定できません。' },
    { key:'emotion', label:'いまの自分の状態', type:'select',
      options:EMOTION_LEVELS.map(function(e){return {value:e.v,label:e.label};}),
      hint:'正直に選んでください。「強い怒り・焦り・不信がある」を選ぶと、落ち着くまで確定できません。' },
    { key:'facts', label:'事実（推測と分けて書く）', type:'textarea', rows:3, full:true,
      hint:'いつ・何が・どこで起きたか。解釈や人物評は入れない。' },
    { key:'lossNow', label:'今すぐ決めない損失', type:'textarea', rows:2,
      hint:'待つことで失うものを、金額・日数で書く。' },
    { key:'lossWait', label:'衝動的に決める損失', type:'textarea', rows:2,
      hint:'間違えた場合に失うものを、金額・人・信用で書く。' },
    { key:'devilName', label:'反対意見を言う役割（1名）',
      hint:'この人には「反対する」ことが仕事だと伝える。' },
    { key:'devilNote', label:'その人が挙げた反対意見', type:'textarea', rows:2,
      hint:'反論が出ない決裁は、賛成されたのではなく、言えなかっただけかもしれません。' },
    { key:'options', label:'選択肢（2つ以上）', type:'textarea', rows:3, full:true,
      hint:'「やる／やらない」だけでなく、条件付き・小さく試す・期限付きの案も書く。' }
  ];
};

action('decNew', function(){
  openForm({
    title:'重大決裁を登録する', wide:true,
    intro:'<b>怒り・強い焦り・強い不信がある状態では、人事・解約・大型支出・訴訟方針などを確定しません。</b>'+
          'ここに登録すると24時間の冷却期間が始まります。その間は論点整理だけを進めます。',
    fields:DECISION_FORM(),
    value:{ kind:'people', raisedAt:fmtDateTimeLocal(new Date()), emotion:0 },
    onSubmit:function(v){
      v.id = uid('dec'); v.createdAt = nowIso(); v.stage = 'holding'; v.cooled = false;
      if(v.raisedAt) v.raisedAt = new Date(v.raisedAt).toISOString();
      DB.data.decisions.push(v); DB.save(); render();
      toast('登録しました。24時間の冷却期間に入ります。','ok');
    }
  });
});

action('decEdit', function(ds){
  var rec = byId(DB.data.decisions, ds.id); if(!rec) return;
  var chk = decisionCanDecide(rec);
  var extra = '<div class="help-block" style="margin-bottom:10px;">'+
    (rec.stage==='decided'
      ? '<b>確定済み：</b>'+esc(fmtJp(rec.decidedAt))+(rec.heldOk?'（ルールを守って確定）':'（<b style="color:#c8352b;">冷却期間を守らずに確定</b>）')
      : (chk.ok ? '<b>確定できます。</b>冷却期間と反対意見の確認が済んでいます。'
                : '<b>まだ確定できません。</b><ul style="margin:6px 0 0 18px;">'+
                  chk.reasons.map(function(r){return '<li>'+esc(r)+'</li>';}).join('')+'</ul>'))+
    '</div>';
  openForm({
    title:'重大決裁', wide:true, intro:extra,
    fields:DECISION_FORM().concat([
      { type:'heading', label:'確定するときに記入する' },
      { key:'cooled', type:'checkbox', label:'落ち着いた状態で見直した', full:true,
        checkLabel:'時間を置いて、落ち着いた状態でもう一度この件を見直した' },
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
      body:'<div class="alert bad"><span class="ic">!</span><div><div class="t">防波堤が働いています</div>'+
           '<div class="d">'+chk.reasons.map(function(r){return esc(r);}).join('<br>')+'</div></div></div>'+
           '<div class="help-block" style="margin-top:12px;">'+
           'いま確定したくなる気持ちそのものが、この仕組みが止めようとしているものです。'+
           '「今すぐ決めない損失」と「衝動的に決める損失」を両方書き出し、反対意見を1人から聞いてから、もう一度開いてください。</div>',
      foot:'<button class="btn" data-modal-close>閉じる</button>'+
           '<button class="btn danger" data-act="decForce" data-id="'+esc(rec.id)+'">ルールを破って確定する（記録に残ります）</button>'
    });
    return;
  }
  confirmDialog('決裁を確定する',
    '件名：'+rec.title+'\n\n冷却期間と反対意見の確認は完了しています。確定して記録に残しますか？',
    function(){
      rec.stage='decided'; rec.decidedAt=nowIso(); rec.heldOk=true;
      DB.save(); render(); toast('確定しました','ok');
    }, '確定する');
});

action('decForce', function(ds){
  var rec = byId(DB.data.decisions, ds.id); if(!rec) return;
  closeModal();
  confirmDialog('ルールを破って確定します',
    'この確定は「冷却期間を守らずに確定した決裁」として記録され、健全度診断の数値に反映されます。\n\n'+
    '緊急でどうしても必要な場合だけにしてください。',
    function(){
      rec.stage='decided'; rec.decidedAt=nowIso(); rec.heldOk=false;
      DB.save(); render(); toast('記録しました（ルール外の確定）','bad');
    }, 'それでも確定する');
});

action('decDrop', function(ds){
  var rec = byId(DB.data.decisions, ds.id); if(!rec) return;
  rec.stage='dropped'; rec.decidedAt=nowIso();
  DB.save(); render(); toast('見送りとして記録しました','ok');
});

action('decDel', function(ds){
  confirmDialog('削除', 'この決裁の記録を削除します。よろしいですか？', function(){
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
  var rows = [['種別','件名','分類','持ち上がった日時','登録時の状態','冷却期間の遵守','段階',
               '反対意見役','反対意見','今すぐ決めない損失','衝動的に決める損失','決めた内容','理由','見直し日']];
  sortBy(DB.data.decisions, function(x){ return x.raisedAt||x.createdAt; }).forEach(function(r){
    rows.push(['重大決裁', r.title, decisionKind(r.kind).label, fmtJp(r.raisedAt), emotionOf(r.emotion).label,
      r.stage==='decided' ? (r.heldOk?'守って確定':'守らず確定') : '',
      (DECISION_STAGES.filter(function(x){return x.key===(r.stage||'draft');})[0]||{}).label,
      r.devilName, r.devilNote, r.lossNow, r.lossWait, r.decision, r.reason, r.review]);
  });
  var vrows = [['案件名','思いついた日時','記入率','目的','期待利益','必要資源','失敗条件','撤退条件','責任者','資源上限','状態','審査で出た意見','結果']];
  sortBy(DB.data.ventures, function(x){ return x.raisedAt||x.createdAt; }).forEach(function(r){
    vrows.push([r.title, fmtJp(r.raisedAt), ventureFill(r).rate+'%', r.purpose, r.gain, r.resource,
      r.failCond, r.exitCond, r.ownerName, r.cap, r.stage||'draft', r.reviewNote, r.result]);
  });
  downloadCsv('重大決裁_'+todayStr()+'.csv', rows);
  setTimeout(function(){ downloadCsv('新規案件の企画書_'+todayStr()+'.csv', vrows); }, 300);
  toast('CSVを書き出しました','ok');
});

action('venDel', function(ds){
  confirmDialog('削除', 'この企画書を削除します。よろしいですか？', function(){
    DB.data.ventures = DB.data.ventures.filter(function(x){ return x.id!==ds.id; });
    DB.save(); render(); toast('削除しました','ok');
  }, '削除する');
});
