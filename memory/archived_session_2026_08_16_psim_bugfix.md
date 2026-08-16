---
name: archived_session_2026_08_16_psim_bugfix
description: v50 確率シミュレーター Firebase Hosting デプロイ・v51 Math.round丸め誤差バグ修正
metadata:
  type: project
  date: 2026-08-16
  version: v50 → v51
---

# 2026-08-16 セッション：確率ベース資金シミュレーター デプロイ・バグ修正（v50→v51）

## 背景
前セッション（2026-08-15）で v50 確率ベース資金シミュレーターを実装したが、Firebase Hosting へのデプロイが未実施。ユーザーが実機テストを要望した。

## 実装内容

### ✅ v50 Firebase Hosting デプロイ
- [x] `firebase deploy` コマンド実行 ✅ 2026-08-16
- [x] 22 ファイルアップロード完了・release complete
- [x] ブラウザで確率シミュレーターカード表示確認 ✅

### 🐛 バグ発見と修正（v51）

#### **問題の発症**
ユーザーテスト中に「勝率を 50% → 80% に変更しても、最終資金が同じ 1,200,000円 のまま変わらない」と報告。

#### **原因分析**
月ごとの `Math.round()` の丸め誤差が大きすぎた。

月間チャンス **3回**、勝率 50% vs 80% の場合：
```
勝率 50%: winCount = Math.round(3 × 50/100) = Math.round(1.5) = 2 回
勝率 80%: winCount = Math.round(3 × 80/100) = Math.round(2.4) = 2 回
```
→ **どちらも勝ち 2回 = 同じ結果に！**

#### **修正戦略**
月ごとではなく **シミュ期間全体** でまとめて計算（案2: 複数月一括計算）。

修正前（旧 renderPsim）:
```javascript
// 月ごとに丸める → 小さい数字では誤差が大きい
for (let m = 1; m <= months; m++) {
  const winCount = Math.round(chances * winrate / 100);  // ← 月ごと
  ...
}
```

修正後（v51）:
```javascript
// 全期間でまとめて計算 → 月別に均等分散
const totalChances = chances * months;
const totalWin = Math.round(totalChances * winrate / 100);  // ← 全体
const wlSeq = psimInterleave({ win: totalWin, loss: totalLoss });

// その後、各月に分散
let winIdx = 0;
for (let m = 1; m <= months; m++) {
  for (let c = 0; c < chances; c++) {
    const key = wlSeq[globalIdx];  // ← 事前計算結果から取得
    ...
  }
}
```

#### **効果**
3ヶ月 × 月3回 = 全9回トレード で計算するため、丸め誤差が小さくなり、勝率 50% と 80% の差が正しく反映される。

### ✅ v51 Firebase Hosting デプロイ
- [x] Service Worker キャッシュ v50 → v51 ✅
- [x] JS 構文チェック ALL OK ✅
- [x] `firebase deploy` 実行 ✅ 2026-08-16
- [x] 2 ファイルアップロード完了・release complete

## テスト結果
- ✅ v50 デプロイ後、確率シミュレーターカード表示確認
- ✅ 勝率変更による計算バグを発見・分析
- ✅ v51 バグ修正版実装・デプロイ完了
- ⏳ ユーザーによる実機テスト検証待ち（勝率 50% vs 80% での結果比較）

## 技術ポイント
- `psimInterleave(counts)`: Bresenham型均等分散アルゴリズム（全体のカウントを各月に均等配置）
- 月間チャンス 1～5回という少数での精度向上
- リスクスタック方式との組み合わせで複利効果を実現

## 次セッション優先事項
- [ ] **確率ベース資金シミュレーター実機テスト** — v51 で勝率 50% vs 80% の結果差を確認
- [ ] **Firebase Storage 新規トレード画像アップロード** — PC Chrome で実機テスト
- [ ] **iPhone 同期テスト** — Safari で新規トレード・画像表示確認

## コード変更行数
- index.html: renderPsim() 関数の計算ロジック大幅変更（~25行）
- sw.js: CACHE_NAME v50 → v51

## 最終更新
2026-08-16 — 確率ベース資金シミュレーター v50 デプロイ完了・v51 Math.round丸め誤差バグ修正・Firebase Hosting デプロイ完了
