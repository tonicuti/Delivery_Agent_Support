# F0 — Scaffold + design tokens + AppShell

**Issue title:** `feat(ui): F0 scaffold AppShell + design tokens`  
**Branch:** `feat/<n>-ui-scaffold`  
**Depends on:** none

## Mục tiêu

Tạo app Vite React TS chạy được, có design tokens, AppShell (top bar + nav), route placeholder. Chưa cần worklist thật.

## Cấu trúc thư mục mục tiêu

```text
src/frontend/
  package.json
  vite.config.ts
  tsconfig.json
  index.html
  components.json          # shadcn
  src/
    main.tsx
    index.css              # CSS variables + Tailwind
    app/
      App.tsx
      router.tsx
      AppShell.tsx
      routes/
        WorklistPage.tsx   # placeholder
        HistoryPage.tsx    # placeholder
        DataHealthPage.tsx # placeholder
        PerformancePage.tsx# placeholder (link only later)
    shared/
      ui/                  # shadcn components
      lib/utils.ts
    features/              # empty folders ok
    mocks/                 # empty for F0
    api/                   # empty for F0
  docs/                    # guidance (đã có)
```

## UI/UX rules (skill + Google-like corners)

- Density cao; spacing 8–16px trong shell
- Focus ring visible (`ring` = primary)
- `cursor-pointer` trên mọi control click được
- Skip link “Skip to main content”
- Badge `Demo data` luôn thấy trong shell
- Không emoji icon; dùng Lucide
- **Radius:** controls/badge/nav = **4px** (`rounded-sm`); panel/card = **8px**; **không** `rounded-full` / pill AI

## Bước implement

1. Trong `src/frontend`:
   ```bash
    npm create vite@latest . -- --template react-ts
    npm install
    npm install -D tailwindcss @tailwindcss/vite
    npx shadcn@latest init
   ```
2. Cài font: IBM Plex Sans + JetBrains Mono (Google Fonts link trong `index.html` hoặc `@fontsource`).
3. Định nghĩa CSS variables trong `index.css`:
   - `--color-primary: #2563EB`
   - `--color-accent: #EA580C`
   - `--color-destructive: #DC2626`
   - risk tokens: high / medium / low (+ foreground)
   - muted, border, card, background (neutral — tránh nền xanh nhạt toàn viewport)
4. Thêm shadcn primitives tối thiểu: `button`, `badge`, `separator`, `dropdown-menu`, `input`.
5. `AppShell`:
   - Left/top nav: Orders needing attention (default), History, Data health, Performance
   - Top bar: Country (SE locked for demo), Warehouse scope, Order ID search (UI only), Data freshness chip (`Updated …` / `Stale`), `Demo data` badge, mode chip `Demo`, account stub
6. Router (React Router): `/` → worklist placeholder; các route khác placeholder text.
7. Placeholder worklist: heading **Orders needing attention** + copy “Worklist comes in F2”.

## Acceptance criteria

- [ ] `npm run dev` mở app không lỗi
- [ ] Shell hiện Demo badge, country/warehouse, freshness chip
- [ ] Nav chuyển được giữa 4 khu vực (placeholder ok)
- [ ] Focus ring thấy khi Tab
- [ ] Không import/gọi backend Python
- [ ] README ngắn trong `src/frontend/README.md`: cách chạy

## Test checklist

- [ ] Cold start Vite OK
- [ ] Resize 1280 / 1440: shell không vỡ ngang
- [ ] Keyboard: Tab tới search + nav links
- [ ] `prefers-reduced-motion`: không animation bắt buộc (F0 gần như tĩnh)
- [ ] Kiểm tra không có file ngoài `src/frontend` bị sửa

## Git

```bash
gh issue create --title "feat(ui): F0 scaffold AppShell + design tokens" --body-file src/frontend/docs/features/F0-scaffold.md
git checkout -b feat/<n>-ui-scaffold
# … code …
git add src/frontend
git commit -m "feat(ui): scaffold vite app shell and design tokens"
```

## Khi xong

Comment test results trên issue → PR `Closes #<n>` → báo mentor **xong F0** trước khi làm F1.
