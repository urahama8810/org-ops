/* ============================================================
   02-ui.js  画面共通部品（モーダル・フォーム・表・通知）
   ============================================================ */

var ACTIONS = {};                 /* data-act="名前" → 関数 の登録先 */
function action(name, fn){ ACTIONS[name] = fn; }

/* ---------- 通知 ---------- */
function toast(msg, kind){
  var box = document.getElementById('toasts');
  var d = document.createElement('div');
  d.className = 'toast ' + (kind||'');
  d.textContent = msg;
  box.appendChild(d);
  setTimeout(function(){
    d.style.transition = 'opacity .3s'; d.style.opacity = '0';
    setTimeout(function(){ if(d.parentNode) d.parentNode.removeChild(d); }, 320);
  }, 2600);
}

/* ---------- モーダル ---------- */
var _modalStack = [];
function openModal(opts){
  var back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML =
    '<div class="modal '+(opts.wide?'wide':'')+'">'+
      '<div class="modal-head"><h3>'+esc(opts.title||'')+'</h3>'+
        (opts.headNote?'<span class="sub muted small">'+esc(opts.headNote)+'</span>':'')+
        '<button type="button" class="x" data-modal-close aria-label="閉じる">'+ic('x',17)+'</button></div>'+
      '<div class="modal-body">'+(opts.body||'')+'</div>'+
      (opts.foot!==false?'<div class="modal-foot">'+(opts.foot||'')+'</div>':'')+
    '</div>';
  document.body.appendChild(back);
  document.body.style.overflow = 'hidden';
  back._gen = DB.gen;               /* 開いた時点のデータの世代を控える */
  _modalStack.push(back);
  back.addEventListener('click', function(e){
    /* アイコン(svg)が e.target になることがあるので、closest で親のボタンまでたどる */
    var t = e.target.closest ? e.target.closest('[data-modal-close]') : null;
    if(e.target === back || (t && back.contains(t))) requestCloseModal();
  });
  if(opts.onMount) opts.onMount(back);
  return back;
}

/* ふきだしを開いたあとに、共有先からの取り込みやバックアップの復元で
   データが丸ごと入れ替わることがある。そのとき、このふきだしが掴んでいる記録は
   新しいデータのどこにも繋がっておらず、書き込んでも保存されない。
   「保存しました」と出るのに何も残らないのを防ぐため、書き込む前に必ず確かめる。 */
function modalIsStale(el){
  var back = (el && el.closest) ? el.closest('.modal-back') : null;
  if(!back || back._gen === undefined) return false;
  return back._gen !== DB.gen;
}
var STALE_MSG = 'ほかの端末から新しいデータが届いたため、開いていた内容は古くなりました。'+
                '保存しても残らないので、いったん閉じて開き直してください。';

/* 閉じてよいかを確かめてから閉じる。
   入力途中のフォームでは、確認をはさむ（back.beforeClose が false を返す） */
function requestCloseModal(){
  var m = _modalStack[_modalStack.length-1];
  if(m && typeof m.beforeClose === 'function' && m.beforeClose() === false) return;
  closeModal();
}
function closeModal(){
  var m = _modalStack.pop();
  if(m && m.parentNode) m.parentNode.removeChild(m);
  if(_modalStack.length === 0) document.body.style.overflow = '';
}
function closeAllModals(){ while(_modalStack.length) closeModal(); }
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape' && _modalStack.length) requestCloseModal();
});

/* ---------- 確認ダイアログ ---------- */
function confirmDialog(title, message, onOk, okLabel){
  openModal({
    title:title,
    body:'<div style="font-size:13.5px;line-height:1.8;">'+nl2br(message)+'</div>',
    foot:'<button class="btn" data-modal-close>キャンセル</button>'+
         '<button class="btn danger" id="cfmOk">'+esc(okLabel||'実行する')+'</button>',
    onMount:function(root){
      root.querySelector('#cfmOk').addEventListener('click', function(){
        if(modalIsStale(root)){ toast(STALE_MSG,'bad'); closeAllModals(); try{ render(); }catch(e){} return; }
        closeModal(); onOk();
      });
    }
  });
}

/* ============================================================
   フォームビルダー
   fields: {key,label,type,options,hint,required,full,rows,placeholder,min,max,step,readonly}
   type: text|number|date|month|datetime|textarea|list|select|checkbox|static|heading|html
   ============================================================ */
function fieldHtml(f, val){
  if(f.type === 'heading')
    return '<div class="full form-heading">'+esc(f.label)+'</div>';
  if(f.type === 'html')
    return '<div class="'+(f.full!==false?'full':'')+'">'+(f.html||'')+'</div>';

  var v = val === undefined || val === null ? '' : val;
  var req = f.required ? '<span class="req">*</span>' : '';
  var inner = '';
  var name = 'f_'+f.key;

  if(f.type === 'textarea' || f.type === 'list'){
    var tv = f.type === 'list' ? (Array.isArray(v) ? v.join('\n') : v) : v;
    inner = '<textarea name="'+name+'" '+(f.required?'required':'')+' rows="'+(f.rows||3)+'" placeholder="'+esc(f.placeholder||'')+'">'+esc(tv)+'</textarea>';
  }else if(f.type === 'select'){
    inner = '<select name="'+name+'" '+(f.required?'required':'')+'>';
    /* 保存されている値が選択肢にないとき（担当者を削除した・職種名を変えた・期を消した等）、
       黙って消したり先頭の選択肢に化けたりしないよう、その値を選択肢として残す */
    var _has = (v === '' || v === undefined || v === null);
    (f.options||[]).forEach(function(o){
      if(String((typeof o === 'object') ? o.value : o) === String(v)) _has = true;
    });
    if(!_has) inner += '<option value="'+esc(v)+'" selected>'+esc(v)+'（選択肢にありません）</option>';
    (f.options||[]).forEach(function(o){
      var ov = (typeof o === 'object') ? o.value : o;
      var ol = (typeof o === 'object') ? o.label : o;
      inner += '<option value="'+esc(ov)+'"'+(String(ov)===String(v)?' selected':'')+'>'+esc(ol)+'</option>';
    });
    inner += '</select>';
  }else if(f.type === 'checkbox'){
    inner = '<label class="chk"><input type="checkbox" name="'+name+'"'+(v?' checked':'')+'><span>'+esc(f.checkLabel||f.label)+'</span></label>';
    return '<div class="field '+(f.full?'full':'')+'">'+inner+
           (f.hint?'<div class="hint">'+esc(f.hint)+'</div>':'')+'</div>';
  }else if(f.type === 'static'){
    inner = '<div class="static-val">'+(f.raw?v:esc(v))+'</div>';
  }else{
    var itype = f.type === 'datetime' ? 'datetime-local' : (f.type||'text');
    inner = '<input type="'+itype+'" name="'+name+'" value="'+esc(v)+'" '+
            (f.required?'required ':'')+(f.readonly?'readonly ':'')+
            (f.min!==undefined?'min="'+f.min+'" ':'')+(f.max!==undefined?'max="'+f.max+'" ':'')+
            (f.step!==undefined?'step="'+f.step+'" ':'')+
            'placeholder="'+esc(f.placeholder||'')+'">';
  }
  return '<div class="field '+(f.full?'full':'')+'">'+
           '<label>'+esc(f.label)+req+'</label>'+inner+
           (f.hint?'<div class="hint">'+esc(f.hint)+'</div>':'')+
         '</div>';
}

function formHtml(fields, value){
  value = value || {};
  var h = '<div class="form-grid">';
  fields.forEach(function(f){ h += fieldHtml(f, value[f.key]); });
  return h + '</div>';
}

function readForm(root, fields){
  var out = {};
  fields.forEach(function(f){
    if(f.type === 'heading' || f.type === 'html' || f.type === 'static') return;
    var el = root.querySelector('[name="f_'+f.key+'"]');
    if(!el) return;
    if(f.type === 'checkbox') out[f.key] = el.checked;
    else if(f.type === 'list') out[f.key] = lines(el.value);
    else if(f.type === 'number') out[f.key] = el.value === '' ? '' : num(el.value);
    else out[f.key] = el.value;
  });
  return out;
}

/* 数字として読めない入力（カンマ区切り・全角数字・単位つきなど）が入っている欄の名前を返す。
   数字の入力欄は、そうした入力を「空」として返す（画面には文字が見えたまま）。
   これを見ないと空欄と区別できず、入力した値が黙って消えてしまう。 */
function badNumFields(root, list){
  var bad = [];
  list.forEach(function(f){
    if(f.type !== 'number') return;
    var el = root.querySelector('[name="f_'+f.key+'"]');
    if(el && el.validity && el.validity.badInput) bad.push(f.label);
  });
  return bad;
}
function badNumToast(bad){
  toast('数字として読めない入力があります：'+bad.join('、')+
        '（カンマ・全角数字・単位は使えません。半角数字だけで入れてください）', 'bad');
}

/* 入力フォームをモーダルで開く */
function openForm(opts){
  var fields = opts.fields;
  openModal({
    title:opts.title, wide:opts.wide, headNote:opts.headNote,
    body:(opts.intro?'<div class="help-block">'+opts.intro+'</div>':'')+
         '<form id="mForm" novalidate>'+formHtml(fields, opts.value)+'</form>',
    foot:(opts.extraFoot||'')+
         '<button class="btn" data-modal-close>キャンセル</button>'+
         '<button class="btn primary" id="mSave">'+esc(opts.submitLabel||'保存')+'</button>',
    onMount:function(root){
      var form = root.querySelector('#mForm');
      function submit(){
        /* 開いている間にデータが入れ替わっていたら、書き込む前に伝える
           （必須の指摘より先。埋めても保存できない状態なので） */
        if(modalIsStale(form)){ toast(STALE_MSG, 'bad'); return; }
        /* 数字として読めない入力の検査。必須チェックより先に見る
           （画面に数字が見えているのに「未入力」と出ると、理由が分からないため） */
        var badNum = badNumFields(form, fields);
        if(badNum.length){
          badNumToast(badNum);
          for(var bi=0; bi<fields.length; bi++){
            if(fields[bi].type !== 'number') continue;
            var be = form.querySelector('[name="f_'+fields[bi].key+'"]');
            if(be && be.validity && be.validity.badInput){ be.focus(); break; }
          }
          return;
        }
        /* 必須チェック */
        var miss = [];
        fields.forEach(function(f){
          if(!f.required) return;
          var el = form.querySelector('[name="f_'+f.key+'"]');
          if(el && String(el.value).trim() === '') miss.push(f.label);
        });
        if(miss.length){
          toast('必須項目が未入力です：'+miss.join('、'), 'bad');
          for(var mi=0; mi<fields.length; mi++){
            if(!fields[mi].required) continue;
            var me = form.querySelector('[name="f_'+fields[mi].key+'"]');
            if(me && String(me.value).trim() === ''){ me.focus(); break; }
          }
          return;
        }
        var vals = readForm(form, fields);
        var r = opts.onSubmit(vals);
        if(r !== false){ root.beforeClose = null; closeModal(); }
      }
      root.querySelector('#mSave').addEventListener('click', submit);
      form.addEventListener('submit', function(e){ e.preventDefault(); submit(); });
      form.addEventListener('keydown', function(e){
        if((e.ctrlKey||e.metaKey) && e.key === 'Enter'){ e.preventDefault(); submit(); }
      });
      /* 開いた直後の内容を控えておき、変わっていたら閉じる前に確かめる */
      var startState = JSON.stringify(readForm(form, fields));
      root.beforeClose = function(){
        var nowState;
        try{ nowState = JSON.stringify(readForm(form, fields)); }catch(err){ return true; }
        if(nowState === startState) return true;
        confirmDialog('入力を取り消しますか',
          '保存していない入力があります。閉じると入力した内容は消えます。',
          function(){ root.beforeClose = null; closeModal(); }, '取り消す');
        return false;
      };
      var first = form.querySelector('input,select,textarea');
      if(first) first.focus();
    }
  });
}

/* ============================================================
   表の描画
   cols: {key,label,render(row),cls,width}
   ============================================================ */
function tableHtml(cols, rows, opts){
  opts = opts || {};
  if(!rows.length){
    return '<div class="empty">'+
      (typeof ic==='function' ? ic(opts.emptyIcon||'clipboard',28) : '')+
      '<div class="big">'+esc(opts.emptyTitle||'まだ登録がありません')+'</div>'+
      '<div>'+esc(opts.emptyText||'')+'</div>'+
      (opts.emptyAction?'<div class="btn-row">'+opts.emptyAction+'</div>':'')+'</div>';
  }
  var h = '<div class="table-wrap"><table class="tbl"><thead><tr>';
  cols.forEach(function(c){
    h += '<th class="'+(c.cls||'')+'"'+(c.width?' style="width:'+c.width+'"':'')+'>'+esc(c.label)+'</th>';
  });
  h += '</tr></thead><tbody>';
  rows.forEach(function(r, i){
    h += '<tr'+(opts.rowAttr?' '+opts.rowAttr(r,i):'')+'>';
    cols.forEach(function(c){
      var v = c.render ? c.render(r, i) : esc(r[c.key]);
      h += '<td class="'+(c.cls||'')+'">'+(v===undefined||v===null?'':v)+'</td>';
    });
    h += '</tr>';
  });
  return h + '</tbody></table></div>';
}

function badge(text, kind, icon){
  return '<span class="badge '+(kind||'neutral')+'">'+
    (icon&&typeof ic==='function'?ic(icon,12):'')+esc(text)+'</span>';
}
function btn(label, act, data, cls, icon){
  var attrs = '';
  for(var k in (data||{})) attrs += ' data-'+k+'="'+esc(data[k])+'"';
  return '<button class="btn sm '+(cls||'')+'" data-act="'+act+'"'+attrs+'>'+
    (icon&&typeof ic==='function'?ic(icon,14):'')+esc(label)+'</button>';
}
function progressBar(p, kind){
  p = clamp(Math.round(p),0,100);
  return '<div class="progress '+(kind||'')+'"><span style="width:'+p+'%"></span></div>';
}
function card(title, bodyHtml, opts){
  opts = opts || {};
  return '<div class="card'+(opts.cls?' '+opts.cls:'')+'">'+
    (title!==null ? '<div class="card-head">'+
      (opts.icon&&typeof ic==='function'?'<span class="hd-ic">'+ic(opts.icon,17)+'</span>':'')+
      '<h2>'+esc(title)+'</h2>'+
      (opts.sub?'<span class="sub">'+esc(opts.sub)+'</span>':'')+
      '<span class="spacer"></span>'+(opts.tools||'')+'</div>' : '')+
    '<div class="card-body'+(opts.tight?' tight':'')+'">'+bodyHtml+'</div></div>';
}
function tile(label, value, note, kind, icon){
  return '<div class="tile '+(kind||'')+'"><div class="label">'+
    (icon&&typeof ic==='function'?ic(icon,13):'')+esc(label)+'</div>'+
    '<div class="value">'+value+'</div>'+
    (note?'<div class="note">'+note+'</div>':'')+'</div>';
}

/* ---------- ファイル入出力 ---------- */
function download(filename, text, mime){
  var blob = new Blob([text], {type:(mime||'text/plain')+';charset=utf-8'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
}
function downloadCsv(filename, rows){
  var csv = rows.map(function(r){
    return r.map(function(c){
      var s = (c===null||c===undefined) ? '' : String(c);
      return '"' + s.replace(/"/g,'""').replace(/\r?\n/g,'\n') + '"';
    }).join(',');
  }).join('\r\n');
  download(filename, '﻿'+csv, 'text/csv');   /* Excel 用に BOM を付ける */
}
function pickFile(accept, cb){
  var inp = document.createElement('input');
  inp.type = 'file'; inp.accept = accept || '';
  inp.addEventListener('change', function(){
    var f = inp.files[0]; if(!f) return;
    var fr = new FileReader();
    fr.onload = function(){ cb(fr.result, f.name); };
    fr.readAsText(f, 'utf-8');
  });
  inp.click();
}

/* ---------- 印刷（対象カードだけを別ウィンドウで印刷） ---------- */
function printHtml(title, bodyHtml){
  var w = window.open('', '_blank', 'width=900,height=700');
  if(!w){ toast('ポップアップがブロックされました。ブラウザの設定を確認してください。','bad'); return; }
  var css = document.getElementById('appStyle') ? document.getElementById('appStyle').textContent : '';
  w.document.write('<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>'+esc(title)+'</title>'+
    '<style>'+css+'</style><style>body{background:#fff;}#view{padding:16px;}</style></head><body><div id="view">'+
    bodyHtml+'</div></body></html>');
  w.document.close();
  setTimeout(function(){ w.focus(); w.print(); }, 350);
}

/* ---------- イベント委譲 ---------- */
/* 操作を実行する。
   共有で使っていると、他の人が消した記録のボタンが画面に残っていることがある。
   そのまま押しても何も起きないと戸惑うので、理由を伝えて画面を作り直す。 */
function runAction(fn, name, ds, el, ev){
  /* 古くなったふきだしの中のボタンは、押しても保存されない。作り直してもらう */
  if(modalIsStale(el)){
    toast(STALE_MSG, 'bad');
    closeAllModals();
    try{ render(); }catch(e2){}
    return;
  }
  try{
    fn(ds, el, ev);
  }catch(err){
    if(typeof console !== 'undefined' && console.error) console.error(name, err);
    closeAllModals();
    toast('この操作はできませんでした。表示が古い可能性があるため、画面を作り直します。','bad');
    try{ render(); }catch(e2){}
  }
}

document.addEventListener('click', function(e){
  var t = e.target.closest('[data-act]');
  if(!t) return;
  var name = t.getAttribute('data-act');
  var fn = ACTIONS[name];
  if(!fn) return;
  e.preventDefault();
  runAction(fn, name, t.dataset, t, e);
});
document.addEventListener('change', function(e){
  var t = e.target.closest('[data-change]');
  if(!t) return;
  var name = t.getAttribute('data-change');
  var fn = ACTIONS[name];
  if(fn) runAction(fn, name, t.dataset, t, e);
});
