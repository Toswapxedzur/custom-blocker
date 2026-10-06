# Vaultブラウザー拡張機能コードマニュアル

[ユーザーマニュアル](../manual/ja.md)

## ルールの契約

ソースは関数式 `(on, v) => { ... }` 一つです。対応するのは同期JavaScriptと以下のAPIだけです。タイマー、ネットワーク、拡張API、直接のDOMアクセスは使えません。時間ベースのルールでは `ev.now` とイベントを使います。

- 編集すると下書きが保存されます。**Run**でルールを有効化し、グループを有効にします。凍結中のグループはRunできません。ソースが空ならルールをアンロードします。
- Runに成功するとハンドラーとパネルが置き換わり、`v.state` は保持されます。コンパイル/登録に失敗すると前のルールが残り、タイムアウトで停止する場合があります。エンジン再読み込み時は最後に有効化したソースを再登録し、クロージャ変数はリセットされます。
- 登録時にstateを初期化し、ハンドラーを登録し、パネルを表示してログを出せます。ページ/ファイル操作とemitはハンドラー内で行ってください。登録時のキューは破棄されます。
- Disableはハンドラーを停止し、管理対象のパネル、スタイルシート、カバー、項目判定を解除します。Enableは保持したパネル/シートを戻し、項目を再要求します。Runは既存のシート、カバー、項目判定を消しません。Deleteはルールとstate/効果を削除します。ナビゲーション、DOM変更、ファイル書き込みは元に戻りません。
- イベントは通常のグループ対象に制限されません。ルール内でURL/項目を絞り込んでください。操作はキューに入りdispatch後に適用されます。例外が起きるとそのハンドラーは停止しますが、state/操作はロールバックされません。後続ハンドラーは動く場合があります。ファイル/クエリーイベント以外に操作の確認通知はありません。

## 共通API

- `on(type, handler)` → boolean。`handler(ev)` を登録します。複数ハンドラーは登録順に動きます。falseは引数不正かハンドラー上限を示します。`ev = { type: string, now: number, data }`、`now`はUnixミリ秒です。
- `v.state`: イベントdispatch後に保存される変更可能なJSONオブジェクトです。既存stateを上書きせず、欠けているフィールドを初期化してください。オブジェクト以外または配列を代入すると `{}` に戻ります。シリアライズ不可/過大な更新は保存されません。
- `v.log(...values)`: このグループのLogを生成する唯一の方法です。Logs/Clearはグループごとに独立しています。読み込みエラーはRun状態に表示され、ハンドラー診断はLogに入りません。
- `v.emit(type, data)`: 現在のイベント後に `data` のJSONコピーをキューし、新しい `now` とともにをこのグループのハンドラーへキューします。同期呼び出しではありません。
- `v.panel(id, spec, tabId?)`: グループの名前付きパネルを置き換えます。アクセス可能な全Webページには `tabId` を省略し、整数タブIDを指定することもできます。`spec` がnullなら削除します。Panelsを参照してください。
- `v.file(op, path, payload?)` → リクエストID文字列。Filesを参照してください。

その他の共通呼び出しは `undefined` を返します。ID/stateは表示名ではなく一つのグループに属します。

## ブラウザーイベント

以下のペイロード表記は型を説明するもので、実行可能コードではありません。`?`は省略可能なフィールドです。

```text
tick (~1 second): { tabs: { tabId: number, url: string, active: boolean }[] }
tab: { kind: "open" | "navigate" | "close", tabId: number,
       url: string, previousUrl: string | null }
visible: { tabId: number, url: string, elapsedMs: number }
items: { tabId: number, platform: string, items: Item[] }
snooze: {}
panel: { panelId: string, controlId: string, eventName: string,
         value: string | number | boolean | null,
         values: { [controlId: string]: string | number | boolean } }
query: { requestId: string, tabId: number, url: string, selector: string,
         matches: Match[], error: string }
file: see Files

Item = { ref: string, url: string, title: string, authors: string[],
         videoForm: "short" | "long" | "post" | "unknown",
         tags: { name: string, confidence: number }[],
         tagsSettled: boolean, isPage: boolean }
Match = { tag: string, text: string, href: string, src: string,
          title: string, label: string, value: string }
```

- `tick`は概算です。回数ではなくタイムスタンプを使います。`active`はブラウザーウィンドウ内で選択中という意味で、ユーザーが見ている証拠ではありません。URLは空/制限される場合があります。
- `visible`はアクセス可能で非表示でないページから取得します。`elapsedMs`は最後のheartbeatからの時間で、覆われている間はゼロです。累積利用時間や再生時間ではありません。
- `items`は新規/変更された対応フィード項目を示し、Run/再有効化後に再送します。`ref`はそのページ上のカードを示し、永続コンテンツIDではありません。`ref === "page"`はページ自体を示します。タイトル/URL/作者は空の場合があります。`authors`にはプラットフォーム固有のソースIDが入ります。
- プラットフォームID: `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`, `reddit`, `discord`, `twitter`, `bluesky`, `threads`, `substack`, `bilibili`, `rumble`, `pinterest`, `kick`, `tumblr`, `peertube`, `pixelfed`, `kuaishou`。項目を取得できるかはページの対応マークアップによります。
- タグには接続済みデスクトップ分類器とタグ付け対応ビルド/プラットフォームが必要です（Chromium/Safari: YouTube、Reddit、Bilibili、X/`twitter`）。信頼度は1～5です。`tagsSettled === false`は保留/利用不可で、タグなしではありません。確定済みの `tags: []` はタグなしです。
- `snooze`はグループのSnoozeボタンが押されたことを示します。それだけで一時停止にはなりません。
- クエリー/ファイル応答は要求元グループに届きます。`requestId`を照合し、`error`/`ok`を確認し、tickを使って期限を設けます。ページ終了、エンジン再読み込み、グループ無効化で応答が失われる場合があります。Run後にIDが再利用されることがあり、保留中の要求は永続タスクではありません。

## ブラウザー操作

整数の `tabId` はイベントから取得してください。ページ操作にはVaultがアクセスできるページが必要です。ブラウザー内部ページは利用できません。不正な入力/利用不可の対象は通常何も起こしません。

- `v.item(tabId, ref, verdict)`: `"hide"`はフィードカードを削除し、`"dim"`はメディアを覆い、`"allow"`は下位グループの対象から除外し、`null`はこのグループの判定を解除します。不明なrefには何も起きません。`v.cover`を`isPage`に使います。判定はグループ一覧順です。上位のhideが優先され、上位のdimは下位のallow後も残り、allowは下位判定を防ぎます。再利用/削除されたカードには新しい判定が必要です。
- `v.cover(tabId, on, message?)`: trueでページを覆い、falseでカスタムカバーを解除します。messageは既定で空（最大500文字）。ページごとにカスタムカバー枠は一つで、グループ順に関係なく最後の呼び出しが適用されます。アドレス変更で解除されます。通常のブロックはページを覆う場合があります。
- `v.go(tabId, target)`: HTTP(S) URLまたは `"back"`、`"forward"`、`"reload"`（target最大4096文字）。
- `v.close(tabId)`: タブを閉じます。
- `v.css(tabIdOrStar, id, css)`: 整数タブIDまたは `"*"`。同じIDのスタイルシートを置き換え、nullで削除します。アドレス変更でタブ用シートは終了し、`"*"`のシートは今後のページにも適用されます。ID最大80、CSS最大100000文字。
- `v.dom(tabId, selector, op, arg?)`: CSSセレクター（最大1000文字）。全一致し、`scrollTo`は最初だけに適用します。操作: `hide`はinline `display:none!important`を設定、`show`はinline displayを削除、`click`、`setText`は`arg`でテキストを置換、`addClass`/`removeClass`はクラス名一つ、`scrollTo`は表示位置までスクロール。arg最大2000。変更は明示的に戻すかページが置き換わるまで残ります。
- `v.query(tabId, selector)` → リクエストID文字列。不正な引数ではnullです。後続の`query`イベントで結果が届きます。一致は最大50件、小文字の`tag`、正規化テキスト最大1000文字、属性最大2000、値最大1000です。一致なしは成功した`[]`、CSS不正は`error: "invalid-selector"`です。Vault受信機能がないページは応答しない場合があります。

## パネル

```text
spec = { title?: string, description?: string, controls?: Control[],
         position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center",
         width?: "small" | "medium" | "large" | number,
         layout?: Layout, align?: "left" | "center" | "right", role?: Role }
Control = { id?: string, type?: string, label?: string, value?, disabled?: boolean,
            ariaLabel?: string, autoFocus?: boolean,
            align?: "left" | "center" | "right", layout?: Layout,
            width?: "full" | "auto" | number, height?: "auto" | number,
            ...type-specific fields below }
Layout = "vertical" | "compact" | "comfortable" | "spacious" | "inline" | "row"
       | "wrap" | "twoColumn" | "grid" | "split" | "form" | "toolbar" | "stack"
Role = "region" | "dialog" | "alert" | "status" | "form" | "group"
```

既定値: 右下、縦方向、左揃え、regionロール、内容に合わせた幅。幅のプリセットは220/280/360px、数値は180～520pxに制限されます。コントロール幅は32～520px、高さは20～360pxです。数値サイズはピクセル文字列も指定できます。縦配置は間隔を変え、inline/rowは折り返さず、wrap/toolbarは折り返し、twoColumn/grid/split/formはグリッド、stackは間隔を最小にします。ロールはアクセシビリティ上の意味を提供し、モーダルのように操作を遮りません。

IDはASCII英数字/`_`/`-`に正規化されます（最大80）。一意で安定したIDを使います。省略したコントロールIDは`control-N`、省略/不明な型はtextです。省略したテキスト/リストは空、disabledはfalseです。`v.panel`呼び出しはspec全体を置き換えます。`value`省略時は最後のコントロールイベント値を使って型を正規化し、明示した`value`はそれを上書きします。Autofocusは既定でfalseです。不明なフィールドは破棄され、ルール指定のパネル色/フォント/CSSには対応しません。

コントロールのフィールドと値:

- `text`: string型`text`、既定はlabel。`html`: string型`html`。script、イベント属性、危険なURL、スタイルは除去されます。
- `button`: `label`、任意の`action: "submit" | "cancel" | "close"`。値はstring（既定で空）。actionはイベントを発生させますが、自動で送信/終了しません。
- `checkbox`, `toggle`: boolean型`value`（既定false）。
- `select`, `radio`: `options: (string | { value: string, label?: string })[]`、string型value（既定で空）。空のoption valueは除去され、labelはvalueが既定です。
- `textInput`, `textarea`: string型value（既定で空）、`placeholder`。textareaの`rows`は1～12（既定3）。
- `numberInput`, `range`: 数値value（既定0）、`min`、`max`、正の`step`。パネル更新時に範囲内に制限されます。正規化範囲の既定値は−1000000～1000000です。rangeの既定値は0～100。明示的に範囲を設定します。
- `date`: string `YYYY-MM-DD`、`time`: `HH:MM`または`HH:MM:SS`。不正な初期形式は空になります。編集の検証は自分で行います。`color`: `#RRGGBB`（既定`#000000`）。
- `pin`: 数字文字列。`length`は3～12（既定6）、`masked`は既定true、`autoSubmit`はfalse。`section`: `text`、`controls`、任意のlayout/align/role（role既定group）。depth 3の子sectionに子はありません（root controlsはdepth 0）。

パネルイベント: 入力コントロールは`input`/`change`を送ります（テキスト入力はblur/Enter時、textareaはblur/CtrlまたはCmd+Enter時に変更）。通常のコントロールは`focus`、`blur`、`key`も送ります。keyメタデータはルールに転送されません。ボタンは`click`と設定済みactionを別イベントで送るため、片方だけ処理してください。PINは`change`、autoSubmitが埋まると`submit`を送ります。Mount/unmountは`controlId: ""`、`value: true`を使います。`values`にはIDごとの現在の入力値があり、ボタン/テキスト/HTMLは含みません。イベントに元のtab IDはありません。タブ別操作にはパネルIDを分けます。

テキスト上限: title/label/ariaLabel 240、description/text 1000、HTML 20000、placeholder 500、入力テキスト2000、その他の値文字列512、option value/label 256。超過分は切り詰められます。

## ファイル

`op`: `"read"`、`"write"`、`"append"`、`"list"`、`"exists"`。Settingsで**カスタムルールフォルダー**とその権限が必要です。Safariはネイティブのフォルダー選択と保持されるsecurity-scoped grantを使い、選択したフォルダーのみ利用できます。

- `path`は相対パスで、`/`がディレクトリを区切ります。ASCII英数字、空白、`_.,@()-`を使用できます。先頭ドット、`.`/`..`、絶対パス、URLは不可です。拡張子は`.txt`、`.csv`、`.json`（大文字小文字を区別しません）。Listのpathはディレクトリで、`""`は選択したルートです。シンボリックリンク経由も含め、選択フォルダーの外に出るパスは拒否されます。
- ReadはUTF-8テキストを返します。Writeは置換/作成し、appendは自動改行なしで追加/作成します。書き込み時は親ディレクトリを作成します。string payloadはそのまま書き込み、その他のJSON payloadはシリアライズします。null/省略は空テキストです。JSON/CSVの解析はルール側で行います。最大サイズ1048576 UTF-8バイト。
- Listは直下の表示可能なサブディレクトリと対応ファイルを返します。エントリ: `{ name: string, path: string, kind: "directory" | "file", extension?: string }`。ファイルのextensionにはドットが含まれます。Existsは対応するファイルパスの真偽値を返します。

```text
file.data = { requestId: string, op: string, path: string, ok: boolean,
              text: string | null, entries: Entry[] | null,
              exists: boolean | null, error: string }
```

未使用の結果フィールドはnull、成功時のerrorは空です。失敗にはinvalid-path、unsupported-file-type、フォルダー/権限利用不可、ファイルなし、file-too-largeがあります。errorは固定の完全な列挙型ではなく文字列として扱います。トランザクションAPIはありません。パスごとにread-modify-writeを直列化します。

## 上限

イベント/グループごとにキュー操作256件、log呼び出し200回、emit 64回。超過分は破棄されます。ルールごとにhandler 1000個、panel 24個、コントロールリスト32項目、選択肢64個。超過分は無視/切り詰められます。Emit連鎖は16世代で停止します。シリアライズ状態の上限はJavaScript文字列65536文字です。登録とイベントごとの全handlerを1秒未満に保ちます。繰り返しの超過や強制タイムアウトでRunまで停止します。Logはグループごとに200件保持し、秒あたり50件を受け付け、長文は約4096文字で切り詰めます。タイマー/応答はベストエフォートで、リアルタイム保証ではありません。

## 完全なルール

Snoozeまたはそのパネルボタンで始まる5分間の一時停止:

```javascript
(on, v) => {
  v.state.pauseUntil ??= 0;
  const pause = ev => { v.state.pauseUntil = ev.now + 300000; };
  v.panel("pause", { controls: [{ id: "pause", type: "button", label: "Pause 5 min" }] });
  on("snooze", pause);
  on("panel", ev => {
    if (ev.data.panelId === "pause" && ev.data.controlId === "pause" && ev.data.eventName === "click") pause(ev);
  });
  on("tick", ev => {
    for (const tab of ev.data.tabs) {
      if (/^https?:\/\/(www\.)?youtube\.com(?:\/|$)/i.test(tab.url)) v.cover(tab.tabId, ev.now >= v.state.pauseUntil);
    }
  });
}
```
