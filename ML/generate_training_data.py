"""Generate reproducible, time-aware synthetic delivery-risk training data."""

import argparse
import csv
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo


STOCKHOLM = ZoneInfo("Europe/Stockholm")
REGIONS = {"Stockholm": (2.0, 0.28), "Uppsala": (3.0, 0.22), "Sodermanland": (3.8, 0.20), "Ostergotland": (4.7, 0.18)}
STAGES = ("pick_started", "packed", "loaded", "departed")


def utc_text(value):
    return value.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def write_csv(path, rows, columns):
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)


def generate_dataset(output_dir, order_count=2400, seed=42):
    """Write snapshots, source events, and independently simulated outcomes."""
    if order_count < 20:
        raise ValueError("order_count must be at least 20 for all three splits")

    output_dir.mkdir(parents=True, exist_ok=True)
    rng = random.Random(seed)
    snapshots = []
    source_events = []
    outcomes = []
    start_day = datetime(2026, 1, 5, tzinfo=STOCKHOLM)

    for index in range(order_count):
        order_id = f"SYN-{index + 1:06d}"
        delivery_day = start_day + timedelta(days=index // 40)
        deadline = delivery_day.replace(hour=16, minute=0)
        shift_start = delivery_day.replace(hour=8, minute=0)
        region = rng.choice(tuple(REGIONS))
        base_travel_hours, region_delay_chance = REGIONS[region]
        carrier = rng.choice(("North", "East", "Regional"))
        warehouse = rng.choice(("Stockholm", "Norrkoping"))
        customer_type = rng.choice(("B2B", "B2C"))
        stock_status = rng.choices(("in_stock", "short", "backorder"), weights=(78, 15, 7))[0]
        weather_severity = rng.choices((0, 1, 2), weights=(66, 26, 8))[0]
        holiday_flag = int(rng.random() < 0.05)
        special_handling = int(rng.random() < 0.14)
        item_count = rng.randint(1, 4)
        item_quantity = rng.randint(item_count, item_count * 18)
        weight_kg = round(item_quantity * rng.uniform(4, 16), 1)
        volume_m3 = round(weight_kg / rng.uniform(190, 400), 3)
        travel_hours = base_travel_hours + rng.uniform(-0.4, 0.4)
        planned_margin_hours = rng.uniform(0.3, 2.8)
        planned_departure = deadline - timedelta(hours=travel_hours + planned_margin_hours)

        stock_delay = {"in_stock": 0, "short": rng.uniform(0.2, 1.4), "backorder": rng.uniform(1.1, 3.4)}[stock_status]
        handling_delay = rng.uniform(0.1, 0.7) if special_handling else 0
        departure_delay = max(0, rng.gauss(0.25, 0.55)) + stock_delay + handling_delay
        actual_departure = planned_departure + timedelta(hours=departure_delay)
        route_delay = max(0, rng.gauss(0.05, 0.45))
        route_delay += weather_severity * rng.uniform(0.2, 0.8)
        route_delay += holiday_flag * rng.uniform(0.2, 0.8)
        route_delay += rng.uniform(0.3, 1.1) if rng.random() < region_delay_chance else 0
        original_arrival = actual_departure + timedelta(hours=travel_hours + route_delay)
        late = int(original_arrival > deadline)
        split = "train" if index < order_count * 0.7 else "validation" if index < order_count * 0.85 else "test"

        order_events = []
        for stage, occurred_at in (
            ("pick_started", actual_departure - timedelta(hours=2.5)),
            ("packed", actual_departure - timedelta(hours=1.25)),
            ("loaded", actual_departure - timedelta(minutes=25)),
            ("departed", actual_departure),
        ):
            recorded_at = occurred_at + timedelta(minutes=rng.randint(0, 35))
            order_events.append({"order_id": order_id, "event_type": stage,
                                 "occurred_at_utc": utc_text(occurred_at),
                                 "recorded_at_utc": utc_text(recorded_at), "value": "1"})

        eta_recorded = actual_departure + timedelta(minutes=rng.randint(8, 35))
        first_eta = original_arrival + timedelta(minutes=rng.randint(-50, 50))
        order_events.append({"order_id": order_id, "event_type": "eta_update",
                             "occurred_at_utc": utc_text(actual_departure),
                             "recorded_at_utc": utc_text(eta_recorded), "value": utc_text(first_eta)})
        if original_arrival > deadline.replace(hour=12, minute=30):
            second_recorded = deadline.replace(hour=12, minute=30) + timedelta(minutes=rng.randint(0, 30))
            second_eta = original_arrival + timedelta(minutes=rng.randint(-20, 20))
            order_events.append({"order_id": order_id, "event_type": "eta_update",
                                 "occurred_at_utc": utc_text(second_recorded - timedelta(minutes=5)),
                                 "recorded_at_utc": utc_text(second_recorded), "value": utc_text(second_eta)})
        order_events.sort(key=lambda event: event["recorded_at_utc"])
        source_events.extend(order_events)

        candidate_times = {shift_start, deadline.replace(hour=11),
                           deadline.replace(hour=13), deadline.replace(hour=14, minute=30)}
        candidate_times.update(datetime.fromisoformat(event["recorded_at_utc"].replace("Z", "+00:00"))
                               for event in order_events)
        valid_times = sorted(time for time in candidate_times
                             if shift_start <= time < min(deadline, original_arrival))

        for scored_at in valid_times:
            scored_utc = utc_text(scored_at)
            visible = [event for event in order_events if event["recorded_at_utc"] <= scored_utc]
            visible_stages = [event["event_type"] for event in visible if event["event_type"] in STAGES]
            stage = visible_stages[-1] if visible_stages else "waiting"
            eta_updates = [event for event in visible if event["event_type"] == "eta_update"]
            current_eta = eta_updates[-1]["value"] if eta_updates else ""
            visible_departure = next((event for event in visible if event["event_type"] == "departed"), None)
            departure_delay_minutes = (round((actual_departure - planned_departure).total_seconds() / 60)
                                       if visible_departure else "")
            eta_delay_minutes = (round((datetime.fromisoformat(current_eta.replace("Z", "+00:00")) -
                                        (planned_departure + timedelta(hours=travel_hours))).total_seconds() / 60)
                                 if current_eta else "")
            snapshots.append({
                "snapshot_id": f"{order_id}-{len(snapshots):07d}", "order_id": order_id,
                "split": split, "scored_at_utc": scored_utc, "promise_version": "v1",
                "promised_to_utc": utc_text(deadline),
                "hours_to_deadline": round((deadline - scored_at).total_seconds() / 3600, 2),
                "customer_type": customer_type, "item_count": item_count,
                "item_quantity": item_quantity, "weight_kg": weight_kg,
                "volume_m3": volume_m3, "special_handling": special_handling,
                "stock_status": stock_status, "warehouse_stage": stage,
                "planned_departure_at_utc": utc_text(planned_departure),
                "actual_departure_delay_minutes": departure_delay_minutes,
                "planned_eta_at_utc": utc_text(planned_departure + timedelta(hours=travel_hours)),
                "current_eta_at_utc": current_eta, "eta_delay_minutes": eta_delay_minutes,
                "travel_hours": round(travel_hours, 2), "region": region,
                "warehouse": warehouse, "carrier": carrier, "weather_severity": weather_severity,
                "holiday_flag": holiday_flag, "original_late": late,
            })

        outcomes.append({"order_id": order_id, "promise_version": "v1",
                         "promised_to_utc": utc_text(deadline),
                         "original_arrival_at_utc": utc_text(original_arrival), "original_late": late,
                         "split": split})

    write_csv(output_dir / "training_snapshots.csv", snapshots, list(snapshots[0]))
    write_csv(output_dir / "source_events.csv", source_events, list(source_events[0]))
    write_csv(output_dir / "order_outcomes.csv", outcomes, list(outcomes[0]))
    return len(snapshots), sum(row["original_late"] for row in outcomes)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=Path(__file__).parent / "synthetic_delivery_data")
    parser.add_argument("--orders", type=int, default=2400)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    count, late_count = generate_dataset(args.output_dir, args.orders, args.seed)
    print(f"Wrote {count} snapshots for {args.orders} orders ({late_count} late) to {args.output_dir}")
