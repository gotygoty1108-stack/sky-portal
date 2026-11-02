# SKY-PORTAL（ドローン業務管理）

Google Apps Script 版ポータルを Next.js（Vercel）に移植したものです。データは引き続き Google スプレッドシートに保存します。スマホ・PC にアプリとしてインストールできます（PWA）。

## Vercel への公開手順

### 1. Google のサービスアカウントを作る（初回のみ）
1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成（既存でも可）
2. 「API とサービス」→「ライブラリ」で **Google Sheets API** を有効化
3. 「IAM と管理」→「サービスアカウント」でアカウントを作成
4. 作成したアカウントの「キー」→「鍵を追加」→「JSON」で鍵ファイルをダウンロード
5. スプレッドシートを開き「共有」から、サービスアカウントのメールアドレス（`...@...iam.gserviceaccount.com`）を **編集者** として追加

### 2. Vercel でプロジェクトを作成
1. Vercel の「Add New → Project」でこのリポジトリを選択
2. 「Environment Variables」に次を設定

| 名前 | 値 |
| --- | --- |
| `SPREADSHEET_ID` | スプレッドシート URL の `/d/` と `/edit` の間の文字列 |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | ダウンロードした JSON ファイルの中身をそのまま貼り付け |
| `SESSION_SECRET` | 長いランダム文字列（例: `openssl rand -base64 32` の結果） |

`USE_MOCK_DATA` は本番では設定しないでください。

3. 「Deploy」を押せば公開されます。シートやヘッダーが無い場合は初回アクセス時に自動作成されます。

### ログインアカウント
`Accounts` シートの `id` / `password` / `name` / `role` で管理します（GAS 版と同じ）。`role` は `1` = 営業担当、`2` = 管理者。
初期アカウント（admin / sales）のパスワードは公開前に必ず変更してください。

## 権限
- 営業担当（role 1）: 顧客の閲覧・登録・編集、仮見積もりの作成
- 管理者（role 2）: 上記に加えて業務記録の追加、本見積・契約の登録

## PWA（アプリとしてインストール）
- Android / PC の Chrome: 画面上部の「アプリをインストール」ボタン、またはブラウザメニューから
- iPhone: Safari の共有ボタン →「ホーム画面に追加」
- 電波が無いときは、最後に読み込んだ顧客データを閲覧専用で表示します（登録・編集はオンライン時のみ）。

## ローカルでの起動（開発者向け）
```bash
cp .env.example .env.local   # USE_MOCK_DATA=1 ならスプレッドシート無しで動作
npm install
npm run dev
```
モックデータは `.data/mock-db.json` に保存されます（admin / admin123、sales / sales123）。
