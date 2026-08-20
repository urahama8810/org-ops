/* ============================================================
   20-sync.js  データの共有（会社のメンバーと一緒に使うための同期）
   ------------------------------------------------------------
   3つのモードがある。

   local   … このパソコンのブラウザだけに保存する（既定）
   folder  … 会社の共有フォルダ（OneDrive / SharePoint / Googleドライブの
             同期フォルダ）に置いた1つのJSONファイルを、全員で読み書きする。
             サーバーも登録も不要。Chrome / Edge で動く。
   server  … 共有サーバー（Cloudflare Workers など）に置いたデータを
             全員で読み書きする。社外からでも同じデータを見られる。

   どのモードでも、ブラウザ内の保存（localStorage）は残るため、
   一時的に共有先へつながらなくても作業は続けられる。
   ============================================================ */

var SYNC_KEY  = 'hyokaSeido_sync_v1';
var SYNC_FILE = 'org-ops-data.json';

var SYNC = {
  cfg: { mode:'local', serverUrl:'', teamKey:'', userName:'', fileName:SYNC_FILE, auto:true },
  dirHandle:null,
  state:'idle',        /* idle | ready | syncing | error | needPermission */
  message:'',
  lastPulledAt:'',     /* 最後に取り込んだ相手側の更新時刻 */
  lastPushedAt:'',
  rev:0,
  timer:null,
  saveTimer:null,
  busy:false
};

/* ---------- 設定の保存 ---------- */
function syncLoadCfg(){
  try{
    var raw = localStorage.getItem(SYNC_KEY);
    if(raw){
      var p = JSON.parse(raw);
      for(var k in p) SYNC.cfg[k] = p[k];
    }
  }catch(e){}
  if(!SYNC.cfg.fileName) SYNC.cfg.fileName = SYNC_FILE;
  return SYNC.cfg;
}
function syncSaveCfg(){
  try{ localStorage.setItem(SYNC_KEY, JSON.stringify(SYNC.cfg)); }catch(e){}
}
function syncSupported(){
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}
function syncModeLabel(){
  if(SYNC.cfg.mode==='folder') return '共有フォルダ';
  if(SYNC.cfg.mode==='server') return '共有サーバー';
  return 'このパソコンのみ';
}

/* ---------- 小さな IndexedDB（フォルダの許可を次回も覚えておくため） ---------- */
function idbOpen(){
  return new Promise(function(res, rej){
    if(typeof indexedDB === 'undefined'){ rej(new Error('indexedDB なし')); return; }
    var r = indexedDB.open('orgops-sync', 1);
    r.onupgradeneeded = function(){ r.result.createObjectStore('kv'); };
    r.onsuccess = function(){ res(r.result); };
    r.onerror = function(){ rej(r.error); };
  });
}
function idbPut(key, val){
  return idbOpen().then(function(db){
    return new Promise(function(res, rej){
      var tx = db.transaction('kv','readwrite');
      tx.objectStore('kv').put(val, key);
      tx.oncomplete = function(){ res(true); };
      tx.onerror = function(){ rej(tx.error); };
    });
  }).catch(function(){ return false; });
}
function idbGet(key){
  return idbOpen().then(function(db){
    return new Promise(function(res){
      var tx = db.transaction('kv','readonly');
      var q = tx.objectStore('kv').get(key);
      q.onsuccess = function(){ res(q.result); };
      q.onerror = function(){ res(null); };
    });
  }).catch(function(){ return null; });
}

/* ---------- 共通：取り込み・書き出しの中身 ---------- */
function syncPayload(){
  return {
    app:'org-ops', version:APP_VERSION,
    updatedAt: DB.data.meta.updatedAt,
    updatedBy: SYNC.cfg.userName || '（名前未設定）',
    data: DB.data
  };
}
function syncApply(payload, from){
  if(!payload || !payload.data){ return false; }
  DB.data = mergeDefaults(payload.data, emptyData());
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(DB.data)); }catch(e){}
  SYNC.lastPulledAt = payload.updatedAt || nowIso();
  SYNC.message = (from||'共有先')+'から取り込みました（'+fmtJp(payload.updatedAt)+
                 (payload.updatedBy?'／'+payload.updatedBy:'')+'）';
  return true;
}
function syncStatusHtml(){
  var cls = SYNC.state==='error' ? 'bad' : (SYNC.cfg.mode==='local' ? 'neutral' : (SYNC.state==='ready'?'ok':'warn'));
  var txt = syncModeLabel();
  if(SYNC.cfg.mode!=='local'){
    if(SYNC.state==='syncing')        txt += '：同期中';
    else if(SYNC.state==='ready')     txt += '：同期済み';
    else if(SYNC.state==='needPermission') txt += '：許可が必要';
    else if(SYNC.state==='error')     txt += '：エラー';
  }
  return '<span class="badge '+cls+'" data-act="go" data-view="settings" style="cursor:pointer;" title="'+
         esc(SYNC.message||'共有の設定を開く')+'">'+esc(txt)+'</span>';
}
function syncPaint(){
  var el = (typeof document!=='undefined') ? document.getElementById('syncBadge') : null;
  if(el) el.innerHTML = syncStatusHtml();
}

/* ============================================================
   共有フォルダモード
   ============================================================ */
function folderPick(){
  if(!syncSupported()){
    toast('このブラウザは共有フォルダに対応していません。Chrome または Edge をお使いください。','bad');
    return Promise.resolve(false);
  }
  return window.showDirectoryPicker({ mode:'readwrite' }).then(function(h){
    SYNC.dirHandle = h;
    return idbPut('dirHandle', h);
  }).then(function(){
    SYNC.cfg.mode = 'folder'; syncSaveCfg();
    return folderSync(true);
  }).catch(function(e){
    if(e && e.name === 'AbortError') return false;
    SYNC.state='error'; SYNC.message = 'フォルダを開けませんでした：'+(e&&e.message||e);
    toast(SYNC.message,'bad'); syncPaint();
    return false;
  });
}

function folderEnsure(){
  if(!SYNC.dirHandle) return Promise.resolve(false);
  if(!SYNC.dirHandle.queryPermission) return Promise.resolve(true);
  return SYNC.dirHandle.queryPermission({ mode:'readwrite' }).then(function(p){
    if(p === 'granted') return true;
    SYNC.state = 'needPermission';
    SYNC.message = '共有フォルダを使う許可が必要です。「共有フォルダに接続」を押してください。';
    syncPaint();
    return false;
  }).catch(function(){ return false; });
}

function folderRead(){
  return SYNC.dirHandle.getFileHandle(SYNC.cfg.fileName, { create:true })
    .then(function(fh){ return fh.getFile(); })
    .then(function(f){
      if(f.size === 0) return null;
      return f.text().then(function(t){
        try{ return JSON.parse(t); }catch(e){ return null; }
      });
    });
}
function folderWrite(){
  return SYNC.dirHandle.getFileHandle(SYNC.cfg.fileName, { create:true })
    .then(function(fh){ return fh.createWritable(); })
    .then(function(w){
      return w.write(JSON.stringify(syncPayload(), null, 2)).then(function(){ return w.close(); });
    }).then(function(){
      SYNC.lastPushedAt = DB.data.meta.updatedAt;
      SYNC.lastPulledAt = DB.data.meta.updatedAt;
      return true;
    });
}

/* 取り込みと書き出しをまとめて行う。force=true なら競合時に自分を優先 */
function folderSync(silent){
  if(SYNC.busy) return Promise.resolve(false);
  SYNC.busy = true; SYNC.state='syncing'; syncPaint();
  return folderEnsure().then(function(ok){
    if(!ok){ return false; }
    return folderRead().then(function(remote){
      /* 相手側が空 → こちらを書き出す */
      if(!remote) return folderWrite().then(function(){ return 'push'; });

      var rt = remote.updatedAt || '';
      var mine = DB.data.meta.updatedAt || '';
      if(rt === SYNC.lastPulledAt && mine > (SYNC.lastPushedAt||'')) return folderWrite().then(function(){ return 'push'; });
      if(rt > mine){ syncApply(remote, '共有フォルダ'); return 'pull'; }
      if(rt < mine) return folderWrite().then(function(){ return 'push'; });
      SYNC.lastPulledAt = rt;
      return 'same';
    });
  }).then(function(r){
    if(r){
      SYNC.state='ready';
      if(r==='pull'){ if(!silent) toast(SYNC.message,'ok'); render(); }
      else if(r==='push'){ SYNC.message = '共有フォルダへ保存しました（'+fmtJp(nowIso())+'）'; }
    }
    SYNC.busy=false; syncPaint(); return r;
  }).catch(function(e){
    SYNC.busy=false; SYNC.state='error';
    SYNC.message = '共有フォルダの読み書きに失敗しました：'+(e&&e.message||e);
    syncPaint();
    return false;
  });
}

/* ============================================================
   共有サーバーモード
   ============================================================ */
function serverUrl(path){
  var b = String(SYNC.cfg.serverUrl||'').replace(/\/+$/,'');
  return b + path;
}
function serverHeaders(){
  return { 'Content-Type':'application/json', 'X-Team-Key': SYNC.cfg.teamKey||'' };
}
function serverPull(silent){
  if(!SYNC.cfg.serverUrl) return Promise.resolve(false);
  SYNC.state='syncing'; syncPaint();
  return fetch(serverUrl('/api/data'), { headers:serverHeaders(), cache:'no-store' })
    .then(function(r){
      if(r.status===401) throw new Error('合言葉（チームキー）が違います');
      if(!r.ok) throw new Error('サーバー応答 '+r.status);
      return r.json();
    })
    .then(function(j){
      if(j && j.data){
        SYNC.rev = j.rev||0;
        syncApply(j, '共有サーバー');
        SYNC.state='ready'; syncPaint();
        if(!silent){ toast(SYNC.message,'ok'); }
        render();
        return true;
      }
      SYNC.rev = j && j.rev || 0;
      SYNC.state='ready'; syncPaint();
      return false;
    })
    .catch(function(e){
      SYNC.state='error'; SYNC.message='共有サーバーに接続できません：'+(e&&e.message||e);
      syncPaint(); if(!silent) toast(SYNC.message,'bad');
      return false;
    });
}
function serverPush(force){
  if(!SYNC.cfg.serverUrl) return Promise.resolve(false);
  SYNC.state='syncing'; syncPaint();
  var body = JSON.stringify({ rev: force?-1:SYNC.rev, payload: syncPayload() });
  return fetch(serverUrl('/api/data'), { method:'PUT', headers:serverHeaders(), body:body })
    .then(function(r){
      if(r.status===409) return r.json().then(function(j){ return { conflict:true, remote:j }; });
      if(r.status===401) throw new Error('合言葉（チームキー）が違います');
      if(!r.ok) throw new Error('サーバー応答 '+r.status);
      return r.json();
    })
    .then(function(j){
      if(j && j.conflict){
        SYNC.state='error';
        SYNC.message = '他の人が先に更新しています。';
        syncPaint();
        syncConflictDialog(j.remote);
        return false;
      }
      SYNC.rev = j.rev||SYNC.rev+1;
      SYNC.lastPushedAt = DB.data.meta.updatedAt;
      SYNC.lastPulledAt = DB.data.meta.updatedAt;
      SYNC.state='ready'; SYNC.message='共有サーバーへ保存しました（'+fmtJp(nowIso())+'）';
      syncPaint();
      return true;
    })
    .catch(function(e){
      SYNC.state='error'; SYNC.message='保存できませんでした：'+(e&&e.message||e);
      syncPaint(); toast(SYNC.message,'bad');
      return false;
    });
}

function syncConflictDialog(remote){
  openModal({
    title:'他の人が先に更新しています',
    body:'<div class="alert warn"><span class="ic">'+ic('info',15)+'</span><div class="body">'+
      '<div class="t">共有先のデータが、あなたが開いたあとに更新されました</div>'+
      '<div class="d">相手の更新：'+esc(fmtJp(remote&&remote.updatedAt))+
      (remote&&remote.updatedBy?'（'+esc(remote.updatedBy)+'）':'')+'</div></div></div>'+
      '<div class="help-block">どちらかを選んでください。'+
      '迷ったら、先に「相手の内容を取り込む」を押し、自分の変更をもう一度入力するのが安全です。</div>',
    foot:'<button class="btn" data-act="syncPullForce">相手の内容を取り込む（自分の変更は消えます）</button>'+
         '<button class="btn danger" data-act="syncPushForce">自分の内容で上書きする</button>'
  });
}

/* ============================================================
   共通の入り口
   ============================================================ */
function syncNow(silent){
  if(SYNC.cfg.mode==='folder') return folderSync(silent);
  if(SYNC.cfg.mode==='server'){
    /* サーバーは「取り込む→自分が新しければ書き出す」の順 */
    return fetch(serverUrl('/api/meta'), { headers:serverHeaders(), cache:'no-store' })
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(meta){
        if(!meta) return serverPull(silent);
        /* 先に版数を合わせておく。これをしないと、保存のたびに競合と判定されてしまう */
        if(typeof meta.rev === 'number') SYNC.rev = meta.rev;
        var mine = DB.data.meta.updatedAt||'';
        if((meta.updatedAt||'') > mine) return serverPull(silent);
        if(mine > (SYNC.lastPushedAt||'')) return serverPush(false);
        SYNC.rev = meta.rev||SYNC.rev; SYNC.state='ready'; syncPaint();
        return true;
      })
      .catch(function(e){
        SYNC.state='error'; SYNC.message='共有サーバーに接続できません：'+(e&&e.message||e);
        syncPaint(); if(!silent) toast(SYNC.message,'bad');
        return false;
      });
  }
  return Promise.resolve(false);
}

/* 保存のたびに呼ばれる（連打しても1回にまとめる） */
function syncAfterSave(){
  if(SYNC.cfg.mode==='local' || !SYNC.cfg.auto) return;
  if(typeof setTimeout === 'undefined') return;
  clearTimeout(SYNC.saveTimer);
  SYNC.saveTimer = setTimeout(function(){
    if(SYNC.cfg.mode==='folder') folderSync(true);
    else serverPush(false);
  }, 1500);
}

/* 定期的に相手側の変更を見に行く */
function syncStartTimer(){
  if(typeof setInterval === 'undefined') return;
  clearInterval(SYNC.timer);
  if(SYNC.cfg.mode==='local') return;
  SYNC.timer = setInterval(function(){
    if(SYNC.busy) return;
    if(typeof document!=='undefined' && document.querySelector('.modal-back')) return;  /* 入力中は邪魔しない */
    syncNow(true);
  }, 15000);
}

function syncInit(){
  syncLoadCfg();
  if(typeof document === 'undefined') return;
  syncPaint();
  if(SYNC.cfg.mode==='folder'){
    idbGet('dirHandle').then(function(h){
      if(!h){ SYNC.state='needPermission';
              SYNC.message='共有フォルダの場所を、もう一度選んでください。'; syncPaint(); return; }
      SYNC.dirHandle = h;
      return folderEnsure().then(function(ok){ if(ok) return folderSync(true); });
    }).then(function(){ syncStartTimer(); });
  }else if(SYNC.cfg.mode==='server'){
    syncNow(true).then(function(){ syncStartTimer(); });
  }
}

/* ---------- 設定画面から呼ばれる操作 ---------- */
action('syncPickFolder', function(){
  folderPick().then(function(ok){
    if(ok!==false){ syncStartTimer(); render(); toast('共有フォルダに接続しました','ok'); }
  });
});

action('syncModeLocal', function(){
  confirmDialog('このパソコンのみに戻す',
    '共有をやめて、このパソコンのブラウザだけにデータを保存する状態に戻します。\n'+
    '共有フォルダやサーバーにある内容は消えません。よろしいですか？',
    function(){
      SYNC.cfg.mode='local'; syncSaveCfg();
      clearInterval(SYNC.timer); SYNC.state='idle'; SYNC.message='';
      render(); toast('このパソコンのみの保存に戻しました','ok');
    }, '戻す');
});

action('syncServerSave', function(){
  var view = document.getElementById('view');
  var url = view.querySelector('[name="f_serverUrl"]');
  var key = view.querySelector('[name="f_teamKey"]');
  var nm  = view.querySelector('[name="f_userName"]');
  SYNC.cfg.serverUrl = url ? String(url.value).trim() : '';
  SYNC.cfg.teamKey   = key ? String(key.value).trim() : '';
  if(nm) SYNC.cfg.userName = String(nm.value).trim();
  if(!SYNC.cfg.serverUrl){ toast('共有サーバーのアドレスを入力してください','bad'); return; }
  SYNC.cfg.mode = 'server';
  syncSaveCfg();
  toast('接続しています…','');
  serverPull(false).then(function(ok){
    if(SYNC.state!=='error'){
      /* サーバーが空のときは、こちらの内容を最初のデータとして送る */
      if(!ok) serverPush(true);
      syncStartTimer();
    }
    render();
  });
});

action('syncUserSave', function(){
  var view = document.getElementById('view');
  var nm = view.querySelector('[name="f_userName"]');
  if(nm){ SYNC.cfg.userName = String(nm.value).trim(); syncSaveCfg(); toast('保存しました','ok'); render(); }
});

action('syncNow', function(){
  toast('同期しています…','');
  syncNow(false).then(function(){ render(); });
});

action('syncPullForce', function(){
  closeModal();
  if(SYNC.cfg.mode==='server'){
    serverPull(false).then(function(){ render(); });
  }else if(SYNC.cfg.mode==='folder'){
    folderRead().then(function(remote){
      if(remote){ syncApply(remote,'共有フォルダ'); render(); toast('取り込みました','ok'); }
    });
  }
});

action('syncPushForce', function(){
  closeModal();
  if(SYNC.cfg.mode==='server'){
    serverPush(true).then(function(){ render(); toast('上書き保存しました','ok'); });
  }else if(SYNC.cfg.mode==='folder'){
    folderWrite().then(function(){ render(); toast('上書き保存しました','ok'); });
  }
});
