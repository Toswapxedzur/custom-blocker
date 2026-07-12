# Nguồn danh sách Cửa hàng Chrome trực tuyến

Đây là nguồn tiếng Anh cho phần mở rộng Manifest V3 hiện tại. Xác minh nó với `manifest.json` trước khi xuất bản bản dựng cửa hàng mới.

## Tên tiện ích mở rộng

```text
Adamancia Vault
```

## Mô tả ngắn

```text
Block websites, limit time on them, filter supported feeds, and build focused browser routines.
```

## Mô tả chi tiết

```text
Adamancia Vault is a browser focus tool built around independent block groups.

Create a website blocklist or allowlist, give a site a time allowance, or start a countdown that blocks after it reaches zero. Use dedicated groups for YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord, and Twitter / X when you need a platform-specific boundary instead of a whole-site block.

Every group can have its own schedule, freeze mode, snooze rules, and enabled state. Custom groups provide a JavaScript rule editor with syntax checking, run controls, templates, and a log feed. Rules run in the extension's controlled runtime.

The optional web-app bridge connects to a compatible native Vault hub. It only synchronizes groups that the user explicitly links.

Your configuration lives in the browser profile. The extension does not need an account to create or use block groups.
```

## Giải thích về quyền

| Giấy phép | Mục đích hiện tại |
| --- | --- |
| `storage` | Lưu nhóm, cài đặt và trạng thái soạn thảo cục bộ. |
| `alarms` | Lên lịch kiểm tra lý lịch và cập nhật nhóm theo thời gian. |
| `offscreen` | Chạy thời gian chạy Quy tắc tùy chỉnh được kiểm soát trong đó Chrome yêu cầu tài liệu ngoài màn hình. |
| `tabs` | Đọc ngữ cảnh tab đang hoạt động cần thiết để áp dụng một nhóm và hiển thị trạng thái. |
| `webNavigation` | Đánh giá lại các nhóm áp dụng sau khi điều hướng. |
| `favicon` | Hiển thị biểu tượng trang web trong trình chỉnh sửa nếu có. |
| `<all_urls>` | Áp dụng các quy tắc nền tảng và trang web do người dùng tạo cho các trang mà người dùng chọn kiểm soát. |

## Kiểm tra phát hành

1. Chạy `./tests/run.sh`.
2. Chỉ cập nhật phiên bản kê khai cho cam kết phát hành.
3. Xem lại đầu ra kiểm tra bản dịch và hướng dẫn sử dụng tiếng Anh.
4. Xây dựng cấu phần phần mềm tải lên từ cam kết đã xem xét.
5. Không đưa ghi chú nguồn, nội dung thử nghiệm hoặc tệp phát triển riêng tư vào tạo phẩm tải lên.
