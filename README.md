# Medeco Navi

患者・ご家族のための疾患情報ポータル。疾患・症状・治療法をわかりやすく解説し、医療機関受診・相談をサポートします。

運営：株式会社Medeco（info@medeco.io）

---

## プロジェクト概要

Medeco Navi は Vanilla HTML/CSS/JS で構築された静的サイトです。外部フレームワーク・ビルドツールを一切使用せず、S3 + CloudFront で配信できます。

3つの主要な調べ方を提供します：
- **疾患から調べる** — 診断を受けた疾患の概要・原因・症状・治療法
- **症状から調べる** — 身体の不調から考えられる疾患・受診の目安
- **治療法から調べる** — 治療の流れ・副作用・日常生活の注意点

---

## ローカル開発手順

**Node.js は不要です。** HTML/CSS/JS の静的ファイルをブラウザで直接開けます。

### 方法1: Python（標準搭載）
```bash
cd /path/to/navi
python -m http.server 8080
# → http://localhost:8080 で確認
```

### 方法2: npx serve
```bash
cd /path/to/navi
npx serve .
# → http://localhost:3000 で確認
```

### 方法3: VS Code Live Server
VS Code の拡張機能「Live Server」を使って `index.html` を右クリック → `Open with Live Server`

> **注意:** `file://` プロトコルでの直接開封は `fetch()` によるJSONデータ読み込みがブラウザのCORSポリシーで失敗します。必ずHTTPサーバー経由でアクセスしてください。

---

## デプロイ手順

### 前提条件
- AWS アカウントがあること
- S3 バケットと CloudFront ディストリビューションが設定済みであること
- GitHub リポジトリが `navi` という名前で作成済みであること

### 1. GitHub Secrets の設定

GitHub リポジトリの **Settings → Secrets and variables → Actions** で以下を登録：

| Secret名 | 説明 |
|----------|------|
| `AWS_ACCESS_KEY_ID` | IAM ユーザーのアクセスキーID |
| `AWS_SECRET_ACCESS_KEY` | IAM ユーザーのシークレットアクセスキー |
| `AWS_REGION` | AWSリージョン（例: `ap-northeast-1`） |
| `S3_BUCKET_NAME` | S3バケット名（例: `medeco-navi-prod`） |
| `CLOUDFRONT_DISTRIBUTION_ID` | CloudFrontディストリビューションID |

### 2. IAM ポリシー（最小権限）

デプロイ用IAMユーザーに以下のポリシーを付与してください：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:DeleteObject", "s3:ListBucket", "s3:GetObject"],
      "Resource": [
        "arn:aws:s3:::YOUR_BUCKET_NAME",
        "arn:aws:s3:::YOUR_BUCKET_NAME/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["cloudfront:CreateInvalidation"],
      "Resource": "arn:aws:cloudfront::ACCOUNT_ID:distribution/DISTRIBUTION_ID"
    }
  ]
}
```

### 3. S3 バケット設定

**バケットポリシー（CloudFront OAC 経由の読み取り）:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::ACCOUNT_ID:distribution/DISTRIBUTION_ID"
        }
      }
    }
  ]
}
```

> パブリックアクセスは CloudFront 経由のみとし、S3バケットへの直接パブリックアクセスはブロックすることを推奨します。

### 4. CloudFront 設定ポイント

| 設定項目 | 推奨値 |
|----------|--------|
| オリジン | S3バケット（OAC使用） |
| デフォルトルートオブジェクト | `index.html` |
| カスタムエラーページ（403/404） | `/index.html`、HTTPステータス: 200 |
| HTTPSリダイレクト | HTTP → HTTPS |
| 圧縮 | 有効（Gzip/Brotli） |

カスタムエラーページの設定により、サブディレクトリへの直接アクセス（例: `/diseases/hypertension/`）が正しく動作します。

### 5. 初回デプロイ

`main` ブランチへ push するだけで自動デプロイが実行されます：

```bash
git add .
git commit -m "Initial deploy"
git push origin main
```

---

## コンテンツ更新方法

### `data/*.json` の編集

コンテンツはすべて `data/` フォルダのJSONファイルで管理されます。

#### data/diseases.json — 疾患データ

```json
{
  "diseases": [
    {
      "id": "疾患の識別子（URLに使用、英小文字・ハイフンのみ）",
      "name": "疾患名（日本語）",
      "nameEn": "Disease Name（英語）",
      "category": "カテゴリ（循環器系 / 神経系 / 運動器系 / 呼吸器系 / 内分泌系 / 泌尿器系 / がん領域）",
      "tags": ["タグ1", "タグ2"],
      "summary": "一言説明（カード表示に使用）",
      "relatedSymptoms": ["symptom-id-1", "symptom-id-2"],
      "relatedTreatments": ["treatment-id-1"],
      "urgency": "low | medium | high"
    }
  ]
}
```

#### data/symptoms.json — 症状データ

```json
{
  "symptoms": [
    {
      "id": "症状の識別子",
      "name": "症状名",
      "bodyPart": "頭部 | 首 | 胸部 | 腹部 | 上肢 | 下肢 | 全身",
      "category": "痛み | 神経症状 | 呼吸器症状 | 消化器症状 | 全身症状 | 泌尿器症状",
      "urgencyLevel": "low | medium | high",
      "summary": "症状の概要説明",
      "redFlags": ["緊急受診が必要なサイン1", "サイン2"],
      "relatedDiseases": ["disease-id-1"],
      "relatedTreatments": ["treatment-id-1"]
    }
  ]
}
```

#### data/treatments.json — 治療法データ

```json
{
  "treatments": [
    {
      "id": "治療法の識別子",
      "name": "治療法名",
      "category": "薬物療法 | 外科手術 | 放射線治療 | 化学療法 | リハビリ | 生活療法",
      "targetDiseases": ["disease-id-1"],
      "summary": "治療法の概要",
      "duration": "治療期間の目安",
      "sideEffects": ["副作用1", "副作用2"],
      "relatedSymptoms": ["symptom-id-1"]
    }
  ]
}
```

> JSONを更新してmainブランチにpushすると、自動デプロイで反映されます。

### 詳細ページのコンテンツ追加

新しい疾患・症状・治療法の詳細ページを追加する場合：

1. テンプレートHTMLをコピーする：
   - `diseases/example-disease/index.html` → `diseases/[disease-id]/index.html`
   - `symptoms/example-symptom/index.html` → `symptoms/[symptom-id]/index.html`
   - `treatments/example-treatment/index.html` → `treatments/[treatment-id]/index.html`
2. HTMLの内容を実際の疾患・症状・治療法の情報に書き換える
3. `data/*.json` に対応するエントリを追加する（idを一致させること）

---

## 医療免責事項の編集方法

各HTMLページの以下の要素を編集してください：

```html
<!-- フッター直上の免責事項バー -->
<div class="disclaimer-bar" role="note" aria-label="医療免責事項">
  <div class="container">
    <p><!-- 免責事項テキストを編集 --></p>
  </div>
</div>
```

症状ページの緊急バナーは `.emergency-banner` クラスの要素です。

---

## ディレクトリ構成

```
navi/
├── index.html                        # トップページ
├── diseases/
│   ├── index.html                    # 疾患一覧
│   └── example-disease/index.html   # 疾患詳細テンプレート（高血圧症）
├── symptoms/
│   ├── index.html                    # 症状一覧（身体部位マップ付き）
│   └── example-symptom/index.html   # 症状詳細テンプレート（頭痛）
├── treatments/
│   ├── index.html                    # 治療法一覧
│   └── example-treatment/index.html # 治療法詳細テンプレート（降圧薬）
├── assets/
│   ├── css/
│   │   ├── design-tokens.css        # CSS変数（カラー・フォント等）
│   │   ├── base.css                 # リセット・ベーススタイル
│   │   ├── components.css           # ボタン・カード・バッジ等
│   │   └── layout.css               # ヘッダー・フッター・グリッド
│   └── js/
│       ├── search.js                # 検索・フィルタリング機能
│       ├── navigation.js            # ナビ・スムーズスクロール・FAQ
│       └── accessibility.js         # WCAG 2.1 AA 対応補助
├── data/
│   ├── diseases.json                # 疾患データ（12件）
│   ├── symptoms.json                # 症状データ（16件）
│   └── treatments.json              # 治療法データ（14件）
├── .github/workflows/deploy.yml     # GitHub Actions S3+CloudFrontデプロイ
└── README.md
```

---

## 技術スタック

- **HTML/CSS/JS**: Vanilla（フレームワーク・ビルドツールなし）
- **フォント**: Noto Sans JP（Google Fonts）
- **データ**: JSON（fetch + localStorage キャッシュ）
- **CI/CD**: GitHub Actions → AWS S3 + CloudFront
- **アクセシビリティ**: WCAG 2.1 AA 準拠目標

---

## ライセンス

Copyright © 2025 株式会社Medeco. All rights reserved.

このリポジトリのコードは社内利用を目的としています。無断転載・再配布を禁じます。
