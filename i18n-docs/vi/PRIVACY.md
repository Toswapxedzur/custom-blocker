# Chính sách quyền riêng tư — Trình chặn web tùy chỉnh

_Cập nhật lần cuối: 2026-08-04_

Trang này giải thích chính xác tiện ích mở rộng trình duyệt **Trình chặn web tùy chỉnh** thu thập dữ liệu nào, dữ liệu đó đi đâu và vì sao mỗi quyền của trình duyệt được yêu cầu. Nói ngắn gọn: chúng tôi không lưu các quy tắc hay dữ liệu duyệt web cá nhân của bạn. Việc thu thập và phân loại tùy chọn của Vault Classifier vẫn nằm dưới sự kiểm soát của bạn và sử dụng cầu nối cục bộ đã xác thực. Một tích hợp AI cục bộ (MCP) tùy chọn riêng biệt cũng tắt theo mặc định và chỉ để lộ dữ liệu cho trợ lý mà chính bạn kết nối và phê duyệt.

## Tóm tắt

- **Cấu hình của bạn ở lại trong trình duyệt của bạn.** Nhóm chặn, lịch biểu, quy tắc tùy chỉnh, nhật ký, bộ đếm giờ và tùy chọn chỉ được lưu trong bộ nhớ tiện ích cục bộ của Chrome (`chrome.storage.local`).
- **Vault Classifier chỉ hoạt động cục bộ.** Nếu bạn bật rõ ràng tích hợp Vault Classifier tùy chọn, bằng chứng hiển thị trên thẻ/trang YouTube (như tiêu đề, mô tả hiển thị, thẻ được hiển thị và ID nhà sáng tạo/video công khai) chỉ được định tuyến qua cầu nối Vault cục bộ đã xác thực đến Vault Classifier trên máy Mac của bạn. Chúng không được gửi đến trang web của chúng tôi, nhà cung cấp mô hình, YouTube Data API hay bất kỳ máy chủ nào khác.
- **Thu thập là một lựa chọn tham gia (opt-in) riêng.** Vault Classifier chỉ yêu cầu tiện ích cung cấp siêu dữ liệu YouTube đã kết xuất, không quảng cáo, sau khi bạn bật thu thập YouTube trong không gian làm việc dữ liệu Phân loại của nó. Khi tắt, tiện ích không gửi bất kỳ tiêu đề hay siêu dữ liệu nhà sáng tạo nào để thu thập. Khi bật, các trường cục bộ được giữ lại có thể gồm tiêu đề hiển thị, tên/mã định danh nhà sáng tạo, loại video, thời lượng, văn bản hiển thị về số người đăng ký/lượt xem/thời điểm đăng và URL chuẩn.
- **Tích hợp AI cục bộ (MCP) tùy chọn.** Nếu bạn bật nó và kết nối trợ lý AI của riêng mình, trợ lý đó có thể — theo chỉ dẫn rõ ràng của bạn — đọc dữ liệu đã chọn (cấu hình, hoạt động, thời gian sử dụng, URL của thẻ đang hoạt động/đang mở, nội dung trang hiển thị trên các trang bạn đã cấu hình và mọi bằng chứng của Classifier) thông qua một máy chủ Vault cục bộ trên thiết bị của bạn. Nó tắt theo mặc định, mỗi kết nối do bạn phê duyệt, và mật khẩu cùng khóa API không bao giờ đọc được qua nó. Xem phần "Tích hợp AI cục bộ (MCP) tùy chọn" bên dưới.
- **Không có phân tích, hồ sơ quảng cáo, đo từ xa hay báo cáo sự cố.**
- **Không theo dõi** hoạt động duyệt web ngoài những gì thật sự cần thiết để áp dụng các quy tắc chặn mà chính bạn đã cấu hình.

## Những gì được lưu cục bộ

Tiện ích lưu những mục sau trong bộ nhớ tiện ích cục bộ của trình duyệt để có thể hoạt động qua các phiên:

- Các nhóm chặn bạn tạo: tên, loại quy tắc, danh sách trang bị chặn, lịch biểu, thiết lập hoãn (snooze), trạng thái đóng băng và mọi JavaScript quy tắc tùy chỉnh bạn viết.
- Trạng thái thời gian chạy theo từng nhóm cần để thực thi giới hạn (ví dụ: còn bao nhiêu phút trong ngân sách cho phép trì hoãn hôm nay, khi nào một lần hoãn kết thúc, khi nào giai đoạn đóng băng nghiêm ngặt kết thúc).
- Các tùy chọn của riêng bạn đặt trong **Cài đặt** (nhịp tích, độ trễ tự động lưu, thời lượng hoãn mặc định, URL dự phòng mặc định, công tắc chế độ gỡ lỗi, ngôn ngữ giao diện đã chọn).
- Các mục nhật ký hoạt động hiển thị trong bảng **Nhật ký** trong ứng dụng, mà bạn có thể xóa từ giao diện.
- Khi bạn bật rõ ràng Vault Classifier, ứng dụng cục bộ của nó giữ một bộ nhớ đệm cục bộ có giới hạn do người dùng đặt gồm bằng chứng hiển thị, điểm số cục bộ, quyết định và chỉnh sửa cần để phân loại và giải thích các mục. Bộ nhớ đệm này ở lại trên máy Mac của bạn và không thuộc lưu lượng thông thường giữa tiện ích và máy chủ.

Cấu hình, trạng thái thời gian chạy và nhật ký hoạt động của bạn ở lại trên thiết bị của bạn và không được dịch vụ của chúng tôi lưu. Tùy vào bản dựng trình duyệt và các tính năng bạn bật, chúng có thể được xử lý bởi tiện ích, ứng dụng đồng hành Safari cục bộ trên thiết bị, hoặc một cầu nối Vault cục bộ được liên kết rõ ràng.

## Những gì KHÔNG được thu thập hoặc truyền đi

Phần này mô tả cách tiện ích hành xử tự thân. Ngoại lệ duy nhất là tích hợp AI cục bộ (MCP) tùy chọn mà bạn có thể tự bật và kết nối, được mô tả ở phần tiếp theo.

- Lịch sử duyệt web không được chính tiện ích ghi lại, tóm tắt hay truyền đi; nó chỉ được dùng để áp dụng các quy tắc bạn đã cấu hình.
- Nội dung trang không bị chính tiện ích trích xuất, chụp màn hình hay ghi nhật ký.
- Bằng chứng của Vault Classifier không bị tiện ích truyền ra khỏi thiết bị. Chúng chỉ được xử lý bởi cầu nối cục bộ đã ghép nối và ứng dụng khi bạn bật rõ ràng tích hợp đó.
- Dữ liệu nhập biểu mẫu và mật khẩu không bao giờ được tiện ích đọc; mật khẩu và khóa API cũng không đọc được qua tích hợp AI cục bộ (MCP).
- Không có mã định danh tiện ích, mã định danh tài khoản, mã định danh thiết bị hay cấu hình quy tắc nào của bạn được truyền đi cho việc thực thi quy tắc thông thường.

## Tích hợp AI cục bộ (MCP) tùy chọn

Tiện ích có thể, một cách tùy chọn, trả lời các yêu cầu từ một **máy chủ MCP Vault** cục bộ chạy bên trong các ứng dụng máy tính Vault trên chính thiết bị của bạn, để bạn có thể kết nối trợ lý AI của riêng mình (một "máy khách MCP") và để nó đọc hoặc thao tác trên thiết lập Vault của bạn thay bạn. Tích hợp này **tắt theo mặc định** và không thay đổi gì trừ khi bạn cố ý bật nó.

- **Bạn là người khởi động.** Không có gì bị để lộ cho đến khi bạn bật tích hợp và kết nối một máy khách MCP, và mỗi kết nối máy khách đều do bạn phê duyệt. Tắt nó sẽ thu hồi quyền truy cập ngay lập tức.
- **Máy chủ là cục bộ.** Dữ liệu do tiện ích cung cấp được chuyển, qua chính cầu nối trên thiết bị đã xác thực, đến một máy chủ MCP Vault trên máy Mac của bạn — không đến trang web của chúng tôi hay bất kỳ máy chủ Vault nào. Bản thân tiện ích không gửi dữ liệu của bạn cho bên thứ ba.
- **Sau đó trợ lý của bạn quyết định.** Một khi máy khách MCP đã kết nối nhận dữ liệu theo yêu cầu của bạn, điều xảy ra với dữ liệu đó do **máy khách ấy** và các điều khoản quyền riêng tư của chính nó chi phối. Nếu trợ lý bạn chọn dựa vào một dịch vụ từ xa, trợ lý đó có thể truyền dữ liệu của bạn theo chỉ dẫn của bạn — giống như khi bạn dán thông tin vào bất kỳ công cụ AI nào. Hãy chọn một máy khách bạn tin tưởng.
- **Những gì có thể bị để lộ.** Theo chỉ dẫn của bạn, một trợ lý đã kết nối có thể đọc các nhóm chặn, lịch biểu, quy tắc tùy chỉnh, nhật ký hoạt động, bộ đếm thời gian sử dụng, URL của thẻ đang hoạt động hoặc các thẻ đang mở, nội dung trang hiển thị trên các trang bạn đã cấu hình, cùng mọi bằng chứng và quyết định của Vault Classifier. Các hành động làm thay đổi trạng thái (chỉnh sửa nhóm, bắt đầu một lần hoãn, chạy một quy tắc đã lưu, kích hoạt phân loại) được xác nhận riêng từng cái.
- **Bí mật vẫn là bí mật.** Mật khẩu (như mật khẩu kiểm soát của cha mẹ) và khóa API của nhà cung cấp là **chỉ-ghi** qua tích hợp này: có thể thiết lập, nhưng không trợ lý nào có thể đọc lại.
- **Chỉ Chromium.** Giống như cầu nối Classifier, tích hợp này chỉ tồn tại trên các trình duyệt Chromium có máy chủ cục bộ trên thiết bị; Firefox và Safari không để lộ nó.

## Vì sao mỗi quyền được yêu cầu

| Quyền | Dùng để làm gì |
| --- | --- |
| `storage` | Lưu và tải các nhóm chặn, cài đặt và trạng thái thời gian chạy của bạn chỉ trong trình duyệt của bạn. |
| `favicon` | Hiển thị các biểu tượng trang được trình duyệt lưu vào bộ nhớ đệm bên cạnh các quy tắc trong Chromium. Việc này không gửi lịch sử duyệt web và không tạo yêu cầu đến dịch vụ của chúng tôi. |
| `nativeMessaging` | Trên Chromium, yêu cầu thiết bị cung cấp một bằng chứng Native Messaging cục bộ cho cầu nối Vault Classifier đã xác thực; trên Safari, chuyển tiếp các yêu cầu hộp cát của quy tắc tùy chỉnh đến ứng dụng chứa cục bộ trên thiết bị. Đây không phải là truyền tải qua đám mây. |
| `alarms` | Đánh thức service worker nền theo lịch để làm mới các giới hạn dựa trên thời gian và trạng thái quy tắc khi một cửa sổ hoãn, đóng băng hoặc lịch biểu kết thúc. |
| `offscreen` | Chạy JavaScript quy tắc tùy chỉnh trong hộp cát ở một tài liệu ngoài màn hình để nó không thể thoát khỏi tiện ích hay chạm trực tiếp vào các trang của bạn. |
| `tabs` | Mở trình chỉnh sửa dưới dạng một thẻ đầy đủ khi bạn nhấp vào biểu tượng thanh công cụ, tra cứu URL của thẻ đang hoạt động để đánh giá các quy tắc nhóm, và tải lại các thẻ sau một thay đổi quy tắc bạn thực hiện trong trình chỉnh sửa. |
| `webNavigation` | Phát hiện các thay đổi URL của SPA (điều hướng push-state) để các bộ ẩn nguồn cấp theo nền tảng và các quy tắc theo sự kiện có thể phản ứng với điều hướng trong trang, không chỉ với việc tải toàn trang. |
| Quyền truy cập máy chủ `<all_urls>` | Áp dụng các quy tắc chặn và bộ ẩn nguồn cấp theo nền tảng của bạn trên các trang bạn chọn để chặn. Tiện ích chỉ đọc/sửa đổi các trang tại những URL mà bạn đã chủ động cấu hình một quy tắc, và chỉ để thực thi quy tắc đó; bộ chuyển đổi Vault Classifier tùy chọn bị giới hạn ở YouTube. |

## Quy tắc tùy chỉnh

Nếu bạn viết các quy tắc JavaScript tùy chỉnh, mã đó:

- Chạy trong hộp cát ở một tài liệu ngoài màn hình; nó không thể trực tiếp truy cập mạng, các trang của bạn hay các tiện ích khác.
- Chỉ giao tiếp với các tập lệnh nội dung qua một cầu nối tin nhắn cố định do API trợ giúp của tiện ích định nghĩa.
- Bị cách ly tự động (vô hiệu hóa kèm một mục nhật ký) nếu vượt quá các giới hạn tích hợp về CPU, nhật ký, post-message hoặc đột biến DOM.

Các quy tắc tùy chỉnh của bạn được lưu cục bộ cùng với phần cài đặt còn lại và không bao giờ được truyền ra khỏi thiết bị.

## Thống kê trang web

Phần này nói về **trang web**. Trang web công bố một bảng **Thống kê** nhỏ, và để điền vào đó, máy chủ giữ một vài số đếm tổng hợp:

- **Số lượt tải xuống** — nút tải xuống của mỗi sản phẩm được nhấp bao nhiêu lần (macOS, Windows, tiện ích trình duyệt, Safari).
- **Tài khoản** — có bao nhiêu tài khoản tồn tại.
- **Hoạt động Hỏi & Đáp** — tổng số bài đăng và bình luận trên diễn đàn.

Mỗi giờ một lần, máy chủ ghi lại giá trị hiện tại của từng số đếm tổng hợp. Các ảnh chụp nhanh này không chứa bất kỳ sự kiện theo người truy cập, luồng nhấp chuột hay lịch sử phiên nào.

- **Hoàn toàn ẩn danh / đã khử nhận dạng.** Đây là những tổng lũy tiến đơn giản. Chúng **không** được liên kết với tên, tài khoản, email, địa chỉ IP, thiết bị hay bất kỳ mã định danh nào khác của bạn — không có cách nào quy một số đếm về một cá nhân.
- **Không bao giờ vì mục đích thương mại.** Dữ liệu này chỉ tồn tại để hiển thị bảng Thống kê công khai. Nó **không bao giờ bị bán, chia sẻ cho bên thứ ba, dùng cho quảng cáo hay dùng cho bất kỳ mục đích thương mại nào khác.**

## Trẻ em

Tiện ích là một công cụ năng suất đa dụng. Nó không hướng đến trẻ em, không cố ý thu thập dữ liệu của bất kỳ ai và không hiển thị quảng cáo.

## Thay đổi đối với chính sách này

Nếu các cách thức xử lý dữ liệu thay đổi trong một phiên bản tương lai, tệp này sẽ được cập nhật và thay đổi sẽ được tóm tắt trong ghi chú phiên bản của bản phát hành đó.

## Liên hệ

Câu hỏi, mối quan ngại hoặc báo cáo lỗi: vui lòng mở một issue trong kho nguồn của tiện ích, hoặc dùng email hỗ trợ được liệt kê trên trang Chrome Web Store.
