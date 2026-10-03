# Hướng dẫn sử dụng tiện ích trình duyệt Vault

Vault kiểm soát trang web và nội dung nền tảng được hỗ trợ trong hồ sơ trình duyệt đã cài tiện ích. Mở trình chỉnh sửa từ nút tiện ích trên thanh công cụ. Khi kết nối, Mac Vault hoặc Windows Vault cung cấp tính năng gắn thẻ và Activity cục bộ; tiện ích thực thi các mục tiêu trên trình duyệt.

## Nhóm chặn

**Nhóm chặn** áp dụng chính sách chặn. **Nhóm phân loại** gắn thẻ cho nội dung; bản thân nhóm này không chặn gì.

1. Thêm một nhóm chặn và đặt tên.
2. Chọn mục tiêu trong **Áp dụng cho**.
3. Chọn thời điểm áp dụng chặn, rồi đặt lịch hoặc thời lượng cho phép nếu cần.
4. Bật nhóm. Các mục tiêu của nhóm dùng chung chính sách đó.

Các chỉnh sửa thông thường được lưu tự động. Nếu có lỗi, chỉnh sửa chưa được chấp nhận; hãy sửa trường đó rồi thử lại. Tắt nhóm để ngừng chính sách nhưng giữ cấu hình. **Xóa nhóm** sẽ xóa nhóm. Kéo nhóm để sắp xếp lại. Nhiều nhóm có thể áp dụng cho cùng mục tiêu; hoãn một nhóm không gỡ chặn của nhóm khác.

**Xuất** sao chép cấu hình nhóm. **Nhập** thay thế cấu hình của nhóm đã chọn sau khi xác nhận.

### Thời lượng cho phép và lịch

**Chặn ngay** áp dụng bất cứ khi nào nhóm đang bật khớp và lịch của nhóm có hiệu lực. **Chặn khi hết thời lượng cho phép** cho phép sử dụng nội dung khớp cho đến khi thời lượng cho phép cạn.

Đặt thời lượng cho phép theo phút và chu kỳ đặt lại theo giờ. Giới hạn trượt tính mức sử dụng trong khoảng thời gian ngay trước đó. Đặt lại lúc nửa đêm sẽ bắt đầu chu kỳ mới vào nửa đêm theo giờ địa phương, kể cả với giới hạn trượt.

Chọn các ngày trong tuần cần hoạt động và các khung giờ địa phương tùy chọn, mỗi dòng một khung, chẳng hạn **09:00-12:00**. Nếu không có khung giờ, lịch áp dụng suốt các ngày đã chọn. Giờ kết thúc phải muộn hơn giờ bắt đầu trong cùng ngày; hãy tách lịch qua đêm thành các ngày riêng.

### Hoãn

Cấu hình hoãn trong từng nhóm chặn. **Tạm dừng chặn** đình chỉ chính sách của nhóm trong thời lượng tạm dừng. **Cộng vào thời lượng cho phép** thêm phút sử dụng được cho nhóm giới hạn thời gian. Chỉ phần thời lượng cộng thêm đã dùng mới được tính là thời gian hoãn. Thời lượng cộng thêm chưa dùng sẽ hết hạn vào lần đặt lại kế tiếp; với giới hạn trượt, hết hạn sau một cửa sổ hoặc sớm hơn vào nửa đêm nếu bật tùy chọn đó.

**Độ trễ kích hoạt** hoãn yêu cầu hoãn trong khi việc chặn vẫn tiếp tục. **Thời gian chờ** là khoảng chờ sau khi hết hoãn trước lần yêu cầu tiếp theo. **Số lần xác nhận bắt buộc** đặt số bước xác nhận. Chỉ có thể hoãn nhóm đã khóa nếu cho phép trước khi khóa.

### Khóa và PIN

**Khóa** ngăn chỉnh sửa thông thường. Mở khóa cần mười lần xác nhận, cách nhau năm giây, cùng thời gian chờ đã đặt và PIN sáu chữ số. **Chờ trước khi mở khóa** nhận giá trị 0–72 giờ; 0 nghĩa là không chờ thêm.

Khi đang khóa, có thể kéo dài thời gian chờ và thêm PIN nếu chưa có. Không thể nới lỏng các điều kiện đó cho đến khi mở khóa nhóm. Xóa nhóm cũng phải tuân thủ thời gian chờ còn lại và PIN.

### Nhóm được liên kết

Dùng **Liên kết** để nối các nhóm được chọn rõ ràng trong những chương trình Vault khác. Các nhóm được liên kết dùng chung tên, cài đặt chính sách được hỗ trợ, mục tiêu, mức sử dụng và điều kiện khóa. Mỗi chương trình chỉnh sửa và thực thi các loại mục tiêu mà chương trình đó hỗ trợ; các mục tiêu loại khác vẫn có sẵn cho chương trình liên kết. Hủy liên kết vẫn giữ từng nhóm và cài đặt của nhóm.

Nếu một thành viên liên kết ngoại tuyến, có thể không chỉnh sửa được. Mở ứng dụng Vault trên máy tính và trình duyệt liên kết để kết nối lại. Chính sách đã lưu cục bộ vẫn có thể tiếp tục áp dụng khi thành viên ngoại tuyến.

## Trợ giúp

Nhấp vào chữ **i** nhỏ bên cạnh trường để xem giải thích. Nhấp bên ngoài hoặc nhấn Escape để đóng. Danh sách nằm trong các hộp có thể cuộn; cuộn trong hộp để xem thêm mục. Tìm kiếm lọc danh sách đang hiển thị mà không xóa mục nào.

Quy tắc tùy chỉnh có [Hướng dẫn mã](../code-manual/vi.md) riêng. Hướng dẫn giải thích trình chỉnh sửa, kích hoạt, nhật ký, truy cập tệp và API được hỗ trợ.

## Trang web và nội dung nền tảng

Thêm tên miền hoặc URL đầy đủ, mỗi dòng một mục. Tên miền bao gồm cả tên miền phụ. Đường dẫn giới hạn việc khớp trong đường dẫn đó và các nhánh bên dưới. **Chặn mọi thứ ngoại trừ các trang này** biến danh sách thành danh sách cho phép.

Có thể thêm cùng một trang web nhiều lần. Mỗi mục có bộ lọc và điều khiển trang riêng; chẳng hạn một mục YouTube có thể chặn Shorts, mục khác chặn một nhà sáng tạo. Các mục khớp được kết hợp trong nhóm và dùng chung lịch, thời lượng cho phép và hoãn của nhóm.

Mục tiêu có thể phủ trang khớp hoặc tạm dừng trước rồi đề nghị Tiếp tục sau khi đếm ngược. Trong cùng nhóm, mục tiêu chặn được ưu tiên hơn mục tiêu tạm dừng. **Khi bị chặn: chuyển hướng hoặc thông báo** nhận địa chỉ web hoặc thông báo phủ trang; để trống để phủ ngay tại trang hiện tại. Tạm dừng không bao giờ chuyển hướng.

Mục tiêu nền tảng dùng **Nhà sáng tạo** cho nền tảng video, **Tài khoản** cho Twitter / X, **Cộng đồng** cho Reddit và ID máy chủ/kênh cho Discord. Điều khiển áp dụng khi Vault nhận diện được nguồn và loại nội dung. Điều khiển nội dung ẩn các phần tử trang được hỗ trợ, như quảng cáo hoặc thẻ video. Quyền trình duyệt và thay đổi trang web có thể ảnh hưởng đến các điều khiển này.

### Bộ lọc thẻ nội dung

Kết nối với bộ phân loại và sửa thẻ khả dụng trong các trình duyệt Chromium được hỗ trợ, như Chrome và Edge, cũng như Safari Vault trên macOS.

Kết nối Mac Vault hoặc Windows Vault và cấu hình bộ phân loại để nhận thẻ. Bộ lọc thẻ của nhóm chặn chọn nội dung cần phủ hoặc ẩn. Bộ lọc không bắt đầu hay tạm dừng việc gắn thẻ; hãy dùng cài đặt bộ phân loại trong ứng dụng máy tính hoặc điều khiển tạm dừng của nhóm phân loại tương ứng.

Mỗi mục trang web có một bộ lọc **Áp dụng cho**: mọi nội dung, nhà sáng tạo đã chọn, tất cả trừ nhà sáng tạo đã chọn, thẻ đã chọn hoặc tất cả trừ thẻ đã chọn. Thêm mục khác cho cùng trang web nếu cần bộ lọc khác.

Chọn các thẻ cụ thể hoặc mọi thứ trừ các thẻ đó. Quy tắc có thể kết hợp thẻ (**Gaming + Drama**), yêu cầu độ tin cậy (**Gaming @3**) hoặc tạo ngoại lệ (**!Tutorial**). **Phủ nội dung** vẫn cho phép sửa thẻ. **Ẩn nội dung** xóa mục khớp khỏi trang.

**Chặn cả nội dung không có thẻ đủ tin cậy** bao gồm kết quả đã hoàn tất nhưng không có thẻ ở ngưỡng tin cậy mặc định, kể cả kết quả tin cậy thấp. Các quy tắc được liệt kê rõ sẽ được kiểm tra trước. **Chưa gắn thẻ** nghĩa là quá trình gắn thẻ đã xong nhưng không có thẻ; **Đang gắn thẻ** nghĩa là kết quả đang chờ. Tùy chọn nội dung đang chờ riêng kiểm soát việc phủ các mục cho đến khi gắn thẻ xong.

### Sửa thẻ

Nhấp **+ thẻ** bên cạnh thẻ của mục để mở bộ chọn chỉnh sửa. Tìm thẻ hiện có của bộ phân loại rồi chọn thẻ để thêm. Nhấp nút xóa trên thẻ đã chọn hoặc chọn thẻ rồi nhấn Delete một lần để xóa. Chỉnh sửa được gửi đến ứng dụng máy tính đã kết nối và dùng cho các lần gắn thẻ sau. Nếu không tra cứu được, mục này hiển thị **Chưa gắn thẻ** và có thể tự thử lại; cách hiển thị này không tạo thẻ trong bộ phân loại.

## Cài đặt và kết nối

**Hiện nút thêm nhanh +** thêm nút nhỏ vào các trang được hỗ trợ. Chọn nhóm đích trong danh sách; lựa chọn được ghi nhớ khi mở lại Vault. Dùng nút trên trang để thêm trang đó vào danh sách trang web. Với danh sách cho phép, thao tác này cho phép trang. Nhóm đã khóa không nhận mục thêm nhanh.

Cấu hình từ điển chính thức và nhập/xuất từ điển cá nhân trong ứng dụng máy tính tại **Cài đặt → Bộ phân loại → Từ điển chính thức**. Dịch vụ từ điển có thể được liên hệ khi thiếu nhà sáng tạo trong bộ nhớ đệm hoặc bật đóng góp tùy chọn; nghiên cứu web có sự đồng ý và cài đặt nhà cung cấp riêng. Xem hướng dẫn máy tính và thông báo.

Kết nối bộ phân loại báo trạng thái dịch vụ Vault trên máy tính cục bộ. Cấu hình nhóm phân loại, tải mô hình, Knowledge, đồng ý nghiên cứu và nhà cung cấp API trong ứng dụng máy tính đã kết nối.

Nếu thiếu thẻ, kiểm tra ứng dụng Vault trên máy tính đang mở, kết nối đã thiết lập, việc gắn thẻ đã bật, nhóm phân loại liên quan đã hoạt động trở lại và nguồn cấp nền tảng đã được ghi nhận. Kiểm tra trạng thái tải mô hình trong ứng dụng máy tính. Nếu việc chặn không có hiệu lực, kiểm tra trạng thái bật của nhóm, mục tiêu, lịch, thời lượng cho phép và trạng thái hoãn.
