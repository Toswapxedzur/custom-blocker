# Custom Web Blocker — Hướng Dẫn Sử Dụng

Đây là tài liệu tham khảo đầy đủ cho tiện ích. Tài liệu bắt đầu từ những luồng sử dụng dễ và phổ biến nhất, rồi dần đi tới các chủ đề nâng cao như quy tắc chặn JavaScript tùy chỉnh và helper API.

Nếu bạn hoàn toàn mới, chỉ cần đọc **Khởi động nhanh** và **Tổng quan nhóm chặn**. Mọi phần bên dưới hai mục đó là tùy chọn, tùy theo điều bạn muốn làm.

---

## 1. Tiện ích này làm gì

Custom Web Blocker cho phép bạn chặn website và các yếu tố gây xao nhãng trực tuyến theo các quy tắc do chính bạn định nghĩa. Bạn có thể:

- Chặn trang ngay lập tức bằng cơ chế chặn mạng gốc của trình duyệt (cùng kiểu chặn tạo ra `ERR_BLOCKED_BY_CLIENT`).
- Tự cho phép mình một số phút mỗi ngày trên một trang, rồi chặn khi vượt quá giới hạn đó.
- Chặn các loại nội dung cụ thể trên YouTube, TikTok, Facebook, Instagram, Twitch và Reddit (không phải chặn toàn bộ trang).
- Ẩn nội dung bị chặn khỏi feed trên các nền tảng được hỗ trợ thay vì chỉ chặn từng trang đơn lẻ.
- Lập lịch khi nào quy tắc hoạt động theo ngày trong tuần và khung giờ `HHMM-HHMM`.
- Đóng băng một quy tắc để bạn không thể dễ dàng thay đổi nó. Đóng băng nghiêm ngặt sẽ khóa quy tắc trong số giờ bạn chỉ định và yêu cầu nghi thức xác nhận 20 bước để hoàn tác.
- Tạm hoãn một quy tắc, nhưng chỉ sau khi viết lý do đủ dài.
- Viết quy tắc chặn JavaScript tùy chỉnh với helper cho bộ đếm thời gian, lưu trữ bền vững, phát hiện nền tảng, khớp domain và ghi log.
- Dùng tiện ích với hơn 20 ngôn ngữ.

Tiện ích là một extension Chrome Manifest V3, gồm một trang editor (popup), một background service worker và một content script chạy trong mọi trang.

---

## 2. Tham quan giao diện

Khi bạn bấm vào biểu tượng tiện ích, editor mở ra dưới dạng một trang web đầy đủ (không phải popup nhỏ). Trang có các khu vực sau:

- **Thanh trên cùng**
  - Nút **Instruction Manual** (tài liệu này)
  - Bộ chọn **Language**
- **Bảng trái — Block Groups**
  - Danh sách các nhóm chặn của bạn. Mỗi thẻ hiển thị tên nhóm, một dòng tóm tắt ngắn và checkbox bật/tắt.
  - Nút **Add** tạo nhóm mới. Danh sách thả xuống bên cạnh chọn loại.
  - **Delete All** xóa mọi nhóm, có xác nhận bổ sung nếu có nhóm nào đang bị đóng băng.
  - Bạn có thể kéo tay nắm `::` trên thẻ lên hoặc xuống để sắp xếp lại nhóm.
  - Bạn có thể kéo thanh chia dọc để thay đổi kích thước bảng này.
- **Bảng phải — Editor**
  - Chỉnh nhóm đang chọn: tên, hành vi chặn, danh sách chặn, bộ lọc theo loại, lịch, đóng băng, tạm hoãn.
  - Mọi thay đổi được lưu tự động sau một phần nhỏ của giây kể từ khi bạn ngừng gõ hoặc tương tác.
- **Toast** (popup giữa màn hình, tự mờ)
  - Hiển thị thông báo trạng thái như "Saved changes" hoặc lỗi nhập liệu.

Trong khi một trang đang bị chặn hoặc có timer đang hoạt động, một lớp phủ sẽ xuất hiện ở góc trên bên trái hiển thị mọi ràng buộc thời gian hiện đang áp dụng, theo định dạng `hh:mm:ss` (hoặc `mm:ss`). Nhiều ràng buộc sẽ xếp chồng trên nhiều dòng.

---

## 3. Khởi động nhanh

1. Bấm biểu tượng tiện ích. Editor sẽ mở thành trang đầy đủ.
2. Trong bảng **Block Groups**, chọn loại nhóm từ menu thả xuống:
   - `Default`, `YouTube`, `TikTok`, `Facebook`, `Instagram`, `Twitch`, `Reddit` hoặc `Custom`.
3. Bấm **Add**. Một nhóm mới xuất hiện và editor mở nhóm đó.
4. Đặt tên cho nhóm.
5. Điền các trường theo loại (với `Default`, đó là danh sách **Blocked websites**).
6. Đảm bảo checkbox của nhóm ở bảng trái đang bật.
7. Truy cập một trong các trang đã liệt kê. Việc chặn sẽ có hiệu lực ngay.

Đó là toàn bộ luồng "happy path". Phần còn lại của tài liệu chỉ là các tùy chọn bổ sung trên nền tảng này.

---

## 4. Tổng quan nhóm chặn

Mọi thứ trong tiện ích này được tổ chức thành **nhóm chặn**. Một nhóm chặn là một bộ quy tắc:

- Có tên, loại và trạng thái bật/tắt.
- Có một hành vi chặn (ngay lập tức hoặc sau một số phút).
- Có lịch tùy chọn (ngày + khung giờ) và điều khiển đóng băng/tạm hoãn tùy chọn.
- Tùy theo loại, có các trường bổ sung như danh sách website, bộ lọc tác giả YouTube, tên subreddit hoặc hàm JavaScript.

Bạn có thể tạo bất kỳ số lượng nhóm nào. Nhiều nhóm có thể áp dụng cho cùng một trang; trong trường hợp đó quy tắc **nghiêm ngặt nhất** sẽ thắng:

- "Chặn ngay" thắng "chặn sau một thời gian".
- Nhóm có ít thời gian còn lại hơn thắng nhóm có nhiều thời gian còn lại hơn.

Vì vậy thêm nhiều nhóm chỉ có thể khiến trang bị chặn sớm hơn, không bao giờ muộn hơn.

Bạn có thể kéo các nhóm bằng tay nắm `::` để sắp xếp lại. Thứ tự không thay đổi quy tắc nào nghiêm ngặt nhất, nhưng điều khiển cách danh sách được đọc từ trên xuống dưới.

---

## 5. Các loại nhóm

### 5.1 `Default` — chặn website thông thường

Dùng để chặn các domain cụ thể (trường hợp phổ biến nhất).

- **Blocked websites**: mỗi dòng một trang. Cả `facebook.com` và `https://www.facebook.com/somepage` đều hoạt động; tiện ích sẽ trích xuất và chuẩn hóa hostname.
- Quy tắc trang áp dụng cho hostname đó và toàn bộ subdomain của nó.
- Loại nhóm này dùng chặn mạng gốc của Chrome, tương tự `ERR_BLOCKED_BY_CLIENT`. Nghĩa là điều hướng tới URL bị chặn sẽ dừng trước khi trang kịp tải.

### 5.2 `YouTube` — chặn YouTube và các trang video tương tự

Thêm mục **Filters** vào editor:

- **Content type**:
  - `Apply to all YouTube pages` — mọi trang YouTube đều được tính.
  - `Apply to Shorts` — chỉ tính trang Shorts.
  - `Apply to long videos` — chỉ `/watch`, `/live/`, `/embed/`, v.v.
  - `Apply to YouTube posts` — bài đăng cộng đồng (`/post/...`, tab community/posts của kênh).
- **Author filter**:
  - `Do not filter by author` — danh tính tác giả không quan trọng.
  - `Apply to certain authors` — chỉ các tác giả được liệt kê mới kích hoạt nhóm này.
  - `Apply to all except certain authors` — các tác giả được liệt kê sẽ được miễn.
- **Authors**: mỗi dòng một tác giả. Chấp nhận `@handle`, URL đầy đủ, `/channel/UC...`, `/c/...`, `/user/...`.
- **Hide blocked entries in the YouTube feed**: khi nhóm này đang chặn, các thẻ khớp trong feed YouTube sẽ bị ẩn. Khi chặn không còn hoạt động, chúng sẽ quay lại ở lần refresh tiếp theo.

Với loại nội dung Shorts và Posts, khi không đặt bộ lọc tác giả và nhóm đang chặn, tiện ích cũng ẩn các mục điều hướng liên quan (mục Shorts ở sidebar, tab Community/Posts của kênh) và các "shelf" tương ứng như "Latest YouTube posts".

Việc phân biệt short và long được mở rộng sang các trang video khác như TikTok, Vimeo, Twitch clips/VODs và Dailymotion khi có thể nhận diện dạng trang.

### 5.3 `TikTok` — chặn nội dung TikTok

Cùng thẻ editor như platform-video editor, nhưng với nhãn riêng cho TikTok:

- Loại nội dung: short videos, videos, profile pages.
- Tác giả: handle TikTok (`@handle`) hoặc URL trang cá nhân.
- Tính năng ẩn feed sẽ ẩn các thẻ khớp trên trang TikTok khi nhóm đang hoạt động.

### 5.4 `Facebook` — chặn nội dung Facebook

- Loại nội dung: Reels, videos, posts.
- Tác giả: tên trang (`page.name`), URL profile hoặc dạng `profile.php?id=...` (ID số được giữ dưới dạng `id:<number>`).
- Ẩn feed sẽ ẩn các thẻ feed khớp trên Facebook.

### 5.5 `Instagram` — chặn nội dung Instagram

- Loại nội dung: Reels, videos, posts.
- Tác giả: handle Instagram hoặc URL profile.
- Các đường dẫn dành riêng như `/reel/`, `/p/`, `/tv/`, `/explore/` không được coi là tác giả.
- Ẩn feed sẽ ẩn các thẻ khớp trên Instagram.

### 5.6 `Twitch` — chặn nội dung Twitch

- Loại nội dung: clips, streams/VODs, channel pages.
- Tác giả: tên kênh hoặc URL kênh.
- Các đường dẫn dành riêng như `/directory`, `/videos`, `/settings`, v.v. không được coi là tên kênh.
- Ẩn feed sẽ ẩn các thẻ khớp trên Twitch.

### 5.7 `Reddit` — chặn Reddit hoặc các subreddit cụ thể

- **Subreddits**: mỗi dòng một subreddit. Danh sách trống nghĩa là nhóm áp dụng cho toàn bộ Reddit. Chấp nhận cả `productivity` và `r/productivity`.

### 5.8 `Custom` — chặn bằng hàm JavaScript

Bạn viết một hàm JavaScript. Tiện ích gọi hàm này khoảng mỗi giây và dùng giá trị trả về làm blocklist hiện tại.

Nhóm `Custom` không hiển thị: hành vi chặn, blocked sites, allowed minutes, reset interval, schedule days hoặc time windows. Chúng chỉ có một ô lớn — hàm **Blocking Rules** — cộng với điều khiển đóng băng/tạm hoãn tiêu chuẩn.

Xem **Mục 11** để có tham khảo đầy đủ về custom rules và helpers API.

---

## 6. Hành vi chặn

Với hầu hết loại nhóm, bạn chọn một trong hai chế độ:

### 6.1 Chặn ngay lập tức

Quy tắc hoạt động khi nhóm đang bật, lịch cho phép, và (với nhóm nền tảng) trang hiện tại khớp.

Với nhóm `Default`, chế độ này dùng chặn gốc của Chrome. Với nhóm nền tảng, nó dùng logic overlay/thoát ngay trong trang.

### 6.2 Chặn sau một số phút

Đây là một ngân sách sử dụng.

- **Allowed minutes before block** (số thập phân): số phút bạn tự cho phép trong mỗi chu kỳ. Ví dụ: `15`, `0.5`, `90`.
- **Timer reset interval (hours)** (số thập phân): tần suất reset ngân sách. Ví dụ: `24` cho hàng ngày, `1` cho hàng giờ, `0.25` cho mỗi 15 phút.

Khi còn thời gian, trang hoạt động bình thường và hiển thị overlay timer. Khi ngân sách về 0, trang bị chặn trong phần còn lại của chu kỳ và overlay hiện `0:00`, sau đó tab sẽ cố thoát.

Tiện ích hoạt động theo từng nhóm, từng chu kỳ:

- Mỗi nhóm có ngân sách riêng.
- Thời gian sử dụng trên bất kỳ trang nào khớp nhóm đều tính vào ngân sách của nhóm đó.
- Nhiều tab trong cùng nhóm dùng chung ngân sách. Timer của chúng luôn đồng bộ; chuyển tab cũng ép refresh để hiển thị ngay thời gian chung hiện tại.

Nếu nhiều nhóm giới hạn thời gian cùng áp dụng lên một trang, nhóm nghiêm ngặt nhất sẽ thắng.

---

## 7. Lịch

Trong thẻ **Schedule**, bạn có thể giới hạn khi nào một nhóm hoạt động:

- **Days to block**: chọn các ngày nhóm áp dụng. Ngày không chọn nghĩa là nhóm không hoạt động vào ngày đó.
- **Time windows**: danh sách tự do, mỗi dòng một khung `HHMM-HHMM`, ví dụ:

  ```
  0900-1000
  1200-1300
  ```

  Nhóm chỉ hoạt động trong các khung giờ này. Danh sách trống nghĩa là cả ngày.

Áp dụng cho mọi loại nhóm ngoại trừ `Custom`.

---

## 8. Freeze (chống can thiệp)

Đóng băng giúp nhóm khó bị tắt theo bốc đồng.

Trong thẻ **Freeze**, bạn chọn:

- **Frozen** — bạn không thể chỉnh sửa hoặc xóa nhóm, và không thể bỏ chọn bật nhóm. Để thay đổi bất cứ thứ gì, bạn phải chạy nghi thức bỏ đóng băng (xem bên dưới).
- **Strict frozen** — giống Frozen, nhưng sẽ khóa trong số giờ bạn chọn (thập phân, tối đa 72). Trước khi hết timer này, ngay cả nghi thức bỏ đóng băng cũng không khả dụng.

Khi nhóm đóng băng có thể mở khóa, nút **Unfreeze** sẽ xuất hiện. Bấm vào đó sẽ bắt đầu **nghi thức 20 bước**:

- Hộp thoại hiển thị thông điệp kỷ luật bản thân.
- Bạn phải bấm `Confirm` 20 lần.
- Có thời gian chờ bắt buộc 5 giây giữa các lần bấm.
- Nếu hủy ở bất kỳ bước nào, bạn phải bắt đầu lại từ bước 1.
- 20 thông điệp sẽ luân phiên để bạn thực sự đọc chúng.

Nếu nhóm cũng được đánh dấu "no snooze" (xem mục sau), bạn cũng không thể snooze khi đang đóng băng.

Trạng thái freeze được hiển thị trong dòng meta của thẻ nhóm, gồm cả thời gian còn lại của strict freeze.

---

## 9. Snooze (tắt tạm thời)

Snooze tạm thời vô hiệu hóa một nhóm mà không cần bỏ đóng băng, nhưng chỉ khi có lý do bằng văn bản.

Trong thẻ **Snooze**:

- **Allow snooze for this group** — nếu tắt, nhóm này hoàn toàn không thể snooze (kể cả khi đang freeze).
- **Snooze for (minutes)** — số thập phân, thời lượng snooze.
- **Reason** — phải **ít nhất 100 ký tự và hơn 20 từ**. Nút Start sẽ bị vô hiệu cho đến khi đáp ứng cả hai điều kiện. Nếu không đạt, cảnh báo inline sẽ hiện cạnh nút.

Nếu nhóm đang freeze, số phút snooze bị khóa ở giá trị đã chọn trước khi freeze. Bạn vẫn có thể snooze, miễn là được phép snooze và lý do đáp ứng quy tắc.

Một thông báo trạng thái sẽ xác nhận snooze. Khi hết snooze, nhóm tự động quay lại bình thường.

Bạn cũng có thể kết thúc snooze sớm bằng nút **End Snooze**.

---

## 10. Thao tác hàng loạt

- **Delete All** xóa mọi nhóm.
  - Luôn yêu cầu xác nhận.
  - Nếu có ít nhất một nhóm freeze, cần cùng nghi thức 20 bước như bỏ đóng băng.
  - Nếu có nhóm strict-frozen còn đang khóa, **Delete All** sẽ bị vô hiệu.

---

## 11. Nhóm Custom (tham khảo đầy đủ)

Một nhóm `Custom` chạy một hàm JavaScript trong background service worker. Hàm này được gọi khoảng mỗi giây, và tiện ích dùng giá trị trả về để quyết định domain nào cần bị chặn ngay lúc đó.

### 11.1 Chữ ký hàm

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  // your logic
  return blockedDomains;
}
```

Tham số:

- `month` — từ `1` đến `12`.
- `dayOfMonth` — từ `1` đến `31`.
- `dayName` — ví dụ `"Monday"`.
- `hour` — từ `0` đến `23`.
- `minute` — từ `0` đến `59`.
- `blockedDomains` — danh sách domain đang chạy mà các quy tắc khác đã tạo ra. Bạn có thể thêm vào, thay thế hoặc bỏ qua nó.
- `helpers` — gói các đối tượng helper (xem bên dưới).

Giá trị trả về:

- Một mảng chuỗi domain cần chặn ngay lúc này, HOẶC
- không trả gì cả (khi đó tiện ích dùng giá trị bạn đã mutate trong `blockedDomains`).

Hàm được kiểm tra khi bạn lưu. Lỗi cú pháp sẽ tạo cảnh báo trạng thái và quy tắc không được dùng cho đến khi bạn sửa. Nếu hàm ném lỗi khi chạy, tiện ích sẽ bắt lỗi, log vào console nền và quay về kết quả trước đó.

### 11.2 Lập lịch thích ứng

Custom rules thường chạy khoảng mỗi giây. Nếu quy tắc của bạn bắt đầu chạy quá lâu, tiện ích tự động làm chậm vòng lặp (tối đa khoảng mỗi 5 giây). Bạn không cần tự quản lý việc này.

### 11.3 Đối tượng `helpers`

Trong hàm, `helpers` cung cấp nhiều sub-helper. Mỗi helper có cả tên dài và alias ngắn. Ngoài ra còn có getter rõ ràng:

- `helpers.timerHelper` / `helpers.timer` / `helpers.getTimerHelper()`
- `helpers.persistenceHelper` / `helpers.persistence` / `helpers.getPersistenceHelper()`
- `helpers.domainHelper` / `helpers.domain` / `helpers.getDomainHelper()`
- `helpers.logHelper` / `helpers.log` / `helpers.getLogHelper()`
- `helpers.platformHelper` / `helpers.platform` / `helpers.getPlatformHelper()`
- `helpers.now` — epoch time hiện tại theo milliseconds.

Tất cả phương thức helper được thiết kế an toàn: tham số sai sẽ trả về `null`, `false` hoặc giá trị rỗng thay vì ném lỗi.

#### 11.3.1 `timerHelper`

Quản lý bộ đếm ngược gắn với một domain. Timer tồn tại qua cả lần khởi động lại trình duyệt. Mỗi timer thuộc về nhóm custom đã tạo ra nó.

- `createTimer(domain, durationMs, displayName?)` — tạo và trả về một timer id duy nhất, hoặc `null` nếu không hợp lệ. Ví dụ: `createTimer("youtube.com", 30 * 60 * 1000, "Timer1")`. Khi người dùng ở trang khớp domain đó, overlay trong trang sẽ hiển thị `Timer1: 30:00` và đếm ngược.
- `deleteTimer(id)` — xóa timer. Trả về `true` nếu thành công.
- `pauseTimer(id)` — tạm dừng đếm ngược.
- `continueTimer(id)` / `resumeTimer(id)` — tiếp tục timer đã tạm dừng.
- `resetTimer(id, durationMs?)` — khởi động lại timer. Không truyền `durationMs` thì dùng lại giá trị ban đầu.
- `addMs(id, ms)` — cộng milliseconds (hoặc trừ nếu là giá trị âm).
- `remainingMs(id)` — milliseconds còn lại.
- `isExpired(id)` / `isPaused(id)` / `exists(id)` — boolean.
- `getDomain(id)` / `getDisplayName(id)` — đọc thông tin timer.
- `findByDomain(domain)` — mảng timer id của domain đó.
- `list()` — mảng `{ id, domain, displayName, durationMs, remainingMs, isPaused }` cho mọi timer mà nhóm này sở hữu.

Thời lượng timer tối đa khoảng 30 ngày.

#### 11.3.2 `persistenceHelper`

Kho lưu trữ dạng map theo phạm vi nhóm của bạn. Giá trị phải tuần tự hóa JSON được. Hữu ích để ghi nhớ trạng thái giữa các lần gọi.

- `set(key, value)` — lưu bất kỳ giá trị JSON nào. Trả về `true` nếu thành công.
- `get(key, defaultValue?)` — trả về giá trị đã lưu, hoặc `defaultValue` nếu thiếu.
- `has(key)` / `delete(key)` / `keys()` / `entries()` / `size()` / `clear()`.

Giới hạn mềm: khoảng 200 key mỗi nhóm, 16 KB mỗi giá trị.

#### 11.3.3 `domainHelper`

- `normalize(value)` — trả về domain chuẩn như `youtube.com`, hoặc `null`.
- `matches(hostname, site)` — `true` nếu `hostname` thuộc `site` (bao gồm subdomain).

#### 11.3.4 `logHelper`

- `log(...args)`, `warn(...args)`, `error(...args)` — ghi vào console nền.

Để xem các thông báo này: `chrome://extensions` → bật Developer Mode → bấm link "service worker" của tiện ích.

#### 11.3.5 `platformHelper`

Kiểm tra các nền tảng social/video được hỗ trợ.

- `supportedPlatforms` — `["youtube", "tiktok", "facebook", "instagram", "twitch"]`.
- `normalizePlatform(value)` — trả về tên nền tảng chuẩn, hoặc `null`.
- `normalizeAuthor(author, platform)` — chuẩn hóa định danh tác giả (handle, URL, v.v.) cho nền tảng cụ thể, hoặc `null`.
- `detect(urlOrHost)` / `getContext(urlOrHost)` — trả về `{ platform, hostname, pathname, type, authors, url }`, hoặc `null`.
  - `type` là `"short" | "long" | "post" | "unknown"`.
  - `authors` là danh sách tác giả đã chuẩn hóa có thể phát hiện từ URL đó.
- `getType(urlOrHost)` — lối tắt cho `detect(...).type`.
- `getPlatform(urlOrHost)` — lối tắt cho `detect(...).platform`.
- `getAuthors(urlOrHost)` — lối tắt cho `detect(...).authors`.
- `matchesAuthor(urlOrHost, platform, authors)` — trả về `true` nếu URL thuộc nền tảng đó và khớp một trong các tác giả đã cho.

### 11.4 Ví dụ

Dễ: chặn mạng xã hội vào buổi sáng các ngày trong tuần.

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const isWeekday = !["Saturday", "Sunday"].includes(dayName);

  if (isWeekday && hour >= 9 && hour < 12) {
    return [...blockedDomains, "facebook.com", "instagram.com", "tiktok.com"];
  }

  return blockedDomains;
}
```

Trung bình: 30 phút YouTube mỗi phiên trình duyệt, với đếm ngược hiển thị rõ.

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

Khó hơn: chỉ chặn phiên TikTok nếu đó là short videos VÀ tác giả nằm trong danh sách gây xao nhãng của bạn. Dùng `platformHelper`.

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

(`globalThis.location` chỉ là placeholder ví dụ — thông thường bạn sẽ điều khiển `platformHelper` bằng logic riêng của bạn, không phải từ location của worker, vì background worker không có URL trang thực.)

Khó nhất: xoay vòng "site of the day" với hạn mức mỗi ngày, lưu bền qua các lần khởi động lại.

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

## 12. Hành vi đa trang

- Mọi tab đang mở trong cùng một nhóm đều dùng chung một timer.
- Khi bạn chuyển sang tab thuộc cùng nhóm, overlay của tab đó được refresh ngay để hiển thị thời gian chung hiện tại.
- Khi thêm quy tắc mới, mọi trang đang mở phát hiện thay đổi và refresh trong một phần nhỏ của giây; bạn không cần tự reload tab.
- Khi quy tắc hết hiệu lực, các thẻ feed và nút điều hướng đã ẩn sẽ được khôi phục ở lần refresh tiếp theo.

---

## 13. Quốc tế hóa

Toàn bộ UI được dịch đầy đủ. Dùng bộ chọn **Language** ở góc trên bên phải.

Các ngôn ngữ được hỗ trợ gồm English, Chinese (Simplified), Spanish, Japanese, Korean, cùng phạm vi một phần cho Hindi, Arabic, Bengali, Portuguese, Russian, Punjabi, German, French, Turkish, Vietnamese, Italian, Thai, Dutch, Polish, Indonesian, Urdu và Persian. Những ngôn ngữ chỉ có phạm vi một phần sẽ fallback sang tiếng Anh cho chuỗi còn thiếu.

Bản thân tài liệu hướng dẫn sẽ tải file markdown khớp ngôn ngữ bạn chọn, với tiếng Anh là fallback.

---

## 14. Thông báo trạng thái

Thông báo trạng thái hiển thị dạng toast ở giữa màn hình và mờ dần sau khoảng hai giây:

- "Saved changes."
- "Created \"Group name\"."
- Lỗi xác thực như "Allowed minutes must be a number greater than 0."
- "Snooze minutes must be a number greater than 0."
- "Frozen groups cannot be changed."

Với các ô nhập có yêu cầu định dạng, thông báo cũng xuất hiện cạnh nút liên quan (đối với snooze).

---

## 15. Quyền riêng tư và lưu trữ

- Mọi thứ được lưu cục bộ trong `chrome.storage.local`. Không dữ liệu nào được gửi đi đâu cả.
- Dữ liệu được lưu gồm: nhóm của bạn, timer sử dụng, thời điểm reset gần nhất, bản ghi snooze, timer custom và giá trị persistent custom.
- Tiện ích không đọc nội dung trang vượt quá mức cần để nhận diện loại trang (path/hostname/DOM marker đã biết cho trang video). Nó không đọc tin nhắn, bài đăng, bình luận hoặc nội dung riêng tư của bạn.

---

## 16. Quyền hạn

- `storage` — cho dữ liệu nêu trên.
- `declarativeNetRequest` — cho chặn gốc của nhóm `Default`.
- `alarms` — để lập lịch chuyển trạng thái quy tắc hiệu quả.
- `host_permissions: <all_urls>` — để content script có thể hiển thị overlay timer và nhận diện ngữ cảnh nền tảng trên mọi trang.

---

## 17. Khắc phục sự cố

- **Nhóm tôi thêm vào không làm gì cả.** Hãy đảm bảo nhóm đã bật, lịch hiện tại cho phép, không có snooze đang hoạt động, và (với nhóm nền tảng) trang thực sự khớp content type cùng author filter đã chọn.
- **Timer bị đứng hoặc sai trên một tab.** Chuyển sang tab khác rồi quay lại, hoặc focus tab đó — thao tác này kích hoạt refresh cưỡng bức từ timer dùng chung.
- **Thẻ feed hiện lại dù tôi nghĩ chúng phải bị ẩn.** Ẩn feed chỉ chạy khi quy tắc đang chặn tích cực. Nếu bạn dùng quy tắc `after-minutes`, ẩn feed sẽ bắt đầu khi thời gian của bạn chạm 0.
- **Một nút điều hướng YouTube tôi mong bị ẩn vẫn còn.** Ẩn điều hướng yêu cầu quy tắc đặt là "do not filter by author" và content type là Shorts hoặc YouTube posts. Khi có author filter, chỉ ẩn theo từng thẻ.
- **Custom rule không làm gì hoặc lỗi im lặng.** Mở `chrome://extensions`, bật Developer Mode, bấm link "service worker" của tiện ích và kiểm tra console. Dùng `helpers.logHelper.log(...)` để trace quy tắc.
- **Tôi không thể xóa một nhóm.** Có thể nhóm đang freeze. Nhóm strict-frozen không thể xóa cho đến khi hết thời gian khóa; nhóm frozen không strict có thể xóa thông qua nghi thức bỏ đóng băng.

---

## 18. Thuật ngữ

- **Block group** — một bộ quy tắc với loại, hành vi, lịch và freeze/snooze riêng.
- **Instant block** — quy tắc chặn ngay lập tức bất cứ khi nào nó đang hoạt động.
- **After-minutes block** — quy tắc chỉ bắt đầu chặn sau khi ngân sách thời gian của chu kỳ đã cạn.
- **Reset interval** — tần suất ngân sách after-minutes được reset.
- **Schedule** — ngày + khung giờ mà nhóm hoạt động.
- **Freeze / Strict freeze** — các trạng thái chống can thiệp.
- **Snooze** — tắt tạm thời với lý do bằng văn bản.
- **Author filter** — với nhóm nền tảng, giới hạn quy tắc vào các nhà sáng tạo nội dung nhất định.
- **Content type** — với nhóm nền tảng, giới hạn quy tắc vào các dạng nội dung nhất định (short, long, post).
- **Helpers** — các tiện ích được truyền vào hàm quy tắc custom.
- **Platform** — một trong `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`. Mỗi nền tảng có loại nhóm và logic ẩn feed riêng.

---

## 19. Giới hạn

- Ẩn feed phụ thuộc vào DOM hiện tại của từng nền tảng. Nếu nền tảng thay đổi layout, selector ẩn có thể cần cập nhật.
- Việc phát hiện ngữ cảnh nền tảng cho các trang không phải YouTube chủ yếu dựa trên URL, nên đáng tin cậy nhất trên URL nội dung chuẩn.
- Vòng lặp custom rule chạy trong background worker, không chạy trong trang, nên thông tin cấp DOM không khả dụng trong hàm. Hãy dùng `platformHelper.detect(url)` với chuỗi URL.
- Trình duyệt có thể tạm dừng service worker khi rảnh. Tiện ích sẽ khôi phục ngay khi trang hoặc alarm cần; timer sử dụng sẽ không mất độ chính xác vì điều này.

