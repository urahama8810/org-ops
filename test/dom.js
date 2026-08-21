/* ============================================================
   test/dom.js  検査用の簡易ブラウザ
   ------------------------------------------------------------
   これまでのテストは、DOMの模擬が甘いせいで不具合を見逃してきた。

     ・querySelector が必ず要素を返す
       → 「画面に無い欄を読んで落ちる」不具合を検出できなかった
         （評価シートの保存がまったく動かない不具合を、161件のテストが素通しした）
     ・クリックが親へ伝わらない
       → 「アイコンを押すとボタンが反応しない」不具合を検出できなかった

   そこでここでは、HTML文字列を実際に解析して木構造を作り、
   クリックが親へ伝わる、本物に近い最小のブラウザを用意する。
   依存パッケージは使わない（このリポジトリの方針）。
   ============================================================ */

/* ---------- HTMLの解析 ---------- */
var VOID_TAGS = { area:1, base:1, br:1, col:1, embed:1, hr:1, img:1, input:1,
                  link:1, meta:1, param:1, source:1, track:1, wbr:1 };

function parseHtml(html, doc){
  var root = new El('#fragment', {}, doc);
  var stack = [root];
  var re = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s=>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g;
  var m;
  while((m = re.exec(html))){
    if(m[0].indexOf('<!--') === 0) continue;
    var top = stack[stack.length-1];
    if(m[1]){                                   /* 閉じタグ */
      for(var i = stack.length-1; i > 0; i--){
        if(stack[i].tagName === m[1].toUpperCase()){ stack.length = i; break; }
      }
    }else if(m[2]){                             /* 開きタグ */
      var el = new El(m[2], parseAttrs(m[3]||''), doc);
      top.appendChild(el);
      if(!VOID_TAGS[m[2].toLowerCase()] && !m[4]) stack.push(el);
    }else if(m[5]){                             /* 文字 */
      if(m[5].replace(/\s/g,'') !== '') top._text.push(unescapeHtml(m[5]));
    }
  }
  return root;
}

function parseAttrs(s){
  var attrs = {};
  var re = /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+)))?/g;
  var m;
  while((m = re.exec(s))){
    if(!m[1]) continue;
    var v = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : '';
    attrs[m[1].toLowerCase()] = unescapeHtml(v);
  }
  return attrs;
}

function unescapeHtml(s){
  return String(s).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"')
                  .replace(/&#39;/g,"'").replace(/&amp;/g,'&');
}

/* ---------- 要素 ---------- */
function El(tag, attrs, doc){
  this.tagName = String(tag).toUpperCase();
  this.nodeName = this.tagName;
  this.attrs = attrs || {};
  this.children = [];
  this.parentNode = null;
  this.ownerDocument = doc || null;
  this._text = [];
  this._html = '';
  this._handlers = {};
  this.style = {};
  this.scrollTop = 0;
  this.files = [];
  this.type = this.attrs.type || '';
  /* value は「まだ誰も入れていない」状態を undefined で表す。
     本物のブラウザと同じく、選択欄なら選ばれている選択肢、
     複数行の入力欄なら中の文字、が初期値になる（下の defineProperty を参照）。 */
  this._value = undefined;
  this.checked = this.attrs.checked !== undefined;
  this.disabled = this.attrs.disabled !== undefined;
  var self = this;
  this.dataset = {};
  Object.keys(this.attrs).forEach(function(k){
    if(k.indexOf('data-') !== 0) return;
    var name = k.slice(5).replace(/-([a-z])/g, function(_, c){ return c.toUpperCase(); });
    self.dataset[name] = self.attrs[k];
  });
  this.classList = {
    add: function(c){ self.attrs['class'] = ((self.attrs['class']||'')+' '+c).trim(); },
    remove: function(c){
      self.attrs['class'] = (self.attrs['class']||'').split(/\s+/)
        .filter(function(x){ return x && x !== c; }).join(' ');
    },
    contains: function(c){ return (self.attrs['class']||'').split(/\s+/).indexOf(c) >= 0; }
  };
}

Object.defineProperty(El.prototype, 'innerHTML', {
  get: function(){ return this._html; },
  set: function(v){
    this._html = String(v);
    this.children = [];
    this._text = [];
    var frag = parseHtml(this._html, this.ownerDocument);
    var self = this;
    frag.children.forEach(function(c){ self.appendChild(c); });
    this._text = frag._text.slice();
  }
});
Object.defineProperty(El.prototype, 'className', {
  get: function(){ return this.attrs['class'] || ''; },
  set: function(v){ this.attrs['class'] = String(v); }
});
Object.defineProperty(El.prototype, 'id', {
  get: function(){ return this.attrs.id || ''; },
  set: function(v){ this.attrs.id = String(v); }
});
Object.defineProperty(El.prototype, 'textContent', {
  get: function(){
    var s = this._text.join('');
    this.children.forEach(function(c){ s += c.textContent; });
    return s;
  },
  set: function(v){ this._text = [String(v)]; this.children = []; this._html = ''; }
});

/* ---- 入力欄の値を、本物のブラウザと同じように扱う ----------------
   ここを甘くしていたために「選択欄の値がいつも空」で検査が素通りし、
   保存すると選択が消える不具合を見逃していた。 */

/* 選択肢の値（value 属性が無ければ表示文字そのもの） */
function optionValue(o){
  return o.attrs.value !== undefined ? String(o.attrs.value) : o.textContent;
}
/* まだ誰も入力していないときの、初期の値 */
function initialValue(el){
  if(el.tagName === 'SELECT'){
    var opts = [];
    (function walkOpt(n){
      n.children.forEach(function(c){ if(c.tagName === 'OPTION') opts.push(c); walkOpt(c); });
    })(el);
    for(var i=0;i<opts.length;i++){
      if(opts[i].attrs.selected !== undefined) return optionValue(opts[i]);
    }
    return opts.length ? optionValue(opts[0]) : '';   /* 何も選ばれていなければ先頭 */
  }
  if(el.tagName === 'TEXTAREA') return el.textContent;
  return el.attrs.value !== undefined ? String(el.attrs.value) : '';
}
/* 数字の入力欄は、数字として読めない文字を入れると空になる（HTMLの決まり） */
var NUMLIKE = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;
function sanitizeValue(el, v){
  var s = String(v);
  if(el.tagName === 'INPUT' && String(el.type||'').toLowerCase() === 'number'){
    if(s !== '' && !NUMLIKE.test(s.trim())) return '';   /* 「1,000」「abc」はここで空になる */
  }
  return s;
}
Object.defineProperty(El.prototype, 'value', {
  get: function(){ return this._value !== undefined ? this._value : initialValue(this); },
  set: function(v){
    /* 本物と同じく、数字欄に数字として読めない文字が入ったことを覚えておく
       （画面には文字が見えたまま、値としては空になる状態） */
    this._badInput = (this.tagName === 'INPUT' && String(this.type||'').toLowerCase() === 'number'
                      && String(v) !== '' && !NUMLIKE.test(String(v).trim()));
    this._value = sanitizeValue(this, v);
  }
});
/* 本物のブラウザが持っている「入力が妥当か」の情報 */
Object.defineProperty(El.prototype, 'validity', {
  get: function(){ return { badInput: !!this._badInput, valid: !this._badInput }; }
});

El.prototype.appendChild = function(c){ c.parentNode = this; this.children.push(c); return c; };
El.prototype.removeChild = function(c){
  this.children = this.children.filter(function(x){ return x !== c; });
  c.parentNode = null;
  return c;
};
El.prototype.setAttribute = function(k, v){
  this.attrs[String(k).toLowerCase()] = String(v);
  if(k === 'value') this.value = String(v);
};
El.prototype.getAttribute = function(k){
  var v = this.attrs[String(k).toLowerCase()];
  return v === undefined ? null : v;
};
El.prototype.removeAttribute = function(k){ delete this.attrs[String(k).toLowerCase()]; };
El.prototype.hasAttribute = function(k){ return this.attrs[String(k).toLowerCase()] !== undefined; };
El.prototype.addEventListener = function(ev, fn){ (this._handlers[ev] = this._handlers[ev] || []).push(fn); };
El.prototype.removeEventListener = function(ev, fn){
  if(!this._handlers[ev]) return;
  this._handlers[ev] = this._handlers[ev].filter(function(f){ return f !== fn; });
};
El.prototype.focus = function(){ if(this.ownerDocument) this.ownerDocument.activeElement = this; };
El.prototype.blur = function(){};
El.prototype.insertAdjacentHTML = function(){};
El.prototype.contains = function(el){
  while(el){ if(el === this) return true; el = el.parentNode; }
  return false;
};
El.prototype.closest = function(sel){
  var el = this;
  while(el){ if(matches(el, sel)) return el; el = el.parentNode; }
  return null;
};
El.prototype.matches = function(sel){ return matches(this, sel); };

/* 本物と同じく、押した要素から親へ順に伝わる */
El.prototype.click = function(){
  var ev = { type:'click', target:this, defaultPrevented:false, _stop:false,
             preventDefault:function(){ this.defaultPrevented = true; },
             stopPropagation:function(){ this._stop = true; } };
  var el = this;
  while(el){
    var hs = (el._handlers.click || []).slice();
    for(var i=0;i<hs.length;i++) hs[i].call(el, ev);
    if(ev._stop) return ev;
    el = el.parentNode;
  }
  if(this.ownerDocument) this.ownerDocument._dispatch('click', ev);
  return ev;
};
El.prototype.dispatchChange = function(){
  var ev = { type:'change', target:this, preventDefault:function(){}, stopPropagation:function(){} };
  var el = this;
  while(el){
    var hs = (el._handlers.change || []).slice();
    for(var i=0;i<hs.length;i++) hs[i].call(el, ev);
    el = el.parentNode;
  }
  if(this.ownerDocument) this.ownerDocument._dispatch('change', ev);
  return ev;
};

/* ---------- セレクタ（このアプリが使う範囲だけ） ---------- */
function matches(el, sel){
  if(!el || !el.tagName || el.tagName === '#FRAGMENT') return false;
  sel = String(sel).trim();
  if(sel.indexOf(',') >= 0){
    return sel.split(',').some(function(s){ return matches(el, s); });
  }
  if(/\s/.test(sel)){
    var parts = sel.split(/\s+/);
    var last = parts.pop();
    if(!matches(el, last)) return false;
    var p = el.parentNode;
    var need = parts.pop();
    while(need){
      var found = false;
      while(p){ if(matches(p, need)){ found = true; break; } p = p.parentNode; }
      if(!found) return false;
      need = parts.pop();
    }
    return true;
  }
  var m;
  var attrRe = /\[([^\]=]+)(?:=["']?([^\]"']*)["']?)?\]/g;
  var base = sel.replace(attrRe, '');
  while((m = attrRe.exec(sel))){
    var name = m[1].toLowerCase();
    var want = m[2];
    var has = el.attrs[name];
    if(has === undefined) return false;
    if(want !== undefined && has !== want) return false;
  }
  if(!base) return true;
  var idm = base.match(/#([\w-]+)/);
  if(idm && el.attrs.id !== idm[1]) return false;
  var clsRe = /\.([\w-]+)/g;
  var cls = (el.attrs['class'] || '').split(/\s+/);
  while((m = clsRe.exec(base))){ if(cls.indexOf(m[1]) < 0) return false; }
  var tagm = base.match(/^([a-zA-Z][\w-]*)/);
  if(tagm && el.tagName !== tagm[1].toUpperCase()) return false;
  return true;
}

function walk(el, fn){
  el.children.forEach(function(c){ fn(c); walk(c, fn); });
}
El.prototype.querySelector = function(sel){
  var found = null;
  walk(this, function(c){ if(!found && matches(c, sel)) found = c; });
  return found;                                  /* 無ければ null（本物と同じ） */
};
El.prototype.querySelectorAll = function(sel){
  var out = [];
  walk(this, function(c){ if(matches(c, sel)) out.push(c); });
  out.forEach = Array.prototype.forEach;
  return out;
};

/* ---------- 文書 ---------- */
function Doc(){
  this.readyState = 'complete';
  this.title = '';
  this.activeElement = null;
  this._handlers = {};
  this.documentElement = new El('html', {}, this);
  this.body = new El('body', {}, this);
  this.documentElement.appendChild(this.body);
  this._els = {};
}
Doc.prototype.createElement = function(tag){ return new El(tag, {}, this); };
Doc.prototype.getElementById = function(id){
  var found = null;
  walk(this.documentElement, function(c){ if(!found && c.attrs.id === id) found = c; });
  if(found) return found;
  /* アプリが起動時に触る要素は、無ければ作って body に置く（本物のHTMLに相当） */
  if(!this._els[id]){
    var el = new El('div', { id:id }, this);
    this._els[id] = el;
    this.body.appendChild(el);
  }
  return this._els[id];
};
Doc.prototype.querySelector = function(sel){ return this.documentElement.querySelector(sel); };
Doc.prototype.querySelectorAll = function(sel){ return this.documentElement.querySelectorAll(sel); };
Doc.prototype.addEventListener = function(ev, fn){ (this._handlers[ev] = this._handlers[ev] || []).push(fn); };
Doc.prototype.removeEventListener = function(){};
Doc.prototype._dispatch = function(ev, e){
  (this._handlers[ev] || []).slice().forEach(function(fn){ fn(e); });
};
Doc.prototype.write = function(){};
Doc.prototype.close = function(){};

/* ---------- アプリを読み込んだ環境を作る ---------- */
function createApp(opts){
  opts = opts || {};
  var fs = require('fs'), path = require('path'), vm = require('vm');
  var DIR = opts.dir || path.join(__dirname, '..', 'src', 'js');
  var doc = new Doc();
  var store = {};
  var timers = [];

  var sandbox = {
    document: doc,
    window: {
      addEventListener: function(ev, fn){ doc.addEventListener(ev, fn); },
      scrollTo: function(){}, print: function(){}, open: function(){ return null; },
      location: { hash:'' }, devicePixelRatio: 1,
      matchMedia: function(){ return { matches:false, addListener:function(){}, addEventListener:function(){} }; }
    },
    localStorage: {
      getItem: function(k){ return k in store ? store[k] : null; },
      setItem: function(k, v){
        if(opts.quota && String(v).length > opts.quota){
          var e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e;
        }
        store[k] = String(v);
      },
      removeItem: function(k){ delete store[k]; },
      clear: function(){ Object.keys(store).forEach(function(k){ delete store[k]; }); }
    },
    location: { hash:'' },
    navigator: { userAgent:'node' },
    console: opts.quiet ? { log:function(){}, warn:function(){}, error:function(){} } : console,
    JSON: JSON, Math: Math, Date: Date, Array: Array, Object: Object, String: String,
    Number: Number, Boolean: Boolean, RegExp: RegExp, Error: Error,
    isFinite: isFinite, isNaN: isNaN, parseFloat: parseFloat, parseInt: parseInt,
    Promise: Promise, encodeURIComponent: encodeURIComponent, decodeURIComponent: decodeURIComponent,
    setTimeout: function(fn, ms){ timers.push({ fn:fn, ms:ms||0 }); return timers.length; },
    clearTimeout: function(){}, setInterval: function(){ return 0; }, clearInterval: function(){},
    Blob: function(){}, URL: { createObjectURL:function(){ return 'blob:x'; }, revokeObjectURL:function(){} },
    FileReader: function(){ this.readAsText = function(){}; },
    fetch: opts.fetch || function(){ return Promise.reject(new Error('fetchは使えません')); },
    alert: function(){}, confirm: function(){ return true; },
    SpeechSynthesisUtterance: function(){}, speechSynthesis: null
  };
  sandbox.window.document = doc;
  sandbox.window.localStorage = sandbox.localStorage;
  sandbox.globalThis = sandbox;

  var files = fs.readdirSync(DIR).filter(function(f){ return /\.js$/.test(f); }).sort();
  var code = files.map(function(f){
    return '\n/* == ' + f + ' == */\n' + fs.readFileSync(path.join(DIR, f), 'utf8');
  }).join('\n');

  var ctx = vm.createContext(sandbox);
  vm.runInContext(code, ctx, { filename:'app.js' });

  return {
    ctx: ctx, doc: doc, store: store, files: files,
    /* 画面を描く。#view の中身が本物と同じように木になる */
    render: function(viewKey){
      if(viewKey) ctx.currentView = viewKey;
      ctx.render();
      return doc.getElementById('view');
    },
    /* 溜まった setTimeout を全部走らせる */
    runTimers: function(){
      var list = timers.slice();
      timers.length = 0;
      list.sort(function(a,b){ return a.ms - b.ms; });
      list.forEach(function(t){ try{ t.fn(); }catch(e){} });
    },
    /* いま開いているふきだし（モーダル） */
    modal: function(){
      var backs = doc.body.querySelectorAll('.modal-back');
      return backs.length ? backs[backs.length-1] : null;
    }
  };
}

module.exports = { createApp: createApp, parseHtml: parseHtml, El: El, Doc: Doc, matches: matches };
