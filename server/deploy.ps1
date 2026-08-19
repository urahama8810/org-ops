# ============================================================
#  共有サーバーを立てるスクリプト（Cloudflare Workers）
#  ------------------------------------------------------------
#  社外や自宅からも同じデータを使いたい場合だけ必要です。
#  社内の共有フォルダで足りる場合は、これを実行する必要はありません。
#
#  やること
#    1. Cloudflare へのログイン（ブラウザが開きます。1回だけ）
#    2. データの置き場所（KV）を作る
#    3. 合言葉（チームキー）を設定する
#    4. サーバーを公開して、アドレスを表示する
#
#  使い方:  PowerShell で  .\deploy.ps1
#           合言葉を指定する場合  .\deploy.ps1 -TeamKey "あいことば"
# ============================================================
param([string]$TeamKey = '')

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

function Say($msg, $color = 'White') { Write-Host $msg -ForegroundColor $color }

Say ''
Say '===== org-ops 共有サーバーの設置 =====' 'Cyan'
Say ''

# --- Node.js の確認 ---
try { $nodeVer = & node -v } catch { throw 'Node.js が見つかりません。https://nodejs.org からインストールしてください。' }
Say "Node.js: $nodeVer"

# --- 合言葉 ---
if (-not $TeamKey) {
  $TeamKey = -join ((1..5) | ForEach-Object {
    (@('sakura','midori','yamato','hikari','tsubasa','kaze','umi','hoshi','mori','kawa') | Get-Random)
  })
  Say ''
  Say "合言葉を自動で作りました： $TeamKey" 'Yellow'
  Say '（あとで変えられます。社内の人にだけ伝えてください）'
}

# --- 1. ログイン ---
Say ''
Say '[1/4] Cloudflare にログインします。ブラウザが開いたら「Allow」を押してください。' 'Cyan'
Say '      アカウントがない場合は、その画面から無料で作成できます。'
& npx --yes wrangler@latest login
if ($LASTEXITCODE -ne 0) { throw 'ログインに失敗しました。' }

# --- 2. KV（データの置き場所）---
Say ''
Say '[2/4] データの置き場所を作ります。' 'Cyan'
$kvOut = & npx --yes wrangler@latest kv namespace create ORG_OPS 2>&1 | Out-String
Write-Host $kvOut
$m = [regex]::Match($kvOut, 'id\s*=\s*"([0-9a-f]{32})"')
if (-not $m.Success) { $m = [regex]::Match($kvOut, '"id"\s*:\s*"([0-9a-f]{32})"') }
if (-not $m.Success) {
  Say '既に作成済みの可能性があります。一覧から探します。' 'Yellow'
  $listOut = & npx --yes wrangler@latest kv namespace list 2>&1 | Out-String
  $m = [regex]::Match($listOut, '"id"\s*:\s*"([0-9a-f]{32})"[^}]*ORG_OPS')
  if (-not $m.Success) { $m = [regex]::Match($listOut, 'ORG_OPS[^}]*"id"\s*:\s*"([0-9a-f]{32})"') }
}
if (-not $m.Success) { throw 'データの置き場所（KV）のIDを取得できませんでした。上の出力を確認してください。' }
$kvId = $m.Groups[1].Value
Say "  置き場所ID: $kvId" 'Green'

$tomlPath = Join-Path $here 'wrangler.toml'
$toml = [System.IO.File]::ReadAllText($tomlPath, [System.Text.Encoding]::UTF8)
$toml = [regex]::Replace($toml, 'id\s*=\s*"[^"]*"', ('id = "' + $kvId + '"'))
[System.IO.File]::WriteAllText($tomlPath, $toml, (New-Object System.Text.UTF8Encoding($false)))

# --- 3. 合言葉 ---
Say ''
Say '[3/4] 合言葉を設定します。' 'Cyan'
$TeamKey | & npx --yes wrangler@latest secret put TEAM_KEY
if ($LASTEXITCODE -ne 0) { throw '合言葉の設定に失敗しました。' }

# --- 4. 公開 ---
Say ''
Say '[4/4] サーバーを公開します。' 'Cyan'
$dep = & npx --yes wrangler@latest deploy 2>&1 | Out-String
Write-Host $dep
$u = [regex]::Match($dep, 'https://[a-z0-9\-\.]+\.workers\.dev')
$url = if ($u.Success) { $u.Value } else { '（上の出力の https://... がアドレスです）' }

Say ''
Say '===== 完了しました =====' 'Green'
Say ''
Say "共有サーバーのアドレス： $url" 'Yellow'
Say "合言葉（チームキー）  ： $TeamKey" 'Yellow'
Say ''
Say 'アプリの「設定・データ」→「会社のメンバーと共有する」に、この2つを入力してください。'
Say '社内の全員が同じアドレスと合言葉を入れると、同じデータを見られるようになります。'
Say ''
