# Offline delivery-risk practice data

All records are synthetic and use UTC timestamps on **2026-11-06**. The first
decision time is `2026-11-06T12:00:00Z`. These scores demonstrate the workflow;
they are not measured prediction accuracy.

## Files

- `practice_delivery.db`: fresh, migrated database with 10 orders and no scores.
- `practice_scored.db`: worked example with 12:00 scores, a later score for
  order 1007, two frozen shift lists, an authorized replacement for order 1008,
  and simulated recommendations and alerts for orders 1001 and 1002.
- `practice_extra.sql`: seven additional orders to load after the backend's
  `schema_fresh.sql` and `inference_seed.sql`.
- `build_practice_db.py`: creates a fresh, migrated database. It refuses to
  overwrite an existing file.
- `run_practice_agent.py`: runs the real graph on historical evidence with the
  backend's deterministic mock recommendation by default. `--qwen` calls local
  Ollama instead. Neither mode fetches external API data.

## Cases to try

| Order | Decision time | What it demonstrates |
|---|---|---|
| 1001 | 12:00Z | Packed, in stock; model still scores High. |
| 1002 | 11:40Z, then 12:00Z | Short stock, followed by a 120-minute ETA delay. |
| 1003 | 12:00Z | Backorder with two outstanding original shipments. |
| 1004 | 12:00Z | In stock and packed; Low in the saved model. |
| 1005 | 12:00Z | Missing stock and warehouse updates; unknown product volume. |
| 1006 | 12:00Z | Gothenburg order split across two warehouses; a planned second shipment is normal delivery, not reshipment. |
| 1007 | 12:00Z, then 14:00Z | Stock changes from short to in stock, while departure and ETA become late. |
| 1008 | 12:00Z, then 12:15Z | Two damaged units and an open claim. Scoring stops only after representative authorization at 12:10Z in the worked example. |
| 1009 | 12:00Z | Cancelled; ineligible for scoring. |
| 1010 | 12:00Z | All original units accepted; ineligible for scoring. |

The saved model produced Low for 1004; Medium for 1005, 1006 and 1008; High
for 1001, 1002, 1003 and 1007 at 12:00Z. Order 1007's 14:00Z score was High
at about 84.7%. The model's `weather_severity` input stays unknown even though
the fixture stores a raw weather observation.

## Commands (PowerShell)

Run from `C:\Itoni\IT Consultant Netcompany\backend`. Set `$practiceDb` to a
copy of the clean database when you want to preserve the starting point:

```powershell
$practiceDb = 'C:\Users\daong\OneDrive\Documents\ChatGPT\IT Consultant\practice_delivery\my_practice.db'
Copy-Item -LiteralPath 'C:\Users\daong\OneDrive\Documents\ChatGPT\IT Consultant\practice_delivery\practice_delivery.db' -Destination $practiceDb
& '.\.venv\Scripts\backend.exe' --db $practiceDb inspect-db
& '.\.venv\Scripts\backend.exe' --db $practiceDb features --order-id 1007 --as-of 2026-11-06T12:00:00Z
& '.\.venv\Scripts\backend.exe' --db $practiceDb features --order-id 1007 --as-of 2026-11-06T14:00:00Z
& '.\.venv\Scripts\backend.exe' --db $practiceDb score --order-id 1007 --as-of 2026-11-06T12:00:00Z --offline
& '.\.venv\Scripts\backend.exe' --db $practiceDb score --order-id 1007 --as-of 2026-11-06T14:00:00Z --offline
```

For a High-risk recommendation and simulated alert on the same database:

```powershell
& '.\.venv\Scripts\python.exe' 'C:\Users\daong\OneDrive\Documents\ChatGPT\IT Consultant\practice_delivery\run_practice_agent.py' --db $practiceDb --order-id 1002 --as-of 2026-11-06T12:00:00Z
```

To exercise the prompt in `recommendations.py` with local `qwen3:1.7b`, add
`--qwen` to that command. The prompt replacement discussed earlier must be
applied to the backend file first if you want to test that new version. If
Ollama is unavailable or its response fails validation, the agent still saves
the High-risk worklist item and simulated alert.

To practice the claim-to-authorization boundary, first score order 1008 at
12:00Z, then run:

```powershell
& '.\.venv\Scripts\backend.exe' --db $practiceDb authorize-replacement --inspection-id MY-INSPECTION-1008 --claim-id CLAIM-1008 --representative-id rep-1 --finding 'Two boards damaged at handover' --decided-at 2026-11-06T12:10:00Z --line 1008:2
& '.\.venv\Scripts\backend.exe' --db $practiceDb score --order-id 1008 --as-of 2026-11-06T12:15:00Z --offline
```

The second command reports `replacement_authorized` and saves no new score.
To practice shift ranking, score the eligible Stockholm orders at 12:00Z,
then run `freeze-shift --shift-id my-shift --region-id 1 --started-at
2026-11-06T12:00:00Z --capacity 3` on your database.

The data is anchored to a historical decision time. Use the offline runner for
these cases; the backend's live mode requires a decision time close to now.
To rebuild a clean database under a new name:

```powershell
py 'C:\Users\daong\OneDrive\Documents\ChatGPT\IT Consultant\practice_delivery\build_practice_db.py' --output 'C:\Users\daong\OneDrive\Documents\ChatGPT\IT Consultant\practice_delivery\another_practice.db'
```
