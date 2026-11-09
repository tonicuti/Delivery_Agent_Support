# Delivery Risk Console: design system

Source of truth for the look and wording of `frontend/`. Built from the ui-ux-pro-max skill, IBM Carbon's status-indicator rules, and the Grab theme (colours sampled from grab.com).

## Who it is for

Dispatchers, planners and managers at a building-materials retailer. They are not technical. Everything on screen must read like something a colleague would say.

### Wording rules (checked automatically before release)

- No snake_case, codes, IDs from the database, machine timestamps, "UTC", "API", "JSON", "model", "probability", "p_late", "snapshot", "episode", "playbook", "scheduler", or tool and product names such as Qwen or Ollama.
- Percentages are whole numbers ("93%"). Durations are spoken ("35 min left", "2 h late", "40 min overdue"). Times are in the user's own clock ("Today 17:00").
- Say what the thing is for the person: "Chance of being late", "Delivery promise", "Check now", "Got it", "Not needed". Never say how it works inside.
- Empty, loading and error states tell the person what to do next. Errors never show server messages.
- Risk is always shown with an icon, a word and a colour together, never colour alone.
- Where the product is a demo, say it once, briefly, in the banner.

## Theme (Grab)

| Token | Light | Use |
|---|---|---|
| Brand green | `#00B14F` | logo, progress, decorative accents (never text on white: 2.9:1) |
| Primary | `#007F38` | buttons and links (white text 5.1:1); hover `#006A2F` |
| Soft green | `#E5F6EC` | active navigation, icon chips, highlighted blocks |
| Background | `#F4F6F5` | page; cards are white |
| Text | `#1C211E`, muted `#4B4B4B` | |
| High risk | `#D92D20` on `#FEF0EE` | |
| Medium risk | `#F38522` on `#FFF3E3` (text `#8F4B00`) | |
| Low risk | `#00B14F` on `#E5F6EC` (text `#006A2F`) | |
| Info | `#2F6FED` on `#E8F0FE` | |

Dark mode keeps the same roles with lighter greens on `#0E1411`. Tokens live in `frontend/src/index.css`.

## Shape and type

- Corners: cards 16 px, inputs 12 px, buttons and chips fully round (pill). Soft two-layer shadow, no heavy borders.
- Font: Be Vietnam Pro (self-hosted; full Vietnamese and Nordic coverage), 400/500/600/700. Numbers use tabular figures. No third-party font CDN.
- Sizes: body 14 px in tables, 16 px elsewhere, page title 24 px bold.
- Icons: lucide, 16 to 20 px, in a tinted round chip when they lead a card.

## Layout

- White sidebar with a green pill for the current page; sticky white header with order search, assistant menu and appearance menu.
- Pages: Worklist (Right now, Shift plan), Orders, order page, Chat, Insights.
- Dense lists are tables in a card that scrolls sideways on small screens; everything else stacks to one column below 1024 px. No page-level horizontal scroll at 375, 768, 1024 or 1440 px.
- Order page order: three summary cards (risk, promise, where it is), then what to do with the decision buttons, the customer message and team decisions, then tabs for activity, details and claims.

## Chat

- Past chats are listed on the left (on a phone, behind "Past chats"), kept on this device only, deletable with confirmation.
- While the assistant works it says what it is doing in plain words ("Checking which orders are most at risk…", "Writing the answer…"), then the answer appears word by word. A Stop button is always available.
- Small talk is answered like conversation. Questions about orders show which information was read and when.
- If the assistant is unavailable, the facts are shown instead of an error.

## Accessibility

Visible keyboard focus, labelled controls, 44 px touch targets on touch devices, reduced-motion respected, status never colour-only, live regions for progress and results.
