# F5 — Customer communication draft (in case)

**Issue title:** `feat(ui): F5 customer message draft copy-only`  
**Branch:** `feat/<n>-ui-customer-draft`  
**Depends on:** F4 (có thể song song sau F3 nếu draft không phụ thuộc decision)

## Mục tiêu

Trong case detail: soạn / sửa bản nháp thông báo khách (sv / no / da), **Copy draft** sang kênh hiện có.  
**Không** tích hợp Send thật.

## UI

Section trong case: **Customer message draft**

- Language select: Swedish / Norwegian / Danish (default theo country scope SE → sv)
- Editable textarea
- “Facts used” list (promised window, delay reason đã xác minh, …)
- Warning chip khi dùng thông tin **chưa xác nhận**
- Button: **Copy draft**
- Không có nút `Send` trông như đã nối email/SMS  
  (Nếu cần chỗ dành sẵn: disabled + tooltip `Sending not connected in MVP`)

## Nội dung cấm trong draft

- Đưa P(late) nội bộ thành lời hứa khách
- Hứa ETA mới khi chưa xác minh
- Báo “đã đổi xe” chỉ vì vừa Approve
- Đưa PII thừa (họ tên đầy đủ, SĐT, địa chỉ đầy đủ) vào prompt/AI mock

Mock generator có thể template đơn giản theo language — không cần LLM.

## Acceptance criteria

- [ ] Đổi language đổi template mẫu
- [ ] User sửa draft được
- [ ] Copy draft ghi clipboard + toast “Copied”
- [ ] Warning hiện khi fact unverified
- [ ] Không có Send hoạt động
- [ ] Không lộ PII thừa trong mock facts

## Test checklist

- [ ] SE case → default Swedish sample
- [ ] Copy → paste notepad OK
- [ ] Bật fact unverified → warning visible
- [ ] Approve rồi mở draft: không auto câu “vehicle already changed”

## Git

Commit: `feat(ui): add customer draft copy flow`

## Khi xong

Comment + PR → báo **xong F5**.
