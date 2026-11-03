# Vault ब्राउज़र एक्सटेंशन कोड मैनुअल

[उपयोगकर्ता मैनुअल](../manual/hi.md)

## नियम अनुबंध

स्रोत: एक function expression `(on, v) => { ... }`। केवल synchronous JavaScript और नीचे दिया API समर्थित है; JavaScript के scheduling callbacks, network, extension API या सीधे DOM तक पहुँच नहीं है। समय-आधारित नियम नीचे दिए प्रबंधित timer/tracker या `ev.now` और events का उपयोग करते हैं।

- संपादन draft सहेजता है; **Run** नियम सक्रिय कर समूह सक्षम करता है। फ़्रीज़ समूह Run नहीं कर सकते। खाली source नियम unload करता है।
- सफल Run handlers और panels बदलता है तथा `v.state` बचाए रखता है। Compile/registration विफल होने पर पिछला नियम रहता है; timeout इसे रोक सकता है। Engine reload होने पर अंतिम सक्रिय source फिर register होता है; closure variables reset होते हैं।
- Registration state शुरू कर सकता है, handlers register कर सकता है, panels दिखा और log कर सकता है। Page/file actions और emits handlers में होने चाहिए; registration के समय की queue छोड़ दी जाती है।
- Disable handlers रोकता है और managed panels, sheets, covers और item verdicts हटाता है। Enable रखे हुए panels/sheets लौटाता है और items फिर माँगता है। Run मौजूदा sheets, covers या item verdicts नहीं मिटाता। Delete नियम और उसका state/effects हटाता है। Navigation, DOM बदलाव और file writes वापस नहीं होते।
- Events सामान्य group targets से सीमित नहीं होते; नियम में URL/items फ़िल्टर करें। Actions queue होते हैं और dispatch के बाद लागू होते हैं। Exception handler रोकता है, state/actions वापस नहीं करता; अगले handlers चल सकते हैं। File/query events के अलावा action acknowledgment नहीं है।

## साझा API

- `on(type, handler)` → boolean। `handler(ev)` register करता है; कई handlers registration order में चलते हैं। False का अर्थ invalid arguments या handler limit पूरा। `ev = { type: string, now: number, origin: "host" | "user" | "rule", data }`; `now` Unix milliseconds है। वास्तव में दिखे control event में `origin: "user"` और `v.emit` event में `origin: "rule"` होता है।
- `v.state`: mutable JSON object, event dispatch के बाद सहेजा जाता है। मौजूदा state को बदलने के बजाय missing fields initialize करें। Non-object या array देने पर `{}` होता है; nonserializable/अत्यधिक बड़ा update सहेजा नहीं जाता।
- `v.log(...values)`: इस group के Log में लिखता है। Handler errors और रिपोर्ट किए गए page-action errors भी यहाँ दिखते हैं; रिपोर्ट करने से actions दोबारा नहीं चलते। Logs/Clear हर group के लिए अलग हैं। Load errors Run status में दिखते हैं।
- `v.emit(type, data)`: मौजूदा event के बाद इस group के handlers के लिए `data` की JSON copy queue करता है, नए `now` के साथ; यह synchronous call नहीं है।
- `v.panel(id, spec, tabId?)`: group का नामित panel बदलता है; सभी उपलब्ध web pages के लिए `tabId` छोड़ें या integer tab ID दें। Null `spec` हटाता है। Panels देखें।
- `v.file(op, path, payload?)` → request ID string। Files देखें।
- `v.store(request)` अनुरोध ID लौटाता है; समूह रिकॉर्ड देखें।

नीचे दी गई नामित प्रबंधित समय-ऑब्जेक्ट बनाने वाली factories को छोड़कर अन्य साझा calls `undefined` लौटाती हैं। ID/state एक group के हैं, उसके display name के नहीं।

## प्रबंधित टाइमर और चलती समय-सीमा का उपयोग

`v.timer(id, {direction:"down", durationMs:300000})` एक नामित countdown बनाता है या मौजूदा countdown लौटाता है, जो शुरुआत में paused होता है। Count-up timer के लिए `{direction:"up"}` इस्तेमाल करें। Handle में `start()`, `pause()`, `resume()`, `reset()` और `snapshot()` हैं। Start/resume को बार-बार बुलाने से अतिरिक्त असर नहीं होता; reset समय को शून्य elapsed वाली paused स्थिति में लौटाता है। Snapshot fields में `ready`, `error`, `elapsedMs`, `remainingMs` (count-up के लिए null), `running` और `completed` शामिल हैं।

चलते timer app/browser बंद होने या rule disabled होने पर भी घड़ी के वास्तविक समय के अनुसार आगे बढ़ते हैं। पूरा हुआ countdown हर timer incarnation और generation के लिए हर member का rule अगली बार चलने पर एक बार `timerEnded` के साथ `{id, direction, durationMs, generation, incarnation}` देता है; Run इसे फिर नहीं देता। Delivery host events पर निर्भर है; यह real-time alarm नहीं है। मौजूदा text control से दिखाने के लिए panel में `{type:"timer", timerId:"focus", label:"Focus"}` रखें।

`v.rolling(id, {windowMs:3600000, limitMs:600000})` एक नामित सक्रिय उपयोग tracker बनाता है या मौजूदा tracker लौटाता है। `assign({websites:["youtube.com","reddit.com"], apps:[]})` इस member के target assignments बदल देता है। Native rules इसके बदले platform app IDs दे सकते हैं। Domains में subdomains भी शामिल हैं। एक tracker अपने सभी targets का उपयोग मिलाकर गिनता है; अन्य IDs की allowance स्वतंत्र होती है। `snapshot()` से `ready`, `error`, `usedMs`, `remainingMs`, `available` और `nextReturnAtMs` (अगला millisecond जब कोई दर्ज उपयोग expire होगा) मिलते हैं। Target दिए जाने पर `available(target?)` assignment भी जाँचता है। `reset()` इस object का history मिटाता है।

Allowance से अधिक उपयोग समेत सभी देखे गए पात्र उपयोग गिने जाते हैं; tracker स्वयं page/app block नहीं करता। दिखाई दे रहे pages के overlapping intervals एक बार गिने जाते हैं और native apps में देखा गया foreground उपयोग गिना जाता है। Disabled rules नया उपयोग नहीं जोड़ते; history फिर भी interval की सटीक सीमाओं पर expire होता रहता है। Availability तभी लौटती है जब बची हुई history का उपयोग limit से नीचे हो। Heartbeat samples अधिकतम पाँच सेकंड के होते हैं; shutdown/disabled gaps से काल्पनिक activity नहीं बनती। उपयोगकर्ता के emit किए events उपयोग नहीं जोड़ते।

Linked custom groups में समान object IDs एक स्थानीय native hub के नियंत्रण को साझा करते हैं। Linking tracker history और assignments मिलाता है और linking शुरू करने वाले timer की state रखता है; असंगत configurations linking अस्वीकार करते हैं। हर member को अपना completion event मिलता है। Disconnect होने पर fresh authoritative जानकारी लौटने तक shared trackers unavailable होते हैं और timer controls अस्वीकार होते हैं। Unlink पर हर member अंतिम shared usage और timer state रखता है, अपने targets वापस पाता है और पुराने link के commands छोड़ देता है। लौटने वाला member अंतिम snapshot save करके acknowledgement देने तक hub उसे रखता है; नया link उपलब्ध होने से पहले pending handovers पूरे होते हैं।

नामित objects Run और restart के बाद भी आरक्षित `v.state.$vaultTime` में रहते हैं; उस field को सीधे edit न करें। साफ़ तौर पर हटाने के लिए `v.removeTime(id)` इस्तेमाल करें। IDs में 1–80 ASCII अक्षर, अंक, `_` या `-` हो सकते हैं; आरक्षित property names अस्वीकार होते हैं। अधिकतम 32 objects rule की 64KiB UTF-8 state limit साझा करते हैं। Duration पूर्णांक millisecond में, अधिकतम 365 दिन है। Rolling history में अधिकतम 1024 minute buckets और 2048 merged intervals होते हैं। History capacity errors tracker को स्पष्ट reset तक unavailable रखते हैं; invalid configurations और oversized saves त्रुटियाँ बताते हैं, saved data मिटाते नहीं हैं।

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

## ब्राउज़र events

नीचे payload notation type बताता है, executable code नहीं। `?` वैकल्पिक fields दर्शाता है।

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

- `tick` अनुमानित है; tick count नहीं, timestamp उपयोग करें। `active` का अर्थ browser window में चुना हुआ है, यह नहीं कि उपयोगकर्ता देख रहा है। URL खाली/प्रतिबंधित हो सकते हैं।
- `visible` उपलब्ध और न छिपे pages से आता है; `elapsedMs` उनका अंतिम heartbeat बीतने के बाद का समय है, cover होने पर शून्य। यह कुल उपयोग या playback time नहीं।
- `items` (`platform: "web"` पहचानी गई साइटों के बाहर) नए/बदले supported feed items बताता है और Run/re-enable के बाद फिर भेजता है। `ref` उस page का card पहचानता है, स्थायी content ID नहीं; `ref === "page"` page को दर्शाता है। Title/URL/author खाली हो सकते हैं। `authors` में platform-specific source ID हैं।
- Platform IDs: `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`, `reddit`, `discord`, `twitter`, `bluesky`, `threads`, `substack`, `bilibili`, `rumble`, `pinterest`, `kick`, `tumblr`, `peertube`, `pixelfed`, `kuaishou`। Items उपलब्ध होना page के supported markup पर निर्भर है।
- Tags के लिए connected desktop वर्गीकारक और tagging-सक्षम build/platform चाहिए (Chromium और Safari: YouTube, Reddit, Bilibili, X/`twitter`)। Confidence 1–5 है। `tagsSettled === false` pending/unavailable है, untagged नहीं; settled `tags: []` untagged है।
- `snooze` का अर्थ group का Snooze button दबाया गया। यह अपने आप pause नहीं करता।
- Query/file replies अनुरोध करने वाले group को मिलते हैं। `requestId` मिलाएँ, `error`/`ok` जाँचें और ticks से deadline रखें: page बंद, engine reload या group disable होने पर reply खो सकते हैं। Run के बाद request IDs दोहर सकते हैं; pending requests स्थायी काम नहीं हैं।

## ब्राउज़र actions

Integer `tabId` किसी event से आना चाहिए। Page actions के लिए Vault-accessible page चाहिए; browser के आंतरिक pages उपलब्ध नहीं। Invalid inputs/unavailable targets का आम तौर पर कोई असर नहीं होता।

- `v.item(tabId, ref, verdict)`: `"hide"` feed card हटाता है, `"dim"` उसका media ढकता है, `"allow"` lower groups से छूट देता है, `null` इस group का verdict मिटाता है। अज्ञात refs कुछ नहीं करते; `v.cover` उपयोग करें यदि `isPage` हो। Verdict group-list order से चलते हैं: ऊपर का hide जीतता है; ऊपर का dim नीचे के allow के बाद भी रहता है; allow नीचे के verdict रोकता है। Recycled/हटाए card पर नया निर्णय चाहिए।
- `v.cover(tabId, on, message?)`: true page ढकता है, false custom cover हटाता है; message डिफ़ॉल्ट खाली (अधिकतम 500 characters)। प्रति page एक custom-cover slot; group order की परवाह किए बिना अंतिम cover call जीतता है। Address बदलने पर हटता है; सामान्य blocking फिर भी page ढक सकती है।
- `v.go(tabId, target)`: HTTP(S) URL या `"back"`, `"forward"`, `"reload"` (target अधिकतम 4096 characters)।
- `v.close(tabId)`: tab बंद करता है।
- `v.css(tabIdOrStar, id, css)`: integer tab ID या `"*"`; उस ID की group sheet बदलता है या null से हटाता है। Address बदलने पर tab sheets समाप्त; `"*"` sheets आगे के pages पर भी लागू होती हैं। ID अधिकतम 80, CSS 100000 characters।
- `v.dom(tabId, selector, op, arg?)`: CSS selector (अधिकतम 1000); सभी matches पर, `scrollTo` पहले पर। Ops: `hide` inline `display:none!important` लगाता है; `show` inline display हटाता है; `click`; `setText` text को `arg` से बदलता है; `addClass`/`removeClass` एक class name लेते हैं; `scrollTo` view में लाता है। arg max 2000। बदलाव reverse/page replacement तक रहते हैं।
- `v.query(tabId, selector)` → request ID string, invalid arguments पर null। बाद के `query` event में परिणाम: 50 तक matches, lowercase `tag`, अधिकतम 1000-character normalized text, 2000-character attributes, 1000-character value। कोई match न हो तो successful `[]`; invalid CSS पर `error: "invalid-selector"`। Vault receiver न हो तो page उत्तर न भी दे।

## Panels

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

Defaults: bottom-right position; vertical layout; left align; region role; content-sized width। Preset width 220/280/360px; numeric panel width 180–520px तक सीमित। Control width 32–520px, height 20–360px। Numeric sizes pixel strings भी स्वीकारते हैं। Vertical variants spacing बदलते हैं; inline/row wrap नहीं; wrap/toolbar wrap; twoColumn/grid/split/form grid; stack spacing कम करता है। Role accessibility semantics देता है, modal blocking नहीं।

IDs ASCII letters/digits/`_`/`-` में normalize (max 80); unique stable IDs चुनें। Omitted control ID `control-N`, omitted/unknown type text बनता है। Omitted text/lists खाली; disabled false। `v.panel` पूरी spec बदलता है। Omitted `value` पिछली control event value फिर type normalization लेता है; explicit `value` उसे override करता है। Autofocus default false। Unknown fields discard; rule-supplied panel colors/fonts/CSS समर्थित नहीं।

Control fields और values:

- `text`: `text` string; default label। `html`: `html` string; scripts, event attributes, dangerous URLs और styling हटती है।
- `button`: `label`, optional `action: "submit" | "cancel" | "close"`; value string (default खाली)। Actions events भेजते हैं; अपने आप submit/close नहीं करते।
- `checkbox`, `toggle`: boolean `value` (default false)।
- `select`, `radio`: `options: (string | { value: string, label?: string })[]`; string value (default खाली)। Empty options हटते हैं; labels default value।
- `textInput`, `textarea`: string value (default खाली), `placeholder`; textarea `rows` 1–12 (default 3)।
- `numberInput`, `range`: numeric value (default 0), `min`, `max`, positive `step`। Panel update में values bounds तक सीमित; unspecified normalization bounds −1000000…1000000। Range widgets default 0…100; explicit bounds दें।
- `date`: string `YYYY-MM-DD`; `time`: `HH:MM` या `HH:MM:SS`; invalid initial formats खाली होते हैं। Edits स्वयं जाँचें। `color`: `#RRGGBB` (default `#000000`)।
- `pin`: digit string; `length` 3–12 (default 6), `masked` default true, `autoSubmit` false। `section`: `text`, `controls`, optional layout/align/role (role default group); depth 3 child section में child नहीं (root controls depth 0)।

Panel events: input controls `input`/`change` भेजते हैं (text input blur/Enter पर; textarea blur/Ctrl-or-Cmd+Enter पर बदलता है)। सामान्य controls `focus`, `blur`, `key` भी भेजते हैं; key metadata rule को नहीं मिलता। Buttons `click` **और** configured action अलग-अलग भेजते हैं—एक संभालें। PIN `change`, autoSubmit पूरा होने पर `submit` भेजता है। Mount/unmount में `controlId: ""`, `value: true`। `values` में ID के अनुसार मौजूदा input values हैं; button/text/HTML नहीं। Event में originating tab ID नहीं; tab-specific interaction के लिए अलग panel ID उपयोग करें।

Text limit: title/label/ariaLabel 240; description/text 1000; HTML 20000; placeholder 500; input text 2000; अन्य value strings 512; option value/label 256। अतिरिक्त काटा जाता है।

## Files

`op`: `"read"`, `"write"`, `"append"`, `"list"`, `"exists"`। Settings में **Custom-rule folder** और permission चाहिए। Safari native folder picker और retained security-scoped grant उपयोग करता है; केवल चुना folder उपलब्ध है।

- `path` relative है; `/` directories अलग करता है। Segments में ASCII letters/digits, spaces और `_.,@()-` अनुमत; leading dot, `.`/`..`, absolute path या URL नहीं। File suffix `.txt`, `.csv`, `.json` (case-insensitive)। List path directory है; `""` चुना root दिखाता है। चुने folder से बाहर जाने वाले paths, symlink के जरिए भी, अस्वीकार हैं।
- Read UTF-8 text लौटाता है। Write replace/create; append बिना अपने आप newline जोड़े append/create करता है। Write पर parent directories बनती हैं। String payload जैसा है वैसा लिखा जाता है; अन्य JSON payload serialize होते हैं; null/omitted का अर्थ खाली text। JSON/CSV parsing rule का काम। Max file size 1048576 UTF-8 bytes।
- List सीधे दिखने वाले subdirectories और supported files लौटाता है। Entries: `{ name: string, path: string, kind: "directory" | "file", extension?: string }`; file extension में dot शामिल है। Exists supported file path के लिए boolean लौटाता है।

```text
file.data = { requestId: string, op: string, path: string, ok: boolean,
              text: string | null, entries: Entry[] | null,
              exists: boolean | null, error: string }
```

Unused result fields null; success में error खाली। Failures में invalid-path, unsupported-file-type, permission/folder unavailable, missing file, file-too-large शामिल। error को string मानें, fixed exhaustive enum नहीं। Requests में transaction/order guarantee नहीं; प्रति path read-modify-write serialize करें।

## सीमाएँ

प्रति event/group: 256 queued actions, 200 log calls, 64 emits; अतिरिक्त drop होते हैं। प्रति rule: 1000 handlers, 24 panels; हर control list में 32 entries और हर choice में 64 options; अतिरिक्त ignore/truncate। Emit chains 16 generations पर रुकते हैं। Serialized state limit 65536 UTF-8 bytes। Registration और event के संयुक्त handlers 1 second से कम रखें; बार-बार अधिक समय या hard timeout group को Run तक रोकता है। Log प्रति group 200 entries रखता है, 50/sec स्वीकारता है और लंबे संदेश लगभग 4096 characters पर काटता है। Timers/replies best-effort हैं, real-time guarantee नहीं।

## पूरा नियम

Snooze या उसके panel button से शुरू होने वाला पाँच मिनट का विराम:

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


## चलते नियम से AI कॉल

हर custom group **AI calls** में एक connection/model और reasoning effort चुनता है। Mac/browser rules वही API इस्तेमाल करते हैं; browser request के लिए Mac Vault connected होना चाहिए और provider credentials वहीं रहते हैं। Linked groups चयन और optional daily request cap साझा करते हैं। Blank का अर्थ group cap नहीं, account limits फिर भी लागू। Cap UTC day से जुड़ा है, restart के बाद रहता है और failures सहित submitted attempts गिनता है। Link पुराने usage को जोड़ता है; unlink पुराना usage रखता है।

सहेजे गए prompt और context linked groups में साझा होते हैं और handlers में `v.context.ai.prompt` तथा `v.context.ai.context` के रूप में उपलब्ध हैं। Vault इन्हें अपने आप नहीं भेजता; हर `v.ai` call में क्या शामिल हो, rule तय करता है।

`v.ai({ prompt, input? })` तुरंत request ID देता है। इसे handler के भीतर call करें, rule register करते समय नहीं। `input` कोई JSON value हो सकता है; prompt/input प्रत्येक अधिकतम20KB। Reply `ai` events: `. Success text is at most48KB; citations are ` `ask` `note` events में आता है: {requestId, ok, text, citations, error}। सफल text अधिकतम48KB; citation {url,title}। Web search आधारित उत्तर दिखाते समय source links दिखने योग्य और clickable रखें। Search model के लिए हमेशा उपलब्ध है। निश्चित app deadline नहीं, concurrency bounded है; provider fallback/automatic retry नहीं। Response data है, JavaScript के रूप में execute नहीं; कौन-सी existing action लेनी है rule तय करता है।

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

Outstanding calls restart के बाद replay नहीं होते। Run, disable/re-enable और delete पुराने replies discard करते हैं; disconnected browser `ai-unavailable` देता है। अन्य errors: `ai-not-configured`, `ai-invalid-input`, `ai-busy`, `ai-daily-limit`, `ai-request-failed`, `ai-usage-storage-unavailable`। Failed calls rule द्वारा रखे पिछले result को नहीं बदलते। Rule state की सीमा64KB ही है।

Credential-free choices Mac पर `rule_ai_models` या browser पर `settings-rule-ai-models` से खोजें; मौजूदा set-group path के जरिए `ruleAI` configure करें। Fields: `providerModel`, `accountID`, `reasoningEffort` (`default`, `low`, `medium`, `high`) और `dailyRequestLimit` (null या1–100000)। लौटाया choice उपयोग करें; rule source में key/provider URL न डालें।
वैकल्पिक सहेजे गए fields `prompt` और `context` हैं; दोनों अधिकतम16KB के string हैं।

## समूह रिकॉर्ड

`v.store(request)` handler के अंदर asynchronous JSON record operation शुरू करता है। Record group के निजी होते हैं, Run/restart के बाद बने रहते हैं और group हटाने पर हटते हैं। Linked groups का store अलग है। Keys, values, version, cache invalidation और feedback precedence rule चुनता है। Mac और browser rules वही API उपयोग करते हैं, पर हर app/browser store अलग है।

| Request | Result |
|---|---|
| `{op:"get", key}` | `record` या `null` |
| `{op:"put", key, value, version?, ifRevision?}` | saved `record` |
| `{op:"delete", key, ifRevision?}` | `record: null` |
| `{op:"list", prefix?, after?, limit?}` | sorted `entries` और `next` |
| `{op:"clear", prefix?}` | `deleted` count |

Record `{value, revision, version, updatedAt}` होता है। वास्तविक write पर opaque revision बदलता है; `version` caller metadata है। `list` बिना values के headers लौटाता है; एक record पढ़ने को `get`, अगले page के लिए `after: next` `put` `delete` उपयोग करें। `ifRevision` के बिना put/delete unconditional है; `null` के लिए key अनुपस्थित होनी चाहिए, revision string के लिए exact match। Mismatch में `ok:false`, `error:"store-conflict"` और current `record` लौटते हैं। इससे देर से आया automatic reply user feedback को overwrite नहीं करता। `v.context.revision` opaque rule-configuration marker है, जिसे rule अपने version में शामिल कर सकता है; framework cache नीति नहीं लगाता।

सीमाएं: key 1–2048 अक्षर, version ≤128, JSON value ≤64KiB, depth ≤32, प्रति group 10000 keys और पूरे record document की सीमा16MiB। `list` प्रत्येक page में अधिकतम100 headers और96KiB देता है। प्रति group 32 requests और कुल128 request starts/second; overload में प्रति group/second एक `store-busy` error आता है और बाकी requests drop होते हैं। Storage errors में `ok:false`; future/malformed document सुरक्षित रहता है और `store-unavailable` मिलता है। Auto retry/eviction नहीं। Deadline के लिए ticks उपयोग करें।

## सहेजे गए सामग्री अटैचमेंट

देखी गई सामग्री के लिए pill या निष्क्रिय HTML/CSS view को `v.attach(tabId, item, id, spec)` से सहेजें। पूरा `item`, `items` या `attachment` event से दें; केवल `ref` अटैचमेंट हैंडल नहीं है। `contentId` सहेजी सामग्री और `instanceId` उसकी मौजूदा उपस्थिति बताता है। AI के उत्तर की प्रतीक्षा में वही मूल हैंडल रखें। हटाए, दोबारा उपयोग किए या नेविगेट किए लक्ष्य पर देर से अटैचमेंट अस्वीकार होगा। `v.item(tabId, ref, verdict)` अलग व्यवहार रखता है।

Pill के लिए `spec` `{type:"pill", text, tone?, tooltip?}` है; tone `blue`, `cyan`, `gold`, `pink` या `red` हो सकता है। साधारण text 240 और tooltip 1000 अक्षरों तक है। View के लिए spec `{type:"html", html, css?, label?}` है। सीमा: HTML 32000, CSS 16000 और label 200 अक्षर। View अनुमत निष्क्रिय HTML/SVG से बंद shadow root और सीमित CSS में फिर बनाया जाता है। Script, event attribute, remote resource, embed और असुरक्षित CSS हटते हैं। View content card के भीतर रहता है और 480px ऊँचाई पर scroll होता है। ID 1–80 ASCII अक्षर/अंक, _ या - के होते हैं। null spec समूह का pill हटाता है। Handler में कॉल करें; persistence/delivery त्रुटियाँ Log में आती हैं, स्वतः retry नहीं होता।

हर item इस समूह के attachments को read-only snapshot के रूप में `item.attachments` में देता है; अन्य समूह के attachments इसमें नहीं होते। सहेजा डेटा उपलब्ध न हो तो `attachments` null और `attachmentError` सेट होता है; इसका अर्थ खाली cache नहीं। दूसरे handler चलते रहते हैं। पहले से सहेजे परिणाम के लिए AI फिर न बुलाने हेतु उदाहरण देखें।

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

Pointer, Enter या Space सक्रिय करने से समूह का `attachment` event आता है। Pill `click` भेजता है। View controls में `data-control` या `id`, `controlId` बनता है; वे `click`, `input` या `change`, वर्तमान `value` और नामित controls के सीमित `values` भेजते हैं। असली UI event में `ev.origin === "user"`, rule event में `origin === "rule"` होता है। Event में `tabId`, `attachmentId` और मौजूदा `item` आते हैं। View rule code नहीं चलाता; pill और view की क्रिया underlying card को navigate होने से रोकती है। सहेजे डेटा में callback या executable code नहीं होता; पुराना pill revision मौजूदा attachment नहीं चला सकता। Rule emit सामान्य logic है और browser वास्तविक click संदेश अलग से जाँचता है।

Attachment इस browser profile में group/content/ID के अनुसार सहेजे जाते हैं और आगे मिलने, navigation, browser restart और Run के बाद लौटते हैं। Disable छिपाता है और डेटा रखता है; enable फिर दिखाता है। Group हटाने से उसके attachments हटते हैं। Linked groups अलग रहते हैं; browser/device sync स्वतः नहीं होता। ज्ञात YouTube, Reddit, X और Bilibili सामग्री platform ID लेती है। अन्य सामग्री सावधानी से normalized URL लेती है, इसलिए समर्थन page markup पर निर्भर है।

सीमा: प्रति group/content 8, सभी groups में प्रति item 32, group में 10000 content entries और serialized attachment document 8MB। सीमा आने पर `attachment-item-limit` या `attachment-storage-limit` के साथ नया बदलाव Log में अस्वीकार होता है; पुराना डेटा सुरक्षित रहता है। Dispatch writes को batch करता है; समान spec storage नहीं लिखता। Attachment browser content UI है, Safari native rule engine सहित। Mac app rules के पास browser content handles या app के भीतर attachment surface नहीं है।

`code-manual/generic-example.js` निष्पादन योग्य policy उदाहरण है। इसमें records, AI calls, user-origin feedback, compare-and-swap, HTML controls, item verdicts और rule-owned usage report हैं; ये व्यवहार उदाहरण कोड में हैं, store की विशेष सुविधा नहीं।
