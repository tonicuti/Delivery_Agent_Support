"""Turn read-only query results into plain sentences for the assistant; never codes or field names."""

from datetime import datetime, timedelta
import sqlite3
from zoneinfo import ZoneInfo

from .. import queries
from ..agent.playbooks import PLAYBOOKS
from ..features import _parse_utc
from ..labels import DECISION_WORDS, FEATURE_WORDS, ROLE_WORDS, STAGE_WORDS, STOCK_WORDS, duration, time_left
from .prompts import DEFAULT_LIST_ROWS, DEFAULT_ZONE, MAX_ROWS, TIMELINE_ROWS


def _zone(db: sqlite3.Connection, order_id: int) -> ZoneInfo:
    row = db.execute("""SELECT site_time_zone FROM promise_version WHERE order_id = ?
                        ORDER BY version_no DESC LIMIT 1""", (order_id,)).fetchone()
    try:
        return ZoneInfo(row["site_time_zone"] if row else DEFAULT_ZONE)
    except (KeyError, ValueError):
        return ZoneInfo(DEFAULT_ZONE)


def _at(iso: str | None, zone: ZoneInfo, now: datetime) -> str:
    if not iso:
        return "unknown"
    local = _parse_utc(iso).astimezone(zone)
    today = now.astimezone(zone).date()
    if local.date() == today:
        return f"today {local:%H:%M}"
    if local.date() == today - timedelta(days=1):
        return f"yesterday {local:%H:%M}"
    return f"{local.day} {local:%b} {local:%H:%M}"


def _age(minutes: int | None) -> str:
    return "just now" if not minutes else f"{duration(minutes)} ago"


def _risk_lines(d: dict, zone: ZoneInfo, now: datetime) -> list[str]:
    lines = []
    if d["p_late"] is None:
        lines.append("- It has not been checked yet, so there is no risk estimate.")
    else:
        lines.append(f"- Chance of being late: {round(d['p_late'] * 100)}% ({d['risk_band']} risk), checked {_age(d['age_minutes'])}.")
        if d["stale"]:
            lines.append(f"- Warning: this check is {duration(d['age_minutes'])} old and may be out of date.")
    if d["promised_to_utc"]:
        lines.append(f"- Promised delivery by {_at(d['promised_to_utc'], zone, now)} ({time_left(d['hours_remaining'])}).")
    if d["eligibility"] != "eligible":
        lines.append(f"- This order is no longer being watched ({d['eligibility'].replace('_', ' ')}).")
    if d["signals"]:
        lines.append("- Why it is at risk: " + " ".join(s["detail"] for s in d["signals"]))
    return lines


def _shipment_line(s: dict, zone: ZoneInfo, now: datetime) -> str:
    eta = s["current_eta_at_utc"] or s["planned_arrival_at_utc"]
    text = f"- Shipment {s['shipment_id']} ({s['carrier']}): {STAGE_WORDS.get(s['stage'], 'no progress recorded')}, expected {_at(eta, zone, now)}"
    if s["current_eta_at_utc"] and s["planned_arrival_at_utc"]:
        late = (_parse_utc(s["current_eta_at_utc"]) - _parse_utc(s["planned_arrival_at_utc"])).total_seconds() / 60
        if late > 0:
            text += f", {duration(late)} later than planned"
    return text + "."


def _recommendation_lines(rec: dict | None, zone: ZoneInfo, now: datetime) -> list[str]:
    if rec and rec["validation_status"] == "valid":
        out = rec["output"]
        lines = [f"- Suggested action: {PLAYBOOKS[rec['action_id']]} Owner: {out['suggested_owner']}. "
                 f"Respond by {_at(out['suggested_response_deadline'], zone, now)}."]
        if rec["decision"]:
            who = ROLE_WORDS.get(rec["decision"]["role"], rec["decision"]["role"])
            lines.append(f"- Decision so far: {DECISION_WORDS[rec['decision']['decision']].lower()} ({who}).")
        else:
            lines.append("- No one has decided on the suggestion yet.")
        return lines
    if rec:
        return ["- There is no suggestion yet because the assistant could not work one out."]
    return []


def order_facts(db: sqlite3.Connection, now: datetime, order_id: int) -> str:
    d = queries.order_detail(db, order_id, now)
    if d is None:
        return f"There is no order {order_id}."
    zone = _zone(db, order_id)
    lines = [f"Order {d['external_order_id']} ({d['region']}, {d['customer_type']} customer)"]
    lines += _risk_lines(d, zone, now)
    for line in d["lines"]:
        stock = STOCK_WORDS.get(line["stock_status"], "no stock information")
        lines.append(f"- Item {line['line_no']}: {line['product']} x{line['ordered_qty']:g}, {stock}.")
    lines += [_shipment_line(s, zone, now) for s in d["shipments"]]
    lines += _recommendation_lines(d["recommendation"], zone, now)
    unknown = [FEATURE_WORDS.get(name, name.replace("_", " ")) for name in (d["inputs"] or {}).get("missing", [])]
    if unknown:
        lines.append("- Not known yet: " + ", ".join(unknown) + ".")
    return "\n".join(lines)


def worklist_facts(db: sqlite3.Connection, now: datetime) -> str:
    items = queries.worklist(db, now)[:MAX_ROWS]
    if not items:
        return "There are no high-risk orders right now."
    lines = [f"Orders most at risk right now ({len(items)}), most likely to be late first:"]
    for rank, i in enumerate(items, 1):
        rec = i["recommendation"] or {}
        decision = (rec.get("decision") or {}).get("decision")
        state = DECISION_WORDS[decision].lower() if decision else "waiting for a decision"
        action = PLAYBOOKS.get(rec.get("action_id"), "no suggestion yet")
        reasons = "; ".join(s["label"].lower() for s in i["signals"]) or "no specific reason found"
        alert = "alert not yet read" if i["alert"] and not i["alert"]["acknowledged_at_utc"] else "alert read" if i["alert"] else "no alert"
        stale = " (information may be out of date)" if i["stale"] else ""
        lines.append(f"{rank}. {i['external_order_id']} - {round(i['p_late'] * 100)}% likely late, "
                     f"{time_left(i['hours_remaining'])}. Reasons: {reasons}. Suggested: {action} "
                     f"Status: {state}; {alert}{stale}.")
    return "\n".join(lines)


def orders_facts(db: sqlite3.Connection, now: datetime, *, region: str | None = None,
                 risk_band: str | None = None, sort: str = "riskiest", limit: int = DEFAULT_LIST_ROWS) -> str:
    """Filtered overview of every order: riskiest first (default) or safest first; unchecked orders come last."""
    if region:
        regions = [r["name"] for r in queries.list_regions(db)]
        match = next((name for name in regions if name.lower() == region.strip().lower()), None)
        if match is None:
            return f"There is no region called {region}. The regions are: {', '.join(regions)}."
        region = match
    orders = [o for o in queries.list_orders(db, now)
              if (region is None or o["region"] == region)
              and (risk_band is None or o["risk_band"] == risk_band)]
    checked = sorted((o for o in orders if o["p_late"] is not None), key=lambda o: o["p_late"], reverse=(sort != "safest"))
    orders = checked + [o for o in orders if o["p_late"] is None]
    if not orders:
        return "No orders match that filter."
    shown = orders[:limit]
    order_word = "lowest risk first" if sort == "safest" else "highest risk first"
    lines = [f"Orders found ({order_word}): {len(orders)}" + (f" (showing the first {len(shown)})" if len(shown) < len(orders) else "") + ":"]
    if checked:  # a small model misreads which end of a list is the answer, so say it outright
        extreme = "Lowest risk" if sort == "safest" else "Highest risk"
        lines.append(f"{extreme}: {checked[0]['external_order_id']} ({round(checked[0]['p_late'] * 100)}% likely late).")
    for o in shown:
        if o["p_late"] is None:
            lines.append(f"- {o['external_order_id']} ({o['region']}): not checked yet.")
        else:
            lines.append(f"- {o['external_order_id']} ({o['region']}): {round(o['p_late'] * 100)}% likely late "
                         f"({o['risk_band']} risk), {time_left(o['hours_remaining'])}.")
    return "\n".join(lines)


def timeline_facts(db: sqlite3.Connection, now: datetime, order_id: int) -> str:
    events = queries.timeline(db, order_id)[:TIMELINE_ROWS]
    if not events:
        return f"There is nothing recorded yet for order {order_id}."
    zone = _zone(db, order_id)
    lines = ["What happened with this order, newest first:"]
    for e in events:
        # Only decisions carry a detail worth saying; the others hold raw timestamps.
        detail = f" ({e['detail']})" if e["kind"] == "decision" and e["detail"] else ""
        lines.append(f"- {_at(e['at_utc'], zone, now)}: {e['title']}{detail}")
    return "\n".join(lines)


def warehouse_facts(db: sqlite3.Connection, now: datetime) -> str:
    rows = queries.warehouse_load(db)
    if not rows:
        return "There are no shipments in the warehouses."
    by_site: dict[str, list[str]] = {}
    for r in rows:
        by_site.setdefault(r["warehouse"], []).append(f"{r['shipments']} {STAGE_WORDS.get(r['stage'], r['stage'])}")
    return "Shipments by warehouse (no usual-day comparison is available):\n" + "\n".join(
        f"- {site}: {', '.join(parts)}." for site, parts in by_site.items())


def kpi_facts(db: sqlite3.Connection, now: datetime) -> str:
    k = queries.kpis(db, now)
    a, dec = k["alerts"], k["decisions"]
    lines = [f"- Orders flagged as high risk so far: {k['episodes_opened']} ({k['active_high_risk']} still open).",
             f"- Alerts read: {a['acknowledged']} of {a['sent']}."]
    if a["median_minutes_to_acknowledge"] is not None:
        lines.append(f"- Typical time to read an alert: {duration(a['median_minutes_to_acknowledge'])}.")
    lines.append(f"- Decisions: {dec['approved']} accepted the suggestion, {dec['edited']} chose another action, {dec['dismissed']} dismissed.")
    lines.append("- How many flagged orders were really late: not known yet, because delivered orders have not been recorded.")
    return "\n".join(lines)


