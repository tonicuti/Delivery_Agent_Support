"""As-of cache and bounded live fetching for external evidence."""

from datetime import datetime, timedelta, timezone
import json
from sqlite3 import Connection
from urllib.request import urlopen
from uuid import uuid4
from zoneinfo import ZoneInfo

from ..features import _parse_utc, _utc_text
from .holidays import holiday_url, validate_holidays
from .weather import WEATHER_MAPPING_VERSION, classify_weather, weather_url, validate_weather


WEATHER_TTL = timedelta(minutes=30)
HOLIDAY_TTL = timedelta(days=7)


def _scope(db: Connection, order_id: int, decision_time: datetime) -> dict:
    at = _utc_text(decision_time)
    row = db.execute("""
        SELECT s.site_id, s.latitude, s.longitude, s.time_zone, s.country_code,
               p.window_end_utc
        FROM customer_order o JOIN delivery_site s ON s.site_id = o.site_id
        JOIN promise_version p ON p.order_id = o.order_id
        WHERE o.order_id = ? AND p.recorded_at_utc <= ? AND p.effective_at_utc <= ?
        ORDER BY p.version_no DESC LIMIT 1
    """, (order_id, at, at)).fetchone()
    if row is None:
        raise ValueError("order has no visible destination and promise")
    deadline = _parse_utc(row["window_end_utc"])
    local_date = deadline.astimezone(ZoneInfo(row["time_zone"])).date()
    country = row["country_code"] or "SE"
    return {"site_id": row["site_id"], "latitude": row["latitude"],
            "longitude": row["longitude"], "target": deadline,
            "local_date": local_date, "country": country,
            "country_assumed": row["country_code"] is None}


def _scope_json(kind: str, details: dict) -> str:
    if kind == "weather":
        scope = {"site_id": details["site_id"], "latitude": details["latitude"],
                 "longitude": details["longitude"],
                 "utc_date": details["target"].date().isoformat()}
    else:
        scope = {"country": details["country"], "year": details["local_date"].year}
    return json.dumps(scope, sort_keys=True, separators=(",", ":"))


def get_context(db: Connection, order_id: int, decision_time: datetime) -> dict:
    details = _scope(db, order_id, decision_time)
    at = _utc_text(decision_time)
    result = {"weather_status": "missing", "holiday_status": "missing",
              "holiday_flag": None, "weather": None, "evidence_ids": [],
              "country_assumed": details["country_assumed"]}
    target_hour = details["target"].astimezone(timezone.utc).replace(
        minute=0, second=0, microsecond=0)
    for kind, ttl in (("weather", WEATHER_TTL), ("holiday", HOLIDAY_TTL)):
        scope_json = _scope_json(kind, details)
        rows = db.execute("""
            SELECT * FROM external_evidence WHERE kind = ? AND request_scope_json = ?
              AND fetched_at_utc <= ? AND validation_status = 'valid'
            ORDER BY fetched_at_utc DESC, evidence_id DESC
        """, (kind, scope_json, at)).fetchall()
        for row in rows:
            if kind == "weather" and not (
                    row["coverage_start_utc"] <= _utc_text(target_hour) <= row["coverage_end_utc"]):
                continue
            age = decision_time.astimezone(timezone.utc) - _parse_utc(row["fetched_at_utc"])
            status = "fresh" if age <= ttl else "stale"
            result[f"{kind}_status"] = status
            if status == "fresh":
                result["evidence_ids"].append(f"external_evidence:{row['evidence_id']}")
                if kind == "weather":
                    _, _, result["weather"] = validate_weather(json.loads(row["response_json"]), details["target"])
                    result["weather"]["severity"] = classify_weather(
                        result["weather"]["precipitation_mm"], result["weather"]["wind_gust_m_s"])
                    result["weather"]["mapping_version"] = WEATHER_MAPPING_VERSION
                else:
                    result["holiday_flag"] = validate_holidays(
                        json.loads(row["response_json"]), details["country"], details["local_date"])
            break
    return result


def _fetch_json(url: str, timeout: int) -> object:
    with urlopen(url, timeout=timeout) as response:
        body = response.read(1_000_001)
    if len(body) > 1_000_000:
        raise ValueError("provider response exceeds 1 MB")
    return json.loads(body)


def live_enrich(db: Connection, order_id: int, decision_time: datetime, *,
                now: datetime | None = None, fetcher=None) -> dict:
    supplied_now = now is not None
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("now must be timezone-aware")
    if not -timedelta(minutes=1) <= now - decision_time <= timedelta(minutes=5):
        raise ValueError("live enrichment cannot backfill a historical decision")
    details = _scope(db, order_id, decision_time)
    fetch = fetcher or _fetch_json
    cached = get_context(db, order_id, decision_time)
    for kind in ("weather", "holiday"):
        if cached[f"{kind}_status"] == "fresh":
            continue
        if kind == "weather" and (details["latitude"] is None or details["longitude"] is None):
            continue
        url = (weather_url(details["latitude"], details["longitude"], details["target"])
               if kind == "weather" else holiday_url(details["country"], details["local_date"].year))
        response = None
        selected = None
        coverage = (None, None)
        error = None
        status = "failed"
        for _ in range(2):
            try:
                response = fetch(url, timeout=8)
                if kind == "weather":
                    start, end, selected = validate_weather(response, details["target"])
                    coverage = (start, end)
                else:
                    selected = validate_holidays(response, details["country"], details["local_date"])
                    coverage = (f"{details['local_date'].year}-01-01T00:00:00Z",
                                f"{details['local_date'].year}-12-31T23:59:59Z")
                status = "valid"
                break
            except (OSError, ValueError, TypeError, KeyError) as exc:
                error = str(exc)[:500]
                status = "invalid" if response is not None else "failed"
        received_at = now if supplied_now else datetime.now(timezone.utc)
        evidence_id = str(uuid4())
        db.execute("""
            INSERT INTO external_evidence
            (evidence_id, provider, kind, request_scope_json, fetched_at_utc,
             coverage_start_utc, coverage_end_utc, response_json,
             validation_status, error_message)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (evidence_id, "Open-Meteo" if kind == "weather" else "Nager.Date",
              kind, _scope_json(kind, details), _utc_text(received_at), *coverage,
              json.dumps(response) if response is not None else None, status, error))
        if status == "valid" and kind == "weather":
            db.execute("""
                INSERT INTO weather_observation
                (site_id, provider, provider_run_at_utc, valid_at_utc, fetched_at_utc,
                 wind_gust_m_s, precipitation_mm)
                VALUES (?, 'Open-Meteo', NULL, ?, ?, ?, ?)
            """, (details["site_id"], selected["valid_at_utc"], _utc_text(received_at),
                  selected["wind_gust_m_s"], selected["precipitation_mm"]))
        if status == "valid" and kind == "holiday" and selected is not None:
            db.execute("""
                INSERT INTO holiday_observation
                (region_id, local_date, is_holiday, provider, fetched_at_utc)
                SELECT region_id, ?, ?, 'Nager.Date', ? FROM delivery_site WHERE site_id = ?
            """, (details["local_date"].isoformat(), selected, _utc_text(received_at), details["site_id"]))
        db.commit()
    effective = now if supplied_now else datetime.now(timezone.utc)
    result = get_context(db, order_id, effective)
    result["effective_decision_time"] = _utc_text(effective)
    return result
