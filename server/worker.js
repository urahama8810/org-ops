/* ============================================================
   org-ops 共有サーバー（Cloudflare Workers）
   ------------------------------------------------------------
   アプリの「③共有サーバー」モードで使う、データの置き場所。
   保存先は Cloudflare KV（無料枠で十分動く）。

   API
     GET    /api/meta   … いまの版数と更新時刻だけを返す（軽い確認用）
     GET    /api/data   … データ本体を返す
     PUT    /api/data   … データを保存する（{ rev, payload }）
                          rev が古いと 409 を返し、上書き事故を防ぐ
     GET    /           … 動作確認用の簡単な画面

   認証
     すべての /api/* で、ヘッダ X-Team-Key が
     環境変数 TEAM_KEY と一致することを求める。
     TEAM_KEY は社内の人にだけ伝える合言葉。

   デプロイ
     server/README.md を参照（deploy.ps1 で半自動）
   ============================================================ */

const KEY = 'orgops:data';

function cors(extra){
  return Object.assign({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-Team-Key',
    'Access-Control-Max-Age': '86400'
  }, extra || {});
}
function json(obj, status){
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: cors({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  });
}
function authOk(request, env){
  const need = env.TEAM_KEY || '';
  if (!need) return null;                       // 合言葉が未設定＝設定漏れ。開けずに止める
  return request.headers.get('X-Team-Key') === need;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors() });
    }

    /* 動作確認用の画面 */
    if (url.pathname === '/' || url.pathname === '') {
      return new Response(
        '<!doctype html><meta charset="utf-8"><title>org-ops 共有サーバー</title>' +
        '<div style="font-family:sans-serif;padding:40px;line-height:1.9;max-width:720px;">' +
        '<h2>org-ops 共有サーバーは動いています</h2>' +
        '<p>このアドレスを、アプリの「設定・データ」→「会社のメンバーと共有する」→' +
        '「共有サーバーのアドレス」に貼り付けてください。合言葉も同じ画面に入れます。</p>' +
        '<p style="color:#666;font-size:13px;">このページ自体にデータは表示されません。' +
        'データの読み書きには合言葉が必要です。</p></div>',
        { status: 200, headers: cors({ 'Content-Type': 'text/html; charset=utf-8' }) });
    }

    if (!url.pathname.startsWith('/api/')) {
      return json({ error: 'not found' }, 404);
    }
    const authed = authOk(request, env);
    if (authed === null) {
      return json({ error: 'このサーバーは合言葉（TEAM_KEY）が設定されていないため、使えません。管理者に連絡してください。' }, 503);
    }
    if (!authed) {
      return json({ error: 'unauthorized' }, 401);
    }
    if (!env.ORG_OPS) {
      return json({ error: 'KV namespace (ORG_OPS) が設定されていません' }, 500);
    }

    /* --- 版数と更新時刻だけ --- */
    if (url.pathname === '/api/meta' && request.method === 'GET') {
      const cur = await env.ORG_OPS.get(KEY, 'json');
      return json(cur
        ? { rev: cur.rev || 0, updatedAt: cur.updatedAt || '', updatedBy: cur.updatedBy || '' }
        : { rev: 0, updatedAt: '', updatedBy: '', empty: true });
    }

    /* --- データの取得 --- */
    if (url.pathname === '/api/data' && request.method === 'GET') {
      const cur = await env.ORG_OPS.get(KEY, 'json');
      if (!cur) return json({ rev: 0, empty: true });
      return json(cur);
    }

    /* --- データの保存 --- */
    if (url.pathname === '/api/data' && request.method === 'PUT') {
      let body;
      try { body = await request.json(); }
      catch (e) { return json({ error: 'JSONとして読めません' }, 400); }

      const payload = body && body.payload;
      if (!payload || !payload.data) return json({ error: 'payload がありません' }, 400);

      const cur = await env.ORG_OPS.get(KEY, 'json');
      const curRev = cur ? (cur.rev || 0) : 0;
      const sentRev = typeof body.rev === 'number' ? body.rev : 0;

      /* rev が -1 のときは強制上書き（利用者が「自分の内容で上書きする」を選んだ場合） */
      if (sentRev !== -1 && cur && sentRev !== curRev) {
        return json({
          conflict: true, rev: curRev,
          updatedAt: cur.updatedAt || '', updatedBy: cur.updatedBy || ''
        }, 409);
      }

      const next = {
        rev: curRev + 1,
        updatedAt: payload.updatedAt || new Date().toISOString(),
        updatedBy: payload.updatedBy || '',
        app: 'org-ops',
        data: payload.data
      };
      await env.ORG_OPS.put(KEY, JSON.stringify(next));
      return json({ ok: true, rev: next.rev, updatedAt: next.updatedAt });
    }

    return json({ error: 'not found' }, 404);
  }
};
