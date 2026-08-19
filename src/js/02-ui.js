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
        '<span class="x" data-modal-close>×</span></div>'+
      '<div class="modal-body">'+(opts.body||'')+'</div>'+
      (opts.foot!==false?'<div class="modal-foot">'+(opts.foot||'')+'</div>':'')+
    '</div>';
  document.body.appendChild(back);
  document.body.style.overflow = 'hidden';
  _modalStack.push(back);
  back.addEventListener('click', function(e){
    if(e.target === back || e.target.hasAttribute('data-modal-close')) closeModal();
  });
  if(opts.onMount) opts.onMount(back);
  return back;
}
function closeModal(){
  var m = _modalStack.pop();
  if(m && m.parentNode) m.parentNode.removeChild(m);
  if(_modalStack.length === 0) document.body.style.overflow = '';
}
function closeAllModals(){ while(_modalStack.length) closeModal(); }
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape' && _modalStack.length) closeModal();
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
    return '<div class="full" style="grid-column:1/-1;margin:8px 0 6px;font-weight:700;color:#0f4c81;font-size:13px;border-bottom:1px solid #e3e8ef;padding-bottom:4px;">'+esc(f.label)+'</div>';
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
    inner = '<div style="padding:6px 0;font-size:13.5px;">'+(f.raw?v:esc(v))+'</div>';
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
        /* 必須チェック */
        var miss = [];
        fields.forEach(function(f){
          if(!f.required) return;
          var el = form.querySelector('[name="f_'+f.key+'"]');
          if(el && String(el.value).trim() === '') miss.push(f.label);
        });
        if(miss.length){ toast('必須項目が未入力です：'+miss.join('、'), 'bad'); return; }
        var vals = readForm(form, fields);
        var r = opts.onSubmit(vals);
        if(r !== false) closeModal();
      }
      root.querySelector('#mSave').addEventListener('click', submit);
      form.addEventListener('submit', function(e){ e.preventDefault(); submit(); });
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
      '<div class="big">'+esc(opts.emptyTitle||'まだ登録がありません')+'</div>'+
      '<div>'+esc(opts.emptyText||'')+'</div></div>';
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

function badge(text, kind){ return '<span class="badge '+(kind||'neutral')+'">'+esc(text)+'</span>'; }
function btn(label, act, data, cls){
  var attrs = '';
  for(var k in (data||{})) attrs += ' data-'+k+'="'+esc(data[k])+'"';
  return '<button class="btn sm '+(cls||'')+'" data-act="'+act+'"'+attrs+'>'+esc(label)+'</button>';
}
function progressBar(p, kind){
  p = clamp(Math.round(p),0,100);
  return '<div class="progress '+(kind||'')+'"><span style="width:'+p+'%"></span></div>';
}
function card(title, bodyHtml, opts){
  opts = opts || {};
  return '<div class="card'+(opts.cls?' '+opts.cls:'')+'">'+
    (title!==null ? '<div class="card-head"><h2>'+esc(title)+'</h2>'+
      (opts.sub?'<span class="sub">'+esc(opts.sub)+'</span>':'')+
      '<span class="spacer"></span>'+(opts.tools||'')+'</div>' : '')+
    '<div class="card-body'+(opts.tight?' tight':'')+'">'+bodyHtml+'</div></div>';
}
function tile(label, value, note, kind){
  return '<div class="tile '+(kind||'')+'"><div class="label">'+esc(label)+'</div>'+
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
document.addEventListener('click', function(e){
  var t = e.target.closest('[data-act]');
  if(!t) return;
  var fn = ACTIONS[t.getAttribute('data-act')];
  if(!fn) return;
  e.preventDefault();
  fn(t.dataset, t, e);
});
document.addEventListener('change', function(e){
  var t = e.target.closest('[data-change]');
  if(!t) return;
  var fn = ACTIONS[t.getAttribute('data-change')];
  if(fn) fn(t.dataset, t, e);
});
