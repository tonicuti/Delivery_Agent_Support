# Delivery Risk Agent — Frontend UI Guidance (MVP)

Hướng dẫn implement UI trong `src/frontend` theo roadmap F0→F8.
**Không đụng** `src/backend`, `schema_fresh.sql`, `migrations/`, hay SQLite.

## Stack đã chốt

- React 19 + Vite + TypeScript
- Tailwind CSS + shadcn/ui
- Mock fixtures + typed API client (chưa gọi REST thật)
- Desktop-first, density cao (ops worklist)

## Design system (ui-ux-pro-max + Google-like corners)

| Token | Value |
|---|---|
| Font UI | IBM Plex Sans |
| Font mono (IDs, timestamps) | JetBrains Mono |
| Primary | `#2563EB` |
| Accent / CTA | `#EA580C` |
| Background | neutral light (slate/white — không blue wash toàn viewport) |
| Risk High / Med / Low | màu + **chữ + icon** (không chỉ màu) |
| Radius | **4px** controls (button/input/badge/nav); **8px** panels/cards; **không** `rounded-full` / pill AI |
| Motion | subtle 150–200ms; `prefers-reduced-motion` |
| Icons | Lucide SVG — không emoji |

**Cấm MVP:** AI purple gradient, bo góc “bong bóng”, customer portal, chatbot full-screen, live map, bulk approve, nút Send email giả, write-back ERP/TMS.

## Thứ tự feature

| ID | File | Branch gợi ý |
|---|---|---|
| F0 | [features/F0-scaffold.md](features/F0-scaffold.md) | `feat/<n>-ui-scaffold` |
| F1 | [features/F1-types-mocks.md](features/F1-types-mocks.md) | `feat/<n>-ui-types-mocks` |
| F2 | [features/F2-worklist.md](features/F2-worklist.md) | `feat/<n>-ui-worklist` |
| F3 | [features/F3-case-detail.md](features/F3-case-detail.md) | `feat/<n>-ui-case-detail` |
| F4 | [features/F4-decision.md](features/F4-decision.md) | `feat/<n>-ui-decision` |
| F5 | [features/F5-customer-draft.md](features/F5-customer-draft.md) | `feat/<n>-ui-customer-draft` |
| F6 | [features/F6-history.md](features/F6-history.md) | `feat/<n>-ui-history` |
| F7 | [features/F7-data-health-performance.md](features/F7-data-health-performance.md) | `feat/<n>-ui-data-health` |
| F8 | [features/F8-resilience.md](features/F8-resilience.md) | `feat/<n>-ui-resilience` |

Quy trình Git/Issue: [GIT_WORKFLOW.md](GIT_WORKFLOW.md)  
Map issue GitHub: [ISSUE_MAP.md](ISSUE_MAP.md) (#6–#14 dưới parent #3)

## Nguyên tắc domain (mọi feature)

- Trang mặc định = **Orders needing attention**
- Tách: Risk / Priority / Time left / Work status / Decision / Execution / Outcome
- Approve = lưu decision; **không** đổi ERP/TMS
- AI unavailable → vẫn review thủ công
- Mỗi chứng cứ: nguồn + timestamp; thiếu data ≠ sự kiện chắc chắn
- Demo data luôn gắn nhãn `Demo data`

## Prerequisite

Chưa có Node trên máy → làm [SETUP-NODE.md](SETUP-NODE.md) trước F0.

## Cách làm việc với mentor

1. Mở đúng file feature (bắt đầu F0).
2. Tạo/claim sub-issue dưới #3, dán Acceptance + Test checklist.
3. Code chỉ trong `src/frontend`.
4. Tự test theo checklist → comment kết quả trên issue → mở PR.
5. Báo “xong Fn” để review trước khi sang feature kế.
