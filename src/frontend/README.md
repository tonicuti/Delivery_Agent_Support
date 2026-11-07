# Frontend — Delivery Risk Agent (MVP)

Dispatcher worklist UI. Guidance: [`docs/README.md`](docs/README.md).

## Stack

React 19 + Vite + TypeScript + Tailwind CSS v4 + local UI primitives (shadcn-compatible).

Mock API only until REST exists. Do not call the Python backend from here.

## Run

```powershell
cd src/frontend
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Preview production build |

## Constraints

- Work only in `src/frontend`
- No DB / migrations / backend edits
