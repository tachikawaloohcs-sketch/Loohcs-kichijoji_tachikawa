# Loohcs志塾立川・吉祥寺校 予約システム

Next.js (App Router), Prisma, NextAuth.js を使用した予約管理システムです。講師としてシフトを管理し、生徒として授業を予約することができます。管理者は全ユーザーと予約状況を管理できます。

## 機能
- **生徒**: 授業予約、予約履歴確認、講師への日程リクエスト
- **講師**: シフト管理、授業報告（カルテ）作成、リクエスト承認
- **管理者**: ユーザー管理、全予約・シフト管理、カルテ閲覧

## 技術スタック
- Framework: Next.js 15+
- Database: SQLite (開発用) / PostgreSQL (本番想定)
- ORM: Prisma
- Auth: NextAuth.js (v5)
- UI: Tailwind CSS, Shadcn UI

## 環境構築 (PostgreSQL)

1. リポジトリをダウンロードします。
2. 依存関係をインストールします。
   ```bash
   npm install
   ```
3. Vercel PostgresなどのPostgreSQLデータベースを用意します。
4. 環境変数ファイル `.env` を設定します。
   ```env
   POSTGRES_PRISMA_URL="postgres://..."
   POSTGRES_URL_NON_POOLING="postgres://..."
   AUTH_SECRET="your-secret-key"
   ```
5. マイグレーションを実行します。
   ```bash
   npx prisma migrate dev --name init
   ```
6. 開発サーバーを起動します。
   ```bash
   npm run dev
   ```

## デプロイ手順 (Vercel)

詳細は `deployment_guide.md` を参照してください。

1. GitHubにプッシュします。
2. Vercelでインポートし、StorageタブからPostgresを追加します。
3. デプロイします。
