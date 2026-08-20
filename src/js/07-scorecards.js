/* ============================================================
   07-scorecards.js  職種別役割スコアカード
   ============================================================ */

var SCORECARD_FIELDS = [
  { key:'jobType', label:'職種', required:true, full:true,
    hint:'事業責任者・営業・マーケティング・顧客対応・開発・経理総務・管理職・経営幹部 など6〜8区分に分ける。' },
  { key:'purpose', label:'役割の目的', type:'textarea', rows:2, full:true, required:true,
    hint:'この職種が会社に存在する理由。「作業内容」ではなく「何のために居るか」を書く。' },
  { key:'responsibilities', label:'主要責任（最大5項目）', type:'list', rows:5, full:true,
    hint:'1行に1つ。6個以上になる場合は、本当に責任と言えるものだけに絞る。' },
  { key:'kpis', label:'KPI（最大5項目）', type:'list', rows:5, full:true,
    hint:'1行に1つ。測れないものはKPIにしない。' },
  { key:'authority', label:'権限（本人判断可能な範囲）', type:'textarea', rows:3, full:true },
  { key:'approvals', label:'承認が必要なこと（上司または経営層）', type:'textarea', rows:3, full:true },
  { key:'reports', label:'必須報告（何を・誰へ・いつまでに）', type:'textarea', rows:3, full:true,
    hint:'期限（悪い情報は24時間以内など）と揃える。' },
  { key:'behaviors', label:'求める行動', type:'textarea', rows:2, full:true,
    hint:'期限、報告、改善、記録、協働。' },
  { key:'gradeDiff', label:'上位等級との差', type:'textarea', rows:2, full:true,
    hint:'昇格時に増える責任・判断範囲。ここが書けないと昇格の説明ができません。' }
];

VIEWS.scorecards = {
  title:'職種別役割スコアカード',
  desc:'Week 2〜3／シート3。職種を6〜8区分し、責任・KPI・権限・報告ルールを定義します。',
  render:function(){
    var d = DB.data;
    var h = '';
    h += '<div class="help-block">'+
      '<b>役割スコアカードは「人」ではなく「職種」に対して作ります。</b> '+
      '担当者が代わっても会社の期待が変わらない状態にするためです。まず6〜8区分に分類し、それぞれ8項目を埋めてください。</div>';

    if(d.scorecards.length < 6)
      h += '<div class="alert warn"><span class="ic">'+ic('info',15)+'</span><div class="body"><div class="t">現在'+d.scorecards.length+'職種です（目安は6〜8職種）</div>'+
        '<div class="d">標準ひな形から一括作成できます。作成後、自社の実態に合わせて必ず修正してください。</div></div>'+
        '<div class="go"><button class="btn sm primary" data-act="scCreateDefaults">標準8職種を作成</button></div></div>';

    h += '<div class="card"><div class="card-body" style="padding:12px 16px;"><div class="inline-form">'+
      '<button class="btn primary" data-act="scNew">＋ 職種を追加</button>'+
      '<span style="flex:1"></span>'+
      '<button class="btn" data-act="scCsv">CSVで書き出す</button>'+
      '<button class="btn" data-act="scPrint">全職種を印刷</button>'+
      '</div></div></div>';

    if(!d.scorecards.length){
      h += card('職種一覧','<div class="empty"><div class="big">まだ職種が登録されていません</div>'+
        '<div>「標準8職種を作成」で標準のひな形から始めるのが最短です。</div>'+
        '<div class="btn-row" style="justify-content:center;margin-top:10px;">'+
        '<button class="btn primary" data-act="scCreateDefaults">標準8職種を作成</button>'+
        '<button class="btn" data-act="scNew">自分で追加する</button></div></div>',{tight:true});
      return h;
    }

    d.scorecards.forEach(function(s){
      var members = d.employees.filter(function(e){ return e.jobType === s.jobType; });
      var filled = ['purpose','authority','approvals','reports','behaviors','gradeDiff'].filter(function(k){ return (s[k]||'').trim(); }).length
                 + (lines(s.responsibilities).length?1:0) + (lines(s.kpis).length?1:0);
      var rate = Math.round(filled/8*100);
      var body = '<div class="grid c2">'+
        '<div><div class="small muted">役割の目的</div><div style="margin-bottom:10px;">'+(nl2br(s.purpose)||'<span class="badge warn">未記入</span>')+'</div>'+
          '<div class="small muted">主要責任（'+lines(s.responsibilities).length+'/5）</div>'+
          '<ul class="list-plain" style="margin-bottom:10px;">'+(lines(s.responsibilities).map(function(x){return '<li>'+esc(x)+'</li>';}).join('')||'<li class="muted">未記入</li>')+'</ul>'+
          '<div class="small muted">KPI（'+lines(s.kpis).length+'/5）</div>'+
          '<ul class="list-plain">'+(lines(s.kpis).map(function(x){return '<li>'+esc(x)+'</li>';}).join('')||'<li class="muted">未記入</li>')+'</ul>'+
        '</div>'+
        '<div><div class="small muted">権限（本人判断可）</div><div style="margin-bottom:10px;">'+(nl2br(s.authority)||'<span class="badge warn">未記入</span>')+'</div>'+
          '<div class="small muted">要承認</div><div style="margin-bottom:10px;">'+(nl2br(s.approvals)||'<span class="badge warn">未記入</span>')+'</div>'+
          '<div class="small muted">必須報告</div><div style="margin-bottom:10px;">'+(nl2br(s.reports)||'<span class="badge warn">未記入</span>')+'</div>'+
          '<div class="small muted">求める行動</div><div style="margin-bottom:10px;">'+(nl2br(s.behaviors)||'<span class="muted">未記入</span>')+'</div>'+
          '<div class="small muted">上位等級との差</div><div>'+(nl2br(s.gradeDiff)||'<span class="muted">未記入</span>')+'</div>'+
        '</div></div>';
      if(members.length){
        body += '<div class="sep"></div><div class="small muted">この職種の社員（'+members.length+'名）</div>'+
          '<div class="pill-row" style="margin-top:4px;">'+members.map(function(m){
            return '<span class="tag">'+esc(m.name)+(m.grade?' / '+esc(m.grade):'')+'</span>'; }).join('')+'</div>';
      }
      h += card(s.jobType, body, {
        sub:'記入 '+filled+'/8 項目（'+rate+'%）'+(members.length?' ・該当'+members.length+'名':' ・該当社員なし'),
        tools: btn('編集','scEdit',{id:s.id})+' '+btn('印刷','scPrintOne',{id:s.id})+' '+btn('削除','scDel',{id:s.id},'danger')
      });
    });
    return h;
  }
};

action('scNew', function(){
  openForm({ title:'職種を追加', wide:true, fields:SCORECARD_FIELDS, value:{},
    intro:'8項目すべてを埋めてください。とくに<b>「決めてよいこと」と「承認が必要なこと」の線引き</b>、'+
          'そして<b>「一つ上の等級との違い」</b>がはっきりしていると、細かい判断まで上に戻らずに済みます。',
    onSubmit:function(v){
      v.id = uid('sc');
      DB.data.scorecards.push(v); DB.save(); render(); toast('追加しました','ok');
    }
  });
});

action('scEdit', function(ds){
  var s = byId(DB.data.scorecards, ds.id);
  if(!s) return;
  openForm({ title:'役割スコアカード：'+s.jobType, wide:true, fields:SCORECARD_FIELDS, value:s,
    onSubmit:function(v){
      v.id = s.id;
      DB.data.scorecards[DB.data.scorecards.indexOf(s)] = v; DB.save(); render(); toast('保存しました','ok');
    }
  });
});

action('scDel', function(ds){
  var s = byId(DB.data.scorecards, ds.id);
  if(!s) return;
  confirmDialog('職種の削除','「'+s.jobType+'」を削除します。よろしいですか？', function(){
    DB.data.scorecards = DB.data.scorecards.filter(function(x){ return x.id !== s.id; });
    DB.save(); render(); toast('削除しました','ok');
  }, '削除する');
});

action('scCreateDefaults', function(){
  confirmDialog('標準8職種の作成',
    '標準のひな形から8職種（事業責任者・営業・マーケティング・顧客対応・開発・経理総務・管理職・経営幹部）の役割スコアカードを作成します。\n\n'+
    '既に同じ職種名がある場合は追加しません。作成後、必ず自社の実態に合わせて修正してください。',
    function(){
      var existing = DB.data.scorecards.map(function(s){ return s.jobType; });
      var added = 0;
      DEFAULT_JOB_TYPES.forEach(function(jt){
        if(existing.indexOf(jt) >= 0) return;
        var t = SCORECARD_TEMPLATES[jt];
        if(!t) return;
        var rec = JSON.parse(JSON.stringify(t));
        rec.id = uid('sc'); rec.jobType = jt;
        DB.data.scorecards.push(rec); added++;
      });
      DB.save(); render();
      toast(added+'職種を作成しました。内容を自社に合わせて修正してください。','ok');
    }, '作成する');
});

function scorecardPrintHtml(s){
  function row(k,v){ return '<dt>'+esc(k)+'</dt><dd>'+(v||'<span class="muted">未記入</span>')+'</dd>'; }
  return '<dl class="kv">'+
    row('役割の目的', nl2br(s.purpose))+
    row('主要責任', lines(s.responsibilities).map(function(x){return esc(x);}).join('<br>'))+
    row('KPI', lines(s.kpis).map(function(x){return esc(x);}).join('<br>'))+
    row('権限', nl2br(s.authority))+
    row('要承認', nl2br(s.approvals))+
    row('必須報告', nl2br(s.reports))+
    row('求める行動', nl2br(s.behaviors))+
    row('上位等級との差', nl2br(s.gradeDiff))+
    '</dl>';
}
action('scPrintOne', function(ds){
  var s = byId(DB.data.scorecards, ds.id);
  printHtml(s.jobType+' 役割スコアカード',
    '<div class="card"><div class="card-head"><h2>'+esc(s.jobType)+'　役割スコアカード</h2></div>'+
    '<div class="card-body">'+scorecardPrintHtml(s)+'</div></div>');
});
action('scPrint', function(){
  var h = DB.data.scorecards.map(function(s){
    return '<div class="card"><div class="card-head"><h2>'+esc(s.jobType)+'　役割スコアカード</h2></div>'+
           '<div class="card-body">'+scorecardPrintHtml(s)+'</div></div>';
  }).join('');
  printHtml('職種別役割スコアカード', h || '<p>登録がありません。</p>');
});
action('scCsv', function(){
  var rows = [['職種','役割の目的','主要責任','KPI','権限','要承認','必須報告','求める行動','上位等級との差','該当社員']];
  DB.data.scorecards.forEach(function(s){
    rows.push([s.jobType, s.purpose, lines(s.responsibilities).join('\n'), lines(s.kpis).join('\n'),
      s.authority, s.approvals, s.reports, s.behaviors, s.gradeDiff,
      DB.data.employees.filter(function(e){return e.jobType===s.jobType;}).map(function(e){return e.name;}).join('、')]);
  });
  downloadCsv('職種別役割表_'+todayStr()+'.csv', rows);
  toast('CSVを書き出しました','ok');
});
