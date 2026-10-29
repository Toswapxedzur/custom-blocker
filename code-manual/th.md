# คู่มือโค้ดส่วนขยายเบราว์เซอร์ Vault

[คู่มือผู้ใช้](../manual/th.md)

## ข้อกำหนดของกฎ

แหล่งที่มา: function expression หนึ่งรายการ `(on, v) => { ... }` รองรับเฉพาะ synchronous JavaScript และ API ด้านล่าง ไม่มี JavaScript scheduling callbacks, network, extension APIs หรือการเข้าถึง DOM โดยตรง กฎที่อิงเวลาใช้ timer/tracker ที่จัดการโดยระบบด้านล่าง หรือ `ev.now` และ events

- การแก้ไขจะบันทึกเป็น draft; **Run** จะเปิดใช้และเปิดใช้กลุ่ม กลุ่มที่ตรึงไว้กด Run ไม่ได้ หาก source ว่าง กฎจะถูก unload\n- Run ที่สำเร็จจะแทนที่ handlers และ panels โดยเก็บ `v.state` ไว้ หาก compilation/registration ล้มเหลว จะคงกฎก่อนหน้าไว้ แต่ timeout อาจหยุดกฎได้ เมื่อ engine โหลดใหม่ จะ register source ที่เปิดใช้ล่าสุดอีกครั้ง ส่วน closure variables จะ reset\n- ระหว่าง registration อาจเริ่มต้น state, register handlers, แสดง panels และเขียน log ได้ การกระทำกับหน้า/ไฟล์และ emits ต้องอยู่ใน handlers; สิ่งที่ queue ไว้ระหว่าง registration จะถูกทิ้ง\n- Disable จะระงับ handlers และยกเลิก panels, sheets, covers และคำตัดสินต่อรายการที่จัดการไว้ Enable จะคืน panels/sheets ที่ยังเก็บไว้และขอรายการอีกครั้ง Run จะไม่ล้าง sheets, covers หรือคำตัดสินต่อรายการที่มีอยู่ Delete จะนำกฎ state และผลที่เกิดจากกฎออก การนำทาง การเปลี่ยน DOM และการเขียนไฟล์จะไม่ถูกย้อนกลับ\n- Events ไม่จำกัดตามเป้าหมายทั่วไปของกลุ่ม ให้กรอง URLs/items ในกฎ Actions จะถูก queue แล้วนำไปใช้หลัง dispatch หากเกิด exception handler นั้นจะหยุด แต่ state/actions ของมันไม่ย้อนกลับ; handlers ถัดไปอาจยังทำงาน ไม่มีการตอบรับ action ยกเว้น events จาก file/query

## API ที่ใช้ร่วมกัน

- `on(type, handler)` → boolean ลงทะเบียน `handler(ev)`; หลาย handlers จะทำงานตามลำดับที่ลงทะเบียน False หมายถึง arguments ไม่ถูกต้องหรือถึงขีดจำกัด handlers แล้ว `ev = { type: string, now: number, origin: "host" | "user" | "rule", data }`; `now` คือ Unix milliseconds เหตุการณ์ของตัวควบคุมที่แสดงจริงมี `origin: "user"`; เหตุการณ์ `v.emit` มี `origin: "rule"`.\n- `v.state`: JSON object ที่แก้ไขได้และบันทึกหลัง event dispatch ให้เริ่มค่าเฉพาะ fields ที่ยังไม่มี แทนการเขียนทับ state เดิม การกำหนด non-object หรือ array จะ reset เป็น `{}`; การอัปเดตที่ serialize ไม่ได้หรือใหญ่เกินไปจะไม่ถูกบันทึก\n- `v.log(...values)`: เขียนลงใน Log ของกลุ่มนี้ ข้อผิดพลาดของ handler และข้อผิดพลาดจากการทำงานบนหน้าที่มีการรายงานจะแสดงที่นี่ด้วย การรายงานจะไม่เรียก actions ซ้ำ Logs/Clear แยกกันในแต่ละกลุ่ม Load errors แสดงใน Run status\n- `v.emit(type, data)`: queue สำเนา JSON ของ `data` ให้ handlers ของกลุ่มนี้หลัง event ปัจจุบัน พร้อม `now` ใหม่; ไม่ใช่การเรียกแบบ synchronous\n- `v.panel(id, spec, tabId?)`: แทนที่ panel ที่ตั้งชื่อของกลุ่มนี้ ไม่ระบุ `tabId` เพื่อใช้กับทุกหน้าเว็บที่เข้าถึงได้ หรือใช้ tab ID จำนวนเต็ม หาก `spec` เป็น null จะนำ panel ออก ดูหัวข้อ Panels\n- `v.file(op, path, payload?)` → request ID string ดูหัวข้อ Files
- `v.store(request)` ส่งคืน ID คำขอ ดูบันทึกของกลุ่ม

Calls ที่ใช้ร่วมกันอื่น ๆ คืน `undefined` ยกเว้น factories สำหรับสร้างออบเจ็กต์เวลาที่จัดการโดยระบบแบบมีชื่อด้านล่าง IDs/state เป็นของแต่ละกลุ่ม ไม่ใช่ของชื่อที่แสดง

## ตัวจับเวลาที่จัดการโดยระบบและการใช้งานในช่วงเวลาเลื่อน

`v.timer(id, {direction:"down", durationMs:300000})` สร้างหรือคืน countdown แบบมีชื่อ ซึ่งเริ่มต้นในสถานะ paused ใช้ `{direction:"up"}` สำหรับ timer แบบนับขึ้น Handle มี `start()`, `pause()`, `resume()`, `reset()` และ `snapshot()` การเรียก start/resume ซ้ำไม่มีผลเพิ่มเติม ส่วน reset จะกลับสู่สถานะ paused โดยมีเวลาที่ผ่านไปเป็นศูนย์ Fields ใน snapshot มี `ready`, `error`, `elapsedMs`, `remainingMs` (เป็น null สำหรับการนับขึ้น), `running` และ `completed`

Timer ที่กำลังทำงานจะเดินตามเวลานาฬิกาจริงขณะ app/browser ปิดอยู่หรือ rule ถูกปิดใช้งาน Countdown ที่ครบเวลาจะส่ง `timerEnded` พร้อม `{id, direction, durationMs, generation, incarnation}` หนึ่งครั้งต่อ incarnation และ generation ของ timer ให้สมาชิกแต่ละรายเมื่อ rule ของรายนั้นทำงานครั้งถัดไป Run จะไม่ส่งซ้ำ การส่งขึ้นอยู่กับ host events จึงไม่ใช่นาฬิกาปลุกแบบ real-time ใส่ `{type:"timer", timerId:"focus", label:"Focus"}` ใน panel เพื่อแสดงผ่าน text control ที่มีอยู่

`v.rolling(id, {windowMs:3600000, limitMs:600000})` สร้างหรือคืน tracker การใช้งานจริงแบบมีชื่อ `assign({websites:["youtube.com","reddit.com"], apps:[]})` แทนที่การกำหนด targets ของสมาชิกรายนี้ Native rules สามารถกำหนด app IDs ของแพลตฟอร์มแทนได้ Domains รวม subdomains ด้วย Tracker หนึ่งตัวรวมการใช้งานของ targets ทั้งหมด ส่วน IDs อื่นมีโควตาแยกกัน `snapshot()` คืน `ready`, `error`, `usedMs`, `remainingMs`, `available` และ `nextReturnAtMs` (millisecond ถัดไปที่การใช้งานที่บันทึกไว้รายการใดรายการหนึ่งหมดอายุ) `available(target?)` ตรวจสอบการกำหนด target ด้วยเมื่อระบุ target ส่วน `reset()` ล้าง history ของออบเจ็กต์นี้

การใช้งานที่เข้าเกณฑ์และตรวจพบทั้งหมดจะถูกนับ รวมถึงส่วนที่เกินโควตา แต่ tracker ไม่ได้บล็อก page/app เอง ช่วงเวลาของหน้าที่มองเห็นซึ่งซ้อนทับกันจะนับเพียงครั้งเดียว และ native apps จะนับการใช้งาน foreground ที่ตรวจพบ Rules ที่ปิดใช้งานจะไม่เพิ่มการใช้งาน แต่ history ยังคงหมดอายุตามขอบเขต interval ที่แน่นอน Availability จะกลับมาเมื่อการใช้งานใน history ที่เหลือต่ำกว่า limit เท่านั้น Heartbeat samples จำกัดไว้ไม่เกินห้าวินาที ช่วงที่ปิดโปรแกรมหรือปิดใช้งานจะไม่สร้าง activity สมมติ Events ที่ผู้ใช้ emit เองจะไม่เพิ่มการใช้งาน

Object IDs เดียวกันใน custom groups ที่เชื่อมโยงกันใช้ native hub ภายในเครื่องเป็นแหล่งข้อมูลหลักร่วมกัน การเชื่อมโยงจะรวม history และการกำหนด targets ของ tracker และเก็บ timer state ของฝ่ายที่เริ่มเชื่อมโยง หาก configurations ไม่เข้ากันจะปฏิเสธการเชื่อมโยง สมาชิกแต่ละรายได้รับ completion event ของตนเอง เมื่อขาดการเชื่อมต่อ shared trackers จะ unavailable และปฏิเสธ timer controls จนกว่าจะได้รับข้อมูลล่าสุดจากแหล่งข้อมูลหลัก เมื่อ unlink สมาชิกแต่ละรายเก็บ shared usage และ timer state สุดท้าย คืน targets ของตนเอง และทิ้ง commands จาก link เดิม Hub เก็บ snapshot สุดท้ายจนกว่าสมาชิกที่กลับมาจะบันทึกและยืนยันการรับ โดยต้องดำเนินการ handover ที่ค้างอยู่ให้เสร็จก่อนจึงจะเชื่อมโยงใหม่ได้

ออบเจ็กต์แบบมีชื่อคงอยู่หลัง Run และ restart ใน field ที่สงวนไว้ `v.state.$vaultTime` อย่าแก้ไข field นี้โดยตรง ลบอย่างชัดเจนด้วย `v.removeTime(id)` IDs มีความยาว 1–80 ตัว ประกอบด้วยตัวอักษร ASCII ตัวเลข `_` หรือ `-` และไม่ยอมรับชื่อ properties ที่สงวนไว้ ออบเจ็กต์ได้สูงสุด 32 ตัวใช้ state limit ขนาด 64KiB UTF-8 ของ rule ร่วมกัน Durations เป็นจำนวนเต็ม millisecond สูงสุด 365 วัน Rolling history จำกัดไว้ที่ 1024 minute buckets และ 2048 merged intervals ข้อผิดพลาดความจุ history ทำให้ tracker unavailable จนกว่าจะ reset อย่างชัดเจน Configurations ที่ไม่ถูกต้องและการบันทึกที่ใหญ่เกินไปจะรายงานข้อผิดพลาดโดยไม่ลบข้อมูลที่บันทึกไว้

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

## Events ของเบราว์เซอร์

สัญกรณ์ payload ด้านล่างระบุชนิดข้อมูล ไม่ใช่โค้ดที่รันได้ `?` หมายถึง field ที่ไม่บังคับ

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

- `tick` เป็นค่าโดยประมาณ ให้ใช้ timestamps แทนการนับ ticks `active` หมายถึงหน้าที่ถูกเลือกในหน้าต่างเบราว์เซอร์ ไม่ได้ยืนยันว่าผู้ใช้กำลังดูอยู่ URLs อาจว่างหรือถูกจำกัดการเข้าถึง\n- `visible` มาจากหน้าที่เข้าถึงได้และไม่ถูกซ่อน `elapsedMs` คือเวลาตั้งแต่ heartbeat ล่าสุดของหน้านั้น และเป็นศูนย์ขณะถูกปิดทับ ไม่ใช่เวลาการใช้งานหรือเวลาเล่นที่สะสม\n- `items` (`platform: "web"` นอกไซต์ที่รู้จัก) รายงานรายการฟีดที่รองรับซึ่งเพิ่มหรือเปลี่ยนแปลง และส่งซ้ำหลัง Run/เปิดใช้ใหม่ `ref` ระบุการ์ดบนหน้านั้น ไม่ใช่ content ID ที่คงทน; `ref === "page"` หมายถึงตัวหน้าเอง titles/URLs/authors อาจว่างได้ `authors` มี source identifiers เฉพาะแพลตฟอร์ม\n- Platform IDs: `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`, `reddit`, `discord`, `twitter`, `bluesky`, `threads`, `substack`, `bilibili`, `rumble`, `pinterest`, `kick`, `tumblr`, `peertube`, `pixelfed`, `kuaishou` ความพร้อมของรายการขึ้นอยู่กับ markup ที่รองรับบนหน้า\n- Tags ต้องมี desktop Classifier ที่เชื่อมต่อและ build/platform ที่เปิดใช้การติดแท็ก (Chromium และ Safari: YouTube, Reddit, Bilibili, X/`twitter`) Confidence มีค่า 1–5 `tagsSettled === false` หมายถึงกำลังรอ/ไม่พร้อม ไม่ใช่ไม่มีแท็ก; `tags: []` ที่ settled แล้วหมายถึงไม่มีแท็ก\n- `snooze` หมายถึงกดปุ่ม Snooze ของกลุ่ม ตัว event นี้ไม่ได้พักการบล็อกด้วยตัวเอง\n- Query/file replies ส่งกลับไปยังกลุ่มที่ร้องขอ ให้จับคู่ด้วย `requestId`, ตรวจ `error`/`ok` และตั้ง deadline โดยใช้ ticks: replies อาจหายเมื่อหน้าปิด engine โหลดใหม่ หรือปิดกลุ่ม Request IDs อาจซ้ำหลัง Run; requests ที่ค้างไม่ใช่งานถาวร

## Browser actions

`tabId` จำนวนเต็มต้องมาจาก event Page actions ต้องใช้หน้าที่ Vault เข้าถึงได้; หน้าภายในเบราว์เซอร์ใช้ไม่ได้ โดยทั่วไป input ที่ไม่ถูกต้องหรือเป้าหมายที่เข้าไม่ถึงจะไม่มีผล

- `v.item(tabId, ref, verdict)`: `"hide"` นำการ์ดฟีดออก, `"dim"` ปิดทับสื่อ, `"allow"` ยกเว้นจากกลุ่มล่าง, `null` ล้างคำตัดสินของกลุ่มนี้ refs ที่ไม่รู้จักไม่มีผล; ใช้ `v.cover` สำหรับ `isPage` คำตัดสินทำตามลำดับกลุ่ม: hide ที่อยู่สูงกว่าชนะ; dim ที่สูงกว่ายังคงมีผลแม้กลุ่มล่าง allow; allow จะกันคำตัดสินจากกลุ่มล่าง การ์ดที่นำกลับมาใช้หรือถูกนำออกต้องมีคำตัดสินใหม่\n- `v.cover(tabId, on, message?)`: true ปิดทับหน้า, false ยกเลิก cover ที่กำหนดเอง; message เริ่มต้นเป็นค่าว่าง (สูงสุด 500 ตัวอักษร) แต่ละหน้ามีช่อง custom-cover หนึ่งช่อง; cover call ล่าสุดที่นำไปใช้จะชนะ ไม่ว่าลำดับกลุ่มเป็นอย่างไร เมื่อ address เปลี่ยน cover จะถูกยกเลิก; การบล็อกทั่วไปยังอาจปิดทับหน้าได้\n- `v.go(tabId, target)`: URL แบบ HTTP(S) หรือ `"back"`, `"forward"`, `"reload"` (target สูงสุด 4096 ตัวอักษร)\n- `v.close(tabId)`: ปิด tab\n- `v.css(tabIdOrStar, id, css)`: tab ID จำนวนเต็มหรือ `"*"`; แทนที่ stylesheet ของกลุ่มที่มี ID นั้น หรือใช้ null เพื่อนำออก เมื่อ address เปลี่ยน tab sheets จะสิ้นสุด; sheets `"*"` มีผลกับหน้าใหม่ ID สูงสุด 80, CSS สูงสุด 100000 ตัวอักษร\n- `v.dom(tabId, selector, op, arg?)`: CSS selector (สูงสุด 1000); ใช้กับทุก match ยกเว้น `scrollTo` ใช้กับรายการแรก Ops: `hide` ตั้ง inline `display:none!important`; `show` นำ inline display ออก; `click`; `setText` แทน text ด้วย `arg`; `addClass`/`removeClass` ใช้ class name เดียว; `scrollTo` เลื่อนไปยังตำแหน่งที่มองเห็น Arg สูงสุด 2000 การเปลี่ยนแปลงคงอยู่จนกว่าจะย้อนกลับอย่างชัดเจนหรือเปลี่ยนหน้า\n- `v.query(tabId, selector)` → request ID string หรือ null หาก arguments ไม่ถูกต้อง ผลลัพธ์เป็น `query` event ที่ตามมา: สูงสุด 50 matches, `tag` ตัวพิมพ์เล็ก, normalized text ≤1000 ตัวอักษร, attributes ≤2000, value ≤1000 หากไม่มี match จะสำเร็จเป็น `[]`; CSS ไม่ถูกต้องจะให้ `error: "invalid-selector"` หน้าที่ไม่มี receiver ของ Vault อาจไม่ตอบกลับ

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

ค่าเริ่มต้น: ตำแหน่งล่างขวา; layout แนวตั้ง; จัดชิดซ้าย; role region; ความกว้างตามเนื้อหา presets ของความกว้างคือ 220/280/360px; ความกว้าง panel แบบตัวเลขจำกัดไว้ที่ 180–520px ความกว้าง control จำกัดที่ 32–520px และความสูงที่ 20–360px ขนาดตัวเลขรับ pixel strings ด้วย รูปแบบแนวตั้งเปลี่ยนระยะห่าง; inline/row ไม่ตัดบรรทัด; wrap/toolbar ตัดบรรทัด; twoColumn/grid/split/form ใช้ grids; stack ลดระยะห่างให้เหลือน้อยที่สุด Role กำหนดความหมายด้านการช่วยการเข้าถึง ไม่ได้บล็อกแบบ modal

IDs จะปรับให้เป็น ASCII letters/digits/`_`/`-` (สูงสุด 80); เลือก IDs ที่ไม่ซ้ำและคงที่ หากไม่ระบุ control ID จะเป็น `control-N`; หากไม่ระบุหรือไม่รู้จัก type จะเป็น text ข้อความ/lists ที่ไม่ระบุจะว่าง; disabled เป็น false การเรียก `v.panel` จะแทนที่ spec ทั้งหมด หากไม่ระบุ `value` จะใช้ค่า event ล่าสุดของ control แล้วทำ type normalization; `value` ที่ระบุชัดจะเขียนทับค่าเดิม Autofocus เริ่มต้นเป็น false fields ที่ไม่รู้จักจะถูกทิ้ง; ไม่รองรับสี/fonts/CSS ของ panel ที่กำหนดจาก rule

Fields และค่าของ controls:

- `text`: string `text`; ค่าเริ่มต้นมาจาก label `html`: string `html`; นำ scripts, event attributes, URLs ที่เป็นอันตราย และ styling ออก\n- `button`: `label`, และ `action: "submit" | "cancel" | "close"` ซึ่งไม่บังคับ; value เป็น string (เริ่มต้นว่าง) Actions ส่ง events; ไม่ submit/close สิ่งใดโดยอัตโนมัติ\n- `checkbox`, `toggle`: boolean `value` (เริ่มต้น false)\n- `select`, `radio`: `options: (string | { value: string, label?: string })[]`; string value (เริ่มต้นว่าง) ลบ option values ที่ว่าง; labels เริ่มต้นตาม value\n- `textInput`, `textarea`: string value (เริ่มต้นว่าง), `placeholder`; `rows` ของ textarea อยู่ที่ 1–12 (เริ่มต้น 3)\n- `numberInput`, `range`: numeric value (เริ่มต้น 0), `min`, `max`, `step` ที่เป็นบวก Values จะถูกจำกัดให้อยู่ในขอบเขต; ขอบเขต normalization เริ่มต้นที่ไม่ได้ระบุคือ −1000000…1000000 Range widgets เริ่มต้นที่ 0…100; ให้กำหนดขอบเขตอย่างชัดเจน\n- `date`: string `YYYY-MM-DD`; `time`: string `HH:MM` หรือ `HH:MM:SS`; formats เริ่มต้นที่ไม่ถูกต้องจะกลายเป็นค่าว่าง `color`: `#RRGGBB` (เริ่มต้น `#000000`)\n- `pin`: string ตัวเลข; `length` 3–12 (เริ่มต้น 6), `masked` เริ่มต้น true, `autoSubmit` false `section`: `text`, `controls`, และ layout/align/role ซึ่งไม่บังคับ (role เริ่มต้น group); child sections ที่ depth 3 ไม่มี children (root controls อยู่ depth 0)

Panel events: input controls ส่ง `input`/`change` (text input เปลี่ยนเมื่อ blur/Enter; textarea เมื่อ blur/Ctrl-or-Cmd+Enter) Controls ทั่วไปยังส่ง `focus`, `blur`, `key`; metadata ของ key จะไม่ส่งต่อไปยัง rule Buttons ส่ง `click` **และ** action ที่ตั้งค่าไว้เป็น events แยกกัน ให้จัดการอย่างใดอย่างหนึ่ง PIN ส่ง `change` และส่ง `submit` เมื่อ autoSubmit กรอกครบ Mount/unmount ใช้ `controlId: ""`, `value: true` `values` มีค่า input ปัจจุบันตาม ID; ไม่รวม buttons/text/HTML Events ไม่มี tab ID ต้นทาง; ใช้ panel IDs แยกกันสำหรับการโต้ตอบเฉพาะ tab

ขีดจำกัดข้อความ: title/label/ariaLabel 240; description/text 1000; HTML 20000; placeholder 500; input text 2000; value strings อื่น 512; option value/label 256 ส่วนที่เกินจะถูกตัด

## Files

`op`: `"read"`, `"write"`, `"append"`, `"list"`, `"exists"` ต้องเปิด **โฟลเดอร์กฎแบบกำหนดเอง** ใน Settings และให้ permission ด้วย Safari ใช้ตัวเลือกโฟลเดอร์ native และ security-scoped grant ที่เก็บไว้; เข้าถึงได้เฉพาะโฟลเดอร์ที่เลือก

- `path` เป็น relative; `/` ใช้แยก directories แต่ละส่วนอนุญาต ASCII letters/digits, spaces และ `_.,@()-`; ห้ามขึ้นต้นด้วยจุด, `.`/`..`, absolute path หรือ URL นามสกุลไฟล์: `.txt`, `.csv`, `.json` (ไม่แยกตัวพิมพ์เล็กใหญ่) List path ต้องเป็น directory; `""` จะแสดง root ที่เลือก\n- Read คืน UTF-8 text Write แทนที่/สร้างไฟล์; append สร้าง/ต่อท้ายโดยไม่เพิ่ม newline อัตโนมัติ การเขียนจะสร้าง parent directories ให้ String payload จะเขียนตามตัวอักษร; JSON payload ประเภทอื่นจะถูก serialize; null/ไม่ระบุหมายถึง text ว่าง การ parse JSON/CSV เป็นหน้าที่ของ rule ขนาดไฟล์สูงสุด: 1048576 UTF-8 bytes\n- List คืน subdirectories และ files ที่รองรับซึ่งมองเห็นได้ในระดับถัดไป Entries: `{ name: string, path: string, kind: "directory" | "file", extension?: string }`; extension ของ files มีจุดนำหน้า Exists คืน boolean สำหรับ file path ที่รองรับ

```text
file.data = { requestId: string, op: string, path: string, ok: boolean,
              text: string | null, entries: Entry[] | null,
              exists: boolean | null, error: string }
```

result fields ที่ไม่ได้ใช้เป็น null; เมื่อสำเร็จ error จะว่าง ความล้มเหลวรวมถึง invalid-path, unsupported-file-type, permission/folder unavailable, missing file และ file-too-large ให้ถือว่า error เป็น string ไม่ใช่ enum ที่แจกแจงครบถ้วน Requests ไม่มีการรับประกัน transaction/order; จัด read-modify-write ตามลำดับแยกแต่ละ path

## ขีดจำกัด

ต่อ event ต่อ group: 256 queued actions, 200 log calls, 64 emits; ส่วนเกินจะถูกทิ้ง ต่อ rule: 1000 handlers, 24 panels; แต่ละ control list มี 32 entries และแต่ละ choice มี 64 options; ส่วนเกินจะถูกละเว้น/ตัด Emit chains หยุดหลัง 16 generations Serialized state limit: 65536 UTF-8 bytes ให้ registration และ handlers ทั้งหมดของแต่ละ event ใช้เวลารวมต่ำกว่า 1 second หากเกินซ้ำ ๆ หรือชน hard timeout กลุ่มจะหยุดจนกด Run Log เก็บ 200 entries, รับได้ 50 ครั้ง/วินาทีต่อกลุ่ม และตัดข้อความยาวใกล้ 4096 ตัวอักษร Timers/replies เป็น best-effort ไม่ใช่การรับประกันแบบ real-time

## กฎฉบับเต็ม

หยุดชั่วคราวห้านาที เริ่มได้จาก Snooze หรือปุ่ม panel ของมัน:

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


## การเรียก AI จากกฎที่กำลังทำงาน

แต่ละ custom group เลือก connection/model และ reasoning effort ใน **AI calls** กฎ Mac และ browser ใช้ API เดียวกัน; browser request ต้องเชื่อม Mac Vault และ credentials ของ provider อยู่ที่นั่น กลุ่มที่เชื่อมกันแชร์ตัวเลือกและ daily cap แบบเลือกได้ ค่าว่างหมายถึงไม่จำกัดระดับกลุ่ม แต่ข้อจำกัดบัญชียังใช้ cap คิดตามวัน UTC อยู่หลัง restart และนับทุก attempt ที่ส่งรวมถึงที่ล้มเหลว Link รวม usage เดิม; unlink เก็บ usage ที่ผ่านมา

prompt และ context ที่บันทึกไว้จะแชร์กันในกลุ่มที่เชื่อมโยง และใช้ใน handler ได้ผ่าน `v.context.ai.prompt` กับ `v.context.ai.context` Vault จะไม่ส่งให้เอง; rule เลือกสิ่งที่จะใส่ในแต่ละการเรียก `v.ai`.

`v.ai({ prompt, input? })` คืน request ID ทันที เรียกใน handler ไม่ใช่ตอนลงทะเบียน rule `input` เป็น JSON ใดก็ได้; prompt/input จำกัดอย่างละ20KB คำตอบมาใน `ai` events: `. Success text is at most48KB; citations are ` `ask` `note` event: {requestId, ok, text, citations, error} ข้อความสำเร็จไม่เกิน48KB; citations เป็น {url,title} เก็บลิงก์แหล่งที่มาให้มองเห็นและคลิกได้เมื่อแสดงคำตอบจาก web search Search มีให้โมเดลเสมอ ไม่มี app deadline คงที่และจำกัด concurrency; ไม่มี provider fallback หรือ auto retry คำตอบเป็นข้อมูล ไม่ถูก execute เป็น JavaScript และ rule ตัดสินใจว่าจะใช้ action เดิมใด

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

คำขอค้างไม่เล่นซ้ำหลัง restart; Run, disable/re-enable และ delete ทิ้งคำตอบเก่า เบราว์เซอร์ที่ตัดการเชื่อมต่อแจ้ง `ai-unavailable` ข้อผิดพลาดอื่น ได้แก่ `ai-not-configured`, `ai-invalid-input`, `ai-busy`, `ai-daily-limit`, `ai-request-failed`, `ai-usage-storage-unavailable` คำขอที่ล้มเหลวไม่เขียนทับผลเดิมที่ rule เก็บไว้ ขนาด state ยังคงจำกัด64KB

ค้นตัวเลือกที่ไม่มี credentials ด้วย `rule_ai_models` บน Mac หรือ `settings-rule-ai-models` ใน browser ตั้ง `ruleAI` ผ่าน set-group path เดิม ฟิลด์คือ `providerModel`, `accountID`, `reasoningEffort` (`default`, `low`, `medium`, `high`) และ `dailyRequestLimit` (null หรือ1–100000) ใช้ตัวเลือกที่คืนมา อย่าใส่ key หรือ provider URL ใน source ของ rule
field ที่บันทึกได้โดยเลือกคือ `prompt` และ `context` แต่ละค่าเป็น string ได้ถึง16KB

## บันทึกของกลุ่ม

`v.store(request)` เริ่มการทำงานบันทึก JSON แบบ asynchronous ภายใน handler บันทึกเป็นของกลุ่มนั้น อยู่ต่อหลัง Run และ restart และถูกลบพร้อมกลุ่ม กลุ่มที่เชื่อมกันมี store แยกกัน Rule เลือก key, value, version, cache invalidation และลำดับความสำคัญของ feedback กฎ Mac และ browser ใช้ API เดียวกัน แต่ store ของแต่ละ app/browser แยกกัน

| Request | Result |
|---|---|
| `{op:"get", key}` | `record` หรือ `null` |
| `{op:"put", key, value, version?, ifRevision?}` | `record` ที่บันทึกแล้ว |
| `{op:"delete", key, ifRevision?}` | `record: null` |
| `{op:"list", prefix?, after?, limit?}` | `entries` ที่เรียงแล้วและ `next` |
| `{op:"clear", prefix?}` | จำนวน `deleted` |

แต่ละ record คือ `{value, revision, version, updatedAt}` ค่า revision แบบ opaque เปลี่ยนเมื่อเขียนจริง; `version` เป็น metadata ของ caller `list` คืน headers โดยไม่มี values ใช้ `get` เพื่ออ่านและ `after: next` `put` `delete` เพื่อขอหน้าถัดไป เมื่อไม่ระบุ `ifRevision` put/delete จะไม่มีเงื่อนไข; `null` ต้องไม่มี key นั้น ส่วน revision string ต้องตรงกันพอดี หากไม่ตรงจะคืน `ok:false`, `error:"store-conflict"` และ `record` ปัจจุบัน เพื่อป้องกัน automatic reply ที่ล่าช้าเขียนทับ feedback ของผู้ใช้ `v.context.revision` เป็น configuration marker แบบ opaque ที่ rule อาจรวมใน version ของตัวเอง framework ไม่กำหนดนโยบาย cache

ขีดจำกัด: key 1–2048 ตัวอักษร, version ≤128, JSON value ≤64KiB, depth ≤32, 10000 keys ต่อกลุ่ม และเอกสารรวม16MiB `list` คืนได้สูงสุด100 headers และ96KiB ต่อหน้า สูงสุด32 requests ต่อกลุ่มและ128 starts/second โดยรวม เมื่อเกินจะรายงาน `store-busy` หนึ่งครั้งต่อกลุ่มต่อวินาทีและทิ้งรายการที่เหลือ Storage error คืน `ok:false`; เอกสารอนาคตหรือผิดรูปจะถูกเก็บไว้และรายงาน `store-unavailable` ไม่มี retry หรือ eviction อัตโนมัติ ใช้ ticks กำหนด deadline

## ไฟล์แนบเนื้อหาที่บันทึกไว้

ใช้ `v.attach(tabId, item, id, spec)` เพื่อบันทึก pill หรือมุมมอง HTML/CSS แบบไม่ทำงานสำหรับรายการเนื้อหาที่ตรวจพบ ส่ง `item` ทั้งรายการจากเหตุการณ์ `items` หรือ `attachment`; มีเพียง `ref` ไม่ใช่ handle ของไฟล์แนบ `contentId` ระบุเนื้อหาที่บันทึก ส่วน `instanceId` ระบุการปรากฏปัจจุบัน เก็บ handle เดิมไว้ขณะรอ AI การแนบล่าช้ากับเป้าหมายที่ถูกลบ ใช้ซ้ำ หรือนำทางแล้วจะถูกปฏิเสธ พฤติกรรม `v.item(tabId, ref, verdict)` แยกจากกัน

สำหรับ pill ให้ `spec` เป็น `{type:"pill", text, tone?, tooltip?}`; tone คือ `blue`, `cyan`, `gold`, `pink` หรือ `red` ข้อความธรรมดาได้ 240 ตัวอักษร tooltip ได้ 1000 สำหรับมุมมองให้ spec เป็น `{type:"html", html, css?, label?}` ขีดจำกัด: HTML 32000 ตัวอักษร CSS 16000 label 200 มุมมองสร้างใหม่จาก HTML/SVG แบบไม่ทำงานที่อนุญาต ใน shadow root แบบปิดและ CSS ที่จำกัด ขจัดสคริปต์ event attribute ทรัพยากรระยะไกล embed และ CSS ที่ไม่ปลอดภัย มุมมองอยู่ในบัตรเนื้อหาและเลื่อนได้เมื่อสูง 480px ID ใช้ ASCII 1–80 ตัวอักษร/ตัวเลข _ หรือ - spec เป็น null เพื่อลบ pill ของกลุ่ม เรียกใน handler; ข้อผิดพลาดการบันทึก/ส่งปรากฏใน Log และไม่ retry อัตโนมัติ

แต่ละ item แสดงไฟล์แนบของกลุ่มนี้เป็น snapshot แบบอ่านอย่างเดียวใน `item.attachments`; ไม่มีไฟล์แนบของกลุ่มอื่น หากข้อมูลบันทึกใช้ไม่ได้ `attachments` เป็น null และตั้ง `attachmentError`; ไม่ได้หมายถึง cache ว่าง handler อื่นยังทำงาน ใช้ตัวอย่างเพื่อไม่ส่งคำขอ AI ซ้ำให้เนื้อหาที่มีผลลัพธ์บันทึกแล้ว

การกดด้วย pointer, Enter หรือ Space สร้างเหตุการณ์ `attachment` สำหรับกลุ่ม pill ส่ง `click` ตัวควบคุมของมุมมองใช้ `data-control` หรือ `id` เป็น `controlId` และส่ง `click`, `input` หรือ `change` พร้อม `value` ปัจจุบันและ `values` ที่จำกัดสำหรับตัวควบคุมที่มีชื่อ เหตุการณ์ UI จริงมี `ev.origin === "user"`; เหตุการณ์จากกฎมี `origin === "rule"` และมี `tabId`, `attachmentId`, `item` ปัจจุบัน มุมมองไม่เรียกใช้โค้ดกฎ ทั้ง pill และมุมมองป้องกันการนำทางจากการโต้ตอบ ข้อมูลที่บันทึกไม่มี callback หรือโค้ดที่เรียกใช้ได้ revision ของ pill เก่าเรียกไฟล์แนบปัจจุบันไม่ได้ emit event ของกฎเป็น logic ปกติ; browser ตรวจข้อความคลิก UI จริงแยกต่างหาก

ไฟล์แนบบันทึกในโปรไฟล์ browser นี้ตาม group/content/ID และกลับมาเมื่อพบอีกครั้ง นำทาง เริ่ม browser ใหม่ และ Run Disable ซ่อนไว้แต่เก็บข้อมูล; enable คืนให้ การลบกลุ่มลบไฟล์แนบ กลุ่มที่เชื่อมโยงยังแยกกัน ไม่มี sync อัตโนมัติข้าม browser/device เนื้อหา YouTube, Reddit, X และ Bilibili ที่รู้จักใช้ platform ID เนื้อหาอื่นใช้ URL ที่ normalize อย่างระมัดระวัง จึงขึ้นกับ markup ของหน้าที่รองรับ

ขีดจำกัด: 8 ไฟล์แนบต่อ group/content, 32 ต่อ item รวมทุกกลุ่ม, 10000 content entries ต่อกลุ่ม และเอกสารไฟล์แนบที่ serialize แล้ว 8MB เมื่อถึงขีดจำกัด การเปลี่ยนใหม่ถูกปฏิเสธพร้อม `attachment-item-limit` หรือ `attachment-storage-limit` ใน Log; ข้อมูลเดิมยังอยู่ Dispatch รวมการเขียน และ spec ที่เหมือนเดิมไม่เขียน storage ซ้ำ ไฟล์แนบเป็น UI เนื้อหาของ browser รวมถึง Safari native rule engine กฎแอป Mac ไม่มี browser content handle หรือหน้าจอไฟล์แนบในแอป

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

`code-manual/generic-example.js` เป็นตัวอย่าง policy ที่เรียกใช้ได้ ใช้ record, AI calls, feedback จากผู้ใช้, compare-and-swap, HTML controls, item verdict และรายงานการใช้งานของกฎ พฤติกรรมเหล่านี้อยู่ในตัวอย่าง ไม่ใช่คุณสมบัติเฉพาะของ store
