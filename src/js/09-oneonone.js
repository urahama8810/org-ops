/* ============================================================
   09-oneonone.js  月次1on1
   ============================================================ */

var oooSel = { month: monthStr() };

function prevMonth(m){
  /* 記録が壊れていて月の形でないことがあるので、その場合は今月の前月を返す */
  var s = String(m || '');
  if(!/^\d{4}-\d{2}$/.test(s)) s = monthStr();
  var y = num(s.split('-')[0]), mo = num(s.split('-')[1]);
  mo--; if(mo === 0){ mo = 12; y--; }
  return y+'-'+('0'+mo).slice(-2);
}

VIEWS.oneonone = {
  title:'月次1on1',
  desc:'Week 4〜6／シート5。直属上司が月1回30分。性格評価ではなく、期限・行動・結果・影響・次回の約束を記録します。',
  render:function(){
    var d = DB.data;
    var month = oooSel.month;
    var h = '';

    h += '<div class="help-block">'+
      '<b>1on1で扱うこと：</b> ①目標と実績 ②うまくいったこと ③問題 ④具体的なフィードバック ⑤必要な支援 ⑥翌月の約束。<br>'+
      '<b>やらないこと：</b> 性格・人柄の評価、説教、雑談だけで終えること。記録は「期限・行動・結果・影響・次回の約束」で書きます。</div>';

    /* 月選択 */
    var months = uniq(d.oneOnOnes.map(function(o){ return o.month; }).concat([monthStr(), month]));
    months = sortBy(months, function(x){ return x; }).reverse();
    var opts = months.map(function(m){ return '<option value="'+esc(m)+'"'+(m===month?' selected':'')+'>'+esc(m)+'</option>'; }).join('');
    h += '<div class="card"><div class="card-body" style="padding:12px 16px;"><div class="inline-form">'+
      '<label>対象月</label><select data-change="oooMonth">'+opts+'</select>'+
      '<button class="btn primary" data-act="oooNew">＋ 1on1を記録</button>'+
      '<span style="flex:1"></span>'+
      '<button class="btn" data-act="oooCsv">CSVで書き出す</button>'+
      '<button class="btn" data-act="oooSheet">記入シートを印刷</button>'+
      '</div></div></div>';

    /* 実施状況 */
    var rate = oneOnOneRate(month);
    h += '<div class="grid c3" style="margin-bottom:18px;">'+
      tile('実施率（'+month+'）', rate.rate+'<small>%</small>', rate.done+' / '+rate.total+' 名',
           rate.rate>=90?'ok':rate.rate>=50?'warn':'bad')+
      tile('未実施', rate.missing.length+'<small>名</small>',
           rate.missing.slice(0,4).map(function(e){return esc(e.name);}).join('、')+(rate.missing.length>4?' ほか':''),
           rate.missing.length?'warn':'ok')+
      tile('未完了の約束', (function(){
          var n = 0; d.oneOnOnes.forEach(function(o){ (o.promises||[]).forEach(function(p){ if(!p.done) n++; }); });
          return n+'<small>件</small>'; })(), '次回の1on1で必ず結果を確認する', '')+
      '</div>';

    /* 社員別の実施表 */
    var targets = sortBy(d.employees.filter(function(e){ return e.manager; }), function(e){
      return (empName(e.manager))+'_'+e.name; });
    var cols = [
      { label:'社員', width:'150px', render:function(e){
          return '<b>'+esc(e.name)+'</b><div class="small muted">'+esc(e.dept||'')+'</div>'; } },
      { label:'直属上司', width:'120px', render:function(e){ return esc(empName(e.manager)); } },
      { label:'今月', width:'110px', render:function(e){
          var r = oneOnOneStatusOf(e.id, month);
          return r ? badge('実施 '+(r.date||''),'ok') : badge('未実施','bad'); } },
      { label:'前回の内容', render:function(e){
          var r = oneOnOneStatusOf(e.id, month) || oneOnOneStatusOf(e.id, prevMonth(month));
          if(!r) return '<span class="muted small">記録なし</span>';
          return '<span class="small">'+esc((r.feedback||r.wins||r.issues||'').slice(0,60))+'</span>'; } },
      { label:'約束', width:'150px', render:function(e){
          var recs = d.oneOnOnes.filter(function(o){ return o.employeeId===e.id; });
          var open = [];
          recs.forEach(function(o){ (o.promises||[]).forEach(function(p){ if(!p.done) open.push(p); }); });
          if(!open.length) return '<span class="muted small">—</span>';
          return badge(open.length+'件 未完了','warn')+'<div class="small muted">'+esc(open[0].text||'').slice(0,26)+'</div>'; } },
      { label:'', cls:'actions', width:'160px', render:function(e){
          var r = oneOnOneStatusOf(e.id, month);
          return (r ? btn('記録を開く','oooEdit',{id:r.id}) : btn('1on1を記録','oooNewFor',{emp:e.id},'primary'))+' '+
                 btn('履歴','oooHistory',{emp:e.id}); } }
    ];
    h += card(month+' の実施状況', tableHtml(cols, targets, {
      emptyTitle:'対象者がいません',
      emptyText:'社員台帳で直属上司を設定すると、ここに表示されます。'
    }), {tight:true});

    /* 当月の記録一覧 */
    var recs = sortBy(d.oneOnOnes.filter(function(o){ return o.month === month; }), function(o){ return o.date; });
    if(recs.length){
      var h2 = '';
      recs.forEach(function(o){
        h2 += '<div style="border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:10px;background:var(--surface);">'+
          '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">'+
            '<b>'+esc(empName(o.employeeId))+'</b>'+
            '<span class="small muted">'+esc(o.date||'')+' ／ 上司：'+esc(empName(o.managerId))+'</span>'+
            '<span style="flex:1"></span>'+
            btn('編集','oooEdit',{id:o.id})+' '+btn('印刷','oooPrint',{id:o.id})+' '+btn('削除','oooDel',{id:o.id},'danger')+
          '</div>'+
          '<div class="grid c2" style="margin-top:8px;gap:10px;">'+
            '<div><div class="small muted">目標と実績</div><div class="small">'+(nl2br(o.kpiReview)||'—')+'</div>'+
              '<div class="small muted" style="margin-top:6px;">うまくいったこと</div><div class="small">'+(nl2br(o.wins)||'—')+'</div></div>'+
            '<div><div class="small muted">問題</div><div class="small">'+(nl2br(o.issues)||'—')+'</div>'+
              '<div class="small muted" style="margin-top:6px;">フィードバック</div><div class="small">'+(nl2br(o.feedback)||'—')+'</div></div>'+
          '</div>'+
          (o.support?'<div class="small muted" style="margin-top:6px;">必要な支援</div><div class="small">'+nl2br(o.support)+'</div>':'')+
          renderPromises(o)+
        '</div>';
      });
      h += card(month+' の記録（'+recs.length+'件）', h2, {});
    }
    return h;
  }
};

function renderPromises(o){
  var ps = o.promises || [];
  if(!ps.length) return '';
  return '<div style="margin-top:8px;border-top:1px dashed var(--border);padding-top:8px;">'+
    '<div class="small muted">翌月の約束</div>'+
    ps.map(function(p,i){
      return '<label class="chk"><input type="checkbox" data-change="oooPromise" data-id="'+esc(o.id)+'" data-i="'+i+'"'+(p.done?' checked':'')+'>'+
        '<span class="small'+(p.done?' muted':'')+'" style="'+(p.done?'text-decoration:line-through;':'')+'">'+esc(p.text)+
        (p.due?' <span class="tag">'+esc(p.due)+'</span>':'')+'</span></label>';
    }).join('')+'</div>';
}

function oooFields(empId, month){
  var e = byId(DB.data.employees, empId);
  return [
    { key:'employeeId', label:'社員', type:'select', options:empOptions(true), required:true },
    { key:'managerId',  label:'直属上司', type:'select', options:empOptions(true), required:true },
    { key:'month',      label:'対象月', type:'month', required:true },
    { key:'date',       label:'実施日', type:'date', required:true },
    { type:'heading', label:'① 目標と実績' },
    { key:'kpiReview', label:'目標と実績', type:'textarea', rows:3, full:true,
      hint: e && lines(e.kpis).length ? '担当KPI：'+lines(e.kpis).join(' / ') : '数字で確認する。印象ではなく実績データを見る。' },
    { type:'heading', label:'② うまくいったこと ③ 問題' },
    { key:'wins',   label:'うまくいったこと', type:'textarea', rows:2, full:true, hint:'具体的な行動と、その結果・影響を書く。' },
    { key:'issues', label:'問題', type:'textarea', rows:2, full:true, hint:'人柄ではなく、期限・行動・結果の事実で書く。' },
    { type:'heading', label:'④ フィードバック ⑤ 必要な支援' },
    { key:'feedback', label:'具体的なフィードバック', type:'textarea', rows:3, full:true,
      hint:'「もっと頑張って」ではなく「◯◯を△△までに、□□の形で」と伝える。' },
    { key:'support',  label:'必要な支援', type:'textarea', rows:2, full:true,
      hint:'会社・上司が用意するもの（時間・人・情報・権限・道具）。' },
    { type:'heading', label:'⑥ 翌月の約束' },
    { key:'promiseText', label:'翌月の約束（1行に1つ）', type:'list', rows:4, full:true,
      hint:'次回の1on1で必ず結果を確認します。曖昧な約束は書かない。' },
    { key:'promiseDue', label:'約束の期限', type:'date' },
    { key:'nextDate',   label:'次回の予定日', type:'date' }
  ];
}

action('oooMonth', function(ds, el){ oooSel.month = el.value; render(); });

action('oooNew', function(){ openOooForm(null, ''); });
action('oooNewFor', function(ds){ openOooForm(null, ds.emp); });

function openOooForm(rec, empId){
  var month = oooSel.month;
  var e = byId(DB.data.employees, empId || (rec?rec.employeeId:''));
  var val = rec ? JSON.parse(JSON.stringify(rec)) : {
    employeeId: empId||'', managerId: e?e.manager:'', month:month, date:todayStr(),
    kpiReview:'', wins:'', issues:'', feedback:'', support:'', promiseText:[], promiseDue:'', nextDate:''
  };
  if(rec){
    val.promiseText = (rec.promises||[]).map(function(p){ return p.text; });
    /* 期限は約束の中に入っている。空欄で開くと、保存したときに全部消えてしまう */
    val.promiseDue = ((rec.promises||[]).filter(function(p){ return p && p.due; })[0]||{}).due || '';
  }

  /* 前回の約束を冒頭に表示 */
  var intro = '';
  if(e){
    var prev = sortBy(DB.data.oneOnOnes.filter(function(o){
      return o.employeeId===e.id && (!rec || o.id!==rec.id) && o.month < month; }), function(o){ return o.month; }).slice(-1)[0];
    if(prev && (prev.promises||[]).length){
      intro = '<b>前回（'+esc(prev.month)+'）の約束：</b><ul class="list-plain" style="margin:4px 0 0;">'+
        prev.promises.map(function(p){ return '<li>'+(p.done?'✓ ':'□ ')+esc(p.text)+'</li>'; }).join('')+'</ul>'+
        '<div style="margin-top:4px;">まずこの結果を確認してから、今月の話に入ってください。</div>';
    }else{
      intro = '性格ではなく<b>期限・行動・結果・影響・次回の約束</b>を記録します。30分を目安に。';
    }
  }else{
    intro = '性格ではなく<b>期限・行動・結果・影響・次回の約束</b>を記録します。30分を目安に。';
  }

  openForm({
    title: rec ? '1on1記録の編集' : '1on1を記録', wide:true, intro:intro,
    fields: oooFields(val.employeeId, month), value: val,
    onSubmit:function(v){
      var openedDue = val.promiseDue;   /* 開いたときに期限欄へ入っていた値 */
      var promises = lines(v.promiseText).map(function(t, i){
        var old = rec && rec.promises && rec.promises[i];
        var same = old && old.text === t;
        /* 期限欄に触っていないなら、約束ごとの期限をそのまま残す */
        var keep = same && v.promiseDue === openedDue;
        return { text:t, due: keep ? (old.due || '') : v.promiseDue,
                 done: same ? old.done : false };
      });
      var obj = {
        id: rec ? rec.id : uid('ooo'),
        employeeId:v.employeeId, managerId:v.managerId, month:v.month, date:v.date,
        kpiReview:v.kpiReview, wins:v.wins, issues:v.issues, feedback:v.feedback, support:v.support,
        promises:promises, nextDate:v.nextDate
      };
      if(rec){
        if(!replaceById(DB.data.oneOnOnes, rec.id, obj)){ toast(RECORD_GONE,'bad'); return false; }
      }
      else DB.data.oneOnOnes.push(obj);
      DB.save(); render(); toast('記録しました','ok');
    }
  });
}

action('oooEdit', function(ds){
  var r = byId(DB.data.oneOnOnes, ds.id); if(!r) return;
  if(r) openOooForm(r, r.employeeId);
});
action('oooDel', function(ds){
  var r = byId(DB.data.oneOnOnes, ds.id); if(!r) return;
  confirmDialog('1on1記録の削除', empName(r.employeeId)+'さんの'+r.month+'の記録を削除します。よろしいですか？', function(){
    DB.data.oneOnOnes = DB.data.oneOnOnes.filter(function(x){ return x.id !== r.id; });
    DB.save(); render(); toast('削除しました','ok');
  }, '削除する');
});
action('oooPromise', function(ds, el){
  var r = byId(DB.data.oneOnOnes, ds.id); if(!r) return;
  r.promises[num(ds.i)].done = el.checked;
  DB.save(); render();
});

action('oooHistory', function(ds){
  var e = byId(DB.data.employees, ds.emp); if(!e) return;
  var recs = sortBy(DB.data.oneOnOnes.filter(function(o){ return o.employeeId === e.id; }), function(o){ return o.month; }).reverse();
  var body = recs.length ? recs.map(function(o){ return oooDetailHtml(o); }).join('<div class="sep"></div>') :
    '<div class="empty"><div class="big">記録がありません</div></div>';
  openModal({ title:e.name+'　1on1履歴', wide:true, body:body,
    headNote:recs.length+'件',
    foot:'<button class="btn left" data-act="oooHistPrint" data-emp="'+e.id+'">印刷</button>'+
         '<button class="btn" data-modal-close>閉じる</button>' });
});
action('oooHistPrint', function(ds){
  var e = byId(DB.data.employees, ds.emp); if(!e) return;
  var recs = sortBy(DB.data.oneOnOnes.filter(function(o){ return o.employeeId === e.id; }), function(o){ return o.month; }).reverse();
  printHtml(e.name+' 1on1履歴',
    '<div class="card"><div class="card-head"><h2>'+esc(e.name)+'　1on1履歴</h2></div><div class="card-body">'+
    (recs.map(function(o){ return oooDetailHtml(o); }).join('<div class="sep"></div>')||'記録なし')+'</div></div>');
});

function oooDetailHtml(o){
  return '<div><div style="display:flex;gap:10px;align-items:center;">'+
    '<b>'+esc(o.month)+'</b><span class="small muted">'+esc(o.date||'')+' ／ 上司：'+esc(empName(o.managerId))+'</span></div>'+
    '<dl class="kv" style="margin-top:6px;">'+
    '<dt>目標と実績</dt><dd>'+(nl2br(o.kpiReview)||'—')+'</dd>'+
    '<dt>うまくいったこと</dt><dd>'+(nl2br(o.wins)||'—')+'</dd>'+
    '<dt>問題</dt><dd>'+(nl2br(o.issues)||'—')+'</dd>'+
    '<dt>フィードバック</dt><dd>'+(nl2br(o.feedback)||'—')+'</dd>'+
    '<dt>必要な支援</dt><dd>'+(nl2br(o.support)||'—')+'</dd>'+
    '<dt>翌月の約束</dt><dd>'+((o.promises||[]).map(function(p){ return (p.done?'✓ ':'□ ')+esc(p.text); }).join('<br>')||'—')+'</dd>'+
    '<dt>次回予定</dt><dd>'+(esc(o.nextDate)||'—')+'</dd></dl></div>';
}

action('oooPrint', function(ds){
  var o = byId(DB.data.oneOnOnes, ds.id); if(!o) return;
  printHtml('1on1記録 '+empName(o.employeeId)+' '+o.month,
    '<div class="card"><div class="card-head"><h2>1on1記録　'+esc(empName(o.employeeId))+'</h2></div>'+
    '<div class="card-body">'+oooDetailHtml(o)+'</div></div>');
});

action('oooCsv', function(){
  var rows = [['対象月','実施日','社員','上司','目標と実績','うまくいったこと','問題','フィードバック','必要な支援','翌月の約束','約束の達成','次回予定']];
  sortBy(DB.data.oneOnOnes, function(o){ return o.month+o.date; }).forEach(function(o){
    rows.push([o.month, o.date, empName(o.employeeId), empName(o.managerId), o.kpiReview, o.wins, o.issues,
      o.feedback, o.support, (o.promises||[]).map(function(p){return p.text;}).join('\n'),
      (o.promises||[]).map(function(p){return p.done?'済':'未';}).join('\n'), o.nextDate]);
  });
  downloadCsv('1on1記録_'+todayStr()+'.csv', rows);
  toast('CSVを書き出しました','ok');
});

/* 空欄の記入シート（手書き用） */
action('oooSheet', function(){
  var blank = '<div style="border-bottom:1px solid #999;height:26px;margin:4px 0;"></div>';
  printHtml('1on1記入シート',
    '<div class="card"><div class="card-head"><h2>月次1on1 記入シート（30分）</h2></div><div class="card-body">'+
    '<div class="small">社員：'+blank+'上司：'+blank+'実施日：'+blank+'</div>'+
    '<h4 style="margin-top:12px;">① 目標と実績</h4>'+blank+blank+blank+
    '<h4 style="margin-top:12px;">② うまくいったこと</h4>'+blank+blank+
    '<h4 style="margin-top:12px;">③ 問題</h4>'+blank+blank+
    '<h4 style="margin-top:12px;">④ 具体的なフィードバック</h4>'+blank+blank+blank+
    '<h4 style="margin-top:12px;">⑤ 必要な支援</h4>'+blank+blank+
    '<h4 style="margin-top:12px;">⑥ 翌月の約束（期限つき）</h4>'+blank+blank+blank+
    '<div class="small muted" style="margin-top:14px;">※ 性格評価ではなく、期限・行動・結果・影響・次回の約束を記録すること。</div>'+
    '</div></div>');
});
