# Vault ব্রাউজার এক্সটেনশন কোড নির্দেশিকা

[ব্যবহারকারী নির্দেশিকা](../manual/bn.md)

## নিয়মের শর্ত

উৎস: একটি function expression `(on, v) => { ... }`। শুধু synchronous JavaScript ও নিচের API সমর্থিত; timer, network, extension API বা সরাসরি DOM অ্যাক্সেস নয়। সময়নির্ভর নিয়মে `ev.now` ও event ব্যবহার করুন।

- সম্পাদনা draft সংরক্ষণ করে; **Run** নিয়ম সক্রিয় করে এবং গ্রুপ চালু করে। ফ্রিজ করা গ্রুপ Run করা যায় না। ফাঁকা source নিয়ম unload করে।
- সফল Run handler ও panel প্রতিস্থাপন করে এবং `v.state` অক্ষত রাখে। Compile/registration ব্যর্থ হলে আগের নিয়ম থাকে; timeout নিয়ম থামাতে পারে। Engine reload হলে শেষ সক্রিয় source আবার register হয়; closure variable reset হয়।
- Registration-এ state initialize, handler register, panel দেখানো ও log করা যায়। Page/file action ও emit handler-এর মধ্যে রাখুন; registration সময়ের queue বাতিল হয়।
- Disable handler বন্ধ করে managed panel, sheet, cover ও item verdict তুলে দেয়। Enable সংরক্ষিত panel/sheet ফেরায় এবং item আবার চায়। Run আগের sheet, cover বা item verdict মুছে না। Delete নিয়ম, তার state ও প্রভাব সরায়। Navigation, DOM mutation ও file write ফেরানো হয় না।
- সাধারণ group target event সীমিত করে না; নিয়মে URL/item filter করুন। Action queue করে dispatch-এর পর প্রয়োগ হয়। Exception handler থামায়, কিন্তু তার state/action rollback করে না; পরের handler চলতে পারে। File/query event ছাড়া action acknowledgment নেই।

## যৌথ API

- `on(type, handler)` → boolean। `handler(ev)` নিবন্ধন করে; একাধিক handler নিবন্ধনের ক্রমে চলে। False মানে argument অবৈধ বা handler limit পূর্ণ। `ev = { type: string, now: number, data }`; `now` হলো Unix milliseconds।
- `v.state`: mutable JSON object, event dispatch শেষে সংরক্ষিত হয়। বিদ্যমান state না মুছে অনুপস্থিত field initialize করুন। Object নয় বা array দিলে `{}` হয়; serialize করা যায় না বা অতিরিক্ত বড় update সংরক্ষিত হয় না।
- `v.log(...values)`: এই group-এর Log-এর একমাত্র উৎস। Log/Clear প্রতি group আলাদা। Load error Run status-এ দেখা যায়; handler diagnostic Log-এ যোগ হয় না।
- `v.emit(type, data)`: বর্তমান event-এর পরে এই group-এর handler-এ `data`-র JSON copy queue করে, নতুন `now`-সহ; এটি synchronous call নয়।
- `v.panel(id, spec, tabId?)`: group-এর নামযুক্ত panel প্রতিস্থাপন করে; সব accessible web page-এর জন্য `tabId` বাদ দিন, অথবা integer tab ID দিন। Null `spec` panel সরায়। Panel অংশ দেখুন।
- `v.file(op, path, payload?)` → request ID string। Files অংশ দেখুন।

অন্য যৌথ call `undefined` ফেরায়। ID/state একটি group-এর, display name-এর নয়।

## Browser event

নিচের payload notation type বোঝায়, executable code নয়। `?` ঐচ্ছিক field চিহ্নিত করে।

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

- `tick` আনুমানিক; tick সংখ্যা নয়, timestamp ব্যবহার করুন। `active` মানে browser window-তে নির্বাচিত, ব্যবহারকারী দেখছেন তার প্রমাণ নয়। URL ফাঁকা বা সীমাবদ্ধ হতে পারে।
- `visible` accessible, non-hidden page থেকে আসে; `elapsedMs` তাদের শেষ heartbeat থেকে সময়, cover থাকলে শূন্য। এটি মোট ব্যবহার বা playback time নয়।
- `items` নতুন/পরিবর্তিত supported feed item জানায় এবং Run/re-enable-এর পরে আবার পাঠায়। `ref` page-এর card চিহ্নিত করে, স্থায়ী content ID নয়; `ref === "page"` মানে page নিজেই। title/URL/author ফাঁকা হতে পারে। `authors`-এ platform-specific source ID থাকে।
- Platform ID: `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`, `reddit`, `discord`, `twitter`, `bluesky`, `threads`, `substack`, `bilibili`, `rumble`, `pinterest`, `kick`, `tumblr`, `peertube`, `pixelfed`, `kuaishou`। Page-এর supported markup-এর ওপর item পাওয়া নির্ভর করে।
- Tag-এর জন্য connected desktop Classifier ও tagging-enabled build/platform দরকার (Chromium ও Safari: YouTube, Reddit, Bilibili, X/`twitter`)। Confidence 1–5। `tagsSettled === false` মানে pending/unavailable, untagged নয়; settled `tags: []` মানে untagged। Firefox build-এ এই tagging integration নেই।
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

প্রতি event প্রতি group: 256 queued action, 200 log call, 64 emit; অতিরিক্ত বাদ যায়। প্রতি rule: 1000 handler, 24 panel; control list-এ 32 entry, প্রতিটি choice-এ 64 option; অতিরিক্ত ignore/truncate হয়। Emit chain 16 generation-এ থামে। Serialized state limit 65536 JavaScript string character। Registration ও প্রতিটি event-এর combined handler 1 সেকেন্ডের মধ্যে রাখুন; বারবার বেশি সময় বা hard timeout হলে Run পর্যন্ত rule বন্ধ। Log প্রতি group-এ 200 entry রাখে, প্রতি সেকেন্ডে 50 গ্রহণ করে এবং দীর্ঘ বার্তা প্রায় 4096 character-এ কাটে। Timer/reply best-effort, real-time নিশ্চয়তা নয়।

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
