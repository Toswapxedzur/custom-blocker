# Tham khảo chức năng mở rộng Vault

## Mục đích và trạng thái

Đây là đặc tả chức năng có thẩm quyền dành cho tiện ích mở rộng trình duyệt Vault. Nó ghi lại hợp đồng sản phẩm: dữ liệu mà người dùng có thể đặt cấu hình, hành vi chính xác mà cấu hình tạo ra, ngôn ngữ Quy tắc tùy chỉnh công khai và các giới hạn áp dụng cho cấu hình đó.

Nó cố tình không phải là một hướng dẫn bắt đầu nhanh. Hướng dẫn trên trang web là con đường học tập. Tài liệu này dành cho những người cần định cấu hình, kiểm tra, bảo trì, kiểm tra hoặc tái tạo hành vi mà người dùng của Vault có thể nhìn thấy.

Mã là sự thật kinh điển khi tài liệu này và sản phẩm không đồng ý. Các tên trong tài liệu này sử dụng từ vựng được lưu trữ/công khai của sản phẩm khi thực tế. Một từ như "trả về" có nghĩa là giá trị trả về được cung cấp cho Quy tắc tùy chỉnh; nó không hứa hẹn một kết quả cấp trình duyệt nếu trình duyệt hoặc trang từ chối hành động được yêu cầu.

##1. Ranh giới sản phẩm

Vault là một WebExtension có khả năng kiểm soát tiêu điểm. Đơn vị cấu hình của nó là **nhóm khối**. Một nhóm có thể:

- quyết định chặn trang web, trang nền tảng, người sáng tạo, cộng đồng, máy chủ, kênh hoặc tài khoản cấp cao nhất;
- ẩn bề mặt nền tảng được định cấu hình hoặc thẻ nguồn cấp dữ liệu phù hợp;
- đo thời gian dành cho phạm vi phù hợp;
- áp dụng lịch trình, bảo vệ đóng băng hoặc báo lại tạm thời khi loại nhóm đó hỗ trợ;
- chạy quy tắc JavaScript tùy chỉnh với API sự kiện;
- hiển thị đồng hồ hẹn giờ, bảng điều khiển, thông báo hoặc nhật ký trang trên trang;
- chuyển hướng, điều hướng, đóng tab trình duyệt hoặc duy trì danh sách chặn trang web được tạo theo quy tắc chỉ theo phiên;
- tùy chọn tham gia vào cụm cầu Vault được kết nối cục bộ.

Vault chỉ hoạt động bên trong hồ sơ trình duyệt nơi nó được cài đặt và chỉ khi trình duyệt cho phép chạy tập lệnh nội dung của nó. Nó không:

- cài đặt ứng dụng gốc hoặc tiện ích mở rộng trình duyệt;
- chặn các ứng dụng hệ điều hành;
- bỏ qua lời nhắc cấp phép của trình duyệt, hạn chế duyệt web ở chế độ riêng tư hoặc mô hình bảo mật của chính trang web;
- đảm bảo ẩn dựa trên bộ chọn khi nền tảng bên thứ ba thay đổi DOM của nó;
- làm cho trạng thái quy tắc tùy chỉnh có thể di chuyển được trên các cấu hình trừ khi người dùng xuất/định cấu hình nó một cách riêng biệt;
- cung cấp tường lửa mạng, proxy, kiểm soát tài khoản hoặc dịch vụ giám sát phụ huynh.

Các thuật ngữ sau đây được sử dụng xuyên suốt:

| Kỳ hạn | Ý nghĩa |
| --- | --- |
| Nhóm | Một đối tượng cấu hình được đặt tên độc lập. Tên phải là duy nhất trong phần mở rộng, bỏ qua chữ hoa chữ thường. |
| Nhóm trang web | Một nhóm bình thường có danh sách miền là điều kiện khớp chính của nó. |
| Nhóm nền tảng | Một nhóm bình thường chuyên về YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord hoặc Twitter/X. |
| Nhóm tùy chỉnh | Một nhóm sở hữu quy tắc JavaScript và đăng ký sự kiện của nó. Quy tắc của nó quyết định hành vi của nó. |
| Trận đấu | Trang, mục nguồn cấp dữ liệu hoặc bề mặt nền tảng đáp ứng các điều kiện được định cấu hình của nhóm. |
| Đang hoạt động | Nhóm đã được bật, đủ điều kiện cho lịch biểu của mình và hiện không bị tạm ẩn. Các nhóm tùy chỉnh không bị chi phối bởi giao diện người dùng lịch trình thông thường. |
| Chặn | Ngăn chặn trang cấp cao nhất hiện tại vẫn có thể sử dụng được, thông thường bằng cách chuyển hướng đến mục tiêu dự phòng của nó. |
| Ẩn | Xóa hoặc ẩn một phần tử/thẻ trong trang hiện được hiển thị. Ẩn không phải là chặn mạng. |
| URL dự phòng | Mục tiêu chuyển hướng dành riêng cho nhóm. Nếu để trống, dự phòng chung sẽ được sử dụng. |
| Hiệu ứng cho phép/ngoại lệ | Phán quyết thẻ nền tảng giúp giải cứu nội dung phù hợp khỏi các quy tắc ẩn có mức độ ưu tiên thấp hơn. Đây không phải là danh sách cho phép chung của trang web. |

## 2. Mô hình nhóm và vòng đời chung

Mỗi nhóm được lưu trữ đều có id ổn định, tên, loại, cờ được bật và các trường chính sách chung. Một nhóm bình thường mới được bật theo mặc định. Một nhóm có thể được chọn, lưu theo hành vi tự động lưu của người chỉnh sửa, sắp xếp lại, xuất, nhập, đông lạnh, không đông lạnh, báo lại, vô hiệu hóa hoặc xóa.

### 2.1 Thứ tự và chồng chéo

Nhiều nhóm có thể phù hợp với cùng một trang. Vault đánh giá các nhóm được lưu trữ từ cuối danh sách được hiển thị về phía đầu. Hãy coi các mục thấp hơn trong danh sách là các mục phù hợp muộn hơn/có mức độ ưu tiên cao hơn khi thiết kế các quy tắc chồng chéo.

Đối với việc chặn trang web cấp cao thông thường, bất kỳ nhóm chặn hiện hành nào cũng có thể khiến trang không khả dụng. Để lọc thẻ nguồn cấp dữ liệu, tầng nền tảng sử dụng thứ tự và hiệu ứng của từng nhóm phù hợp: cho phép/ngoại lệ đối sánh sau này có thể giải cứu một mục khỏi các vị từ chặn có mức độ ưu tiên thấp hơn. Hành vi ngoại lệ này được giới hạn ở bề mặt lọc thẻ nền tảng; nó không hoàn tác khối trang toàn trang thông thường.

### 2.2 Trạng thái kích hoạt

Các nhóm bị vô hiệu hóa được giữ lại nhưng không tham gia vào các hoạt động khớp, tính giờ, lịch trình hoặc hoạt động báo lại thông thường. Việc vô hiệu hóa một nhóm Tùy chỉnh cũng sẽ hủy bỏ các đăng ký đang hoạt động của nhóm đó. Việc bật lại không biến văn bản chưa được lưu thành quy tắc Tùy chỉnh hiện hoạt; chạy quy tắc để tải nguồn đã lưu.

### 2.3 Các trường chung

| Lĩnh vực | Ý nghĩa và hạn chế |
| --- | --- |
| Tên | Không trống, được cắt bớt và không phân biệt chữ hoa chữ thường trong điểm cuối này. Cầu nối cũng xác định các nhóm có thể liên kết theo tên và loại, vì vậy tên ổn định rất quan trọng. |
| Đã bật | Bật hoặc tắt kết hợp thông thường. |
| Hành vi | Chặn ngay lập tức, chặn sau khi cho phép hoặc hẹn giờ/đếm ngược. Các nhóm tùy chỉnh sử dụng quy tắc riêng của họ thay vì bộ chọn hành vi thông thường này. |
| Số phút cho phép | Số dương được sử dụng bởi hành vi chặn sau trợ cấp. Nhóm mới mặc định là 15 phút. |
| Đặt lại khoảng thời gian | Số dương được sử dụng bởi các nhóm bình thường được tính thời gian. Nhóm mới mặc định là 24 giờ. |
| Những ngày năng động | Thứ Hai đến Chủ nhật. Một nhóm bình thường không hoạt động khi ngày trong tuần ở địa phương hiện tại không được chọn. |
| Cửa sổ thời gian | Không có hoặc nhiều cửa sổ theo giờ địa phương, mỗi cửa sổ một dòng, được viết là HHMM-HHMM. |
| Chế độ đóng băng | Không có, Đông lạnh, Đông lạnh nghiêm ngặt, hoặc Đông lạnh từ cha mẹ. |
| Chính sách báo lại | Liệu nhóm có cho phép báo lại hay không, với các điều khiển thời lượng/độ trễ/thời gian hồi chiêu/xác nhận cho các nhóm bình thường. |
| URL dự phòng | Đích được sử dụng nếu nhóm chặn một trang. |
| Chuyển sang phần tiếp theo | Khi được cung cấp trong trình chỉnh sửa, yêu cầu luồng chặn thông thường di chuyển qua mục tiêu bị chặn thay vì ở lại trên đó. |

### 2.4 Hành vi nhóm bình thường

Trình soạn thảo thông thường cung cấp ba hành vi:

| Hành vi | Kết quả chức năng |
| --- | --- |
| Chặn ngay lập tức | Sau khi nhóm hoạt động và phù hợp, quyết định chặn trang thông thường sẽ có hiệu lực ngay lập tức. |
| Chặn sau vài phút | Thời gian hiển thị trang phù hợp sẽ tích lũy vào khoản phụ cấp được định cấu hình. Khi hết hạn mức, nhóm thông thường sẽ chặn cho đến khi thời gian sử dụng được đặt lại hoặc nhóm không hoạt động/bị tạm ẩn. |
| Hẹn giờ (đếm ngược, không chặn) | Thời gian hiển thị trang phù hợp được ghi lại và có thể được hiển thị. Chế độ này không bao giờ chặn chỉ vì bộ đếm thời gian của nó đạt đến một giá trị. |

Việc sử dụng theo thời gian dựa trên thời gian hiển thị trên trang. Nó không nhằm mục đích tính phí thời gian khi một trang bị ẩn trong tab nền. Khoảng thời gian đặt lại là khoảng thời gian chính sách luân phiên cho nhóm được tính thời gian thông thường. Bộ tính giờ thông thường độc lập theo nhóm.

### 2.5 Lịch trình

Lịch trình áp dụng cho nhóm bình thường. Nhóm Tùy chỉnh không có giao diện người dùng lịch trình thông thường và được coi là hoạt động vì mục đích JavaScript của nhóm đó; quy tắc phải áp đặt bất kỳ điều kiện thời gian mong muốn nào.

Chính sách ngày hoạt động được đánh giá bằng giờ địa phương:

1. Nếu ngày trong tuần hiện tại không được chọn, nhóm bình thường sẽ không hoạt động.
2. Nếu không cung cấp khoảng thời gian hợp lệ, ngày hoạt động có nghĩa là cả ngày.
3. Nếu cung cấp các cửa sổ hợp lệ thì giờ địa phương hiện tại phải nằm trong ít nhất một cửa sổ.

Mỗi cửa sổ có dạng chính xác HHMM-HHMM, ví dụ 0900-1200. Giờ phải từ 00 đến 23, phút từ 00 đến 59 và thời gian bắt đầu phải trước khi kết thúc trong cùng một ngày. Một cửa sổ bao gồm phần bắt đầu và loại trừ phần kết thúc của nó. Cửa sổ nửa đêm, chẳng hạn như 2300-0100, không hợp lệ. Các dòng trống sẽ bị bỏ qua và các cửa sổ trùng lặp sẽ được thu gọn.

### 2.6 Tạm ẩn

Đối với một nhóm bình thường, báo lại là trạng thái không hoạt động tạm thời với tối đa ba giai đoạn:

| Giai đoạn | Kết quả |
| --- | --- |
| Đang chờ xử lý | Thời gian báo lại được yêu cầu đã tồn tại nhưng chưa bắt đầu do bị trì hoãn kích hoạt. Nhóm vẫn đang hoạt động. |
| Đang hoạt động | Nhóm tạm thời không hoạt động trong thời gian báo lại. |
| Thời gian hồi chiêu | Thời gian báo lại đã kết thúc, nhóm hoạt động trở lại và thời gian báo lại khác không thể bắt đầu cho đến khi hết thời gian hồi chiêu. |

Các trường cấu hình nhóm bình thường là:

| Lĩnh vực | Quy tắc |
| --- | --- |
| Cho phép báo lại | Nếu tắt, không thể bắt đầu báo lại bình thường. |
| Thời lượng báo lại | Phút tích cực. Một nhóm bình thường mới lấy mặc định toàn cầu, ban đầu là 30. |
| Độ trễ kích hoạt | Không hoặc nhiều phút hơn. Trống có nghĩa là không. |
| Thời gian hồi chiêu | Không qua năm phút. Trống có nghĩa là không. |
| Xác nhận | Một số nguyên không âm. Sản phẩm yêu cầu nhiều tương tác xác nhận trước khi đưa ra yêu cầu. |

Nhóm Tùy chỉnh chỉ coi nút Báo lại là một sự kiện đầu vào. Vault phát ra sự kiện Tùy chỉnh có tên snoozePress cho nhóm đó; nó không áp dụng dự phòng thời lượng/độ trễ/thời gian hồi chiêu thông thường thay mặt cho quy tắc. Quy tắc tùy chỉnh có thể sử dụng sự kiện, sự kiên trì của chính nó, bảng điều khiển, bộ hẹn giờ hoặc không có hành động nào cả.

### 2.7 Đóng băng

Việc đóng băng bảo vệ một nhóm khỏi những thay đổi cấu hình thông thường và những thay đổi báo lại thông thường. Việc chọn chế độ đóng băng trong bộ chọn sẽ không tự đóng băng nhóm; hành động đóng băng áp dụng chế độ đã chọn.

| Chế độ | Hợp đồng chức năng |
| --- | --- |
| đông lạnh | Nhóm này sẽ bị khóa cho đến khi quá trình xác nhận rã đông thông thường của sản phẩm hoàn tất. |
| đông lạnh nghiêm ngặt | Nhóm không thể được đóng băng cho đến khi hết thời gian đóng băng nghiêm ngặt. Thời lượng phải lớn hơn 0 và không quá 72 giờ; một nhóm mới mặc định là 24 giờ. |
| Cha mẹ đông lạnh | Cần có mật khẩu người giám hộ để quản lý đóng băng/hủy đóng băng. Hộp thoại cấu hình sử dụng mật khẩu gồm sáu chữ số. |

Không thể chỉnh sửa nhóm cố định thông qua các trường thông thường. Cụm được liên kết cầu nối với thành viên ngoại tuyến cũng có thể khóa các điều khiển đóng băng vì Vault không thể điều phối trạng thái đóng băng một cách an toàn trên toàn cụm. Đóng băng là biện pháp bảo vệ chống lại các hoạt động giao diện người dùng thông thường; nó không biến hồ sơ trình duyệt thành ranh giới bảo mật bất biến.

### 2.8 Nhập, xuất, xóa và đặt lại

Xuất tạo ra một đại diện tương thích của nhóm đã chọn. Nhập xác thực và chuẩn hóa dữ liệu nhóm tương thích trước khi thêm dữ liệu đó. Tên nhóm đã nhập vẫn phải là duy nhất. Xóa nhóm sẽ xóa nhóm đó và trạng thái sử dụng/tạm dừng thông thường của nhóm đó. Xóa xóa tất cả các nhóm sau khi xác nhận.

Đặt lại về mặc định là thao tác **cài đặt chung**. Nó loại bỏ các tùy chọn mở rộng; nó không phải là sản phẩm thay thế xuất/nhập khẩu và phải được coi là có tính chất phá hoại.

## 3. Các loại nhóm và hợp đồng phù hợp

### 3.1 Nhóm trang web mặc định

Nhóm trang web sở hữu danh sách trang web được phân tách bằng dòng. Các mục được chuẩn hóa thành dạng máy chủ/tên miền. Mục nhập máy chủ khớp với máy chủ đó và tất cả các tên miền phụ của nó.

| Cài đặt | Kết quả |
| --- | --- |
| Chặn mọi thứ ngoại trừ những trang web này | Danh sách này là một danh sách chặn. Một máy chủ phù hợp đã bị chặn. |
| Chặn mọi thứ ngoại trừ những trang web này trên | Danh sách này là danh sách cho phép. Mọi máy chủ không có trong danh sách đều bị chặn. Do đó, một danh sách cho phép trống là một hành động cố ý khóa toàn bộ web. |
| Chặn trang chủ | Áp dụng chính sách của nhóm cho bề mặt bắt đầu/trang chủ của trình duyệt đã định cấu hình nơi có sẵn điều khiển đó. |
| URL dự phòng | Chuyển hướng đích cho một khối. Giá trị nhóm trống sẽ trở về giá trị mặc định chung. |

Danh sách miền Nhóm trang thông thường là danh sách khai báo toàn bộ trang duy nhất được trình soạn thảo hiển thị. Thay vào đó, các nhóm nền tảng phù hợp với nền tảng của riêng họ và các điều kiện nền tảng được định cấu hình.

### 3.2 Nhóm nền tảng video

YouTube, TikTok, Facebook, Instagram và Twitch là các nhóm nền tảng video. Mỗi cái được giới hạn ở máy chủ nền tảng riêng của nó. Một nhóm có thể nhắm mục tiêu biểu mẫu nội dung, phạm vi tác giả/tài khoản, nguồn cấp dữ liệu trang chủ của nền tảng và các điều khiển phần tử ẩn tùy chọn.

Các chế độ tác giả chung là:

| Chế độ | Kết quả |
| --- | --- |
| Tất cả | Không hạn chế theo tác giả; các trục được cấu hình khác quyết định sự phù hợp. |
| Bao gồm | Chỉ khớp những người sáng tạo/tài khoản được chuẩn hóa được liệt kê. |
| Loại trừ | Khớp tất cả người sáng tạo/tài khoản được phát hiện ngoại trừ các mục được liệt kê. |
| Không ai | Không trùng khớp với tác giả. Đây là trục tác giả không phù hợp có chủ ý. |
| Thẻ bao gồm | Ghép người tạo với bất kỳ thẻ nào được liệt kê khi Vault có thể phân loại họ. Người sáng tạo không xác định/chưa được phân loại không mở được. |
| Loại trừ thẻ | Ghép những người sáng tạo không có (các) thẻ được định cấu hình khi Vault có thể phân loại họ. Người sáng tạo không xác định/chưa được phân loại không mở được. |

Các lựa chọn về hình thức nội dung dành riêng cho nền tảng:

| Nền tảng | Biểu mẫu nội dung |
| --- | --- |
| YouTube | Tất cả các trang, video ngắn, video dài, bài đăng. |
| TikTok | Tất cả các trang, video ngắn. |
| Facebook | Tất cả các trang, Câu chuyện, video, bài đăng. |
| Instagram | Tất cả các trang, Câu chuyện, video, bài đăng. |
| Co giật | Tất cả các trang, clip, luồng/VOD, trang kênh. |

Vault bình thường hóa đầu vào của tác giả. Trình chỉnh sửa chấp nhận biểu mẫu tay cầm/kênh/trang thông thường của nền tảng và các URL hồ sơ được hỗ trợ. Nó có thể từ chối các mục nhập không đúng định dạng hoặc hiển thị chúng là không hợp lệ thay vì âm thầm biến chúng thành mục tiêu khác.

Các lựa chọn ẩn bề mặt không phụ thuộc vào việc chặn cấp cao nhất. Chúng chỉ ảnh hưởng đến giao diện người dùng nền tảng hiện tại và có thể ngừng hoạt động khi nền tảng thay đổi đánh dấu.

| Nền tảng | Lựa chọn phần tử ẩn được vận chuyển |
| --- | --- |
| YouTube | Điều hướng/kệ/thẻ ngắn, quảng cáo/bề mặt quảng cáo trên nguồn cấp dữ liệu gia đình và nhận xét. Tùy chọn liên quan đến quảng cáo đưa ra cảnh báo vì việc ẩn quảng cáo có thể xung đột với các điều khoản của nền tảng. |
| TikTok | Khám phá điều hướng. |
| Facebook | Điều hướng cuộn và bề mặt cuộn. |
| Instagram | Cuộn phim và Khám phá điều hướng/bề mặt. |
| Co giật | Duyệt điều hướng. |

Tính năng so khớp thẻ người sáng tạo trên YouTube sử dụng cách phân loại kênh địa phương/có sẵn. Phân loại bị thiếu không trở thành khối chỉ vì chế độ thẻ đã được chọn.

### 3.3 Reddit

Nhóm Reddit chỉ áp dụng trên Reddit. Thực thể của nó là một subreddit. Đầu vào Subreddit chấp nhận hình thức cộng đồng thông thường và chuẩn hóa nó trước khi khớp.

Các chế độ subreddit là:

| Chế độ | Kết quả |
| --- | --- |
| Tất cả | Đăng ký Reddit mà không bị hạn chế danh sách subreddit. |
| Bao gồm | Áp dụng cho các subreddits được liệt kê. |
| Loại trừ | Áp dụng cho tất cả ngoại trừ các subreddits được liệt kê. |
| Không ai | Áp dụng cho không có subreddit. |

Tùy chọn ẩn bề mặt được vận chuyển sẽ ẩn điều hướng Phổ biến/Tất cả. Hoạt động của thẻ nguồn cấp dữ liệu phụ thuộc vào cấu trúc thẻ hiện có thể phát hiện được của Reddit.

### 3.4 Bất hòa

Nhóm Discord chỉ áp dụng trên các trang Discord/Discordapp. Mục tiêu của nó là id máy chủ hoặc cặp máy chủ/kênh. Trình chỉnh sửa mục tiêu chấp nhận các giá trị đường dẫn kênh Discord được chuẩn hóa.

| Chế độ | Kết quả |
| --- | --- |
| Tất cả | Áp dụng cho Discord mà không hạn chế danh sách mục tiêu. |
| Bao gồm | Chỉ áp dụng cho các mục tiêu máy chủ hoặc máy chủ/kênh được liệt kê. |
| Loại trừ | Áp dụng cho tất cả ngoại trừ các mục tiêu được liệt kê. |
| Không ai | Áp dụng cho không có mục tiêu. |

Discord hiện không có lựa chọn phần tử ẩn nào được vận chuyển trong cấu hình nền tảng thông thường.

### 3.5 Twitter / X

Nhóm Twitter/X áp dụng trên X/Twitter. Nó có thể áp dụng cho tất cả các tài khoản hoặc sử dụng các chế độ tài khoản chung được mô tả cho nền tảng video, với đầu vào liên kết hồ sơ/điều khiển được chuẩn hóa.

Các lựa chọn phần tử ẩn được vận chuyển là Khám phá, Tin nhắn, Grok, Xu hướng và các mục nguồn cấp dữ liệu được quảng cáo. Giống như tất cả các điều khiển bề mặt dựa trên bộ chọn, thay đổi đánh dấu X có thể ảnh hưởng đến hoạt động của chúng.

### 3.6 Các trường khai báo nhóm tùy chỉnh

Nhóm Tùy chỉnh chủ yếu chạy nguồn JavaScript của nó. Nó không sử dụng bộ chọn hành vi thông thường hoặc giao diện người dùng lịch trình thông thường. Tuy nhiên, nó có thể mang danh sách miền khi được nhập hoặc định cấu hình thông qua dữ liệu tương thích:

- danh sách chặn Tùy chỉnh không trống có thể tham gia vào quyết định trang web toàn trang thông thường;
- Danh sách cho phép tùy chỉnh có thể tham gia ngay cả khi trống, tạo ra khóa khai báo toàn web;
- nhóm Tùy chỉnh chưa được định cấu hình không vô tình chặn các trang chỉ vì nhóm đó có quy tắc;
- Bộ hẹn giờ tùy chỉnh không bao giờ tự chặn; một quy tắc quyết định rõ ràng có nên chặn khi hết giờ hay không.

## 4. Cài đặt chung

Cài đặt chung áp dụng cho tiện ích mở rộng thay vì một nhóm.

| Cài đặt | Mặc định | Hành vi |
| --- | --- | --- |
| Tỷ lệ đánh dấu | 1000 mili giây | Tần suất của sự kiện tùy chỉnh được chia sẻ. Phạm vi hợp lệ là 250 đến 60.000 ms. Giá trị thấp hơn có thể làm cho các quy tắc hướng sự kiện phản hồi nhanh hơn nhưng sử dụng nhiều CPU hơn. |
| Tự động lưu lỗi | 400 mili giây | Trì hoãn sau lần thay đổi trình chỉnh sửa cuối cùng trước khi duy trì cài đặt bình thường. Tối đa là 5.000 mili giây. |
| Chế độ gỡ lỗi | Tắt | Bật đầu ra theo dõi quy tắc tùy chỉnh chi tiết và lớp phủ nhật ký gỡ lỗi trên trang. Nó không kiểm soát liệu lệnh gọi nhật ký thông thường của quy tắc có đến được nhật ký bật lên hay không. |
| Hiển thị nhật ký quy tắc tùy chỉnh trên các trang web | Trên | Kiểm soát việc nâng cấp nhật ký trang thông thường. Tác giả quy tắc vẫn có thể yêu cầu đầu ra chỉ hiển thị trên màn hình hoặc chỉ bật lên một cách rõ ràng. |
| Thời lượng báo lại mặc định | 30 phút | Seed được sử dụng khi tạo các nhóm bình thường mới. Các nhóm hiện tại giữ lại thời hạn riêng của họ. |
| URL dự phòng mặc định | về:trống | Được sử dụng khi nhóm chặn không có URL dự phòng dành riêng cho nhóm. |
| Giúp phân loại người sáng tạo | Tắt | Chọn tham gia rõ ràng. Nó chỉ gửi các id kênh YouTube gặp phải đến dịch vụ phân loại đã định cấu hình; nó không gửi tiêu đề hoặc lịch sử xem. |
| Thư mục tệp cục bộ | Không có | Khả năng thư mục tùy chọn cho các quy tắc Tùy chỉnh. Xem phần 9. |
| Cầu ứng dụng web | Tắt | Kết nối tùy chọn với trung tâm Vault cục bộ tương thích. Xem phần 11. |

### 4.1 Giao diện soạn thảo và bề mặt phản hồi

Trình chỉnh sửa tiện ích mở rộng có danh sách nhóm liên tục và trình chỉnh sửa nhóm được chọn. Danh sách nhóm cung cấp bộ chọn loại nhóm, Thêm, Xóa, lựa chọn, bật chuyển đổi và sắp xếp kéo. Bộ chia của nó có thể thay đổi kích thước. Trình chỉnh sửa nhóm đã chọn cung cấp các trường dành riêng cho nhóm và các hành động Xuất/Nhập của nhóm.

Trình chỉnh sửa tự động lưu các thay đổi của trường thông thường sau khoảng thời gian gỡ lỗi toàn cầu. Lỗi xác thực được báo cáo dưới dạng phản hồi trạng thái/bánh mì nướng; các giá trị bình thường không hợp lệ không được âm thầm chuyển đổi thành các cài đặt không liên quan. Một nhóm bị đóng băng sẽ vô hiệu hóa các điều khiển chỉnh sửa thông thường của nó.

Tiện ích mở rộng cũng có các bề mặt phản hồi mà người dùng có thể nhìn thấy sau:

| Bề mặt | Mục đích chức năng |
| --- | --- |
| Hướng dẫn sử dụng | Mở tham chiếu này trong phần mở rộng. |
| Bộ chọn ngôn ngữ | Chọn ngôn ngữ giao diện mở rộng. |
| Cài đặt | Mở cài đặt chung được mô tả ở trên. |
| Trạng thái/phản hồi nâng cốc | Báo cáo lưu, nhập, xác thực và kết quả hành động. |
| Lớp phủ hẹn giờ trên trang | Hiển thị các mục hẹn giờ/đếm ngược thông thường đang hoạt động và Bộ hẹn giờ tùy chỉnh nằm trong phạm vi hiển thị của chúng. Nhiều mặt hàng có thể cùng tồn tại. |
| Bề mặt nhật ký trên trang | Nhận các cuộc gọi nhật ký, cảnh báo và lỗi tùy chỉnh khi được cài đặt chung cho phép. |
| Nhật ký tùy chỉnh | Nhật ký hoạt động trực tiếp cho các mục hiển thị bật lên được tạo theo quy tắc. Nó có thể được xóa và tải xuống. |

Đối với các nhóm Tùy chỉnh, trường Quy tắc lưu trữ văn bản nguồn. Lần chạy đầu tiên thực hiện preflight cú pháp quy tắc và chỉ tải nguồn khi thành công. Trình chỉnh sửa cũng thực hiện tìm lỗi mã nguồn cục bộ khi văn bản thay đổi. Kiểm soát **Let AI Code** hiển thị sẽ mở ra trường lời nhắc và sao chép gói tạo mã chứa yêu cầu của người dùng, quy tắc hiện tại và tham chiếu được tạo tới API quy tắc tùy chỉnh hiện tại. Nó không liên hệ với dịch vụ AI hoặc tự động thay đổi quy tắc.

Điều khiển Mẫu sẽ mở trình duyệt mẫu. Một mẫu khi được vận chuyển sẽ có tiêu đề, mô tả, thẻ, thông số và bản xem trước được tạo. Áp dụng nó sẽ thay thế văn bản Quy tắc hiện tại sau khi xác nhận. Danh mục mẫu hiện đang được vận chuyển trống; trình duyệt vẫn có sẵn cho các mẫu được sắp xếp trong tương lai và không được coi là nguồn của các quy tắc hoạt động.

## 5. Ngôn ngữ quy tắc tùy chỉnh

### 5.1 Biểu mẫu nguồn quy tắc

Nguồn của Nhóm tùy chỉnh là JavaScript. Khi **Run**, Vault xóa các đăng ký trước của nhóm và trạng thái được tạo bởi nguồn hoạt động trước đó, sau đó tải nguồn mới.

Nguồn có thể là:

1. a function expression accepting events and helpers; or
2. các câu lệnh trần sử dụng các sự kiện được cung cấp (hoặc sự kiện kế thừa) và các biến trợ giúp.

```js
// Function-expression form
(events, helpers) => {
  events.on("openWebEvent", "welcome", (event, h) => {
    h.log("Opened", event.url);
  });
}
```

```js
// Bare-statement form
events.on("openWebEvent", "welcome", (event, h) => {
  h.log("Opened", event.url);
});
```

Chạy thực hiện cú pháp JavaScript/kiểm tra trước ánh sáng và chỉ khi thành công, nguồn hiện tại mới hoạt động. Việc lưu văn bản và việc chạy văn bản có chủ ý khác nhau: một quy tắc có thể được lưu mà không trở thành nguồn sự kiện hiện hoạt.

Nguồn hoạt động sẽ được dỡ bỏ khi nhóm Tùy chỉnh được chạy lại, bị vô hiệu hóa, bị xóa hoặc bị dừng một cách rõ ràng. Việc chạy lại sẽ xóa các trình xử lý, bộ hẹn giờ, bảng điều khiển, nhóm lưu giữ lâu dài và các biến vị ngữ nền tảng được tạo theo quy tắc trước khi bắt đầu đăng ký. Khôi phục hộp cát có thể tải lại nguồn hoạt động; do đó, tác giả quy tắc phải thực hiện đăng ký bình thường.

### 5.2 Mô hình thực thi và các giả định an toàn

Custom rules are event registrations, not a continuous script loop. Register handlers during rule initialization, then respond to events.

Mỗi người xử lý nhận được:

```js
(event, helpers) => {
  // event: the currently dispatched event object
  // helpers: the public Vault Custom-rule API
}
```

Trình xử lý sự kiện được thực hiện theo mức độ ưu tiên số giảm dần; thứ tự đăng ký sử dụng ưu tiên như nhau. Một trình xử lý có thể được thay thế bằng cách đăng ký lại cùng loại sự kiện và id. Có tối đa 1.000 trình xử lý đã đăng ký cho một nhóm Tùy chỉnh.

Vault giới hạn công việc đang hoạt động của một trình xử lý trong khoảng một giây. Ba lần vượt quá thời hạn cho cùng một nhóm trong vòng một phút sẽ cách ly quy tắc: Vault vô hiệu hóa quy tắc này thay vì liên tục chạy trình xử lý có vấn đề. Không sử dụng chế độ chờ bận, vòng lặp không giới hạn, bỏ phiếu đồng bộ hoặc số lượng lớn đột biến/nhật ký cho mỗi sự kiện.

Mỗi lần gửi đi, Vault chấp nhận tối đa:

| Mục | Tối đa |
| --- | --- |
| Mục nhật ký quy tắc | 200 |
| Sự kiện đã đăng | 64 |
| Hoạt động DOM | 256 |
| Hành động/ý định | 256 |
| Bảng mỗi nhóm | 24 |
| Điều khiển trong một bảng | 32 |
| Các tùy chọn trong điều khiển chọn/radio | 64 |

Các mục nhập nhật ký, sự kiện đã đăng, hoạt động DOM và mục đích dư thừa có thể bị loại bỏ. Quy tắc tùy chỉnh không được phụ thuộc vào các mục nhập vượt quá được phân phối.

### 5.3 Các loại sự kiện tích hợp

Các chuỗi loại sự kiện sau đây đã được tích hợp sẵn. Một quy tắc cũng có thể sử dụng chuỗi loại không trống của chính nó, miễn là nó không bắt đầu bằng dấu gạch dưới.

| Loại sự kiện | Khi nó được gửi | Dữ liệu quan trọng |
| --- | --- | --- |
| đánh dấu sự kiện | Đánh dấu định kỳ được chia sẻ ở cài đặt tỷ lệ đánh dấu toàn cầu. | Ngữ cảnh trang/tab hiện tại nếu có. Sử dụng tùy chọn đăng ký intervalMs để giới hạn tốc độ cho một trình xử lý riêng lẻ. |
| openWebEvent | Một trang cấp cao nhất sẽ có sẵn cho quy tắc. | URL, tên máy chủ, id tab/trang, thời gian. |
| closeWebEvent | Một trang/tab cấp cao nhất sẽ đóng lại. | Bối cảnh URL/tên máy chủ nếu có. |
| webChangedEvent | Điều hướng cấp cao nhất đã được cam kết, bao gồm cả tải lại cùng một URL. | dữ liệu mang URL/tên máy chủ và các cờ điều hướng trước đó như isFirstLoad, isReload và SameDomain. |
| hẹn giờĐã kết thúc | Bộ hẹn giờ tùy chỉnh chuyển sang trạng thái hết hạn. | dữ liệu: timeId, displayName, hướng, currentMs. Nó chỉ được gửi đến nhóm sở hữu bộ đếm thời gian. |
| báo lạiPress | Người dùng nhấn Start Snooze cho nhóm Custom này. | Quy tắc sở hữu phản hồi; không có dự phòng báo lại bình thường nào được thực hiện. |
| bảngSự kiện | Bảng tùy chỉnh được hiển thị có tương tác. | các trường dữ liệu và tiện ích bao gồm thông tin về bảng/điều khiển/sự kiện/giá trị. |
| localFileEvent | Một hành động tệp cục bộ được yêu cầu hoàn tất. | các trường dữ liệu và tiện ích bao gồm requestId, đường dẫn, kết quả, byte, mục nhập và lỗi. |
| trangHeartbeatSự kiện | Nhịp tim của trang hiển thị, khoảng 250 mili giây một lần khi tab hiển thị. | elapsedMs là thời gian trôi qua của trang hiển thị. Bộ hẹn giờ tùy chỉnh có phạm vi tự động sử dụng nó ngay cả khi không có trình xử lý đã đăng ký. |

### 5.4 API đăng ký sự kiện

Đối số đầu tiên cho nguồn kiểu hàm là sổ đăng ký Sự kiện. Trong nguồn câu lệnh trần, cả sự kiện và sự kiện đều đề cập đến sổ đăng ký này.

| Phương pháp | Hợp đồng |
| --- | --- |
| events.on(type, id, handler, options) | Register a handler. Returns true when accepted, false for invalid/capped registrations. |
| events.register(type, id, handler, options) | Alias of on. |
| events.off(type, id) | Unregister a handler. Returns whether something was removed. |
| events.unregister(type, id) | Alias of off. |
| events.unregisterAll(type) | Remove all handlers owned by this group for that event type. Returns the number removed. |
| events.getEvent(type, id) | Return the registered function for this group/id, or null. |
| events.getEvents(type) | Return an object mapping this group's handler ids to functions. |
| events.countRegistered(type) | Return this group's number of registrations for type. |
| events.emit(type, data, options) | Queue a synthetic event. |
| events.post(type, data, options) | Alias of emit. |

Đối tượng tùy chọn xử lý tùy chọn hỗ trợ:

| Tùy chọn | Ý nghĩa |
| --- | --- |
| ưu tiên | Thứ tự số. Giá trị cao hơn chạy trước giá trị thấp hơn. Mặc định 0. |
| khoảngMs | Số dương. Chỉ dành cho tickEvent, chặn các cuộc gọi cho đến khi khoảng thời gian này trôi qua kể từ cuộc gọi trước đó của trình xử lý. |

Các sự kiện tổng hợp được mặc định ở phạm vi nhóm: chỉ những trình xử lý thuộc nhóm phát ra mới nhận được chúng. Sử dụng { phạm vi: "global" } để gửi sự kiện tới mọi quy tắc đã đăng ký cùng loại. Không sử dụng dấu gạch dưới ở đầu tên sự kiện; nó được bảo lưu.

### 5.5 Đối tượng sự kiện

Mọi trình xử lý đều nhận được một đối tượng sự kiện có thể thay đổi với các trường chung:

| Trường/phương pháp | Hợp đồng |
| --- | --- |
| gõ | Chuỗi loại sự kiện. |
| nhómId | Id nhóm tùy chỉnh của người nhận. |
| tabId, pageId | Số nhận dạng trình duyệt khi có sẵn; nếu không thì vô giá trị. |
| url, tên máy chủ | URL và tên máy chủ cấp cao nhất hiện tại hoặc chuỗi trống. |
| thời gian | Bản sao của đối tượng thời gian gửi đi hoặc không. |
| dữ liệu | Tải trọng dành riêng cho sự kiện hoặc không. |
| ngăn chặnDefault() | Đánh dấu công văn là một hành động chặn trang. Trang được chuyển hướng đến liên kết/kết quả chuyển hướng hiện tại nếu có; nếu không thì Vault sử dụng đường dẫn thoát/dự phòng thông thường. |
| stopPropagation() | Dừng các trình xử lý sau này cho việc gửi sự kiện hiện tại. |
| setResult(giá trị) | Lưu trữ một kết quả số hoặc chuỗi. Một chuỗi không trống được coi là mục tiêu chuyển hướng; kết quả 1 ngăn chặn một kết quả ngăn chặn được tích lũy khác. |
| getResult() | Trả về kết quả do đối tượng sự kiện này đặt hoặc null. |
| bài đăng (loại, dữ liệu, tùy chọn) | Xếp hàng một sự kiện tổng hợp, có cùng quy tắc phạm vi với Events.post. |
| setRedirectLink(url) | Đặt URL chuyển hướng cho công văn này. Chỉ trả về sai cho đầu vào không phải chuỗi. |
| getRedirectLink() | Đọc URL chuyển hướng của công văn này hoặc một chuỗi trống. |
| đóng(id) | Yêu cầu đóng một tab. Một số là id tab, một chuỗi xác định một URL và một giá trị bị bỏ qua sẽ nhắm mục tiêu vào tab đang hoạt động. |
| khối(id) | Thêm mẫu chặn trang web động chỉ theo phiên. Không có id chuỗi, hãy sử dụng tên máy chủ sự kiện. |
| bỏ chặn(id) | Xóa mẫu chặn trang web động chỉ trong phiên. Không có id chuỗi, hãy sử dụng tên máy chủ sự kiện. |
| mở() | Không hoạt động trong phần mở rộng của trình duyệt. Nó không thể khởi chạy ứng dụng. |

Trình xử lý có thể đính kèm các thuộc tính bổ sung tùy ý vào sự kiện. Đọc chúng thông qua event.custom hoặc trực tiếp theo tên được chỉ định trong khi đối tượng sự kiện đó vẫn còn hoạt động. Chúng không phải là trạng thái liên tục và không phải là nơi lưu trữ nhiều sự kiện.

Đối với panelEvent, các trường tiện lợi này được thêm vào: panelId, controlId, tên sự kiện, giá trị, giá trị, khóa, mã và keyInfo.

Đối với localFileEvent, các trường tiện lợi này được thêm vào: tên sự kiện, hành động, đường dẫn, thư mụcPath, requestId, ok, văn bản, giá trị, mục nhập, tồn tại, byte và lỗi.

### 5.6 Điểm vào của người trợ giúp

Đối tượng trợ giúp có các thuộc tính trực tiếp sau:

| Điểm vào | Ý nghĩa |
| --- | --- |
| helpers.now | Current dispatch timestamp in milliseconds. |
| helpers.currentUrl | Current unmodified URL string for this dispatch. |
| helpers.groupId | Owning Custom-group id. |
| helpers.log / warn / error | Direct aliases for the log helper. |
| helpers.logScreen / warnScreen / errorScreen | Direct aliases for screen-only logs. |
| helpers.logPopup / warnPopup / errorPopup | Direct aliases for popup-only logs. |
| helpers.getLogHelper() | Returns the log helper. |
| helpers.getDomainHelper(), getDomainUtility() | Return the domain helper. |
| helpers.getTimerHelper() | Returns the timer helper. |
| helpers.getPanelHelper() | Returns the panel helper. |
| helpers.getPersistenceHelper() | Returns the persistence helper. |
| helpers.getRedirectionHelper() | Returns the redirect helper. |
| helpers.getDOMHelper() | Returns the DOM helper. |
| helpers.getNavigationHelper() | Returns the navigation helper. |
| helpers.getStorageHelper() | Returns the persistence plus asynchronous storage helper. |
| helpers.getLocalFolderHelper() | Returns the optional local-folder helper. |
| helpers.getTabHelper() | Returns the tab-snapshot helper. |
| helpers.getWindowHelper() | Returns the browser-tab/window helper. |
| helpers.getPlatformHelper() | Returns the platform-helper collection. |
| helpers.platform() | Returns the platform-helper collection. |
| helpers.platform(name) | Returns the named raw platform API. Valid names: youtube, tiktok, facebook, instagram, twitch. |

## 6. Tham khảo trợ giúp tùy chỉnh

### 6.1 Trợ giúp tên miền

Get it with helpers.getDomainHelper(). It is also available as helpers.getDomainUtility().

| Phương pháp | Trở lại và hành vi |
| --- | --- |
| tên máy chủOf(url) | Máy chủ viết thường được chuẩn hóa mà không có www. ở đầu hoặc null đối với URL không hợp lệ. |
| pathnameOf(url) | Tên đường dẫn URL hoặc / khi URL không thể phân tích được. |
| trận đấu(tên máy chủ, trang web) | Đúng khi tên máy chủ bằng trang web hoặc là tên miền phụ của nó. |
| getPlatform(url) | youtube, tiktok, instagram, facebook, Twitch hoặc null. |
| isYouTubeHost(máy chủ), isTikTokHost(máy chủ), isInstagramHost(máy chủ), isFacebookHost(máy chủ), isTwitchHost(máy chủ), isRedditHost(máy chủ), isDiscordHost(máy chủ) | Máy chủ phân loại. |
| youtube(), tiktok(), instagram(), facebook(), Twitch() | Trả về đối tượng phân loại URL của nền tảng đó. |
| isEmptyStartPage(url) | Đúng đối với các URL trống/tab mới/trang bắt đầu được hỗ trợ của trình duyệt. |
| matchAny(url, mẫu) | So khớp URL với một RegExp, mảng RegExp hoặc các chuỗi được biên dịch dưới dạng biểu thức thông thường. Các mẫu chuỗi không hợp lệ sẽ bị bỏ qua. |
| pathStartsWith(url, path) | Đúng cho đường dẫn chính xác hoặc hậu duệ của đường dẫn. Một dấu gạch chéo hàng đầu bị thiếu được cung cấp. |
| queryHas(url, key, value) | Đúng nếu khóa truy vấn tồn tại; khi giá trị được cung cấp, nó cũng phải bằng giá trị chuỗi. |
| queryGet(url, key) | Giá trị truy vấn hoặc null. |
| isSearchPage(url) | Phát hiện các URL tìm kiếm Google, Bing, DuckDuckGo, YouTube, Reddit và X/Twitter được hỗ trợ. |
| isInfiniteFeedUrl(url) | Phát hiện các bề mặt nguồn cấp dữ liệu vô hạn được hỗ trợ. |
| SameSection(a, b) | Chỉ đúng khi cả hai URL chia sẻ một máy chủ và phân đoạn tên đường dẫn đầu tiên. |

Mỗi đối tượng phân loại URL nền tảng hiển thị isPlatformUrl(url), isShortUrl(url), isVideoUrl(url), isPostUrl(url), isHomePage(url), extractAuthor(url) và extractVideoId(url). Một phương thức có thể trả về false/null khi URL hợp lệ nhưng không xác định được loại nội dung đó.

### 6.2 Trợ giúp hẹn giờ

Get it with helpers.getTimerHelper(). Timers are rule-owned counters. They may be displayed in Vault's page overlay, but they never block on their own.

Tạo/nhận tùy chọn:

| Tùy chọn | Ý nghĩa |
| --- | --- |
| id | Bắt buộc phải có id bộ hẹn giờ không trống. |
| tên hiển thị | Nhãn lớp phủ có thể đọc được. |
| hướng | chuyển tiếp để đếm ngược; bất kỳ giá trị nào khác sẽ trở thành lùi/đếm ngược. |
| hiện tạiMs | mili giây ban đầu, nổi ở mức 0 và giới hạn nếu tồn tại giới hạn. |
| minMs, maxMs | Giới hạn dương tối thiểu/tối đa tùy chọn. |
| bướcMs | Bước lượng tử hóa tích cực tùy chọn cho các dấu tích đã trôi qua. |
| lớp phủStyle | Các chuỗi tùy chọn cho màu sắc, nền, kích thước phông chữ, trọng lượng phông chữ, đường viền, đường viền, phần đệm, độ mờ và biểu tượng. Các phần không được hỗ trợ/không hợp lệ sẽ bị loại bỏ. |
| phạm vi (url) | Vị ngữ quyết định nơi tích lũy thời gian hiển thị trên trang. |
| tên miền(url) | Vị ngữ quyết định vị trí bộ đếm thời gian xuất hiện trong lớp phủ; mặc định theo phạm vi. |
| tích lũyKhi(url) | Vị ngữ bổ sung tùy chọn. Thời gian chỉ tích lũy khi cả phạm vi và tích lũyKhi nào đều đúng. |

| Phương pháp | Hành vi |
| --- | --- |
| tạo (tùy chọn) | Tạo/thay thế bộ hẹn giờ và đặt lại trạng thái của nó. Trả về id hoặc null. |
| getOrCreateTimer(tùy chọn) | Chỉ tạo nếu vắng mặt. Trạng thái hiện tại không thay đổi. Trả về id hoặc null. |
| xóa(id) | Xóa bộ đếm thời gian và các vị từ phạm vi/hiển thị của nó. |
| tạm dừng(id), tiếp tục(id) | Thay đổi trạng thái tạm dừng. Chỉ trả về true khi có thể thay đổi trạng thái. |
| setDirection(id, Direction) | Đặt tiến hoặc lùi. |
| setCurrentMs(id, ms) | Đặt số lượng tuyệt đối, thực thi giới hạn. |
| addMs(id, deltaMs), subMs(id, deltaMs) | Điều chỉnh số lượng, thực thi giới hạn. |
| setBounds(id, minMs, maxMs) | Đặt giới hạn tích cực; chuyển null cho giới hạn để loại bỏ nó. |
| setStep(id, stepMs) | Đặt lượng tử hóa tích cực. Truyền null hoặc 0 để xóa nó. |
| setOverlayStyle(id, style) | Thay thế/xóa các kiểu lớp phủ được phép. |
| setDisplayName(id, name) | Đặt nhãn lớp phủ. |
| getCurrentMs(id) | Số, số 0 cho bộ đếm thời gian vắng mặt. |
| isExpired(id) | Chỉ đúng khi tồn tại bộ đếm thời gian và currentMs bằng 0. |
| isPaused(id) | Boolean. |
| getDirection(id), getDisplayName(id) | Hướng/tên hoặc null. |
| tồn tại(id) | Boolean. |
| getState(id) | Ảnh chụp nhanh bộ đếm thời gian có thể tuần tự hóa hoặc không. |
| danh sách() | Mảng ảnh chụp nhanh hẹn giờ có thể tuần tự hóa. |

Các vị từ phạm vi được ghi nhớ trong khi nguồn Tùy chỉnh vẫn được tải. Vault nâng cao bộ hẹn giờ khớp trong các chu kỳ Sự kiện Heartbeat của trang hiển thị, một tích tắc cho mỗi bộ hẹn giờ cho mỗi lần gửi. Bộ đếm thời gian lùi dừng ở mức 0 và phát ra bộ đếm thời gianKết thúc khi chuyển đổi về 0. Nó vẫn bằng 0 cho đến khi quy tắc thay đổi/đặt lại nó. Sử dụng trình xử lý kết thúc bộ hẹn giờ để quyết định xem bộ hẹn giờ đã hết hạn có nên gọi ngăn chặnDefault, đặt chuyển hướng hay thực hiện một hành động khác hay không.

### 6.3 Lưu trữ liên tục và không đồng bộ

Get the synchronous persistence helper with helpers.getPersistenceHelper(). Values must be JSON-serializable. A group can store at most 200 keys and each serialized value is limited to 16 KiB.

| Phương pháp | Hành vi |
| --- | --- |
| get(key, defaultValue) | Đọc giá trị nhân bản hoặc giá trị mặc định. |
| set(khóa, giá trị) | Lưu trữ bản sao an toàn JSON. Trả về sai khi khóa/giá trị không hợp lệ hoặc hết giới hạn khóa. |
| xóa(khóa) | Xóa khóa hiện có; trả về liệu nó có tồn tại hay không. |
| có (khóa) | Boolean. |
| phím() | Mảng phím. |
| mục() | Mảng các cặp [khóa, giá trị] được nhân bản. |
| rõ ràng() | Xóa tất cả các quy tắc tồn tại cho nhóm này. |
| kích thước() | Số lượng phím. |

helpers.getStorageHelper() exposes all the preceding methods and two asynchronous request methods:

| Phương pháp | Hành vi |
| --- | --- |
| requestAsyncGet(key) | Yêu cầu đọc bộ nhớ không đồng bộ. Trả về true khi được xếp hàng. Sử dụng sự kiện sau/luồng trạng thái của riêng bạn để phản hồi; nó không phải là một getter đồng bộ. |
| requestAsyncSet(khóa, giá trị) | Yêu cầu một kho lưu trữ an toàn JSON không đồng bộ. Trả về true khi được xếp hàng. |

Tính bền vững của quy tắc sẽ bị xóa khi Chạy vì nguồn hoạt động mới bắt đầu với trạng thái Quy tắc tùy chỉnh rõ ràng.

### 6.4 Trợ giúp ghi nhật ký

Get it with helpers.getLogHelper(). Every method accepts any number of values.

| Phương pháp | Điểm đến |
| --- | --- |
| đăng nhập, cảnh báo, lỗi | Nhật ký hoạt động bật lên; báo cáo trang khi bật báo cáo nhật ký trang chung. |
| logScreen, cảnh báoScreen, errorScreen | Chỉ bề mặt báo cáo/gỡ lỗi trang; bị loại khỏi nhật ký bật lên. |
| logPopup, WarnPopup, errorPopup | Chỉ nhật ký hoạt động bật lên; bị loại trừ khỏi trang bánh mì nướng. |

Nhật ký cũng cố gắng truy cập bảng điều khiển trình duyệt bằng tiền tố nhóm CustomBlocker. Đây là kết quả chẩn đoán, không phải API lưu trữ lâu dài. Sử dụng trình trợ giúp kiên trì cho trạng thái.

### 6.5 Trợ giúp chuyển hướng

Get it with helpers.getRedirectionHelper().

| Phương pháp | Hành vi |
| --- | --- |
| get(), getRedirectLink() | Trả về URL chuyển hướng công văn hiện tại hoặc một chuỗi trống. |
| set(url), setRedirectLink(url) | Đặt URL chuyển hướng cho công văn hiện tại. |
| createMessageUrl(tin nhắn) | Tạo URL trang thông báo cục bộ mở rộng hiển thị thông báo được cung cấp. |

Chỉ thiết lập chuyển hướng không bắt buộc phải điều hướng. Ghép nối nó với event.preventDefault() hoặc đặt một chuỗi không trống thông qua event.setResult(), theo luồng quy tắc mong muốn.

### Trình trợ giúp DOM 6.6

Get it with helpers.getDOMHelper(). These actions are queued and applied to the current page. Selectors must be valid for the page browser; malformed selectors or elements that do not exist can produce no visible result.

| Phương pháp | Hành động được yêu cầu |
| --- | --- |
| ẩn(bộ chọn), hiển thị(bộ chọn) | Ẩn/hiện các phần tử phù hợp. |
| addClass(selector, className), RemoveClass(selector, className) | Thay đổi lớp CSS. |
| setText(bộ chọn, văn bản) | Thay thế nội dung văn bản. |
| nhấp chuột(bộ chọn) | Nhấp vào phần tử phù hợp. |
| tiêmCss(css, id) | Thêm một khối CSS được xác định. |
| RemoveInjectedCss(id) | Xóa khối CSS được chèn đã được xác định trước đó. |
| cuộnTo(bộ chọn) | Cuộn phần tử phù hợp vào chế độ xem. |

Các hành động DOM không cung cấp tập lệnh trang không bị hạn chế. Chúng là một bề mặt hành động bị giới hạn và sẽ không có tác dụng khi được sử dụng từ trình xử lý nhịp tim/tích tắc.

### 6.7 Trình trợ giúp điều hướng, tab và cửa sổ trình duyệt

Get navigation with helpers.getNavigationHelper().

| Phương pháp | Hành động được yêu cầu |
| --- | --- |
| quay lại() | Điều hướng trở lại tab hiện tại. |
| chuyển tiếp() | Điều hướng tab hiện tại về phía trước. |
| tải lại() | Tải lại tab hiện tại. |
| goTo(url) | Điều hướng tab hiện tại tới URL. |
| closeTab() | Đóng tab hiện tại. |

Get a snapshot helper with helpers.getTabHelper().

| Phương pháp | Trở lại/hành động |
| --- | --- |
| danh sách() | Bản sao của ảnh chụp nhanh tab hiện tại. |
| getActiveTab() | Ảnh chụp nhanh tab đang hoạt động hoặc không. |
| getById(id) | Ảnh chụp nhanh tab phù hợp hoặc không. |
| đếmOpen() | Số lượng tab trong ảnh chụp nhanh. |
| requestRefresh() | Yêu cầu ảnh chụp nhanh tab mới cho công việc quy tắc sau này. |

Get the browser-tab/window helper with helpers.getWindowHelper(). In the extension, a "window" is represented by browser tabs.

| Phương pháp | Hành vi |
| --- | --- |
| hiện tại() | Đối tượng tab đang hoạt động hiện tại: id, url, tên máy chủ, tiêu đề, isBrowser. |
| tất cả() | Mảng các đối tượng tab có id, url, tên máy chủ, tiêu đề, hoạt động. |
| đóng(idOrUrl) | Đóng theo id tab số, chuỗi URL chính xác hoặc tab hoạt động khi bị bỏ qua. |
| closeTab() | Đóng tab đang hoạt động. |
| khối(mẫu) | Thêm khối miền chỉ phiên bình thường hóa và áp dụng nó. |
| bỏ chặn(mẫu) | Xóa khối miền chỉ phiên bình thường hóa. |
| isBlocked(urlOrHostname) | Truy vấn danh sách chặn phiên do quy tắc tạo. |
| getBlocked() | Liệt kê các mẫu do phiên tạo hiện tại. |

Các mẫu khối được tạo theo quy tắc chuẩn hóa http/https, dẫn đầu www. và các đường dẫn vào mẫu máy chủ. Chúng khớp chính xác với máy chủ và tên miền phụ. Danh sách chặn động này là bộ nhớ phiên, không phải là nhóm Trang thông thường đã lưu.

### 6.8 Trình trợ giúp thư mục tệp cục bộ

Get it with helpers.getLocalFolderHelper(). It only operates after the user has selected a folder in Global Settings and granted browser permission. It is asynchronous: every request returns a request id; completion arrives as localFileEvent.

| Phương pháp | Hành vi |
| --- | --- |
| isAvailable() | Báo cáo rằng bề mặt API tồn tại; nó không chứng minh được thư mục hiện đã được ủy quyền. |
| requestRead(path) | Yêu cầu đọc văn bản. |
| requestWrite(đường dẫn, văn bản) | Yêu cầu viết văn bản. |
| requestAppend(path, text) | Yêu cầu thêm văn bản. |
| requestList(path = "") | Yêu cầu danh sách thư mục. |
| requestExists(path) | Yêu cầu kiểm tra sự tồn tại. |
| requestReadJson(path) | Yêu cầu đọc JSON; đường dẫn phải kết thúc bằng .json. |
| requestWriteJson(path, value) | Yêu cầu viết JSON; đường dẫn phải kết thúc bằng .json và giá trị phải an toàn JSON. |

Đường dẫn luôn liên quan đến gốc đã chọn. Chúng không thể tuyệt đối, đủ điều kiện cho ổ đĩa, tiền tố dấu chấm hoặc chứa . hoặc .. phân đoạn. Chỉ các tệp .txt, .csv và .json mới được chấp nhận cho các thao tác với tệp. Lựa chọn thư mục có thể bị thu hồi bất cứ lúc nào; một yêu cầu không thành công báo cáo ok sai và một chuỗi lỗi trong localFileEvent.

### Trình trợ giúp nền tảng 6.9

Get the collection with helpers.getPlatformHelper() or helpers.platform(). Get one raw platform API with helpers.platform("youtube"), for example.

Tất cả các API nền tảng thô đều hiển thị:

| Phương pháp | Hành vi |
| --- | --- |
| ẩn(vị ngữ, tùy chọn) | Đặt cùng một thuộc tính cho mỗi mục cho mọi vị trí thẻ nguồn cấp dữ liệu trên nền tảng đó. |
| ẩn (khe, vị ngữ, tùy chọn) | Đặt một vị từ cho mỗi mục. Vị từ nhận mục nền tảng/ảnh chụp nhanh do nền tảng đó cung cấp. |
| allow(vị ngữ, tùy chọn), allow(khe, vị ngữ, tùy chọn) | Tương tự như ẩn nhưng tạo ra phán quyết cho phép/ngoại lệ. |
| show(), show(khe) | Xóa tất cả hoặc một vị trí vị trí được cài đặt. |
| bề mặt (tên, "ẩn" hoặc "hiển thị") | Ẩn/hiển thị toàn bộ khu vực nền tảng. home là tên công khai của homePage. |
| hẹn giờ (khe, tùy chọn) | Định cấu hình bộ đếm thời gian cho phần phụ của nền tảng. Trả về options.id khi được cung cấp, nếu không thì trả về null. |
| quét lại() | Đánh giá lại thẻ nguồn cấp dữ liệu đã được quét sau khi thay đổi trạng thái quy tắc bên ngoài. |
| ảnh chụp nhanh() | Trả về ảnh chụp nhanh nền tảng hiện tại hoặc null. |
| khe(), bề mặt(), bộ đếm thời gianSlots() | Trả lại tên được hỗ trợ cho nền tảng này. |
| isPlatformUrl, isShortUrl, isVideoUrl, isPostUrl, isHomePage, extractAuthor, extractVideoId | Trình trợ giúp URL cho nền tảng đó. |

Một vị trí sở hữu một vị từ cho một nhóm/nền tảng. Lệnh gọi ẩn/cho phép sau này cho cùng một vị trí sẽ thay thế vị từ trước đó; nó không phải là một OR ẩn. Đối tượng tùy chọn tùy chọn nhận ra:

| Tùy chọn | Hiệu ứng |
| --- | --- |
| blockPageOnVisit | Khi truy cập một thẻ/trang phù hợp, hãy yêu cầu chặn trang thay vì chỉ ẩn thẻ. |
| hiệu ứng | chặn (mặc định) hoặc cho phép. Bộ trợ giúp cho phép tự động cho phép. |

Quét lại cuộc gọi bất cứ khi nào một vị từ phụ thuộc vào trạng thái đã thay đổi sau khi thẻ được đánh giá lần đầu tiên, chẳng hạn như hộp kiểm bảng, hạn ngạch hoặc ngưỡng thời gian.

Ma trận hỗ trợ nền tảng thô:

| Nền tảng | Khe vị ngữ | Tên bề mặt | Khe hẹn giờ |
| --- | --- | --- | --- |
| YouTube | quần short, video, bài đăng, bình luận, trực tiếp | trang chủ, shortButton, bình luận, trực tiếp | quần short, video, bài viết |
| TikTok | video, bình luận, trực tiếp | nhà, bình luận, trực tiếp | video |
| Instagram | quần short, bài viết, bình luận | nhà, bình luận | quần short, bài viết |
| Facebook | quần short, video, bài đăng, bình luận, trực tiếp | nhà, bình luận, trực tiếp | quần short, video, bài viết |
| Co giật | quần short, luồng, video, trực tiếp | nhà, bình luận, trực tiếp | quần short, luồng, video |

Trình trợ giúp nền tảng Tùy chỉnh thô không hiển thị Reddit, Discord hoặc Twitter/X. Sử dụng các khả năng URL, DOM, bộ hẹn giờ, bảng điều khiển và điều hướng chung cho công việc tùy chỉnh trên các trang web đó.

## 7. Bảng tùy chỉnh

The panel helper creates safe, declarative on-page panels. Get it with helpers.getPanelHelper(). A panel can be scoped to URLs, react to interactions, display timer state, and retain its user-entered values for the active rule lifetime.

### API bảng điều khiển 7.1

| Phương pháp | Hành vi |
| --- | --- |
| tạo (cấu hình) | Tạo hoặc thay thế một bảng điều khiển. Trả về id bảng điều khiển đã chuẩn hóa hoặc null. |
| getOrCreatePanel(config) | Chỉ tạo khi vắng mặt; trả về id hoặc null. |
| cập nhật(id, bản vá) | Thay thế các trường bảng được chỉ định sau khi xác thực. |
| xóa(id) | Xóa bảng điều khiển và trình xử lý nội tuyến đã đăng ký của nó. |
| hiển thị(id), ẩn(id) | Thay đổi khả năng hiển thị. |
| setValue(panelId, controlId, value) | Đặt giá trị điều khiển có thể ghi sau khi xác thực. |
| updateControl(panelId, controlId, patch) | Thay thế các trường được phép của điều khiển. |
| vô hiệu hóa(panelId, controlId), kích hoạt(panelId, controlId) | Chuyển đổi kiểm soát tính khả dụng. |
| setOptions(panelId, controlId, tùy chọn) | Thay thế các lựa chọn chọn/radio. |
| setText(panelId, controlId, văn bản) | Cập nhật nhãn nút, văn bản/phần văn bản hoặc nhãn điều khiển khác. |
| setTheme(panelId, theme) | Thay thế chủ đề bảng điều khiển. |
| setTitle(panelId, title), setDescription(panelId, description) | Cập nhật văn bản. |
| getValue(panelId, controlId) | Trả về một giá trị nhân bản hoặc không xác định. |
| getValues(panelId) | Trả về tất cả các giá trị có thể ghi được khóa theo id điều khiển. |
| getState(id) | Trả về ảnh chụp nhanh bảng tuần tự hóa hoặc null. |
| danh sách() | Trả về ảnh chụp nhanh có thể tuần tự hóa của tất cả các bảng. |
| thông báo(cấu hình) | Tạo bảng trạng thái nhỏ gọn ở góc dưới bên phải với tin nhắn/văn bản tùy chọn. |
| xác nhận(cấu hình) | Tạo hộp thoại ở giữa với các nút xác nhận và hủy được tạo. |
| danh sách kiểm tra (config) | Tạo một bảng gồm các mục hộp kiểm. |
| biểu mẫu (cấu hình) | Tạo bảng bố cục biểu mẫu từ các trường. |

### 7.2 Cấu hình bảng điều khiển

| Lĩnh vực | Giá trị/hành vi được chấp nhận |
| --- | --- |
| id | Yêu cầu. Chuẩn hóa thành chữ cái, chữ số, dấu gạch dưới, dấu gạch nối; tối đa 80 ký tự. |
| tiêu đề | Tiêu đề bảng điều khiển, tối đa 240 ký tự. |
| mô tả hoặc nội dung | Mô tả, tối đa 1.000 ký tự. |
| vị trí | trên cùng bên trái, trên cùng bên phải, dưới cùng bên trái, dưới cùng bên phải hoặc ở giữa. Mặc định ở dưới cùng bên phải. |
| căn chỉnh | trái, giữa hoặc phải. Mặc định bên trái. |
| bố cục | dọc, nhỏ gọn, thoải mái, rộng rãi, nội tuyến, hàng, ngắt dòng, hai cột, lưới, phân chia, biểu mẫu, thanh công cụ hoặc ngăn xếp. Dọc mặc định. |
| ưu tiên | Thứ tự hiển thị bằng số, được kẹp từ -1000 đến 1000. Bảng cao hơn hiển thị trước. |
| chiều rộng | nhỏ, vừa, lớn hoặc 180 đến 520 px. |
| textSize/fontSize | 10 đến 32 px hoặc 0,65 đến 2 rem/em. |
| ariaLabel/a11yLabel | Nhãn có thể truy cập được. |
| vai trò | vùng, hộp thoại, cảnh báo, trạng thái, biểu mẫu hoặc nhóm. |
| tự động lấy nét | Boolean. |
| chủ đề/màu sắc | nền, tiền cảnh, dấu, đường viền, tắt tiếng, kích thước phông chữ/kích thước văn bản, kích thước tiêu đề. |
| điều khiển | Mảng có tới 32 điều khiển, với phần lồng tối đa ba cấp độ. |
| có thể nhìn thấy | Sai ẩn bảng điều khiển. |
| phạm vi(url), tên miền(url) | Chức năng kiểm soát tính khả dụng/hiển thị. tên miền được ưu tiên; không có miền, điều khiển phạm vi sẽ hiển thị. |

Các trường xử lý nội tuyến của bảng điều khiển có thể xuất hiện trên bảng điều khiển hoặc điều khiển riêng lẻ: onEvent, onChange, onClick, onInput, onFocus, onBlur, onSubmit, onClose, onMount, onUnmount, onKey và onKeyDown. Mỗi cái đều nhận được các tham số (sự kiện, trợ giúp) bình thường. Trình xử lý nội tuyến được thay thế khi bảng đó được tạo lại/cập nhật với các định nghĩa điều khiển.

### 7.3 Điều khiển

Các loại điều khiển có sẵn là văn bản, hộp kiểm, chọn, textInput, vùng văn bản, nút, phần, bộ đếm thời gian, numberInput, phạm vi, chuyển đổi, radio, ngày, giờ, màu sắc, mã pin và html. Đầu vào bí danh, thả xuống, nhóm, số, thanh trượt, chuyển đổi, thô và đánh dấu chuẩn hóa thành loại tương ứng của chúng.

Tất cả các điều khiển đều chấp nhận id, loại, nhãn, giá trị, bị vô hiệu hóa, mức độ ưu tiên và khi bố cục có liên quan, căn chỉnh, ariaLabel/a11yLabel, tự động lấy nét, chiều rộng, chiều cao và hàng.

| Loại | Các trường quan trọng và giá trị hợp đồng |
| --- | --- |
| văn bản | văn bản (hoặc nhãn) được hiển thị dưới dạng văn bản không nhập vào. |
| hộp kiểm, chuyển đổi | Giá trị Boolean. |
| chọn lọc, đài phát thanh | các tùy chọn dưới dạng chuỗi hoặc đối tượng { value, label }; tối đa 64. Giá trị là một chuỗi ngắn. |
| textInput, vùng văn bản | Giá trị chuỗi, tối đa 2.000 ký tự; phần giữ chỗ tùy chọn. |
| nút | nhãn/văn bản; hành động tùy chọn gửi, hủy hoặc đóng. |
| phần | văn bản/mô tả, vai trò và các điều khiển lồng nhau. |
| hẹn giờ | timeId hoặc ảnh chụp nhanh hẹn giờ; định dạng ms, ss, mm:ss hoặc hh:mm:ss; showExpired mặc định đúng. |
| sốĐầu vào, phạm vi | Giá trị số được kẹp ở mức tối thiểu/tối đa được cung cấp; bước tích cực tùy chọn. |
| ngày | Chỉ giá trị YYYY-MM-DD. |
| thời gian | Chỉ có giá trị HH:MM hoặc HH:MM:SS. |
| màu sắc | Giá trị đầu vào #RRGGBB gồm sáu chữ số. |
| ghim | Chỉ các chữ số, độ dài từ 3 đến 12, được che theo mặc định, tự động gửi tùy chọn. |
| html | Đánh dấu vệ sinh. Khối tập lệnh, thuộc tính sự kiện nội tuyến và javascript: URL sẽ bị xóa. |

Mỗi tương tác được kết xuất sẽ tạo ra panelEvent. Đối tượng giá trị của sự kiện chứa các điều khiển có thể ghi của bảng điều khiển, ngoại trừ các nút, văn bản và điều khiển hẹn giờ. Một hành động đóng sẽ ẩn bảng điều khiển trước khi người xử lý quan sát sự kiện.

## 8. Công thức hành động theo quy tắc tùy chỉnh

Các ví dụ sau đây là thông số kỹ thuật về thành phần công khai, không phải là hướng dẫn.

### 8.1 Chuyển hướng trang mở đầu

```js
(events, helpers) => {
  events.on("openWebEvent", "redirect-distracting-search", (event, h) => {
    const domain = h.getDomainHelper();
    if (!domain.isSearchPage(event.url)) return;
    event.setRedirectLink(h.getRedirectionHelper().createMessageUrl("Return to your planned task."));
    event.preventDefault();
  });
}
```

### 8.2 Đếm ngược thời gian hiển thị với khối rõ ràng

```js
(events, helpers) => {
  const timer = helpers.getTimerHelper();
  timer.create({
    id: "reading-budget",
    displayName: "Reading budget",
    direction: "backward",
    currentMs: 10 * 60 * 1000,
    scope: (url) => url.includes("example.com")
  });

  events.on("timerEnded", "stop-at-zero", (event) => {
    if (event.data?.timerId !== "reading-budget") return;
    event.setRedirectLink("about:blank");
    event.preventDefault();
  });
}
```

### 8.3 Thay đổi vị từ nguồn cấp dữ liệu từ bảng điều khiển

```js
(events, helpers) => {
  const panel = helpers.getPanelHelper();
  const youtube = helpers.platform("youtube");

  panel.create({
    id: "feed-filter",
    title: "Feed filter",
    controls: [{
      id: "hide-sponsored",
      type: "toggle",
      label: "Hide sponsored items",
      value: true,
      onChange: (event, h) => {
        const api = h.platform("youtube");
        if (event.value) {
          api.hide("videos", (item) => item?.sponsored === true);
        } else {
          api.show("videos");
        }
        api.rescan();
      }
    }]
  });

  youtube.hide("shorts", () => true);
}
```

Các biến vị ngữ phải được viết cho các giá trị mục/ảnh chụp nhanh của nền tảng được cung cấp bởi bề mặt nền tảng đang hoạt động. Nếu một nền tảng không thể xác định một trường một cách đáng tin cậy thì vị từ sẽ không mở được thay vì giả sử một giá trị là đúng.

## 9. Giao thức yêu cầu thư mục cục bộ

Các hoạt động của Thư mục cục bộ không phải là I/O tệp ngay lập tức. Trình tự chức năng hoàn chỉnh là:

1. Người dùng chọn một thư mục trong Cài đặt chung.
2. Quy tắc xếp hàng yêu cầu và nhận id yêu cầu.
3. Vault yêu cầu khả năng của thư mục được ủy quyền để thực hiện thao tác.
4. Vault gửi localFileEvent đến cùng một nhóm Tùy chỉnh.
5. Trình xử lý tương quan event.requestId với id yêu cầu ban đầu.

Quá trình đọc thành công hoàn tất với văn bản cho tệp văn bản hoặc giá trị cho JSON. Danh sách trả về các mục. Tồn tại trả về tồn tại. Viết/chắp thêm cung cấp byte nếu có. Thất bại cung cấp ok sai và lỗi. Các quy tắc không bao giờ được cho rằng thư mục đã chọn vẫn được ủy quyền sau khi tải lại, khởi động lại trình duyệt hoặc thu hồi quyền.

## 10. Ngữ nghĩa về lỗi và an toàn của quy tắc tùy chỉnh

### 10.1 Biên dịch và chạy lỗi

Kiểm tra lỗi biên dịch báo cáo cú pháp. Run cũng có thể báo lỗi thời gian chạy trong quá trình đăng ký. Nếu một nguồn giống hàm có lỗi cú pháp, Vault sẽ không âm thầm xử lý nguồn đó như những câu lệnh đơn thuần vô hại.

Một nguồn trống không có trình xử lý nào. Quy tắc này hợp lệ dưới dạng quy tắc Tùy chỉnh không hoạt động nhưng không thực hiện hành động Tùy chỉnh nào được định cấu hình.

### 10.2 Lỗi xử lý

Một ngoại lệ từ một trình xử lý được tách biệt khỏi quá trình gửi sự kiện tổng thể. Đó là đầu ra chẩn đoán; nó không làm cho những người xử lý sau này thành công một cách kỳ diệu. Sử dụng trình xử lý hẹp và ghi lại các lỗi có thể xử lý được.

### 10.3 Cách ly

Vault có thể cách ly một nhóm Tùy chỉnh sau nhiều lần vượt quá thời hạn hoặc vượt quá thời hạn trong quá trình đăng ký. Việc cách ly sẽ vô hiệu hóa nhóm và ghi lại lý do hủy bỏ. Sửa nguồn, lưu và chạy lại một cách rõ ràng để khôi phục đăng ký hoạt động.

### 10.4 Giới hạn trình duyệt/trang

Không có quy tắc tùy chỉnh nào nhận được API tiện ích mở rộng không hạn chế. Đặc biệt:

- bộ chọn DOM không thể tìm thấy gì trên nền tảng đã thay đổi;
- các thao tác điều hướng, đóng tab và trên màn hình vẫn tùy thuộc vào khả năng của trình duyệt;
- tiện ích mở rộng không thể mở ứng dụng gốc;
- hoạt động thư mục cục bộ yêu cầu thư mục do người dùng cấp và các loại tệp được hỗ trợ;
- trình xử lý sự kiện không thể dựa vào một trang vô hình tiếp tục tạo ra nhịp tim theo thời gian hiển thị;
- một trang có thể tải lại, điều hướng, loại bỏ hoặc vô hiệu hóa tập lệnh nội dung một cách độc lập với quy tắc;
- khối trang web động được tạo theo quy tắc là các hành động ở trạng thái phiên, không phải là các chỉnh sửa Nhóm trang web vĩnh viễn.

## 11. Cầu nối ứng dụng web

Cây cầu là tùy chọn. Nó kết nối ứng dụng khách mở rộng trình duyệt với trung tâm Vault cục bộ tương thích. Phần mở rộng của trình duyệt là một ứng dụng khách; một ứng dụng Vault gốc cung cấp trung tâm. Điểm cuối cục bộ cố định là ws://127.0.0.1:8787 và cần có khả năng tương thích giao thức.

Các trạng thái kết nối là Tắt, Đang kết nối, Đã ngắt kết nối, Đã kết nối và Lỗi. Khi ứng dụng khách được bật, đầu tiên Vault sẽ thăm dò nhanh chóng, sau đó tiếp tục các nỗ lực kết nối lại chậm hơn cho đến khi kết nối hoặc người dùng tắt nó. Kết nối không tự nó hợp nhất tất cả các nhóm.

### 11.1 Liên kết các nhóm

Các nhóm chỉ có thể liên kết được khi tên và loại của chúng khớp nhau và chúng đủ điều kiện để liên kết. Người dùng lựa chọn/liên kết rõ ràng các chương trình tham gia. Một nhóm liên kết tạo thành một cụm. Việc ngắt kết nối vẫn giữ nguyên dữ liệu nhóm cục bộ; nó ngừng đồng bộ hóa trực tiếp.

Cầu nối này đồng bộ hóa chính sách vô hướng được chia sẻ cho các nhóm liên kết được hỗ trợ, bao gồm chế độ chặn thông thường, giá trị cho phép/đặt lại, cài đặt báo lại, ngày/thời gian hoạt động, trạng thái/lựa chọn/thời lượng đóng băng, chính sách trang chủ, cài đặt danh sách cho phép, URL dự phòng và chính sách chuyển sang phần tiếp theo. Nó cũng điều phối việc sử dụng và trạng thái báo lại cho các thành viên cụm.

Bridge không hứa hẹn rằng mọi trường dành riêng cho sản phẩm, bộ chọn nền tảng, văn bản nguồn tùy chỉnh hoặc khả năng dành riêng cho trình duyệt đều có thể chuyển sang một chương trình khác. Một nhóm có thể duy trì ở trạng thái cục bộ và không được liên kết ngay cả khi bridge được kết nối.

Các cụm cầu cố định yêu cầu tất cả các thành viên có liên quan phải trực tuyến để thực hiện các hành động ở trạng thái đóng băng cần đột biến phối hợp. Kết nối là phương tiện truyền tải cục bộ, không phải là kênh sao lưu đám mây hoặc điều khiển từ xa.

## 12. Danh sách kiểm tra xác minh dành cho người bảo trì

Sử dụng danh sách kiểm tra này khi kiểm tra hành vi phát hành hoặc tái tạo:

1. Xác nhận nhóm có tên duy nhất không trống, loại chính xác, trạng thái bật và danh sách/thứ tự dự định.
2. Đối với các nhóm bình thường, hãy xác nhận ngày trong tuần đang hoạt động, cửa sổ giờ địa phương hợp lệ, không báo lại hoạt động và trạng thái chỉnh sửa không bị đóng băng.
3. Đối với Nhóm trang web, hãy kiểm tra chính xác máy chủ, tên miền phụ và (đối với danh sách cho phép) máy chủ bên ngoài danh sách.
4. Đối với một nhóm nền tảng, hãy kiểm tra riêng khả năng so khớp cấp trang, so khớp mục/thẻ được nhắm mục tiêu, chế độ tác giả, chế độ biểu mẫu nội dung và từng ẩn bề mặt được kích hoạt.
5. Đối với các nhóm bình thường được tính thời gian, hãy xác minh tích lũy trang hiển thị, hết hạn cho phép hoặc hành vi không chặn đếm ngược và khoảng thời gian đặt lại.
6. Đối với Quy tắc tùy chỉnh, hãy chạy kiểm tra cú pháp, Chạy, kiểm tra số lượng/nhật ký trình xử lý, kiểm tra mọi sự kiện tích hợp đã đăng ký, sau đó kiểm tra tải lại/điều hướng.
7. Kiểm tra từng bộ đếm thời gian Tùy chỉnh ở ranh giới phạm vi và ở mức 0; xác minh rằng bất kỳ khối nào là rõ ràng trong quy tắc.
8. Kiểm tra các bảng với từng giá trị điều khiển, trạng thái vô hiệu hóa, hành động gửi/hủy/đóng và trình xử lý panelEvent.
9. Kiểm tra lỗi thư mục cục bộ trước khi thành công: không có thư mục nào được chọn, quyền bị thu hồi, đường dẫn không hợp lệ, tiện ích mở rộng không được hỗ trợ, sau đó được phép đọc/ghi.
10. Kiểm tra việc tắt kết nối cầu nối, bật kết nối, nhóm được liên kết/không liên kết và thành viên cụm ngoại tuyến trước khi dựa vào sự phối hợp đồng bộ hóa hoặc đóng băng.

## 13. Quy tắc lập phiên bản

Tập tin tiếng Anh này là hướng dẫn sử dụng nguồn được duy trì. Hướng dẫn sử dụng được bản địa hóa là bản dịch của nó và có thể yêu cầu tạo lại sau khi cập nhật tài liệu chức năng. Nguồn sản phẩm vẫn là sự thật chính tắc đối với sự mơ hồ ở cấp độ triển khai.
