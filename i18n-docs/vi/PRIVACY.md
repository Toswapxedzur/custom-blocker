# Chính sách quyền riêng tư — Trình chặn web tùy chỉnh

_Cập nhật lần cuối: 2026-07-13_

Trang này giải thích chính xác dữ liệu của trình duyệt **Custom Web Blocker**
tiện ích mở rộng sẽ thu thập, nó đi đâu và tại sao mỗi quyền của trình duyệt lại bị thu thập
được yêu cầu. Tóm lại: chúng tôi không lưu quy tắc hoặc dữ liệu duyệt web cá nhân
của bạn. Quy tắc theo thẻ có thể tra cứu ID kênh YouTube công khai, nhưng yêu
cầu đó không được lưu hoặc liên kết với bạn.

## Tóm tắt

- **Cấu hình ở lại trong trình duyệt.** Nhóm, lịch, quy tắc, nhật ký, bộ hẹn giờ
  và tùy chọn chỉ được lưu trong `chrome.storage.local`.
- **Tra cứu thẻ chỉ chứa ID kênh công khai.** URL, tiêu đề, từ khóa tìm kiếm,
  thời gian, tài khoản và cài đặt tiện ích không được gửi.
- **Yêu cầu tra cứu không được lưu.** API chỉ đọc, không thêm kênh chưa biết và
  không gắn yêu cầu với một cá nhân.
- **Không có phân tích, đo từ xa, quảng cáo hoặc báo cáo sự cố.**
- **Không theo dõi** hoạt động duyệt web ngoài những gì thực sự cần thiết
  để áp dụng các quy tắc chặn mà chính bạn đã cấu hình.

## Những gì được lưu trữ cục bộ

Tiện ích mở rộng lưu trữ thông tin sau trong tiện ích mở rộng cục bộ của trình duyệt của bạn
storage để nó có thể thực hiện công việc của mình qua các phiên:

- Các nhóm khối bạn tạo: tên, loại quy tắc, danh sách
  các trang web bị chặn, lịch trình, cài đặt báo lại, trạng thái đóng băng và bất kỳ
  JavaScript quy tắc tùy chỉnh mà bạn viết.
- Cần có trạng thái thời gian chạy cho mỗi nhóm để thực thi các giới hạn (ví dụ: có bao nhiêu
  số phút của ngân sách trợ cấp bị trì hoãn vẫn còn cho đến hôm nay, khi tạm dừng
  kết thúc khi thời gian đóng băng nghiêm ngặt kết thúc).
- Tùy chọn của riêng bạn được đặt trong **Cài đặt** (tốc độ đánh dấu, tự động lưu
  gỡ lỗi, thời lượng báo lại mặc định, URL dự phòng mặc định, chế độ gỡ lỗi
  chuyển đổi, ngôn ngữ giao diện người dùng đã chọn).
- Các mục nhật ký hoạt động được hiển thị trong bảng **Nhật ký** trong ứng dụng mà bạn có thể
  rõ ràng từ giao diện người dùng.

Dữ liệu này chỉ được đọc và ghi bởi các tập lệnh riêng của tiện ích mở rộng, chỉ
trên thiết bị của bạn và chỉ trong hồ sơ trình duyệt của riêng bạn.

## Những gì KHÔNG được thu thập hoặc truyền đi

- Lịch sử duyệt web không được ghi lại, tóm tắt hoặc truyền đi.
- Nội dung trang không được lọc, sàng lọc hoặc ghi lại.
- Mẫu đầu vào, mật khẩu và thông tin cá nhân không bao giờ được đọc.
- Không có thông tin nào về bạn, thiết bị của bạn hoặc việc sử dụng của bạn được gửi tới
  tác giả mở rộng hoặc bất kỳ bên thứ ba nào.

## Tại sao mỗi quyền được yêu cầu

| Giấy phép | Nó được dùng để làm gì |
| --- | --- |
| `storage` | Chỉ lưu và tải các nhóm khối, cài đặt và trạng thái thời gian chạy trong trình duyệt của bạn. |
| `favicon` | Hiển thị trong Chromium biểu tượng trang đã được trình duyệt lưu đệm bên cạnh quy tắc. Việc này không gửi lịch sử duyệt web hoặc yêu cầu đến dịch vụ của chúng tôi. |
| `nativeMessaging` | Chỉ trong Safari, chuyển yêu cầu vùng cách ly của quy tắc tùy chỉnh đến ứng dụng cục bộ trên thiết bị. Đây không phải truyền tải đám mây. |
| `alarms` | Đánh thức nhân viên dịch vụ nền theo lịch trình để làm mới các giới hạn dựa trên thời gian và cập nhật trạng thái quy tắc khi cửa sổ báo lại, đóng băng hoặc lên lịch kết thúc. |
| `offscreen` | Chạy JavaScript quy tắc tùy chỉnh được đóng hộp cát trong tài liệu ngoài màn hình để nó không thể thoát khỏi tiện ích mở rộng hoặc chạm trực tiếp vào các trang của bạn. |
| `tabs` | Mở trình chỉnh sửa dưới dạng tab đầy đủ khi bạn nhấp vào biểu tượng thanh công cụ, tra cứu URL của tab đang hoạt động để đánh giá các quy tắc nhóm và tải lại các tab sau khi bạn thực hiện thay đổi quy tắc trong trình chỉnh sửa. |
| `webNavigation` | Phát hiện các thay đổi URL SPA (điều hướng trạng thái đẩy) để trình ẩn nguồn cấp dữ liệu trên mỗi nền tảng và quy tắc hướng sự kiện có thể phản ứng với điều hướng trong trang chứ không chỉ tải toàn trang. |
| `<all_urls>` truy cập máy chủ | Áp dụng các quy tắc chặn và trình ẩn nguồn cấp dữ liệu trên mỗi nền tảng trên bất kỳ trang web nào bạn chọn chặn. Tiện ích mở rộng chỉ đọc/sửa đổi các trang trên các URL mà bạn đã chủ động định cấu hình quy tắc và chỉ để thực thi quy tắc đó. |

## Quy tắc tùy chỉnh

Nếu bạn viết các quy tắc JavaScript tùy chỉnh, mã đó:

- Chạy trong một tài liệu ngoài màn hình có hộp cát; nó không thể tiếp cận trực tiếp
  mạng, trang của bạn hoặc các tiện ích mở rộng khác.
- Chỉ giao tiếp với các tập lệnh nội dung thông qua cầu nối tin nhắn cố định
  được xác định bởi API trợ giúp của tiện ích mở rộng.
- Được tự động cách ly (bị vô hiệu hóa với mục nhập nhật ký) nếu nó
  vượt quá giới hạn CPU, nhật ký, thông báo sau hoặc đột biến DOM tích hợp.

Quy tắc tùy chỉnh của bạn được lưu trữ cục bộ với phần còn lại của cài đặt của bạn
và không bao giờ được truyền ra khỏi thiết bị.

## Thống kê dịch vụ trang web và thẻ người sáng tạo

Phần này nói về **trang web và dịch vụ thẻ người sáng tạo**. Tiện ích có thể
tra cứu ID kênh công khai ở chế độ chỉ đọc; yêu cầu đó không được lưu.
Bảng **Thống kê** chỉ giữ các số tổng hợp không gắn với một cá nhân:

- **Số lượt tải xuống** — số lần nút tải xuống của mỗi sản phẩm
  đã nhấp vào (macOS, Windows, tiện ích mở rộng trình duyệt, Safari).
- **Phân loại người sáng tạo** — số lượng người sáng tạo trên YouTube đã được gắn thẻ.
- **Tài khoản** — có bao nhiêu tài khoản tồn tại.
- **Hoạt động hỏi đáp** — tổng số bài đăng và nhận xét trên diễn đàn.

Mỗi giờ một lần, máy chủ ghi lại giá trị hiện tại của mỗi lần đếm này và
không có gì khác. Không có bản ghi cho mỗi sự kiện, không có luồng nhấp chuột và không có phiên
lịch sử.

- **Hoàn toàn ẩn danh / không xác định danh tính.** Đây là tổng số đang chạy đơn giản. Họ
  **không** được liên kết với tên, tài khoản, email, địa chỉ IP, thiết bị của bạn hoặc bất kỳ
  mã định danh khác - không có cách nào để quy số đếm ngược lại cho một người.
- **Không bao giờ mang tính thương mại.** Dữ liệu này chỉ tồn tại để hiển thị số liệu thống kê công khai
  bảng điều khiển. Nó **không bao giờ được bán, chia sẻ với bên thứ ba, được sử dụng cho mục đích quảng cáo,
  hoặc được sử dụng cho bất kỳ mục đích thương mại nào khác.**
- **Đóng góp theo id kênh tùy chọn.** Nếu — và chỉ khi — bạn chọn tham gia, thì
  tiện ích mở rộng/trang web có thể chia sẻ YouTube **id kênh** (không bao giờ có tiêu đề video,
  lịch sử xem hoặc bất kỳ nội dung nào mang tính cá nhân) để giúp phân loại người sáng tạo cho mọi người.
- **Đóng góp thủ công.** Khi người dùng đăng nhập chủ động gửi, liên kết giữa
  email và ID kênh chỉ được giữ trong cửa sổ hạn mức 24 giờ và dọn mỗi giờ.
- **Hàng đợi công khai.** Có thể hiển thị ID và trạng thái, nhưng không hiển thị thời điểm hay người gửi.

## Trẻ em

Phần mở rộng là một công cụ năng suất có mục đích chung. Nó không phải
hướng tới trẻ em, không cố ý thu thập dữ liệu từ bất kỳ ai và
không hiển thị quảng cáo.

## Thay đổi chính sách này

Nếu các thông lệ dữ liệu thay đổi trong phiên bản tương lai, tệp này sẽ
được cập nhật và thay đổi sẽ được tóm tắt trong ghi chú phiên bản cho
bản phát hành đó.

## Liên hệ

Các câu hỏi, thắc mắc hoặc báo cáo lỗi: vui lòng mở một vấn đề trên
kho lưu trữ nguồn của tiện ích mở rộng hoặc sử dụng email hỗ trợ được liệt kê trên
Danh sách Cửa hàng Chrome trực tuyến.
