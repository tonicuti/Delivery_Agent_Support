# F6 — History + outcome (minimal)

**Issue title:** `feat(ui): F6 episode history and outcomes`  
**Branch:** `feat/<n>-ui-history`  
**Depends on:** F4 (cần decision đã lưu trong mock)

## Mục tiêu

Trả lời: *Lúc đó hệ thống biết gì, đề xuất gì, nhân viên quyết định gì, cuối cùng đơn ra sao?*

Route: `/history` (+ deep link `/history/:episodeId` optional)

## Fields chính mỗi episode row/detail

- Episode ID, order ID
- Snapshot + risk lúc alert
- Reasons, model/rules version
- Recommendation + staff edit
- Decision + dismiss reason
- Deciding role + timestamp
- Execution confirmation if any
- Original promise vs actual delivery
- Outcome + late minutes nếu tính được
- Intervened flag
- Episode close reason

**Replay:** giữ diễn biến theo thời điểm cảnh báo — không chỉ state mới nhất.

## Filters

Date, warehouse, outcome, reason, action, decision, model version.

## Outcome rules

- Chưa có actual → **`Awaiting delivery outcome`**
- **Không** tự gán On time
- Đúng giờ sau can thiệp **không** gắn nhãn `Saved by AI`

## UI

- Table + detail drawer/page
- Discrete timeline (không fake continuous chart)

## Acceptance criteria

- [ ] History liệt kê episode từ mock (gồm DEMO-SE-1042 sau decision)
- [ ] Detail hiện snapshot lúc alert + decision + execution
- [ ] Outcome awaiting đúng khi thiếu actual
- [ ] Filter outcome hoạt động
- [ ] Đóng episode vẫn xem được history

## Test checklist

- [ ] Sau Approve trên case → history có decision record
- [ ] Case chưa delivery: outcome = Awaiting…
- [ ] Fixture late có late minutes
- [ ] Không label Saved by AI

## Git

Commit: `feat(ui): add episode history and outcome views`

## Khi xong

Comment + PR → báo **xong F6**.
