/* ============================================================
   11-grades.js  等級制度 G1〜G5
   ============================================================ */

VIEWS.grades = {
  title:'等級制度（G1〜G5）',
  desc:'Week 6〜8。等級は「役職」ではなく「期待する状態」で決めます。G4以降は管理職コースと専門職コースを設けます。',
  render:function(){
    var d = DB.data;
    var h = '';

    h += '<div class="help-block">'+
      '<b>昇格の基本条件：</b> '+PROMOTION_CONDITIONS.map(function(c){ return '①②③'[0]; }).join('')+
      '<ol style="margin:4px 0 0;padding-left:20px;">'+
      PROMOTION_CONDITIONS.map(function(c){ return '<li><b>'+esc(c.label)+'</b> — '+esc(c.hint)+'</li>'; }).join('')+
      '</ol></div>';

    /* 等級定義 */
    var cols = [
      { label:'等級', width:'70px', render:function(g){ return '<b class="badge accent">'+esc(g.code)+'</b>'; } },
      { label:'期待する状態', width:'220px', render:function(g){ return '<b>'+esc(g.expect)+'</b>'; } },
      { label:'具体的な状態', render:function(g){ return esc(g.detail||''); } },
      { label:'権限の目安', render:function(g){ return esc(g.authority||''); } },
      { label:'該当者', width:'160px', render:function(g){
          var m = d.employees.filter(function(e){ return e.grade === g.code; });
          if(!m.length) return '<span class="muted small">—</span>';
          return '<span class="small">'+m.map(function(x){ return esc(x.name); }).join('、')+'</span>'+
                 '<div class="small muted">'+m.length+'名</div>'; } },
      { label:'', cls:'actions', width:'70px', render:function(g){ return btn('編集','gradeEdit',{code:g.code}); } }
    ];
    h += card('等級の定義', tableHtml(cols, d.grades, {}), {tight:true,
      tools: btn('印刷','gradePrint',{})+' '+btn('標準に戻す','gradeReset',{})});

    /* G4以降のコース */
    var mgrCourse = d.employees.filter(function(e){ return (e.grade==='G4'||e.grade==='G5') && e.course!=='expert'; });
    var expCourse = d.employees.filter(function(e){ return (e.grade==='G4'||e.grade==='G5') && e.course==='expert'; });
    h += '<div class="grid c2">'+
      '<div>'+card('管理職コース（G4以降）',
        mgrCourse.length ? mgrCourse.map(function(e){
          return '<div style="padding:5px 0;border-bottom:1px solid var(--border);">'+
            '<b>'+esc(e.name)+'</b> '+badge(e.grade,'accent')+' <span class="small muted">'+esc(e.roleTitle||'')+
            '　部下'+directReports(e.id).length+'名</span>'+
            '<span style="float:right;">'+btn('専門職コースへ','gradeCourse',{id:e.id,course:'expert'})+'</span></div>';
        }).join('') : '<div class="empty">該当者がいません</div>',
        {sub:'チーム管理・部門成果に責任を持つ'})+'</div>'+
      '<div>'+card('専門職コース（G4以降）',
        expCourse.length ? expCourse.map(function(e){
          return '<div style="padding:5px 0;border-bottom:1px solid var(--border);">'+
            '<b>'+esc(e.name)+'</b> '+badge(e.grade,'accent')+' <span class="small muted">'+esc(e.roleTitle||'')+'</span>'+
            '<span style="float:right;">'+btn('管理職コースへ','gradeCourse',{id:e.id,course:'manager'})+'</span></div>';
        }).join('') : '<div class="empty">該当者がいません</div>',
        {sub:'高度専門業務で成果に責任を持つ'})+'</div>'+
      '</div>';

    /* 社員の格付け */
    var rows = sortBy(d.employees, function(e){ return (e.grade||'zzz')+'_'+e.name; });
    h += card('社員の格付け', tableHtml([
      { label:'社員', width:'150px', render:function(e){
          return '<b>'+esc(e.name)+'</b><div class="small muted">'+esc(e.dept||'')+'</div>'; } },
      { label:'職種', width:'120px', render:function(e){ return esc(e.jobType||'—'); } },
      { label:'現等級', width:'150px', render:function(e){
          var opts = ['<option value="">未設定</option>'].concat(d.grades.map(function(g){
            return '<option value="'+g.code+'"'+(e.grade===g.code?' selected':'')+'>'+g.code+' '+esc(g.expect)+'</option>'; })).join('');
          return '<select data-change="gradeSet" data-id="'+e.id+'" style="padding:3px 6px;">'+opts+'</select>'; } },
      { label:'直近の評価', width:'120px', render:function(e){
          var evs = sortBy(DB.data.evaluations.filter(function(x){ return x.employeeId===e.id && evalScore(x)!==null; }),
                           function(x){ return x.period; });
          if(!evs.length) return '<span class="muted small">—</span>';
          return evs.slice(-2).map(function(x){
            var s = evalScore(x); var g = evalGradeLabel(s);
            return '<div class="small">'+esc(x.period)+' '+badge(s.toFixed(2), g.cls)+'</div>'; }).join(''); } },
      { label:'昇格判定', render:function(e){ return promotionSummary(e); } },
      { label:'', cls:'actions', width:'130px', render:function(e){ return btn('昇格を検討','gradePromote',{id:e.id}); } }
    ], rows, {emptyTitle:'社員が登録されていません'}), {tight:true});

    /* 昇格記録 */
    var hist = [];
    d.employees.forEach(function(e){ (e.gradeHistory||[]).forEach(function(x){ hist.push({e:e, x:x}); }); });
    if(hist.length){
      hist = sortBy(hist, function(o){ return o.x.date; }).reverse();
      h += card('昇格・等級変更の記録', tableHtml([
        {label:'日付', width:'110px', render:function(o){ return esc(o.x.date); }},
        {label:'社員', width:'130px', render:function(o){ return esc(o.e.name); }},
        {label:'変更', width:'140px', render:function(o){ return esc(o.x.from||'—')+' → '+esc(o.x.to); }},
        {label:'条件', render:function(o){
          return (o.x.conditions||[]).map(function(c){ return '✓ '+esc(c); }).join('<br>'); }},
        {label:'理由・決定者', render:function(o){ return esc(o.x.reason||'')+'<div class="small muted">'+esc(o.x.decidedBy||'')+'</div>'; }}
      ], hist, {}), {tight:true});
    }
    return h;
  }
};

function promotionSummary(e){
  var evs = sortBy(DB.data.evaluations.filter(function(x){ return x.employeeId===e.id && evalScore(x)!==null; }),
                   function(x){ return x.period; });
  var sustained = evs.length >= 2 && evalScore(evs[evs.length-1]) >= 2.75 && evalScore(evs[evs.length-2]) >= 2.75;
  var marks = [];
  marks.push((e.doingUpperWork ? '✓' : '□')+' 上位等級の仕事を既に行っている');
  marks.push((sustained ? '✓' : '□')+' 継続的な成果（2期連続で評価3以上）');
  marks.push((e.roleNeeded ? '✓' : '□')+' 会社にその役割が必要');
  var okCount = (e.doingUpperWork?1:0) + (sustained?1:0) + (e.roleNeeded?1:0);
  var cls = okCount===3 ? 'ok' : okCount>=2 ? 'warn' : 'neutral';
  return badge(okCount+'/3 条件', cls)+'<div class="small muted" style="margin-top:2px;">'+marks.join('<br>')+'</div>';
}

action('gradeSet', function(ds, el){
  var e = byId(DB.data.employees, ds.id); if(!e) return;
  var from = e.grade || '';
  e.grade = el.value;
  if(from !== e.grade){
    e.gradeHistory = e.gradeHistory || [];
    e.gradeHistory.push({ date:todayStr(), from:from, to:e.grade, reason:'一覧から変更', decidedBy:DB.data.settings.ceoName||'' });
  }
  DB.save(); render();
});

action('gradeCourse', function(ds){
  var e = byId(DB.data.employees, ds.id); if(!e) return;
  e.course = ds.course; DB.save(); render();
  toast(e.name+'さんを'+(ds.course==='expert'?'専門職':'管理職')+'コースにしました','ok');
});

action('gradeEdit', function(ds){
  var g = DB.data.grades.filter(function(x){ return x.code === ds.code; })[0];
  if(!g) return;
  openForm({
    title:'等級の定義：'+g.code, wide:true,
    fields:[
      { key:'expect', label:'期待する状態', required:true, full:true },
      { key:'detail', label:'具体的な状態', type:'textarea', rows:3, full:true,
        hint:'「どういう仕事ができていればこの等級か」を、他人が判定できる表現で書く。' },
      { key:'authority', label:'権限の目安', type:'textarea', rows:3, full:true }
    ],
    value:g,
    onSubmit:function(v){
      g.expect = v.expect; g.detail = v.detail; g.authority = v.authority;
      DB.save(); render(); toast('保存しました','ok');
    }
  });
});

action('gradeReset', function(){
  confirmDialog('等級定義を標準に戻す','標準の定義（G1〜G5）に戻します。編集した内容は失われます。よろしいですか？', function(){
    DB.data.grades = JSON.parse(JSON.stringify(DEFAULT_GRADES));
    DB.save(); render(); toast('標準定義に戻しました','ok');
  }, '戻す');
});

action('gradePromote', function(ds){
  var e = byId(DB.data.employees, ds.id); if(!e) return;
  var d = DB.data;
  var idx = d.grades.map(function(g){ return g.code; }).indexOf(e.grade);
  var next = idx >= 0 && idx < d.grades.length-1 ? d.grades[idx+1] : (idx<0 ? d.grades[0] : null);
  var evs = sortBy(d.evaluations.filter(function(x){ return x.employeeId===e.id && evalScore(x)!==null; }),
                   function(x){ return x.period; });
  var sustained = evs.length >= 2 && evalScore(evs[evs.length-1]) >= 2.75 && evalScore(evs[evs.length-2]) >= 2.75;

  openForm({
    title:'昇格の検討：'+e.name, wide:true,
    intro:'<b>昇格は「これから頑張る人」ではなく「既に上位等級の仕事をしている人」に対して行います。</b><br>'+
      '現等級：'+(e.grade||'未設定')+(next?' → 検討中：'+next.code+'（'+esc(next.expect)+'）':'（最上位）'),
    fields:[
      { key:'doingUpperWork', label:'上位等級の仕事を既に行っている', type:'checkbox', full:true,
        hint:'具体例を下の理由欄に書いてください。' },
      { key:'sustainedInfo', type:'static', label:'継続的な成果（自動判定）', full:true,
        raw:true, },
      { key:'roleNeeded', label:'会社にその役割が必要である', type:'checkbox', full:true,
        hint:'ポジションが存在しない昇格は行わない。' },
      { key:'newGrade', label:'新しい等級', type:'select',
        options:[{value:'',label:'（変更しない）'}].concat(d.grades.map(function(g){ return {value:g.code,label:g.code+' '+g.expect}; })) },
      { key:'course', label:'コース（G4以降）', type:'select',
        options:[{value:'',label:'（未設定）'},{value:'manager',label:'管理職コース'},{value:'expert',label:'専門職コース'}] },
      { key:'reason', label:'理由（具体的な事実）', type:'textarea', rows:3, full:true, required:true,
        hint:'例：G3の案件2件を単独で完遂し、後輩2名のレビューを継続実施。2期連続で評価3.4。' },
      { key:'decidedBy', label:'決定者', full:true },
      { key:'date', label:'適用日', type:'date' }
    ],
    value:{
      doingUpperWork: !!e.doingUpperWork, roleNeeded: !!e.roleNeeded,
      newGrade: next?next.code:'', course: e.course||'',
      sustainedInfo: (sustained?'<span class="badge ok">条件を満たす</span>':'<span class="badge warn">未達</span>')+
        ' <span class="small muted">'+(evs.length?evs.slice(-2).map(function(x){ return x.period+'：'+evalScore(x).toFixed(2); }).join(' / '):'評価記録なし')+'</span>',
      reason:'', decidedBy: d.settings.ceoName||'', date: todayStr()
    },
    submitLabel:'記録する',
    onSubmit:function(v){
      e.doingUpperWork = v.doingUpperWork;
      e.roleNeeded = v.roleNeeded;
      if(v.course) e.course = v.course;
      if(v.newGrade && v.newGrade !== e.grade){
        var conds = [];
        if(v.doingUpperWork) conds.push('上位等級の仕事を既に行っている');
        if(sustained) conds.push('継続的な成果');
        if(v.roleNeeded) conds.push('会社にその役割が必要');
        e.gradeHistory = e.gradeHistory || [];
        e.gradeHistory.push({ date:v.date, from:e.grade||'', to:v.newGrade, reason:v.reason,
                              decidedBy:v.decidedBy, conditions:conds });
        e.grade = v.newGrade;
        toast(e.name+'さんを'+v.newGrade+'に変更しました','ok');
      }else{
        toast('検討内容を記録しました','ok');
      }
      DB.save(); render();
    }
  });
});

action('gradePrint', function(){
  printHtml('等級制度 G1〜G5',
    '<div class="card"><div class="card-head"><h2>等級制度（G1〜G5）</h2></div><div class="card-body">'+
    tableHtml([
      {label:'等級', render:function(g){ return g.code; }},
      {label:'期待する状態', render:function(g){ return esc(g.expect); }},
      {label:'具体的な状態', render:function(g){ return esc(g.detail||''); }},
      {label:'権限の目安', render:function(g){ return esc(g.authority||''); }}
    ], DB.data.grades, {})+
    '<div class="sep"></div><h4>昇格の基本条件</h4><ol>'+
    PROMOTION_CONDITIONS.map(function(c){ return '<li>'+esc(c.label)+'（'+esc(c.hint)+'）</li>'; }).join('')+'</ol>'+
    '<p class="small">G4以降は管理職コースと専門職コースを設ける。</p>'+
    '</div></div>');
});
