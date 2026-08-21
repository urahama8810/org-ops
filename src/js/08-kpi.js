/* ============================================================
   08-kpi.js  週次KPI会議
   ============================================================ */

var kpiSel = { weekId:null };

function currentKpiWeek(){
  var d = DB.data;
  if(kpiSel.weekId){ var w = byId(d.kpiWeeks, kpiSel.weekId); if(w) return w; }
  return latestKpiWeek();
}

VIEWS.kpi = {
  title:'週次KPI会議',
  desc:'Week 3〜5／シート4。45分以内。活動報告会にせず、目標との差がある項目だけを扱います。',
  render:function(){
    var d = DB.data;
    var h = '';

    h += '<div class="help-block">'+
      '<b>会議の型（45分）：</b> '+MEETING_AGENDA.map(function(a){ return a.min+'分 '+a.label; }).join(' → ')+'。'+
      ' 未達項目には必ず<b>「対策・担当者・期限」</b>をその場で決めます。決まらない議題は次回に持ち越さず、経営判断事項として記録します。</div>';

    var weeks = sortBy(d.kpiWeeks, function(w){ return w.weekOf; }).reverse();
    var w = currentKpiWeek();

    /* 操作バー */
    var opts = weeks.map(function(x){
      return '<option value="'+esc(x.id)+'"'+(w&&x.id===w.id?' selected':'')+'>'+esc(x.weekOf)+' の週'+
             (x.closedAt?'（記録済）':'')+'</option>';
    }).join('');
    h += '<div class="card"><div class="card-body" style="padding:12px 16px;"><div class="inline-form">'+
      '<button class="btn primary" data-act="kpiNewWeek">＋ 今週の会議を作成</button>'+
      (weeks.length?'<label>表示する週</label><select data-change="kpiSelWeek">'+opts+'</select>':'')+
      (w?'<button class="btn" data-act="kpiMeetingMode" data-id="'+w.id+'">▶ 会議モード（45分タイマー）</button>':'')+
      '<span style="flex:1"></span>'+
      (w?'<button class="btn" data-act="kpiCsv" data-id="'+w.id+'">CSV</button>'+
         '<button class="btn" data-act="kpiPrint" data-id="'+w.id+'">議事記録を印刷</button>':'')+
      '</div></div></div>';

    if(!w){
      h += card('週次KPI会議','<div class="empty"><div class="big">まだ会議の記録がありません</div>'+
        '<div>「＋ 今週の会議を作成」を押すと、会社目標・部門目標・社員KPIから指標を取り込んで表を作ります。</div>'+
        '<div class="btn-row" style="justify-content:center;margin-top:10px;">'+
        '<button class="btn primary" data-act="kpiNewWeek">今週の会議を作成</button></div></div>',{tight:true});
      return h;
    }

    /* サマリー */
    var s = kpiWeekSummary(w);
    h += '<div class="grid c4" style="margin-bottom:18px;">'+
      tile('達成', s.ok+'<small>/'+s.total+'</small>', '', 'ok')+
      tile('注意（目標の9割以上）', s.watch+'', '', 'warn')+
      tile('未達', s.ng+'', '', s.ng?'bad':'')+
      tile('対策が未確定', s.unresolved+'', s.unresolved?'対策・担当者・期限のいずれかが空欄':'すべて確定済み', s.unresolved?'bad':'ok')+
      '</div>';

    /* KPI表 */
    var cols = [
      { label:'指標', width:'190px', render:function(r){
          return '<b>'+esc(r.indicator)+'</b>'+(r.owner?'':'')+
            (r.source?'<div class="small muted">'+esc(r.source)+'</div>':''); } },
      { label:'目標', cls:'num', width:'90px', render:function(r){ return esc(r.target); } },
      { label:'実績', cls:'num', width:'110px', render:function(r){
          return '<input type="number" step="any" value="'+esc(r.actual)+'" data-change="kpiActual" '+
                 'data-w="'+w.id+'" data-r="'+r.id+'" style="text-align:right;padding:4px 6px;">'; } },
      { label:'差', cls:'num', width:'70px', render:function(r){
          var g = kpiGap(r); if(g==='') return '<span class="muted">—</span>';
          var st = kpiRowStatus(r);
          return '<span class="mono" style="color:'+(st==='ok'?'var(--ok)':st==='ng'?'var(--bad)':'var(--warn)')+'">'+g+'</span>'; } },
      { label:'状態', width:'70px', render:function(r){
          var st = kpiRowStatus(r);
          var k = KPI_STATUS.filter(function(x){return x.key===st;})[0];
          return badge(k.label, k.cls); } },
      { label:'原因', render:function(r){
          var st = kpiRowStatus(r);
          if(st==='ok'||st==='none') return '<span class="muted small">—</span>';
          return r.cause ? '<span class="small">'+esc(r.cause)+'</span>' : badge('未記入','warn'); } },
      { label:'対策', render:function(r){
          var st = kpiRowStatus(r);
          if(st==='ok'||st==='none') return '<span class="muted small">—</span>';
          return r.action ? '<span class="small">'+esc(r.action)+'</span>' : badge('未記入','bad'); } },
      { label:'責任者', width:'100px', render:function(r){
          return r.owner ? esc(empName(r.owner)) : '<span class="muted small">—</span>'; } },
      { label:'期限', width:'110px', render:function(r){
          if(!r.due) return '<span class="muted small">—</span>';
          var over = !r.doneAt && r.due < todayStr();
          return '<span class="'+(over?'badge bad':'small')+'">'+esc(r.due)+'</span>'+
                 (r.doneAt?'<div class="small" style="color:var(--ok);">完了</div>':''); } },
      { label:'', cls:'actions', width:'190px', render:function(r){
          /* 「削除」は押し間違えると入力内容ごと消えるので、少し離して置く */
          return btn('入力','kpiRowEdit',{w:w.id,r:r.id})+' '+
                 (r.doneAt?btn('完了解除','kpiRowUndone',{w:w.id,r:r.id}):btn('対策完了','kpiRowDone',{w:w.id,r:r.id}))+
                 '<span class="sep-x"></span>'+
                 btn('削除','kpiRowDel',{w:w.id,r:r.id},'danger'); } }
    ];
    h += card(w.weekOf+' の週　KPI表', tableHtml(cols, w.rows, {
        emptyTitle:'指標が登録されていません',
        emptyText:'「＋ 指標を追加」または「目標から取り込む」で行を作ります。'
      }), {
      tight:true,
      sub:'列：指標 / 目標 / 実績 / 差 / 状態 / 原因 / 対策 / 責任者 / 期限',
      tools: btn('＋ 指標を追加','kpiRowNew',{w:w.id})+' '+
             btn('目標から取り込む','kpiImport',{w:w.id})+' '+
             btn('前週からコピー','kpiCopyPrev',{w:w.id})
    });

    /* 議事記録 */
    var mh = '<div class="grid c2">'+
      '<div><div class="small muted">経営判断事項（第7章 最後の5分）</div>'+
        '<div style="min-height:60px;padding:8px 0;">'+(nl2br(w.ceoDecisions)||'<span class="muted">未記入</span>')+'</div></div>'+
      '<div><div class="small muted">次回の確認事項</div>'+
        '<div style="min-height:60px;padding:8px 0;">'+(nl2br(w.nextCheck)||'<span class="muted">未記入</span>')+'</div></div>'+
      '</div>'+
      '<div class="sep"></div>'+
      '<div class="small muted">出席者</div><div>'+(esc(w.attendees)||'<span class="muted">未記入</span>')+'</div>'+
      (w.minutes?'<div class="sep"></div><div class="small muted">その他メモ</div><div>'+nl2br(w.minutes)+'</div>':'');
    h += card('議事記録', mh, { tools: btn('議事記録を編集','kpiMinutes',{w:w.id}) });

    /* 未完了の対策（横断） */
    var open = [];
    d.kpiWeeks.forEach(function(x){
      x.rows.forEach(function(r){
        if(r.action && !r.doneAt) open.push({ week:x.weekOf, wid:x.id, r:r });
      });
    });
    open = sortBy(open, function(o){ return o.r.due || '9999'; });
    if(open.length){
      h += card('未完了の対策（全週）', tableHtml([
        {label:'週', width:'100px', render:function(o){ return esc(o.week); }},
        {label:'指標', render:function(o){ return esc(o.r.indicator); }},
        {label:'対策', render:function(o){ return '<span class="small">'+esc(o.r.action)+'</span>'; }},
        {label:'責任者', width:'100px', render:function(o){ return o.r.owner?esc(empName(o.r.owner)):badge('未定','bad'); }},
        {label:'期限', width:'110px', render:function(o){
          if(!o.r.due) return badge('未定','bad');
          return o.r.due < todayStr() ? badge(o.r.due+' 超過','bad') : esc(o.r.due); }},
        {label:'', cls:'actions', render:function(o){ return btn('完了','kpiRowDone',{w:o.wid,r:o.r.id}); }}
      ], open, {}), {tight:true, sub:open.length+'件'});
    }
    return h;
  }
};

/* ---------- 週の作成 ---------- */
action('kpiNewWeek', function(){
  var mon = weekMonday();
  if(DB.data.kpiWeeks.some(function(w){ return w.weekOf === mon; })){
    var ex = DB.data.kpiWeeks.filter(function(w){ return w.weekOf===mon; })[0];
    kpiSel.weekId = ex.id; render();
    toast('今週（'+mon+'）の会議は既に作成されています','');
    return;
  }
  var prev = latestKpiWeek();
  var w = { id:uid('wk'), weekOf:mon, rows:[], attendees:'', ceoDecisions:'', nextCheck:'', minutes:'', createdAt:nowIso() };
  if(prev){
    /* 前週の指標をコピー（実績・原因・対策はクリア） */
    w.rows = prev.rows.map(function(r){
      return { id:uid('row'), indicator:r.indicator, target:r.target, actual:'', lowerIsBetter:r.lowerIsBetter,
               source:r.source, owner:r.owner, cause:'', action:'', due:'', goalId:r.goalId };
    });
    w.attendees = prev.attendees;
  }else{
    w.rows = importGoalRows();
  }
  DB.data.kpiWeeks.push(w); kpiSel.weekId = w.id; DB.save(); render();
  toast(mon+' の週の会議を作成しました（指標'+w.rows.length+'件）','ok');
});

function importGoalRows(){
  var rows = [];
  DB.data.goals.forEach(function(g){
    rows.push({ id:uid('row'), indicator:g.metric+(g.level==='dept'&&g.dept?'（'+g.dept+'）':''),
      target:g.target90, actual:'', lowerIsBetter:!!g.lowerIsBetter, source:g.dataSource,
      owner:g.owner, cause:'', action:'', due:'', goalId:g.id });
  });
  return rows;
}

action('kpiImport', function(ds){
  var w = byId(DB.data.kpiWeeks, ds.w); if(!w) return;
  var d = DB.data;
  var candidates = [];
  d.goals.forEach(function(g){
    candidates.push({ key:'goal_'+g.id, label:'【目標】'+g.metric+(g.dept?'（'+g.dept+'）':''),
      indicator:g.metric+(g.level==='dept'&&g.dept?'（'+g.dept+'）':''), target:g.target90,
      lowerIsBetter:!!g.lowerIsBetter, source:g.dataSource, owner:g.owner, goalId:g.id });
  });
  d.employees.forEach(function(e){
    lines(e.kpis).forEach(function(k, i){
      candidates.push({ key:'emp_'+e.id+'_'+i, label:'【'+e.name+'】'+k,
        indicator:k+'（'+e.name+'）', target:'', lowerIsBetter:false, source:e.dataSource, owner:e.id });
    });
  });
  if(!candidates.length){ toast('取り込める指標がありません。先に目標または社員KPIを登録してください。','bad'); return; }
  var exists = {};
  w.rows.forEach(function(r){ exists[r.indicator] = 1; });

  var body = '<div class="help-block">会社目標・部門目標・社員KPIから、今週の会議で扱う指標を選びます。'+
    '<b>すべてを毎週扱う必要はありません。</b>目標との差が出やすいものを中心に選んでください。</div>'+
    '<div style="max-height:380px;overflow:auto;border:1px solid var(--border);border-radius:8px;padding:8px 12px;">'+
    candidates.map(function(c,i){
      return '<label class="chk"><input type="checkbox" data-i="'+i+'"'+(exists[c.indicator]?' disabled':'')+'>'+
        '<span>'+esc(c.label)+(exists[c.indicator]?' <span class="badge neutral">追加済み</span>':'')+
        (c.target!==''&&c.target!==undefined?' <span class="small muted">目標 '+esc(c.target)+'</span>':'')+'</span></label>';
    }).join('')+'</div>';
  openModal({
    title:'目標・KPIから取り込む', wide:true, body:body,
    foot:'<button class="btn" data-modal-close>キャンセル</button><button class="btn primary" id="impOk">取り込む</button>',
    onMount:function(root){
      root.querySelector('#impOk').addEventListener('click', function(){
        var n = 0;
        root.querySelectorAll('input[type=checkbox]:checked').forEach(function(cb){
          var c = candidates[num(cb.dataset.i)];
          w.rows.push({ id:uid('row'), indicator:c.indicator, target:c.target, actual:'',
            lowerIsBetter:c.lowerIsBetter, source:c.source, owner:c.owner, cause:'', action:'', due:'', goalId:c.goalId });
          n++;
        });
        DB.save(); closeModal(); render(); toast(n+'件を取り込みました','ok');
      });
    }
  });
});

action('kpiCopyPrev', function(ds){
  var w = byId(DB.data.kpiWeeks, ds.w); if(!w) return;
  var sorted = sortBy(DB.data.kpiWeeks, function(x){ return x.weekOf; });
  var idx = sorted.indexOf(w);
  if(idx <= 0){ toast('前週の記録がありません','bad'); return; }
  var prev = sorted[idx-1];
  var exists = {};
  w.rows.forEach(function(r){ exists[r.indicator] = 1; });
  var n = 0;
  prev.rows.forEach(function(r){
    if(exists[r.indicator]) return;
    w.rows.push({ id:uid('row'), indicator:r.indicator, target:r.target, actual:'', lowerIsBetter:r.lowerIsBetter,
      source:r.source, owner:r.owner, cause:'', action:'', due:'', goalId:r.goalId });
    n++;
  });
  DB.save(); render(); toast(n+'件を前週からコピーしました','ok');
});

/* ---------- 行の編集 ---------- */
function kpiRowFields(){
  return [
    { key:'indicator', label:'指標', required:true, full:true },
    { key:'target', label:'目標', type:'number', step:'any' },
    { key:'actual', label:'実績', type:'number', step:'any' },
    { key:'lowerIsBetter', label:'小さいほど良い指標（CPA・解約率など）', type:'checkbox', full:true },
    { key:'source', label:'正とするデータ', full:true },
    { type:'heading', label:'差がある場合（未達・異常値）' },
    { key:'cause',  label:'原因', type:'textarea', rows:2, full:true,
      hint:'「頑張ります」ではなく、何が起きているかを書く。' },
    { key:'action', label:'対策', type:'textarea', rows:2, full:true,
      hint:'次の1週間で実行できる具体的な行動にする。' },
    { key:'owner',  label:'責任者', type:'select', options:empOptions(true) },
    { key:'due',    label:'期限', type:'date' }
  ];
}
action('kpiRowNew', function(ds){
  var w = byId(DB.data.kpiWeeks, ds.w); if(!w) return;
  openForm({ title:'指標を追加', wide:true, fields:kpiRowFields(), value:{target:'',actual:''},
    onSubmit:function(v){ v.id = uid('row'); w.rows.push(v); DB.save(); render(); toast('追加しました','ok'); } });
});
action('kpiRowEdit', function(ds){
  var w = byId(DB.data.kpiWeeks, ds.w); if(!w) return;
  var r = byId(w.rows, ds.r); if(!r) return;
  var st = kpiRowStatus(r);
  openForm({ title:'指標の入力：'+r.indicator, wide:true, fields:kpiRowFields(), value:r,
    intro: (st==='ng'||st==='watch') ?
      '<b>目標との差があります。</b> 原因・対策・責任者・期限をこの場で決めてください。' :
      '実績を入力すると、状態が自動判定されます。',
    onSubmit:function(v){
      v.id = r.id; v.doneAt = r.doneAt; v.goalId = r.goalId;
      w.rows[w.rows.indexOf(r)] = v; DB.save(); render(); toast('保存しました','ok');
    } });
});
action('kpiRowDel', function(ds){
  var w = byId(DB.data.kpiWeeks, ds.w); if(!w) return;
  var r = byId(w.rows, ds.r); if(!r) return;
  confirmDialog('この指標を表から外す',
    '「'+(r?r.indicator:'')+'」をこの週の表から外します。\n入力済みの原因・対策・担当者・期限も一緒に消えます。',
    function(){
      w.rows = w.rows.filter(function(x){ return x.id !== ds.r; });
      DB.save(); render(); toast('表から外しました','ok');
    }, '外す');
});
action('kpiRowDone', function(ds){
  var w = byId(DB.data.kpiWeeks, ds.w); if(!w) return;
  var r = byId(w.rows, ds.r); if(!r) return;
  r.doneAt = todayStr(); DB.save(); render(); toast('対策を完了にしました','ok');
});
action('kpiRowUndone', function(ds){
  var w = byId(DB.data.kpiWeeks, ds.w); if(!w) return;
  var r = byId(w.rows, ds.r); if(!r) return;
  r.doneAt = ''; DB.save(); render();
});
action('kpiActual', function(ds, el){
  var w = byId(DB.data.kpiWeeks, ds.w); if(!w) return;
  var r = byId(w.rows, ds.r); if(!r) return;
  r.actual = el.value === '' ? '' : num(el.value);
  DB.save();
  /* 画面全体を描き直すと入力中の欄から離れてしまうので、その行だけ書き換える */
  var tr = el.closest ? el.closest('tr') : null;
  if(tr){
    var st = kpiRowStatus(r);
    var kk = KPI_STATUS.filter(function(x){ return x.key===st; })[0];
    var tds = tr.querySelectorAll('td');
    if(tds.length >= 5){
      var g = kpiGap(r);
      tds[3].innerHTML = g==='' ? '<span class="muted">—</span>'
        : '<span class="mono" style="color:'+(st==='ok'?'var(--ok)':st==='ng'?'var(--bad)':'var(--warn)')+'">'+g+'</span>';
      tds[4].innerHTML = '<span class="badge '+kk.cls+'">'+kk.label+'</span>';
    }
  }else{
    render();
  }
});
action('kpiSelWeek', function(ds, el){ kpiSel.weekId = el.value; render(); });

action('kpiMinutes', function(ds){
  var w = byId(DB.data.kpiWeeks, ds.w); if(!w) return;
  openForm({ title:'議事記録：'+w.weekOf+' の週', wide:true,
    fields:[
      { key:'attendees', label:'出席者', full:true },
      { key:'ceoDecisions', label:'経営判断事項', type:'textarea', rows:4, full:true,
        hint:'その場で決まらず、経営層の判断を待つ件を書きます。口頭で終わらせず、ここに残します。' },
      { key:'nextCheck', label:'次回の確認事項', type:'textarea', rows:3, full:true },
      { key:'minutes', label:'その他メモ', type:'textarea', rows:3, full:true }
    ],
    value:w,
    onSubmit:function(v){
      w.attendees = v.attendees; w.ceoDecisions = v.ceoDecisions;
      w.nextCheck = v.nextCheck; w.minutes = v.minutes;
      DB.save(); render(); toast('保存しました','ok');
    }
  });
});

/* ---------- 会議モード（45分タイマー） ---------- */
var meetingTimer = null;
action('kpiMeetingMode', function(ds){
  var w = byId(DB.data.kpiWeeks, ds.w); if(!w) return;
  var stepIndex = 0, elapsed = 0, running = false;

  function stepHtml(){
    return MEETING_AGENDA.map(function(a,i){
      return '<div class="step '+(i===stepIndex?'active':(i<stepIndex?'done':''))+'">'+
        '<b>'+a.min+'分　'+esc(a.label)+'</b><span class="small muted">'+esc(a.hint)+'</span></div>';
    }).join('');
  }
  function focusRows(){
    var rows = w.rows.filter(function(r){ var s=kpiRowStatus(r); return s==='ng'||s==='watch'; });
    if(!rows.length) return '<div class="alert ok"><span class="ic">'+ic('check',15)+'</span><div class="body"><div class="t">目標との差がある項目はありません</div>'+
      '<div class="d">会議は短く終えて構いません。活動報告会にしないこと。</div></div></div>';
    return tableHtml([
      {label:'指標', render:function(r){ return '<b>'+esc(r.indicator)+'</b>'; }},
      {label:'目標', cls:'num', render:function(r){ return esc(r.target); }},
      {label:'実績', cls:'num', render:function(r){ return esc(r.actual); }},
      {label:'差', cls:'num', render:function(r){ return kpiGap(r); }},
      {label:'原因', render:function(r){ return r.cause?'<span class="small">'+esc(r.cause)+'</span>':badge('未記入','warn'); }},
      {label:'対策・担当・期限', render:function(r){
        if(!r.action) return badge('未確定','bad');
        return '<span class="small">'+esc(r.action)+'</span><div class="small muted">'+
               esc(r.owner?empName(r.owner):'担当未定')+' / '+esc(r.due||'期限未定')+'</div>'; }},
      {label:'', cls:'actions', render:function(r){ return btn('入力','kpiMeetRowEdit',{w:w.id,r:r.id}); }}
    ], rows, {});
  }
  function bodyHtml(){
    var total = MEETING_AGENDA.reduce(function(s,a){ return s+a.min; },0)*60;
    var remain = total - elapsed;
    var mm = Math.floor(Math.abs(remain)/60), ss = Math.abs(remain)%60;
    var stepEnd = 0;
    for(var i=0;i<=stepIndex;i++) stepEnd += MEETING_AGENDA[i].min*60;
    var stepRemain = stepEnd - elapsed;
    return '<div class="timer-box" style="margin-bottom:14px;">'+
      '<div class="timer '+(remain<0?'over':'')+'">'+(remain<0?'-':'')+('0'+mm).slice(-2)+':'+('0'+ss).slice(-2)+'</div>'+
      '<div><div class="small muted">全体45分の残り時間</div>'+
        '<div class="small">現在：<b>'+esc(MEETING_AGENDA[stepIndex].label)+'</b>（この項目の残り '+
        (stepRemain<0?'超過 ':'')+Math.floor(Math.abs(stepRemain)/60)+'分'+(Math.abs(stepRemain)%60)+'秒）</div></div>'+
      '<span style="flex:1"></span>'+
      '<div class="btn-row">'+
        '<button class="btn primary" id="mtRun">'+(running?'一時停止':'開始')+'</button>'+
        '<button class="btn" id="mtNext">次の項目へ</button>'+
        '<button class="btn" id="mtReset">リセット</button>'+
      '</div></div>'+
      '<div class="agenda" style="margin-bottom:14px;">'+stepHtml()+'</div>'+
      '<div class="small muted" style="margin-bottom:6px;">目標との差がある項目（ここだけを扱う）</div>'+
      focusRows()+
      '<div class="sep"></div>'+
      '<div class="form-grid">'+
        '<div class="field full"><label>経営判断事項</label><textarea id="mtCeo" rows="3">'+esc(w.ceoDecisions||'')+'</textarea></div>'+
        '<div class="field full"><label>次回の確認事項</label><textarea id="mtNextCheck" rows="2">'+esc(w.nextCheck||'')+'</textarea></div>'+
      '</div>';
  }
  openModal({
    title:'会議モード：'+w.weekOf+' の週', wide:true, body:bodyHtml(),
    foot:'<span class="left small muted">45分を過ぎたら、残りは持ち帰らず経営判断事項として記録します。</span>'+
         '<button class="btn" id="mtClose">閉じる</button>'+
         '<button class="btn primary" id="mtSave">記録して終了</button>',
    onMount:function(root){ bind(root); }
  });
  function bind(root){
    var body = root.querySelector('.modal-body');
    root.querySelector('#mtRun').onclick = function(){
      running = !running;
      if(running){
        meetingTimer = setInterval(function(){
          elapsed++;
          var acc = 0, si = 0;
          for(var i=0;i<MEETING_AGENDA.length;i++){ acc += MEETING_AGENDA[i].min*60; if(elapsed < acc){ si = i; break; } si = i; }
          stepIndex = si;
          redraw();
        }, 1000);
      }else{ clearInterval(meetingTimer); meetingTimer = null; }
      redraw();
    };
    root.querySelector('#mtNext').onclick = function(){
      if(stepIndex < MEETING_AGENDA.length-1){
        stepIndex++;
        var acc = 0; for(var i=0;i<stepIndex;i++) acc += MEETING_AGENDA[i].min*60;
        elapsed = Math.max(elapsed, acc);
        redraw();
      }
    };
    root.querySelector('#mtReset').onclick = function(){
      clearInterval(meetingTimer); meetingTimer = null; running = false; elapsed = 0; stepIndex = 0; redraw();
    };
    root.querySelector('#mtClose').onclick = function(){ clearInterval(meetingTimer); meetingTimer=null; closeModal(); };
    root.querySelector('#mtSave').onclick = function(){
      w.ceoDecisions = body.querySelector('#mtCeo').value;
      w.nextCheck = body.querySelector('#mtNextCheck').value;
      w.closedAt = nowIso();
      clearInterval(meetingTimer); meetingTimer = null;
      DB.save(); closeModal(); render(); toast('会議を記録しました','ok');
    };
    function redraw(){
      var ceo = body.querySelector('#mtCeo').value, nc = body.querySelector('#mtNextCheck').value;
      w.ceoDecisions = ceo; w.nextCheck = nc;
      body.innerHTML = bodyHtml();
      bind(root);
    }
    root._redraw = redraw;   /* 行の編集後に会議モードを描き直すため */
  }
});
action('kpiMeetRowEdit', function(ds){
  /* 会議モード中の行編集：保存後に会議モードを描き直す */
  var w = byId(DB.data.kpiWeeks, ds.w); if(!w) return;
  var r = byId(w.rows, ds.r); if(!r) return;
  var top = _modalStack[_modalStack.length-1];
  openForm({ title:'原因・対策の入力：'+r.indicator, wide:true, fields:kpiRowFields(), value:r,
    intro:'<b>その場で決めます。</b>対策・責任者・期限のいずれかが空欄のまま会議を終えないでください。',
    onSubmit:function(v){
      v.id = r.id; v.doneAt = r.doneAt; v.goalId = r.goalId;
      w.rows[w.rows.indexOf(r)] = v; DB.save();
      if(top && top._redraw) top._redraw();
    }
  });
});

/* ---------- 出力 ---------- */
action('kpiCsv', function(ds){
  var w = byId(DB.data.kpiWeeks, ds.id); if(!w) return;
  var rows = [['週','指標','目標','実績','差','状態','原因','対策','責任者','期限','完了日']];
  w.rows.forEach(function(r){
    var st = kpiRowStatus(r);
    var k = KPI_STATUS.filter(function(x){return x.key===st;})[0];
    rows.push([w.weekOf, r.indicator, r.target, r.actual, kpiGap(r), k.label, r.cause, r.action,
      r.owner?empName(r.owner):'', r.due, r.doneAt]);
  });
  downloadCsv('週次KPI_'+w.weekOf+'.csv', rows);
  toast('CSVを書き出しました','ok');
});

action('kpiPrint', function(ds){
  var w = byId(DB.data.kpiWeeks, ds.id); if(!w) return;
  var cols = [
    {label:'指標', render:function(r){ return esc(r.indicator); }},
    {label:'目標', cls:'num', render:function(r){ return esc(r.target); }},
    {label:'実績', cls:'num', render:function(r){ return esc(r.actual); }},
    {label:'差', cls:'num', render:function(r){ return kpiGap(r); }},
    {label:'状態', render:function(r){ var k=KPI_STATUS.filter(function(x){return x.key===kpiRowStatus(r);})[0]; return k.label; }},
    {label:'原因', render:function(r){ return esc(r.cause); }},
    {label:'対策', render:function(r){ return esc(r.action); }},
    {label:'責任者', render:function(r){ return r.owner?esc(empName(r.owner)):''; }},
    {label:'期限', render:function(r){ return esc(r.due); }}
  ];
  printHtml('週次KPI会議 '+w.weekOf,
    '<div class="card"><div class="card-head"><h2>週次KPI会議　'+esc(w.weekOf)+' の週</h2></div>'+
    '<div class="card-body">'+
      '<div class="small">出席者：'+esc(w.attendees||'—')+'</div><div class="sep"></div>'+
      tableHtml(cols, w.rows, {})+
      '<div class="sep"></div><dl class="kv">'+
      '<dt>経営判断事項</dt><dd>'+(nl2br(w.ceoDecisions)||'—')+'</dd>'+
      '<dt>次回の確認事項</dt><dd>'+(nl2br(w.nextCheck)||'—')+'</dd>'+
      '<dt>その他メモ</dt><dd>'+(nl2br(w.minutes)||'—')+'</dd></dl>'+
    '</div></div>');
});
