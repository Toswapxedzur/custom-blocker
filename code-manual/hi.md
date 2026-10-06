# Vault ब्राउज़र एक्सटेंशन कोड मैनुअल

[उपयोगकर्ता मैनुअल](../manual/hi.md)

## नियम अनुबंध

स्रोत: एक function expression `(on, v) => { ... }`। केवल synchronous JavaScript और नीचे दिया API समर्थित है; timer, network, extension API या सीधे DOM तक पहुँच नहीं। समय-आधारित नियम `ev.now` और events का उपयोग करते हैं।

- संपादन draft सहेजता है; **Run** नियम सक्रिय कर समूह सक्षम करता है। फ़्रीज़ समूह Run नहीं कर सकते। खाली source नियम unload करता है।
- सफल Run handlers और panels बदलता है तथा `v.state` बचाए रखता है। Compile/registration विफल होने पर पिछला नियम रहता है; timeout इसे रोक सकता है। Engine reload होने पर अंतिम सक्रिय source फिर register होता है; closure variables reset होते हैं।
- Registration state शुरू कर सकता है, handlers register कर सकता है, panels दिखा और log कर सकता है। Page/file actions और emits handlers में होने चाहिए; registration के समय की queue छोड़ दी जाती है।
- Disable handlers रोकता है और managed panels, sheets, covers और item verdicts हटाता है। Enable रखे हुए panels/sheets लौटाता है और items फिर माँगता है। Run मौजूदा sheets, covers या item verdicts नहीं मिटाता। Delete नियम और उसका state/effects हटाता है। Navigation, DOM बदलाव और file writes वापस नहीं होते।
- Events सामान्य group targets से सीमित नहीं होते; नियम में URL/items फ़िल्टर करें। Actions queue होते हैं और dispatch के बाद लागू होते हैं। Exception handler रोकता है, state/actions वापस नहीं करता; अगले handlers चल सकते हैं। File/query events के अलावा action acknowledgment नहीं है।

## साझा API

- `on(type, handler)` → boolean। `handler(ev)` register करता है; कई handlers registration order में चलते हैं। False का अर्थ invalid arguments या handler limit पूरा। `ev = { type: string, now: number, data }`; `now` Unix milliseconds है।
- `v.state`: mutable JSON object, event dispatch के बाद सहेजा जाता है। मौजूदा state को बदलने के बजाय missing fields initialize करें। Non-object या array देने पर `{}` होता है; nonserializable/अत्यधिक बड़ा update सहेजा नहीं जाता।
- `v.log(...values)`: इस group के Log का एकमात्र स्रोत। Logs/Clear प्रति group अलग हैं। Load errors Run status में दिखते हैं; handler diagnostics Log नहीं भरते।
- `v.emit(type, data)`: मौजूदा event के बाद इस group के handlers के लिए `data` की JSON copy queue करता है, नए `now` के साथ; यह synchronous call नहीं है।
- `v.panel(id, spec, tabId?)`: group का नामित panel बदलता है; सभी उपलब्ध web pages के लिए `tabId` छोड़ें या integer tab ID दें। Null `spec` हटाता है। Panels देखें।
- `v.file(op, path, payload?)` → request ID string। Files देखें।

अन्य साझा calls `undefined` लौटाते हैं। ID/state एक group के हैं, display name के नहीं।

## ब्राउज़र events

नीचे payload notation type बताता है, executable code नहीं। `?` वैकल्पिक fields दर्शाता है।

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

- `tick` अनुमानित है; tick count नहीं, timestamp उपयोग करें। `active` का अर्थ browser window में चुना हुआ है, यह नहीं कि उपयोगकर्ता देख रहा है। URL खाली/प्रतिबंधित हो सकते हैं।
- `visible` उपलब्ध और न छिपे pages से आता है; `elapsedMs` उनका अंतिम heartbeat बीतने के बाद का समय है, cover होने पर शून्य। यह कुल उपयोग या playback time नहीं।
- `items` नए/बदले supported feed items बताता है और Run/re-enable के बाद फिर भेजता है। `ref` उस page का card पहचानता है, स्थायी content ID नहीं; `ref === "page"` page को दर्शाता है। Title/URL/author खाली हो सकते हैं। `authors` में platform-specific source ID हैं।
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

प्रति event/group: 256 queued actions, 200 log calls, 64 emits; अतिरिक्त drop होते हैं। प्रति rule: 1000 handlers, 24 panels; हर control list में 32 entries और हर choice में 64 options; अतिरिक्त ignore/truncate। Emit chains 16 generations पर रुकते हैं। Serialized state limit 65536 JavaScript string characters। Registration और event के संयुक्त handlers 1 second से कम रखें; बार-बार अधिक समय या hard timeout rule को Run तक रोकता है। Log प्रति group 200 entries रखता है, 50/sec स्वीकारता है और लंबे संदेश लगभग 4096 characters पर काटता है। Timers/replies best-effort हैं, real-time guarantee नहीं।

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
