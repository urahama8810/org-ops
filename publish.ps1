# ============================================================
#  publish.ps1  社内向けアドレスの更新（GitHub Pages）
#  ------------------------------------------------------------
#  dist/ のアプリと guide/ のレクチャーを docs/ にコピーし、
#  GitHub へ push します。公開先は README のアドレスです。
#
#  使い方:  .\publish.ps1
# ============================================================
param(
  [string]$Repo    = 'org-ops',
  [string]$Message = ''
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Say($m, $c = 'White') { Write-Host $m -ForegroundColor $c }

$app   = Join-Path $root 'dist\評価制度・組織管理アプリ.html'
$guide = Join-Path $root 'guide\使い方レクチャー.html'
$docs  = Join-Path $root 'docs'

if (-not (Test-Path $app))   { throw "アプリが見つかりません。先に .\build.ps1 を実行してください。" }
if (-not (Test-Path $guide)) { throw "レクチャーが見つかりません。先に guide\tools\make-guide.ps1 を実行してください。" }

# --- docs/ を作る ---
if (-not (Test-Path $docs)) { New-Item -ItemType Directory -Path $docs | Out-Null }
Copy-Item $app   (Join-Path $docs 'index.html') -Force
Copy-Item $guide (Join-Path $docs 'guide.html') -Force
if (-not (Test-Path (Join-Path $docs '.nojekyll'))) {
  New-Item -ItemType File -Path (Join-Path $docs '.nojekyll') | Out-Null
}

$appKb   = [math]::Round((Get-Item (Join-Path $docs 'index.html')).Length / 1KB, 1)
$guideMb = [math]::Round((Get-Item (Join-Path $docs 'guide.html')).Length / 1MB, 1)
Say "docs/index.html  $appKb KB"
Say "docs/guide.html  $guideMb MB"

# --- git ---
& git add -A
$st = & git status --porcelain
if ($st) {
  $msg = if ($Message) { $Message } else { "更新 $(Get-Date -Format 'yyyy-MM-dd HH:mm')" }
  & git commit -m $msg
} else {
  Say '変更はありません。' 'Yellow'
}
& git push

$owner = (& gh api user --jq '.login')
Say ''
Say '===== 更新しました =====' 'Green'
Say ''
Say "アプリ　　　　： https://$owner.github.io/$Repo/" 'Yellow'
Say "使い方レクチャー： https://$owner.github.io/$Repo/guide.html" 'Yellow'
Say ''
Say '反映まで1〜2分かかることがあります。'
Say ''
