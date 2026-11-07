# F8 — AI timeout / stale / concurrent review

**Issue title:** `feat(ui): F8 resilience for AI timeout stale and conflicts`  
**Branch:** `feat/<n>-ui-resilience`  
**Depends on:** F3, F4 (nên sau F7 nếu dùng agent toggle)

## Mục tiêu

Chứng minh: **AI hỏng vẫn làm việc được**; dữ liệu cũ được nói rõ; hai người review không ghi đè thầm.

## Scenarios phải demo được

### 1. AI timeout / unavailable

- Fixture hoặc Dev toggle: recommendation `unavailable` / `checking` rồi timeout
- Worklist **vẫn** load
- Case: evidence vẫn xem
- Manual action picker + save decision (F4) vẫn OK
- Không full-page blocker / chatbot dead-end

### 2. Stale data

- Evidence/chips `Stale` khi >90 phút hoặc source error
- Feed error: last snapshot + updated at
- Không biến missing event thành “not started”

### 3. Concurrent review

- Mock: case `in_review` bởi role khác + `decisionVersion`
- User A mở modal; User B (simulate) lưu decision mới hơn
- User A submit → error: decision newer exists; giữ form; không overwrite
- Optional banner: “Case updated since you opened it — reload”

### 4. Alert de-dupe / risk increase

- Rescore cùng episode: **update row**, không thêm dòng
- Khi risk tăng đáng kể: badge `Risk increased`
- Không toast lại chỉ vì ETA đổi nhẹ

### 5. Episode closed / delivered

- Không mời approve recommendation cũ nếu delivered/cancelled
- History vẫn xem được (F6)

## Dev affordances (MVP ok)

Page hoặc menu `Demo controls` (chỉ khi `Demo data`):

- Force AI unavailable
- Force stale feeds
- Simulate concurrent decision
- Simulate risk increase on DEMO-SE-1042

Không hiện controls này như production feature.

## Acceptance criteria

- [ ] AI unavailable: full manual decision path works
- [ ] Stale/error states visible và đúng copy
- [ ] Concurrent save bị chặn với message rõ
- [ ] Rescore không duplicate episode rows
- [ ] Closed episode không approve recommendation cũ
- [ ] Demo controls không lộ khi mode ≠ demo (hoặc ẩn sau flag)

## Test checklist

- [ ] Bật AI unavailable → worklist + manual dismiss OK
- [ ] Stale fixture → chip trên worklist + detail evidence
- [ ] Simulate conflict → second save fails cleanly
- [ ] Risk increase updates same row + badge
- [ ] Delivered fixture: decision CTA hidden/disabled với giải thích

## Git

Commit: `feat(ui): harden worklist and decisions for AI and conflict states`

## Khi xong

Comment + PR → cập nhật #3 progress (UI track F0–F8 complete for guidance/implementation) → báo **xong F8**.

## Definition of done (toàn MVP UI track)

Chuỗi dùng được end-to-end trên mock:

**Worklist → verify → understand risk → decide → (external ERP/TMS) confirm → history/outcome**

Không cần đợi REST API thật; khi API có: chỉ thay `mockClient` bằng HTTP client cùng interface.
