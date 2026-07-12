# Tiện ích mở rộng Vault

Tiện ích mở rộng Vault là công cụ tập trung vào Manifest V3 dành cho trình duyệt Chrome. Trình chỉnh sửa hiện tại của nó quản lý các nhóm chặn trang web, nhóm nền tảng được hỗ trợ, nhóm JavaScript tùy chỉnh, lịch trình, điều khiển đóng băng và báo lại cũng như các liên kết cầu nối ứng dụng web tùy chọn.

Mã nguồn là hợp đồng sản phẩm. Hướng dẫn sử dụng trong ứng dụng bằng tiếng Anh tại [manual/en.md](manual/en.md) giải thích các điều khiển được vận chuyển; nó thay thế các sách hướng dẫn được sao chép và dịch bằng máy trước đó.

## Khả năng hiện tại

- Nhóm trang web mặc định có hành vi trong danh sách chặn hoặc danh sách cho phép, chuyển hướng tùy chọn, chặn ngay lập tức, cho phép thời gian hoặc đếm ngược.
- Các nhóm dành riêng cho YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord và Twitter / X.
- Các bộ lọc dành riêng cho nền tảng và các điều khiển phần tử ẩn tùy chọn trong đó cấu hình nền tảng hiện tại hỗ trợ chúng.
- Nhóm JavaScript tùy chỉnh với tính năng kiểm tra cú pháp, mẫu, điều khiển chạy, thời gian chạy được kiểm soát và nguồn cấp dữ liệu nhật ký.
- Lịch trình cho mỗi nhóm, chế độ đóng băng, điều khiển báo lại, nhập/xuất và lưu tự động.
- Quyền truy cập thư mục cục bộ tùy chọn cho các hoạt động văn bản, CSV và JSON theo quy tắc tùy chỉnh được hỗ trợ.
- Kết nối tùy chọn với trung tâm cầu nối Vault gốc dành cho các nhóm được liên kết rõ ràng.

## Chạy cục bộ

1. Mở `chrome://extensions` trong trình duyệt Chrome.
2. Bật **Chế độ nhà phát triển**.
3. Chọn **Tải đã giải nén** và chọn thư mục kho lưu trữ này.
4. Mở tiện ích mở rộng Vault và tạo một nhóm.

Tệp kê khai yêu cầu Chrome 116 trở lên đối với các API quy tắc và API ngoài màn hình hiện tại.

## Kiểm tra phát triển

Chạy bộ kiểm tra tiện ích mở rộng từ thư mục này:

```bash
./tests/run.sh
```

Bộ phần mềm này thực hiện hành vi trợ giúp, cấu hình nền tảng, hiển thị Markdown và kiểm tra danh mục dịch thuật.

## Hướng dẫn sử dụng và bản dịch được bản địa hóa

Các tài liệu tiếng Anh vẫn là nguồn kinh điển. Tiện ích mở rộng gửi các hướng dẫn sử dụng đã được bản địa hóa bên cạnh `manual/en.md` và các bản sao đã bản địa hóa của các tài liệu được duy trì khác nằm trong `i18n-docs/<locale>/`.

Danh mục giao diện người dùng trong `translation/*.json` hoàn chỉnh cho mọi ngôn ngữ được hỗ trợ. Xác minh danh mục và tài liệu được bản địa hóa bằng:

```bash
node scripts/translation-audit.js
node scripts/documentation-audit.js
```

## Phạm vi

Tiện ích mở rộng Vault chỉ hoạt động trong hồ sơ trình duyệt nơi nó được cài đặt và trên các trang mà trình duyệt cấp cho nó quyền truy cập. Nó không cài đặt ứng dụng gốc, thay đổi quyền hệ thống hoặc đồng bộ hóa các nhóm trừ khi người dùng kết nối rõ ràng một cầu nối và liên kết các nhóm phù hợp.
