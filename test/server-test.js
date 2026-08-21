/* ============================================================
   server-test.js  共有サーバー（Cloudflare Workers）の検証
   ------------------------------------------------------------
   実際に配置しなくても、合言葉の確認・保存・競合の判定が
   正しく動くことをここで確かめる。
   ============================================================ */
const fs = require('fs'), path = require('path'), vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'server', 'worker.js'), 'utf8')
  .replace('export default', 'globalThis.__worker =');

const sandbox = { console, Request, Response, URL, JSON, Date, Object, globalThis:null };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename:'worker.js' });
const worker = sandbox.__worker;

/* KV の代わり（メモリ上の入れ物） */
function mkEnv(teamKey){
  const store = {};
  return {
    TEAM_KEY: teamKey,
    ORG_OPS: {
      async get(k, type){ const v = store[k]; return v === undefined ? null : (type === 'json' ? JSON.parse(v) : v); },
      async put(k, v){ store[k] = v; }
    },
    _store: store
  };
}
function req(url, opts){
  return new Request('https://example.workers.dev' + url, opts || {});
}
function withKey(key, opts){
  opts = opts || {};
  opts.headers = Object.assign({ 'X-Team-Key': key, 'Content-Type':'application/json' }, opts.headers || {});
  return opts;
}

let fail = 0;
const queue = [];
function t(name, fn){ queue.push([name, fn]); }

t('合言葉がないと読めない', async ()=>{
  const env = mkEnv('himitsu');
  const r = await worker.fetch(req('/api/data'), env);
  if(r.status !== 401) throw new Error('status=' + r.status);
});

t('合言葉が違うと読めない', async ()=>{
  const env = mkEnv('himitsu');
  const r = await worker.fetch(req('/api/data', withKey('chigau')), env);
  if(r.status !== 401) throw new Error('status=' + r.status);
});

t('データがまだ無いときは空と返す', async ()=>{
  const env = mkEnv('himitsu');
  const r = await worker.fetch(req('/api/data', withKey('himitsu')), env);
  const j = await r.json();
  if(r.status !== 200 || !j.empty) throw new Error(JSON.stringify(j));
});

t('保存して読み出せる', async ()=>{
  const env = mkEnv('himitsu');
  const payload = { updatedAt:'2026-08-20T01:00:00.000Z', updatedBy:'山田', data:{ employees:[{id:'e1',name:'田中'}] } };
  const put = await worker.fetch(req('/api/data', withKey('himitsu', {
    method:'PUT', body: JSON.stringify({ rev:0, payload:payload })
  })), env);
  const pj = await put.json();
  if(put.status !== 200 || pj.rev !== 1) throw new Error('保存の応答: ' + JSON.stringify(pj));

  const get = await worker.fetch(req('/api/data', withKey('himitsu')), env);
  const gj = await get.json();
  if(gj.data.employees[0].name !== '田中') throw new Error('読み出しの中身が違う');
  if(gj.updatedBy !== '山田') throw new Error('更新者が残っていない');
});

t('版数が古いまま保存すると、競合として止まる', async ()=>{
  const env = mkEnv('himitsu');
  const mk = (n)=>({ updatedAt:'2026-08-20T0'+n+':00:00.000Z', updatedBy:'人'+n, data:{ n:n } });
  await worker.fetch(req('/api/data', withKey('himitsu', { method:'PUT', body: JSON.stringify({ rev:0, payload:mk(1) }) })), env);
  const r = await worker.fetch(req('/api/data', withKey('himitsu', { method:'PUT', body: JSON.stringify({ rev:0, payload:mk(2) }) })), env);
  if(r.status !== 409) throw new Error('status=' + r.status);
  const j = await r.json();
  if(!j.conflict || j.updatedBy !== '人1') throw new Error('相手の情報が返っていない: ' + JSON.stringify(j));

  /* 上書きを選んだ場合（rev:-1）は通る */
  const f = await worker.fetch(req('/api/data', withKey('himitsu', { method:'PUT', body: JSON.stringify({ rev:-1, payload:mk(3) }) })), env);
  if(f.status !== 200) throw new Error('強制上書きが通らない: ' + f.status);
  const g = await (await worker.fetch(req('/api/data', withKey('himitsu')), env)).json();
  if(g.data.n !== 3) throw new Error('上書きされていない');
});

t('版数を合わせれば続けて保存できる', async ()=>{
  const env = mkEnv('himitsu');
  const mk = (n)=>({ updatedAt:'2026-08-20T0'+n+':00:00.000Z', updatedBy:'人', data:{ n:n } });
  let rev = 0;
  for(let i=1;i<=3;i++){
    const r = await worker.fetch(req('/api/data', withKey('himitsu', { method:'PUT', body: JSON.stringify({ rev:rev, payload:mk(i) }) })), env);
    if(r.status !== 200) throw new Error(i + '回目で ' + r.status);
    rev = (await r.json()).rev;
  }
  if(rev !== 3) throw new Error('rev=' + rev);
});

t('meta は中身を返さない（確認用に軽い）', async ()=>{
  const env = mkEnv('himitsu');
  await worker.fetch(req('/api/data', withKey('himitsu', {
    method:'PUT', body: JSON.stringify({ rev:0, payload:{ updatedAt:'2026-08-20T01:00:00.000Z', updatedBy:'山田', data:{ big:'x'.repeat(1000) } } })
  })), env);
  const r = await worker.fetch(req('/api/meta', withKey('himitsu')), env);
  const j = await r.json();
  if(j.data) throw new Error('meta にデータ本体が含まれている');
  if(j.rev !== 1 || j.updatedBy !== '山田') throw new Error(JSON.stringify(j));
});

t('壊れた内容は受け付けない', async ()=>{
  const env = mkEnv('himitsu');
  const a = await worker.fetch(req('/api/data', withKey('himitsu', { method:'PUT', body:'{壊れています' })), env);
  if(a.status !== 400) throw new Error('JSONでない: ' + a.status);
  const b = await worker.fetch(req('/api/data', withKey('himitsu', { method:'PUT', body: JSON.stringify({ rev:0 }) })), env);
  if(b.status !== 400) throw new Error('payload なし: ' + b.status);
});

t('ブラウザからの事前確認（CORS）に応える', async ()=>{
  const env = mkEnv('himitsu');
  const r = await worker.fetch(req('/api/data', { method:'OPTIONS' }), env);
  if(r.status !== 204) throw new Error('status=' + r.status);
  if(r.headers.get('Access-Control-Allow-Origin') !== '*') throw new Error('CORSヘッダがない');
  if(!/X-Team-Key/i.test(r.headers.get('Access-Control-Allow-Headers')||'')) throw new Error('合言葉ヘッダが許可されていない');
});

t('トップページは動作確認の案内を返す', async ()=>{
  const env = mkEnv('himitsu');
  const r = await worker.fetch(req('/'), env);
  const html = await r.text();
  if(r.status !== 200 || html.indexOf('共有サーバー') < 0) throw new Error('案内が出ない');
});

t('合言葉が未設定のサーバーは、誰にも開かない', async ()=>{
  /* 設定漏れのまま公開すると、URLを知る誰でも人事データを読み書きできてしまう */
  const env = mkEnv(undefined);
  const r = await worker.fetch(req('/api/data'), env);
  if(r.status !== 503) throw new Error('読み取りが止まっていない: status=' + r.status);
  const w = await worker.fetch(req('/api/data', { method:'PUT',
    headers:{'Content-Type':'application/json'}, body:JSON.stringify({ data:{}, rev:0 }) }), env);
  if(w.status !== 503) throw new Error('書き込みが止まっていない: status=' + w.status);
});
t('合言葉が設定されていれば、正しい合言葉で通る', async ()=>{
  const env = mkEnv('himitsu');
  const ng = await worker.fetch(req('/api/data', withKey('wrong-key')), env);
  if(ng.status !== 401) throw new Error('違う合言葉が通ってしまう: status=' + ng.status);
  const ok = await worker.fetch(req('/api/data', withKey('himitsu')), env);
  if(ok.status !== 200) throw new Error('正しい合言葉で通らない: status=' + ok.status);
});

t('置き場所が未設定なら、その旨を返す', async ()=>{
  const env = { TEAM_KEY:'himitsu' };
  const r = await worker.fetch(req('/api/data', withKey('himitsu')), env);
  if(r.status !== 500) throw new Error('status=' + r.status);
});

(async function(){
  console.log('■ 共有サーバー');
  for(const [name, fn] of queue){
    try{ await fn(); console.log('  OK   ' + name); }
    catch(e){ fail++; console.log('  NG   ' + name + '\n       → ' + e.message); }
  }
  console.log('\n================================');
  console.log(fail ? '失敗 ' + fail + ' 件' : 'すべて成功');
  process.exit(fail ? 1 : 0);
})();
