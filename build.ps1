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

if (-not (Test-Path $dist)) { New-Item -ItemType Directory -Path $dist | Out-Null }

$utf8 = New-Object System.Text.UTF8Encoding($false)

function Read-Utf8($path) {
  return [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
}

# --- CSS ---
$css = Read-Utf8 (Join-Path $src 'styles.css')

# --- JS（ファイル名の昇順で結合。01-core.js → 99-app.js の順になる） ---
$jsFiles = Get-ChildItem (Join-Path $src 'js') -Filter '*.js' | Sort-Object Name
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
