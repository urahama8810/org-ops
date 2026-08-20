/* ============================================================
   01-core.js  データ保存・共通ユーティリティ・制度定義
   ------------------------------------------------------------
   「評価制度・組織管理体制 90日導入プロジェクト指示書」の
   ルールをそのままデータ定義として持たせている。
   ============================================================ */

var APP_NAME    = '評価制度・組織管理体制 運用アプリ';
var APP_VERSION = '2.0.0';
var STORAGE_KEY = 'hyokaSeido_v1';

/* インターネット上の置き場所（社内に配るときは、このアドレスを伝える） */
var APP_URL   = 'https://urahama8810.github.io/org-ops/';
var GUIDE_URL = 'https://urahama8810.github.io/org-ops/guide.html';

/* ---------- 指示書の固定定義 ---------- */

/* 第10章 評価配点：一般社員 */
var EVAL_ITEMS_GENERAL = [
  { key:'kpi',    label:'成果・KPI',                weight:60,
    desc:'担当KPIの達成度。目標値と実績、正とするデータで確認する。' },
  { key:'process',label:'仕事の進め方・信頼性',     weight:25,
    desc:'期限遵守、報告の速さと正確さ、記録の有無、依頼への応答。' },
  { key:'growth', label:'改善・成長・チーム貢献',   weight:15,
    desc:'業務改善の実行、後輩支援、仕組み化、他部門への協力。' }
];

/* 第10章 評価配点：管理職 */
var EVAL_ITEMS_MANAGER = [
  { key:'team',   label:'チーム成果',               weight:50,
    desc:'部門目標・部門KPIの達成度。個人の稼働ではなくチームの結果で見る。' },
  { key:'people', label:'部下の管理・育成',         weight:25,
    desc:'1on1の実施、役割と権限の明確化、評価の根拠づくり、後任育成。' },
  { key:'risk',   label:'報告・リスク管理',         weight:15,
    desc:'悪い情報の早期報告、承認ルールの遵守、問題の止血と再発防止。' },
  { key:'improve',label:'業務改善・仕組み化',       weight:10,
    desc:'属人化の解消、手順化・記録化、再利用できる仕組みを残したか。' }
];

/* 第10章 4段階評価の定義 */
var RATING_DEFS = [
  { v:4, label:'4 期待を上回る', short:'4',
    desc:'期待を明確に上回り、再利用できる改善・仕組みを残した' },
  { v:3, label:'3 期待どおり',   short:'3',
    desc:'期待された役割を安定して果たした' },
  { v:2, label:'2 一部未達',     short:'2',
    desc:'一部達成したが重要な未達または支援が必要' },
  { v:1, label:'1 未達',         short:'1',
    desc:'主要な役割を継続的に果たせなかった' }
];

/* 第10章 評価の手順 */
var EVAL_STAGES = [
  { key:'self',        label:'自己評価' },
  { key:'manager',     label:'直属上司評価' },
  { key:'calibration', label:'管理職間で調整' },
  { key:'final',       label:'確定' },
  { key:'explained',   label:'本人説明済み' }
];

/* 第11章 等級制度 G1〜G5 */
var DEFAULT_GRADES = [
  { code:'G1', expect:'指示を受けながら習得',
    detail:'決められた手順で業務を行う。判断は上司に確認する。',
    authority:'定型業務の実行。判断が必要な場面は必ず上司に確認。' },
  { code:'G2', expect:'担当業務を一人で完結',
    detail:'通常案件を独力で最後までやり切り、期限と報告を守る。',
    authority:'担当業務の日常判断。例外・想定外は上司判断。' },
  { code:'G3', expect:'難しい案件を担当し後輩を支援',
    detail:'難易度の高い案件を担当し、後輩の指導・レビューを行う。',
    authority:'担当領域の方法選択。金額・契約は上司承認。' },
  { code:'G4', expect:'チーム管理または高度専門業務',
    detail:'チームの成果に責任を持つ、または高度専門領域を主導する。',
    authority:'チーム内の配分・優先順位・一次評価。予算枠内の支出判断。' },
  { code:'G5', expect:'部門成果・予算・重要判断に責任',
    detail:'部門の数字、予算、人員、重要判断に責任を持つ。',
    authority:'部門予算・人員配置・重要判断。会社方針に関わる事項は社長承認。' }
];

/* 第11章 昇格の基本条件 */
var PROMOTION_CONDITIONS = [
  { key:'already', label:'上位等級の仕事を既に行っている',
    hint:'昇格は「これから頑張る人」ではなく「既にやっている人」に対して行う。' },
  { key:'sustained', label:'継続的な成果がある',
    hint:'原則2期連続で評価3以上。単発の成果では判断しない。' },
  { key:'needed', label:'会社にその役割が必要である',
    hint:'ポジションが存在しない昇格は行わない。' }
];

/* 第8章 必須報告・承認ルール */
var REPORT_RULES = [
  { key:'bad_number', label:'重大な数値悪化・悪い情報', limit:'判明から24時間以内', hours:24,
    detail:'売上・利益・解約率などの重大悪化、失注、事故、トラブル。原因が分からなくても先に一報する。' },
  { key:'delay',      label:'納期遅延',               limit:'遅延見込みが判明した時点', hours:24,
    detail:'期限を過ぎてからではなく「間に合わないかもしれない」と分かった時点で報告する。' },
  { key:'claim',      label:'重大クレーム',           limit:'原則当日中', hours:8,
    detail:'顧客からの重大な苦情・解約要求・法的言及。まず事実だけでも当日中に報告。' },
  { key:'budget',     label:'予算超過',               limit:'超過見込み時に事前承認', hours:0,
    detail:'支出後の報告は不可。超えそうな時点で事前に承認を取る。' },
  { key:'contract',   label:'重要契約・一定額以上の支出', limit:'定めた承認者の事前承認', hours:0,
    detail:'契約締結・継続課金・一定金額以上の発注は、必ず事前承認を得る。' },
  { key:'decision',   label:'重要判断',               limit:'口頭で終わらせず記録', hours:0,
    detail:'誰が・いつ・何を・なぜ決めたかを記録に残す。' },
  { key:'data',       label:'会社データ・契約・成果物', limit:'個人環境だけに保存しない', hours:0,
    detail:'個人PC・個人アカウントのみの保存を禁止。会社の共有場所に保管する。' }
];

/* 第14章 問題発生時の処理順（社長の運用ルール） */
var INCIDENT_STEPS = [
  { key:'fact',   label:'① 事実',            hint:'いつ・何が・どこで起きたか。推測と区別して書く。' },
  { key:'impact', label:'② 影響',            hint:'金額・顧客・納期・信用への影響範囲。' },
  { key:'stop',   label:'③ 止血',            hint:'これ以上広げないために即座に行う対応。' },
  { key:'cause',  label:'④ 原因',            hint:'人の責任ではなく、仕組み・手順・情報の欠落として書く。' },
  { key:'prevent',label:'⑤ 再発防止・担当・期限', hint:'誰が、いつまでに、何を変えるか。' }
];

/* 第6章 職種区分（6〜8区分） */
var DEFAULT_JOB_TYPES = [
  '事業責任者','営業','マーケティング','顧客対応','開発','経理・総務','管理職','経営幹部'
];

/* 第6章 役割スコアカードの標準ひな形（職種別の初期値） */
var SCORECARD_TEMPLATES = {
  '事業責任者':{
    purpose:'担当事業の売上・利益に責任を持ち、事業として継続的に成立させる。',
    responsibilities:['事業の数値目標達成','人員と予算の配分','主要顧客・取引先の維持','事業リスクの早期把握と報告','部門メンバーの育成'],
    kpis:['売上','営業利益','粗利率','主要顧客継続率','部門KPI達成率'],
    authority:'部門予算枠内の支出、担当メンバーの業務配分、通常取引条件の決定',
    approvals:'予算超過、新規契約・解約、人員の増減、価格・条件の例外適用',
    reports:'週次KPI会議で数値と対策を報告／重大な数値悪化は判明から24時間以内に社長へ',
    behaviors:'期限を守る、悪い情報を先に出す、決定を記録に残す、改善を仕組みにする',
    gradeDiff:'上位等級では複数部門・全社利益への責任と、後任の育成責任が加わる。'
  },
  '営業':{
    purpose:'見込み顧客を受注につなげ、売上と粗利を継続的につくる。',
    responsibilities:['新規受注の獲得','既存顧客のフォローと追加提案','見積・提案書の作成','商談情報の記録','入金・与信の確認'],
    kpis:['受注件数','受注金額','粗利率','商談化率','失注理由の記録率'],
    authority:'標準価格・標準条件内での提案と見積提示、訪問計画の決定',
    approvals:'値引き（規定率超）、契約条件の変更、支払条件の変更、無償対応の実施',
    reports:'週次で商談状況と見込みを報告／失注・クレームは判明当日に上司へ',
    behaviors:'商談は当日中に記録、見込みは希望でなく根拠で報告、約束期限を守る',
    gradeDiff:'上位等級では担当領域の売上責任、後輩の同行指導、価格判断の裁量が増える。'
  },
  'マーケティング':{
    purpose:'獲得コストを管理しながら、営業に渡せる見込み顧客を安定してつくる。',
    responsibilities:['集客施策の企画と実行','広告予算の管理','コンテンツ・LPの制作管理','効果測定と改善','見込み顧客の営業への引き渡し'],
    kpis:['問い合わせ件数','CPA（獲得単価）','回収期間','商談化率','広告予算消化率'],
    authority:'承認済み予算枠内での配信調整、クリエイティブの改善、媒体の配分変更',
    approvals:'予算枠の変更、新規媒体・外注先の契約、ブランド表現の大幅変更',
    reports:'週次でCPA・件数・回収期間を報告／CPA悪化は判明から24時間以内',
    behaviors:'数値の根拠を示す、施策は仮説と結果をセットで記録、失敗も共有する',
    gradeDiff:'上位等級では予算全体の設計、回収期間への責任、外部パートナー管理が加わる。'
  },
  '顧客対応':{
    purpose:'既存顧客の満足と継続利用を守り、解約とクレームを減らす。',
    responsibilities:['問い合わせ対応と一次解決','解約兆候の把握と対応','クレームの記録と再発防止','顧客情報の整備','関係部門への連携'],
    kpis:['解約率','継続率','初回応答時間','クレーム件数','再発クレーム件数'],
    authority:'標準対応範囲での回答・調整、通常の日程変更の受諾',
    approvals:'返金・値引き・無償対応、特別対応の約束、契約内容の変更',
    reports:'重大クレームは原則当日中に上司へ／解約申出は判明当日に報告',
    behaviors:'一次対応を早く、事実と感情を分けて記録、約束したことは必ず記録に残す',
    gradeDiff:'上位等級では対応品質の基準づくり、難易度の高い案件の主担当、再発防止の仕組み化を担う。'
  },
  '開発':{
    purpose:'決めた品質・期限・仕様で成果物を提供し、事業を止めない。',
    responsibilities:['開発・実装と検証','スケジュール管理と進捗報告','障害対応','仕様と手順の文書化','データ・成果物の保管'],
    kpis:['納期遵守率','重大障害件数','障害復旧時間','手戻り件数','ドキュメント整備率'],
    authority:'実装方法・技術的手段の選択、日程内の作業順序の決定',
    approvals:'仕様変更、外部サービスの新規契約、リリース判断、費用が発生する対応',
    reports:'遅延見込みが判明した時点で即報告／重大障害は判明後ただちに報告',
    behaviors:'遅れそうな時点で早く言う、成果物は共有場所に保管、判断理由を残す',
    gradeDiff:'上位等級では設計判断、他メンバーのレビュー、技術的負債と再発防止の責任が加わる。'
  },
  '経理・総務':{
    purpose:'会社の数字と手続きを正確・期限内に処理し、経営判断の土台をつくる。',
    responsibilities:['月次締めと試算表の作成','入出金・請求・支払管理','契約書・規程・労務書類の管理','各種期限の管理','支出ルールの運用'],
    kpis:['月次締め完了日','支払・請求の遅延件数','数値の訂正件数','契約書の保管率','期限遵守率'],
    authority:'定型支出の処理、書類の様式決定、期限案内と督促',
    approvals:'規定額以上の支出、契約締結、規程の変更、例外的な支払処理',
    reports:'月次締めは所定日までに完了報告／資金・税務の異常は判明から24時間以内',
    behaviors:'締切を守る、根拠資料を必ず残す、例外は理由と決定者を記録する',
    gradeDiff:'上位等級では資金繰りの見通し、規程整備、外部専門家との折衝を担う。'
  },
  '管理職':{
    purpose:'担当チームの成果に責任を持ち、社長の個別監視なしでも回る状態をつくる。',
    responsibilities:['チーム目標とKPIの達成','メンバーの役割と権限の明確化','月次1on1と評価の実施','悪い情報の early 報告','業務の仕組み化・属人化解消'],
    kpis:['チームKPI達成率','1on1実施率','報告期限遵守率','メンバーの評価2以下の改善率','業務手順の整備件数'],
    authority:'チーム内の業務配分、優先順位の決定、一次評価、規定枠内の支出',
    approvals:'人員の増減、予算超過、契約、評価の最終確定、例外の適用',
    reports:'週次KPI会議で未達と対策を報告／重大事項は24時間以内に社長へ',
    behaviors:'部下の成果を数字で語る、判断を記録する、悪い情報を隠さない、期限を管理する',
    gradeDiff:'上位等級では複数チーム・部門予算・重要判断への責任が加わる。'
  },
  '経営幹部':{
    purpose:'会社全体の目標達成と、組織が仕組みで動く状態の構築に責任を持つ。',
    responsibilities:['会社目標の達成','部門横断の課題解決','重要判断と資源配分','管理職の育成と評価調整','リスクの早期発見と対応'],
    kpis:['会社目標達成率','営業利益','部門KPI達成率','管理職の1on1・評価実施率','重大リスクの報告遵守率'],
    authority:'部門間の資源配分、承認済み方針の範囲での重要判断',
    approvals:'会社方針の変更、大型契約・投資、人事制度の変更、報酬の変更',
    reports:'週次で全社数値を社長へ／重大事項は判明から24時間以内',
    behaviors:'事実に基づき判断する、例外の理由と期限を残す、記憶でなく記録で運用する',
    gradeDiff:'最上位等級。部門成果・予算・重要判断の最終責任を負う。'
  }
};

/* 第5章 会社目標の分類と指標例 */
var GOAL_CATEGORIES = [
  { key:'existing', label:'既存事業',       metrics:'営業利益・粗利益' },
  { key:'marketing',label:'マーケティング', metrics:'CPA・回収期間' },
  { key:'quality',  label:'顧客品質',       metrics:'解約率・継続率・クレーム' },
  { key:'new',      label:'新規事業',       metrics:'PoC・導入・売上' },
  { key:'mgmt',     label:'管理体制',       metrics:'月次締め・報告期限遵守' }
];

/* 第3章 90日実行スケジュール＋各週のチェック項目 */
var PLAN_WEEKS = [
  { id:'w1', period:'Week 1', range:[1,1], task:'全社員の現状把握', output:'社員・役割台帳',
    items:['全社員を一覧に入力した','全員の直属上司を確定した','全員の主要業務3〜5個を記入した','全員の成果物を定義した','全員のKPIと目標値を記入した','権限と要承認事項を記入した','資料・データの保存場所を記入した'] },
  { id:'w2', period:'Week 2', range:[2,2], task:'会社目標3〜5個と部門目標を確定', output:'会社・部門目標表',
    items:['会社目標を3〜5個に絞った','各目標の指標・現在値・90日目標を決めた','各目標の責任者を決めた','正とするデータの場所を決めた','部門目標に展開した'] },
  { id:'w3', period:'Week 2〜3', range:[2,3], task:'職種を6〜8区分し役割定義', output:'役割スコアカード',
    items:['職種を6〜8区分に分類した','各職種の役割の目的を書いた','主要責任を最大5項目にした','KPIを最大5項目にした','権限と要承認を分けた','必須報告のルールを書いた','上位等級との差を書いた'] },
  { id:'w4', period:'Week 3〜5', range:[3,5], task:'週次KPI会議開始', output:'KPI表・議事記録',
    items:['週次KPI会議の曜日と時間を固定した','KPI表の様式を決めた','45分以内で終える運用にした','未達項目の原因・対策・期限を記録している','社長判断事項を記録している'] },
  { id:'w5', period:'Week 4〜6', range:[4,6], task:'月次1on1開始', output:'1on1記録',
    items:['全管理職に1on1の目的を説明した','月1回30分の日程を確保した','記録様式を統一した','翌月の約束を記録している','性格評価ではなく行動・結果で記録している'] },
  { id:'w6', period:'Week 5〜7', range:[5,7], task:'評価制度確定', output:'評価シート',
    items:['一般社員の配点を確定した','管理職の配点を確定した','4段階の定義を全社に説明した','自己評価→上司評価→調整→確定→説明の手順を決めた','評価者研修または説明会を実施した'] },
  { id:'w7', period:'Week 6〜8', range:[6,8], task:'G1〜G5等級制度作成', output:'等級・昇格基準',
    items:['G1〜G5の期待状態を確定した','全社員を仮格付けした','G4以降の管理職／専門職コースを決めた','昇格の基本条件を明文化した','等級と役割スコアカードを紐づけた'] },
  { id:'w8', period:'Week 8〜12', range:[8,12], task:'試験運用・初回評価・修正', output:'評価結果・改訂版',
    items:['初回試験評価を実施した','評価者間の差を確認し調整した','基準の曖昧な箇所を修正した','第1四半期は報酬連動させていない','社労士等に就業規則・賃金規程との整合を確認した'] }
];

/* 第15章 明日から着手する順番 */
var FIRST_STEPS = [
  '社内プロジェクト責任者を1名決める',
  '全社員一覧を作る',
  '全社員の直属上司を確定する',
  '会社の90日目標を3〜5個決める',
  '各社員の仕事内容をヒアリングする',
  '6〜8職種の役割スコアカードを作る',
  '週次KPI会議を開始する',
  '月次1on1を開始する',
  '3か月後に初回試験評価を実施する',
  '2回程度運用後に報酬連動を検討する'
];

/* 第2章 プロジェクト体制 */
var PROJECT_ROLES = [
  { key:'ceo',      role:'最終責任者',    who:'代表取締役', resp:'方針・会社目標・重要権限の最終決定' },
  { key:'lead',     role:'社内PJ責任者',  who:'1名任命',    resp:'進行、期限、資料統合、会議運営' },
  { key:'deptHead', role:'部門責任者',    who:'各部門1名',  resp:'役割・KPI・権限・評価基準の作成' },
  { key:'hr',       role:'管理/人事',     who:'社内担当',   resp:'台帳、1on1、評価記録、文書管理' },
  { key:'external', role:'外部確認',      who:'社労士等',   resp:'就業規則・賃金規程・報酬連動の確認' }
];

/* 第7章 週次KPI会議のアジェンダ（45分） */
var MEETING_AGENDA = [
  { min:10, label:'目標と実績',            hint:'数字だけを確認する。説明は最小限。' },
  { min:20, label:'未達・異常値の原因',    hint:'差がある項目だけ扱う。活動報告会にしない。' },
  { min:10, label:'対策・担当者・期限',    hint:'必ず担当者名と期限をその場で決める。' },
  { min:5,  label:'社長判断事項と次回確認', hint:'社長が決めることを明確にし、次回の確認事項を残す。' }
];

var KPI_STATUS = [
  { key:'ok',    label:'達成',   cls:'ok' },
  { key:'watch', label:'注意',   cls:'warn' },
  { key:'ng',    label:'未達',   cls:'bad' },
  { key:'none',  label:'未入力', cls:'neutral' }
];

var EMPLOYMENT_TYPES = ['正社員','契約社員','パート・アルバイト','業務委託','役員'];

/* ============================================================
   ストア（localStorage への保存）
   ============================================================ */
function emptyData(){
  return {
    meta:{ version:APP_VERSION, createdAt:nowIso(), updatedAt:nowIso() },
    settings:{
      companyName:'', ceoName:'', projectLead:'', hrOwner:'', externalAdvisor:'',
      startDate:todayStr(), meetingDay:'月曜', meetingTime:'10:00',
      maxDirectReports:6, approvalAmount:100000, currentPeriod:quarterOf(todayStr())
    },
    projectRoles:{},
    employees:[], goals:[], scorecards:[], kpiWeeks:[], oneOnOnes:[],
    evaluations:[], reports:[], incidents:[], exceptions:[], improvementPlans:[],
    grades:JSON.parse(JSON.stringify(DEFAULT_GRADES)),
    planChecks:{}, firstSteps:{},

    /* --- 構造分析レポート（負のシステム対策）で追加した領域 --- */
    decisions:[],        /* 重大決裁の防波堤（24時間ルール） */
    ventures:[],         /* 新規案件の1枚企画書（48時間ルール） */
    delegations:[],      /* 委任カード（任せ方6項目） */
    partners:[],         /* 関係者台帳（利害・契約・撤退条件） */
    capital:{ periods:[], spends:[],
              rule:{ reinvestRate:50, nonBizCap:0, approver:'', note:'' } },
    diagnosis:{ answers:{}, updatedAt:'', history:[] }
  };
}

var DB = {
  data:emptyData(),
  load:function(){
    try{
      var raw = localStorage.getItem(STORAGE_KEY);
      if(raw){
        var parsed = JSON.parse(raw);
        this.data = mergeDefaults(parsed, emptyData());
      }
    }catch(e){
      console.error('読み込みに失敗しました', e);
      toast('保存データの読み込みに失敗しました。初期状態で開始します。','bad');
      this.data = emptyData();
    }
    return this.data;
  },
  save:function(){
    this.data.meta.updatedAt = nowIso();
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    }catch(e){
      console.error(e);
      toast('保存に失敗しました。ブラウザの保存容量を確認してください。','bad');
    }
    /* 共有モードのときは、共有フォルダ／共有サーバーへも反映する */
    if(typeof syncAfterSave === 'function') syncAfterSave();
  },
  reset:function(){ this.data = emptyData(); this.save(); }
};

/* 保存済みデータに新しい項目が増えていても壊れないように補完する */
function mergeDefaults(saved, def){
  if(saved === null || saved === undefined) return def;
  if(Array.isArray(def)) return Array.isArray(saved) ? saved : def;
  if(typeof def === 'object'){
    if(typeof saved !== 'object' || Array.isArray(saved)) return def;
    var out = {};
    for(var k in def) out[k] = mergeDefaults(saved[k], def[k]);
    for(var k2 in saved) if(!(k2 in out)) out[k2] = saved[k2];
    return out;
  }
  return saved === undefined ? def : saved;
}

/* ---------- 汎用ユーティリティ ---------- */
function uid(prefix){
  return (prefix||'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,7);
}
function nowIso(){ return new Date().toISOString(); }
function todayStr(){ return fmtDate(new Date()); }
function fmtDate(d){
  if(!d) return '';
  if(typeof d === 'string') d = new Date(d);
  if(isNaN(d.getTime())) return '';
  var m = ('0'+(d.getMonth()+1)).slice(-2), day = ('0'+d.getDate()).slice(-2);
  return d.getFullYear()+'-'+m+'-'+day;
}
function fmtDateTimeLocal(d){
  if(!d) return '';
  if(typeof d === 'string') d = new Date(d);
  if(isNaN(d.getTime())) return '';
  return fmtDate(d)+'T'+('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);
}
function fmtJp(dstr){
  if(!dstr) return '—';
  var d = new Date(dstr);
  if(isNaN(d.getTime())) return dstr;
  var s = (d.getMonth()+1)+'/'+d.getDate();
  if(String(dstr).length > 10) s += ' '+('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);
  return d.getFullYear()+'/'+s;
}
/* 一覧に並べるときの短い日付（8/20 のような表記） */
function shortDate(x){
  if(!x) return '';
  var d = new Date(x);
  if(isNaN(d.getTime())) return String(x).slice(5);
  return (d.getMonth()+1)+'/'+d.getDate();
}
function monthStr(d){
  d = d ? new Date(d) : new Date();
  return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2);
}
function quarterOf(dstr){
  var d = new Date(dstr||todayStr());
  return d.getFullYear()+'-Q'+(Math.floor(d.getMonth()/3)+1);
}
function daysBetween(a,b){
  var d1 = new Date(a), d2 = new Date(b);
  return Math.round((d2-d1)/86400000);
}
function hoursBetween(a,b){
  var d1 = new Date(a), d2 = new Date(b);
  return (d2-d1)/3600000;
}
function weekMonday(dstr){
  var d = new Date(dstr||todayStr());
  var day = (d.getDay()+6)%7;      /* 月曜=0 */
  d.setDate(d.getDate()-day);
  return fmtDate(d);
}
function esc(s){
  if(s === null || s === undefined) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function nl2br(s){ return esc(s).replace(/\n/g,'<br>'); }
function lines(s){
  if(Array.isArray(s)) return s.filter(function(x){return String(x).trim()!=='';});
  return String(s||'').split('\n').map(function(x){return x.trim();}).filter(function(x){return x!=='';});
}
function pct(n){ return (isFinite(n)?Math.round(n):0)+'%'; }
function clamp(n,a,b){ return Math.max(a,Math.min(b,n)); }
function num(v,def){ var n = parseFloat(v); return isFinite(n) ? n : (def===undefined?0:def); }
function byId(arr,id){ for(var i=0;i<arr.length;i++) if(arr[i].id===id) return arr[i]; return null; }
function sortBy(arr,fn){ return arr.slice().sort(function(a,b){ var x=fn(a),y=fn(b); return x<y?-1:x>y?1:0; }); }
function uniq(arr){ var o=[],s={}; arr.forEach(function(v){ if(v && !s[v]){s[v]=1;o.push(v);} }); return o; }

/* 社員名の取得 */
function empName(id){
  var e = byId(DB.data.employees, id);
  return e ? e.name : '（未設定）';
}
function empOptions(includeBlank){
  var o = includeBlank ? [{value:'',label:'（未設定）'}] : [];
  sortBy(DB.data.employees, function(e){ return (e.dept||'')+e.name; }).forEach(function(e){
    o.push({ value:e.id, label:(e.dept?'['+e.dept+'] ':'')+e.name });
  });
  return o;
}
function deptList(){
  return uniq(DB.data.employees.map(function(e){return e.dept;}).filter(Boolean));
}
function jobTypeList(){
  var fromCards = DB.data.scorecards.map(function(s){return s.jobType;});
  return uniq(fromCards.concat(DEFAULT_JOB_TYPES));
}
