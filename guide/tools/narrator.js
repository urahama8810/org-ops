/* ============================================================
   narrator.js  レクチャー動画のコマ撮り用オーバーレイ
   （アプリ本体には含めない。フレーム生成時だけ注入する）
   ============================================================ */

/* 要素の特定：
   'セレクタ'                      … querySelector
   {sel:'.card', has:'見出し文字'}  … その文字を含む最初の要素
   {sel:'.btn',  has:'保存', last:true} … 最後に一致したもの        */
function __find(spec){
  if(!spec) return null;
  if(typeof spec === 'string') return document.querySelector(spec);
  var list = document.querySelectorAll(spec.sel);
  var hit = null;
  for(var i=0;i<list.length;i++){
    if(!spec.has || list[i].textContent.indexOf(spec.has) >= 0){
      hit = list[i];
      if(!spec.last) return hit;
    }
  }
  return hit;
}

/* 対象を画面内に入れる。
   ヘッドレスブラウザはスクロールした状態を撮影できない（白紙になる）ため、
   スクロールではなく上マージンで内容を押し上げる。 */
function __bring(el, mode){
  var body = el.closest ? el.closest('.modal-body') : null;
  if(body){
    var wrap = body.__wrap;
    if(!wrap){
      wrap = document.createElement('div');
      while(body.firstChild) wrap.appendChild(body.firstChild);
      body.appendChild(wrap);
      body.__wrap = wrap;
    }
    wrap.style.marginTop = '0px';
    var br = body.getBoundingClientRect(), er = el.getBoundingClientRect();
    var shift = er.top - (br.top + 24);
    if(shift > 0) wrap.style.marginTop = (-shift) + 'px';
    return;
  }
  var view = document.getElementById('view');
  if(!view) return;
  view.style.marginTop = '0px';
  var r = el.getBoundingClientRect();
  var want = (mode === 'start') ? 130 : Math.max(120, (window.innerHeight - r.height) / 2);
  var sh = r.top - want;
  if(sh > 0) view.style.marginTop = (-sh) + 'px';
}

var NARR_CSS =
'#__narr{position:fixed;inset:0;z-index:99999;pointer-events:none;'+
'font-family:"Segoe UI","Yu Gothic UI","Hiragino Kaku Gothic ProN","Meiryo",sans-serif;}'+
'#__narr .mask{position:fixed;border:3px solid #ffb61e;border-radius:10px;'+
'box-shadow:0 0 0 9999px rgba(6,16,28,.58), 0 0 26px 6px rgba(255,182,30,.75);}'+
'#__narr .dim{position:fixed;inset:0;background:rgba(6,16,28,.42);}'+
'#__narr .cur{position:fixed;width:30px;height:30px;margin:-3px 0 0 -3px;}'+
'#__narr .cap{position:fixed;left:50%;transform:translateX(-50%);width:min(1240px,90%);'+
'background:rgba(9,21,35,.95);color:#fff;border-radius:14px;padding:18px 26px;'+
'font-size:21px;line-height:1.7;box-shadow:0 14px 40px rgba(0,0,0,.45);'+
'border-left:7px solid #4da3ff;font-weight:500;}'+
'#__narr .cap b{color:#ffd166;font-weight:700;}'+
'#__narr .cap .sub{display:block;font-size:16px;color:#9fbcd8;margin-top:8px;font-weight:400;}'+
'#__narr .cap .lab{display:inline-block;background:#4da3ff;color:#062b48;font-size:13px;font-weight:800;'+
'padding:2px 12px;border-radius:12px;margin-bottom:9px;letter-spacing:.06em;}'+
'#__narr .num{position:fixed;right:28px;top:24px;background:rgba(9,21,35,.94);color:#9fbcd8;'+
'padding:7px 15px;border-radius:22px;font-size:14px;font-weight:700;}'+
'#__narr .bar{position:fixed;left:0;top:0;height:5px;background:#4da3ff;box-shadow:0 0 10px #4da3ff;}'+
'#__narr .title{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;'+
'justify-content:center;background:linear-gradient(155deg,#0d2740 0%,#134066 60%,#0f3355 100%);color:#fff;text-align:center;}'+
'#__narr .title .logo{width:96px;height:96px;border-radius:24px;background:#fff;color:#0f4c81;'+
'display:flex;align-items:center;justify-content:center;font-size:52px;font-weight:700;margin-bottom:26px;'+
'box-shadow:0 12px 40px rgba(0,0,0,.4);}'+
'#__narr .title h1{font-size:46px;font-weight:800;letter-spacing:.02em;margin-bottom:14px;}'+
'#__narr .title h2{font-size:24px;font-weight:500;color:#a9cdea;margin-bottom:34px;}'+
'#__narr .title .meta{font-size:16px;color:#7fa6c8;}'+
'#__narr .chapter{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;'+
'justify-content:center;background:rgba(9,21,35,.93);color:#fff;text-align:center;}'+
'#__narr .chapter .n{font-size:17px;letter-spacing:.3em;color:#7fb6ea;margin-bottom:16px;font-weight:700;}'+
'#__narr .chapter h1{font-size:40px;font-weight:800;margin-bottom:16px;}'+
'#__narr .chapter p{font-size:19px;color:#b9d3ea;max-width:760px;line-height:1.8;}';

var CURSOR_SVG =
'<svg class="cur" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">'+
'<path d="M4 2 L4 20 L9 15.5 L12.3 22 L15.6 20.4 L12.3 14 L19 14 Z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';

function narrate(o){
  var d = document;
  var old = d.getElementById('__narr'); if(old) old.parentNode.removeChild(old);
  if(!d.getElementById('__narrStyle')){
    var st = d.createElement('style'); st.id = '__narrStyle'; st.textContent = NARR_CSS;
    d.head.appendChild(st);
  }
  var wrap = d.createElement('div'); wrap.id = '__narr';
  d.body.appendChild(wrap);

  /* --- タイトル画面 --- */
  if(o.title){
    wrap.innerHTML = '<div class="title">'+
      (o.logo!==false?'<div class="logo">評</div>':'')+
      '<h1>'+o.title+'</h1>'+
      (o.sub?'<h2>'+o.sub+'</h2>':'')+
      (o.meta?'<div class="meta">'+o.meta+'</div>':'')+'</div>';
    return;
  }
  /* --- 章の扉 --- */
  if(o.chapterTitle){
    wrap.innerHTML = '<div class="chapter">'+
      '<div class="n">'+(o.chapterNo||'')+'</div>'+
      '<h1>'+o.chapterTitle+'</h1>'+
      (o.chapterDesc?'<p>'+o.chapterDesc+'</p>':'')+'</div>';
    return;
  }

  var html = '';
  /* 進捗バー */
  var pct = o.total ? Math.round((o.step+1)/o.total*100) : 0;
  html += '<div class="bar" style="width:'+pct+'%"></div>';
  if(o.total)   html += '<div class="num">'+(o.step+1)+' / '+o.total+'</div>';
  wrap.innerHTML = html;

  /* ハイライト */
  var target = __find(o.highlight);
  var rect = null;
  if(target){
    try{ __bring(target, o.block); }catch(e){}
    rect = target.getBoundingClientRect();
    var pad = (o.pad===undefined?10:o.pad);
    var m = document.createElement('div');
    m.className = 'mask';
    m.style.cssText = 'left:'+(rect.left-pad)+'px;top:'+(rect.top-pad)+'px;'+
                      'width:'+(rect.width+pad*2)+'px;height:'+(rect.height+pad*2)+'px;';
    wrap.appendChild(m);
    if(o.cursor){
      var c = document.createElement('div');
      c.innerHTML = CURSOR_SVG;
      var cur = c.firstChild;
      cur.style.left = (rect.left + Math.min(rect.width*0.5, 90)) + 'px';
      cur.style.top  = (rect.top + rect.height*0.62) + 'px';
      wrap.appendChild(cur);
    }
  }else if(o.dim){
    var dm = document.createElement('div'); dm.className = 'dim'; wrap.appendChild(dm);
  }

  /* 字幕（ハイライトと重ならない側に置く） */
  if(o.text){
    var cap = document.createElement('div');
    cap.className = 'cap';
    cap.innerHTML = (o.chapter?'<div class="lab">'+o.chapter+'</div>':'') +
                    o.text + (o.sub?'<span class="sub">'+o.sub+'</span>':'');
    var atTop = false;
    if(rect && rect.top > window.innerHeight*0.52) atTop = true;
    if(o.capTop) atTop = true;
    if(o.capBottom) atTop = false;
    cap.style[atTop?'top':'bottom'] = atTop ? '86px' : '46px';
    wrap.appendChild(cap);
  }
}

/* シナリオの1コマを実行する */
function __runStep(n){
  var s = SCENARIO[n];
  if(!s){ document.body.innerHTML = '<h1>step '+n+' が見つかりません</h1>'; return; }
  if(s.setup){
    try{ s.setup(); }
    catch(e){
      var b = document.createElement('div');
      b.style.cssText = 'position:fixed;left:0;top:0;background:#b00;color:#fff;padding:8px;z-index:999999;font-size:16px';
      b.textContent = 'setup error(step '+n+'): ' + e.message;
      document.body.appendChild(b);
    }
  }
  var o = {}; for(var k in s) o[k] = s[k];
  o.step = n; o.total = SCENARIO.length;
  narrate(o);
}
