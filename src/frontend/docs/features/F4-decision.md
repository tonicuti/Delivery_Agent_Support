# F4 — Decision modal + execution handoff

**Issue title:** `feat(ui): F4 decision modal and execution confirmation`  
**Branch:** `feat/<n>-ui-decision`  
**Depends on:** F3

## Mục tiêu

Approve / Edit / Dismiss lưu **decision** trong app mock. Phân biệt rõ với **execution** ở ERP/TMS.

## Modal fields

- Order summary: promise, risk, snapshot/version
- Current recommendation being reviewed
- Chosen action (playbook allow-list)
- Reason required for Edit / Dismiss
- Business notes
- Acting role
- Follow-up time if applicable
- Banner cứng: **`No changes will be made to ERP or TMS`**

### Approve

Chấp thuận đề xuất → lưu decision → **không** đổi vận hành trong app.

### Edit

Chọn action khác trong playbook + lý do.  
Không dùng free-text để yêu cầu action ngoài allow-list.

### Dismiss

Lý do bắt buộc, nhóm gợi ý:

- Wrong / stale data
- Alert not applicable
- Already handled in another system
- No feasible action
- Other

Dismiss ≠ “đơn sẽ không trễ”.

## Validation

- Required fields trước submit
- Action trong allow-list
- Chặn double-submit
- Nếu mock “network error”: giữ form, **không** toast success
- Nếu decision mới hơn đã tồn tại (F8): báo conflict, không ghi đè

## Sau khi lưu — toast bắt buộc

> **Decision recorded. No ERP or TMS changes have been made.**  
> Complete the action in the source system, then confirm what was done.

Next actions trên case:

- `Open in ERP/TMS` (demo simulated)
- `Confirm action performed` → `executionStatus = user_confirmed_performed`
- `Unable to perform` + reason
- `Set follow-up`

**Không** ghi `system-verified` khi chỉ user confirm.

## UX skill

- Dialog focus trap + restore focus
- Labels thật, không placeholder-only
- Inline validation on blur / submit
- Loading → success/error trên submit button
- Visible focus trong modal

## Acceptance criteria

- [ ] Approve/Edit/Dismiss lưu qua mock API + hiện trên case
- [ ] Toast đúng copy “No ERP or TMS changes…”
- [ ] Edit/Dismiss bắt buộc reason
- [ ] Confirm performed cập nhật execution status riêng decision
- [ ] Double-click submit không tạo 2 decision
- [ ] Không có nút “Apply to ERP”

## Test checklist

- [ ] Approve DEMO-SE-1042 → work status/decision đổi; fulfilment stage **không** tự đổi
- [ ] Dismiss thiếu reason → blocked
- [ ] Confirm performed → badge `User-confirmed` (không `System-verified`)
- [ ] Esc đóng modal; focus trả về nút mở
- [ ] Mô phỏng lỗi API: form còn data, không success toast

## Git

Commit: `feat(ui): add decision modal and execution handoff`

## Khi xong

Comment + PR → báo **xong F4**.
