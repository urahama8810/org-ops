/* ============================================================
   player-test.js  レクチャー再生の検証
   ------------------------------------------------------------
   「ナレーションが途中で切れる」不具合の再発を防ぐためのテスト。
     ・原稿が、ブラウザが打ち切らない長さに分割されること
     ・分割しても文字が欠けないこと
     ・読み上げが終わるまで次のコマへ進まない作りであること
   ============================================================ */
const fs = require('fs'), path = require('path'), vm = require('vm');

const ROOT   = path.join(__dirname, '..');
const player = fs.readFileSync(path.join(ROOT, 'guide', 'tools', 'player-template.html'), 'utf8');

let fail = 0;
function t(name, fn){
  try{ fn(); console.log('  OK   ' + name); }
  catch(e){ fail++; console.log('  NG   ' + name + '\n       → ' + e.message); }
}

/* プレーヤーから読み上げ関連の関数だけを取り出す */
function grab(name){
  const re = new RegExp('function\\s+' + name + '\\s*\\([\\s\\S]*?\\n\\}', 'm');
  const m = player.match(re);
  if(!m) throw new Error('関数が見つかりません: ' + name);
  return m[0];
}
const sandbox = { speed:1, console };
vm.createContext(sandbox);
vm.runInContext(grab('splitSay') + '\n' + grab('estSec'), sandbox);
const splitSay = sandbox.splitSay;

/* 台本の全ナレーションを読み込む */
const scenarioCtx = { DB:{data:{employees:[],oneOnOnes:[],kpiWeeks:[],evaluations:[]}}, console };
vm.createContext(scenarioCtx);
vm.runInContext(fs.readFileSync(path.join(ROOT,'guide','tools','scenario.js'),'utf8'), scenarioCtx);
const says = scenarioCtx.SCENARIO.map(s =>
  s.say || ((s.text||s.chapterDesc||'') + ' ' + (s.sub||'')).replace(/<[^>]+>/g,'')
);

console.log('■ ナレーションの分割（' + says.length + 'コマ）');

t('1回の読み上げが40文字を超えない', ()=>{
  says.forEach((say, i)=>{
    splitSay(say).forEach(p=>{
      if(p.length > 40) throw new Error('コマ'+i+' に '+p.length+'文字の発話: '+p.slice(0,30)+'…');
    });
  });
});

t('分割しても文字が欠けない', ()=>{
  says.forEach((say, i)=>{
    const joined = splitSay(say).join('');
    if(joined.replace(/\s/g,'') !== say.replace(/\s/g,''))
      throw new Error('コマ'+i+' で文字が欠けた\n  元: '+say.slice(0,40)+'\n  後: '+joined.slice(0,40));
  });
});

t('空の発話が混ざらない', ()=>{
  says.forEach((say, i)=>{
    splitSay(say).forEach(p=>{
      if(!p.replace(/\s/g,'')) throw new Error('コマ'+i+' に空の発話');
    });
  });
});

t('句点で区切られる', ()=>{
  const parts = splitSay('あいうえお。かきくけこ。さしすせそ。');
  if(parts.length !== 3) throw new Error('3つに分かれるはず: '+JSON.stringify(parts));
});

t('句読点のない長文も強制的に分割される', ()=>{
  const long = 'あ'.repeat(200);
  const parts = splitSay(long);
  if(parts.some(p=>p.length > 40)) throw new Error('40文字超が残っている');
  if(parts.join('') !== long) throw new Error('文字が欠けた');
});

t('空文字を渡しても落ちない', ()=>{
  if(splitSay('').length !== 0) throw new Error('空配列であるべき');
  if(splitSay(null).length !== 0) throw new Error('空配列であるべき');
});

t('読み上げ時間の見積もりが妥当', ()=>{
  const e = sandbox.estSec({ n:'あ'.repeat(62) });      /* 62文字 ≒ 10秒 + 余裕2秒 */
  if(e < 8 || e > 16) throw new Error('見積もり='+e+'秒');
  if(sandbox.estSec({ n:'' }) !== 0) throw new Error('原稿なしは0秒であるべき');
});

console.log('\n■ コマ送りの作り');

t('読み上げ中は次のコマへ進まない', ()=>{
  if(!/ready\s*=\s*\(spokenDone\s*&&\s*!speaking/.test(player))
    throw new Error('spokenDone と speaking の両方を見て送る作りになっていない');
});
t('固まった場合の打ち切り上限がある', ()=>{
  if(!/var limit = Math\.max\(f\.d, estSec\(f\) \* 2 \+ 20\)/.test(player))
    throw new Error('打ち切り上限が見当たらない');
});
t('最後のコマも読み終えてから停止する', ()=>{
  const m = player.match(/if\(ready\)\{[\s\S]{0,200}?FRAMES\.length-1/);
  if(!m) throw new Error('最終コマの停止処理が見当たらない');
});
t('長時間の読み上げが止まる不具合への対策が入っている', ()=>{
  if(!/speechSynthesis\.pause\(\); speechSynthesis\.resume\(\);/.test(player))
    throw new Error('pause/resume による息継ぎ処理がない');
});
t('一時停止したら、その文から読み直す', ()=>{
  if(!/speakFrame\(curPart\)/.test(player)) throw new Error('curPart からの再開になっていない');
  if(!/function pause\(\)\{[\s\S]*?stopSpeak\(\);/.test(player)) throw new Error('一時停止で読み上げを止めていない');
});

console.log('\n■ 台本');

t('全コマにナレーションがある', ()=>{
  scenarioCtx.SCENARIO.forEach((s,i)=>{
    if(!(s.say||'').trim()) throw new Error('コマ'+i+' にナレーションがない');
  });
});
t('1コマのナレーションが長すぎない（目安260文字）', ()=>{
  scenarioCtx.SCENARIO.forEach((s,i)=>{
    if((s.say||'').length > 260) throw new Error('コマ'+i+' が '+s.say.length+'文字');
  });
});
t('読み間違いやすい語が、読みで書かれている', ()=>{
  scenarioCtx.SCENARIO.forEach((s,i)=>{
    if(/1on1/.test(s.say||'')) throw new Error('コマ'+i+'：1on1 は「ワンオンワン」と書く');
    if(/\bKPI\b/.test(s.say||'')) throw new Error('コマ'+i+'：KPI は「ケーピーアイ」と書く');
  });
});

const total = scenarioCtx.SCENARIO.reduce((a,s)=>a+(s.sec||6),0);
const chars = says.reduce((a,s)=>a+s.length,0);
console.log('\n  コマ数 ' + scenarioCtx.SCENARIO.length +
            '／最低表示 ' + Math.round(total/60) + '分' +
            '／ナレーション ' + chars + '文字（読み上げおよそ ' + Math.round(chars/6.2/60) + '分）');

console.log('\n================================');
console.log(fail ? '失敗 ' + fail + ' 件' : 'すべて成功');
process.exit(fail ? 1 : 0);
