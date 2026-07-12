# Chrome ウェブストアのリストのソース

これは、現在のマニフェスト V3 拡張機能の英語ソースです。新しいストア ビルドを公開する前に、`manifest.json` に対して検証してください。

## 拡張機能名

```text
Adamancia Vault
```

## 簡単な説明

```text
Block websites, limit time on them, filter supported feeds, and build focused browser routines.
```

## 詳細な説明

```text
Adamancia Vault is a browser focus tool built around independent block groups.

Create a website blocklist or allowlist, give a site a time allowance, or start a countdown that blocks after it reaches zero. Use dedicated groups for YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord, and Twitter / X when you need a platform-specific boundary instead of a whole-site block.

Every group can have its own schedule, freeze mode, snooze rules, and enabled state. Custom groups provide a JavaScript rule editor with syntax checking, run controls, templates, and a log feed. Rules run in the extension's controlled runtime.

The optional web-app bridge connects to a compatible native Vault hub. It only synchronizes groups that the user explicitly links.

Your configuration lives in the browser profile. The extension does not need an account to create or use block groups.
```

## 権限の説明

|許可 |現在の目的 |
| --- | --- |
| `storage` |グループ、設定、ローカル エディターの状態を保存します。 |
| `alarms` |バックグラウンド チェックと時間ベースのグループ更新をスケジュールします。 |
| `offscreen` | Chromium でオフスクリーン ドキュメントが必要な場合は、制御されたカスタム ルール ランタイムを実行します。 |
| `tabs` |グループを適用してステータスを表示するために必要なアクティブなタブのコンテキストを読み取ります。 |
| `webNavigation` |ナビゲーション後に該当するグループを再評価します。 |
| `favicon` |可能な場合は、エディターに Web サイトのアイコンを表示します。 |
| `<all_urls>` |ユーザーが作成した Web サイトとプラットフォームのルールを、ユーザーが制御することを選択したページに適用します。 |

## リリースチェック

1. `./tests/run.sh` を実行します。
2. リリースコミットのマニフェストバージョンのみを更新します。
3. 英語のマニュアルと翻訳監査の出力を確認します。
4. レビューしたコミットからアップロード アーティファクトを構築します。
5. アップロード成果物にはソースノート、テストフィクスチャ、プライベート開発ファイルを含めないでください。
