import datetime
from typing import Optional
from backend.app.config import settings

CROWD_LEVEL_DELTAS = {
    "Quiet": -15,
    "Moderate": 0,
    "Busy": 15,
    "Packed": 25,
}

def calculate_baseline_forecast(
    base: int,
    is_gem: bool = False,
    day: str = "Sun",
    hour: int = 16,
    festival: bool = False,
    weather: str = "clear"
) -> tuple[int, dict]:
    """
    Computes explainable baseline forecast score and factor breakdown
    identical to the frontend crowd model.
    """
    weekend = 12 if day in ("Sat", "Sun") else 0
    if is_gem:
        peak_hour = 4
    elif 15 <= hour <= 19:
        peak_hour = 18
    elif hour >= 11:
        peak_hour = 8
    else:
        peak_hour = -6

    event = (6 if is_gem else 14) if festival else 0
    if weather == "rain":
        weather_term = -10
    elif weather == "hot" and 12 <= hour <= 16:
        weather_term = -6
    else:
        weather_term = 0

    score = base + weekend + peak_hour + event + weather_term
    clamped_score = max(5, min(99, round(score)))
    
    factors = {
        "historical": base,
        "weekend": weekend,
        "timeOfDay": peak_hour,
        "event": event,
        "weather": weather_term,
    }
    return clamped_score, factors

def get_crowd_level_category(score: int) -> str:
    if score < 35:
        return "Low"
    if score < 60:
        return "Moderate"
    if score < 80:
        return "High"
    return "Critical"

def compute_live_crowd_adjustment(
    reports: list,
    now: Optional[datetime.datetime] = None
) -> tuple[int, int, Optional[int], Optional[int], str]:
    """
    Computes trust-weighted time-decayed crowd adjustment from recent reports.
    
    Returns:
    - adjustment: signed integer shift (-25 to +25)
    - active_report_count: number of reports within stale window
    - max_age_minutes: age of oldest report used (for 'in the last X minutes')
    - min_age_minutes: age of newest report used (for 'updated Y minutes ago')
    - status_label: honest label describing how score was calculated
    """
    if now is None:
        now = datetime.datetime.now(datetime.timezone.utc)

    stale_limit_seconds = settings.STALE_WINDOW_MINUTES * 60

    eligible_reports = []
    for r in reports:
        # Exclude rejected or pending reports
        if getattr(r, "moderation_status", "approved") != "approved":
            continue

        submitted = r.submitted_at
        if submitted.tzinfo is None:
            submitted = submitted.replace(tzinfo=datetime.timezone.utc)

        age_seconds = (now - submitted).total_seconds()
        # Stale window check (2 hours)
        if 0 <= age_seconds <= stale_limit_seconds:
            eligible_reports.append((r, age_seconds))

    if not eligible_reports:
        return 0, 0, None, None, "Estimated"

    total_weighted_shift = 0.0
    total_weight = 0.0
    ages_in_minutes = []

    for r, age_seconds in eligible_reports:
        age_minutes = int(age_seconds / 60)
        ages_in_minutes.append(age_minutes)

        # Linear time decay: 1.0 at 0 min, down to 0.0 at 120 min
        decay = max(0.0, 1.0 - (age_seconds / stale_limit_seconds))
        
        # User/report trust weight
        trust = max(0.2, min(2.0, getattr(r, "trust_weight", 1.0)))
        
        shift = CROWD_LEVEL_DELTAS.get(r.crowd_level, 0)

        weight = decay * trust
        total_weighted_shift += shift * weight
        total_weight += weight

    if total_weight <= 0.001:
        return 0, 0, None, None, "Estimated"

    # Scale factor that grows with number of reports (dampens single anomalous reports)
    # 1 report = 65% influence, 2 reports = 85%, >=3 reports = 100% influence
    count = len(eligible_reports)
    volume_confidence = min(1.0, 0.5 + (count * 0.18))

    raw_adjustment = (total_weighted_shift / total_weight) * volume_confidence
    adjustment = round(raw_adjustment)

    min_age = min(ages_in_minutes)
    max_age = max(ages_in_minutes)
    
    # Honest label per Section 4 of feature document:
    # "Estimated, adjusted by 5 reports in the last 90 minutes, updated 8 minutes ago."
    last_updated_str = "just now" if min_age < 1 else f"{min_age} min ago"
    window_str = f"{max(max_age, 5)} minutes"

    label = f"Estimated, adjusted by {count} report{'s' if count != 1 else ''} in the last {window_str}, updated {last_updated_str}"

    return adjustment, count, max_age, min_age, label
