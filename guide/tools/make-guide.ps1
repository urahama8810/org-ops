# ============================================================
#  make-guide.ps1  使い方レクチャー動画の生成
#   1. シナリオの各コマをアプリ本体に注入し、ヘッドレスEdgeで撮影
#   2. 撮影した画像を1つのHTML（動画プレーヤー）にまとめる
#  使い方:  .\make-guide.ps1              全部やり直す（約6分）
#           .\make-guide.ps1 -SkipShoot   撮影済みの画像から組み立て直すだけ
# ============================================================
param([switch]$SkipShoot)
$ErrorActionPreference = 'Stop'

$tools  = Split-Path -Parent $MyInvocation.MyCommand.Path
$guide  = Split-Path -Parent $tools
$root   = Split-Path -Parent $guide
$app    = Join-Path $root 'dist\評価制度・組織管理アプリ.html'
$frames = Join-Path $guide 'frames'
$out    = Join-Path $guide '使い方レクチャー.html'
$work   = Join-Path $env:TEMP 'orgops-guide'

$W = 1440; $H = 810      # 16:9

$edge = @(
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files\Google\Chrome\Application\chrome.exe",
  "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw "Edge または Chrome が見つかりません" }

$dirs = if ($SkipShoot) { @($work) } else { @($frames, $work) }
foreach ($d in $dirs) {
  if (Test-Path $d) { Remove-Item -LiteralPath $d -Recurse -Force }
  New-Item -ItemType Directory -Path $d | Out-Null
}
if ($SkipShoot -and -not (Test-Path $frames)) { throw "撮影済み画像がありません。-SkipShoot を外して実行してください。" }

$utf8no = New-Object System.Text.UTF8Encoding($false)
function Read8($p){ [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8) }
function Write8($p,$t){ [System.IO.File]::WriteAllText($p, $t, $utf8no) }

Write-Host "台本を読み込みます..."
$dump = Join-Path $work 'dump.js'
Write8 $dump @"
const fs=require('fs'), vm=require('vm');
const ctx={ DB:{data:{employees:[],oneOnOnes:[],kpiWeeks:[],evaluations:[]}}, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(process.argv[2],'utf8'), ctx);
const meta = ctx.SCENARIO.map(function(s,i){
  const plain = function(x){ return (x||'').replace(/<[^>]+>/g,''); };
  return { i:i, sec:s.sec||6,
    kind: s.title ? 'title' : (s.chapterTitle ? 'chapter' : 'step'),
    label: s.title || s.chapterTitle || s.chapter || '',
    text: plain(s.text||s.chapterDesc||''),
    sub:  plain(s.sub||''),
    say:  plain(s.say || ((s.text||s.chapterDesc||'') + ' ' + (s.sub||''))) };
});
fs.writeFileSync(process.argv[3], JSON.stringify(meta), 'utf8');
"@
$scenarioPath = Join-Path $tools 'scenario.js'
# 標準出力経由だと日本語が化けるため、いったんUTF-8のファイルに書き出して読み直す
$metaPath = Join-Path $work 'meta.json'
& node $dump $scenarioPath $metaPath | Out-Null
if (-not (Test-Path $metaPath)) { throw "台本の読み込みに失敗しました" }
$metaJson = Read8 $metaPath
$meta = $metaJson | ConvertFrom-Json
$total = $meta.Count
Write-Host "  コマ数: $total  合計 $([math]::Round(($meta | Measure-Object -Property sec -Sum).Sum,0)) 秒"

$html      = Read8 $app
$narrator  = Read8 (Join-Path $tools 'narrator.js')
$scenario  = Read8 $scenarioPath
$anchor    = $html.LastIndexOf('</body>')
$head      = $html.Substring(0, $anchor)
$tail      = $html.Substring($anchor)
$tagOpen   = '<' + 'script>'
$tagClose  = '</' + 'script>'

if ($SkipShoot) { Write-Host "撮影は省略し、既存のコマ画像を使います。" }
else {
Write-Host "撮影します（$W x $H）..."
$suspect = @()
for ($i = 0; $i -lt $total; $i++) {
  $inject = $tagOpen + $narrator + $tagClose + "`r`n" +
            $tagOpen + $scenario + $tagClose + "`r`n" +
            $tagOpen + "window.addEventListener('load',function(){setTimeout(function(){__runStep($i);},80);});" + $tagClose + "`r`n"
  $page = Join-Path $work ("f{0:d3}.html" -f $i)
  Write8 $page ($head + $inject + $tail)
  $png  = Join-Path $frames ("{0:d3}.png" -f $i)
  $url  = 'file:///' + ($page -replace '\\','/')
  # Edge は正常終了時も stderr にログを出すため、一時的にエラー停止を解除する
  $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  & $edge --headless=new --disable-gpu --no-sandbox --hide-scrollbars --log-level=3 `
          --virtual-time-budget=5000 --window-size="$W,$H" `
          --screenshot="$png" $url 2>$null | Out-Null
  $ErrorActionPreference = $prev
  if (-not (Test-Path $png)) { throw "コマ $i の撮影に失敗しました" }
  $kb = [math]::Round((Get-Item $png).Length / 1KB)
  # 極端に軽いコマは白紙の疑いがあるので目印を出す
  $warn = ''
  if ($kb -lt 25 -and $meta[$i].kind -eq 'step') { $warn = '   ← 要確認'; $suspect += $i }
  Write-Host ("  [{0,2}/{1}] {2,-22} {3,4} KB{4}" -f ($i+1), $total, $meta[$i].label, $kb, $warn)
}
if ($suspect.Count) { Write-Host "  ※ 中身が薄い可能性のあるコマ: $($suspect -join ', ')" -ForegroundColor Yellow }
}

Write-Host "動画プレーヤーを組み立てます..."
$imgs = @()
$data = @()
for ($i = 0; $i -lt $total; $i++) {
  $b64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes((Join-Path $frames ("{0:d3}.png" -f $i))))
  $imgs += '"data:image/png;base64,' + $b64 + '"'
  $m = $meta[$i]
  $esc = { param($s) ($s -replace '\\','\\' -replace '"','\"' -replace "`r?`n",' ') }
  $data += '{d:' + $m.sec + ',k:"' + $m.kind + '",l:"' + (& $esc $m.label) + '",t:"' + (& $esc $m.text) +
           '",s:"' + (& $esc $m.sub) + '",n:"' + (& $esc $m.say) + '"}'
}
$player = Read8 (Join-Path $tools 'player-template.html')
$player = $player.Replace('/*__FRAMES__*/', ($data -join ",`r`n"))
$player = $player.Replace('/*__IMAGES__*/', ($imgs -join ",`r`n"))
Write8 $out $player

$mb = [math]::Round((Get-Item $out).Length / 1MB, 1)
Write-Host ""
Write-Host "完成: $out ($mb MB)"
Write-Host "コマ画像: $frames"
Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
