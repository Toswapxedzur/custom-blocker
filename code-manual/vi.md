# Hướng dẫn mã tiện ích trình duyệt Vault

[Hướng dẫn sử dụng](../manual/vi.md)

## Quy định của quy tắc

Source: một biểu thức hàm `(on, v) => { ... }`. Chỉ hỗ trợ JavaScript đồng bộ và API bên dưới; không có timers, network, extension APIs hoặc truy cập DOM trực tiếp. Quy tắc dựa trên thời gian dùng `ev.now` và events.

- Chỉnh sửa lưu thành draft; **Run** kích hoạt và bật nhóm. Nhóm bị khóa không thể Run. Source trống sẽ unload quy tắc.
- Run thành công thay thế handlers và panels, đồng thời giữ `v.state`. Nếu compilation/registration thất bại, quy tắc trước được giữ lại; timeout có thể dừng quy tắc. Khi tải lại engine, source được kích hoạt gần nhất sẽ được đăng ký lại; closure variables được reset.
- Trong lúc registration, quy tắc có thể khởi tạo state, đăng ký handlers, hiện panels và ghi log. Thao tác với trang/tệp và emits phải nằm trong handlers; hàng đợi tạo lúc registration bị bỏ.
- Disable ngăn handlers và gỡ panels, sheets, covers cùng các quyết định mục do quy tắc quản lý. Enable khôi phục panels/sheets còn lưu và yêu cầu các mục lại. Run không xóa sheets, covers hay quyết định mục hiện có. Delete xóa quy tắc cùng state/effects. Điều hướng, thay đổi DOM và ghi tệp không được hoàn tác.
- Events không bị giới hạn theo mục tiêu thông thường của nhóm; hãy lọc URLs/items trong quy tắc. Actions được xếp hàng rồi áp dụng sau dispatch. Exception dừng handler đó nhưng không hoàn tác state/actions của nó; handlers sau có thể vẫn chạy. Không có xác nhận action ngoại trừ events file/query.

## API dùng chung

- `on(type, handler)` → boolean. Đăng ký `handler(ev)`; nhiều handlers chạy theo thứ tự đăng ký. False nghĩa là arguments không hợp lệ hoặc đạt giới hạn handlers. `ev = { type: string, now: number, data }`; `now` là Unix milliseconds.
- `v.state`: JSON object có thể thay đổi, được lưu sau event dispatch. Khởi tạo fields còn thiếu thay vì ghi đè state hiện có. Gán non-object hoặc array sẽ reset thành `{}`; cập nhật không serialize được/quá lớn sẽ không lưu.
- `v.log(...values)`: nguồn duy nhất ghi vào Log của nhóm này. Logs/Clear độc lập theo nhóm. Load errors hiện trong Run status; handler diagnostics không ghi vào Log.
- `v.emit(type, data)`: xếp hàng bản sao JSON của `data` cho handlers nhóm này sau event hiện tại, kèm `now` mới; không phải lời gọi đồng bộ.
- `v.panel(id, spec, tabId?)`: thay panel có tên của nhóm; bỏ `tabId` để áp dụng cho mọi trang web truy cập được, hoặc dùng tab ID dạng số nguyên. `spec` null sẽ xóa panel. Xem Panels.
- `v.file(op, path, payload?)` → request ID string. Xem Files.

Các lời gọi dùng chung khác trả về `undefined`. IDs/state thuộc về nhóm, không phải tên hiển thị.

## Events của trình duyệt

Ký hiệu payload bên dưới mô tả kiểu dữ liệu, không phải mã có thể chạy. `?` đánh dấu fields tùy chọn.

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

- `tick` chỉ gần đúng; dùng timestamps thay vì đếm tick. `active` nghĩa là trang được chọn trong cửa sổ trình duyệt, không chứng minh người dùng đang nhìn trang đó. URLs có thể trống/bị hạn chế.
- `visible` lấy từ các trang truy cập được, không bị ẩn; `elapsedMs` là thời gian từ heartbeat gần nhất của chúng và bằng 0 khi trang bị phủ. Đây không phải mức sử dụng tích lũy hay thời gian phát.
- `items` báo các mục feed được hỗ trợ mới/thay đổi và gửi lại sau Run/bật lại. `ref` xác định thẻ trên trang đó, không phải content ID lâu dài; `ref === "page"` nghĩa là chính trang. Titles/URLs/authors có thể trống. `authors` chứa source identifiers đặc thù nền tảng.
- Platform IDs: `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`, `reddit`, `discord`, `twitter`, `bluesky`, `threads`, `substack`, `bilibili`, `rumble`, `pinterest`, `kick`, `tumblr`, `peertube`, `pixelfed`, `kuaishou`. Việc có items tùy markup được hỗ trợ trên trang.
- Tags cần desktop Classifier được kết nối và build/platform hỗ trợ gắn thẻ (Chromium và Safari: YouTube, Reddit, Bilibili, X/`twitter`). Confidence từ 1–5. `tagsSettled === false` là đang chờ/không khả dụng, không phải chưa gắn thẻ; `tags: []` khi đã settled nghĩa là chưa gắn thẻ.
- `snooze` nghĩa là đã nhấn nút Snooze của nhóm. Nó không tự tạm dừng gì.
- Query/file replies gửi về nhóm yêu cầu. Đối chiếu `requestId`, kiểm tra `error`/`ok` và đặt deadline bằng ticks: replies có thể mất khi trang đóng, engine tải lại hoặc nhóm bị tắt. Request IDs có thể lặp sau Run; requests đang chờ không phải công việc bền vững.

## Browser actions

`tabId` số nguyên phải đến từ một event. Page actions cần trang Vault truy cập được; các trang nội bộ trình duyệt không khả dụng. Input không hợp lệ/đích không khả dụng thường không có hiệu lực.

- `v.item(tabId, ref, verdict)`: `"hide"` xóa thẻ feed, `"dim"` phủ media, `"allow"` miễn áp dụng các nhóm bên dưới, `null` xóa verdict của nhóm này. Refs lạ không làm gì; dùng `v.cover` cho `isPage`. Verdict tuân theo thứ tự danh sách nhóm: hide ở trên thắng; dim ở trên vẫn có hiệu lực dù bên dưới allow; allow ngăn verdict bên dưới. Thẻ được tái sử dụng/đã xóa cần quyết định mới.
- `v.cover(tabId, on, message?)`: true phủ trang, false bỏ custom cover; message mặc định trống (tối đa 500 ký tự). Mỗi trang có một custom-cover slot; cover call áp dụng sau cùng sẽ thắng bất kể thứ tự nhóm. Đổi địa chỉ sẽ bỏ cover; chặn thông thường vẫn có thể phủ trang.
- `v.go(tabId, target)`: URL HTTP(S) hoặc `"back"`, `"forward"`, `"reload"` (target tối đa 4096 ký tự).
- `v.close(tabId)`: đóng tab.
- `v.css(tabIdOrStar, id, css)`: tab ID số nguyên hoặc `"*"`; thay stylesheet của nhóm có ID đó hoặc xóa bằng null. Tab sheets kết thúc khi đổi địa chỉ; sheets `"*"` áp dụng với trang mới. ID tối đa 80, CSS tối đa 100000 ký tự.
- `v.dom(tabId, selector, op, arg?)`: CSS selector (tối đa 1000); áp dụng mọi kết quả, ngoại trừ `scrollTo` chỉ dùng kết quả đầu tiên. Ops: `hide` đặt inline `display:none!important`; `show` xóa inline display; `click`; `setText` thay text bằng `arg`; `addClass`/`removeClass` dùng một class name; `scrollTo` cuộn đến vị trí hiển thị. Arg tối đa 2000. Thay đổi tồn tại đến khi được hoàn tác rõ ràng/thay trang.
- `v.query(tabId, selector)` → request ID string hoặc null nếu arguments không hợp lệ. Kết quả là event `query` về sau: tối đa 50 matches, `tag` chữ thường, normalized text ≤1000 ký tự, attributes ≤2000, value ≤1000. Không có kết quả là `[]` thành công; CSS lỗi trả `error: "invalid-selector"`. Trang không có receiver của Vault có thể không phản hồi.

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

Mặc định: vị trí dưới bên phải; layout dọc; căn trái; role region; độ rộng vừa nội dung. Presets độ rộng là 220/280/360px; độ rộng panel số bị giới hạn 180–520px. Độ rộng control giới hạn 32–520px, chiều cao 20–360px. Kích thước số cũng nhận pixel strings. Biến thể dọc đổi khoảng cách; inline/row không ngắt dòng; wrap/toolbar ngắt dòng; twoColumn/grid/split/form dùng grids; stack thu nhỏ khoảng cách. Role cung cấp ngữ nghĩa hỗ trợ tiếp cận, không chặn kiểu modal.

IDs được chuẩn hóa thành ASCII letters/digits/`_`/`-` (tối đa 80); chọn IDs ổn định, duy nhất. Control ID bị bỏ qua sẽ thành `control-N`; type bị bỏ qua/không biết thành text. text/lists bị bỏ qua là rỗng; disabled là false. Gọi `v.panel` thay toàn bộ spec. `value` bị bỏ qua sẽ dùng event value gần nhất của control rồi áp dụng type normalization; `value` nêu rõ sẽ ghi đè. Autofocus mặc định false. Fields không biết bị bỏ; không hỗ trợ màu/fonts/CSS của panel do rule cung cấp.

Các fields và values của control:

- `text`: string `text`; mặc định theo label. `html`: string `html`; loại scripts, event attributes, URL nguy hiểm và styling.
- `button`: `label`, `action: "submit" | "cancel" | "close"` tùy chọn; value là string (mặc định rỗng). Actions phát events; không tự submit/close gì.
- `checkbox`, `toggle`: boolean `value` (mặc định false).
- `select`, `radio`: `options: (string | { value: string, label?: string })[]`; string value (mặc định rỗng). Xóa option values trống; labels mặc định theo value.
- `textInput`, `textarea`: string value (mặc định rỗng), `placeholder`; `rows` của textarea từ 1–12 (mặc định 3).
- `numberInput`, `range`: numeric value (mặc định 0), `min`, `max`, `step` dương. Values được giới hạn trong bounds; bounds normalization mặc định không nêu là −1000000…1000000. Range widgets mặc định 0…100; hãy đặt bounds cụ thể.
- `date`: string `YYYY-MM-DD`; `time`: string `HH:MM` hoặc `HH:MM:SS`; format ban đầu sai sẽ thành rỗng. `color`: `#RRGGBB` (mặc định `#000000`).
- `pin`: string chữ số; `length` 3–12 (mặc định 6), `masked` mặc định true, `autoSubmit` false. `section`: `text`, `controls`, layout/align/role tùy chọn (role mặc định group); child sections ở depth 3 không có children (root controls depth 0).

Panel events: input controls gửi `input`/`change` (text input đổi khi blur/Enter; textarea khi blur/Ctrl-or-Cmd+Enter). Controls thường còn gửi `focus`, `blur`, `key`; metadata của key không chuyển đến rule. Buttons gửi `click` **và** action đã cấu hình thành events riêng—chỉ xử lý một. PIN gửi `change`, và `submit` khi autoSubmit điền xong. Mount/unmount dùng `controlId: ""`, `value: true`. `values` gồm input hiện tại theo ID; không gồm buttons/text/HTML. Events không có tab ID nguồn; dùng panel IDs riêng cho tương tác theo tab.

Giới hạn text: title/label/ariaLabel 240; description/text 1000; HTML 20000; placeholder 500; input text 2000; value strings khác 512; option value/label 256. Phần vượt quá bị cắt.

## Files

`op`: `"read"`, `"write"`, `"append"`, `"list"`, `"exists"`. Cần **Thư mục quy tắc tùy chỉnh** trong Settings và quyền tương ứng. Safari dùng bộ chọn thư mục native và security-scoped grant được giữ lại; chỉ thư mục đã chọn khả dụng.

- `path` là relative; `/` phân cách directories. Segments cho phép ASCII letters/digits, spaces và `_.,@()-`; không cho phép dấu chấm đầu, `.`/`..`, absolute path hoặc URL. Đuôi tệp: `.txt`, `.csv`, `.json` (không phân biệt hoa thường). List path là directory; `""` liệt kê root đã chọn.
- Read trả về UTF-8 text. Write thay thế/tạo; append tạo/nối thêm không tự thêm newline. Thư mục cha được tạo khi ghi. String payload được ghi nguyên văn; payload JSON khác được serialize; null/bỏ trống nghĩa là text rỗng. Rule phải tự parse JSON/CSV. Kích thước tệp tối đa: 1048576 UTF-8 bytes.
- List trả các subdirectories và files được hỗ trợ ngay bên dưới, đang hiển thị. Entries: `{ name: string, path: string, kind: "directory" | "file", extension?: string }`; extension của files có dấu chấm. Exists trả boolean cho file path được hỗ trợ.

```text
file.data = { requestId: string, op: string, path: string, ok: boolean,
              text: string | null, entries: Entry[] | null,
              exists: boolean | null, error: string }
```

result fields không dùng là null; thành công có error rỗng. Lỗi gồm invalid-path, unsupported-file-type, permission/folder unavailable, missing file và file-too-large. Xem error là string, không phải enum liệt kê đầy đủ cố định. Requests không đảm bảo transaction/order; tuần tự hóa thao tác read-modify-write theo từng path.

## Giới hạn

Mỗi event trên mỗi group: 256 queued actions, 200 log calls, 64 emits; phần vượt bị bỏ. Mỗi rule: 1000 handlers, 24 panels; mỗi control list có 32 entries và mỗi choice có 64 options; phần vượt bị bỏ qua/cắt. Emit chains dừng sau 16 generations. Serialized state limit: 65536 JavaScript string characters. Giữ registration và handlers kết hợp của mỗi event dưới 1 second; vượt nhiều lần hoặc hard timeout sẽ dừng group đến khi Run. Log lưu 200 entries, chấp nhận 50/giây mỗi group và cắt messages dài gần 4096 ký tự. Timers/replies là best-effort, không đảm bảo real-time.

## Quy tắc đầy đủ

Tạm dừng năm phút, kích hoạt bởi Snooze hoặc nút panel của nó:

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
