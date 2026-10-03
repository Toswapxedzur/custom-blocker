# คู่มือโค้ดส่วนขยายเบราว์เซอร์ Vault

[คู่มือผู้ใช้](../manual/th.md)

## ข้อกำหนดของกฎ

Source ต้องเป็น function expression หนึ่งรายการ `(on, v) => { ... }` รองรับเฉพาะ JavaScript แบบ synchronous และ API ด้านล่างเท่านั้น ไม่มี timers, network, extension APIs หรือการเข้าถึง DOM โดยตรง กฎที่อิงเวลาจะใช้ `ev.now` และ events

- การแก้ไขจะบันทึกเป็น draft; **Run** จะเปิดใช้และเปิดใช้กลุ่ม กลุ่มที่ตรึงไว้กด Run ไม่ได้ หาก source ว่าง กฎจะถูก unload\n- Run ที่สำเร็จจะแทนที่ handlers และ panels โดยเก็บ `v.state` ไว้ หาก compilation/registration ล้มเหลว จะคงกฎก่อนหน้าไว้ แต่ timeout อาจหยุดกฎได้ เมื่อ engine โหลดใหม่ จะ register source ที่เปิดใช้ล่าสุดอีกครั้ง ส่วน closure variables จะ reset\n- ระหว่าง registration อาจเริ่มต้น state, register handlers, แสดง panels และเขียน log ได้ การกระทำกับหน้า/ไฟล์และ emits ต้องอยู่ใน handlers; สิ่งที่ queue ไว้ระหว่าง registration จะถูกทิ้ง\n- Disable จะระงับ handlers และยกเลิก panels, sheets, covers และคำตัดสินต่อรายการที่จัดการไว้ Enable จะคืน panels/sheets ที่ยังเก็บไว้และขอรายการอีกครั้ง Run จะไม่ล้าง sheets, covers หรือคำตัดสินต่อรายการที่มีอยู่ Delete จะนำกฎ state และผลที่เกิดจากกฎออก การนำทาง การเปลี่ยน DOM และการเขียนไฟล์จะไม่ถูกย้อนกลับ\n- Events ไม่จำกัดตามเป้าหมายทั่วไปของกลุ่ม ให้กรอง URLs/items ในกฎ Actions จะถูก queue แล้วนำไปใช้หลัง dispatch หากเกิด exception handler นั้นจะหยุด แต่ state/actions ของมันไม่ย้อนกลับ; handlers ถัดไปอาจยังทำงาน ไม่มีการตอบรับ action ยกเว้น events จาก file/query

## API ที่ใช้ร่วมกัน

- `on(type, handler)` → boolean ลงทะเบียน `handler(ev)`; หลาย handlers จะทำงานตามลำดับที่ลงทะเบียน False หมายถึง arguments ไม่ถูกต้องหรือถึงขีดจำกัด handlers แล้ว `ev = { type: string, now: number, data }`; `now` คือ Unix milliseconds\n- `v.state`: JSON object ที่แก้ไขได้และบันทึกหลัง event dispatch ให้เริ่มค่าเฉพาะ fields ที่ยังไม่มี แทนการเขียนทับ state เดิม การกำหนด non-object หรือ array จะ reset เป็น `{}`; การอัปเดตที่ serialize ไม่ได้หรือใหญ่เกินไปจะไม่ถูกบันทึก\n- `v.log(...values)`: วิธีเดียวที่เขียนลง Log ของกลุ่มนี้ Logs/Clear แยกกันในแต่ละกลุ่ม Load errors ปรากฏใน Run status; handler diagnostics ไม่ลงใน Log\n- `v.emit(type, data)`: queue สำเนา JSON ของ `data` ให้ handlers ของกลุ่มนี้หลัง event ปัจจุบัน พร้อม `now` ใหม่; ไม่ใช่การเรียกแบบ synchronous\n- `v.panel(id, spec, tabId?)`: แทนที่ panel ที่ตั้งชื่อของกลุ่มนี้ ไม่ระบุ `tabId` เพื่อใช้กับทุกหน้าเว็บที่เข้าถึงได้ หรือใช้ tab ID จำนวนเต็ม หาก `spec` เป็น null จะนำ panel ออก ดูหัวข้อ Panels\n- `v.file(op, path, payload?)` → request ID string ดูหัวข้อ Files

Calls ที่ใช้ร่วมกันรายการอื่นคืน `undefined` IDs/state ผูกกับกลุ่ม ไม่ใช่ชื่อที่แสดง

## Events ของเบราว์เซอร์

สัญกรณ์ payload ด้านล่างระบุชนิดข้อมูล ไม่ใช่โค้ดที่รันได้ `?` หมายถึง field ที่ไม่บังคับ

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

- `tick` เป็นค่าโดยประมาณ ให้ใช้ timestamps แทนการนับ ticks `active` หมายถึงหน้าที่ถูกเลือกในหน้าต่างเบราว์เซอร์ ไม่ได้ยืนยันว่าผู้ใช้กำลังดูอยู่ URLs อาจว่างหรือถูกจำกัดการเข้าถึง\n- `visible` มาจากหน้าที่เข้าถึงได้และไม่ถูกซ่อน `elapsedMs` คือเวลาตั้งแต่ heartbeat ล่าสุดของหน้านั้น และเป็นศูนย์ขณะถูกปิดทับ ไม่ใช่เวลาการใช้งานหรือเวลาเล่นที่สะสม\n- `items` รายงานรายการฟีดที่รองรับซึ่งเพิ่มหรือเปลี่ยนแปลง และส่งซ้ำหลัง Run/เปิดใช้ใหม่ `ref` ระบุการ์ดบนหน้านั้น ไม่ใช่ content ID ที่คงทน; `ref === "page"` หมายถึงตัวหน้าเอง titles/URLs/authors อาจว่างได้ `authors` มี source identifiers เฉพาะแพลตฟอร์ม\n- Platform IDs: `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`, `reddit`, `discord`, `twitter`, `bluesky`, `threads`, `substack`, `bilibili`, `rumble`, `pinterest`, `kick`, `tumblr`, `peertube`, `pixelfed`, `kuaishou` ความพร้อมของรายการขึ้นอยู่กับ markup ที่รองรับบนหน้า\n- Tags ต้องมี desktop Classifier ที่เชื่อมต่อและ build/platform ที่เปิดใช้การติดแท็ก (Chromium และ Safari: YouTube, Reddit, Bilibili, X/`twitter`) Confidence มีค่า 1–5 `tagsSettled === false` หมายถึงกำลังรอ/ไม่พร้อม ไม่ใช่ไม่มีแท็ก; `tags: []` ที่ settled แล้วหมายถึงไม่มีแท็ก Firefox builds ไม่มีการเชื่อมต่อการติดแท็กนี้\n- `snooze` หมายถึงกดปุ่ม Snooze ของกลุ่ม ตัว event นี้ไม่ได้พักการบล็อกด้วยตัวเอง\n- Query/file replies ส่งกลับไปยังกลุ่มที่ร้องขอ ให้จับคู่ด้วย `requestId`, ตรวจ `error`/`ok` และตั้ง deadline โดยใช้ ticks: replies อาจหายเมื่อหน้าปิด engine โหลดใหม่ หรือปิดกลุ่ม Request IDs อาจซ้ำหลัง Run; requests ที่ค้างไม่ใช่งานถาวร

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

ต่อ event ต่อ group: 256 queued actions, 200 log calls, 64 emits; ส่วนเกินจะถูกทิ้ง ต่อ rule: 1000 handlers, 24 panels; แต่ละ control list มี 32 entries และแต่ละ choice มี 64 options; ส่วนเกินจะถูกละเว้น/ตัด Emit chains หยุดหลัง 16 generations Serialized state limit: 65536 JavaScript string characters ให้ registration และ handlers ทั้งหมดของแต่ละ event ใช้เวลารวมต่ำกว่า 1 second หากเกินซ้ำ ๆ หรือชน hard timeout กลุ่มจะหยุดจนกด Run Log เก็บ 200 entries, รับได้ 50 ครั้ง/วินาทีต่อกลุ่ม และตัดข้อความยาวใกล้ 4096 ตัวอักษร Timers/replies เป็น best-effort ไม่ใช่การรับประกันแบบ real-time

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
