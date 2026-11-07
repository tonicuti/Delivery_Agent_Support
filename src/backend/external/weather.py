"""Open-Meteo forecast request and response validation."""

from datetime import datetime, timezone
import math
from urllib.parse import urlencode


WEATHER_MAPPING_VERSION = "demo-weather-v1"


def classify_weather(precipitation_mm: float, wind_gust_m_s: float) -> int:
    """Demo severity for the delivery hour, uncalibrated to model training labels."""
    if (not all(isinstance(value, (int, float)) and math.isfinite(value) and value >= 0
                for value in (precipitation_mm, wind_gust_m_s))):
        raise ValueError("weather measurements must be finite and nonnegative")
    if precipitation_mm >= 15 or wind_gust_m_s >= 20:
        return 2
    if precipitation_mm >= 5 or wind_gust_m_s >= 10:
        return 1
    return 0


def weather_url(latitude: float, longitude: float, target: datetime) -> str:
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        raise ValueError("invalid destination coordinates")
    day = target.astimezone(timezone.utc).date().isoformat()
    params = {
        "latitude": latitude, "longitude": longitude,
        "hourly": "temperature_2m,precipitation,wind_gusts_10m,weather_code",
        "timezone": "UTC", "wind_speed_unit": "ms",
        "start_date": day, "end_date": day,
    }
    return "https://api.open-meteo.com/v1/forecast?" + urlencode(params)


def validate_weather(response: object, target: datetime) -> tuple[str, str, dict]:
    if not isinstance(response, dict) or not isinstance(response.get("hourly"), dict):
        raise ValueError("Open-Meteo response has no hourly forecast")
    hourly = response["hourly"]
    units = response.get("hourly_units")
    if not isinstance(units, dict) or units.get("precipitation") != "mm" or units.get("wind_gusts_10m") != "m/s":
        raise ValueError("Open-Meteo response has unexpected units")
    columns = [hourly.get(name) for name in ("time", "precipitation", "wind_gusts_10m", "weather_code")]
    if not all(isinstance(column, list) for column in columns) or not columns[0]:
        raise ValueError("Open-Meteo hourly fields are missing")
    if len({len(column) for column in columns}) != 1:
        raise ValueError("Open-Meteo hourly fields have different lengths")
    times = []
    for raw in columns[0]:
        if not isinstance(raw, str):
            raise ValueError("Open-Meteo time is invalid")
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        times.append(parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed.astimezone(timezone.utc))
    if times != sorted(times) or len(times) != len(set(times)):
        raise ValueError("Open-Meteo forecast times are unordered")
    hour = target.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)
    if hour not in times:
        raise ValueError("Open-Meteo forecast does not cover delivery hour")
    index = times.index(hour)
    rain, gust, code = (column[index] for column in columns[1:])
    if (not isinstance(rain, (int, float)) or not math.isfinite(rain) or rain < 0
            or not isinstance(gust, (int, float)) or not math.isfinite(gust) or gust < 0
            or not isinstance(code, int) or not 0 <= code <= 99):
        raise ValueError("Open-Meteo forecast values are invalid")
    iso = lambda value: value.isoformat(timespec="seconds").replace("+00:00", "Z")
    return iso(times[0]), iso(times[-1]), {"precipitation_mm": rain, "wind_gust_m_s": gust,
                                            "weather_code": code, "valid_at_utc": iso(hour)}
