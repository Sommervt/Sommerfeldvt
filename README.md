# sommerfeldvt

Sommerfeldのプロフィール、ソーシャルリンク、クリエイター活動をまとめた個人サイトです。

動画編集とゲーム開発をテーマに、イラストを使ったリンクボタンとMaterial You風の色彩・モーションを取り入れています。

ページ下部の音楽プレイヤーでは、曲名での検索、曲の選択、前後の曲への移動、シーク、利用可能な形式（OpusまたはMP3）のダウンロードができます。曲の一覧は `music/catalog.json` から読み込みます。


### GitHubから曲を追加する（リポジトリの複製不要）

リポジトリを複製したり、`script.js` を編集したりする必要はありません。

1. GitHubで `music/incoming/` フォルダーを開き、**Add file > Upload files** を選択します。
2. 音源とジャケットを同じファイル名でアップロードします。例: `曲名.opus` と `曲名.jpg`。ジャケットは `.jpg`、`.jpeg`、`.png`、`.webp` に対応しています。
3. `main` に直接コミットするか、ブランチにコミットしてからプルリクエストをマージします。

GitHub ActionsがOpus音源（310～330 kbps）とジャケットを検証し、各フォルダーへの整理、MP3バックアップの作成、`music/catalog.json` の更新を自動で行います。処理が完了し、GitHub Pagesが更新されたコミットを公開すると、プレイヤーに曲が追加されます。

ワークフローにはリポジトリへの書き込み権限が必要です。`main` にブランチ保護が設定されている場合は、GitHub Actionsによるコミットを許可してください。GitHub Pagesは **Settings > Pages > Deploy from a branch** で、公開元を `main` ブランチの `/(root)` に設定してください。再生・配布する権利を持つ音源とジャケットのみをアップロードしてください。

### プロジェクト

- [Kotori](https://sommervt.github.io/kotori/) — 日本語学習アプリ
- [Sommer-Base-Linux](https://sommervt.github.io/Sommer-Base-Linux/) — CachyOS + Hyprland セットアップガイド
