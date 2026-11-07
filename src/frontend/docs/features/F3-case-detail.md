# F3 — Case detail

**Issue title:** `feat(ui): F3 case detail evidence and recommendation`  
**Branch:** `feat/<n>-ui-case-detail`  
**Depends on:** F2

## Mục tiêu

Màn hình quan trọng nhất: kiểm chứng đề xuất **một chỗ**, không nhảy nhiều tab để tìm chứng cứ.

Route: `/cases/:orderId`  
Back về worklist **giữ filter/scroll**.

## Layout

### A. Sticky header

- Order ID, priority, risk, promised window, time left (kind rõ), fulfilment stage, work status, assigned role, snapshot/scoring time
- Actions: `Open in ERP` / `Open in TMS` — nếu demo giả deep link: label **`Demo link (simulated)`**, không giả đã nối
- CTA mở decision (F4 có thể stub nút)

### B. Why this order is at risk

≤3 reasons. Mỗi reason:

1. Business label dễ hiểu  
2. Observable evidence  
3. Source  
4. Updated at  
5. Unknown / needs verification  

**Cấm:** chỉ ghi `AI detected high risk`.  
**Cấm:** biến feature importance thành nguyên nhân chắc chắn.

Ví dụ copy:

> **Picking is behind schedule**  
> Packing has not been recorded. Warehouse events were last updated 12 minutes ago.  
> Source: WMS · Updated: …

### C. Order + lines

- Pseudonym customer ref, B2B/B2C
- Fulfilment warehouse/store
- Postcode/area theo quyền
- Weight/volume nếu có
- Crane / long goods / special handling flags
- Line table: SKU, name, qty, UoM, **stock per line**, prep progress

Không badge `In stock` cả đơn khi một line thiếu.  
Không bắt buộc Split shipment action.

### D. Warehouse timeline

Ready → Pick started → Pack completed → Loaded  

Mỗi mốc: planned (nếu có), actual, recording status, source.  
Không có event → **`No event received`**, không `Not started`.

### E. Transport

Shipment/route/carrier; vehicle type nếu cần quyết định; planned/actual departure; planned/current ETA vs promised window; stop sequence / upstream delay nếu có.

**Không** mặc định: live map, driver profile, driver phone.

### F. Risk history

Timeline/chart **snapshot rời** (score, reasons change, episode open, ack). Không vẽ continuous nếu data là discrete.

### G. AI recommendation block (không chatbot)

- Status: checking / ready / incomplete / unavailable
- Assessment summary
- Playbook action
- Why suitable
- Supporting evidence IDs/refs
- Preconditions to verify
- Missing data
- Generated at

Khi `unavailable`/`incomplete`: vẫn xem evidence; enable chọn action thủ công (hook F4).

## UX skill

- Progressive disclosure: secondary detail collapsed ok
- Visible labels; timestamps timezone rõ (Europe/Stockholm vs UTC label)
- Icons Lucide; risk text+color

## Acceptance criteria

- [ ] DEMO-SE-1042 mở đủ sections A–G
- [ ] Mỗi reason có source + timestamp
- [ ] Pack missing = `No event received`
- [ ] Line-level stock, không fake whole-order in-stock
- [ ] AI block có đủ trạng thái (ít nhất ready + một fixture unavailable hoặc toggle)
- [ ] ERP/TMS demo links ghi simulated
- [ ] Back giữ worklist context

## Test checklist

- [ ] Từ worklist → detail → Back: filter còn
- [ ] Keyboard tới recommendation actions area
- [ ] Stale evidence có visual + text
- [ ] Không horizontal scroll vỡ toàn page ở 1280px (section scroll ok)
- [ ] Copy không chứa xác suất nội bộ kiểu “74% chắc chắn trễ” như lời khẳng định tuyệt đối — nếu hiện p_late, chú thích là model probability

## Git

Commit: `feat(ui): add case detail with evidence and recommendation`

## Khi xong

Comment + PR → báo **xong F3**.
