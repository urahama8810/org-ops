# ============================================================
#  評価制度・組織管理体制 運用アプリ  ビルドスクリプト
#  src/ の CSS と JS を 1つのHTMLファイルにまとめて dist/ に出力する
#  使い方:  PowerShell で  .\build.ps1  を実行
# ============================================================

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$src  = Join-Path $root 'src'
$dist = Join-Path $root 'dist'
$out  = Join-Path $dist '評価制度・組織管理アプリ.html'

# --- ビルドの前に、必ず検査を通す ---------------------------
#  ここで止まったら、公開用ファイルは作られません。
#  「直したつもりが別のところを壊していた」を防ぐための関所です。
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
  Write-Host "検査を実行しています..." -ForegroundColor Cyan
  & node (Join-Path $root 'test/all.js')
  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "検査で問題が見つかったため、ビルドを中止しました。" -ForegroundColor Red
    Write-Host "上に出ている内容を直してから、もう一度 build.ps1 を実行してください。" -ForegroundColor Red
    exit 1
  }
  Write-Host "検査に合格しました。ビルドを続けます。" -ForegroundColor Green
} else {
  Write-Host "Node.js が見つからないため、検査を飛ばしました。" -ForegroundColor Yellow
}
# ------------------------------------------------------------

if (-not (Test-Path $dist)) { New-Item -ItemType Directory -Path $dist | Out-Null }

$utf8 = New-Object System.Text.UTF8Encoding($false)

function Read-Utf8($path) {
  return [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
}

# --- CSS ---
$css = Read-Utf8 (Join-Path $src 'styles.css')

# --- JS（ファイル名の昇順で結合。01-core.js → 99-app.js の順になる）
#     Sort-Object は日本語環境だとハイフンを軽く扱うため、
#     04-dashboard.js と 04b-me.js の前後が入れ替わることがある。
#     そこで文字コード順（Ordinal）で明示的に並べる ---
$jsDir   = Join-Path $src 'js'
$jsNames = @(Get-ChildItem $jsDir -Filter '*.js' | ForEach-Object { $_.Name })
[Array]::Sort($jsNames, [StringComparer]::Ordinal)
$jsFiles = $jsNames | ForEach-Object { Get-Item (Join-Path $jsDir $_) }
$parts = @()
foreach ($f in $jsFiles) {
  $parts += "/* ===== $($f.Name) ===== */"
  $parts += (Read-Utf8 $f.FullName)
}
$js = ($parts -join "`r`n")

# --- テンプレートへ差し込み ---
$html = Read-Utf8 (Join-Path $src 'index-template.html')
$html = $html.Replace('__CSS__', $css)
$html = $html.Replace('__JS__',  $js)

[System.IO.File]::WriteAllText($out, $html, $utf8)

$kb = [math]::Round((Get-Item $out).Length / 1KB, 1)
Write-Host "ビルド完了: $out ($kb KB)"
Write-Host "結合したJSファイル: $($jsFiles.Count) 個"
