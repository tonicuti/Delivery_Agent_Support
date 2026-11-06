"""Nager.Date public-holiday request and response validation."""

from datetime import date


def holiday_url(country_code: str, year: int) -> str:
    if len(country_code) != 2 or not country_code.isalpha() or not 2000 <= year <= 2100:
        raise ValueError("invalid holiday country or year")
    return f"https://date.nager.at/api/v3/PublicHolidays/{year}/{country_code.upper()}"


def validate_holidays(response: object, country_code: str, local_date: date) -> int | None:
    if not isinstance(response, list):
        raise ValueError("Nager.Date response must be a list")
    matching_local_only = False
    matching_global = False
    for item in response:
        if not isinstance(item, dict) or not isinstance(item.get("date"), str):
            raise ValueError("Nager.Date holiday entry is invalid")
        try:
            day = date.fromisoformat(item["date"])
        except ValueError as exc:
            raise ValueError("Nager.Date holiday date is invalid") from exc
        if day.year != local_date.year:
            raise ValueError("Nager.Date returned an unexpected year")
        if item.get("countryCode", country_code).upper() != country_code.upper():
            raise ValueError("Nager.Date returned another country")
        if not isinstance(item.get("global"), bool):
            raise ValueError("Nager.Date global flag is invalid")
        if day == local_date:
            matching_global |= item["global"]
            matching_local_only |= not item["global"]
    if matching_global:
        return 1
    if matching_local_only:
        return None  # Site subdivision is not yet represented in the schema.
    return 0
