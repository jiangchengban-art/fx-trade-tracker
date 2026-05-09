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
- **新レイアウト**: 左=エントリー/入金計/出金計積み上げ、右=総資金（大）
- 入金/出金を分割表示（pnl > 0 vs < 0）
- 総資金 = エントリー損益 + 入金計 + 出金計
- 資本推移チャート: 💰(入金)・💸(出金)・#(エントリー)で表示

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

### 入出金フロー
1. ステータスで「💰 入出金」選択 → 手法・結果など非表示確認
2. **入金**: 正の金額入力 → 履歴に緑カード＆「💰 入金」バッジ、統計に「入金計」表示
3. **出金**: 負の金額入力 → 履歴に赤カード＆「💸 出金」バッジ、統計に「出金計」表示
4. 統計タイル: 総資金 = エントリー損益 + 入金計 - 出金計 の計算確認

### ソフト削除
1. トレード削除 → `deleted:true` 付与で非表示
2. クラウド同期 → 他端末でも墓標伝播で削除状態が共有
3. importData 後の merge が墓標を保持するか確認

### シミュレーション（両タブ）
- 初期10k → MAX×2 (30k→90k) → 損切 → 次リスク30k 確認
- 複数損切時の段階的な pop 動作確認

## 📝 今後の変更予定

- [x] 出金パターン（負の入金）✅ 2026-05-XX
- [ ] タックス計算タブ
- [ ] ゴミ箱UI（復元機能）
- [ ] デバイス間データ競合の高度な検出

## 💡 既知の制約

- **削除の完全クリーンアップなし**: 墓標は永遠に残る（ただし表示されない）
- **オフライン状態**: Service Worker で読み取り可能だが、新規記録は sync 時まで保存されない

## 🔧 最近の主要変更（2026-05-09-12）

### 出金パターン実装
- ステータス: 「💰 入金」→「💰 入出金」に統一
- pnl: 正=入金、負=出金（内部処理）
- トレードカード: 入金（💰・緑ボーダー）vs 出金（💸・赤ボーダー）で動的表示
- 統計分割: `inflows.filter(pnl > 0)` / `outflows.filter(pnl < 0)`
- 資本推移: 💰/💸ラベルで入出金を視覚化

### 統計タイルUI改善
- **新レイアウト**: 左（積み上げ）= エントリー/入金計/出金計、右（大）= 総資金
- 総資金の自動計算: `sumPnl + inflowSum + outflowSum`
- 出金時の表示: 「−XX,XXX円」（絶対値）

### 税金シミュレーター改善
- 控除オプション: ホバーtoolips → 動的バッジ（控除額表示）
- 基礎控除: 「−480,000円」ビジネス（チェック時）
- 給与所得控除: 「−X,XXX,XXX円」（給与額から自動計算、リアルタイム）
- iPhone対応: tooltip不要で常に見える

### キャッシュ更新
- Service Worker: `v3 → v5` にインクリメント

---

### （参考）2026-05-09の変更
- シミュレーション統一（selectドロップダウン + 3列グリッド）
- 一括選択削除機能
- Supabase上書き機能
- pnl null参照バグ修正
- Service Workerキャッシュ v1 → v3

**最終更新**: 2026-05-XX — 出金パターン・統計UI・税控除バッジ実装完了
