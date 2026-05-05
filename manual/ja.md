# Custom Web Blocker — 取扱説明書

これはこの拡張機能の完全なリファレンスマニュアルです。最も簡単で一般的なワークフローから始まり、カスタム JavaScript ブロックルールや helper API などの上級トピックへ段階的に進みます。

初めて使う場合は、まず **クイックスタート** と **ブロックグループ概要** だけ読めば十分です。その下の内容は、必要に応じて読む任意項目です。

---

## 1. この拡張機能でできること

Custom Web Blocker を使うと、自分で定義したルールに従って Web サイトやオンライン上の気を散らす要素をブロックできます。次のことが可能です。

- ブラウザのネイティブなネットワークブロックを使って即時にサイトをブロックする（`ERR_BLOCKED_BY_CLIENT` と同種のブロック）。
- サイトごとに 1 日あたりの利用可能分数を設定し、上限を超えたらブロックする。
- YouTube、TikTok、Facebook、Instagram、Twitch、Reddit で特定タイプのコンテンツだけをブロックする（サイト全体ではない）。
- 対応プラットフォームでは、単一ページのブロックだけでなく、フィードからブロック対象コンテンツを非表示にする。
- 曜日および `HHMM-HHMM` 時間帯ウィンドウで、ルールの有効時間をスケジュールする。
- ルールを凍結して、衝動的に変更しにくくする。Strict freeze は指定時間ロックし、解除には 20 ステップ確認儀式が必要。
- ルールを一時的に snooze できるが、十分な長さの理由文の入力が必要。
- タイマー、永続ストレージ、プラットフォーム判定、ドメイン一致、ログ出力の helper を使って、カスタム JavaScript ブロックルールを作成する。
- 20 以上の言語で拡張機能を使う。

この拡張機能は Chrome Manifest V3 拡張で、1 つのエディタページ（ポップアップ）、1 つのバックグラウンド service worker、そして全ページで動作する 1 つの content script で構成されています。

---

## 2. UI ツアー

拡張機能のアイコンをクリックすると、エディタは小さなポップアップではなく、フルページの Web ページとして開きます。画面には次の領域があります。

- **トップバー**
  - **Instruction Manual** ボタン（このドキュメント）
  - **Language** ピッカー
- **左パネル — Block Groups**
  - ブロックグループの一覧。各カードにはグループ名、短い要約行、有効/無効チェックボックスが表示されます。
  - **Add** ボタンで新規グループを作成。隣のドロップダウンでタイプを選びます。
  - **Delete All** は全グループを削除します。凍結グループがある場合は追加確認が必要です。
  - カードの `::` ハンドルを上下にドラッグして並べ替えできます。
  - 垂直スプリッターをドラッグしてこのパネルの幅を調整できます。
- **右パネル — Editor**
  - 現在選択中のグループを編集します：名前、ブロック挙動、ブロックリスト、タイプ固有フィルタ、スケジュール、freeze、snooze。
  - すべての変更は、入力や操作を止めてから数分の一秒後に自動保存されます。
- **Toast**（中央表示でフェードアウトするポップアップ）
  - "Saved changes" や入力エラーなどのステータスメッセージを表示します。

ページがブロック中、または有効なタイマーがある場合、左上にオーバーレイが表示され、そのページに現在適用されている時間制約を `hh:mm:ss`（または `mm:ss`）形式で示します。複数制約は複数行で積み重なります。

---

## 3. クイックスタート

1. 拡張機能アイコンをクリックします。エディタがフルページで開きます。
2. **Block Groups** パネルで、ドロップダウンからグループタイプを選びます。
   - `Default`、`YouTube`、`TikTok`、`Facebook`、`Instagram`、`Twitch`、`Reddit`、`Custom`。
3. **Add** をクリックします。新しいグループが追加され、エディタで開かれます。
4. グループ名を付けます。
5. タイプ固有の項目を入力します（`Default` の場合は **Blocked websites** リスト）。
6. 左パネルのそのグループのチェックボックスが ON であることを確認します。
7. リストに入れたサイトの 1 つを開きます。ブロックは即時に反映されるはずです。

これが基本フローの全体です。以降のマニュアルは、この上に乗る追加オプションです。

---

## 4. ブロックグループ概要

この拡張機能のすべては **ブロックグループ** で整理されています。ブロックグループは 1 つのルールセットです。

- 名前、タイプ、有効/無効状態を持つ。
- ブロック挙動（即時または一定分数後）を持つ。
- 任意でスケジュール（曜日 + 時間帯）と freeze/snooze 制御を持つ。
- タイプに応じて、サイト一覧、YouTube クリエイターフィルタ、subreddit 名、JavaScript 関数などの追加項目を持つ。

グループ数に制限はありません。同じページに複数グループが適用されることがあり、その場合は**より厳しい**ルールが優先されます。

- "Block immediately" は "block after some time" より優先される。
- 残り時間が少ないグループは、残り時間が多いグループより優先される。

つまり、グループを追加しても、ページのブロックが遅くなることはなく、早くなるだけです。

`::` ハンドルでグループをドラッグして並び替えできます。並び順はどのルールが最も厳しいかには影響しませんが、リストの見え方（上から下）には影響します。

---

## 5. グループタイプ

### 5.1 `Default` — 通常サイトをブロック

特定ドメインをブロックする用途（最も一般的なケース）。

- **Blocked websites**: 1 行に 1 サイト。`facebook.com` と `https://www.facebook.com/somepage` の両方を受け付け、拡張機能がホスト名を抽出・正規化します。
- サイトルールは、そのホスト名とすべてのサブドメインに適用されます。
- このタイプは Chrome ネイティブのネットワークブロックを使い、`ERR_BLOCKED_BY_CLIENT` に近い動作です。つまり、ブロック URL への遷移はページ読み込み前に止まります。

### 5.2 `YouTube` — YouTube と類似動画サイトをブロック

エディタに **Filters** セクションが追加されます。

- **Content type**:
  - `Apply to all YouTube pages` — YouTube の全ページを対象。
  - `Apply to Shorts` — Shorts ページのみ対象。
  - `Apply to long videos` — `/watch`、`/live/`、`/embed/` などのみ対象。
  - `Apply to YouTube posts` — コミュニティ投稿（`/post/...`、チャンネルの community/posts タブ）。
- **Author filter**:
  - `Do not filter by author` — 作者で絞り込まない。
  - `Apply to certain authors` — 一覧にある作者のみ対象。
  - `Apply to all except certain authors` — 一覧にある作者は除外。
- **Authors**: 1 行に 1 作者。`@handle`、完全 URL、`/channel/UC...`、`/c/...`、`/user/...` を受け付けます。
- **Hide blocked entries in the YouTube feed**: このグループが実際にブロック中の間、YouTube フィード内の一致カードを非表示にします。ブロックが非アクティブになると、次回更新で再表示されます。

Shorts と Posts のコンテンツタイプでは、作者フィルタ未設定かつ現在ブロック中の場合、関連ナビ項目（サイドバー Shorts、チャンネル Community/Posts タブ）および "Latest YouTube posts" のような一致シェルフも非表示にします。

short/long 判定は、ページ形式を検出できる場合、TikTok、Vimeo、Twitch clips/VODs、Dailymotion などにも拡張されます。

### 5.3 `TikTok` — TikTok コンテンツをブロック

プラットフォーム動画エディタと同じカード構成ですが、TikTok 専用ラベルになります。

- コンテンツタイプ: ショート動画、動画、プロフィールページ。
- 作者: TikTok ハンドル（`@handle`）またはプロフィール URL。
- フィード非表示は、グループ有効中に TikTok ページの一致カードを隠します。

### 5.4 `Facebook` — Facebook コンテンツをブロック

- コンテンツタイプ: Reels、動画、投稿。
- 作者: ページ名（`page.name`）、プロフィール URL、または `profile.php?id=...` 形式（数値 id は `id:<number>` として保持）。
- フィード非表示は Facebook の一致カードを隠します。

### 5.5 `Instagram` — Instagram コンテンツをブロック

- コンテンツタイプ: Reels、動画、投稿。
- 作者: Instagram ハンドルまたはプロフィール URL。
- `/reel/`、`/p/`、`/tv/`、`/explore/` などの予約パスは作者として扱われません。
- フィード非表示は Instagram の一致カードを隠します。

### 5.6 `Twitch` — Twitch コンテンツをブロック

- コンテンツタイプ: クリップ、配信/VOD、チャンネルページ。
- 作者: チャンネル名またはチャンネル URL。
- `/directory`、`/videos`、`/settings` などの予約パスはチャンネル名として扱われません。
- フィード非表示は Twitch の一致カードを隠します。

### 5.7 `Reddit` — Reddit 全体または特定 subreddit をブロック

- **Subreddits**: 1 行に 1 subreddit。空欄なら Reddit 全体が対象。`productivity` と `r/productivity` の両方を受け付けます。

### 5.8 `Custom` — JavaScript 関数でブロック

JavaScript 関数を書きます。拡張機能はおよそ 1 秒ごとに呼び出し、戻り値を現在のブロックリストとして使います。

`Custom` グループには、blocking behavior、blocked sites、allowed minutes、reset interval、schedule days、time windows は表示されません。大きな入力欄である **Blocking Rules** 関数と、標準の freeze/snooze 制御のみが表示されます。

カスタムルールの完全仕様と helpers API は **セクション 11** を参照してください。

---

## 6. ブロック挙動

ほとんどのグループタイプでは、次の 2 モードから 1 つを選びます。

### 6.1 即時ブロック

グループが ON、スケジュールが許可、かつ（プラットフォームグループでは）ページ一致のときにルールが有効になります。

`Default` グループでは Chrome ネイティブブロックを使用し、プラットフォームグループではページ内オーバーレイ/退出ロジックを使用します。

### 6.2 指定分数後にブロック

これは利用時間予算です。

- **Allowed minutes before block**（小数）: 1 期間あたりに許可する分数。例: `15`、`0.5`、`90`。
- **Timer reset interval (hours)**（小数）: 予算をリセットする間隔。例: `24`（毎日）、`1`（毎時）、`0.25`（15 分ごと）。

残り時間がある間は通常どおりページを使え、タイマーオーバーレイが表示されます。予算が 0 になると、その期間の残りはページがブロックされ、オーバーレイは `0:00` を表示し、その後タブは退出を試みます。

拡張機能はグループ単位・期間単位で動作します。

- 各グループは独自の予算を持つ。
- グループに一致するページで使った時間はそのグループ予算に加算される。
- 同一グループ内の複数タブは予算を共有する。タイマーは同期され、別タブへ切り替えると即時に共有残時間を表示するため強制更新される。

同一ページに複数の時間制限グループが適用される場合は、最も厳しいものが優先されます。

---

## 7. スケジュール

**Schedule** カードでは、グループが有効な時間帯を制限できます。

- **Days to block**: グループを適用する曜日を選択。未チェック曜日はその日グループ無効。
- **Time windows**: 自由入力リスト。`HHMM-HHMM` 形式で 1 行 1 ウィンドウ。例:

  ```
  0900-1000
  1200-1300
  ```

  グループはこの時間帯内でのみ有効。空欄なら終日有効。

これは `Custom` を除くすべてのグループタイプに適用されます。

---

## 8. Freeze（改変防止）

Freeze は、衝動的な無効化を難しくします。

**Freeze** カードで次を選べます。

- **Frozen** — グループを編集・削除できず、有効トグルも OFF にできません。変更には unfreeze 儀式（下記）が必要です。
- **Strict frozen** — Frozen と同様ですが、選択した時間（小数、最大 72 時間）ロックされます。タイマー満了までは unfreeze 儀式すら利用できません。

凍結グループが解除可能になると **Unfreeze** ボタンが表示されます。クリックすると **20 ステップ儀式** が始まります。

- モーダルに自己規律メッセージが表示される。
- `Confirm` を 20 回クリックする必要がある。
- クリック間に 5 秒の強制待機がある。
- 途中でキャンセルするとステップ 1 からやり直し。
- 20 個のメッセージがローテーションされ、実際に読む必要がある。

グループが "no snooze"（次セクション参照）にも設定されている場合、凍結中は snooze もできません。

Freeze 状態はグループカードのメタ行に表示され、strict freeze では残り時間も表示されます。

---

## 9. Snooze（一時無効化）

Snooze は、unfreeze せずにグループを一時無効化できますが、書面の理由が必要です。

**Snooze** カード：

- **Allow snooze for this group** — OFF の場合、このグループは一切 snooze 不可（凍結中も含む）。
- **Snooze for (minutes)** — 小数。snooze の継続時間。
- **Reason** — **100 文字以上かつ 20 単語を超える**必要があります。両条件を満たすまで Start ボタンは無効です。条件を満たさない場合は、ボタン横にインライン警告が表示されます。

グループが凍結中の場合、snooze 分数は凍結前に選んだ値で固定されます。snooze 許可があり、理由が条件を満たせば実行できます。

ステータスメッセージで snooze 開始が確認されます。終了するとグループは自動で通常状態に戻ります。

**End Snooze** ボタンで早めに終了することもできます。

---

## 10. 一括操作

- **Delete All** は全グループを削除します。
  - 常に確認を求めます。
  - 1 つでも凍結グループがあると、unfreeze と同じ 20 ステップ儀式が必要です。
  - strict-frozen でまだロック中のグループがある場合、**Delete All** は無効になります。

---

## 11. Custom グループ（完全リファレンス）

`Custom` グループは、バックグラウンド service worker で JavaScript 関数を実行します。関数は約 1 秒ごとに呼び出され、拡張機能はその戻り値を使って「今どのドメインをブロックすべきか」を判断します。

### 11.1 関数シグネチャ

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  // your logic
  return blockedDomains;
}
```

パラメータ：

- `month` — `1` から `12`。
- `dayOfMonth` — `1` から `31`。
- `dayName` — 例 `"Monday"`。
- `hour` — `0` から `23`。
- `minute` — `0` から `59`。
- `blockedDomains` — 他ルールがすでに生成したドメイン一覧。追加・置換・無視が可能。
- `helpers` — helper オブジェクト群（下記参照）。

戻り値：

- 今ブロックすべきドメイン文字列配列、または
- 何も返さない（この場合、拡張機能は変更後の `blockedDomains` を使う）。

関数は保存時に検証されます。構文エラーがあるとステータス警告が出て、修正するまでルールは使われません。実行時に例外が発生した場合、拡張機能は捕捉してバックグラウンドコンソールへ記録し、前回結果へフォールバックします。

### 11.2 適応的スケジューリング

Custom ルールは通常、約 1 秒ごとに実行されます。ルール処理が重くなると、拡張機能はループ間隔を自動で遅くします（最大で約 5 秒ごと）。手動管理は不要です。

### 11.3 `helpers` オブジェクト

関数内では `helpers` が複数のサブ helper を公開します。各 helper は長い名前と短い別名を持ち、明示的な getter もあります。

- `helpers.timerHelper` / `helpers.timer` / `helpers.getTimerHelper()`
- `helpers.persistenceHelper` / `helpers.persistence` / `helpers.getPersistenceHelper()`
- `helpers.domainHelper` / `helpers.domain` / `helpers.getDomainHelper()`
- `helpers.logHelper` / `helpers.log` / `helpers.getLogHelper()`
- `helpers.platformHelper` / `helpers.platform` / `helpers.getPlatformHelper()`
- `helpers.now` — 現在の epoch ミリ秒時刻。

すべての helper メソッドは安全設計で、パラメータ不正時は例外ではなく `null`、`false`、または空値を返します。

#### 11.3.1 `timerHelper`

ドメインに紐づくカウントダウンタイマーを管理します。タイマーはブラウザ再起動後も保持されます。各タイマーは作成した custom グループに属します。

- `createTimer(domain, durationMs, displayName?)` — 一意のタイマー id を作成して返します。無効なら `null`。例: `createTimer("youtube.com", 30 * 60 * 1000, "Timer1")`。ユーザーがそのドメインに一致するページを見ている間、オーバーレイに `Timer1: 30:00` が表示されて減少します。
- `deleteTimer(id)` — タイマーを削除。成功で `true`。
- `pauseTimer(id)` — カウントダウンを一時停止。
- `continueTimer(id)` / `resumeTimer(id)` — 一時停止タイマーを再開。
- `resetTimer(id, durationMs?)` — タイマーを再スタート。`durationMs` 未指定なら初期値を再利用。
- `addMs(id, ms)` — ミリ秒を加算（負値で減算）。
- `remainingMs(id)` — 残りミリ秒。
- `isExpired(id)` / `isPaused(id)` / `exists(id)` — 真偽値。
- `getDomain(id)` / `getDisplayName(id)` — タイマー情報を取得。
- `findByDomain(domain)` — そのドメインのタイマー id 配列。
- `list()` — このグループが所有する全タイマーの `{ id, domain, displayName, durationMs, remainingMs, isPaused }` 配列。

タイマーの最大時間は約 30 日です。

#### 11.3.2 `persistenceHelper`

グループ単位スコープの Map 風ストレージ。値は JSON シリアライズ可能である必要があります。呼び出し間で状態を保持する用途に便利です。

- `set(key, value)` — 任意 JSON 値を保存。成功で `true`。
- `get(key, defaultValue?)` — 保存値を返し、未登録なら `defaultValue`。
- `has(key)` / `delete(key)` / `keys()` / `entries()` / `size()` / `clear()`。

ソフト制限：1 グループあたり約 200 キー、1 値あたり 16 KB。

#### 11.3.3 `domainHelper`

- `normalize(value)` — `youtube.com` のような正規ドメイン、または `null` を返す。
- `matches(hostname, site)` — `hostname` が `site` に属する（サブドメイン含む）なら `true`。

#### 11.3.4 `logHelper`

- `log(...args)`、`warn(...args)`、`error(...args)` — バックグラウンドコンソールに書き込む。

これらを見るには：`chrome://extensions` → Developer Mode を有効化 → 拡張機能の "service worker" リンクをクリック。

#### 11.3.5 `platformHelper`

対応している SNS/動画プラットフォームを判定します。

- `supportedPlatforms` — `["youtube", "tiktok", "facebook", "instagram", "twitch"]`。
- `normalizePlatform(value)` — 正規プラットフォーム名、または `null`。
- `normalizeAuthor(author, platform)` — 指定プラットフォーム向けに作者識別子（handle、URL など）を正規化。失敗時 `null`。
- `detect(urlOrHost)` / `getContext(urlOrHost)` — `{ platform, hostname, pathname, type, authors, url }` を返す。失敗時 `null`。
  - `type` は `"short" | "long" | "post" | "unknown"`。
  - `authors` はその URL から検出可能な正規化作者一覧。
- `getType(urlOrHost)` — `detect(...).type` のショートカット。
- `getPlatform(urlOrHost)` — `detect(...).platform` のショートカット。
- `getAuthors(urlOrHost)` — `detect(...).authors` のショートカット。
- `matchesAuthor(urlOrHost, platform, authors)` — URL がそのプラットフォームで、かつ指定作者のいずれかに一致するなら `true`。

### 11.4 例

簡単：平日午前は SNS をブロック。

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const isWeekday = !["Saturday", "Sunday"].includes(dayName);

  if (isWeekday && hour >= 9 && hour < 12) {
    return [...blockedDomains, "facebook.com", "instagram.com", "tiktok.com"];
  }

  return blockedDomains;
}
```

中級：ブラウザセッションごとに YouTube を 30 分まで、可視カウントダウン付き。

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const { timerHelper, persistenceHelper } = helpers;
  let id = persistenceHelper.get("youtubeTimer");

  if (!id || !timerHelper.exists(id)) {
    id = timerHelper.createTimer("youtube.com", 30 * 60 * 1000, "YouTube");
    persistenceHelper.set("youtubeTimer", id);
  }

  if (timerHelper.isExpired(id)) {
    return [...blockedDomains, "youtube.com"];
  }

  return blockedDomains;
}
```

上級：TikTok セッションが short 動画で、かつ作者が distractor リストにある場合のみブロック。`platformHelper` を使用。

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const { platformHelper, logHelper } = helpers;
  const distractors = ["someuser", "anotheruser"];
  const url = "https://www.tiktok.com" + (globalThis.location?.pathname ?? "");
  const ctx = platformHelper.detect(url);

  if (ctx?.platform === "tiktok" && ctx.type === "short") {
    if (platformHelper.matchesAuthor(url, "tiktok", distractors)) {
      logHelper.log("Blocking TikTok short by", ctx.authors);
      return [...blockedDomains, "tiktok.com"];
    }
  }

  return blockedDomains;
}
```

（`globalThis.location` はあくまで例示用プレースホルダーです。バックグラウンド worker には実ページ URL がないため、通常は worker の location ではなく、自分のロジックで `platformHelper` を使ってください。）

最上級：日替わり "site of the day" をローテーションし、日次上限を設定して再起動後も保持。

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const { timerHelper, persistenceHelper, domainHelper, logHelper } = helpers;
  const sites = ["reddit.com", "twitter.com", "news.ycombinator.com"];
  const today = `${month}-${dayOfMonth}`;
  const lastDay = persistenceHelper.get("lastDay");

  if (today !== lastDay) {
    for (const id of timerHelper.list().map((t) => t.id)) {
      timerHelper.deleteTimer(id);
    }
    persistenceHelper.set("lastDay", today);
  }

  const site = sites[(month + dayOfMonth) % sites.length];
  let id = persistenceHelper.get(`timer:${site}`);

  if (!id || !timerHelper.exists(id)) {
    id = timerHelper.createTimer(site, 20 * 60 * 1000, `${site} budget`);
    persistenceHelper.set(`timer:${site}`, id);
    logHelper.log("Started budget for", site);
  }

  if (timerHelper.isExpired(id)) {
    return [...blockedDomains, domainHelper.normalize(site)];
  }

  return blockedDomains;
}
```

---

## 12. 複数ページでの挙動

- 同じグループに属する開いている全タブは同じタイマーを共有します。
- 同じグループのタブへ切り替えると、オーバーレイが即時更新され、現在の共有時間が表示されます。
- 新しいルールを追加すると、開いているすべてのページが変化を検知し、数分の一秒で更新されます。手動リロードは不要です。
- ルールが失効すると、非表示だったフィードカードやナビボタンは次回更新で復元されます。

---

## 13. 国際化

UI 全体は完全に翻訳されています。右上の **Language** ピッカーを使ってください。

対応言語には英語、簡体字中国語、スペイン語、日本語、韓国語が含まれ、さらにヒンディー語、アラビア語、ベンガル語、ポルトガル語、ロシア語、パンジャブ語、ドイツ語、フランス語、トルコ語、ベトナム語、イタリア語、タイ語、オランダ語、ポーランド語、インドネシア語、ウルドゥー語、ペルシャ語などの一部対応言語があります。一部対応言語では不足文字列を英語にフォールバックします。

このマニュアル自体は、選択言語に対応する markdown ファイルを読み込み、不足時は英語へフォールバックします。

---

## 14. ステータスメッセージ

ステータスメッセージは中央の toast として表示され、約 2 秒後にフェードアウトします。

- "Saved changes."
- "Created \"Group name\"."
- "Allowed minutes must be a number greater than 0." などの検証エラー。
- "Snooze minutes must be a number greater than 0."
- "Frozen groups cannot be changed."

入力フォーマット要件がある項目では、関連ボタンの横にもメッセージが表示されます（snooze）。

---

## 15. プライバシーと保存

- すべてのデータは `chrome.storage.local` にローカル保存されます。外部送信はありません。
- 保存される項目には、グループ、利用タイマー、最終リセット時刻、snooze 記録、custom タイマー、custom 永続値が含まれます。
- 拡張機能は、ページタイプ判定に必要な範囲（パス/ホスト名/動画サイトの既知 DOM マーカー）を超えてページ内容を読みません。メッセージ、投稿、コメント、プライベート内容は読みません。

---

## 16. 権限

- `storage` — 上記データ保存用。
- `declarativeNetRequest` — `Default` グループのネイティブブロック用。
- `alarms` — ルール遷移を効率よくスケジュールするため。
- `host_permissions: <all_urls>` — content script が任意ページでタイマーオーバーレイ表示とプラットフォーム文脈判定を行うため。

---

## 17. トラブルシューティング

- **追加したグループが何もしない。** グループ有効、現在時刻がスケジュール内、snooze 無効、そして（プラットフォームグループなら）ページが選択したコンテンツタイプと作者フィルタに実際に一致しているか確認してください。
- **あるタブだけタイマーが止まる/おかしい。** 一度別タブへ移動して戻る、またはそのタブをフォーカスしてください。共有タイマーから強制更新されます。
- **隠れているはずのフィードカードが再表示される。** フィード非表示は、ルールがアクティブにブロックしている間だけ動作します。`after-minutes` ルールの場合、時間が 0 になってから有効になります。
- **隠れるはずの YouTube ナビボタンが残る。** ナビ非表示は、ルールが "do not filter by author" かつコンテンツタイプが Shorts または YouTube posts の場合に限ります。作者フィルタ使用時はカード単位の非表示のみです。
- **Custom ルールが効かない/黙って失敗する。** `chrome://extensions` を開き、Developer Mode を有効にし、拡張機能の "service worker" リンクをクリックしてコンソールを確認してください。`helpers.logHelper.log(...)` でトレースできます。
- **グループを削除できない。** おそらく凍結されています。strict-frozen グループはロック期限まで削除不可。非 strict の frozen グループは unfreeze 儀式で削除可能です。

---

## 18. 用語集

- **Block group** — 独自のタイプ、挙動、スケジュール、freeze/snooze を持つ 1 つのルールセット。
- **Instant block** — ルールが有効なら即時にブロック。
- **After-minutes block** — 期間の時間予算が尽きた後にのみブロック開始。
- **Reset interval** — after-minutes 予算をリセットする頻度。
- **Schedule** — グループが有効な曜日 + 時間帯。
- **Freeze / Strict freeze** — 改変防止状態。
- **Snooze** — 理由文付きの一時無効化。
- **Author filter** — プラットフォームグループで対象クリエイターを制限する機能。
- **Content type** — プラットフォームグループで対象コンテンツ形態（short、long、post）を制限する機能。
- **Helpers** — custom ルール関数に渡されるユーティリティ群。
- **Platform** — `youtube`、`tiktok`、`facebook`、`instagram`、`twitch` のいずれか。各プラットフォームに固有のグループタイプとフィード非表示ロジックがあります。

---

## 19. 制限事項

- フィード非表示は各プラットフォームの現在 DOM に依存します。レイアウト変更があると、非表示セレクタの更新が必要になる場合があります。
- YouTube 以外のサイトに対するプラットフォーム文脈判定は主に URL ベースなので、正規コンテンツ URL で最も信頼性が高いです。
- Custom ルールのループはページ内ではなくバックグラウンド worker で実行されるため、関数内で DOM レベル情報は使えません。代わりに URL 文字列で `platformHelper.detect(url)` を使ってください。
- ブラウザは idle 時に service worker を停止することがあります。拡張機能はページまたは alarm が必要になればすぐ再開します。これによって利用タイマーの精度は失われません。
