# Frontend — Delivery Risk Agent (MVP)

Dispatcher worklist UI. Guidance: [`docs/README.md`](docs/README.md).

## Stack

React 19 + Vite + TypeScript + Tailwind CSS v4 + local UI primitives.

**Data (session copy — enterprise local pattern):**
- **Source (RO):** team DB, default `src/backend/practice_delivery/my_practice.db`  
  (`DELIVERY_DB_PATH` to override). UI never writes this file.
- **Session (RW):** `src/frontend/.data/session.db` — copy created on first boot.  
  All GET/POST hit the copy only.
- **Reset:** `POST /api/session/reset` re-copies source → session (discard local writes).

## Run

```powershell
cd src/frontend
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).  
Worklist needs `worklist_item` + `risk_score` rows (already present in `my_practice.db`).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Preview production build |

## Constraints

- Work only in `src/frontend`
- No DB / migrations / backend edits
