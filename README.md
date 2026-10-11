# 凪 / NAGI
声と背景音を選べる日本語マインドフルネスアプリ。ElevenLabsを使うMVP。

## 開発
Node.js 22以降。`npm run build`、`npm test`、`npm run dev`。

## Cloudflare Workers
`npx wrangler@4 deploy --keep-vars` で公開。設定は `wrangler.jsonc`。
Cloudflareダッシュボード → Workers & Pages → nagi → Settings → Variables and Secrets → Add で、種類 **Secret**、名前 **ELEVENLABS_API_KEY**、値をAPIキーに設定しDeploy。
APIキーをGitHubやブラウザコードに保存しない。

## Codex環境
このGitHubリポジトリを選んで環境を作成。Node.jsを利用し、個人用保管庫の `ELEVENLABS_API_KEY` を適用。
Codex用のキー設定とCloudflareの本番Secret設定は別。

## 機能と制限
15分のオリジナル感謝瞑想と5〜10分の各種セッション。自作文章、再生・一時停止・シーク、声と背景音の変更。キー未設定時は端末音声。Google TTSはMVPで保留。
音楽はWebAudio合成。記録とお気に入りはlocalStorage保存。端末間同期なし。非表示になると一時停止。
公開APIは同一オリジンチェック、IP単位のメモリ内簡易レート制限、文章長制限あり。分散・永続レート制限と有料利用の認証は未実装。ElevenLabs側の利用上限も設定してください。実音声はSecret設定後に確認。
写真: Unsplash。デザイン参考: Calm、Balance。Spotify本文は取得不可。瞑想文章は独自執筆。
