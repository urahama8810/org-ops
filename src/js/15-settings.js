/* ============================================================
   15-settings.js  設定・データ管理・使い方
   ============================================================ */

VIEWS.settings = {
  title:'設定・データ',
  desc:'会社の情報、承認の基準、データのバックアップをまとめて管理します。',
  render:function(){
    var d = DB.data;
    var h = '';

    /* 基本設定 */
    h += card('会社・プロジェクトの設定',
      '<div class="form-grid">'+
      fieldHtml({key:'companyName', label:'会社名'}, d.settings.companyName)+
      fieldHtml({key:'ceoName', label:'代表取締役（最終責任者）', hint:'方針・会社目標・重要権限の最終決定者'}, d.settings.ceoName)+
      fieldHtml({key:'projectLead', label:'この取り組みの進行役', hint:'進行、期限、資料のとりまとめ、会議の運営。1名を必ず決めます。'}, d.settings.projectLead)+
      fieldHtml({key:'hrOwner', label:'管理／人事担当', hint:'台帳、1on1、評価記録、文書管理'}, d.settings.hrOwner)+
      fieldHtml({key:'externalAdvisor', label:'外部確認（社労士等）', hint:'就業規則・賃金規程・報酬連動の確認'}, d.settings.externalAdvisor)+
      fieldHtml({key:'startDate', label:'プロジェクト開始日', type:'date', hint:'この日から90日の進捗を数えます。'}, d.settings.startDate)+
      fieldHtml({key:'ceoEmpId', label:'最終決裁者にあたる人', type:'select', options:empOptions(true),
                 hint:'社員台帳に登録済みの場合に選びます。'}, d.settings.ceoEmpId)+
      fieldHtml({key:'maxDirectReports', label:'直属部下の上限人数', type:'number', min:1, max:20,
                 hint:'原則4〜6人以内。'}, d.settings.maxDirectReports)+
      fieldHtml({key:'approvalAmount', label:'事前承認が必要な金額（円）', type:'number',
                 hint:'この金額以上の支出・契約は事前承認とします。'}, d.settings.approvalAmount)+
      fieldHtml({key:'meetingDay', label:'週次KPI会議の曜日', type:'select',
                 options:['月曜','火曜','水曜','木曜','金曜','土曜','日曜']}, d.settings.meetingDay)+
      fieldHtml({key:'meetingTime', label:'週次KPI会議の時刻'}, d.settings.meetingTime)+
      fieldHtml({key:'currentPeriod', label:'現在の評価期間', hint:'例：2026-Q3'}, d.settings.currentPeriod)+
      '</div>'+
      '<div class="btn-row"><button class="btn primary" data-act="setSave">設定を保存</button></div>',
      {icon:'settings'});

    /* 報酬連動 */
    h += card('評価を給与に結びつける前に',
      '<div class="help-block">'+
      '<b>第1四半期：</b>評価のみ。給与・賞与へ原則連動させず、基準と評価者差を修正する。<br>'+
      '<b>第2四半期：</b>制度が安定した場合、賞与の一部への連動を検討する。<br>'+
      '<b>その後：</b>等級・昇給・賞与・昇進・配置転換との連動を、労務確認のうえ段階導入する。</div>'+
      '<label class="chk"><input type="checkbox" data-change="setPayLinked"'+(d.settings.payLinked?' checked':'')+'>'+
      '<span><b>評価を報酬に連動させている</b>（チェックすると警告表示が変わります）</span></label>'+
      '<label class="chk"><input type="checkbox" data-change="setLaborCheck"'+(d.settings.laborCheckDone?' checked':'')+'>'+
      '<span>就業規則・賃金規程との整合を社労士等へ確認済み'+
      (d.settings.laborCheckDate?'（'+esc(d.settings.laborCheckDate)+'）':'')+'</span></label>'+
      (d.settings.payLinked && !d.settings.laborCheckDone ?
        '<div class="alert bad" style="margin-top:10px;"><span class="ic">'+ic('alert',15)+'</span><div class="body">'+
        '<div class="t">確認が未完了のまま報酬連動が有効です</div>'+
        '<div class="d">減給・賞与・降格等への連動は、就業規則・賃金規程との整合や必要な手続を確認してから行ってください。</div></div></div>' : ''),
      {icon:'alert'});

    /* 社内への配り方 */
    h += card('このアプリを社内に配る',
      '<div class="help-block">'+
      '<b>インストールは要りません。</b>下のアドレスを社内のメンバーに伝えるだけで、'+
      'パソコンでもスマートフォンでも同じアプリが開きます。'+
      '初めての人には、先に使い方の動画を見てもらってください。</div>'+
      '<div class="form-grid">'+
      fieldHtml({key:'appUrl', label:'アプリのアドレス', readonly:true,
                 hint:'このまま社内メールやチャットに貼り付けてください。'}, APP_URL)+
      fieldHtml({key:'guideUrl', label:'使い方の動画のアドレス', readonly:true,
                 hint:'ナレーション付きの解説です。'}, GUIDE_URL)+
      '</div>'+
      '<div class="btn-row">'+
        '<a class="btn primary" href="'+GUIDE_URL+'" target="_blank" rel="noopener">'+ic('play',14)+'使い方の動画を開く</a>'+
        '<button class="btn" data-act="copyAppUrl">'+ic('copy',14)+'アドレスをコピー</button>'+
        '<button class="btn" data-act="introShow">'+ic('info',14)+'はじめての案内をもう一度出す</button>'+
        '<button class="btn" data-act="mePick">'+ic('users',14)+'「わたしの画面」の人を選び直す</button>'+
      '</div>',
      {icon:'cloud', sub:'アドレスを開くだけで使えます'});

    /* 共有（会社のメンバーと一緒に使う） */
    h += renderSyncCard();

    /* データ管理 */
    var size = 0;
    try{ size = Math.round((localStorage.getItem(STORAGE_KEY)||'').length/1024); }catch(e){}
    h += card('データの保存とバックアップ',
      '<div class="help-block">'+
      '<b>データはこのパソコンのブラウザの中に保存されます。</b> どこかへ自動で送られることはありません。<br>'+
      '別のパソコンで使う場合、またはバックアップを残す場合は「バックアップを保存」でファイルに書き出してください。'+
      'ブラウザの履歴削除でデータが消えることがあるため、<b>週に1回はバックアップ</b>を取ることをおすすめします。</div>'+
      '<div class="grid c3" style="margin-bottom:14px;">'+
        tile('社員', d.employees.length+'<small>名</small>','','')+
        tile('記録の総数',
          (d.goals.length+d.scorecards.length+d.kpiWeeks.length+d.oneOnOnes.length+
           d.evaluations.length+d.reports.length+d.incidents.length+d.improvementPlans.length)+'<small>件</small>','','')+
        tile('データ量', size+'<small>KB</small>', '最終更新：'+fmtJp(d.meta.updatedAt),'')+
      '</div>'+
      '<div class="btn-row">'+
        '<button class="btn primary" data-act="dataExport">バックアップを保存（JSON）</button>'+
        '<button class="btn" data-act="dataImport">バックアップから復元</button>'+
        '<button class="btn" data-act="dataCsvAll">全データをCSVで書き出す</button>'+
        '<button class="btn" data-act="dataDemo">サンプルデータを入れる</button>'+
        '<button class="btn danger" data-act="dataClear">全データを削除</button>'+
      '</div>',
      {icon:'download', sub:'保存場所：このブラウザの中'});

    /* 使い方 */
    h += card('この1年の流れ',
      '<div class="grid c2"><div class="col">'+
      '<h4>毎週やること</h4><ol class="list-plain" style="padding-left:18px;">'+
      '<li>週次KPI会議（45分）— 「週次KPI会議」画面で会議モードを開き、実績を入力する</li>'+
      '<li>未達項目に対策・担当者・期限を入れる</li>'+
      '<li>その場で決まらなかった件を記録する</li></ol>'+
      '<h4 style="margin-top:12px;">毎月やること</h4><ol class="list-plain" style="padding-left:18px;">'+
      '<li>全員と1on1（30分）— 「月次1on1」画面で記録</li>'+
      '<li>前回の約束の結果を確認する</li>'+
      '<li>会社・部門目標の最新値を更新する</li></ol>'+
      '</div><div class="col">'+
      '<h4>四半期ごと</h4><ol class="list-plain" style="padding-left:18px;">'+
      '<li>「四半期評価」で評価シートを一括作成</li>'+
      '<li>自己評価 → 上司評価 → 調整 → 確定 → 本人説明</li>'+
      '<li>評価者差を確認し、基準のズレを直す</li>'+
      '<li>評価2以下の社員には改善計画を作る</li></ol>'+
      '<h4 style="margin-top:12px;">その都度</h4><ol class="list-plain" style="padding-left:18px;">'+
      '<li>悪い情報・遅延・クレームは「報告・承認ルール」に記録</li>'+
      '<li>問題が起きたら5ステップで処理記録</li>'+
      '<li>例外を認めたら必ず記録する</li></ol>'+
      '</div></div>',
      {icon:'book', sub:'迷ったら「会社全体」の“いま気になっていること”を見てください'});

    h += '<div class="small muted center" style="margin-top:20px;">'+
      esc(APP_NAME)+'　v'+APP_VERSION+'　／　社内で使う組織運営アプリ</div>';
    return h;
  }
};

/* ---------- 共有の設定 ---------- */
function renderSyncCard(){
  var cfg = (typeof SYNC !== 'undefined') ? SYNC.cfg : { mode:'local' };
  var mode = cfg.mode || 'local';
  var canFolder = (typeof syncSupported === 'function') ? syncSupported() : false;

  var body = '<div class="help-block">'+
    '<b>このアプリは、同じデータを全員で見られます。</b>使い方は3つあります。'+
    '<br>① <b>このパソコンのみ</b>：データはこのブラウザの中だけ。1人で使う場合。'+
    '<br>② <b>共有フォルダ</b>：会社のOneDrive・SharePoint・Googleドライブなど、'+
    '全員のパソコンで同期されているフォルダを選ぶだけ。サーバーも登録も不要です。'+
    '<br>③ <b>共有サーバー</b>：社外や自宅からも同じデータを見たい場合。アドレスと合言葉を入れます。'+
    '</div>';

  body += '<div class="alert '+(mode==='local'?'':'ok')+'"><span class="ic">'+ic(mode==='local'?'monitor':'check',15)+'</span>'+
    '<div style="flex:1;"><div class="t">いまの共有方法：'+esc(syncModeLabel())+'</div>'+
    '<div class="d">'+esc(SYNC.message || (mode==='local'
      ? 'データはこのパソコンのブラウザ内だけに保存されています。'
      : '共有先と自動でやりとりしています（15秒ごと、および保存のたび）。'))+'</div></div>'+
    (mode!=='local' ? '<div class="go">'+btn('今すぐ同期','syncNow',{},'primary')+'</div>' : '')+
    '</div>';

  body += '<div class="grid c3" style="margin-top:14px;">';

  /* ① このPCのみ */
  body += '<div class="tile '+(mode==='local'?'accent':'')+'">'+
    '<div class="label">①このパソコンのみ</div>'+
    '<div class="headline">1人で使う</div>'+
    '<div class="note">他のパソコンとはデータを共有しません。持ち出すときはバックアップのJSONを使います。</div>'+
    '<div class="foot">'+(mode==='local'
      ? '<span class="badge accent">選択中</span>'
      : btn('この方法に戻す','syncModeLocal',{}))+'</div></div>';

  /* ② 共有フォルダ */
  body += '<div class="tile '+(mode==='folder'?'accent':'')+'">'+
    '<div class="label">②共有フォルダ（おすすめ）</div>'+
    '<div class="headline">社内の全員で共有</div>'+
    '<div class="note">'+(canFolder
      ? '会社の共有フォルダを1つ選ぶだけ。全員が同じフォルダを選べば、同じデータになります。'
      : 'このブラウザでは使えません。Chrome または Edge で開いてください。')+'</div>'+
    (mode==='folder' ? '<div class="note">ファイル名：'+esc(cfg.fileName||'org-ops-data.json')+'</div>' : '')+
    '<div class="foot">'+
      (canFolder ? btn(mode==='folder'?'フォルダを選び直す':'共有フォルダに接続','syncPickFolder',{},mode==='folder'?'':'primary') : '')+
      (mode==='folder' ? ' <span class="badge accent">選択中</span>' : '')+
    '</div></div>';

  /* ③ 共有サーバー */
  body += '<div class="tile '+(mode==='server'?'accent':'')+'">'+
    '<div class="label">③共有サーバー</div>'+
    '<div class="headline">社外からも使う</div>'+
    '<div class="note">アドレスと合言葉を入れると、どこからでも同じデータを見られます。'+
    '（サーバーの作り方は README に手順があります）</div>'+
    '<div class="foot">'+(mode==='server'?'<span class="badge accent">選択中</span>':'<span class="small muted">下の欄に入力</span>')+'</div>'+
    '</div>';
  body += '</div>';

  body += '<div class="form-grid" style="margin-top:16px;">'+
    fieldHtml({key:'userName', label:'あなたの名前（更新者として記録されます）',
               hint:'共有しているとき、誰が最後に更新したかが分かります。'}, cfg.userName)+
    fieldHtml({key:'serverUrl', label:'共有サーバーのアドレス',
               placeholder:'https://org-ops.〇〇.workers.dev',
               hint:'③を使う場合のみ入力します。'}, cfg.serverUrl)+
    fieldHtml({key:'teamKey', label:'合言葉（チームキー）',
               hint:'サーバー側で決めた合言葉。社内の人だけに伝えてください。'}, cfg.teamKey)+
    '</div>'+
    '<div class="btn-row">'+
      '<button class="btn" data-act="syncUserSave">名前を保存</button>'+
      '<button class="btn primary" data-act="syncServerSave">共有サーバーに接続する</button>'+
    '</div>';

  body += '<div class="help-block" style="margin-top:14px;">'+
    '<b>同時に編集したときは。</b>あとから保存した内容が優先されます。'+
    '相手が先に更新していた場合は確認画面が出るので、「相手の内容を取り込む」か「自分の内容で上書きする」を選んでください。'+
    '週次会議や1on1の記録のように、担当が分かれている使い方なら、ほとんど競合しません。'+
    '</div>';

  return card('会社のメンバーと共有する', body, { sub:'共有方法：'+syncModeLabel() });
}

var SETTING_KEYS = ['companyName','ceoName','projectLead','hrOwner','externalAdvisor','startDate',
                    'ceoEmpId','maxDirectReports','approvalAmount','meetingDay','meetingTime','currentPeriod'];

action('setSave', function(){
  var view = document.getElementById('view');
  SETTING_KEYS.forEach(function(k){
    var el = view.querySelector('[name="f_'+k+'"]');
    if(!el) return;
    DB.data.settings[k] = (k==='maxDirectReports'||k==='approvalAmount') ? num(el.value) : el.value;
  });
  /* プロジェクト体制の表示とも同期 */
  DB.data.projectRoles = DB.data.projectRoles || {};
  DB.data.projectRoles.ceo = DB.data.settings.ceoName;
  DB.data.projectRoles.lead = DB.data.settings.projectLead;
  DB.data.projectRoles.hr = DB.data.settings.hrOwner;
  DB.data.projectRoles.external = DB.data.settings.externalAdvisor;
  DB.save(); render(); toast('設定を保存しました','ok');
});
action('copyAppUrl', function(){
  var txt = 'アプリ：'+APP_URL+'\n使い方の動画：'+GUIDE_URL;
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(txt);
      toast('アドレスをコピーしました','ok');
      return;
    }
  }catch(e){}
  openModal({ title:'アプリのアドレス',
    body:'<div class="help-block">この2行をコピーして、社内に配ってください。</div>'+
         '<textarea rows="3" style="width:100%;">'+esc(txt)+'</textarea>',
    foot:'<button class="btn" data-modal-close>閉じる</button>' });
});

action('setPayLinked', function(ds, el){
  DB.data.settings.payLinked = el.checked; DB.save(); render();
});
action('setLaborCheck', function(ds, el){
  DB.data.settings.laborCheckDone = el.checked;
  DB.data.settings.laborCheckDate = el.checked ? todayStr() : '';
  DB.save(); render();
});

/* ---------- バックアップ ---------- */
action('dataExport', function(){
  var name = (DB.data.settings.companyName||'組織運営').replace(/[\\/:*?"<>|]/g,'');
  download(name+'_評価制度データ_'+todayStr()+'.json', JSON.stringify(DB.data, null, 2), 'application/json');
  toast('バックアップを保存しました','ok');
});

action('dataImport', function(){
  pickFile('.json,application/json', function(text, filename){
    var parsed;
    try{ parsed = JSON.parse(text); }
    catch(e){ toast('ファイルを読み込めませんでした（JSON形式ではありません）','bad'); return; }
    if(!parsed || !parsed.meta || !Array.isArray(parsed.employees)){
      toast('このアプリのバックアップファイルではないようです','bad'); return;
    }
    confirmDialog('バックアップから復元',
      'ファイル：'+filename+'\n'+
      '社員 '+parsed.employees.length+'名／保存日時 '+fmtJp(parsed.meta.updatedAt)+'\n\n'+
      '現在のデータはすべて上書きされます。よろしいですか？',
      function(){
        DB.data = mergeDefaults(parsed, emptyData());
        DB.save(); render(); toast('復元しました','ok');
      }, '復元する');
  });
});

action('dataClear', function(){
  /* 共有中は、削除がそのまま共有先へ反映され、チーム全員分のデータが消える。
     何が消えるのかを必ず伝え、取り消せないので直前にバックアップを自動保存する。 */
  var shared = (typeof SYNC !== 'undefined' && SYNC.cfg.mode !== 'local');
  confirmDialog('全データの削除',
    'このアプリに保存されているすべてのデータ（社員・目標・KPI・1on1・評価・報告）を削除します。\n'+
    (shared
      ? '現在「'+syncModeLabel()+'」で共有しているため、共有先にあるチーム全員分のデータも削除されます。\n'+
        '他のメンバーの端末からも、次の同期のときに消えます。\n'
      : '')+
    'この操作は取り消せません。\n\n先に「バックアップを保存」でファイルに書き出すことを強くおすすめします。',
    function(){
      confirmDialog('最終確認',
        shared ? '本当に全データを削除しますか？\n共有先のチーム全員分のデータも消えます。'
               : '本当に全データを削除しますか？',
        function(){
          /* 取り消せない操作なので、削除の直前にバックアップを書き出しておく */
          try{
            var nm = (DB.data.settings.companyName||'組織運営').replace(/[\\/:*?"<>|]/g,'');
            download(nm+'_削除前バックアップ_'+todayStr()+'.json', JSON.stringify(DB.data, null, 2), 'application/json');
          }catch(e){}
          DB.reset(); render();
          toast('全データを削除しました（削除前のバックアップを保存しました）','ok');
        }, '削除する');
    }, '次へ');
});

action('dataCsvAll', function(){
  ACTIONS.empCsv();
  setTimeout(function(){ ACTIONS.goalCsv(); }, 300);
  setTimeout(function(){ ACTIONS.scCsv(); }, 600);
  setTimeout(function(){ ACTIONS.oooCsv(); }, 900);
  setTimeout(function(){ ACTIONS.evalCsv(); }, 1200);
  setTimeout(function(){ ACTIONS.repCsv(); }, 1500);
  setTimeout(function(){ ACTIONS.impCsv(); }, 1800);
  setTimeout(function(){ ACTIONS.dlgCsv(); }, 2100);
  setTimeout(function(){ ACTIONS.decCsv(); }, 2400);
  setTimeout(function(){ ACTIONS.parCsv(); }, 3000);
  setTimeout(function(){ ACTIONS.capCsv(); }, 3300);
  setTimeout(function(){
    var rows = [['週','指標','目標','実績','差','状態','原因','対策','責任者','期限','完了日']];
    sortBy(DB.data.kpiWeeks, function(w){ return w.weekOf; }).forEach(function(w){
      w.rows.forEach(function(r){
        var k = KPI_STATUS.filter(function(x){return x.key===kpiRowStatus(r);})[0];
        rows.push([w.weekOf, r.indicator, r.target, r.actual, kpiGap(r), k.label, r.cause, r.action,
                   r.owner?empName(r.owner):'', r.due, r.doneAt]);
      });
    });
    downloadCsv('週次KPI_全期間_'+todayStr()+'.csv', rows);
    toast('13本のCSVを書き出しました','ok');
  }, 3600);
});

/* ---------- サンプルデータ ---------- */
action('dataDemo', function(){ ACTIONS.loadDemo(); });
action('loadDemo', function(){
  confirmDialog('サンプルデータの投入',
    '操作を試すためのサンプル会社のデータ（社員8名、目標4個、役割表8職種、週次KPI2週分、1on1、評価）を入れます。\n\n'+
    '現在のデータはすべて置き換えられます。よろしいですか？',
    function(){ buildDemoData(); DB.save(); render(); toast('サンプルデータを入れました','ok'); },
    '入れる');
});

function buildDemoData(){
  var d = emptyData();
  var start = new Date(); start.setDate(start.getDate()-35);
  d.settings.companyName = 'サンプル株式会社';
  d.settings.ceoName = '山田 太郎';
  d.settings.projectLead = '佐藤 花子';
  d.settings.hrOwner = '鈴木 一郎';
  d.settings.externalAdvisor = '〇〇社会保険労務士事務所';
  d.settings.startDate = fmtDate(start);
  d.settings.currentPeriod = quarterOf(todayStr());
  d.projectRoles = { ceo:'山田 太郎', lead:'佐藤 花子', hr:'鈴木 一郎', external:'〇〇社会保険労務士事務所', deptHead:'各部門責任者' };

  function emp(o){ o.id = uid('emp'); d.employees.push(o); return o; }
  var ceo = emp({ name:'山田 太郎', dept:'経営', empType:'役員', joinDate:'2015-04-01', jobType:'経営幹部',
    grade:'G5', isTop:true, manager:'', roleTitle:'代表取締役',
    mainDuties:['会社方針の決定','重要判断と資源配分','重要顧客との関係維持'],
    deliverables:'会社目標の達成、重要判断の記録', kpis:['営業利益','会社目標達成率'],
    kpiTarget:'営業利益 月200万円以上', dataSource:'月次試算表（経理）',
    authority:'全社の意思決定', approvals:'—', handover:'共有フォルダ／経営', replaceable:'低い（この人しかできない）' });
  var salesMgr = emp({ name:'佐藤 花子', dept:'営業部', empType:'正社員', joinDate:'2018-04-01', jobType:'管理職',
    grade:'G4', course:'manager', manager:ceo.id, roleTitle:'営業部長', backup:'田中 健',
    mainDuties:['営業部の受注目標達成','メンバーの育成と1on1','主要顧客の維持','見積・提案の最終確認'],
    deliverables:'月次受注実績、部門KPI報告、1on1記録', kpis:['部門受注金額','受注件数','粗利率'],
    kpiTarget:'受注金額 月1,200万円／粗利率35%以上', dataSource:'販売管理システム（月次）',
    authority:'標準条件内の価格決定、メンバーの業務配分', approvals:'規定率を超える値引き、新規契約条件の変更',
    handover:'共有フォルダ／営業部', replaceable:'中（引継ぎ期間が必要）', doingUpperWork:true, roleNeeded:true });
  var sales1 = emp({ name:'田中 健', dept:'営業部', empType:'正社員', joinDate:'2020-04-01', jobType:'営業',
    grade:'G3', manager:salesMgr.id, roleTitle:'営業担当（既存顧客）', backup:'高橋 美咲',
    mainDuties:['既存顧客のフォロー','追加提案の実施','見積作成','商談記録の入力'],
    deliverables:'商談記録、見積書、月次の受注実績', kpis:['受注件数','受注金額','商談化率'],
    kpiTarget:'受注件数 月8件', dataSource:'販売管理システム',
    authority:'標準価格での提案、訪問計画の決定', approvals:'値引き5%超、支払条件の変更',
    handover:'共有フォルダ／営業部／担当別', replaceable:'中（引継ぎ期間が必要）' });
  var sales2 = emp({ name:'高橋 美咲', dept:'営業部', empType:'正社員', joinDate:'2023-10-01', jobType:'営業',
    grade:'G2', manager:salesMgr.id, roleTitle:'営業担当（新規）',
    mainDuties:['新規顧客の開拓','初回商談の実施','提案書作成'],
    deliverables:'商談記録、提案書', kpis:['新規商談件数','受注件数'],
    kpiTarget:'新規商談 月20件', dataSource:'販売管理システム',
    authority:'標準価格での提案', approvals:'値引き、契約条件の変更',
    handover:'共有フォルダ／営業部', replaceable:'高い（すぐ代替できる）' });
  var mkt = emp({ name:'伊藤 誠', dept:'マーケティング部', empType:'正社員', joinDate:'2021-07-01', jobType:'マーケティング',
    grade:'G3', manager:ceo.id, roleTitle:'マーケティング担当',
    mainDuties:['広告運用','LP改善','効果測定','見込み顧客の引き渡し'],
    deliverables:'月次レポート、施策の記録', kpis:['問い合わせ件数','CPA','商談化率'],
    kpiTarget:'問い合わせ 月60件／CPA 20,000円以下', dataSource:'広告管理画面＋問い合わせフォーム集計',
    authority:'承認済み予算内での配信調整', approvals:'予算枠の変更、新規媒体の契約',
    handover:'共有フォルダ／マーケ', replaceable:'低い（この人しかできない）', ceoOnlyKnows:true });
  var cs = emp({ name:'渡辺 由美', dept:'カスタマーサポート部', empType:'正社員', joinDate:'2022-04-01', jobType:'顧客対応',
    grade:'G2', manager:salesMgr.id, roleTitle:'顧客対応担当',
    mainDuties:['問い合わせ対応','解約兆候の把握','クレーム記録'],
    deliverables:'対応記録、月次のクレーム一覧', kpis:['解約率','初回応答時間','クレーム件数'],
    kpiTarget:'解約率 2%以下／初回応答 4時間以内', dataSource:'問い合わせ管理システム',
    authority:'標準対応範囲での回答', approvals:'返金・無償対応、特別対応の約束',
    handover:'共有フォルダ／CS', replaceable:'中（引継ぎ期間が必要）' });
  var dev = emp({ name:'中村 大輔', dept:'開発部', empType:'正社員', joinDate:'2019-04-01', jobType:'開発',
    grade:'G3', manager:ceo.id, roleTitle:'開発担当',
    mainDuties:['機能開発','障害対応','仕様書の作成'],
    deliverables:'リリース物、仕様書', kpis:['納期遵守率','重大障害件数'],
    kpiTarget:'納期遵守率 95%以上', dataSource:'課題管理ツール',
    authority:'実装方法の選択', approvals:'仕様変更、外部サービスの契約',
    handover:'ソースコード管理／共有フォルダ', replaceable:'低い（この人しかできない）', ceoOnlyKnows:true });
  var acc = emp({ name:'鈴木 一郎', dept:'管理部', empType:'正社員', joinDate:'2017-04-01', jobType:'経理・総務',
    grade:'G3', manager:ceo.id, roleTitle:'経理・総務担当',
    mainDuties:['月次締め','入出金管理','契約書管理','労務手続'],
    deliverables:'月次試算表、契約書台帳', kpis:['月次締め完了日','支払遅延件数'],
    kpiTarget:'月次締め 翌月10日まで', dataSource:'会計ソフト',
    authority:'定型支出の処理', approvals:'10万円以上の支出、契約締結',
    handover:'共有フォルダ／管理部', replaceable:'低い（この人しかできない）' });
  d.settings.ceoEmpId = ceo.id;

  /* 役割表 */
  DEFAULT_JOB_TYPES.forEach(function(jt){
    var t = SCORECARD_TEMPLATES[jt];
    if(!t) return;
    var rec = JSON.parse(JSON.stringify(t));
    rec.id = uid('sc'); rec.jobType = jt;
    d.scorecards.push(rec);
  });

  /* 目標 */
  function goal(o){ o.id = uid('goal'); d.goals.push(o); return o; }
  var g1 = goal({ level:'company', category:'existing', title:'既存事業の営業利益を安定させる', metric:'営業利益',
    unit:'万円', baseline:120, current:165, target90:200, owner:ceo.id, dataSource:'月次試算表（経理）',
    note:'月次で確認。粗利率の低下に注意。' });
  var g2 = goal({ level:'company', category:'marketing', title:'獲得単価を下げて見込み顧客を増やす', metric:'CPA',
    unit:'円', baseline:28000, current:23000, target90:20000, lowerIsBetter:true, owner:mkt.id,
    dataSource:'広告管理画面＋問い合わせ集計' });
  var g3 = goal({ level:'company', category:'quality', title:'解約率を下げる', metric:'解約率', unit:'%',
    baseline:3.5, current:2.9, target90:2.0, lowerIsBetter:true, owner:cs.id, dataSource:'契約管理台帳' });
  var g4 = goal({ level:'company', category:'mgmt', title:'月次締めと報告期限を守る体制をつくる', metric:'報告期限遵守率',
    unit:'%', baseline:60, current:80, target90:95, owner:acc.id, dataSource:'このアプリの報告ログ' });
  goal({ level:'dept', dept:'営業部', parentId:g1.id, category:'existing', title:'営業部の受注金額を伸ばす',
    metric:'受注金額', unit:'万円', baseline:900, current:1050, target90:1200, owner:salesMgr.id,
    dataSource:'販売管理システム' });
  goal({ level:'dept', dept:'マーケティング部', parentId:g2.id, category:'marketing', title:'問い合わせ件数を増やす',
    metric:'問い合わせ件数', unit:'件', baseline:35, current:48, target90:60, owner:mkt.id,
    dataSource:'問い合わせフォーム集計' });
  goal({ level:'dept', dept:'カスタマーサポート部', parentId:g3.id, category:'quality', title:'初回応答を早くする',
    metric:'初回応答時間', unit:'時間', baseline:9, current:5, target90:4, lowerIsBetter:true, owner:cs.id,
    dataSource:'問い合わせ管理システム' });

  /* 週次KPI 2週分 */
  function makeWeek(offsetWeeks, actuals){
    var mon = fmtDate(new Date(new Date(weekMonday()).getTime() - offsetWeeks*7*86400000));
    var w = { id:uid('wk'), weekOf:mon, attendees:'山田、佐藤、伊藤、渡辺、鈴木', rows:[],
              ceoDecisions:'', nextCheck:'', minutes:'', createdAt:nowIso() };
    var defs = [
      { ind:'営業利益（万円）', tgt:200, owner:ceo.id, src:'月次試算表' },
      { ind:'受注金額（営業部・万円）', tgt:1200, owner:salesMgr.id, src:'販売管理システム' },
      { ind:'CPA（円）', tgt:20000, owner:mkt.id, low:true, src:'広告管理画面' },
      { ind:'問い合わせ件数（件）', tgt:60, owner:mkt.id, src:'フォーム集計' },
      { ind:'解約率（%）', tgt:2.0, owner:cs.id, low:true, src:'契約管理台帳' },
      { ind:'納期遵守率（%）', tgt:95, owner:dev.id, src:'課題管理ツール' },
      { ind:'商談数（既存顧客・件）', tgt:12, owner:sales1.id, src:'商談記録' }
    ];
    defs.forEach(function(x, i){
      w.rows.push({ id:uid('row'), indicator:x.ind, target:x.tgt, actual:actuals[i],
        lowerIsBetter:!!x.low, source:x.src, owner:x.owner, cause:'', action:'', due:'', doneAt:'' });
    });
    return w;
  }
  var w2 = makeWeek(1, [150, 980, 26000, 42, 3.2, 92, 9]);
  w2.rows[2].cause = '新規媒体のクリック単価が想定より高い';
  w2.rows[2].action = '効果の低い媒体を停止し、既存媒体に予算を寄せる';
  w2.rows[2].due = fmtDate(new Date(new Date(w2.weekOf).getTime()+7*86400000));
  w2.rows[4].cause = '契約後3か月以内の利用開始が遅れている顧客が多い';
  w2.rows[4].action = '初回導入サポートを契約後2週間以内に必ず実施する';
  w2.rows[4].due = fmtDate(new Date(new Date(w2.weekOf).getTime()+14*86400000));
  w2.ceoDecisions = '広告予算の配分変更は伊藤の判断で可。上限は月80万円まで。';
  w2.nextCheck = '媒体停止後のCPAの変化、導入サポートの実施件数';
  d.kpiWeeks.push(w2);

  var w1 = makeWeek(0, [165, 1050, 23000, 48, 2.9, 96, 10]);
  w1.rows[2].cause = '媒体停止の効果が出始めているが目標には未達';
  w1.rows[2].action = 'LPの申込フォームを短縮して転換率を上げる';
  w1.rows[2].owner = mkt.id;
  w1.rows[2].due = fmtDate(new Date(new Date(w1.weekOf).getTime()+7*86400000));
  w1.rows[4].cause = '導入サポートの実施が5件中3件にとどまった';
  w1.rows[4].action = '契約時にサポート日程を同時に確定する運用にする';
  w1.rows[4].owner = cs.id;
  w1.rows[4].due = fmtDate(new Date(new Date(w1.weekOf).getTime()+7*86400000));
  w1.attendees = '山田、佐藤、伊藤、渡辺、鈴木';
  w1.ceoDecisions = 'LP改修は外注せず内製で対応する。';
  w1.nextCheck = 'フォーム短縮後の申込率、サポート日程の同時確定の運用状況';
  d.kpiWeeks.push(w1);

  /* 1on1 */
  var thisMonth = monthStr();
  var lastMonth = prevMonth(thisMonth);
  function ooo(o){ o.id = uid('ooo'); d.oneOnOnes.push(o); return o; }
  ooo({ employeeId:sales1.id, managerId:salesMgr.id, month:lastMonth, date:lastMonth+'-15',
    kpiReview:'受注6件（目標8件）。既存顧客の追加提案は3件成約。', wins:'長期停滞していたA社の追加受注を獲得した。',
    issues:'商談記録の入力が翌週にずれ込むことが多い。', feedback:'商談は当日中に記録すること。翌週になると内容が曖昧になり、引き継ぎもできない。',
    support:'記録テンプレートを共有する。', promises:[{text:'商談記録を当日中に入力する', due:lastMonth+'-30', done:true},
      {text:'既存顧客20社に追加提案の連絡をする', due:lastMonth+'-30', done:false}], nextDate:thisMonth+'-15' });
  ooo({ employeeId:sales1.id, managerId:salesMgr.id, month:thisMonth, date:thisMonth+'-15',
    kpiReview:'受注8件（目標8件）。粗利率36%。', wins:'商談記録は当日中に入力できている。追加提案から2件受注。',
    issues:'新規の掘り起こしが後回しになっている。', feedback:'既存フォローは水準に達した。次は新規商談を週2件確保する。',
    support:'高橋と訪問先リストを共有する。', promises:[{text:'新規商談を週2件確保する', due:thisMonth+'-28', done:false}],
    nextDate:'' });
  ooo({ employeeId:sales2.id, managerId:salesMgr.id, month:thisMonth, date:thisMonth+'-16',
    kpiReview:'新規商談14件（目標20件）。受注2件。', wins:'初回商談の進め方が安定してきた。',
    issues:'アプローチ件数が目標に届いていない。', feedback:'商談の質は問題ない。件数を増やすために、午前中はアポ取りの時間に固定する。',
    support:'リスト作成をマーケ部と連携する。', promises:[{text:'午前中をアポ取りの時間に固定する', due:thisMonth+'-28', done:false}],
    nextDate:'' });

  /* 報告ログ */
  function nowMinus(hours){ var t = new Date(); t.setHours(t.getHours()-hours); return fmtDateTimeLocal(t); }
  d.reports.push({ id:uid('rep'), needApproval:false, ruleKey:'claim', title:'B社より納品物の不備でクレーム',
    detail:'納品したデータに前月分が含まれていなかった。担当者より当日中に報告。',
    reporterId:cs.id, toId:salesMgr.id, occurredAt:nowMinus(50), knownAt:nowMinus(48), reportedAt:nowMinus(46),
    decision:'当日中に修正データを再送。原因は確認手順の欠落のため、チェックリストを追加。' });
  d.reports.push({ id:uid('rep'), needApproval:false, ruleKey:'delay', title:'C社向け機能追加の納期遅延見込み',
    detail:'仕様確認の往復で3日遅れる見込み。', reporterId:dev.id, toId:ceo.id,
    occurredAt:nowMinus(30), knownAt:nowMinus(28), reportedAt:nowMinus(3),
    decision:'C社へ事前連絡し、納期を1週間後ろ倒しで合意。' });
  d.reports.push({ id:uid('rep'), needApproval:true, ruleKey:'contract', title:'広告媒体（新規）の年間契約',
    detail:'月額15万円・12か月契約。', reporterId:mkt.id, amount:1800000,
    requestedAt:nowMinus(72), approverId:ceo.id, status:'approved', approvedAt:nowMinus(70),
    decision:'3か月ごとにCPAを確認し、目標未達なら解約できる条件で承認。' });
  d.reports.push({ id:uid('rep'), needApproval:true, ruleKey:'budget', title:'展示会出展費用の追加',
    detail:'ブース装飾の追加で予算を25万円超過する見込み。', reporterId:salesMgr.id, amount:250000,
    requestedAt:nowMinus(5), approverId:ceo.id, status:'pending', approvedAt:'', decision:'' });

  /* 問題処理記録 */
  d.incidents.push({ id:uid('inc'), title:'請求書の送付漏れ（3社）', date:fmtDate(new Date(Date.now()-20*86400000)),
    fact:'3月分の請求書3社分が未送付のまま月末を迎えた。経理の確認リストから漏れていた。',
    impact:'入金が1か月遅れ、資金繰りに約180万円の影響。顧客からの信用にも影響。',
    stop:'当日中に3社へ連絡し、請求書を再送。入金予定日を確認した。',
    cause:'請求リストが担当者の個人ファイルで管理されており、二重確認の手順がなかった。',
    prevent:'請求リストを共有フォルダに移し、月末2営業日前に上長が件数を突合する手順を追加。担当：鈴木、期限：翌月末',
    owner:acc.id, due:fmtDate(new Date(Date.now()+10*86400000)), doneAt:'' });

  /* 例外記録 */
  d.exceptions.push({ id:uid('exc'), title:'D社の支払サイトを60日に延長',
    reason:'長期取引先で、先方の締め処理変更に伴う一時的な対応。取引継続の維持を優先。',
    decidedBy:'山田 太郎', periodFrom:fmtDate(new Date(Date.now()-30*86400000)),
    periodTo:fmtDate(new Date(Date.now()+60*86400000)),
    reviewDate:fmtDate(new Date(Date.now()+45*86400000)),
    note:'見直し日に、通常条件へ戻すか正式ルールにするかを判断する。' });

  /* 評価（前期・当期） */
  var period = quarterOf(todayStr());
  function ev(empId, type, self, mgr, stage, evidence, evaluator){
    var e = { id:uid('ev'), employeeId:empId, period:period, type:type, evaluatorId:evaluator,
              selfScores:{}, selfComments:{}, scores:{}, comments:{}, evidence:evidence,
              calibrationNote:'', finalNote:'', stage:stage, createdAt:nowIso() };
    var items = evalItemsFor(type);
    items.forEach(function(it, i){
      e.selfScores[it.key] = self[i];
      e.scores[it.key] = mgr[i];
    });
    d.evaluations.push(e);
    return e;
  }
  ev(sales1.id, 'general', [3,3,3], [3,3,3], 'explained',
     '受注8件（目標8件）、粗利率36%。商談記録の当日入力を継続。1on1の約束2件中2件達成。', salesMgr.id);
  ev(sales2.id, 'general', [3,3,2], [2,3,2], 'final',
     '新規商談14件（目標20件）。受注2件。商談の質は水準だが件数が未達。', salesMgr.id);
  ev(mkt.id, 'general', [3,3,4], [3,2,3], 'calibration',
     'CPA 23,000円（目標20,000円）。媒体整理で改善傾向。ただし施策の記録が個人環境に留まっている。', ceo.id);
  ev(cs.id, 'general', [3,3,3], [3,3,3], 'manager',
     '解約率2.9%（目標2.0%）。初回応答は5時間へ短縮。', salesMgr.id);
  ev(dev.id, 'general', [3,4,3], [3,3,3], 'manager',
     '納期遵守率96%。重大障害0件。仕様書の整備が一部未完。', ceo.id);
  ev(acc.id, 'general', [3,3,3], [3,2,3], 'self',
     '月次締めは翌月10日を維持。ただし請求書の送付漏れが発生。', ceo.id);
  ev(salesMgr.id, 'manager', [3,3,3,3], [3,3,3,2], 'manager',
     '部門受注1,050万円（目標1,200万円）。1on1は全員実施。報告期限は遵守。仕組み化は着手段階。', ceo.id);

  /* 90日チェックリスト（Week1〜3は完了、Week4は途中） */
  PLAN_WEEKS.forEach(function(w, wi){
    w.items.forEach(function(it, i){
      if(wi <= 2) d.planChecks[w.id+'_'+i] = true;
      else if(wi === 3 && i < 3) d.planChecks[w.id+'_'+i] = true;
    });
  });
  for(var i=0;i<7;i++) d.firstSteps[i] = true;

  /* ---------- 決め方・任せ方・お金まわりのサンプル ---------- */
  function dayOff(n){ return fmtDate(new Date(Date.now()+n*86400000)); }
  function hourOff(n){ var t=new Date(); t.setHours(t.getHours()+n); return t.toISOString(); }

  /* これからの役割について話した日 */
  salesMgr.nextRole = '半年後：営業とマーケの両部門を統括。1年後：予算配分と採用の決裁権を移譲する。';
  salesMgr.growthTalkAt = dayOff(-20);
  sales1.nextRole = '半年後：新人1名の指導役。1年後：既存顧客チームのリーダー。';
  sales1.growthTalkAt = dayOff(-14);
  cs.nextRole = '半年後：問い合わせ対応の手順書を整備し、新人教育を担当する。';
  cs.growthTalkAt = dayOff(-10);

  /* 任せた仕事 */
  d.delegations.push({ id:uid('dlg'), title:'新規顧客向け提案書の型をつくる', employeeId:sales2.id,
    startDate:dayOff(-10), outcome:'提案書テンプレート1本と、記入例2社分。営業3名が使える状態にする。',
    due:dayOff(6), ownArea:'構成・見せ方・使うツールは本人が決めてよい。',
    noGo:'価格や納期の条件を新しく作らないこと。既存の標準条件から外れる場合は必ず相談。',
    checkAt:dayOff(-1), helpAt:'佐藤部長。判断に迷って30分止まったら、その時点で相談する。',
    state:'open', checks:[{ id:uid('chk'), date:dayOff(-1), doneAt:'', note:'' }] });

  d.delegations.push({ id:uid('dlg'), title:'月次締めを翌月7日までに前倒しする', employeeId:acc.id,
    startDate:dayOff(-25), outcome:'翌月7日までに試算表を提出。手順書を1本残す。',
    due:dayOff(12), ownArea:'処理の順番、担当への依頼方法は本人が決めてよい。',
    noGo:'請求・支払の確認手順を省略しないこと。',
    checkAt:dayOff(3), helpAt:'山田 太郎。他部門から資料が出てこない場合は、その日のうちに連絡する。',
    state:'open', retryCount:1,
    feedback:'前回：請求リストの突合を1人で抱えていた。手順を分けて2人で確認する形に変更。',
    checks:[{ id:uid('chk'), date:dayOff(-12), doneAt:hourOff(-24*12),
              note:'手順の洗い出しまで完了。締めが遅れる原因は他部門の資料提出だと判明。' },
            { id:uid('chk'), date:dayOff(3), doneAt:'', note:'' }] });

  d.delegations.push({ id:uid('dlg'), title:'解約理由の記録を全件そろえる', employeeId:cs.id,
    startDate:dayOff(-6), outcome:'直近3か月の解約20件について、理由を分類して一覧にする。',
    due:dayOff(9), ownArea:'', noGo:'', checkAt:'', helpAt:'', state:'open', checks:[] });

  d.delegations.push({ id:uid('dlg'), title:'既存顧客20社に追加提案の型をつくる',
    employeeId:sales1.id, startDate:dayOff(-4),
    outcome:'よく使われている組み合わせを3パターンにまとめ、提案書のひな形をつくる。',
    due:dayOff(11), ownArea:'提案する組み合わせの選び方と、声をかける順番。',
    noGo:'価格の値引きは提示しない。条件の変更は上司に確認する。',
    checkAt:dayOff(2), helpAt:'佐藤 花子。3社に断られた時点で、いったん相談する。',
    state:'open', checks:[{ id:uid('chk'), date:dayOff(2), doneAt:'', note:'' }] });

  /* 重要な決定 */
  d.decisions.push({ id:uid('dec'), title:'広告の出稿を一度止めて、配分を見直す',
    kind:'spend', raisedAt:hourOff(-6), stage:'holding',
    facts:'CPAが3か月連続で目標未達。ただし直近1か月は改善傾向。施策の記録が個人のパソコンに残っている。',
    lossNow:'', lossWait:'', devilName:'', devilNote:'', options:'',
    createdAt:hourOff(-6) });

  d.decisions.push({ id:uid('dec'), title:'B社との年間契約を更新するかどうか',
    kind:'contract', raisedAt:hourOff(-72), stage:'decided', heldOk:true,
    facts:'年間120万円。過去1年の受注貢献は2件・粗利48万円。担当窓口が3回交代した。',
    lossNow:'更新期限まで2週間あり、いま決めなくても損失はない。',
    lossWait:'勢いで切ると、紹介経由の見込み客2社との関係も同時に失う可能性がある。',
    devilName:'佐藤 花子', devilNote:'紹介経由の案件が年2件ある。取引を切ると紹介元との関係も切れる恐れ。',
    options:'①更新しない ②金額を下げて半年更新 ③紹介の取り決めだけ残して契約は終了',
    decision:'③を選択。契約は終了するが、紹介の取り決めは別途書面で残す。',
    reason:'金額に見合う受注はないが、紹介の経路は価値がある。分けて扱えると分かったため。',
    review:dayOff(90), decidedAt:hourOff(-40), createdAt:hourOff(-72) });

  /* 新規案件（1枚企画書） */
  d.ventures.push({ id:uid('ven'), title:'オンライン講座事業への参入',
    raisedAt:hourOff(-60), stage:'draft',
    purpose:'既存顧客向けに、導入後の使い方を教える講座を有料で提供する。',
    gain:'初年度で月20万円。6か月後に単月黒字。',
    resource:'渡辺（顧客対応）の週4時間、撮影費30万円。',
    failCond:'6か月後に月10万円に届かない場合は失敗とする。',
    exitCond:'3か月時点で申込10件未満なら、追加投資を止めて既存顧客向け無償提供に切り替える。',
    ownerName:'渡辺 由美', cap:'50万円・のべ80時間',
    impact:'渡辺の稼働が週4時間減るため、初回応答時間の目標を一時的に5時間へ緩める。',
    createdAt:hourOff(-60) });

  d.ventures.push({ id:uid('ven'), title:'展示会への追加出展',
    raisedAt:hourOff(-10), stage:'draft',
    purpose:'新規リードの獲得', gain:'', resource:'', failCond:'', exitCond:'', ownerName:'', cap:'',
    createdAt:hourOff(-10) });

  /* 関係者台帳 */
  d.partners.push({ id:uid('par'), name:'〇〇ホールディングス（スポンサー）', kind:'スポンサー',
    contact:'経営企画室 田村様', startDate:dayOff(-200),
    interest:'自社の新規事業領域での実績づくり。四半期ごとに成果を社内報告する必要がある。',
    authority:'共同企画の内容には意見を出せるが、価格決定権はこちらにある。',
    duty:'年4回の共同セミナー開催。こちらは集客と当日運営、先方は会場と広報。',
    ip:'共同制作した資料の著作権は共同保有。個別利用は事前連絡制。',
    money:'年間支援額300万円。四半期ごとに75万円。',
    exitCond:'2四半期連続で共同セミナーの集客が30名を下回った場合、次年度は継続しない。',
    checkCycle:'3か月に1回', contractDone:true, contractPlace:'共有フォルダ／契約書／スポンサー',
    nextCheck:dayOff(-3), lastCheck:dayOff(-93), createdAt:nowIso() });

  d.partners.push({ id:uid('par'), name:'デザイン外注 A社', kind:'外注先',
    contact:'代表 小林様', startDate:dayOff(-60),
    interest:'', authority:'', duty:'LP・広告バナーの制作', ip:'', money:'月20万円（固定）',
    exitCond:'', checkCycle:'', contractDone:false, nextCheck:'', createdAt:nowIso() });

  /* 資本配分 */
  var qNow = quarterOf(todayStr());
  var qPrev = (function(){
    var y = parseInt(qNow.slice(0,4),10), q = parseInt(qNow.slice(-1),10);
    return q===1 ? (y-1)+'-Q4' : y+'-Q'+(q-1);
  })();
  d.capital.rule = { reinvestRate:50, nonBizCap:1200000, approver:'鈴木 一郎（管理部）',
    note:'利益が出た月に、まず再投資枠を別口座へ移す。残りから非事業支出を判断する。' };
  d.capital.periods.push({ id:uid('cp'), label:qPrev, profit:4200000, note:'前期。再投資の仕組みを作る前。' });
  d.capital.periods.push({ id:uid('cp'), label:qNow,  profit:5100000, note:'再投資枠の先取りを開始した期。' });
  [[qPrev,'reinvest','people','営業メンバーの外部研修',180000,''],
   [qPrev,'nonbiz','','社用車の買い替え',1800000,''],
   [qPrev,'reinvest','sales','広告media Bの追加出稿',300000,''],
   [qNow,'reinvest','people','評価制度の導入支援（社労士）',250000,'鈴木 一郎'],
   [qNow,'reinvest','sales','見込み客リストの購入と架電代行',600000,'鈴木 一郎'],
   [qNow,'reinvest','system','業務システムの改修（月次締めの自動化）',900000,'鈴木 一郎'],
   [qNow,'reinvest','product','主力商品の品質改善',400000,'鈴木 一郎'],
   [qNow,'venture','','オンライン講座の撮影機材',180000,'鈴木 一郎'],
   [qNow,'nonbiz','','取引先との会食・贈答',220000,'鈴木 一郎']]
  .forEach(function(x, i){
    d.capital.spends.push({ id:uid('sp'), period:x[0], kind:x[1], category:x[2], title:x[3],
      amount:x[4], approvedBy:x[5], date:dayOff(-40+i*4), note:'' });
  });

  /* 健全度診断の回答（途中まで） */
  d.diagnosis.answers = {
    v1:'no', v2:'mid', v3:'no',
    d1:'mid', d2:'no', d3:'mid', d4:'no',
    e1:'no', e2:'no', e3:'mid',
    c1:'mid', c2:'yes', c3:'mid',
    g1:'mid', g2:'no', g3:'no',
    i1:'no', i2:'mid', i3:'mid'
  };
  d.diagnosis.updatedAt = nowIso();
  d.diagnosis.history = [
    { date:dayOff(-60), total:28, data:22, quiz:38, note:'導入前。記録がほとんどない状態。' },
    { date:dayOff(-30), total:41, data:36, quiz:50, note:'週次KPI会議と1on1を開始した。' }
  ];

  DB.data = d;
}
