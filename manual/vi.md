# Trình chặn web tùy chỉnh - Hướng dẫn sử dụng

Đây là tài liệu tham khảo đầy đủ cho phần mở rộng. Nó bắt đầu với các quy trình công việc dễ dàng nhất, phổ biến nhất và dần dần chuyển sang các chủ đề nâng cao như quy tắc chặn theo sự kiện tùy chỉnh và API trợ giúp.

Nếu bạn là người mới, chỉ cần đọc **Bắt đầu nhanh** và **Tổng quan về chặn nhóm**. Mọi thứ bên dưới các phần đó đều là tùy chọn, tùy thuộc vào những gì bạn muốn làm.

---

## 1. Tiện ích mở rộng này làm gì

Trình chặn web tùy chỉnh cho phép bạn chặn các trang web và các phiền nhiễu trực tuyến theo các quy tắc bạn tự xác định. Bạn có thể:

- Chặn các trang web ngay lập tức bằng tính năng chặn mạng gốc của trình duyệt (cùng loại khối tạo ra `ERR_BLOCKED_BY_CLIENT`).
- Cho phép bản thân dành một số phút nhất định mỗi ngày trên một trang web, sau đó chặn nó khi bạn vượt quá giới hạn đó.
- Chặn các loại nội dung cụ thể trên Du-túp, Tích Tốc, Phây-búc, In-xta-gam, Tuých và Rét-đít (không phải toàn bộ trang web).
- Ẩn nội dung bị chặn khỏi nguồn cấp dữ liệu trên các nền tảng được hỗ trợ thay vì chỉ chặn các trang đơn lẻ.
- Lên lịch khi quy tắc được kích hoạt theo ngày trong tuần và theo khung thời gian `HHMM-HHMM`.
- Đóng băng một quy tắc để bạn không thể dễ dàng thay đổi nó. Tính năng đóng băng nghiêm ngặt sẽ khóa nó trong một số giờ nhất định và yêu cầu quy trình xác nhận 20 bước để hoàn tác.
- Tạm thời tạm dừng một quy tắc, nhưng chỉ sau khi viết một lời giải thích đủ dài.
- Viết các quy tắc tùy chỉnh **theo hướng sự kiện** trong ngôn ngữ kịch bản với các công cụ trợ giúp cho bộ hẹn giờ tiến/lùi, bộ nhớ liên tục cho mỗi nhóm, ý định DOM trên mỗi nền tảng (ẩn nút điều hướng, ẩn thẻ nguồn cấp dữ liệu theo vị từ, đặt bộ hẹn giờ cho mỗi tiểu mục), tiện ích URL và ghi nhật ký có cấu trúc.
- Chọn từ thư viện tích hợp gồm hơn 50 mẫu tạo sẵn (bộ hẹn giờ, lịch biểu, ẩn nguồn cấp dữ liệu, phiên tập trung, chuyển hướng, nhắc nhở, kiên trì, chỉnh sửa DOM, trợ giúp gỡ lỗi).
- Sử dụng tiện ích mở rộng bằng hơn 20 ngôn ngữ.

Tiện ích mở rộng này là tiện ích mở rộng trình duyệt Cờ-rôm Manifest V3 với một trang soạn thảo (cửa sổ bật lên), một nhân viên dịch vụ nền, một hộp cát ngoài màn hình lưu trữ mã quy tắc tùy chỉnh và một tập lệnh nội dung chạy trên mỗi trang. Quy tắc tùy chỉnh tồn tại trong hộp cát ngoài màn hình; chúng được tải một lần cho mỗi lần nhấp Chạy và duy trì đăng ký cho đến khi quy tắc bị vô hiệu hóa hoặc bị xóa.

---

## 2. Tham quan giao diện người dùng

Khi bạn nhấp vào biểu tượng của tiện ích mở rộng, trình chỉnh sửa sẽ mở ra dưới dạng một trang web đầy đủ (không phải một cửa sổ bật lên nhỏ). Trang này có các khu vực sau:

- **Thanh trên cùng**
  - Nút **Hướng dẫn sử dụng** (tài liệu này)
  - Bộ chọn **Ngôn ngữ**
  - Thiết bị **Cài đặt** (các nút chuyển đổi nâng cao, bao gồm **Chế độ gỡ lỗi**)
- **Bảng bên trái — Nhóm khối**
  - Danh sách các nhóm khối của bạn. Mỗi thẻ hiển thị tên nhóm, một dòng tóm tắt ngắn và hộp kiểm bật/tắt.
  - Nút **Thêm** tạo một nhóm mới. Trình đơn thả xuống bên cạnh sẽ chọn loại.
  - **Xóa tất cả** xóa mọi nhóm, kèm theo xác nhận bổ sung nếu bất kỳ nhóm nào bị đóng băng.
  - Bạn có thể kéo tay cầm `::` trên thẻ lên hoặc xuống để sắp xếp lại các nhóm.
  - Bạn có thể kéo bộ chia dọc để thay đổi kích thước bảng này.
- **Bảng bên phải — Biên tập**
  - Chỉnh sửa nhóm hiện được chọn: tên, hành vi chặn, danh sách chặn, bộ lọc theo loại cụ thể, lịch trình, đóng băng, báo lại.
  - Tất cả các thay đổi sẽ tự động lưu trong một phần giây sau khi bạn ngừng nhập hoặc tương tác.
  - Đối với các nhóm **Tùy chỉnh**, trình chỉnh sửa cũng hiển thị trình duyệt **Mẫu**, nút **Chạy** và bảng **Nhật ký** (được đổi tên từ *Nhật ký hoạt động* trong v1.1).
- **Bánh mì nướng** (cửa sổ bật lên ở giữa mờ dần) — hiển thị các thông báo trạng thái như "Các thay đổi đã lưu". hoặc lỗi đầu vào.
- **Lớp phủ trong trang** — trong khi một tab có bất kỳ bộ đếm thời gian hoặc khối hoạt động nào, lớp phủ sẽ xuất hiện ở góc trên cùng bên trái của nó hiển thị mọi ràng buộc ảnh hưởng đến nó ở định dạng `hh:mm:ss` (hoặc `mm:ss`). Nhiều ràng buộc xếp chồng lên nhau trên nhiều dòng. Bộ đếm ngược nhóm khối mặc định và bộ tính giờ quy tắc tùy chỉnh chia sẻ lớp phủ này.

---

## 3. Bắt đầu nhanh1. Nhấp vào biểu tượng tiện ích mở rộng. Trình chỉnh sửa mở ra dưới dạng một trang đầy đủ.
2. Trong bảng **Chặn nhóm**, chọn loại nhóm từ danh sách thả xuống:
   - `Default`, `Du-túp`, `Tích Tốc`, `Phây-búc`, `In-xta-gam`, `Tuých`, `Rét-đít` hoặc `Custom`.
3. Nhấp vào **Thêm**. Một nhóm mới xuất hiện và người soạn thảo sẽ mở nó.
4. Đặt tên cho nó.
5. Điền vào các trường dành riêng cho loại (đối với `Default`, nghĩa là danh sách **Trang web bị chặn**).
6. Đảm bảo hộp kiểm của nhóm ở bảng bên trái được bật.
7. Truy cập một trong những trang web được liệt kê. Việc chặn sẽ có hiệu lực ngay lập tức.

Đó là toàn bộ con đường hạnh phúc. Phần còn lại của hướng dẫn này chỉ là các tùy chọn ở trên.

> Khi bạn nhấn **Chạy** trên nhóm Tùy chỉnh, quy tắc mới sẽ gắn vào các sự kiện trang **tương lai**. Các tab đã mở sẽ tiếp tục chạy quy tắc trước đó cho đến khi bạn tải lại chúng. Cửa sổ bật lên hiển thị lời nhắc về hiệu ứng đó sau mỗi lần Chạy thành công.

---

## 4. Tổng quan về nhóm khối

Mọi thứ trong tiện ích mở rộng này được sắp xếp dưới dạng **nhóm khối**. Một nhóm khối là một bộ quy tắc:

- Nó có tên, loại và trạng thái bật/tắt.
- Nó có hành vi chặn (ngay lập tức, sau một vài phút hoặc đếm ngược cố định).
- Nó có lịch trình tùy chọn (ngày + cửa sổ thời gian) và các điều khiển đóng băng/báo lại tùy chọn.
- Tùy thuộc vào loại, nó có các trường bổ sung như danh sách trang web, bộ lọc người sáng tạo trên Du-túp, tên subreddit hoặc quy tắc ngôn ngữ kịch bản theo sự kiện.

Bạn có thể có bất kỳ số lượng nhóm. Nhiều nhóm có thể áp dụng cho cùng một trang; trong trường hợp đó quy tắc **nghiêm ngặt nhất** sẽ thắng:

- "Chặn ngay" thay vì "chặn sau một thời gian".
- Nhóm còn ít thời gian hơn sẽ đánh bại nhóm còn lại nhiều thời gian hơn.

Vì vậy, việc thêm nhiều nhóm hơn chỉ có thể tạo ra một khối trang sớm hơn chứ không bao giờ muộn hơn.

**Thứ tự đánh giá là từ dưới lên trên.** Khi tiện ích lặp lại các nhóm khối của bạn, nó sẽ bắt đầu với nhóm ở cuối danh sách và tiến dần lên. Nhóm ở đầu danh sách được đánh giá cuối cùng và nhận được "từ cuối cùng" — ví dụ: nếu nhóm dưới cùng gọi `helpers.getPlatformHelper().youtube().hideShortButton()` và nhóm trên cùng gọi `showShortButton()` thì nút này vẫn hiển thị. Kéo tay cầm `::` trên thẻ để thay đổi thứ tự này.

---

## 5. Các loại nhóm

### 5.1 `Default` — chặn các trang web thông thường

Để chặn các tên miền cụ thể (trường hợp sử dụng điển hình).

- **Các trang web bị chặn**: một trang trên mỗi dòng. Cả `facebook.com` và `https://www.facebook.com/somepage` đều hoạt động; phần mở rộng trích xuất và chuẩn hóa tên máy chủ.
- Quy tắc trang web áp dụng cho tên máy chủ đó và tất cả các tên miền phụ của nó.
- Loại nhóm này sử dụng tính năng chặn mạng gốc của trình duyệt Cờ-rôm, tương tự như `ERR_BLOCKED_BY_CLIENT`. Điều đó có nghĩa là việc điều hướng đến một URL bị chặn sẽ bị dừng trước khi trang tải.

### 5.2 `Du-túp` — chặn Du-túp và các trang video tương tự

Thêm phần **Bộ lọc** vào trình chỉnh sửa:

- **Loại nội dung**:
  - `Apply to all Du-túp pages` — mỗi trang Du-túp đều có giá trị.
  - `Apply to Shorts` — chỉ tính trang Shorts.
  - `Apply to long videos` — chỉ `/watch`, `/live/`, `/embed/`, v.v.
  - `Apply to Du-túp posts` — bài đăng cộng đồng (`/post/...`, tab bài đăng/cộng đồng kênh).
- **Bộ lọc tác giả**:
  - `Do not filter by author` — danh tính tác giả không quan trọng.
  - `Apply to certain authors` — chỉ các tác giả được liệt kê mới kích hoạt nhóm này.
  - `Apply to all except certain authors` — các tác giả được liệt kê được miễn.
- **Tác giả**: một tác giả trên mỗi dòng. Chấp nhận `@handle`, URL đầy đủ, `/channel/UC...`, `/c/...`, `/user/...`.
- **Ẩn các mục bị chặn trong nguồn cấp dữ liệu Du-túp**: trong khi nhóm này đang tích cực chặn, các thẻ phù hợp trong nguồn cấp dữ liệu Du-túp sẽ bị ẩn. Khi khối không hoạt động, chúng sẽ quay trở lại vào lần làm mới tiếp theo.

Đối với loại nội dung Video ngắn và Bài đăng, khi không đặt bộ lọc tác giả và nhóm hiện đang chặn, tiện ích này cũng ẩn các mục điều hướng có liên quan (mục nhập thanh bên Shorts, tab kênh Cộng đồng/Bài đăng) và các giá phù hợp như "Bài đăng mới nhất trên Du-túp".

Việc phát hiện ngắn và dài mở rộng sang các trang web video khác như Tích Tốc, Vimeo, Tuých clip/VOD và Dailymotion khi có thể phát hiện được hình thức trang của chúng.

### 5.3 `Tích Tốc` — chặn nội dung Tích Tốc

Thẻ trình chỉnh sửa tương tự như trình chỉnh sửa video trên nền tảng nhưng có nhãn dành riêng cho Tích Tốc:- Các loại nội dung: video ngắn, video, trang profile.
- Tác giả: Tích Tốc xử lý (`@handle`) hoặc URL hồ sơ.
- Ẩn nguồn cấp dữ liệu sẽ ẩn các thẻ phù hợp trên các trang Tích Tốc khi nhóm đang hoạt động.

### 5.4 `Phây-búc` — chặn nội dung Phây-búc

- Các loại nội dung: Reels, video, post.
- Tác giả: tên trang (`page.name`), URL hồ sơ hoặc dạng `profile.php?id=...` (id số được giữ nguyên là `id:<number>`).
- Ẩn nguồn cấp dữ liệu ẩn các thẻ nguồn cấp dữ liệu phù hợp trên Phây-búc.

### 5.5 `In-xta-gam` — chặn nội dung In-xta-gam

- Các loại nội dung: Reels, video, post.
- Tác giả: Tay cầm In-xta-gam hoặc URL hồ sơ.
- Các đường dẫn dành riêng như `/reel/`, `/p/`, `/tv/`, `/explore/` không được coi là tác giả.
- Ẩn nguồn cấp dữ liệu ẩn các thẻ phù hợp trên In-xta-gam.

### 5.6 `Tuých` — chặn nội dung Tuých

- Loại nội dung: clip, luồng/VOD, trang kênh.
- Tác giả: tên kênh hoặc URL kênh.
- Các đường dẫn dành riêng như `/directory`, `/videos`, `/settings`, v.v. không được coi là tên kênh.
- Ẩn nguồn cấp dữ liệu ẩn các thẻ phù hợp trên Tuých.

### 5.7 `Rét-đít` — chặn Rét-đít hoặc các subreddits cụ thể

- **Subreddits**: một subreddit trên mỗi dòng. Danh sách trống có nghĩa là nhóm áp dụng cho tất cả Rét-đít. Cả `productivity` và `r/productivity` đều được chấp nhận.

### 5.8 `Custom` — chặn bằng ngôn ngữ kịch bản hướng sự kiện

Bạn viết một hàm ngôn ngữ kịch bản **đăng ký trình xử lý** cho các sự kiện như mở trang, thay đổi URL, nhịp độ trang, kết thúc bộ hẹn giờ và các sự kiện tùy chỉnh của riêng bạn. Hàm chạy một lần cho mỗi lần nhấp Chạy; các trình xử lý đã đăng ký vẫn hoạt động trên các điều hướng cho đến khi bạn nhấn Chạy lại, vô hiệu hóa nhóm hoặc xóa nhóm đó.

Các nhóm `Custom` không hiển thị: hành vi chặn, trang web bị chặn, số phút được phép, khoảng thời gian đặt lại, ngày lên lịch hoặc khoảng thời gian. Họ giữ lại trình chỉnh sửa **Quy tắc chặn** cộng với các điều khiển đóng băng/tạm dừng tiêu chuẩn. Ngoài ra còn có nút **Mẫu** để mở trình duyệt cài sẵn với các quy tắc khởi động được tham số hóa; áp dụng giá trị đặt trước sẽ thay thế quy tắc hiện tại sau khi xác nhận.

Xem **Phần 11** để biết đầy đủ thông tin tham khảo về quy tắc tùy chỉnh và API trợ giúp.

---

## 6. Hành vi chặn

Đối với hầu hết các loại nhóm, bạn chọn một trong ba chế độ.

### 6.1 Chặn ngay

Quy tắc này sẽ hoạt động bất cứ khi nào nhóm được bật, lịch trình cho phép và (đối với các nhóm nền tảng) trang phù hợp.

Đối với các nhóm `Default`, tính năng này sử dụng tính năng chặn gốc của trình duyệt Cờ-rôm. Đối với các nhóm nền tảng, nó sử dụng logic lớp phủ/thoát trong trang.

### 6.2 Chặn sau vài phút

Đây là ngân sách sử dụng.

- **Số phút được phép trước khối** (thập phân): số phút bạn cho phép trong mỗi tiết. Ví dụ: `15`, `0.5`, `90`.
- **Khoảng thời gian đặt lại bộ hẹn giờ (giờ)** (thập phân): tần suất đặt lại ngân sách. Ví dụ: `24` hàng ngày, `1` hàng giờ, `0.25` cứ sau 15 phút.

Khi bạn còn thời gian, trang sẽ hoạt động bình thường và hiển thị lớp phủ hẹn giờ. Khi ngân sách chạm đến 0, trang sẽ bị chặn trong thời gian còn lại và lớp phủ hiển thị `0:00`, sau đó tab sẽ cố gắng thoát.

Phần mở rộng là cho mỗi nhóm, mỗi kỳ:

- Mỗi nhóm có ngân sách riêng.
- Thời gian dành cho bất kỳ trang nào phù hợp với nhóm sẽ được tính vào ngân sách của nhóm đó.
- Nhiều tab trong cùng một nhóm chia sẻ ngân sách. Bộ tính giờ của họ luôn được đồng bộ hóa; chuyển sang tab khác cũng buộc phải làm mới để nó hiển thị ngay thời gian chia sẻ hiện tại.

Nếu nhiều nhóm có giới hạn thời gian áp dụng cho cùng một trang, nhóm nào nghiêm ngặt nhất sẽ thắng.

### 6.3 Hẹn giờ (đếm ngược, sau đó chặn)

Chế độ này hiển thị đồng hồ đếm ngược và chặn khi đạt đến `0:00`.

- **Khoảng thời gian đặt lại bộ hẹn giờ (giờ)** (thập phân): cả độ dài bộ hẹn giờ và tần số đặt lại. Ví dụ: `24` hàng ngày, `1` hàng giờ, `0.25` cứ sau 15 phút.

Không giống như **Chặn sau một số phút**, chế độ này **không** có trường "Được phép trước khi chặn" riêng. Bộ hẹn giờ chỉ bắt đầu ở khoảng thời gian đặt lại, đếm ngược trong khi các trang phù hợp được mở, sau đó chặn cho đến lần đặt lại tiếp theo.Cả bộ đếm ngược của nhóm mặc định và bộ hẹn giờ của nhóm tùy chỉnh (xem **Phần 11.3.1**) đều **chỉ tăng lên khi tab hiển thị**. Chuyển đổi tab, thu nhỏ cửa sổ hoặc khóa màn hình sẽ tự động tạm dừng đếm ngược.

---

##7. Lịch trình

Trong thẻ **Lịch trình**, bạn có thể hạn chế khi một nhóm hoạt động:

- **Ngày chặn**: chọn ngày nhóm áp dụng. Những ngày không được kiểm tra có nghĩa là nhóm không hoạt động vào ngày hôm đó.
- **Cửa sổ thời gian**: danh sách dạng tự do, một cửa sổ trên mỗi dòng ở định dạng `HHMM-HHMM`, ví dụ:

  ```
  0900-1000
  1200-1300
  ```

  Nhóm chỉ hoạt động bên trong các cửa sổ đó. Danh sách trống có nghĩa là cả ngày.

Điều này áp dụng cho tất cả các loại nhóm ngoại trừ `Custom`. (Quy tắc tùy chỉnh có thể triển khai lịch trình của riêng mình bằng cách sử dụng `ev.time.dayName` / `ev.time.hour`; xem **Mục 11.4**.)

---

##8. Đóng băng (chống giả mạo)

Việc đóng băng khiến một nhóm khó có thể bị vô hiệu hóa nếu bị thôi thúc.

Tại thẻ **Freeze** bạn chọn:

- **Frozen** — bạn không thể chỉnh sửa hoặc xóa nhóm và bạn không thể bỏ chọn nút bật tắt của nhóm. Để thay đổi bất cứ điều gì, bạn phải chạy nghi thức giải phóng (xem bên dưới).
- **Đóng băng nghiêm ngặt** — giống như Frozen, nhưng nó vẫn bị khóa trong số giờ bạn chọn (thập phân, tối đa 72). Cho đến khi hết giờ, ngay cả nghi thức giải phóng cũng không khả dụng.

Khi có thể mở khóa một nhóm bị đóng băng, nút **Unfreeze** sẽ xuất hiện. Nhấp vào nó sẽ bắt đầu **nghi thức 20 bước**:

- Phương thức hiển thị thông báo kỷ luật tự giác.
- Bạn phải nhấp vào `Confirm` 20 lần.
- Bắt buộc phải chờ 5 giây giữa các lần nhấp.
- Nếu hủy tại bất kỳ thời điểm nào, bạn phải thực hiện lại từ bước 1.
- 20 tin nhắn xoay vòng để bạn thực sự đọc chúng.

Nếu nhóm cũng được đánh dấu là "không báo lại" (xem phần tiếp theo), bạn cũng không thể báo lại nhóm khi bị treo.

Trạng thái đóng băng được hiển thị trong dòng meta của thẻ nhóm, bao gồm cả thời gian đóng băng nghiêm ngặt còn lại.

---

## 9. Snooze (tắt tạm thời)

Báo lại tạm thời vô hiệu hóa một nhóm mà không giải phóng nhóm đó. Nó hỗ trợ kích hoạt chậm, thời gian hồi chiêu sau khi báo lại, các bước xác nhận và tổng thời gian được báo lại.

Trong thẻ **Báo lại**:

- **Cho phép tạm ẩn đối với nhóm này** — nếu tắt, nhóm này hoàn toàn không thể tạm ẩn (kể cả khi bị đóng băng).
- **Báo lại trong (phút)** — số thập phân, thời gian báo lại kéo dài bao lâu.
- **Độ trễ kích hoạt (phút)** — `>= 0` thập phân. Sau khi bạn xác nhận việc tạm dừng, nhóm sẽ tiếp tục chặn cho đến khi thời gian trễ này trôi qua; chỉ khi đó chế độ báo lại mới hoạt động.
- **Thời gian hồi chiêu sau khi báo lại (phút)** — số thập phân từ `0` đến `5`. Sau khi thời gian tạm dừng kết thúc, bạn không thể bắt đầu thời gian tạm hoãn khác cho nhóm này cho đến khi thời gian hồi chiêu kết thúc.
- **Số lần xác nhận** — số nguyên `>= 0`. Nếu đây là `0`, chế độ báo lại sẽ được lên lịch ngay lập tức. Nếu không, việc bắt đầu báo lại sẽ khởi chạy một nghi thức xác nhận với chính xác nhiều bước đó.

Mỗi bước xác nhận báo lại có thời gian chờ bắt buộc **5 giây** trước khi cho phép lần nhấp tiếp theo. Phương thức cho bạn biết điều này một cách rõ ràng và hiển thị đếm ngược trực tiếp trên nút.

Nếu nhóm bị đóng băng, cài đặt báo lại sẽ bị khóa ở các giá trị được chọn trước khi đóng băng. Bạn vẫn có thể báo lại, miễn là cho phép báo lại, nhưng bạn phải sử dụng cài đặt độ trễ/thời gian hồi chiêu/xác nhận đã lưu.

Thẻ Tạm ẩn cũng hiển thị **Tổng thời gian đã tạm ẩn** cho nhóm đó. Tổng số này tính toàn bộ thời lượng báo lại đang hoạt động ngay cả khi trang web có thể truy cập được vì một số lý do khác trong khoảng thời gian đó.

Khi thời gian báo lại kết thúc, quy tắc sẽ quay trở lại ngay lập tức. Nếu nhóm chưa bị đóng băng thì tiện ích mở rộng sẽ tự động đóng băng lại khi kết thúc báo lại.

Một thông báo trạng thái xác nhận việc báo lại. Khi thời gian báo lại kết thúc, nhóm sẽ tự động trở lại bình thường.

Bạn cũng có thể kết thúc báo lại sớm bằng nút **Kết thúc báo lại**.

Đối với các nhóm Tùy chỉnh, việc nhấn **Bắt đầu báo lại** cũng gửi sự kiện `snoozePress` vào quy tắc (xem bảng sự kiện trong **Phần 11**), do đó, quy tắc tùy chỉnh có thể ghi lại thao tác nhấn, ghi nhật ký biện minh hoặc kích hoạt các sự kiện tiếp theo. Quy tắc này **không có API báo lại theo chương trình** — nó có thể phản ứng với thao tác nhấn nhưng không thể hủy hoặc mở rộng thao tác nhấn.

---

## 10. Hành động hàng loạt- **Xóa tất cả** xóa mọi nhóm.
  - Nó luôn yêu cầu xác nhận.
  - Nếu có ít nhất một nhóm bị đóng băng thì cần thực hiện nghi thức 20 bước tương tự như việc mở băng.
  - Nếu bất kỳ nhóm nào bị đóng băng nghiêm ngặt và vẫn bị khóa, **Xóa tất cả** sẽ bị tắt.

---

## 11. Nhóm tùy chỉnh — tham chiếu theo hướng sự kiện (v1.1+)

Bắt đầu từ phiên bản 1.1, các quy tắc tùy chỉnh sẽ **theo sự kiện**. Quy tắc của bạn không còn là hàm theo nhịp tim có giá trị trả về chặn trang nữa. Thay vào đó, nội dung quy tắc là một tập lệnh **đăng ký trình xử lý** cho các sự kiện cụ thể (mở trang, thay đổi URL, nhịp độ trang, sự kiện tùy chỉnh, ...). Trình xử lý được đăng ký trên các điều hướng trang và chuyển đổi tab, đồng thời tồn tại bên trong **hộp cát ngoài màn hình** tồn tại lâu dài.

Nội dung quy tắc thực thi **một lần cho mỗi lần nhấp Chạy** (hoặc một lần khi nhóm được bật và nguồn hoạt động đã tồn tại). Để tải lại trình xử lý, hãy nhấp vào **Chạy** trong trình chỉnh sửa. Cửa sổ bật lên hiển thị lời nhắc yêu cầu bạn tải lại bất kỳ trang nào đã mở để quy tắc mới cũng được áp dụng ở đó.

### 11.1 Chữ ký quy tắc

```js
(event, helpers) => {
  // Register handlers here. This function is called exactly once
  // per Run click (or when the group is enabled).
}
```

Hai đối số:

- `event` — **đăng ký sự kiện** cho nhóm này. Sử dụng nó để đăng ký, ghi đè, liệt kê, đếm hoặc hủy đăng ký trình xử lý và các sự kiện tùy chỉnh `post(...)`.
- `helpers` — gói trợ giúp (xem **11.3**).

Hàm **không** được mong đợi sẽ trả về một giá trị. Quyết định chặn hoặc cho phép được đưa ra sau đó, khi một sự kiện diễn ra và một trong những người xử lý đã đăng ký của bạn gọi `ev.preventDefault()` và/hoặc `ev.setResult(...)`.

### 11.2 Vòng đời

- **Chạy** (nút mỗi nhóm trong trình chỉnh sửa): trước tiên, công cụ sẽ xóa mọi trình xử lý đã được gắn thẻ trước đó với nhóm này, sau đó chạy lại nội dung quy tắc trong hộp cát ngoài màn hình. Đây là cách duy nhất để đăng ký lại sau khi chỉnh sửa nguồn.
- **Vô hiệu hóa nhóm**: mọi trình xử lý được gắn thẻ với nhóm này đều bị xóa. Nguồn nhóm được lưu trữ nhưng ngừng phản hồi các sự kiện.
- **Kích hoạt lại nhóm**: engine tự động chạy lại nguồn đang hoạt động cho nhóm này.
- **Xóa nhóm**: tương tự như tắt; tất cả các trình xử lý được gắn thẻ với nhóm đều bị xóa.
- **Đăng ký lại với cùng một `(eventType, id)`**: âm thầm ghi đè đăng ký trước đó.

Hộp cát ngoài màn hình được chia sẻ bởi **tất cả** nhóm tùy chỉnh. Các trình xử lý từ các nhóm khác nhau cùng tồn tại ở đó, mỗi trình xử lý được gắn thẻ nội bộ với id nhóm sở hữu của chúng để việc "Chạy", vô hiệu hóa hoặc xóa chỉ chạm vào đúng nhóm.

Nếu một quy tắc tùy chỉnh hoạt động sai (vòng lặp vô hạn đồng bộ, spam nhật ký chạy trốn, v.v.), hộp cát sẽ cách ly quy tắc đó: nhóm sẽ tự động bị vô hiệu hóa và lỗi được ghi lại để bạn có thể nhìn thấy trong bảng Nhật ký. Để kích hoạt lại quy tắc đã cách ly, hãy sửa nguồn và nhấp vào **Chạy** — công cụ sẽ xóa lý do hủy bỏ và tải lại quy tắc.

### 11.2.1 Sổ đăng ký sự kiện (`event`)

Các phương pháp chung:

- `event.register(type, id, handler, options?)` — đăng ký trình xử lý cho loại sự kiện tùy ý. `id` là sự lựa chọn của riêng bạn. `options.priority` (`0` mặc định) — cao hơn chạy trước. `options.intervalMs` — chỉ dành cho `tickEvent`; điều tiết trình xử lý cụ thể này liên quan đến dấu tích chung. Đăng ký lại với phần ghi đè `(type, id)` tương tự.
- `event.unregister(type, id)`, `event.unregisterAll(type)`.
- `event.post(type, data?, { scope })` — kích hoạt một sự kiện tùy chỉnh. `scope: "global"` tiếp cận mọi nhóm; `scope: "group"` mặc định chỉ tiếp cận các trình xử lý trong nhóm **cùng**.

Đường theo loại sự kiện (một bộ phương thức cho mỗi loại tích hợp):

- `event.registerTickEvent(id, handler, opts)`, `event.getTickEvent(id)`, `event.getTickEvents()`, `event.countTickRegistered()`.
- `event.registerOpenWebEvent(id, handler, opts)`, `event.getOpenWebEvent(id)`, `event.getOpenWebEvents()`, `event.countOpenWebRegistered()`.
- Hình dạng tương tự cho `closeWebEvent`, `switchWebEvent`, `switchDomainEvent`, `webChangedEvent`, `pageHeartbeatEvent`, `timerEnded`, `snoozePress`.

### 11.2.2 Các loại sự kiện tích hợp

| Loại | Khi nó cháy | Tải trọng `ev.data` |
|---|---|---|
| `tickEvent` | Tích tắc 1 giây được chia sẻ toàn cầu trên toàn bộ trình duyệt. Kích hoạt bất kể chế độ hiển thị tab. Sử dụng tính năng này cho logic kiểu đồng hồ phải tiếp tục chạy ngay cả khi không có tab nào được tập trung. | `{ intervalMs: 1000 }` |
| `pageHeartbeatEvent` | Nhịp tim ~250 ms từ tab **hoạt động**, **hiển thị**. Thúc đẩy tất cả logic nhận biết khả năng hiển thị tab, bao gồm cả đánh dấu tự động được tích hợp trong `getOrCreateTimer({ scope })`. **không** kích hoạt từ các tab nền hoặc khi màn hình bị khóa. | `{ elapsedMs }` |
| `openWebEvent` | Một tab mới được tạo HOẶC một điều hướng mới xuất hiện trên một URL mà công cụ chưa thấy cho tab đó. **không** kích hoạt lại các tab đã mở sau khi nhấp vào Chạy. | `{ previousUrl, isNewTab }` |
| `closeWebEvent` | Một tab đã được đóng lại. | `{ reason, nextUrl }` |
| `switchWebEvent` | URL **thay đổi** bên trong cùng một tab - lùi/chuyển tiếp, thay đổi tuyến đường SPA hoặc điều hướng đến một URL khác với URL trước đó. **không** kích hoạt khi tải lại đơn giản (cùng một URL). | `{ previousUrl, previousHostname, sameDomain }` |
| `switchDomainEvent` | Thay đổi URL vượt qua ranh giới tên máy chủ (ví dụ: `youtube.com` → `wikipedia.org`). Bắn cùng với `switchWebEvent`. | `{ previousUrl, previousHostname }` |
| `webChangedEvent` | Trang (tải lại) theo bất kỳ cách nào: mở, chuyển đổi, cập nhật lịch sử SPA, **hoặc tải lại đơn giản nhưng vẫn giữ nguyên URL**. Đây là câu hook "trang đã thay đổi, đánh giá lại mọi thứ" đáng tin cậy. Kích hoạt cùng với `openWebEvent` / `switchWebEvent` / `switchDomainEvent` và là loại duy nhất kích hoạt khi tải lại cùng một URL. | `{ previousUrl, previousHostname, sameDomain, isFirstLoad, isReload, transition }` trong đó `transition` là `"tabCreated"`, `"commit"` hoặc `"history"` |
| `timerEnded` | Bộ đếm thời gian do nhóm quản lý đạt `currentMs === 0`. Chỉ giao cho nhóm sở hữu. | `{ timerId, displayName, direction, currentMs }` |
| `snoozePress` | Người dùng đã nhấn **Bắt đầu báo lại** trong cửa sổ bật lên cho nhóm **tùy chỉnh** này. Sự kiện thông báo thuần túy — trình xử lý có thể chạy mã tùy ý (ghi nhật ký, chuyển hướng, kích hoạt các sự kiện khác) nhưng quy tắc tùy chỉnh **không có API báo lại theo chương trình**. Nhật ký được tạo ở đây hiển thị dưới dạng nâng cao trên tab đang hoạt động. Chỉ giao cho nhóm ép. | `{ triggeredAt }` |

Các URL trong `ev.url` và trong dữ liệu sự kiện được **chuẩn hóa** cho các sự kiện: Trang tab mới của trình duyệt Cờ-rôm (hiển thị bề mặt "Tìm kiếm trên Google hoặc nhập URL" của Google), `about:blank` và các sơ đồ tab mới tương đương được hiển thị dưới dạng chuỗi trống `""`. Vì vậy, đồng hồ hẹn giờ trong phạm vi `ev.url === ""` chỉ tích tắc khi bạn đang ở trang tab mới. URL `google.com` thông thường không thay đổi.

### 11.2.3 Đối tượng sự kiện (`ev`)

Mọi trình xử lý đều được gọi là `(ev, helpers) => void`. `ev` mang:

- `ev.type` — loại sự kiện được gửi đi.
- `ev.groupId` — id của nhóm nhận.
- `ev.tabId`, `ev.pageId`, `ev.url`, `ev.hostname` — bối cảnh cho sự kiện.
- `ev.time` — Ảnh chụp nhanh `{ now, month, dayOfMonth, dayName, hour, minute }` khi gửi đi. `dayName` là `"Sunday"`..`"Saturday"`.
- `ev.data` — tải trọng dành riêng cho sự kiện (xem bảng ở trên).

Phương pháp:

- `ev.preventDefault()` — đánh dấu công văn là "bị chặn". Tập lệnh nội dung máy chủ sẽ thoát khỏi trang (hoặc đi theo `setRedirectLink`) trừ khi trình xử lý có mức độ ưu tiên cao hơn sau đó đặt `setResult(1)`.
- `ev.stopPropagation()` — dừng việc gửi thư này ngay lập tức. **Không có trình xử lý nào khác trong bất kỳ nhóm nào** được gọi cho sự kiện này.
- `ev.setResult(value)` — đặt kết quả gửi đi. `value` có thể là **số** trong `[-255, 255]` (khối `-1`, `0` trung tính, cho phép `1`; các số nguyên khác được giữ nguyên cho logic gỡ lỗi của riêng bạn) hoặc **chuỗi** (được hiểu là URL chuyển hướng). Cuộc gọi `setResult` cuối cùng trên tất cả các trình xử lý sẽ thắng. `1` dạng số sẽ ghi đè mọi `preventDefault` trước đó.
- `ev.setRedirectLink(url)` / `ev.getRedirectLink()` — URL mà máy chủ sẽ điều hướng đến khi quá trình gửi kết thúc với tình trạng bị chặn. Đây là cách **duy nhất** để chuyển hướng từ các quy tắc tùy chỉnh; trình chỉnh sửa không còn hiển thị trường "URL chuyển hướng khi bị chặn" cho các nhóm Tùy chỉnh.
- `ev.post(type, data, { scope })` — kích hoạt sự kiện tiếp theo từ bên trong trình xử lý.

Ngoài ra, `ev` là Proxy: bất kỳ trường nào bạn đặt trên đó (ví dụ: `ev.foo = 42`) đều được lưu trữ trong bản đồ `custom` và có thể được đọc lại từ cùng một trình xử lý hoặc từ các trình xử lý sau này trong cùng một công văn.### 11.3 Đối tượng `helpers`

Mỗi lệnh gọi trình xử lý sẽ nhận được gói `helpers` mới trong phạm vi nhóm nhận và URL của sự kiện. Các trường không đổi:

- `helpers.now` — mili giây kỷ nguyên khi gửi đi.
- `helpers.currentUrl` — URL sự kiện, sau khi chuẩn hóa tab mới/trống.
- `helpers.groupId` — nhận id nhóm.

Các phím tắt tiện lợi (định tuyến đến các chức năng nhận biết bộ tích lũy tương tự được sử dụng bởi những người trợ giúp bên dưới, do đó, đầu ra vẫn nằm trong bảng Nhật ký):

- `helpers.log(...)`, `helpers.warn(...)`, `helpers.error(...)`.

Các phương thức truy cập:

- `helpers.getLogHelper()` — `log` / `warn` / `error`. Đầu ra bị giới hạn tốc độ và bị giới hạn cho mỗi lần gửi để ngăn các quy tắc chạy trốn đóng băng cửa sổ bật lên.
- `helpers.getDomainHelper()` (bí danh `helpers.getDomainUtility()`) — Kiểm tra URL (xem **11.3.5**).
- `helpers.getTimerHelper()` — bộ hẹn giờ trong phạm vi nhóm (đếm ngược/đếm ngược); trạng thái vẫn tồn tại khi khởi động lại trình duyệt.
- `helpers.getPersistenceHelper()` — Kho lưu trữ khóa/giá trị JSON nằm trong phạm vi nhóm.
- `helpers.getRedirectionHelper()` — `setRedirectLink(url)` / `getRedirectLink()` (và các bí danh `set` / `get`) cộng với `createMessageUrl(message)` trả về URL `chrome-extension://...` hiển thị thông báo đã cho.
- `helpers.getPlatformHelper()` — ý định DOM trên mỗi nền tảng (xem **11.3.6**).
- `helpers.getDOMHelper()` — ý định DOM chung: `hide(sel)`, `show(sel)`, `addClass(sel, c)`, `removeClass(sel, c)`, `setText(sel, text)`, `click(sel)`, `injectCss(css, id?)`, `removeInjectedCss(id)`, `scrollTo(sel)`. Các hoạt động được thực hiện theo đợt và được áp dụng sau khi trình xử lý trả về.
- `helpers.getNavigationHelper()` — `back()`, `forward()`, `reload()`, `goTo(url)`, `closeTab()`. Hiệu ứng được áp dụng cho tab mà sự kiện xuất phát.
- `helpers.getStorageHelper()` — siêu tập hợp của `getPersistenceHelper` cộng với các móc nối `requestAsyncGet(key)` / `requestAsyncSet(key, value)` không đồng bộ để lưu trữ nhiều tiện ích mở rộng (kết quả sẽ đến dưới dạng sự kiện tùy chỉnh tiếp theo).
- `helpers.getTabHelper()` — `list()`, `getActiveTab()`, `getById(id)`, `countOpen()` dựa trên ảnh chụp nhanh đi kèm với sự kiện.

Tất cả các phương thức trợ giúp đều an toàn: tham số sai trả về `null`, `false` hoặc một giá trị trống thay vì ném.

#### 11.3.1 `getTimerHelper()`

Bộ đếm thời gian cho mỗi nhóm. Mỗi bộ hẹn giờ được xác định bằng chuỗi `id` bạn chọn; danh tính nằm trong phạm vi nhóm, vì vậy cả hai nhóm đều có thể sử dụng id `"yt-shorts"` mà không xung đột. Trạng thái vẫn tồn tại khi khởi động lại trình duyệt.

Trạng thái liên tục của bộ hẹn giờ chính xác là: `id`, `displayName`, `direction` (`"forward"` hoặc `"backward"`), `isPaused` và `currentMs`. Không có "thời lượng ban đầu" được lưu trữ - `isExpired` chỉ là `currentMs === 0`. Bộ đếm thời gian chuyển tiếp tích tắc mãi mãi và không bao giờ tự hết hạn. Bộ hẹn giờ lùi dừng tích tắc ở `0` (không có giá trị âm).

Có hai phương pháp xây dựng. Chọn một trong đó có ngữ nghĩa phù hợp với những gì bạn muốn:

- `create({ id, displayName?, direction?, currentMs?, scope?, domain? })` — **luôn (tái)tạo** bộ hẹn giờ với các giá trị init được cung cấp, ghi đè mọi trạng thái hiện có bao gồm `currentMs`. Sử dụng điều này khi bạn muốn nói "bắt đầu mới", ví dụ: bên trong nhánh thiết lập lại một lần.
- `getOrCreateTimer({ id, displayName?, direction?, currentMs?, scope?, domain? })` — **bình thường**. Nếu bộ hẹn giờ với `id` đó đã tồn tại thì `displayName` và `direction` của nó có thể được cập nhật nhưng `currentMs` vẫn được giữ nguyên. Nếu không thì nó được tạo bằng các giá trị init được cung cấp. Đây là những gì bạn muốn cho mẫu "đảm bảo bộ hẹn giờ của tôi tồn tại, sau đó để nó đánh dấu".

Cả hai phương pháp đều chấp nhận hai hàm vị ngữ mà công cụ ghi nhớ trong suốt thời gian tồn tại của quy tắc (chúng tồn tại qua từng nhịp tim và qua các lần đánh giá lại `webChangedEvent`, nhưng chúng **không bao giờ được lưu giữ** trong bộ nhớ):- `scope: (url) => boolean` — khi `true` dành cho URL hiển thị hiện tại trên mỗi `pageHeartbeatEvent`, bộ hẹn giờ sẽ tự động đếm theo nhịp tim (~250 mili giây). Bản thân người trợ giúp không bao giờ chặn; nó chỉ cập nhật `currentMs`. Nhiều nhất một tích tắc tự động cho mỗi nhịp tim trong mỗi bộ hẹn giờ.
- `domain: (url) => boolean` — khi `true` cho URL hiển thị hiện tại, bộ hẹn giờ được hiển thị trong lớp phủ trong trang (trên cùng bên trái). Khi `domain` bị bỏ qua, động cơ sẽ quay trở lại `scope` để hiển thị, do đó bộ đếm thời gian "tick on /shorts/ pages" cũng hiển thị ở đó mà không cần nối thêm dây. Cung cấp `domain` một cách rõ ràng nếu bạn muốn một cổng hiển thị khác (ví dụ: chỉ đánh dấu vào `/shorts/`, nhưng hiển thị thời gian còn lại trên tất cả `youtube.com`).

> **Quan trọng — đồng hồ hẹn giờ không bao giờ tự chặn.** Khi đồng hồ hẹn giờ lùi về 0, nó chỉ dừng ở 0 và kích hoạt `timerEnded` một lần. Việc có thực sự chặn trang hay không tùy thuộc vào trình xử lý `openWebEvent` / `switchWebEvent` riêng biệt gọi `ev.preventDefault()` sau khi kiểm tra `helpers.getTimerHelper().isExpired(id)`. Sự tách biệt này cho phép bạn xây dựng bộ hẹn giờ "chỉ cảnh báo", trình theo dõi đếm ngược, nhắc nhở mềm hoặc khối cứng — cùng một kiểu nguyên thủy, tùy bạn lựa chọn.

Các phương pháp khác:

- `delete(id)`, `pause(id)`, `resume(id)` — vòng đời tiêu chuẩn. Tạm dừng đóng băng `currentMs`.
- `setDirection(id, "forward" | "backward")`, `setCurrentMs(id, ms)`, `addMs(id, deltaMs)` — trình biến đổi trực tiếp (hầu hết các quy tắc không cần những quy tắc này — hãy để nhịp tim đánh dấu đồng hồ bấm giờ cho bạn).
- `setDisplayName(id, name)` — dán nhãn lại.
- `getCurrentMs(id)`, `getDirection(id)`, `getDisplayName(id)`, `isPaused(id)`, `exists(id)`.
- `isExpired(id)` — `true` nếu `currentMs === 0`.
- `getState(id)` — `{ id, displayName, direction, isPaused, currentMs, isExpired }` hoặc `null`.
- `list()` — mọi bộ đếm thời gian mà nhóm này sở hữu, dưới dạng một mảng các đối tượng trạng thái.

#### 11.3.2 `getPersistenceHelper()`

Lưu trữ giống như bản đồ trong phạm vi nhóm của bạn. Các giá trị phải có thể tuần tự hóa JSON.

- `set(key, value)`, `get(key, defaultValue?)`, `has(key)`, `delete(key)`, `keys()`, `entries()`, `clear()`, `size()`.

Giới hạn mềm: khoảng 200 khóa mỗi nhóm, 16 KB mỗi giá trị.

#### 11.3.3 `getLogHelper()`

- `log(...args)`, `warn(...args)`, `error(...args)` — ghi vào bảng **Log** trong cửa sổ bật lên (gói trợ giúp vẫn định tuyến chúng qua cùng một bộ tích lũy bất kể công văn nào tạo ra chúng). Mỗi dòng có tiền tố `[CustomBlocker:groupId]`.
- Trình trợ giúp có giới hạn cứng: khoảng **200 mục nhật ký cho mỗi lần gửi** và độ dài chuỗi tối đa cho mỗi mục nhập. Các mục thừa sẽ bị loại bỏ và tính vào `accumulator.logsDropped`. Đây là thứ bảo vệ cửa sổ bật lên khỏi hành vi chạy trốn của `for (let i = 0; i < 100000; i++) helpers.log(i)`.
- Khi **Chế độ gỡ lỗi** tắt (mặc định), các mục nhập cấp độ theo dõi mà công cụ tự phát ra (thời gian bắt đầu gửi/xử lý) sẽ bị chặn ở mọi nơi — chúng không hiển thị trong bảng Nhật ký và không in ra bảng điều khiển. Các cuộc gọi `log` / `warn` / `error` của riêng bạn luôn được thực hiện.

#### 11.3.4 `getRedirectionHelper()`

Kiểm tra/ghi đè URL chuyển hướng mà tập lệnh nội dung sẽ sử dụng nếu trang hiện tại bị chặn.

- `get()` — trả về URL chuyển hướng hiệu quả hiện tại cho công văn này. Ban đầu, đây là URL dự phòng được định cấu hình của nhóm tích hợp (nếu có), nếu không thì `""`.
- `set(url)` — ghi đè URL chuyển hướng đó cho công văn này. Trả về `true` nếu thành công, `false` cho đầu vào không phải chuỗi. Việc chuyển `""` sẽ xóa ghi đè chuyển hướng và quay lại hành vi thoát mặc định thông thường.
- `createMessageUrl(message)` — trả về URL `chrome-extension://<id>/message-page.html?msg=...` mà khi điều hướng đến sẽ hiển thị thông báo được căn giữa trên một trang sạch. Hữu ích khi chuyển hướng người dùng đến màn hình "Đi làm" / "Nghỉ ngơi" sau khi hết giờ. Ví dụ: `ev.setRedirectLink(h.getRedirectionHelper().createMessageUrl("Go Work"))`.

Giống như các tác dụng phụ khác của quy tắc tùy chỉnh, trạng thái này được chia sẻ trên tất cả các quy tắc trong công văn hiện tại. Vì các quy tắc chạy từ dưới lên trên nên quy tắc trên cùng gọi `set(...)` sẽ thắng.

#### 11.3.5 `getDomainHelper()` (bí danh `getDomainUtility()`)

Người trợ giúp kiểm tra URL. Không có `normalize()` vì các URL đến đã được chuẩn hóa theo tab mới.

Cốt lõi:- `hostnameOf(url)`, `pathnameOf(url)`, `matches(hostname, site)`, `getPlatform(url)`.
- `isYouTubeHost`, `isTikTokHost`, `isInstagramHost`, `isFacebookHost`, `isTwitchHost`, `isRedditHost`, `isDiscordHost`.
- `youtube()`, `tiktok()`, `instagram()`, `facebook()`, `twitch()` — mỗi người trả về `{ isPlatformUrl, isShortUrl, isVideoUrl, isPostUrl, isHomePage, extractAuthor, extractVideoId }`.

Lọc URL và trợ giúp phần:

- `isEmptyStartPage(url)` — `true` dành cho trang tab mới và các trang tương đương (các URL hiển thị dưới dạng `""` đối với trình xử lý).
- `matchesAny(url, patterns)` — `patterns` có thể là biểu thức chính quy, biểu thức chính quy chuỗi hoặc một mảng.
- `pathStartsWith(url, path)` — nhận biết ranh giới (`pathStartsWith("/r/", "/r")` là đúng; `"/results/"` thì không).
- `queryHas(url, key, value?)`, `queryGet(url, key)` — kiểm tra chuỗi truy vấn.
- `isSearchPage(url)` — nhận dạng kết quả tìm kiếm trên Google / Bing / DuckDuckGo / Du-túp / Rét-đít / Tuýt-tơ / X.
- `isInfiniteFeedUrl(url)` — nhận dạng các bề mặt nguồn cấp dữ liệu thuật toán của Du-túp, Tích Tốc, In-xta-gam, Phây-búc, Rét-đít, X.
- `sameSection(a, b)` — cùng tên máy chủ VÀ cùng đoạn đường dẫn đầu tiên.

#### 11.3.6 `getPlatformHelper()`

Ý định DOM trên mỗi nền tảng và bộ tính giờ của phần phụ, cùng với việc kiểm tra. Mỗi `helpers.getPlatformHelper().<platform>()` trả về một đối tượng có bộ phương thức được **kiểm soát bởi nền tảng** — các phương thức không có ý nghĩa trên một nền tảng nhất định đơn giản là không có, vì vậy việc gọi chúng sẽ tạo ra `TypeError: ... is not a function` thay vì âm thầm không hoạt động. Ví dụ: `twitch().hidePosts` không tồn tại (Tuých không có bài đăng nào) và `tiktok().hideShortButton` không tồn tại (Toàn bộ trải nghiệm của Tích Tốc đã là _video dạng ngắn). Sử dụng `helpers.getPlatformHelper().hasMethod(platform, name)` hoặc `.listMethods(platform)` để xem xét nội tâm trong thời gian chạy.

Ma trận phương pháp trên mỗi nền tảng:

| phương pháp | youtube | tiktok | instagram | facebook | co giật |
|---|:---:|:---:|:---:|:---:|:---:|
| `hideShorts` / `showShorts` | ✓ |  |  |  |  |
| `hideReels` / `showReels` |  |  | ✓ | ✓ |  |
| `hideClips` / `showClips` |  |  |  |  | ✓ |
| `hideStreams` / `showStreams` |  |  |  |  | ✓ |
| `hideVideos` / `showVideos` | ✓ | ✓ |  | ✓ | ✓ (VOD) |
| `hidePosts` / `showPosts` | ✓ |  | ✓ | ✓ |  |
| `hideShortButton` / `showShortButton` | ✓ |  |  |  |  |
| `hideHomePage` / `showHomePage` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `hideComments` / `showComments` | ✓ | ✓ | ✓ | ✓ | ✓ (trò chuyện) |
| `filterComments` | ✓ | ✓ | ✓ | ✓ |  |
| `hideLive` / `showLive` / `filterLive` | ✓ | ✓ |  | ✓ | ✓ |
| `isCurrentChannelSubscribed` / `isChannelSubscribed` | ✓ |  |  |  | ✓ |
| `isCurrentChannelVerified` | ✓ |  |  |  |  |
| `isLiveNow` | ✓ | ✓ |  | ✓ | ✓ |
| `isItemLive` | ✓ | ✓ |  | ✓ | ✓ |
| `isAlgorithmicRecommendation` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `isSponsored` | ✓ | ✓ | ✓ | ✓ |  |
| `setShortsTimer` | ✓ |  |  |  |  |
| `setReelsTimer` |  |  | ✓ | ✓ |  |
| `setClipsTimer` |  |  |  |  | ✓ |
| `setStreamsTimer` |  |  |  |  | ✓ |
| `setVideosTimer` | ✓ | ✓ |  | ✓ | ✓ |
| `setPostsTimer` | ✓ |  | ✓ | ✓ |  |

Tên gốc của nền tảng (`hideReels`, `hideClips`, `hideStreams`) KHÔNG phải là các nhóm riêng biệt với `hideShorts` / `hideVideos` — khe lưu trữ giống nhau; chỉ có tên hiển thị cho người dùng tuân theo thuật ngữ của từng nền tảng.

> **Quy tắc tồn tại vị ngữ và một vị trí.** Mỗi `hideShorts` / `hideReels` / `hideClips` / `hideStreams` / `hideVideos` / `hidePosts` / `filterComments` / `filterLive` sở hữu **một** liên tục vị từ trên `(group, platform, slot)`. Vị từ **không** nằm trong phạm vi sự kiện hiện tại — sau khi bạn đặt nó, nó sẽ vẫn hoạt động trên mọi lần tải trang và mọi lần gửi đi cho đến khi `show*()` phù hợp được gọi hoặc nhóm được hủy tải. Gọi lại cùng một phương thức bằng một hàm mới **thay thế** hàm trước đó - công cụ không bao giờ HOẶC hợp nhất nhiều vị từ trong một nhóm. Để kết hợp các điều kiện, hãy viết một vị từ tự thực hiện việc kết hợp, ví dụ: `yt.hideVideos(item => isShort(item) || hasKeyword(item))`. Trong các nhóm **khác nhau**, mỗi nhóm đóng góp vị từ riêng của mình và một mục sẽ bị ẩn nếu vị từ của bất kỳ nhóm nào trùng khớp.

Các phương pháp kiểm tra lấy giá trị tại thời điểm gửi đi từ ảnh chụp nhanh đi kèm với sự kiện; tính sẵn có của chúng được kiểm soát bởi ma trận ở trên.

Trình phân loại URL luôn được hiển thị lại bất kể nền tảng: `isPlatformUrl`, `isShortUrl`, `isVideoUrl`, `isPostUrl`, `isHomePage`, `extractAuthor`, `extractVideoId`.Bộ hẹn giờ của phần phụ đăng ký bộ hẹn giờ trong nhóm nhóm liên tục và khi nằm trong phạm vi, chỉ đánh dấu vào các URL khớp với phần phụ đó. Các phương thức hẹn giờ chấp nhận `{ id, direction, currentMs, displayName }` và tuân theo cùng một cổng cho mỗi nền tảng.

Đối với các phương thức vị ngữ, vị từ được gọi trên mỗi thẻ phù hợp với `item` được chuẩn hóa: `{ url, name, author, length, views, publishedAt, description, live?, sponsored?, algorithmic? }`. Bất kỳ trường nào cũng có thể là `null`; "vô tội cho đến khi được chứng minh là có tội" — trả lại `false` khi thiếu trường bạn cần.

### 11.4 Ví dụ

**Dễ dàng** — chặn các trang Du-túp Shorts vào các buổi sáng các ngày trong tuần:

```js
(event, helpers) => {
  const yt = helpers.getDomainHelper().youtube();

  function maybeBlock(ev) {
    if (!yt.isShortUrl(ev.url)) return;
    const { dayName, hour } = ev.time;
    const weekday = !["Saturday", "Sunday"].includes(dayName);
    if (weekday && hour >= 9 && hour < 12) {
      ev.preventDefault();
      ev.setResult(-1);
    }
  }

  event.registerOpenWebEvent("morning-block", maybeBlock);
  event.registerSwitchWebEvent("morning-block", maybeBlock);
}
```

**Trung bình** — Ngân sách 30 phút mỗi ngày dành cho Du-túp Shorts. Đồng hồ tính giờ tự động đánh dấu trên `pageHeartbeatEvent` khi URL Video ngắn hiển thị; một trình xử lý riêng sẽ thực thi khối khi bộ đếm thời gian chạm 0.

```js
(event, helpers) => {
  const TIMER_ID = "yt-shorts-budget";
  const yt = helpers.getDomainHelper().youtube();
  const onShorts = (url) => yt.isShortUrl(url);

  helpers.getTimerHelper().getOrCreateTimer({
    id: TIMER_ID,
    direction: "backward",
    currentMs: 30 * 60 * 1000,
    displayName: "YT Shorts",
    scope: onShorts,
    domain: onShorts
  });

  function maybeBlock(ev, h) {
    if (!yt.isShortUrl(ev.url)) return;
    if (h.getTimerHelper().isExpired(TIMER_ID)) {
      ev.setRedirectLink("https://example.com/focus");
      ev.preventDefault();
      ev.setResult(-1);
    }
  }
  event.registerOpenWebEvent("budget-block", maybeBlock);
  event.registerSwitchWebEvent("budget-block", maybeBlock);

  event.registerTimerEndedEvent("budget-warn", (_ev, h) => {
    h.getLogHelper().log("Budget hit zero.");
  });
}
```

**Khó hơn** — ẩn từng video ngắn trên Du-túp có tên tác giả quá dài và chèn CSS "Phim ngắn này bị ẩn":

```js
(event, helpers) => {
  const MAX_AUTHOR_LEN = 16;

  function configure(_ev, h) {
    const yt = h.getPlatformHelper().youtube();
    yt.hideShorts(
      (item) => item.author && item.author.length > MAX_AUTHOR_LEN,
      { blockPageOnVisit: true }
    );
    h.getDOMHelper().injectCss(
      "ytd-rich-grid-media[data-cb-hidden] { opacity: 0.2 !important; }",
      "long-author-label"
    );
  }

  event.registerOpenWebEvent("hide-long-shorts", configure);
  event.registerSwitchWebEvent("hide-long-shorts", configure);
  event.registerWebChangedEvent("hide-long-shorts", configure);
}
```

**Khó nhất** — phát một sự kiện tùy chỉnh từ trình xử lý này sang trình xử lý khác:

```js
(event, helpers) => {
  event.registerSwitchDomainEvent("track-domain", (ev) => {
    ev.post("domainChange", { from: ev.data.previousHostname, to: ev.hostname });
  });

  event.register("domainChange", "log-it", (ev, h) => {
    h.getLogHelper().log("crossed", ev.data.from, "→", ev.data.to);
  });
}
```

---

## 12. Mẫu

Mỗi nhóm Tùy chỉnh có một bộ chọn **Mẫu** để mở trình duyệt cài sẵn có thể tìm kiếm. Thư viện hiện cung cấp **50+ mẫu** được sắp xếp thành chín danh mục để bạn có thể duyệt thay vì viết quy tắc từ đầu:

| Danh mục | Ví dụ |
|---|---|
| **Bộ hẹn giờ** | Ngân sách thời gian của trang web (đếm ngược + khối), trình theo dõi thời gian của trang web (đếm ngược), giới hạn Du-túp Shorts, giới hạn nguồn cấp dữ liệu Tích Tốc, giới hạn Câu chuyện trên In-xta-gam, giới hạn Câu chuyện trên Phây-búc, giới hạn Tuých Clips, Ngân sách phân tâm phổ quát, Trình theo dõi công việc sâu hàng ngày |
| **Lịch trình** | Khối giờ làm việc các ngày trong tuần, các trang web chỉ dành cho cuối tuần, tắt máy trước khi đi ngủ, chỉ cho phép một giờ, tin tức chỉ ăn trưa, khởi đầu mới vào thứ Hai, cho phép N phút đầu tiên mỗi giờ, khối nghiêm ngặt làm việc sâu |
| **Nguồn cấp dữ liệu / Quần short** | Chặn URL Quần short trên Du-túp, ẩn thẻ Quần short, ẩn Quần short theo từ khóa, ẩn nguồn cấp dữ liệu / nhận xét / xu hướng trên trang chủ Du-túp, chặn Tích Tốc FYP, ẩn quần short Tích Tốc, chặn URL Câu chuyện trên In-xta-gam, ẩn nguồn cấp dữ liệu Câu chuyện trên In-xta-gam, ẩn nguồn cấp dữ liệu Phây-búc / Câu chuyện, ẩn trang chủ Rét-đít / Tuýt-tơ / LinkedIn |
| **Chuyển hướng** | Sự phân tâm → trang tiêu điểm, Quần short → /feed/subscriptions, reddit.com → old.reddit.com, twitter / x → Nitter, tab mới → danh sách nhiệm vụ |
| **Tập trung** | Phiên tập trung chỉ dành cho danh sách cho phép, Pomodoro 25/5, chặn trong cuộc họp, chặn sau N lượt truy cập hôm nay, chặn khi mất chuỗi |
| **Nhích** | Ghi lại mọi lượt truy cập gây mất tập trung, cảnh báo trên mỗi lượt truy cập Shorts, đếm số lượt truy cập hàng ngày vào một trang web |
| **Kiên trì** | Giới hạn lượt truy cập hàng tháng, chuyển đổi lệnh cấm hàng tuần, theo dõi các kênh Đít-co đã truy cập |
| **Chỉnh sửa DOM** | Ẩn chuyển đổi tự động phát Du-túp, ẩn Tuýt-tơ / X "Chuyện gì đang xảy ra", chung chung "ẩn bộ chọn trên một trang web" |
| **Gỡ lỗi** | Đếm ngược demo (3 giây), ghi lại mọi sự kiện tùy chỉnh |

Các chip lọc ở đầu bộ chọn thu hẹp danh sách theo danh mục (`Timer`, `Schedule`, `Feed`, …) và nền tảng (`Du-túp`, `Tích Tốc`, `In-xta-gam`, …). Lựa chọn một mẫu:

1. Tải thông số đầu vào của nó (URL, phút, phạm vi giờ, v.v.) vào một dạng nhỏ.
2. **Áp dụng giá trị đặt trước** xem trước nguồn được tạo.
3. Sau khi xác nhận **Thay thế quy tắc tùy chỉnh hiện tại bằng giá trị đặt trước này?**, nguồn sẽ được ghi vào trình chỉnh sửa.
4. Sau đó, bạn nhấp vào **Chạy** để đăng ký trình xử lý quy tắc trong hộp cát ngoài màn hình.

Các mẫu được xác định theo `templates/*.js` (`timers.js`, `schedule.js`, `feed.js`, …). Mỗi tệp gọi `CB_REGISTER_TEMPLATES([...])` khi tải và cửa sổ bật lên sẽ sử dụng danh sách đã hợp nhất. Thêm mẫu mới có nghĩa là viết một mục vào tệp thích hợp — không cần hệ thống ống nước nào khác.

---

## 13. Hành vi nhiều trang- Tất cả các tab đang mở trong cùng một nhóm đều có chung bộ đếm thời gian.
- Khi bạn chuyển sang một tab trong cùng một nhóm, lớp phủ của nó sẽ làm mới ngay lập tức để hiển thị thời gian chia sẻ hiện tại.
- Bộ hẹn giờ quy tắc tùy chỉnh chỉ đánh dấu trên tab **hiển thị đang hoạt động** — do `pageHeartbeatEvent` điều khiển. Các tab nền và cửa sổ thu nhỏ không nâng cao chúng. Điều này phù hợp với việc đếm ngược nhóm khối mặc định.
- Khi một quy tắc mới được thêm vào, mỗi trang mở sẽ phát hiện sự thay đổi và đánh giá lại trong chưa đầy một giây; **nhưng** trình xử lý mới được đăng ký không "mở" các tab đã mở trước đó. Cửa sổ bật lên hiển thị lời nhắc tải lại sau mỗi lần Chạy vì lý do đó.
- Khi quy tắc hết hạn, thẻ nguồn cấp dữ liệu ẩn và nút điều hướng sẽ được khôi phục vào lần làm mới tiếp theo.

---

## 14. Cài đặt

Mở hộp thoại **Cài đặt** thông qua biểu tượng bánh răng ở thanh trên cùng.

- **Khoảng nhịp tim** — tần suất tập lệnh nội dung báo cáo thời gian tab và thúc đẩy `pageHeartbeatEvent`. Mặc định 250 mili giây. Giá trị thấp hơn sẽ phản hồi nhanh hơn nhưng sử dụng nhiều CPU hơn.
- **Khoảng thời gian đánh dấu** — tần suất `tickEvent` toàn cầu kích hoạt. Mặc định 1000 ms.
- **Chế độ gỡ lỗi** — *tắt* theo mặc định. Khi *bật*, công cụ sẽ phát ra các mục nhập cấp độ dấu vết vào bảng Nhật ký (`[trace] dispatchEvent`, `[trace] N handler(s)`) và các dòng `[CustomBlocker:trace]` tới bảng điều khiển trình duyệt. Bỏ nó đi trong sử dụng hàng ngày; bật nó lên trong khi chẩn đoán một quy tắc hoạt động sai. `pageHeartbeatEvent` bị loại khỏi quá trình ghi nhật ký theo dõi ngay cả khi chế độ gỡ lỗi được bật vì nó kích hoạt bốn lần mỗi giây và sẽ lấn át phần còn lại.

---

##15. Quốc tế hóa

Toàn bộ giao diện người dùng được dịch. Sử dụng bộ chọn **Ngôn ngữ** ở trên cùng bên phải.

Các ngôn ngữ được hỗ trợ bao gồm tiếng Anh, tiếng Trung (Giản thể), tiếng Tây Ban Nha, tiếng Nhật, tiếng Hàn, cùng với một phần ngôn ngữ bao gồm tiếng Hindi, tiếng Ả Rập, tiếng Bengali, tiếng Bồ Đào Nha, tiếng Nga, tiếng Punjabi, tiếng Đức, tiếng Pháp, tiếng Thổ Nhĩ Kỳ, tiếng Việt, tiếng Ý, tiếng Thái, tiếng Hà Lan, tiếng Ba Lan, tiếng Indonesia, tiếng Urdu và tiếng Ba Tư. Các ngôn ngữ có phạm vi bao phủ một phần sẽ quay lại tiếng Anh vì thiếu chuỗi.

Bản thân hướng dẫn sử dụng sẽ tải tệp đánh dấu phù hợp với ngôn ngữ bạn đã chọn, với tiếng Anh làm dự phòng.

---

## 16. Thông báo trạng thái

Thông báo trạng thái xuất hiện dưới dạng bánh mì nướng ở giữa và mờ dần sau khoảng hai giây:

- "Đã lưu thay đổi."
- "Đã tạo \"Tên nhóm\"."
- "Đã tải quy tắc tùy chỉnh — N trình xử lý đang hoạt động. Để áp dụng quy tắc này trên các tab bạn đã mở, hãy tải lại chúng."
- Lỗi xác thực như "Số phút cho phép phải lớn hơn 0."
- "Số phút báo lại phải là số lớn hơn 0."
- "Nhóm đông lạnh không thể thay đổi."

Đối với các trường nhập có yêu cầu về định dạng, thông báo cũng xuất hiện bên cạnh nút liên quan (để báo lại).

---

## 17. Quyền riêng tư và lưu trữ

- Mọi thứ được lưu trữ cục bộ trong `chrome.storage.local`. Không có dữ liệu được gửi đi bất cứ đâu.
- Các mục được lưu trữ bao gồm: nhóm của bạn, bộ hẹn giờ sử dụng, thời gian đặt lại lần cuối, bản ghi báo lại, bộ hẹn giờ tùy chỉnh và giá trị cố định tùy chỉnh.
- Tiện ích mở rộng không đọc nội dung trang vượt quá những gì cần thiết để phát hiện loại trang (đường dẫn / tên máy chủ / dấu hiệu DOM đã biết cho các trang web video) và để đánh giá các vị từ do người dùng viết. Nó không đọc tin nhắn, bài đăng, bình luận hoặc nội dung riêng tư của bạn.

---

## 18. Quyền

- `storage` — cho dữ liệu trên.
- `declarativeNetRequest` — để chặn riêng các nhóm `Default`.
- `alarms` — để lên lịch chuyển đổi quy tắc một cách hiệu quả.
- `tabs`, `webNavigation` — để phát hiện việc tạo tab, thay đổi URL và nhịp tim của trang để có thể gửi các sự kiện.
- `offscreen` — để lưu trữ hộp cát quy tắc tùy chỉnh tồn tại lâu dài.
- `host_permissions: <all_urls>` — để tập lệnh nội dung có thể hiển thị lớp phủ hẹn giờ và phát hiện bối cảnh nền tảng trên bất kỳ trang nào.

---

## 19. Khắc phục sự cố- **Nhóm tôi đã thêm không làm gì cả.** Hãy đảm bảo rằng nhóm đã được bật, lịch trình cho phép ngay bây giờ, không có chế độ tạm ẩn nào đang hoạt động và (đối với các nhóm nền tảng) trang thực sự khớp với loại nội dung đã chọn và bộ lọc tác giả.
- **Bộ hẹn giờ bị kẹt hoặc sai trên một tab.** Chuyển đi và quay lại hoặc tập trung vào tab — việc này sẽ kích hoạt buộc làm mới từ bộ hẹn giờ dùng chung.
- **Thẻ nguồn cấp dữ liệu xuất hiện lại sau khi tôi cho rằng chúng nên bị ẩn.** Tính năng ẩn nguồn cấp dữ liệu chỉ chạy khi quy tắc đang tích cực chặn. Nếu bạn có quy tắc `after-minutes`, tính năng ẩn nguồn cấp dữ liệu sẽ bắt đầu hoạt động khi thời gian của bạn về 0.
- **Nút điều hướng Du-túp mà tôi dự đoán sẽ bị ẩn vẫn còn đó.** Tính năng ẩn điều hướng yêu cầu phải đặt quy tắc thành "không lọc theo tác giả" và loại nội dung là Video ngắn hoặc bài đăng trên Du-túp. Với bộ lọc tác giả, việc ẩn chỉ được thực hiện trên mỗi thẻ.
- **Quy tắc tùy chỉnh không làm gì hoặc bị ném một cách im lặng.** Mở Cài đặt → bật **Chế độ gỡ lỗi**, sau đó nhấp vào **Chạy** lần nữa và xem bảng Nhật ký. Các dòng có tiền tố `[trace]` hiển thị mọi công văn và trình xử lý. Sử dụng `helpers.getLogHelper().log(...)` để thêm các điểm theo dõi của riêng bạn. Nếu một quy tắc hoạt động sai liên tục bị cách ly tự động, hãy sửa nguồn và nhấp vào Chạy — Chạy sẽ xóa lý do hủy bỏ.
- **Quy tắc tùy chỉnh mới của tôi không ảnh hưởng đến các tab đã mở.** Tải lại chúng. Quy tắc tùy chỉnh đính kèm với các sự kiện trang *tương lai*; cửa sổ bật lên hiển thị lời nhắc tải lại sau mỗi lần Chạy.
- **Đồng hồ đếm ngược của tôi không tiến lên.** Bộ hẹn giờ quy tắc tùy chỉnh chỉ đánh dấu vào tab **hoạt động hiển thị** qua `pageHeartbeatEvent`. Các tab nền, cửa sổ thu nhỏ và màn hình khóa sẽ tạm dừng chúng theo thiết kế — hoạt động tương tự như đếm ngược nhóm khối mặc định.
- **Tôi không thể xóa nhóm.** Có thể nhóm đó đã bị đóng băng. Các nhóm bị đóng băng nghiêm ngặt hoàn toàn không thể bị xóa cho đến khi khóa của chúng hết hạn; các nhóm bị đóng băng không nghiêm ngặt có thể bị xóa thông qua nghi thức giải phóng.
- **Cửa sổ bật lên hiển thị "Đang chạy..." mãi mãi.** Quy tắc tùy chỉnh có thể đã bị lặp lại. Động cơ sẽ tắt nó sau một khoảng thời gian chờ cứng và cách ly quy tắc. Mở bảng Nhật ký vì lý do hủy bỏ; sửa quy tắc và nhấp vào Chạy.

---

## 20. Bảng thuật ngữ

- **Chặn nhóm** — một bộ quy tắc có loại, hành vi, lịch trình và trạng thái đóng băng/tạm ẩn riêng.
- **Chặn tức thì** — quy tắc sẽ chặn ngay lập tức bất cứ khi nào nó được kích hoạt.
- **Chặn sau phút** — quy tắc chỉ bắt đầu chặn sau khi hết ngân sách thời gian trong khoảng thời gian đó.
- **Khoảng thời gian đặt lại** — tần suất đặt lại ngân sách sau vài phút.
- **Lịch trình** — ngày + khoảng thời gian trong đó một nhóm hoạt động.
- **Đóng băng / Đóng băng nghiêm ngặt** — trạng thái chống giả mạo.
- **Báo lại** — vô hiệu hóa tạm thời bằng nghi thức xác nhận có thể định cấu hình.
- **Bộ lọc tác giả** — đối với các nhóm nền tảng, giới hạn quy tắc đối với một số người tạo nội dung nhất định.
- **Loại nội dung** — đối với các nhóm nền tảng, giới hạn quy tắc ở một số dạng nội dung nhất định (ngắn, dài, đăng).
- **Người trợ giúp** — các tiện ích được chuyển tới trình xử lý của quy tắc tùy chỉnh.
- **Nền tảng** — một trong các `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`. Mỗi nhóm có loại nhóm và logic ẩn nguồn cấp dữ liệu riêng.
- **Heartbeat** — ~250 ms `pageHeartbeatEvent` được gửi từ tab hiển thị đang hoạt động.
- **Tick** — số 1 `tickEvent` được chia sẻ trên toàn cầu (không phụ thuộc vào khả năng hiển thị).
- **Chế độ gỡ lỗi** — một cài đặt hiển thị ghi nhật ký theo dõi nội bộ trong bảng Nhật ký và bảng điều khiển trình duyệt.
- **Cách ly** — tự động vô hiệu hóa quy tắc tùy chỉnh vượt quá giới hạn an toàn thời gian chạy (thời hạn, spam nhật ký, ...). Đã xóa vào lần chạy tiếp theo.

---

## 21. Hạn chế- Việc ẩn nguồn cấp dữ liệu phụ thuộc vào DOM hiện tại của mỗi nền tảng. Nếu nền tảng thay đổi bố cục, bộ chọn ẩn có thể cần được cập nhật.
- Tính năng phát hiện ngữ cảnh nền tảng cho các trang web không phải Du-túp chủ yếu dựa trên URL, do đó, tính năng này đáng tin cậy nhất trên các URL nội dung chuẩn.
- Bộ hẹn giờ quy tắc tùy chỉnh đánh dấu ở độ phân giải nhịp tim (~250 ms). Đừng dựa vào chúng để tính thời gian dưới giây.
- Các vị từ được chuyển đến `hideShorts` / `hideVideos` / `hidePosts` được đánh giá đồng bộ trên mỗi thẻ nguồn cấp dữ liệu. Logic nặng trong một vị từ có thể làm chậm quá trình cuộn nguồn cấp dữ liệu; giữ chúng giá rẻ.
- Hai tab chỉnh sửa cùng một bộ đếm thời gian cho mỗi nhóm đồng thời sử dụng chiến lược "viết lần cuối sẽ thắng". Đối với mục đích sử dụng thông thường thì điều này là ổn; nếu bạn phụ thuộc vào việc tính toán chính xác, thỉnh thoảng sẽ có sự chênh lệch nhỏ.
- Trình duyệt có thể tạm dừng nhân viên dịch vụ nền khi không hoạt động. Tiện ích mở rộng sẽ tiếp tục lại ngay khi có trang hoặc báo thức cần; ngân sách sử dụng trang web/theo thời gian tiếp tục được tính thông qua tính năng phát lại nhịp tim.

## Ghi chú v1.2

Trình soạn quy tắc tùy chỉnh hiện tô màu cú pháp ngôn ngữ kịch bản, và trình duyệt mẫu dùng cùng màu cho phần xem trước mã. Tác vụ hàng loạt của nhóm được gọi là **Xóa sạch**.

