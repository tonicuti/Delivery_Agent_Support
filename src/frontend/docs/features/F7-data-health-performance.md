# F7 — Data health + Performance link

**Issue title:** `feat(ui): F7 data health panel and performance link`  
**Branch:** `feat/<n>-ui-data-health`  
**Depends on:** F0 (có thể sau F2); nên sau F1 để mock health

## Mục tiêu

1. **Data health** (role-limited stub): freshness feeds, scoring, agent on/off — nhỏ nhưng cần.  
2. **Performance**: không clone Power BI — chỉ link ngoài hoặc tóm tắt tối thiểu.

## Data health panel (`/data-health`)

Hiển thị mock:

| Signal | Ví dụ |
|---|---|
| ERP/WMS last update | timestamp + stale? |
| TMS/carrier last update | |
| Maps/weather/holiday | |
| Last scoring run | |
| Missing/error records count | |
| Model/rules version | |
| Agent on/off | |

Policy demo: evidence **stale sau 90 phút** (`DATA_STALE`) — UI đánh dấu chứng cứ cũ (có thể đã làm một phần ở F2/F3; F7 tập trung panel).

Refresh button: **chỉ reload mock/app data** — copy tooltip: không ép ERP xuất dữ liệu mới.

Missing promised window trên case: `Cannot assess — promised window missing` (nếu chưa làm ở F2/F3 thì hoàn thiện ở đây).

Quyền: nếu role stub ≠ operator → 403 page/copy, không lộ chi tiết feed nội bộ thừa.

## Performance (`/performance`)

- Link “Open Power BI (demo)” → URL placeholder + `Demo` badge
- Optional micro-summary cards (OTD, flagged count, ack/approve/edit/dismiss counts) với **period + scope + definition** tooltip
- Mục tiêu OTD +3–5pp (proposal) = **pilot hypothesis**, không ghi như kết quả đã đạt
- Không `Saved by AI` metric

## Acceptance criteria

- [ ] Data health page hiện timestamps + stale flags
- [ ] Agent off hiển thị rõ
- [ ] Refresh chỉ reload client mock
- [ ] Performance không phải dashboard đầy đủ; có link + disclaimer
- [ ] Missing promise window messaging thống nhất

## Test checklist

- [ ] Fixture stale >90m hiện Stale
- [ ] Toggle agent off trong mock → panel + case recommendation unavailable (hook F8)
- [ ] Performance disclaimer visible
- [ ] User role stub “dispatcher” có thể bị hạn chế panel (nếu implement gate)

## Git

Commit: `feat(ui): add data health panel and performance link`

## Khi xong

Comment + PR → báo **xong F7**.
