# Hướng dẫn sử dụng — Delivery Risk Agent

Tài liệu dành cho **nhân viên vận hành** (dispatcher, trưởng ca, quản lý).  
Không phải tài liệu kỹ thuật.

Giao diện hiện tại dùng **tiếng Anh**. Trong hướng dẫn này, chữ in đậm là tên nút / mục trên màn hình.

---

## 1. Ứng dụng này dùng để làm gì?

**Delivery Risk Agent** giúp bạn:

1. Thấy **đơn nào đang có nguy cơ giao trễ** và nên xử lý trước.
2. **Xem chứng cứ** (kho, vận chuyển, cam kết giao hàng) trước khi quyết định.
3. **Ghi lại quyết định** của bạn (đồng ý / chỉnh / bỏ qua cảnh báo).
4. Soạn **nháp tin nhắn khách** để copy sang kênh liên lạc hiện có.
5. Tra lại **lịch sử** đã xử lý thế nào và đơn kết thúc ra sao.

Ứng dụng **không thay** ERP, WMS hay TMS.  
Sau khi ghi quyết định trong app, bạn vẫn phải **làm việc thật** (đổi lịch, ưu tiên pick, liên hệ carrier…) trên hệ thống nguồn, rồi mới xác nhận lại trong app nếu cần.

---

## 2. Ai dùng phần nào?

| Vai trò | Thường dùng |
|---|---|
| **Dispatcher** | Danh sách đơn cần chú ý → Chi tiết đơn → Ghi quyết định → Nháp tin khách |
| **Trưởng ca / lead** | Như trên + **Data health** (ảnh hưởng dữ liệu tới quyết định) + theo dõi History |
| **Quản lý** | **Performance** (hiệu quả vận hành / pilot) — báo cáo chi tiết vẫn ưu tiên Power BI |
| **IT / vận hành dữ liệu** | **Data health** đầy đủ (bảng nguồn dữ liệu) |

Phạm vi demo hiện tại: **Sweden · Stockholm (WH1)** — cố định trên thanh trên cùng.

---

## 3. Dữ liệu lấy từ đâu?

Trên màn hình luôn có nhãn **Demo · session copy**. Nghĩa là:

- Bạn đang làm việc trên **bản sao dữ liệu phiên demo**, không phải kết nối trực tiếp ERP/TMS thật lúc này.
- Các nguồn được **gắn nhãn như trong vận hành thật** để bạn hiểu ngữ cảnh:

| Nguồn trên UI | Bạn hiểu là gì |
|---|---|
| **ERP / order** | Đơn hàng, cửa sổ cam kết giao (promised window), dòng hàng |
| **WMS / warehouse** | Tiến độ kho: sẵn sàng → pick → pack → lên xe |
| **TMS / carrier** | Vận chuyển, ETA, trạng thái shipment |
| **Risk scoring** | Điểm rủi ro / mức High–Medium–Low và lý do chính |
| **AI assist** | Đề xuất hành động hỗ trợ — chỉ gợi ý, không tự thực thi |

**Refresh** chỉ tải lại thông tin trên màn hình phiên demo.  
**Không** đồng nghĩa đã đồng bộ lại ERP / WMS / TMS.

Khi vào production, cùng cách dùng này sẽ đọc dữ liệu từ các hệ thống nguồn thật; nguyên tắc vẫn giữ: **app hỗ trợ quyết định, không thay hệ thống vận hành**.

---

## 4. Luồng làm việc hàng ngày (khuyến nghị)

```
Danh sách đơn cần chú ý
        ↓
Mở đơn → đọc lý do rủi ro + chứng cứ
        ↓
(Nếu tin được dữ liệu) Ghi quyết định
        ↓
Thực hiện trên ERP / WMS / TMS
        ↓
Quay lại app → xác nhận đã làm (nếu có)
        ↓
(Tuỳ chọn) Copy nháp tin khách
```

Nếu **dữ liệu cũ / thiếu** hoặc **AI không sẵn sàng**: vẫn xem chứng cứ và quyết định thủ công — đừng bỏ qua đơn chỉ vì AI tắt.

---

## 5. Các màn hình chính

### 5.1 Orders needing attention (dashboard)

Mở từ trang chủ (**Open dashboard**) hoặc menu **Orders needing attention** (`/dashboard`).

**Làm được gì**

- Xem đơn cần chú ý trong phạm vi kho, **ưu tiên cao trước**.
- Lọc theo rủi ro, loại khách (B2B/B2C), giai đoạn kho, đã nhận cảnh báo hay chưa.
- Tìm theo **Search order ID** (ô trên cùng).
- **Acknowledge**: đánh dấu đã xem cảnh báo (có thể hoàn tác).
- **Review case**: mở chi tiết đơn.

**Các chip / cờ hay gặp**

| Nhãn | Ý nghĩa thực tế |
|---|---|
| **Unacked** | Cảnh báo chưa được nhận xem |
| **Stale** | Điểm rủi ro / dữ liệu đã quá cũ (demo: khoảng 90 phút) — nên kiểm tra lại trước khi hành động |
| **AI n/a** | Không có đề xuất AI; vẫn mở case và quyết định thủ công được |
| **Risk increased** | Cùng một đợt cảnh báo, mức rủi ro đã tăng — không phải đơn trùng |
| **Cannot assess** | Thiếu cửa sổ cam kết giao → **không** coi như “rủi ro thấp an toàn” |

**Không có** chức năng duyệt hàng loạt (bulk approve).

---

### 5.2 Chi tiết đơn (Case)

Mở từ **Review case**. Đây là màn hình quan trọng nhất.

**Bạn sẽ thấy**

1. **Header** — mã đơn, mức rủi ro, thời gian còn lại tới hạn giao, giai đoạn kho; liên kết **ERP (demo)** / **TMS (demo)** (mô phỏng).
2. **Why this order is at risk** — tối đa vài lý do chính, kèm nguồn và thời điểm cập nhật.
3. **Order lines** — từng dòng hàng, tồn theo dòng (không gộp “cả đơn còn hàng” nếu một dòng thiếu).
4. **Warehouse progress** — Ready → Pick → Pack → Loaded.  
   **No event received / Missing feed** = chưa nhận được sự kiện từ hệ thống — **không** khẳng định kho chưa làm.
5. **Transport** — trạng thái vận chuyển, ETA hiện tại so với hạn cam kết.
6. **AI recommendation** — đề xuất (nếu có) kèm trạng thái:
   - **Ready** — có đề xuất để xem xét  
   - **Unavailable / Incomplete** — thiếu hoặc AI không sẵn; vẫn quyết định thủ công  
   - **Checking** — đang chờ
7. **Customer message draft** — nháp tin khách (xem mục 5.4).
8. **Risk history** — các mốc thay đổi rủi ro trong đợt này.

**Nút Decide action**

- Mở form ghi quyết định.
- Nếu đơn đã **delivered** / **cancelled**: không mời quyết định trên đề xuất cũ.

**Cảnh báo trên case** (khi có)

- Thiếu promised window  
- ETA / điểm rủi ro quá cũ  
→ Nên xác minh trên ERP/TMS trước khi hành động.

---

### 5.3 Ghi quyết định (Record decision)

Banner luôn nhắc: **No changes will be made to ERP or TMS**.

| Loại quyết định | Khi nào dùng |
|---|---|
| **Approve** | Đồng ý với hành động đề xuất (trong danh sách cho phép) |
| **Edit** | Chọn hành động khác trong danh sách + **bắt buộc ghi lý do** |
| **Dismiss** | Bỏ qua cảnh báo + **bắt buộc lý do** (dữ liệu sai/cũ, đã xử lý nơi khác, không khả thi…) |

**Sau khi Save**

- App **chỉ lưu** quyết định của bạn.
- Toast nhắc: hãy hoàn tất trên hệ thống nguồn, rồi xác nhận lại.
- Trên case có thể:
  - **Confirm action performed** — bạn xác nhận đã làm xong bên ngoài  
  - **Unable to perform** — không thực hiện được  
  - **Withdraw decision** — rút quyết định đã ghi  

Nhãn xác nhận là **User-confirmed** (do người xác nhận), không phải hệ thống tự kiểm chứng.

**Dismiss không có nghĩa** “đơn sẽ không trễ”.

---

### 5.4 Customer message draft (nháp tin khách)

**Làm được gì**

- Chọn ngôn ngữ (Swedish / Norwegian / Danish).
- Sửa nội dung nháp.
- Xem **Facts used** — fact nào **Unverified** cần đọc kỹ trước khi gửi khách.
- **Copy draft** → dán sang email / SMS / kênh hiện có của công ty.

**Không làm được**

- **Send** chưa kết nối — app **không gửi** tin cho khách.
- Không dùng xác suất nội bộ hay “đã đổi xe” chỉ vì vừa Approve trong app.

---

### 5.5 History

**Làm được gì**

- Xem lại từng đợt cảnh báo (episode): lúc cảnh báo hệ thống biết gì, đề xuất gì, nhân viên quyết định gì, kết quả giao hàng.
- Lọc theo kết quả giao, loại quyết định, hành động đề xuất, khoảng thời gian…
- Mở chi tiết: snapshot **lúc cảnh báo** (không chỉ trạng thái mới nhất) + timeline.

**Kết quả giao (Outcome)**

| Nhãn | Nghĩa |
|---|---|
| **Awaiting delivery outcome** | Chưa có kết quả giao thực tế |
| **On time** / **Late** | Đã có kết quả |
| **Intervened** | Có can thiệp / ghi nhận xử lý |

Không có nhãn kiểu “AI đã cứu đơn”.

---

### 5.6 Data health

**Câu hỏi trang này trả lời:**  
*Dữ liệu hiện tại có đủ mới và đủ tin để quyết định không?*  
(Không phải trang KPI giao hàng.)

**Bạn có thể**

- Xem AI assist: **Available** / **Unavailable** / **Incomplete**.
- Xem ảnh hưởng tới quyết định (điểm cũ, thiếu cam kết giao, AI tắt…).
- Với quyền **operator**: xem bảng **Feed status**, **bấm vào một dòng** để mở chi tiết nguồn (thời điểm, lỗi, ảnh hưởng, việc cần làm).

**Refresh** = tải lại bảng sức khỏe dữ liệu phiên demo — **không** đồng bộ ERP.

Nếu bị **403**: tài khoản demo không có quyền xem trang này (ví dụ vai trò chỉ xem).

---

### 5.7 Performance

**Câu hỏi trang này trả lời:**  
*Giải pháp / pilot có giúp vận hành tốt hơn không?*  
(Không phải tốc độ tải trang; không phải Data health.)

**Bạn có thể**

- Xem tóm tắt định hướng từ dữ liệu phiên (OTD đã gắn nhãn, số case đã review…).
- **Open performance report** — mở báo cáo placeholder trong demo.  
  Trong vận hành thật, quản lý tiếp tục dùng **Power BI**; app không thay BI.

Lưu ý: mục tiêu OTD +3–5 điểm phần trăm là **giả thuyết pilot**, chưa phải kết quả đo được trên production.

---

## 6. Việc nên làm / không nên làm

**Nên**

- Đọc chứng cứ và thời điểm cập nhật trước khi Approve.
- Khi thấy **Stale** / **Cannot assess**: kiểm tra ERP/TMS rồi mới hành động.
- Sau quyết định trong app: **làm thật** trên hệ thống nguồn.
- Dùng nháp tin khách như bản thảo — đọc lại trước khi gửi.

**Không nên**

- Coi Approve trong app là đã đổi lịch / đổi xe / đổi tồn kho.
- Coi thiếu sự kiện kho là “kho chưa làm gì”.
- Gửi khách thông tin chưa xác minh hoặc hứa ETA mới khi chưa kiểm chứng.
- Dựa hoàn toàn vào AI khi trạng thái **Unavailable**.

---

## 7. Demo controls (chỉ buổi demo / tập huấn)

Mục **Demo controls** (nhãn **F8**) ở cuối menu trái dùng để **mô phỏng** tình huống: AI tắt, dữ liệu cũ, xung đột khi hai người cùng lưu quyết định, rủi ro tăng…

**Nhân viên vận hành hàng ngày không cần dùng.**  
Chỉ bật khi người hướng dẫn yêu cầu trong buổi demo.

---

## 8. Tóm tắt một câu cho từng phần

| Phần | Một câu |
|---|---|
| **Orders needing attention** | Biết mở đơn nào tiếp theo |
| **Case detail** | Hiểu vì sao rủi ro và có chứng cứ gì |
| **Record decision** | Ghi quyết định của bạn (không tự sửa ERP/TMS) |
| **Customer draft** | Soạn & copy tin nhắn khách |
| **History** | Tra lại đã xử lý và kết quả giao |
| **Data health** | Biết có nên tin dữ liệu hiện tại không |
| **Performance** | Nhìn hiệu quả vận hành / pilot (BI là nguồn chính cho quản lý) |

---

*Phiên bản hướng dẫn khớp giao diện MVP demo (session copy, phạm vi Stockholm WH1).*
