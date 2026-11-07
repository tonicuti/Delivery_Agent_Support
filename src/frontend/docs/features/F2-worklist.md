# F2 — Worklist (Orders needing attention)

**Issue title:** `feat(ui): F2 worklist priority table`  
**Branch:** `feat/<n>-ui-worklist`  
**Depends on:** F1

## Mục tiêu

Trong một lần nhìn: biết mở đơn nào tiếp và vì sao. Đây là **trang chủ**.

## UI blocks

### 1. Summary strip (theo scope hiện tại)

- Cases awaiting review
- Unassigned
- In review
- Follow-up due
- Stale / feed error count

Không KPI toàn doanh nghiệp.

### 2. Filters / sort

Cân nhắc: warehouse, delivery window/date, risk, reason, work status, assigned/unassigned, fulfilment stage, B2B/B2C, freshness.

**Default:** open cases in scope, **priority cao trước**.  
**Không** mặc định “chỉ hôm nay” nếu làm mất đơn ngày mai cần can thiệp hôm nay.

Search order ID (top bar hoặc filter bar).  
`Clear filters` khi empty do filter.

### 3. Table (nhóm ô, không bắt buộc 12 cột)

| Nhóm | Nội dung |
|---|---|
| Priority | rank + tooltip giải thích |
| Order | ID → mở case |
| Customer | B2B/B2C + pseudonym ref |
| Promise / Time left | window + time left **có kind** |
| Risk | level (+ p_late nếu có) chữ+icon |
| Main reasons | ≤3 short labels |
| Stage | fulfilment |
| Suggested action | hoặc “No suggestion yet” |
| Work | Open / In review / … |
| Assigned | role |
| Updated | age + stale flag |

Primary row action: **Review case**.  
Secondary: Start review / Acknowledge; assign nếu có quyền stub.

**Cấm:** bulk approve.

### 4. States

| State | Copy / hành vi |
|---|---|
| Loading | skeleton; refresh giữ snapshot cũ + label |
| Empty (thật) | `No orders currently need review` — **không** nói mọi đơn đúng giờ |
| Empty (filter) | + `Clear filters` |
| Feed error | snapshot gần nhất + thời điểm |
| Out of scope | không lộ order |

Giữ filter + scroll position khi back từ case detail (React Router location state hoặc store).

Rescore: **cập nhật row**, không tạo dòng trùng episode. Hiện `Risk increased` khi cần.

## shadcn / stack

- Table / DataTable (TanStack Table) theo skill shadcn
- Badge, Tooltip, Select, Button
- `key={episodeId}` ổn định

## UX skill

- Table: `overflow-x-auto` trên hẹp
- Filter chips wrap, không clip
- Keyboard: Tab tới Review; Enter mở case
- Color not alone cho risk

## Acceptance criteria

- [ ] `/` mặc định là worklist với data mock
- [ ] Default sort priority desc, open only
- [ ] Click order / Review → `/cases/:orderId` (detail có thể placeholder đến F3)
- [ ] Empty + filtered-empty đúng copy
- [ ] Stale flag hiện trên ít nhất 1 fixture
- [ ] Không bulk select approve

## Test checklist

- [ ] Mở app → thấy DEMO-SE-1042 gần đầu nếu high priority
- [ ] Filter risk=High → chỉ high
- [ ] Clear filters khôi phục
- [ ] Search exact order ID
- [ ] Tab + Enter mở case
- [ ] Refresh: không flash empty nếu giữ snapshot (nếu đã implement)
- [ ] Screen reader / title: risk badge có text “High”, không chỉ chấm đỏ

## Git

Commit: `feat(ui): add prioritized worklist page`

## Khi xong

Comment + PR → báo **xong F2**.
