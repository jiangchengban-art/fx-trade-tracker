# FX Trade Tracker — プロジェクトガイド

## 📄 ファイル構成

```
.
├── index.html              ← 唯一のプロダクトコード
├── manifest.json           PWA マニフェスト
├── sw.js                   Service Worker（オフライン対応・現在 v51）
├── generate-icons.html     アイコン生成用（不使用）
└── icons/                  PWA アイコン
```

## 🚀 開発方針

### 単一ファイル設計の利点と制約
- ✅ **デプロイ**: HTML1ファイル、クライアント側のみで完結
- ✅ **スタンドアロン**: ローカルストレージ自己完結（クラウド同期なし）
- ⚠️ **維持**: 4000行超なので変更時は細心の注意

### コード変更時のチェックリスト
- [ ] Node.js で JS 構文チェック: `node -e "new vm.Script(code)"`
- [ ] ローカルストレージキー（`fx_*`）の衝突確認
- [ ] フォーム UI: deposit/entry 切替時に CSS class 動作確認
- [ ] 同期コード: `dbLoadRaw()` / `dbLoad()` の使い分け
- [ ] 統計タイル: エントリー/入金/出金/仮想の表示ロジック確認
- [ ] HTML を含む文字列をラベルに設定するときは `innerHTML`（`textContent` は NG）
- [ ] HTML 変更後は `sw.js` の `CACHE_NAME` をインクリメント

## 📊 主要な関数群

### ★ 登録・編集（handleRegister / saveEdit）
- Deposit 判定で分岐（`isDepositStatus()`）
- Trade-only 項目の削除・クリア処理


### ★ シミュレーション（renderSkipTradeSim / renderSimulation）
- リスク履歴スタック方式（共通ロジック）
- 損切 = pop（1段戻る）
- `renderSkipTradeSim` = 統計タブの仮想損益シミュ（スルートレード想定）
- `renderSimulation` = まとめタブの資金シミュレーション（連続トレード想定）
- **注意**: 両者は目的が異なる別計算（シミュは手動シナリオ、スルー分析は記録日時順）

### ★ スルー理由別成績（renderSkipByReason / computeSkipStackStats）
- `computeSkipStackStats(trades, risk)` でグループ内を datetime 昇順にスタック計算
- `getSkipRisk()` の値（仮想損益シミュと同じ入力欄）を初期リスクとして共有
- 表示: 最終資金・増減率・勝率バー・最大連勝/最大連敗 + 結果種類チップ（MAX/BIG/REG/微益/建値/損切）
- 見出し右に「記録日時順で計算」注記あり

### ★ エントリーチャンス集計（renderOpportunityStats）
- 全ステータス（entry/through/miss）を対象
- ステータス3タイル + 比率バー + エントリー結果タイル
- グループ別分類（メイン通貨/サブ通貨/時間足）は削除済み（スルー理由別と重複のため）

### ★ 統計（renderStats）
- **レイアウト**: 左=エントリー/入金計/出金計積み上げ、右=総資金（大）
- 入金/出金を分割表示（pnl > 0 vs < 0）
- 総資金 = エントリー損益 + 入金計 + 出金計
- 資本推移チャート: 💰(入金)・💸(出金)・#(エントリー)で表示（`renderCapitalChart`）
- 成績内訳: 表示順に「平均エントリー保有時間」→「MA収束〜拡散期間」
  - `renderEntryDurationStats`: entry + 両日時あり のデータで保有時間集計。グラフ刻み＝日単位（〜1日/〜2日/〜3日/〜5日/5日+）
  - `renderMaConvStats`: maConvDuration フィールドで集計

### ★ カレンダー（renderCalendar）
- ドット色: 勝ち=緑 `#10b981`、負け=赤 `#ef4444`、建値=グレー `#94a3b8`
- スルー=黄橙 `#f59e0b`、ミス=紫 `#a855f7`（オレンジと区別するため紫に変更済み）

### ★ タックスシミュレーター（renderTaxSim）
- まとめタブ内
- 控除オプションは `<details>` アコーディオン形式（デフォルト折りたたみ）
- 基礎控除・給与所得控除・住民税均等割をチェックボックスで個別ON/OFF

### ★ エントリーチャンスメモ（initChanceMemos / saveChanceMemos / v40以降）
- `fx_trades_v1` に `_type: 'memo'` レコード（`id: 'memo_chance_slots'`）として保存 ✅ v40
- トレード表示時は自動除外（`dbLoad()` で `_type !== 'memo'` フィルター）
- **同期**: 既存の `cloudPush`/`cloudPull` パイプラインで PC ↔ iPhone 同期 ✅ v40
- **デバウンス**: 入力中はローカルのみ → 3秒後にクラウド同期（パフォーマンス）
- **pagehide/visibilitychange**: 即座にクラウド同期（iOS 離脱時も確実保存）
- **旧キー**: `fx_chance_memo` から自動マイグレーション＆削除 ✅ v40
- ヘッダーに最終更新日時を表示（`fmtDate(m.updatedAt)` で日付+時間）

## 💾 データ管理

### ローカルストレージキー
- `fx_trades_v1` — すべてのトレード記録 + チャンスメモ（v40以降は memo レコードも含む）
- `fx_active_tab` — 現在のアクティブタブ
- `fx_onboarding_done` — オンボーディング済みフラグ
- `fx_last_export_date` — 最後にエクスポートした日付
- `fx_banner_dismissed` — バナー非表示フラグ
- ~~`fx_chance_memo`~~ — **廃止** ✅ v40（自動マイグレーション → `fx_trades_v1` の memo レコードに統合）

### クラウド同期（Supabase REST API 版・v24以降）
- Suabase 同期機能は廃止済み（2026-05-19）
- Firebase SDK（WebSocket）は iPhone で繋がらないため撤去（2026-06-02）
- **Supabase REST API（fetch ポーリング）で PC ↔ iPhone 間同期** ✅ v24以降・実装完了
- 方式：
  - 起動時に1回 cloudPull → その後 30秒ごとポーリング（v42 で転送量削減） ✅
  - iOS Safari は setInterval 抑制のため visibilitychange/pageshow/focus イベント でも pull トリガー
  - 変化検知で再描画（ちらつき防止）
- データ構成：
  - トレード記録（`_type` 未指定）
  - チャンス履歴（`_type: 'chance'`）
  - チャンスメモ（`_type: 'memo'`）✅ v40 で統合
- テーブル：`trades`（`id TEXT PRIMARY KEY`, `data JSONB`, `updated_at TIMESTAMPTZ`）
- RLS：無効化（テストモード・全員読取・書込可）→ 認証付きに移行予定
- **画像保存戦略（v42 から）**：
  - 画像ありトレードは cloudPush 除外 → Supabase に送らない
  - PC のローカルストレージのみに保存
  - iPhone は「📷 読み込む」ボタンでオンデマンド取得
  - 転送量削減の中核戦略
- **現在の状態**: 実装完了・安定動作中（v42・転送量削減完了）

## 🧪 テスト項目

### 入出金フロー
1. ステータスで「💰 入出金」選択 → 手法・結果など非表示、ラベル正常表示確認
2. **入金**: 正の金額入力 → 履歴に緑カード＆「💰 入金」バッジ、統計に「入金計」表示
3. **出金**: 負の金額入力 → 履歴に赤カード＆「💸 出金」バッジ、統計に「出金計」表示
4. 統計タイル: 総資金 = エントリー損益 + 入金計 - 出金計 の計算確認

### ソフト削除
1. トレード削除 → `deleted:true` 付与で非表示
2. ローカル確認 → localStorage に `deleted:true` が正しく保存されているか確認

### シミュレーション（まとめタブのみ）
- 初期10k → MAX×2 (30k→90k) → 損切 → 次リスク30k 確認
- 複数損切時の段階的な pop 動作確認

### チャンスメモ永続化
- まとめタブでメモ入力 → 他タブへ移動 → まとめタブ戻る → 内容が残っているか
- リロード後も内容が残っているか
- 「クリア」ボタンで消えるか

## 📝 今後の変更予定

- [x] 出金パターン（負の入金）✅ 2026-05-09
- [x] 仮想資金推移シミュレーション削除（不要と判断）✅ 2026-05-09
- [x] 実資金推移シミュレーション削除（統計タブ）✅ 2026-05-10
- [x] 成績内訳タブ整理（手法別/時間足別/メイン通貨/サブ通貨 削除 → MA収束のみ）✅ 2026-05-10
- [x] スルー理由別成績をスタック方式集計に変更 ✅ 2026-05-10
- [x] カレンダーのスルー/ミスドット色を区別（ミス: オレンジ→紫）✅ 2026-05-10
- [x] エントリーチャンス集計グループ別分類削除（スルー理由別と重複のため）✅ 2026-05-10
- [x] スルー理由別成績に結果種類チップ（MAX/BIG/REG等）を可視化 ✅ 2026-05-10
- [x] 控除オプションをアコーディオン形式に変更 ✅ 2026-05-10
- [x] Supabase複数デバイス競合バグ修正（pull-first化）✅ 2026-05-12
- [x] 履歴カードにMA収束時間表示 ✅ 2026-05-12
- [x] 統計タブに平均エントリー保有時間セクション追加 ✅ 2026-05-12
- [x] 履歴カードのエグジット日付・経過時間を「日+時間」表記に修正 ✅ 2026-05-12
- [x] チャンスメモに最終更新日時を記録・表示 ✅ 2026-05-12
- [x] Supabase 転送量削減対策（ポーリング 6秒→30秒 + 画像 push 除外）✅ 2026-07-02 (v42)
- [x] エントリー品質 & 損切り分析（プロ同期率・排除可能損切率）✅ 2026-07-03 (v43)
- [x] 全体リファクタリング・バグ修正・590行削減（修正A実装）✅ 2026-07-08 (v44)
- [x] 勝率改善：建値を分母から除外（勝率=wins/(wins+losses)、建値は独立表示）✅ 2026-07-13 (v45)
- [x] 建値タッチ分析機能（1タッチ許容→保有継続の平均損益検証）✅ 2026-07-13 (v46)
- [x] 分散エントリー（バスケット）分析機能（同時分散トレードをバスケット単位で集計）✅ 2026-07-25 (v47)
- [ ] Firebase Storage に画像バックアップ機能
- [ ] Supabase 月間 egress 監視ダッシュボード
- [ ] タックス計算タブ（本格的な確定申告シミュレーター）
- [ ] ゴミ箱UI（削除済みトレードの復元機能）
- [ ] デバイス間データ競合の高度な検出
- [ ] Supabase 認証機能（multi-user 対応）

## 💡 既知の制約

- **認証なし同期**: 現在はセキュリティルールが全オープン（テストモード）。認証付きへの移行予定
- **削除の完全クリーンアップなし**: 墓標（`deleted:true`）は永遠に残る（ただし表示されない）
- **スルー理由別 vs まとめタブシミュの数値不一致**: 前者は記録日時順・後者は手動シナリオのため同じ組み合わせでも結果が異なる（設計上の意図的な差異）

## 📋 廃止済みの機能

- **Suabase同期** ✅ 廃止 2026-05-19
  - 原因：RLS設定とクラウド管理の複雑性
  - 方針転換：ローカルストレージオンリーで単純化

---


## 🔧 2026-05-13 実装

- [x] チャンスメモの自動開閉機能（入力あり→開く、なし→閉じる）✅ 2026-05-13
- [x] Supabaseのデモ用トレード削除（8件削除、7件保持）✅ 2026-05-13
- [x] Service Worker キャッシュ v16→v17 ✅ 2026-05-13

## 🔧 2026-05-19 セッション：Suabase 廃止

- [x] Suabase同期機能を完全廃止 ✅ 2026-05-19
- [x] クラウド連携UI全削除 ✅ 2026-05-19
- [x] 全トレード履歴を新規クリア ✅ 2026-05-19
- [x] ローカルストレージオンリー方針に切り替え ✅ 2026-05-19

詳細: [2026-05-19 セッションログ](../../memory/archived_session_2026_05_19.md)


## 🔧 2026-06-01/02 セッション：Firebase 同期方式の根本改革（REST API 版）

**背景**
- 前セッション（2026-05-28）で QR コード機能を実装・デプロイしたが、iPhone で「データがありません」エラー
- 原因調査 → **Firebase SDK（WebSocket）が iPhone で繋がらない**ことを特定

**実装内容**
- [x] Firebase SDK（WebSocket）を撤去 ✅ 2026-06-02
- [x] REST API（fetch）による同期に全面切り替え ✅ 2026-06-02
- [x] `cloudPush()` / `cloudPull()` 関数実装（PATCH/GET） ✅ 2026-06-02
- [x] 8秒ポーリング + 変化検知で再描画最適化 ✅ 2026-06-02
- [x] Service Worker キャッシュ v23 → v24 ✅ 2026-06-02
- [x] Firebase Hosting へのデプロイ ✅ 2026-06-02

**テスト状況**
- ✅ PC（Chrome）: REST API で正常に同期
- ✅ Firebase RTDB: 20 件のトレード保存確認（直接 REST URL でアクセス可能）
- ⏳ iPhone（Safari）: Service Worker キャッシュ問題の可能性 → 次セッションで確認予定

**詳細**: [[archived_session_2026_06_01_02]]

## 🔧 2026-06-05/06 セッション：iPhone 双方向同期完成・画像省略モード

**背景**
- PC → Supabase は成功していたが、iPhone は Supabase からのデータ取得(pull)が失敗
- 原因調査 → **localStorage 容量オーバー**（画像 4MB で上限 5MB を溢れさせていた）

**実装内容**
- [x] Service Worker: Supabase API をキャッシュ対象外に ✅ 2026-06-05 (v30)
- [x] iPhone pull トリガーを大幅追加（visibilitychange/pageshow/focus/touchstart） ✅ 2026-06-05 (v30)
- [x] 画面に同期状況を表示（原因特定用）✅ 2026-06-05 (v31)
- [x] 容量オーバー時の自動画像除外フォールバック ✅ 2026-06-05 (v32)
- [x] iPhone オンデマンド画像読み込み機能（📷 ボタン） ✅ 2026-06-06 (v33)
- [x] Firebase Hosting へのデプロイ ✅ 2026-06-06

**テスト状況**
- ✅ PC: 画像込みで 31 件保存確認
- ✅ iPhone: 履歴が表示される（画像省略状態）
- ✅ オンデマンド画像読み込みで PC 側の画像が表示可能
- ⏳ 実運用での容量確認（予定）

**詳細**: [[archived_session_2026_06_05_06_iphone_sync]]

**最終更新**: 2026-06-06 — Supabase 双方向同期 ✅ 完成・PC ↔ iPhone 実装完了・オンデマンド画像読み込み・Firebase Hosting v33

## 📋 次セッション優先事項（2026-07-26 現在）

### 🔴 必須（実装優先度 High）
- [ ] **Firebase Storage 移行実装** — PC ↔ iPhone 両デバイスで画像同期
  - 実装時間: 6～7 時間（自動実装予定）
  - ステップ: Firebase セットアップ → Core 関数 → handleRegister/saveEdit 修正 → Supabase 連携 → 履歴カード対応 → マイグレーション → テスト
  - テスト: PC・iPhone 両機器での画像表示確認必須

### 🟡 重要（検証・テスト）
- [ ] **iPhone 同期の根本原因調査** — 6月29日のトレードが反映されない理由
  - 実施内容: PC で登録した 6月29日トレード → iPhone 同期確認 → 未反映検出
  - 仮説: 古いデータの iPhone ローカルストレージが優位（pull-first でも上書きされない可能性）
  - 詳細: [[archived_session_2026_07_26]]

### 🟢 低優先（将来実装）
- [ ] 複数デバイス間のデータ競合検出・自動解決
- [ ] Supabase セキュリティルール強化（認証付き）
- [ ] メールアドレス認証追加（ユーザー個別データ管理）
- [ ] タックス計算タブ・ゴミ箱UI

## 🔧 2026-06-03 セッション：Supabase 同期実装開始

**背景**
- 前セッションで Firebase REST API 版を実装したが、iPhone Service Worker キャッシュ問題が未解決
- ユーザーから「Supabase で PC ↔ iPhone 同期を実装してほしい」と方針変更指示

**実装内容**
- [x] Supabase プロジェクト作成 ✅ 2026-06-03
- [x] Supabase テーブル `trades` 作成 ✅ 2026-06-03
- [x] Firebase → Supabase への cloudPush/cloudPull 切り替え ✅ 2026-06-03
- [x] resetSupabaseToPC() 関数実装 ✅ 2026-06-03
- [x] Service Worker v24 → v25 ✅ 2026-06-03
- [ ] CORS エラー解決（次セッション優先）

**テスト状況**
- ❌ PC（localhost:8000）: CORS エラー（`net::ERR_FAILED`）で通信失敗
- ⏳ Supabase テーブル作成確認待ち（SQL は実行成功したが、テーブル表示未確認）
- ⏳ iPhone テスト未実施

**詳細**: [[archived_session_2026_06_03]]

**最終更新**: 2026-06-03 — Firebase → Supabase への切り替え・cloudPush/cloudPull 実装・CORS エラー未解決 (sw v25)

## 🔧 2026-06-19 セッション：画像ボタン修正＆チャンス履歴実装

**背景**
- 前セッション（2026-06-05/06）で Supabase 双方向同期完成
- iPhone で「📷 画像を読み込む」ボタンが表示されず（古い画像付きトレードに限定）
- マージ時の `_hasImages` フラグ消失バグ + iPhone からのプッシュで画像全消去バグを特定
- ユーザーからチャンスメモの履歴記録・転換率分析要望

**実装内容**
- [x] 📷 ボタンバグ修正：マージ後に `_hasImages` を確定的に再設定 ✅ 2026-06-19 (v34)
- [x] JSON/QR/インポートボタン削除（未使用機能） ✅ 2026-06-19 (v35-36)
- [x] iPhone プッシュで画像消去バグ対策（`_hasImages` トレードを push 対象外） ✅ 2026-06-19 (v37)
- [x] チャンスメモ 3 枠 → 5 枠拡張 ✅ 2026-06-19 (v38)
- [x] **チャンス履歴機能実装** ✅ 2026-06-19 (v39)
  - チャンス枠に「✅ エントリー / ⏭️ スルー / 💨 消滅」結果ボタン
  - チャンス履歴UI（まとめタブ下部）：転換率 + 3分割バー + リスト
  - チャンス転換率統計（統計タブ新セクション）
  - データ相乗り設計（`_type: 'chance'` で区別）
  - 既存同期パイプラインの再利用（新バグ温床回避）

**テスト状況**
- ✅ 構文チェック OK
- ✅ Firebase Hosting v39 デプロイ完了
- ⏳ **チャンス枠ボタン表示確認中**（画面スクロール or UI 構造要確認）
- ⏳ iPhone 同期テスト未実施

**技術ポイント**
- `dbLoad()` に `_type !== 'chance'` フィルター → トレード表示は自動除外
- `dbLoadChances()` 新設 → チャンス専用抽出関数
- `isImgStrippedLocally()` で iPhone の容量対策の自動判定
- Supabase pull-first（クラウド優位）デザイン確立

**詳細**: [[archived_session_2026_06_19]]

**最終更新**: 2026-06-19 — 📷画像修正・チャンス5枠・履歴UI・転換率・同期堅牢化 (sw v39)

## 🔧 2026-06-21/22 セッション：チャンスメモ同期修正＆クリアボタンUI改善

**背景**
- ユーザーから「PC に記入したチャンスメモが iPhone で反映されない」と報告
- 原因：チャンスメモが旧設計で `fx_chance_memo`（localStorage 独立キー）に保存されており、Supabase 同期対象外だった

**実装内容**
- [x] チャンスメモを `_type: 'memo'` レコードとして `fx_trades_v1` に統合 ✅ 2026-06-21 (v40)
  - 既存の `cloudPush`/`cloudPull` パイプラインに自動的に乗る
- [x] `loadChanceMemos()` / `saveChanceMemos()` を `dbSave()` ベースに書き換え ✅ 2026-06-21 (v40)
  - 入力中はローカルのみ、3秒デバウンス後にクラウド同期
  - pagehide/visibilitychange 時は即座にクラウド同期
- [x] `dbLoadMemo()` 関数新設、`dbLoad()` フィルターに `_type !== 'memo'` 追加 ✅ 2026-06-21 (v40)
- [x] `cloudPull()` でメモ受信時に UI 再描画 ✅ 2026-06-21 (v40)
- [x] 旧 `fx_chance_memo` キーからのマイグレーション実装 ✅ 2026-06-21 (v40)
- [x] クリアボタンをヘッダーから結果ボタン行の下に移動 ✅ 2026-06-22 (v41)
  - 矢印ボタンの誤タップリスク排除
  - 「🗑 クリア」に変更して用途明確化
- [x] Service Worker キャッシュ v39 → v40 → v41 ✅ 2026-06-22
- [x] Firebase Hosting へのデプロイ ✅ 2026-06-22

**テスト状況**
- ✅ ローカル（Playwright）：メモ入力→3秒後クラウド push 確認・Commit/Clear 動作確認・UI 位置確認
- ⏳ iPhone Safari：v41 キャッシュ更新後の実機確認が必要（タブ閉じ→再読込）
- ⚠️ 可能性：v40 実装前のテストで空メモが push されている可能性あり（クラウド汚染確認推奨）

**技術ポイント**
- デバウンス＋`localOnly` フラグで入力パフォーマンスと同期確実性を両立
- `_flushMemos()` で pagehide 時に必ずクラウド同期
- ローカルマイグレーション：古い `fx_chance_memo` が見つかれば自動変換後削除

**詳細**: [[archived_session_2026_06_21_22]]

**最終更新**: 2026-06-22 — チャンスメモPC↔iPhone同期実装・クリアボタンUI改善完了 (sw v41)

## 🔧 2026-07-02 セッション：Supabase Egress 超過・v42 転送量削減実装

**背景**
- iPhone からのアプリアクセス時に「同期エラー」発生（2026-06-28）
- Supabase の月間 egress（転送量）が 5 GB 枠に対して 19.4 GB に達成
- 6秒ごとのポーリングで画像を含む全トレードが何度も転送されていた

**原因分析**
- Organization レベルでサービス制限がかかった（HTTP 402）
- PC ↔ iPhone 両デバイスでのポーリング × 長時間稼働 = 転送量爆増
- 課金周期：16 Jun 2026 - 16 Jul 2026（リセット待ち）

**実装内容**
- [x] ポーリング間隔を 6秒 → 30秒に延長（転送量 1/5 削減）✅ 2026-07-02 (v42)
- [x] 画像ありトレード全体を cloudPush 除外（`!t._hasImages` フィルター追加）✅ 2026-07-02 (v42)
- [x] 画像保存戦略を確立（PC のローカルストレージのみ、Supabase には送らない）✅ 2026-07-02
- [x] Service Worker キャッシュ v41 → v42 ✅ 2026-07-02
- [x] Firebase Hosting へのデプロイ ✅ 2026-07-02

**テスト状況**
- ✅ git commit + Firebase Hosting デプロイ完了
- ✅ コード修正の説明と影響分析完了
- ⏳ 実際の同期テスト → 7月16日の Supabase 復旧後に実施予定

**技術ポイント**
- `cloudPush()` で画像ありトレードを push 除外しても、ローカルストレージには画像が完全保存される
- iPhone は「📷 読み込む」ボタンでオンデマンド取得（`loadImgFromCloud()`）
- visibilitychange/pageshow/focus イベントでも pull トリガーされるため、ユーザーの操作感は損なわない

**詳細**: [[archived_session_2026_07_02_supabase_egress]]

**最終更新**: 2026-07-02 — Supabase Egress 超過解析・v42 転送量削減実装・画像保存戦略確立 (sw v42)

## 🔧 2026-07-03 セッション：エントリー品質 & 損切り分析機能（v43）

- [x] 登録/編集フォームに「🎯 プロと同じタイミングでエントリーできたか」トグル（`proTiming`: match/miss）✅ (v43)
- [x] 「🔍 この損切りは今後排除可能な理由だったか」トグル（`stoplossAvoidable`: yes/no、結果=損切のとき表示）✅ (v43)
- [x] 履歴カードにバッジ表示・統計タブに「エントリー品質 & 損切り分析」セクション（プロ同期率・排除可能損切率）✅ (v43)
- [x] Service Worker v42 → v43・Firebase Hosting デプロイ ✅ 2026-07-03

## 🔧 2026-07-08 セッション：全体リファクタリング＆バグ修正（v44）

**プロジェクト全体を精査して最適化。約590行削減（5806→5216行）**

**バグ修正**
- [x] `maConvDuration` の `parseInt` → `parseFloat`（0.5h 刻みの値が消えるバグ）✅ (v44)
- [x] CSV エクスポートのフィールド名修正（`t.mashape`→`t.maShape` / `t.maConv`→`t.maConvDuration`、常に空列だった）+ プロ同期/損切排除可能の列追加 ✅ (v44)
- [x] **修正A 実装**: `_saveMemoRecord` で内容が変わっていない保存を完全スキップ（空メモ・同一内容の push が他デバイスを上書きするのを防止）✅ (v44)
- [x] `toggleReviewed` 削除（`dbLoad()`→`dbSave()` でメモ・チャンス履歴・墓標が全消失するデータ喪失バグ持ちの未使用関数）✅ (v44)

**仕様整合**
- [x] プロ同期ブロックを entry ステータス時のみ表示に（スルー/ミスでは非表示・値クリア）✅ (v44)
- [x] 損切排除可能ブロックは entry かつ 結果=損切 のみ表示。保存時もガード ✅ (v44)
- [x] `clearToggleGroup` / `updateEntryQualityBlocks` ヘルパー新設（resetRegisterForm も簡素化）✅ (v44)

**死にコード削除（HTML 要素が存在しない/未参照の関数群）**
- [x] `renderBreakdowns` / `renderBreakdownV2` / `renderStatusBreakdown` / `switchBreakdownTab`（成績内訳タブは v10 で削除済みだった）
- [x] `renderSummary`（`sum-*` 要素は存在せず、`result === 'win'/'loss'` という誤ったキー参照もあった）
- [x] `renderOpportunityLoss` / `renderEntryVsSkip` / `renderChanceSimulation` / `calcEvMult` / `RESULT_MULT` / `computeSkipSimStats` / `calcSkipSimPnl`
- [x] QR モーダル一式（Google Charts QR API は廃止済みで動作不能）/ `importData` / `importFromJSON` / `fmtTime` / `toggleFilterSection` / `fmtPF` / `labelForKey`

**改善**
- [x] JSON エクスポートを `dbLoadRaw()`（チャンス履歴・メモ込みの完全バックアップ）に変更・version 3 ✅ (v44)
- [x] `restoreFromJSON()` コンソール用復元関数を新設（バックアップ JSON から全上書き復元）✅ (v44)
- [x] 表記修正: フッター「Firebase同期」→「Supabase同期」、入金→入出金ラベル ✅ (v44)
- [x] Service Worker v43 → v44 ✅

**テスト**: Playwright で登録/編集/entry限定表示/0.5h保存/修正A/全タブ切替を回帰テスト済み・全合格

**最終更新**: 2026-07-08 — 全体リファクタリング・データ喪失バグ排除・修正A実装・590行削減 (sw v44)

## 🔧 2026-07-09 セッション：勝率改善 & 建値タッチ分析（v45-v46）

### v45 実装：勝率計算から建値を除外

**背景**
- ユーザー指摘：建値決済（損益0円）が勝率分母に含まれ、実際のトレード優位性が過小評価されている

**解決策**
- 勝率分母を「全トレード数」→「勝ち+負け数」に統一
- `winrate = wins / (wins + losses)` 計算
- 分母が0のケース（全建値）は `null` → UI では「—」表示
- 勝率タイル下に「建値 N回（勝率には含まず）」を独立表示

**変更範囲**（4関数）
- [x] `computeSegStats()` - エントリー勝率計算
- [x] `computeSkipStackStats()` - スルー理由別成績
- [x] `renderSkipByReason()` - リスク未入力時分岐
- [x] `renderSkipTradeSim()` - 仮想シミュレーション勝率

**テスト**: ✅ 2勝1敗1建値→67% / 全建値→— / 建値表示行

**デプロイ**: ✅ Firebase Hosting v45

### v46 実装：建値タッチ分析機能

**ユーザーのトレードルール**
- 利確・損切を決めて3分割エントリー（RR 2:1 / 3:1 / 4:1）
- RR 2:1 到達後、損切位置を建値へトレール
- **新ルール**: 値動きの癖として「1回目タッチで保有継続、2回目タッチで決済」が有利かを検証したい

**既存フィールド活用**
- `breakevenTouch`（既実装・未使用）を統計に反映
- 値の意味を明確化：`none` / `touch`（1タッチ保有継続）/ `stoploss`（2回タッチ決済）

**ボタンラベル変更**
- 「損切」→「2回タッチで決済」

**統計セクション「⚡ 建値タッチ分析」新設**
- タッチ発生率: トレール実施トレード中のタッチ発生度
- 1タッチ許容→保有継続した場合の結果内訳（利確/建値/損切）
- 平均損益: 「即決済なら常に0円」との比較 → 新ルール有効性を数値化
- 2回タッチ決済した件数を別記

**履歴カード**
- `touch` → 「⚡ 1タッチ保有継続」バッジ
- `stoploss` → 「⚡ 2回タッチで決済」バッジ

**実装関数**
- [x] `renderBeTouchStats(trades)` - 新規統計レンダリング関数（line 5149）
- [x] 履歴カード表示ロジック拡張（line 2364）
- [x] 関数呼び出し追加（line 3019）

**テスト**: ✅ 9項目検証（発生率80% / 利確1 / 建値1 / 損切1 / 平均損益 / 2回タッチ件数 / バッジ×2）

**デプロイ**: ✅ Firebase Hosting v46

**最終更新**: 2026-07-13 — 勝率改善・建値タッチ分析機能実装・リスク管理スキルの可視化 (sw v45→v46)

## 🔧 2026-07-25 セッション：分散エントリー（バスケット）分析機能（v47）

**背景**
- ユーザー要望：相関の高い複数通貨（ドルストレート系・クロス円系等）に同時分散エントリーしているが、「この分散が実際に期待値を生んでいるか」を検証したい
- 現状：トレードが1件ずつ独立記録 → バスケット単位での勝敗・期待値が見えない

**実装内容**

### データモデル拡張
- [x] トレードレコードに `groupId` フィールド追加（string | null）
  - `null` = 単独エントリー（従来通り）
  - 同一 `groupId` の entry トレード群 = 1バスケット（同時分散）
- [x] entry ステータス時のみ意味を持つ（deposit/through/miss は常に null）
- [x] JSON・Supabase同期に自動追従（既存パイプライン流用）

### フォーム UI（entry 限定表示）
- [x] 新ブロック「🔗 分散エントリー（バスケット）」（entry 時のみ表示）
- [x] チェックボックス + select で、「🆕 新規」or「直近バスケットに追加」を選択
- [x] 直近バスケット一覧を動的生成（日付・通貨ペア・レッグ数）
- [x] 登録/編集フォーム両対応

### ヘルパー関数（新規）
- [x] `getRecentBaskets(limit=8)` - 直近バスケット取得（groupId でグルーピング・日時昇順ソート）
- [x] `populateBasketSelect(prefix, keepGroupId)` - select に options 組み立て
- [x] `toggleBasketSelect(prefix)` - チェック連動で select 表示/非表示 + 一覧更新
- [x] `resolveGroupId(prefix, status)` - 保存時に groupId 決定（新規は uid() 発番）

### 統計セクション「🔗 分散エントリー分析」新設
- [x] **バスケット勝率**（net判定・建値除外 = v45 ルール踏襲）
  - 各バスケットの合計損益で勝敗判定 → バスケット単位の勝率・平均損益
- [x] **分散 vs 単独の比較**
  - 単独エントリー（groupId なし）の平均損益と並べて表示
  - 「分散が本当に期待値上げているか」を数値化
- [x] **レッグ再解釈**
  - 個々のトレード（レッグ）は 2勝1敗でも → まとめるとバスケットは 1勝0敗
  - 「1つ損切りでも他で取れてバスケット合計はプラス」を可視化
- [x] **直近バスケットリスト**
  - net損益・レッグ数・通貨ペア表示

### 履歴カード表示
- [x] `groupId` あれば「🔗 分散エントリー」バッジ表示（indigo 色）

### CSV エクスポート
- [x] ヘッダに「グループID」列追加
- [x] 各行に `t.groupId || ''` を含める

### 実装手順（計11ステップ）
1. 登録フォームに分散ブロック追加（静的 HTML）
2. ヘルパー関数群実装（getRecentBaskets / populateBasketSelect / toggleBasketSelect / resolveGroupId）
3. updateEntryQualityBlocks に entry 限定表示を統合
4. handleRegister / saveEdit / resetRegisterForm に groupId 反映
5. 編集モーダルにバスケット UI 追加
6. 履歴カードにバッジ表示
7. renderBasketStats 新規関数実装 + renderStats から呼び出し
8. CSV ヘッダ・行に groupId 追加
9. sw.js キャッシュ v46→v47
10. 構文チェック（node -e vm.Script）
11. Playwright 回帰テスト（3トレード 1 バスケット + 単独 1件で検証）

**テスト結果（Playwright）**
- ✅ 3件が同一 groupId を共有（バスケット紐付け成功）
- ✅ 単独トレードは groupId=null で分離
- ✅ バスケット勝率計算正確（net 判定・建値除外）
- ✅ 分散 vs 単独の平均損益比較表示
- ✅ レッグ再解釈（個々 2勝1敗→バスケット 1勝0敗）
- ✅ 履歴カード🔗バッジ 3件表示
- ✅ JS 構文チェック ALL OK

**デプロイ**: ✅ Firebase Hosting v47

**最終更新**: 2026-07-25 — 分散エントリー（バスケット）分析機能実装・バスケット単位の勝率/期待値検証基盤確立 (sw v47)

## 🔧 2026-07-26 セッション：Supabase 復旧・同期検証・Firebase Storage 移行仕様設計

**背景**
- Supabase プロジェクトが Organization レベルでサービス制限（HTTP 402）— Egress 19.4GB 超過（月間 5GB 枠）
- iPhone で PC 入力データ（6月29日トレード）が反映されない
- v42 の画像 cloudPush 除外により、全履歴カードで画像が表示されない

**実装内容**
- [x] Supabase ダッシュボード確認 → 「Paused」状態を「Restore project」で復旧 ✅
- [x] DNS 解決確認 ✅ （vktnrrrfeeicfewtllfx.supabase.co → 172.64.149.246）
- [x] REST API 疎通テスト ✅ （GET /trades → JSON 200 OK）
- [x] resetSupabaseToPC() 実行 ✅ （PC ローカルデータを Supabase に上書き）
- [x] iPhone 同期検証 ⚠️ （6月29日データが反映されていない）
- [x] **Firebase Storage 移行仕様書作成** ✅ （6～7時間の完全実装計画・詳細設計済み）
  - データ構造変更: Base64 → Firebase URL に移行
  - PC・iPhone 両デバイスでの画像同期実現
  - Supabase egress ゼロ（画像は Firebase に分離）
  - 月額コスト: ¥0（月 1GB 無料枠内）

**テスト状況**
- ✅ Supabase 復旧・API 疎通確認
- ✅ resetSupabaseToPC() で 6月29日データも Supabase に反映
- ⚠️ iPhone 同期検証: PC データが iPhone に表示されない（原因調査中）
- ⏳ Firebase Storage 実装: 仕様設計完了、実装待ち

**ユーザー確認事項**
- [x] Firebase Storage の実装規模確認（6～7時間の必要性を確認・了承）
- [x] 自動実装フロー構築（以降は「実装をお願いします」→ 確認なしで自動実装）

**次セッション方針**
- Firebase Storage 移行実装（自動実装・6～7時間）
- PC ↔ iPhone 両デバイスでの画像表示確認
- iPhone 同期の安定性検証

**詳細**: [[archived_session_2026_07_26]]

**最終更新**: 2026-07-26 — Supabase 復旧・同期検証・Firebase Storage 仕様設計完了 (sw v47・実装待ち)

## 🔧 2026-07-27/28/29 セッション：Firebase Storage 移行実装（v48）

**背景**
- 前セッション（2026-07-26）で Firebase Storage 移行の仕様設計完了
- v42 での画像 cloudPush 除外により、全履歴カードで画像が表示されない状態
- 自動実装フロー確立（確認なしで実装開始）

**実装内容**
- [x] Firebase Storage REST API 関数群実装 ✅ 2026-07-27
  - `uploadImageToStorage()` / `uploadTradeImages()` （Base64 → Firebase URL）
  - `hasAnyImage()` / `hasBase64Images()` (判定用)
  - `migrateImagesToFirebase()` （既存画像一括移行・コンソール用）
- [x] handleRegister / saveEdit を async 化 ✅ 2026-07-27
  - 画像アップロード待ち処理追加
  - 保存前に URL 化完了
- [x] cloudPush フィルタを base64 検出ベースに変更 ✅ 2026-07-27
  - v42 の「画像ありは全除外」から、「Base64 のみ除外」に変更
  - URL 化された画像は通常通り Supabase 同期
- [x] Service Worker キャッシュ v47 → v48 ✅ 2026-07-27
- [x] 構文チェック OK ✅ 2026-07-27
- [x] Firebase Storage ルール設定（永続テストモード） ✅ 2026-07-29
  - Blaze プラン有効化
  - シミュレーション実行成功
  - ルール公開待ち

**実装ポイント**
- SDK 不使用（REST API 経由）→ iOS Safari 確実対応
- 月額コスト完全無料（無料枠 1GB/月、推定使用量 7.5～30MB）
- 既存の Base64 画像との互換性維持
- cloudPush フィルタ変更で Supabase egress ゼロ化

**テスト状況**
- ✅ 構文チェック
- ✅ Firebase Storage ルール・シミュレーション実行
- ⏳ ルール公開待ち
- ⏳ Firebase Hosting デプロイ待ち
- ⏳ 実機テスト待ち（PC・iPhone 両デバイス）

**詳細**: [[archived_session_2026_07_27_28_29_firebase_storage]]

**最終更新**: 2026-07-29 — Firebase Storage 移行実装完了・コード完成・ルール公開待ち (sw v48)

## 🔧 2026-07-29/30 セッション：戻しフィボナッチ（戻りエントリー）分析機能実装（v49）

**背景**
- ユーザー要望：逆指値でタイミングを逃した際に、1波にフィボナッチを当てて23.6/38.2/50.0/61.8%戻りでエントリー
- この「戻りエントリー」手法が期待値を生んでいるか検証するため、戻しフィボ％を記録して統計を取りたい

**実装内容**
- [x] 新フィールド `fibRetrace`（string | null）追加（entry 時のみ意味を持つ）✅ 2026-07-29
  - 値: `'23.6'` / `'38.2'` / `'50.0'` / `'61.8'`
  - deposit/through/miss では常に null
- [x] TOGGLE_STYLES に fibretrace グループ（cyan/teal/sky/blue）追加 ✅
- [x] 登録フォーム・編集モーダルに「🔢 戻しフィボナッチ」トグルブロック（entry限定表示）✅
- [x] updateEntryQualityBlocks に fibretrace-block 表示制御統合 ✅
- [x] handleRegister / saveEdit / resetRegisterForm 対応 ✅
- [x] 履歴カードに「🔢 戻り38.2%」バッジ表示 ✅
- [x] 統計セクション「🔢 戻りエントリー分析」新設 ✅
  - 戻りエントリー勝率（建値除外・v45ルール踏襲）
  - 戻りエントリー vs 通常逆指値の平均損益・勝率比較
  - フィボレベル別内訳（23.6/38.2/50.0/61.8）
- [x] CSV エクスポート「フィボ戻し(%)」列追加 ✅
- [x] Service Worker v48 → v49 ✅
- [x] Playwright 機能テスト実施（全PASS・ページエラーなし）✅

**テスト結果**
- ✅ entry限定表示・deposit/through切替時の自動クリア
- ✅ fibRetrace 保存・復元・編集モーダルハイライト
- ✅ 履歴バッジ表示（38.2% / 50.0%）
- ✅ 統計セクション：戻り2件 勝率100% +15,000円/回 vs 通常11件 勝率22%
- ✅ フィボレベル別内訳表示
- ✅ JS構文チェック OK

**デプロイ**: ✅ Firebase Hosting v49 デプロイ完了

**最終更新**: 2026-07-30 — 戻しフィボナッチ分析機能実装完了・Playwright テスト全PASS・Firebase Hosting デプロイ完了 (sw v49)

## 🔧 2026-08-07/08 セッション：Firebase Storage ルール公開・画像アップロード動作確認（v49）

**背景**
- v48（Firebase Storage 実装）のルール公開待ちの状態
- ユーザーからの懸念：既存画像消失の原因・課金枠の関係

**実装内容**
- [x] Firebase Storage セキュリティルール公開 ✅ 2026-08-07
  - 認証なし・誰でも読み書き可（REST API トークンなし設計に対応）
  - ルール設定：`match /trades/{allPaths=**} { allow read, write: if true; }`
- [x] REST API 動作確認テスト ✅ 2026-08-07
  - Playwright で画像アップロード実行 → **HTTP 200 成功**
  - 生成URL読み取り確認 → **HTTP 200（公開読取可）**
- [x] 既存画像消失の原因分析 ✅ 2026-08-08
  - **原因**: v42 で localStorage 容量超過（5MB上限） → アプリが自動削除（`_leanMode`）
  - **背景**: Base64 画像 1MB × 複数枚 = 容量超過 → `saveTradesLocal()` が画像省略版を保存
  - **確認**: cloudPull() のたびに画像なし版が上書き保存される仕様
  - 結論：**私の操作による削除ではなく、アプリの容量対策**
- [x] Supabase/Firebase Storage 関係確認（進行中）
  - Supabase: AWS S3 使用（月 5GB 転送枠・独立）
  - Firebase: Google Cloud Storage 使用（月 1GB 転送 + 5GB ストレージ・独立）
  - 課金枠が分離されており、Firebase Storage は実質無料枠内（推定 7.5～30MB）

**テスト状況**
- ✅ Firebase Storage ルール公開・API 動作確認
- ✅ REST API アップロード（HTTP 200）・読み取り（HTTP 200）
- ⏳ 新規トレード登録での画像アップロード（次セッション）
- ⏳ iPhone 同期確認（次セッション）

**詳細**: [[archived_session_2026_08_07_08_firebase_storage_verification]]

**最終更新**: 2026-08-08 — Firebase Storage ルール公開完了・REST API 動作確認・画像消失原因分析完了 (sw v49)

## 🔧 2026-08-15 セッション：確率ベース資金シミュレーター実装（v50）

**背景**
- ユーザー要望：月間チャンス回数・勝率・利確パターン別（REG/BIG/MAX）の比率から、資金増減ペースを試算したい
- 現状：既存シミュレーターは手動トレード入力型 → 統計的シミュレーションが不可

**実装内容**
- [x] HTML UI「📈 確率ベース資金シミュレーション」カード追加（資金シミュの下、税金シミュの上）✅
  - 初期リスク額（クイックボタン + 直接入力）
  - 月間チャンス回数・シミュ期間（月数・可変）
  - 勝率（%） — 残りは全て損切扱い
  - 利確内訳：REG / BIG / MAX の比率（%） — 合計が100%でなくても自動按分
- [x] 計算ロジック実装 ✅
  - 既存の資金シミュと同じ「リスクスタック方式」を踏襲
  - 月ごとのチャンス回数を勝率・利確比率で振り分け
  - 均等分散した順序で連続シミュレーション（Bresenham型按分）
- [x] 出力・グラフ表示 ✅
  - 最終資金・累計増減率・月平均増加率（複利ベース）
  - Chart.js による月次資金推移グラフ
- [x] Service Worker v49 → v50 ✅
- [x] JS 構文チェック OK ✅

**実装ポイント**
- `psimInterleave(counts)` 関数で複数パターン（REG/BIG/MAX/損切）を均等分散
- 月次ループで資金・リスク状態を継続計算
- 複利効果を反映した月平均増加率：`Math.pow(capital/initial, 1/months) - 1`

**コード追加行数**: ~130行（HTML UI + JS ロジック）
**デプロイ**: 未実施（テスト・確認待ち）

**最終更新**: 2026-08-15 — 確率ベース資金シミュレーター実装完了・コード構文チェックOK (sw v50)

## 🔧 2026-08-16 セッション：確率ベース資金シミュレーター デプロイ・バグ修正（v51）

**背景**
- v50 確率シミュレーター実装完了したが Firebase Hosting デプロイ未実施
- ユーザー実機テスト時に「勝率を 50% → 80% に変更しても最終資金が同じ 1,200,000円 のまま変わらない」バグ報告

**実装内容**
- [x] v50 Firebase Hosting デプロイ ✅ 2026-08-16
  - 22ファイルアップロード・release complete
  - ブラウザで確率シミュレーションカード表示確認 ✅
- [x] バグ原因分析 ✅
  - **原因**: 月ごとの `Math.round()` 丸め誤差
  - 月間チャンス 3回で勝率 50% と 80% が同じ「勝ち2回」に丸まる
  - 例: Math.round(3×50/100)=2回、Math.round(3×80/100)=2回
- [x] バグ修正（v51）✅
  - 月ごと計算 → **シミュ期間全体の一括計算** に変更
  - 全体チャンス数でまとめて勝敗を決定してから月別に均等分散
  - Bresenham型 `psimInterleave()` で各月に配置
  - 月間 1～5回という少数チャンスでも精度向上
- [x] Service Worker v50 → v51 ✅
- [x] JS 構文チェック ALL OK ✅
- [x] v51 Firebase Hosting デプロイ ✅ 2026-08-16
  - 2ファイルアップロード・release complete

**技術ポイント**
```javascript
// Before（月ごと丸め = バグ）
for (let m = 1; m <= months; m++) {
  const winCount = Math.round(chances * winrate / 100);
  ...
}

// After（全体計算 + 月別分散 = 修正）
const totalChances = chances * months;
const totalWin = Math.round(totalChances * winrate / 100);
const wlSeq = psimInterleave({ win: totalWin, loss: totalLoss });
for (let m = 1; m <= months; m++) {
  for (let c = 0; c < chances; c++) {
    const key = wlSeq[globalIdx];  // 事前計算済みシーケンス
    ...
  }
}
```

**テスト状況**
- ✅ v50 デプロイ・UI 表示確認
- ✅ バグ発見・原因分析・修正実装
- ✅ v51 デプロイ完了
- ⏳ ユーザーによる実機テスト検証待ち（勝率 50% vs 80% での結果差確認）

**最終更新**: 2026-08-16 — v50 デプロイ・v51 丸め誤差バグ修正・Firebase Hosting デプロイ完了 (sw v51)

---

## 📋 次セッション優先事項（2026-08-16 現在）

### 🔴 必須（実装優先度 High）
- [ ] **確率ベース資金シミュレーター実機テスト（v51）** — 勝率変更での結果差確認
  - 初期リスク 30,000円、月間チャンス 3回、シミュ期間 3ヶ月
  - 勝率 50% vs 80% での最終資金・月平均増加率が異なるか確認 ✅ v51 修正適用
- [ ] **Firebase Storage 新規トレード画像アップロード動作確認** — PC Chrome で実機テスト（v48-v49）
  - PC: Ctrl+Shift+R → 新規エントリー登録 → 画像1枚添付 → 登録ボタン
  - 履歴タブで画像表示確認
  - 画像右クリック→アドレスコピー→`firebasestorage.googleapis.com` で始まるか確認
- [ ] **iPhone 画像同期テスト** — Safari で新規トレード表示確認
  - iPhone Safari で https://fx-trade-tracker-de055.web.app を開く
  - タブ閉じて再読み込み（SW v51 更新のため）
  - PC で登録した画像トレードが表示されるか確認

### 🟡 重要（検証・デバッグ）
- [ ] **既存トレード画像復旧** — JSON エクスポートファイル有無確認
  - 背景: v42 で localStorage 容量超過 → アプリ自動削除（Base64 → 画像なし版保存）
  - 対策: 過去の JSON バックアップから復元可能か調査

### 🟢 低優先（将来実装）
- [ ] iPhone 同期の根本原因調査（6月29日データが反映されない）
- [ ] 複数デバイス間のデータ競合検出・自動解決
- [ ] Supabase セキュリティルール強化（認証付き）
- [ ] メールアドレス認証追加（ユーザー個別データ管理）

---

## 💾 リソース＆リンク

**コード**: [index.html](index.html) (v51・確率ベース資金シミュ修正版) / [sw.js](sw.js) (v51)
**ドキュメント**: [CLAUDE.md](CLAUDE.md) / [MEMORY.md](MEMORY.md)
**リモート**: https://github.com/jiangchengban-art/fx-trade-tracker
**ライブ**: https://fx-trade-tracker-de055.web.app (v51・最新デプロイ)
**セッション記録**: `memory/archived_session_2026_08_16_psim_bugfix.md`
