# FX Trade Tracker — プロジェクトガイド

## 📄 ファイル構成

```
.
├── index.html              ← 唯一のプロダクトコード（262KB）
├── manifest.json           PWA マニフェスト
├── sw.js                   Service Worker（オフライン対応）
├── generate-icons.html     アイコン生成用（不使用）
└── icons/                  PWA アイコン
```

## 🚀 開発方針

### 単一ファイル設計の利点と制約
- ✅ **デプロイ**: HTML1ファイル、クライアント側のみで完結
- ✅ **同期**: Supabase 自由度（ローカル ↔ クラウド）
- ⚠️ **維持**: 5000行超なので変更時は細心の注意

### コード変更時のチェックリスト
- [ ] Node.js で JS 構文チェック: `node -e "new vm.Script(code)"`
- [ ] ローカルストレージキー（`fx_*`）の衝突確認
- [ ] フォーム UI: deposit/entry 切替時に CSS class 動作確認
- [ ] 同期コード: `dbLoadRaw()` / `dbLoad()` の使い分け
- [ ] 統計タイル: エントリー/入金/仮想の表示ロジック確認

## 📊 主要な関数群

### ★ 登録・編集（handleRegister / saveEdit）
- Deposit 判定で分岐（`isDepositStatus()`）
- Trade-only 項目の削除・クリア処理

### ★ 同期（syncWithSupabase / mergeTrades）
- `dbLoadRaw()` で墓標含むすべてを push
- `pickWinning()` で競合解決（deleted:true 優先）

### ★ シミュレーション（renderSkipTradeSim / renderSimulation）
- **両方とも同じUI仕様** - selectドロップダウン (1-20回) + 3列グリッドサマリー
- リスク履歴スタック方式（共通ロジック）
- `simTradeResults` / `skipSimResults` は Object 型 `{ idx: resultKey }`
- 損切 = pop（1段戻る）

### ★ 統計（renderStats / renderCapitalChart）
- Deposits 集計して「入金計」表示
- 資金推移: entries + deposits で累積

## 🔐 Supabase 連携

### テーブル
```sql
CREATE TABLE fx_trades (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  synced_at TIMESTAMP DEFAULT NOW()
);
```

### 注意
- upsert は `on_conflict=id` で既存行を新しい data で上書き
- deleted:true も同じく upsert される（墓標伝播）
- ローカル config（URL + Anon Key）は `localStorage['fx_sb_config']`

## 🧪 テスト項目

### 入金フロー
1. ステータスで「💰 入金」選択 → 手法・結果など非表示確認
2. 金額入力・保存 → 履歴に緑カード＆「💰 入金」バッジ確認
3. 統計タブ→期間フィルタで「入金計」列表示確認

### ソフト削除
1. トレード削除 → `deleted:true` 付与で非表示
2. クラウド同期 → 他端末でも墓標伝播で削除状態が共有
3. importData 後の merge が墓標を保持するか確認

### シミュレーション（両タブ）
- 初期10k → MAX×2 (30k→90k) → 損切 → 次リスク30k 確認
- 複数損切時の段階的な pop 動作確認

## 📝 今後の変更予定

- [ ] 出金パターン（負の入金）
- [ ] タックス計算タブ
- [ ] ゴミ箱UI（復元機能）
- [ ] デバイス間データ競合の高度な検出

## 💡 既知の制約

- **削除の完全クリーンアップなし**: 墓標は永遠に残る（ただし表示されない）
- **オフライン状態**: Service Worker で読み取り可能だが、新規記録は sync 時まで保存されない

## 🔧 最近の主要変更（2026-05-09）

### シミュレーション統一
- `renderSimulation()` と `renderSkipTradeSim()` のUIを完全統一
- Count 制御: +/− ボタン → `<select>` ドロップダウン
- Summary 表示: テキスト2行 → 3列グリッド（初期リスク/仮想損益/仮想資金）
- Data 構造: Array → Object (`{ idx: resultKey }`)

### Supabase 上書き機能
- **「ローカルデータでクラウドを上書き」ボタン追加**
- デモ/リアル混在データのクリーンアップ用
- Supabase 全削除 → ローカル有効トレード再アップロード

### 一括選択削除機能
- 履歴タブに「選択」モード
- 複数トレードを checkbox で選択 → 「削除」で一括削除
- `toggleSelectMode()`, `selectAllTrades()`, `deleteSelectedTrades()`

### バグ修正
- **pnl null参照エラー**: tradeCard() で null チェック追加
- **Service Worker キャッシュ**: `CACHE_NAME = 'fx-trader-v1'` → `'fx-trader-v3'`

### 廃止機能
- **デモ/リアルモード分離**: iPhoneで誤タップによるデータ消失バグが発生したため廃止
  - 詳細は memory/archived_demo_mode_trial.md を参照

---

**最終更新**: 2026-05-09 — シミュレーション統一・一括削除・Supabase上書き・キャッシュ修正完了
