# Git + GitHub Issues cho từng feature UI

Parent issue: [#3 Tạo UI cho Delivery Risk Agent](https://github.com/tonicuti/Delivery_Agent_Support/issues/3)

Phạm vi UI frontend đi qua **sub-issues / issue con**. Restful API là track riêng — không trộn vào PR UI.

## Mỗi feature (F0…F8)

### 1. Tạo hoặc claim issue

```bash
# Tạo issue mới (nếu chưa có sub-issue)
gh issue create \
  --title "feat(ui): F0 scaffold AppShell + design tokens" \
  --body-file src/frontend/docs/features/F0-scaffold.md \
  --assignee @me

# Gắn vào parent #3 nếu repo hỗ trợ sub-issues:
# (GitHub UI: Issue #3 → Add sub-issue → chọn issue vừa tạo)
```

Comment ngay Acceptance criteria + Test checklist (đã có sẵn trong file feature).

### 2. Branch

Theo `CLAUDE.md`:

```bash
git checkout main && git pull
git checkout -b feat/<issue-number>-ui-short-name
```

Ví dụ: `feat/12-ui-scaffold`

### 3. Code

- Chỉ sửa trong `src/frontend/`
- Không commit `delivery_db.db`, `.env` secrets, model artifacts
- Không `git add .` mù quáng — stage theo path

### 4. Test thủ công

Chạy checklist trong file feature. Comment trên issue:

```markdown
## Test results (YYYY-MM-DD)
- [x] App starts on Vite
- [x] Demo badge visible
- [ ] … (ghi fail nếu có)

Notes: …
Screenshots: …
```

### 5. Commit

Conventional Commits, scope `ui`:

```text
feat(ui): scaffold vite app shell and design tokens

Closes #<issue-number>
```

Một concern / một commit khi có thể.

### 6. PR

```bash
git push -u origin HEAD
gh pr create --title "feat(ui): …" --body "$(cat <<'EOF'
## Summary
- …

## Parent
Part of #3

## Test plan
- [ ] Checklist từ feature doc đã pass

Closes #<issue-number>
EOF
)"
```

Squash merge vào `main` theo quy ước repo. Sau merge: đóng issue con, comment progress trên #3.

## Comment mẫu khi xong feature

```markdown
Done for MVP scope of this feature.
PR: <url>
Test checklist: all passed / see exceptions above.
Ready for review → next feature: F<n+1>
```

## Không làm

- Commit thẳng vào `main`
- Trộn backend/API vào PR UI
- Đóng #3 khi mới xong một phần UI
- Bulk approve / fake Send / write-back trong UI “cho nhanh”
