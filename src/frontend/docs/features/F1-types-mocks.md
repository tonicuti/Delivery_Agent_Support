# F1 — Domain types + mock fixtures + typed API client

**Issue title:** `feat(ui): F1 domain types and demo fixtures`  
**Branch:** `feat/<n>-ui-types-mocks`  
**Depends on:** F0 merged

## Mục tiêu

Khóa TypeScript contract cho UI và seed mock `DEMO-SE-*` (đặc biệt `DEMO-SE-1042`). Chưa cần bảng đẹp — có thể smoke-test bằng console/page debug nhỏ.

## Types bắt buộc (tách rõ)

Đặt trong `src/shared/types/` hoặc `src/api/types.ts`:

| Concept | Ví dụ giá trị | Không được nhầm với |
|---|---|---|
| `RiskLevel` | `low` \| `medium` \| `high` | Priority |
| `PriorityScore` | number + optional explain | Risk |
| `TimeLeft` | `{ kind: 'promise_end' \| 'intervention_due'; remainingMinutes, deadlineAt }` | |
| `FulfilmentStage` | `ready` \| `picking` \| `packed` \| `loaded` \| `in_transit` \| `delivered` \| … | Work status |
| `WorkStatus` | `open` \| `in_review` \| `done` \| `dismissed` \| `expired` | Outcome |
| `DecisionStatus` | `approved` \| `edited` \| `dismissed` | Execution |
| `ExecutionStatus` | `not_confirmed` \| `user_confirmed_performed` \| `unable_to_perform` | Decision |
| `Outcome` | `on_time` \| `late` \| `cancelled` \| `unknown` \| `awaiting` | Done |
| `RecommendationStatus` | `checking` \| `ready` \| `incomplete` \| `unavailable` | |
| `Evidence` | `{ label, observation, source, updatedAt, unknownNotes? }` | |
| `RiskReason` | `{ id, title, evidence: Evidence[] }` | max 3 trên UI |
| `OrderLine` | SKU, qty, uom, stockStatus, prepProgress? | không badge In stock cả đơn nếu 1 line thiếu |
| `WorklistItem` | fields cho bảng F2 | |
| `CaseDetail` | full case | |
| `EpisodeHistory` | snapshot + decision + outcome | |

Risk bands (hiển thị): Low `<0.2`, Medium `0.2–0.5`, High `>0.5`. Hai biên 0.2 và 0.5 thống nhất.

## Mock fixtures

File: `src/mocks/demo-cases.ts` (+ JSON nếu muốn).

**Bắt buộc có case `DEMO-SE-1042`:**

- B2B, Sweden, warehouse in scope
- High risk; ~2h+ tới cuối promised window
- Reasons: picking delay + vehicle delayed
- 1 line tồn kho vấn đề; pack-complete = `No event received`
- Transport feed delayed; mỗi nguồn timestamp riêng
- Recommendation `ready` với playbook action (ví dụ `check_stock` / `confirm_route`)
- Work status `open`
- Flags: `demo: true`, `mode: 'demo'`

Thêm 3–5 case khác:

- Medium risk, assigned
- Low risk không cần lên worklist mặc định (hoặc filtered out)
- Missing promised window → không tính risk bình thường (`cannot_assess`)
- Stale feed (>90 phút) trên một evidence
- Recommendation `unavailable` (dùng ở F8; seed sớm được)

## Typed API client

```ts
// src/api/client.ts — interface
export interface DeliveryRiskApi {
  getWorklist(params: WorklistQuery): Promise<WorklistResponse>
  getCase(orderId: string): Promise<CaseDetail>
  saveDecision(input: SaveDecisionInput): Promise<SaveDecisionResult>
  confirmExecution(input: ConfirmExecutionInput): Promise<void>
  getHistory(params: HistoryQuery): Promise<EpisodeHistory[]>
  getDataHealth(): Promise<DataHealthSnapshot>
}
```

`src/api/mockClient.ts` implement từ fixtures (in-memory).  
`src/api/index.ts` export `api = mockClient`.

**Không** `fetch` tới backend Python.

## Acceptance criteria

- [ ] Types compile, không dùng `any` cho domain chính
- [ ] `DEMO-SE-1042` đủ field cho F2/F3
- [ ] Risk / Work / Decision / Execution / Outcome là union riêng
- [ ] Mock client trả worklist sorted-ready (priority desc)
- [ ] Unit smoke (Vitest optional): `getCase('DEMO-SE-1042')` không throw

## Test checklist

- [ ] `npx tsc --noEmit` pass
- [ ] Import mock trong placeholder page: log số case + id DEMO-SE-1042
- [ ] Đổi `WorkStatus` type phải làm vỡ compile nếu hardcode sai string
- [ ] Không file backend bị sửa

## Git

Commit: `feat(ui): add domain types and demo fixtures`

## Khi xong

Comment issue + PR → báo **xong F1**.
