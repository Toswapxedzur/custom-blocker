# Vault ব্রাউজার এক্সটেনশন কোড নির্দেশিকা

[ব্যবহারকারী নির্দেশিকা](../manual/bn.md)

## নিয়মের শর্ত

উৎস: একটি function expression `(on, v) => { ... }`। শুধু synchronous JavaScript ও নিচের API সমর্থিত; JavaScript-এর সময়সূচিভিত্তিক callback, network, extension API বা সরাসরি DOM অ্যাক্সেস নেই। সময়নির্ভর নিয়মে নিচের পরিচালিত timer/tracker অথবা `ev.now` ও event ব্যবহার করুন।

- সম্পাদনা draft সংরক্ষণ করে; **Run** নিয়ম সক্রিয় করে এবং গ্রুপ চালু করে। ফ্রিজ করা গ্রুপ Run করা যায় না। ফাঁকা source নিয়ম unload করে।
- সফল Run handler ও panel প্রতিস্থাপন করে এবং `v.state` অক্ষত রাখে। Compile/registration ব্যর্থ হলে আগের নিয়ম থাকে; timeout নিয়ম থামাতে পারে। Engine reload হলে শেষ সক্রিয় source আবার register হয়; closure variable reset হয়।
- Registration-এ state initialize, handler register, panel দেখানো ও log করা যায়। Page/file action ও emit handler-এর মধ্যে রাখুন; registration সময়ের queue বাতিল হয়।
- Disable handler বন্ধ করে managed panel, sheet, cover ও item verdict তুলে দেয়। Enable সংরক্ষিত panel/sheet ফেরায় এবং item আবার চায়। Run আগের sheet, cover বা item verdict মুছে না। Delete নিয়ম, তার state ও প্রভাব সরায়। Navigation, DOM mutation ও file write ফেরানো হয় না।
- সাধারণ group target event সীমিত করে না; নিয়মে URL/item filter করুন। Action queue করে dispatch-এর পর প্রয়োগ হয়। Exception handler থামায়, কিন্তু তার state/action rollback করে না; পরের handler চলতে পারে। File/query event ছাড়া action acknowledgment নেই।

## যৌথ API

- `on(type, handler)` → boolean। `handler(ev)` নিবন্ধন করে; একাধিক handler নিবন্ধনের ক্রমে চলে। False মানে argument অবৈধ বা handler limit পূর্ণ। `ev = { type: string, now: number, origin: "host" | "user" | "rule", data }`; `now` হলো Unix milliseconds। প্রকৃত রেন্ডার করা control event-এ `origin: "user"`; `v.emit` event-এ `origin: "rule"` থাকে।
- `v.state`: mutable JSON object, event dispatch শেষে সংরক্ষিত হয়। বিদ্যমান state না মুছে অনুপস্থিত field initialize করুন। Object নয় বা array দিলে `{}` হয়; serialize করা যায় না বা অতিরিক্ত বড় update সংরক্ষিত হয় না।
- `v.log(...values)`: এই group-এর Log-এ লেখে। Handler error ও রিপোর্ট করা page-action error-ও এখানে দেখা যায়; রিপোর্ট করার ফলে action আবার চালানো হয় না। Log/Clear প্রতি group আলাদা। Load error Run status-এ দেখা যায়।
- `v.emit(type, data)`: বর্তমান event-এর পরে এই group-এর handler-এ `data`-র JSON copy queue করে, নতুন `now`-সহ; এটি synchronous call নয়।
- `v.panel(id, spec, tabId?)`: group-এর নামযুক্ত panel প্রতিস্থাপন করে; সব accessible web page-এর জন্য `tabId` বাদ দিন, অথবা integer tab ID দিন। Null `spec` panel সরায়। Panel অংশ দেখুন।
- `v.file(op, path, payload?)` → request ID string। Files অংশ দেখুন।
- `v.store(request)` request ID ফেরায়; group record দেখুন।

নিচের নামযুক্ত পরিচালিত সময়-অবজেক্ট তৈরির function ছাড়া অন্য যৌথ call `undefined` দেয়। ID/state একটি group-এর, তার প্রদর্শিত নামের নয়।

## পরিচালিত টাইমার ও চলমান সময়সীমার ব্যবহার

`v.timer(id, {direction:"down", durationMs:300000})` একটি নামযুক্ত countdown তৈরি করে অথবা বিদ্যমানটি ফেরত দেয়; শুরুতে সেটি paused থাকে। Count-up timer-এর জন্য `{direction:"up"}` ব্যবহার করুন। Handle-এ আছে `start()`, `pause()`, `resume()`, `reset()` ও `snapshot()`। Start/resume বারবার ডাকলেও একই ফল হয়; reset করলে elapsed সময় শূন্য হয়ে paused অবস্থায় ফেরে। Snapshot field-এর মধ্যে আছে `ready`, `error`, `elapsedMs`, `remainingMs` (count-up-এর জন্য null), `running` ও `completed`।

App/browser বন্ধ থাকলেও বা rule disabled থাকলেও চলমান timer ঘড়ির প্রকৃত সময় অনুযায়ী এগোয়। Countdown শেষ হলে প্রতিটি timer incarnation ও generation-এর জন্য প্রতিটি member-এর rule পরেরবার চলার সময় একবার `timerEnded` এবং `{id, direction, durationMs, generation, incarnation}` পৌঁছে দেয়; Run এটি আবার পাঠায় না। Delivery host event-এর ওপর নির্ভর করে; এটি real-time alarm নয়। বিদ্যমান text control দিয়ে দেখাতে panel-এ `{type:"timer", timerId:"focus", label:"Focus"}` রাখুন।

`v.rolling(id, {windowMs:3600000, limitMs:600000})` একটি নামযুক্ত সক্রিয় ব্যবহার tracker তৈরি করে অথবা বিদ্যমানটি ফেরত দেয়। `assign({websites:["youtube.com","reddit.com"], apps:[]})` এই member-এর target assignment প্রতিস্থাপন করে। Native rule পরিবর্তে platform app ID দিতে পারে। Domain-এর মধ্যে subdomain-ও পড়ে। একটি tracker তার target-গুলোর ব্যবহার একত্র করে; অন্য ID-এর allowance স্বাধীন। `snapshot()` ফেরত দেয় `ready`, `error`, `usedMs`, `remainingMs`, `available` ও `nextReturnAtMs` (পরের যে millisecond-এ কোনো নথিভুক্ত ব্যবহারের মেয়াদ শেষ হবে)। Target দিলে `available(target?)` assignment-ও পরীক্ষা করে। `reset()` এই object-এর history মুছে দেয়।

Allowance-এর অতিরিক্ত ব্যবহারসহ পর্যবেক্ষিত সব যোগ্য ব্যবহার গণনা হয়; tracker নিজে page/app block করে না। একই সময়ের overlapping visible-page interval একবার গণনা হয়, আর native app-এ পর্যবেক্ষিত foreground ব্যবহার গণনা হয়। Disabled rule ব্যবহার যোগ করে না; তবে interval-এর সুনির্দিষ্ট সীমানায় history-এর মেয়াদ শেষ হতে থাকে। অবশিষ্ট history-এর ব্যবহার limit-এর নিচে নামলেই কেবল availability ফেরে। Heartbeat sample সর্বোচ্চ পাঁচ সেকেন্ডের; shutdown/disabled gap থেকে কৃত্রিম activity তৈরি হয় না। ব্যবহারকারীর emit করা event ব্যবহার যোগ করে না।

Linked custom group-এ একই object ID একটি স্থানীয় native hub-এর কর্তৃত্ব ভাগ করে। Linking tracker history ও assignment একত্র করে এবং যে পক্ষ linking শুরু করেছে তার timer state রাখে; অসামঞ্জস্যপূর্ণ configuration linking প্রত্যাখ্যান করে। প্রতিটি member নিজস্ব completion event পায়। Disconnect হলে নতুন authoritative তথ্য না ফেরা পর্যন্ত shared tracker unavailable হয় এবং timer control প্রত্যাখ্যাত হয়। Unlink-এ প্রতিটি member চূড়ান্ত shared usage ও timer state রাখে, নিজস্ব target ফেরত পায় এবং পুরোনো link-এর command বাদ দেয়। ফিরে আসা member চূড়ান্ত snapshot save করে acknowledgement না দেওয়া পর্যন্ত hub সেটি রাখে; নতুন link পাওয়ার আগে pending handover শেষ হয়।

নামযুক্ত object Run ও restart-এর পরেও সংরক্ষিত `v.state.$vaultTime`-এ থাকে; field-টি সরাসরি edit করবেন না। স্পষ্টভাবে সরাতে `v.removeTime(id)` ব্যবহার করুন। ID-তে 1–80টি ASCII অক্ষর, সংখ্যা, `_` বা `-` থাকতে পারে; সংরক্ষিত property name প্রত্যাখ্যাত হয়। সর্বোচ্চ 32টি object rule-এর 64KiB UTF-8 state limit ভাগ করে। Duration পূর্ণসংখ্যা millisecond, সর্বোচ্চ 365 দিন। Rolling history সর্বোচ্চ 1024টি minute bucket ও 2048টি merged interval রাখে। History capacity error হলে স্পষ্টভাবে reset না করা পর্যন্ত tracker unavailable থাকে; invalid configuration ও oversized save error জানায় কিন্তু saved data মুছে না।

```js
(on, v) => {
  const timer = v.timer("focus", {durationMs: 300000});
  v.panel("focus", {controls: [
    {type: "timer", timerId: "focus", label: "Focus"},
    {id: "start", type: "button", label: "Start"},
    {id: "pause", type: "button", label: "Pause"},
    {id: "reset", type: "button", label: "Reset"}
  ]});
  on("panel", ev => {
    if (ev.data.eventName !== "click") return;
    if (ev.data.controlId === "start") timer.start();
    if (ev.data.controlId === "pause") timer.pause();
    if (ev.data.controlId === "reset") timer.reset();
  });
  on("timerEnded", ev => v.log("Finished", ev.data.id));
}
```

## Browser event

নিচের payload notation type বোঝায়, executable code নয়। `?` ঐচ্ছিক field চিহ্নিত করে।

```text
tick (~1 second): { tabs: { tabId: number, url: string, active: boolean }[] }
tab: { kind: "open" | "navigate" | "close", tabId: number,
       url: string, previousUrl: string | null }
visible: { tabId: number, url: string, elapsedMs: number }
items: { tabId: number, platform: string, items: Item[] }
attachment: { eventName: "click" | "input" | "change", tabId: number,
              attachmentId: string, controlId: string, value: unknown,
              values: { [controlId: string]: unknown }, item: Item, text: string }
record: { requestId: string, ok: boolean, op?: string, key?: string,
          record?: Record | null, entries?: Header[], next?: string | null,
          deleted?: number, error?: string }
snooze: {}
panel: { panelId: string, controlId: string, eventName: string,
         value: string | number | boolean | null,
         values: { [controlId: string]: string | number | boolean } }
query: { requestId: string, tabId: number, url: string, selector: string,
         matches: Match[], error: string }
file: see Files

Item = { ref: string, contentId: string, instanceId: string, attachments: { [id: string]: Attachment },
         url: string, title: string, authors: string[],
         videoForm: "short" | "long" | "post" | "unknown",
         tags: { name: string, confidence: number }[],
         tagsSettled: boolean, isPage: boolean }
Match = { tag: string, text: string, href: string, src: string,
          title: string, label: string, value: string }
```

- `tick` আনুমানিক; tick সংখ্যা নয়, timestamp ব্যবহার করুন। `active` মানে browser window-তে নির্বাচিত, ব্যবহারকারী দেখছেন তার প্রমাণ নয়। URL ফাঁকা বা সীমাবদ্ধ হতে পারে।
- `visible` accessible, non-hidden page থেকে আসে; `elapsedMs` তাদের শেষ heartbeat থেকে সময়, cover থাকলে শূন্য। এটি মোট ব্যবহার বা playback time নয়।
- `items` (`platform: "web"` পরিচিত সাইটের বাইরে) নতুন/পরিবর্তিত supported feed item জানায় এবং Run/re-enable-এর পরে আবার পাঠায়। `ref` page-এর card চিহ্নিত করে, স্থায়ী content ID নয়; `ref === "page"` মানে page নিজেই। title/URL/author ফাঁকা হতে পারে। `authors`-এ platform-specific source ID থাকে।
- Platform ID: `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`, `reddit`, `discord`, `twitter`, `bluesky`, `threads`, `substack`, `bilibili`, `rumble`, `pinterest`, `kick`, `tumblr`, `peertube`, `pixelfed`, `kuaishou`। Page-এর supported markup-এর ওপর item পাওয়া নির্ভর করে।
- Tag-এর জন্য connected desktop Classifier ও tagging-enabled build/platform দরকার (Chromium ও Safari: YouTube, Reddit, Bilibili, X/`twitter`)। Confidence 1–5। `tagsSettled === false` মানে pending/unavailable, untagged নয়; settled `tags: []` মানে untagged।
- `snooze` মানে group-এর Snooze button চাপা হয়েছে। এটি নিজে কোনো pause প্রয়োগ করে না।
- Query/file reply অনুরোধকারী group-এ যায়। `requestId` মিলিয়ে `error`/`ok` দেখুন এবং tick দিয়ে deadline দিন: page বন্ধ, engine reload বা group disable হলে reply হারাতে পারে। Run-এর পরে request ID আবার হতে পারে; pending request স্থায়ী কাজ নয়।

## Browser action

Integer `tabId` কোনো event থেকে নিতে হবে। Page action-এর জন্য Vault-accessible page প্রয়োজন; internal browser page অনুপলব্ধ। Invalid input বা unavailable target সাধারণত কোনো প্রভাব ফেলে না।

- `v.item(tabId, ref, verdict)`: `"hide"` feed card সরায়, `"dim"` media ঢেকে দেয়, `"allow"` lower group থেকে অব্যাহতি দেয়, `null` এই group-এর verdict মুছে। অজানা ref-এ কিছু হয় না; `v.cover` ব্যবহার করুন `isPage` হলে। Verdict group-list order মেনে চলে: উপরের hide জেতে; উপরের dim নিচের allow-এর পরও থাকে; allow নিচের verdict ঠেকায়। Recycled/removed card-এর জন্য নতুন সিদ্ধান্ত দরকার।
- `v.cover(tabId, on, message?)`: true page ঢাকে, false custom cover তোলে; message ডিফল্টে ফাঁকা (সর্বোচ্চ 500 অক্ষর)। প্রতি page-এ একটি custom-cover slot; group order নির্বিশেষে সর্বশেষ cover call কার্যকর। Address বদলালে এটি সরে; সাধারণ blocking তবু page ঢাকতে পারে।
- `v.go(tabId, target)`: HTTP(S) URL বা `"back"`, `"forward"`, `"reload"` (target সর্বোচ্চ 4096 অক্ষর)।
- `v.close(tabId)`: tab বন্ধ করে।
- `v.css(tabIdOrStar, id, css)`: integer tab ID বা `"*"`; একই ID-র group sheet প্রতিস্থাপন করে, null দিয়ে সরায়। Address বদলালে tab sheet শেষ; `"*"` sheet পরের page-এও প্রযোজ্য। ID সর্বোচ্চ 80, CSS সর্বোচ্চ 100000 অক্ষর।
- `v.dom(tabId, selector, op, arg?)`: CSS selector (সর্বোচ্চ 1000); `scrollTo` প্রথমটি ছাড়া সব match-এ কাজ করে। অপারেশন: `hide` inline `display:none!important` বসায়; `show` inline display সরায়; `click`; `setText`-এ `arg` দিয়ে text বদলায়; `addClass`/`removeClass` এক class name নেয়; `scrollTo` view-তে আনে। arg সর্বোচ্চ 2000। নিজে reverse না করা বা page replace না হওয়া পর্যন্ত mutation থাকে।
- `v.query(tabId, selector)` → request ID string, invalid argument হলে null। ফল পরে `query` event-এ আসে: সর্বোচ্চ 50 match, lowercase `tag`, 1000 অক্ষরের normalized text, 2000 অক্ষরের attributes, 1000 অক্ষরের value। Match না থাকলে সফল `[]`; invalid CSS হলে `error: "invalid-selector"`। Vault receiver নেই এমন page উত্তর নাও দিতে পারে।

## Panel

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

ডিফল্ট: নিচে-ডানে; vertical layout; left align; region role; content-নির্ধারিত width। Preset width 220/280/360px; numeric panel width 180–520px-এ সীমাবদ্ধ। Control width 32–520px, height 20–360px। Numeric size pixel string-ও নিতে পারে। Vertical variant spacing বদলায়; inline/row wrap করে না; wrap/toolbar wrap করে; twoColumn/grid/split/form grid ব্যবহার করে; stack spacing কমায়। Role accessibility অর্থ দেয়, modal blocking নয়।

ID ASCII letter/digit/`_`/`-`-এ normalize হয় (সর্বোচ্চ 80); অনন্য স্থায়ী ID নিন। বাদ দেওয়া control ID হয় `control-N`; বাদ/অজানা type হয় text। বাদ text/list ফাঁকা; disabled false। `v.panel` call পুরো spec বদলে দেয়। `value` বাদ থাকলে সর্বশেষ control event value নিয়ে type normalize হয়; দেওয়া `value` তা অগ্রাহ্য করে। Autofocus ডিফল্টে false। অজানা field বাদ; panel color/font/CSS rule থেকে দেওয়া সমর্থিত নয়।

Control field ও value:

- `text`: `text` string; ডিফল্ট label। `html`: `html` string; script, event attribute, বিপজ্জনক URL ও style সরানো হয়।
- `button`: `label`, ঐচ্ছিক `action: "submit" | "cancel" | "close"`; value string (ডিফল্ট ফাঁকা)। Action event পাঠায়; স্বয়ংক্রিয় submit/close করে না।
- `checkbox`, `toggle`: boolean `value` (ডিফল্ট false)।
- `select`, `radio`: `options: (string | { value: string, label?: string })[]`; string value (ডিফল্ট ফাঁকা)। ফাঁকা option value বাদ; label ডিফল্টে value।
- `textInput`, `textarea`: string value (ডিফল্ট ফাঁকা), `placeholder`; textarea `rows` 1–12 (ডিফল্ট 3)।
- `numberInput`, `range`: numeric value (ডিফল্ট 0), `min`, `max`, positive `step`। Panel update-এ value সীমার মধ্যে থাকে; নির্দিষ্ট না থাকলে normalization −1000000…1000000। Range widget ডিফল্ট 0…100; explicit bound দিন।
- `date`: string `YYYY-MM-DD`; `time`: `HH:MM` বা `HH:MM:SS`; invalid initial format ফাঁকা হয়। নিজে edit যাচাই করুন। `color`: `#RRGGBB` (ডিফল্ট `#000000`)।
- `pin`: digit string; `length` 3–12 (ডিফল্ট 6), `masked` ডিফল্ট true, `autoSubmit` false। `section`: `text`, `controls`, ঐচ্ছিক layout/align/role (role ডিফল্ট group); depth 3-এ child section নেই (root control depth 0)।

Panel event: input control `input`/`change` পাঠায় (text input blur/Enter-এ বদলায়; textarea blur/Ctrl-or-Cmd+Enter-এ)। সাধারণ control `focus`, `blur`, `key`-ও পাঠায়; key metadata rule-এ যায় না। Button `click` **এবং** configured action আলাদা event হিসেবে পাঠায়—একটি সামলান। PIN `change`, autoSubmit পূর্ণ হলে `submit` পাঠায়। Mount/unmount-এ `controlId: ""`, `value: true`। `values`-এ ID অনুযায়ী বর্তমান input value থাকে; button/text/HTML নয়। Event-এ originating tab ID নেই; tab-specific কাজের জন্য আলাদা panel ID নিন।

Text limit: title/label/ariaLabel 240; description/text 1000; HTML 20000; placeholder 500; input text 2000; অন্য value string 512; option value/label 256। বাড়তি অংশ কাটা হয়।

## File

`op`: `"read"`, `"write"`, `"append"`, `"list"`, `"exists"`। Settings-এ **Custom-rule folder** ও তার permission দরকার। Safari তার native folder picker ও সংরক্ষিত security-scoped grant ব্যবহার করে; নির্বাচিত folder-ই পাওয়া যায়।

- `path` relative; `/` directory আলাদা করে। Segment-এ ASCII letter/digit, space ও `_.,@()-` চলবে; শুরুতে dot, `.`/`..`, absolute path বা URL নয়। File suffix `.txt`, `.csv`, `.json` (case-insensitive)। List path directory; `""` নির্বাচিত root দেখায়। নির্বাচিত folder-এর বাইরে যাওয়া path, symlink দিয়েও, প্রত্যাখ্যান হয়।
- Read UTF-8 text দেয়। Write replace/create; append স্বয়ংক্রিয় newline ছাড়া append/create করে। Write-এ parent directory তৈরি হয়। String payload হুবহু লেখা হয়; অন্য JSON payload serialize হয়; null/বাদ মানে ফাঁকা text। JSON/CSV parse rule-এর কাজ। সর্বোচ্চ file size 1048576 UTF-8 byte।
- List তাৎক্ষণিক visible subdirectory ও supported file দেয়। Entry: `{ name: string, path: string, kind: "directory" | "file", extension?: string }`; file-এর extension-এ dot থাকে। Exists supported file path-এর boolean দেয়।

```text
file.data = { requestId: string, op: string, path: string, ok: boolean,
              text: string | null, entries: Entry[] | null,
              exists: boolean | null, error: string }
```

অব্যবহৃত result field null; সফলতার error ফাঁকা। Failure: invalid-path, unsupported-file-type, permission/folder unavailable, missing file, file-too-large। error-কে string ভাবুন, নির্দিষ্ট পূর্ণ enum নয়। Request-এ transaction/order guarantee নেই; প্রতি path-এ read-modify-write serialize করুন।

## সীমা

প্রতি event প্রতি group: 256 queued action, 200 log call, 64 emit; অতিরিক্ত বাদ যায়। প্রতি rule: 1000 handler, 24 panel; control list-এ 32 entry, প্রতিটি choice-এ 64 option; অতিরিক্ত ignore/truncate হয়। Emit chain 16 generation-এ থামে। Serialized state limit 65536 UTF-8 byte। Registration ও প্রতিটি event-এর combined handler 1 সেকেন্ডের নিচে রাখুন; বারবার বেশি সময় বা hard timeout হলে Run পর্যন্ত group বন্ধ। Log প্রতি group-এ 200 entry রাখে, প্রতি সেকেন্ডে 50 গ্রহণ করে এবং দীর্ঘ বার্তা প্রায় 4096 character-এ কাটে। Timer/reply best-effort, real-time নিশ্চয়তা নয়।

## সম্পূর্ণ নিয়ম

Snooze বা তার panel button দিয়ে চালু হওয়া পাঁচ মিনিটের বিরতি:

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


## চলমান নিয়ম থেকে AI কল

প্রতিটি custom group **AI calls**-এ একটি connection/model ও reasoning effort বেছে নেয়। Mac ও browser rule একই API ব্যবহার করে; browser request-এর জন্য Mac Vault connected থাকতে হবে, provider credential সেখানেই থাকে। Linked group নির্বাচন ও ঐচ্ছিক দৈনিক request cap ভাগ করে। ফাঁকা মানে group cap নেই; account limit থাকে। Cap UTC দিন ধরে, restart-এ স্থায়ী এবং ব্যর্থসহ submitted attempt গোনে। Link করলে আগের usage যোগ হয়; unlink করলেও আগের usage থাকে।

সংরক্ষিত prompt ও context linked group-এ ভাগ হয় এবং handler-এ `v.context.ai.prompt` ও `v.context.ai.context` হিসেবে পাওয়া যায়। Vault এগুলি নিজে পাঠায় না; প্রতিটি `v.ai` কলে কী যাবে তা rule বেছে নেয়।

`v.ai({ prompt, input? })` সঙ্গে সঙ্গে request ID দেয়। Registration-এ নয়, handler-এর মধ্যে কল করুন। `input` যেকোনো JSON; prompt/input প্রত্যেকটি সর্বোচ্চ20KB। উত্তর `ai` events: `. Success text is at most48KB; citations are ` `ask` `note` event-এ আসে: {requestId, ok, text, citations, error}। সফল text সর্বোচ্চ48KB; citation {url,title}। Web search-এর উত্তর দেখালে source link দৃশ্যমান ও clickable রাখুন। Model-এর জন্য search সর্বদা উপলভ্য। নির্দিষ্ট app deadline নেই; bounded concurrency থাকে; provider fallback বা auto retry নেই। উত্তর data, JavaScript হিসেবে execute হয় না; বিদ্যমান action নেবে কি না rule ঠিক করে।

```javascript
(on, v) => {
  let pending = null;
  on("panel", ({ data }) => {
    if (data.controlId !== "ask" || pending) return;
    pending = v.ai({ prompt: v.context.ai.prompt || "Summarize this text.", input: {context:v.context.ai.context, note:data.values?.note ?? ""} });
  });
  on("ai", ({ data }) => {
    if (data.requestId !== pending) return;
    pending = null;
    if (!data.ok) { v.log("AI request failed:", data.error); return; }
    v.log(data.text, data.citations);
  });
}
```

Restart-এ outstanding call replay হয় না। Run, disable/enable বা delete পুরনো reply বাতিল করে; disconnected browser `ai-unavailable` দেয়। অন্য error: `ai-not-configured`, `ai-invalid-input`, `ai-busy`, `ai-daily-limit`, `ai-request-failed`, `ai-usage-storage-unavailable`। Failed call rule-এর আগের রাখা result বদলায় না; rule state-এর64KB সীমা আগের মতোই।

Credential-মুক্ত model পছন্দ Mac-এ `rule_ai_models`, browser-এ `settings-rule-ai-models` দিয়ে খুঁজুন; বর্তমান set-group path-এ `ruleAI` কনফিগার করুন। Field: `providerModel`, `accountID`, `reasoningEffort` (`default`, `low`, `medium`, `high`) এবং `dailyRequestLimit` (null বা1–100000)। ফেরত পাওয়া choice ব্যবহার করুন; rule source-এ key বা provider URL দেবেন না।
ঐচ্ছিক সংরক্ষিত field হলো `prompt` ও `context`; প্রতিটি সর্বোচ্চ16KB string।

## গ্রুপ রেকর্ড

`v.store(request)` handler-এর মধ্যে asynchronous JSON record operation শুরু করে। Record এই গ্রুপের ব্যক্তিগত, Run ও restart-এর পর থাকে এবং গ্রুপ মুছলে মুছে যায়; linked group-এর record আলাদা। Key, value, version, cache invalidation ও feedback precedence নিয়মই নির্ধারণ করে। Mac ও browser একই API ব্যবহার করলেও প্রতিটি app/browser store আলাদা।

| Request | Result |
|---|---|
| `{op:"get", key}` | `record` বা `null` |
| `{op:"put", key, value, version?, ifRevision?}` | সংরক্ষিত `record` |
| `{op:"delete", key, ifRevision?}` | `record: null` |
| `{op:"list", prefix?, after?, limit?}` | সাজানো `entries` ও `next` |
| `{op:"clear", prefix?}` | `deleted` সংখ্যা |

প্রতিটি record-এ `{value, revision, version, updatedAt}` থাকে। বাস্তব write হলে opaque revision বদলায়; `version` caller-এর metadata। `list` value ছাড়া header ফেরায়; একটি পড়তে `get`, পরের page-এ যেতে `after: next` `put` `delete` ব্যবহার করুন। `ifRevision` বাদ দিলে put/delete unconditional; `null` মানে key অনুপস্থিত হতে হবে, revision string হলে exact match চাই। Mismatch-এ `ok:false`, `error:"store-conflict"` ও বর্তমান `record` ফেরে—এটি delayed automatic reply-কে user feedback overwrite করা থেকে আটকায়। `v.context.revision` opaque rule-configuration marker; rule চাইলে নিজের version-এ রাখতে পারে। Framework cache policy নির্ধারণ করে না।

সীমা: key 1–2048 অক্ষর, version ≤128, JSON value ≤64KiB, depth ≤32, প্রতি group 10000 key, পুরো record document 16MiB। `list` প্রতি page-এ সর্বোচ্চ100 header ও96KiB দেয়। প্রতি group 32 এবং মোট প্রতি সেকেন্ডে 128 request start; overload-এ প্রতি group-এ প্রতি সেকেন্ডে একটি `store-busy` error, অতিরিক্ত request drop হয়। Storage error `ok:false`; future/malformed document সংরক্ষণ করে `store-unavailable` জানায়। Auto retry/eviction নেই; deadline-এর জন্য ticks ব্যবহার করুন।

## সংরক্ষিত কনটেন্ট সংযুক্তি

দেখা কনটেন্ট আইটেমের জন্য pill বা নিষ্ক্রিয় HTML/CSS দৃশ্য `v.attach(tabId, item, id, spec)` দিয়ে সংরক্ষণ করুন। সম্পূর্ণ `item` দিন, যা `items` বা `attachment` ইভেন্ট থেকে নিন; শুধু `ref` সংযুক্তির হ্যান্ডেল নয়। `contentId` সংরক্ষিত কনটেন্ট চিহ্নিত করে, আর `instanceId` বর্তমান উপস্থিতি চিহ্নিত করে। AI-এর উত্তরের অপেক্ষায় আসল হ্যান্ডেলটি রাখুন। মুছে ফেলা, পুনর্ব্যবহৃত বা নেভিগেট করা লক্ষ্যকে দেরিতে সংযুক্তির চেষ্টা Vault প্রত্যাখ্যান করে; `v.item(tabId, ref, verdict)`-এর আচরণ আলাদা থাকে।

Pill-এর জন্য `spec` হলো `{type:"pill", text, tone?, tooltip?}`; tone `blue`, `cyan`, `gold`, `pink` বা `red`। সাধারণ text সর্বোচ্চ 240 অক্ষর, tooltip 1000। দৃশ্যের জন্য spec হলো `{type:"html", html, css?, label?}`। HTML সীমা 32000 অক্ষর, CSS 16000, label 200। অনুমোদিত নিষ্ক্রিয় HTML/SVG বন্ধ shadow root ও সীমাবদ্ধ CSS-এ পুনর্গঠন হয়; script, event attribute, দূরবর্তী resource, embed ও অনিরাপদ CSS বাদ যায়। দৃশ্য কনটেন্ট কার্ডের মধ্যে সীমাবদ্ধ, 480px উচ্চতায় scroll হয়। ID-তে 1–80 ASCII অক্ষর/সংখ্যা, _ বা - থাকতে পারে। null spec দিলে দলের pill মুছে যায়। Handler-এর মধ্যে কল করুন; সংরক্ষণ/ডেলিভারির ব্যর্থতা Log-এ আসে, স্বয়ংক্রিয় retry হয় না।

প্রতিটি আইটেমে এই দলের সংযুক্তিগুলি `item.attachments`-এ read-only snapshot হিসেবে থাকে; অন্য দলের সংযুক্তি সেখানে নেই। সংরক্ষিত তথ্য পাওয়া না গেলে `attachments` null এবং `attachmentError` সেট হয়—এটি খালি cache নয়। অন্য handler চলতে থাকে। সংরক্ষিত ফল থাকা কনটেন্টে AI অনুরোধ এড়াতে উদাহরণটি ব্যবহার করুন।

Pointer, Enter বা Space সক্রিয় করলে দলের `attachment` ইভেন্ট হয়। Pill `click` পাঠায়। দৃশ্যের নিয়ন্ত্রণে `data-control` বা `id` হলো `controlId`; এগুলি `click`, `input` বা `change`, বর্তমান `value` এবং নামযুক্ত ইনপুটের সীমাবদ্ধ `values` পাঠায়। আসল UI ইভেন্টে `ev.origin === "user"`, নিয়ম-তৈরি ইভেন্টে `origin === "rule"`। ইভেন্টে বর্তমান `tabId`, `attachmentId` ও `item` থাকে। দৃশ্য নিয়মের কোড চালায় না; pill ও view-এর ইন্টারঅ্যাকশন কার্ডকে navigate করাও আটকায়। সংরক্ষিত তথ্যে callback বা executable code নেই; পুরনো pill revision বর্তমান সংযুক্তি চালাতে পারে না। Rule emit সাধারণ নিয়ম-লজিক, আর ব্রাউজার প্রকৃত click message আলাদাভাবে যাচাই করে।

সংযুক্তি browser profile-এ group/content/ID অনুযায়ী থাকে এবং পরবর্তী উপস্থিতি, navigation, restart ও Run-এর পর ফেরে। Disable করলে ডেটা রেখে লুকায়; enable করলে ফের দেখায়। দল মুছলে সংযুক্তিও মুছে যায়। Linked group আলাদা; browser/device-এ স্বয়ংক্রিয় sync নেই। পরিচিত YouTube, Reddit, X ও Bilibili কনটেন্ট platform ID পায়; অন্য কনটেন্টে সতর্কভাবে normalize করা URL ব্যবহৃত হয়, তাই সমর্থিত page markup অনুযায়ী পাওয়া যায়।

সীমা: group/content প্রতি 8টি, এক কনটেন্টে সব group মিলে 32টি, group প্রতি 10000টি content entry এবং serialized attachment document 8MB। সীমা ছাড়ালে `attachment-item-limit` বা `attachment-storage-limit` দিয়ে নতুন পরিবর্তন প্রত্যাখ্যান হয়; পুরনো ডেটা থাকে। Dispatch লেখাগুলি একত্র করে; একই spec হলে store পুনর্লিখে না। সংযুক্তি browser content UI, Safari-এর native rule engine-সহ; Mac app rule-এর browser content handle বা in-app attachment surface নেই।

```javascript
(on, v) => {
  on("items", ({data}) => {
    for (const item of data.items) {
      if (item.attachments && !item.attachments.note) {
        v.attach(data.tabId, item, "note", {
          type: "pill", text: "Review this", tone: "blue"
        });
      }
    }
  });
  on("attachment", ({data}) => {
    if (data.attachmentId === "note") {
      v.log("Review clicked", data.item.contentId);
    }
  });
}
```

`code-manual/generic-example.js` চালানো যায় এমন policy উদাহরণ। এতে record, AI call, user-origin feedback, compare-and-swap, HTML control, item verdict ও rule-owned usage report ব্যবহৃত হয়েছে; এগুলি উদাহরণ কোডের আচরণ, record বা attachment store-এর বিশেষ সুবিধা নয়।
