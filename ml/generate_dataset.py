"""
Raahi — Synthetic Jaipur Crowd Dataset Generator (v1.0)
=======================================================
Generates 12 simulated months (365 days x 24 hours x 16 destinations = 140,160 records)
of hourly crowd footfall and congestion indices for Jaipur, Rajasthan.

Strictly aligned with:
- src/lib/jaipur-data.ts (16 curated destinations)
- src/lib/crowd-service.ts (thresholds: Low <=34, Moderate 35-59, High 60-79, Critical >=80)
- src/lib/ml-pipeline.ts (zero target leakage feature schema)
- ml/destination_profiles.json (calibrated simulation priors & capacity assumptions)

Zero external dependencies (pure Python standard library).
Reproducible via fixed random seed (seed = 42).
"""

import os
import json
import csv
import math
import random
from datetime import datetime, date, timedelta

# =============================================================================
# CONSTANTS & CONFIGURATION
# =============================================================================

RANDOM_SEED = 42
SIMULATION_YEAR = 2025
DATASET_VERSION = "v1.0"
DATA_SOURCE = "synthetic_simulation"

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "synthetic")
PROFILES_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "destination_profiles.json")

# Category thresholds matching src/lib/crowd-service.ts
THRESHOLDS = {
    "LOW_MAX": 34,
    "MODERATE_MAX": 59,
    "HIGH_MAX": 79,
    "CRITICAL_MIN": 80,
}

# =============================================================================
# JAIPUR 2025 FESTIVALS & GAZETTED HOLIDAYS CALENDAR
# =============================================================================

# Calendar of major festivals with specific Jaipur cultural impact
FESTIVALS_2025 = {
    # Makar Sankranti & International Kite Festival: Massive rooftop gatherings, old city bazaars, Jal Mahal
    "2025-01-14": {"name": "Makar Sankranti / Kite Festival", "intensity": 0.95, "affinity": ["rooftop", "bazaar", "waterfront", "fort"]},
    "2025-01-15": {"name": "Kite Festival Weekend Extension", "intensity": 0.65, "affinity": ["rooftop", "bazaar"]},
    # Jaipur Literature Festival (JLF) Diggi Palace window
    "2025-01-30": {"name": "Jaipur Literature Festival Day 1", "intensity": 0.75, "affinity": ["indoor_museum_gem", "royal_complex", "commercial_bazaar"]},
    "2025-01-31": {"name": "Jaipur Literature Festival Day 2", "intensity": 0.85, "affinity": ["indoor_museum_gem", "royal_complex", "commercial_bazaar"]},
    "2025-02-01": {"name": "Jaipur Literature Festival Day 3", "intensity": 0.90, "affinity": ["indoor_museum_gem", "royal_complex", "commercial_bazaar"]},
    "2025-02-02": {"name": "Jaipur Literature Festival Day 4", "intensity": 0.90, "affinity": ["indoor_museum_gem", "royal_complex", "commercial_bazaar"]},
    "2025-02-03": {"name": "Jaipur Literature Festival Day 5", "intensity": 0.70, "affinity": ["indoor_museum_gem", "royal_complex", "commercial_bazaar"]},
    # Maha Shivratri
    "2025-02-26": {"name": "Maha Shivratri", "intensity": 0.65, "affinity": ["traditional_bazaar_gem"]},
    # Holi & Dhulandi in Jaipur
    "2025-03-13": {"name": "Holika Dahan", "intensity": 0.80, "affinity": ["royal_complex", "commercial_bazaar", "traditional_bazaar_gem"]},
    "2025-03-14": {"name": "Dhulandi (Holi Festival of Colors)", "intensity": 0.95, "affinity": ["royal_complex", "commercial_bazaar", "traditional_bazaar_gem"]},
    # Gangaur Festival (Historic Royal Procession through City Palace & Tripolia Bazaar)
    "2025-04-01": {"name": "Gangaur Festival Day 1", "intensity": 0.90, "affinity": ["royal_complex", "traditional_bazaar_gem", "commercial_bazaar", "urban_monument"]},
    "2025-04-02": {"name": "Gangaur Festival Day 2 (Royal Procession)", "intensity": 0.98, "affinity": ["royal_complex", "traditional_bazaar_gem", "commercial_bazaar", "urban_monument"]},
    # Teej Festival (Monsoon Royal Procession)
    "2025-07-27": {"name": "Teej Festival Day 1", "intensity": 0.88, "affinity": ["royal_complex", "traditional_bazaar_gem", "commercial_bazaar", "tiered_garden_gem"]},
    "2025-07-28": {"name": "Teej Festival Day 2 (Procession)", "intensity": 0.95, "affinity": ["royal_complex", "traditional_bazaar_gem", "commercial_bazaar", "tiered_garden_gem"]},
    # Janmashtami
    "2025-08-16": {"name": "Krishna Janmashtami", "intensity": 0.70, "affinity": ["traditional_bazaar_gem", "royal_complex"]},
    # Navratri & Dussehra
    "2025-10-01": {"name": "Maha Navami", "intensity": 0.75, "affinity": ["commercial_bazaar", "traditional_bazaar_gem", "monument_gem"]},
    "2025-10-02": {"name": "Vijayadashami / Dussehra", "intensity": 0.85, "affinity": ["commercial_bazaar", "traditional_bazaar_gem", "monument_gem"]},
    # Diwali Festivities (Jaipur is world-famous for city-wide illumination & bazaar decorations)
    "2025-10-19": {"name": "Dhanteras", "intensity": 0.85, "affinity": ["commercial_bazaar", "traditional_bazaar_gem", "monument_gem"]},
    "2025-10-20": {"name": "Roop Chaudas / Choti Diwali", "intensity": 0.90, "affinity": ["commercial_bazaar", "traditional_bazaar_gem", "monument_gem", "sunset_fort"]},
    "2025-10-21": {"name": "Diwali (Deepawali)", "intensity": 0.98, "affinity": ["commercial_bazaar", "traditional_bazaar_gem", "monument_gem", "sunset_fort", "promenade_view"]},
    "2025-10-22": {"name": "Govardhan Puja / Annakut", "intensity": 0.88, "affinity": ["commercial_bazaar", "traditional_bazaar_gem", "monument_gem"]},
    "2025-10-23": {"name": "Bhai Dooj", "intensity": 0.80, "affinity": ["commercial_bazaar", "traditional_bazaar_gem"]},
    # Pushkar Fair regional spillover
    "2025-11-04": {"name": "Pushkar Fair Tourism Window", "intensity": 0.75, "affinity": ["flagship_fort", "heritage_fort_gem", "sunset_fort", "royal_complex"]},
    "2025-11-05": {"name": "Pushkar Fair Tourism Window", "intensity": 0.75, "affinity": ["flagship_fort", "heritage_fort_gem", "sunset_fort", "royal_complex"]},
    # Christmas & Year-End Winter Surge (Peak tourist week in Rajasthan)
    "2025-12-24": {"name": "Christmas Eve", "intensity": 0.82, "affinity": ["flagship_fort", "sunset_fort", "promenade_view", "commercial_bazaar"]},
    "2025-12-25": {"name": "Christmas Day", "intensity": 0.92, "affinity": ["flagship_fort", "sunset_fort", "promenade_view", "commercial_bazaar"]},
    "2025-12-26": {"name": "Winter Holiday Peak", "intensity": 0.88, "affinity": ["flagship_fort", "sunset_fort", "promenade_view", "commercial_bazaar"]},
    "2025-12-27": {"name": "Winter Holiday Weekend", "intensity": 0.94, "affinity": ["flagship_fort", "sunset_fort", "promenade_view", "commercial_bazaar"]},
    "2025-12-28": {"name": "Winter Holiday Weekend", "intensity": 0.96, "affinity": ["flagship_fort", "sunset_fort", "promenade_view", "commercial_bazaar"]},
    "2025-12-29": {"name": "Year-End Holiday Surge", "intensity": 0.92, "affinity": ["flagship_fort", "sunset_fort", "promenade_view", "commercial_bazaar"]},
    "2025-12-30": {"name": "Year-End Holiday Surge", "intensity": 0.95, "affinity": ["flagship_fort", "sunset_fort", "promenade_view", "commercial_bazaar"]},
    "2025-12-31": {"name": "New Year's Eve", "intensity": 0.99, "affinity": ["flagship_fort", "sunset_fort", "promenade_view", "commercial_bazaar", "monument_gem"]},
}

# Gazetted public holidays in Rajasthan (2025)
GAZETTED_HOLIDAYS_2025 = {
    "2025-01-01": "New Year's Day",
    "2025-01-14": "Makar Sankranti",
    "2025-01-26": "Republic Day",
    "2025-02-26": "Maha Shivratri",
    "2025-03-14": "Dhulandi / Holi",
    "2025-03-31": "Id-ul-Fitr",
    "2025-04-02": "Gangaur (Local Jaipur Holiday)",
    "2025-04-10": "Mahavir Jayanti",
    "2025-04-14": "Dr. B.R. Ambedkar Jayanti",
    "2025-04-18": "Good Friday",
    "2025-05-12": "Buddha Purnima",
    "2025-06-07": "Id-ul-Zuha (Bakrid)",
    "2025-07-06": "Muharram",
    "2025-07-28": "Teej (Local Jaipur Holiday)",
    "2025-08-15": "Independence Day",
    "2025-08-16": "Janmashtami",
    "2025-09-05": "Barawafat / Eid-e-Milad",
    "2025-10-02": "Mahatma Gandhi Jayanti & Dussehra",
    "2025-10-20": "Deepawali",
    "2025-10-21": "Govardhan Puja",
    "2025-11-05": "Guru Nanak Jayanti",
    "2025-12-25": "Christmas Day",
}

# =============================================================================
# JAIPUR CLIMATE & WEATHER MODELING
# =============================================================================
# Monthly climate baselines for Jaipur (Historical averages: IMD Jaipur station)
# (min_temp, max_temp, base_rain_prob)
JAIPUR_CLIMATE_MONTHS = {
    1:  (8.2, 22.4, 0.04),   # Jan: Chilly mornings, sunny pleasant afternoons, peak tourism
    2:  (11.0, 26.1, 0.05),  # Feb: Pleasant warm days, high tourism
    3:  (16.8, 32.5, 0.04),  # Mar: Warm spring, tourism begins tapering
    4:  (22.9, 38.3, 0.05),  # Apr: Hot afternoons, outdoor monuments quiet midday
    5:  (27.4, 42.6, 0.08),  # May: Peak summer heatwaves (40-45C), morning/indoor visits
    6:  (28.2, 40.5, 0.18),  # Jun: Pre-monsoon humidity & scorching heat
    7:  (25.8, 34.2, 0.52),  # Jul: Monsoon onset, humid, afternoon downpours, scenic spots lush
    8:  (24.7, 32.4, 0.58),  # Aug: Monsoon peak, highest rainfall days
    9:  (23.6, 33.8, 0.26),  # Sep: Receding monsoon, pleasant evenings
    10: (18.8, 33.6, 0.05),  # Oct: Autumn onset, tourist season resumes
    11: (13.2, 29.2, 0.02),  # Nov: Ideal weather, winter peak season begins
    12: (8.9, 24.1, 0.02),   # Dec: Cold nights, crisp sunny days, maximum tourist influx
}

def get_crowd_category(score: int) -> str:
    """Matches getCrowdCategory from src/lib/crowd-service.ts."""
    if score <= THRESHOLDS["LOW_MAX"]:
        return "Low"
    if score <= THRESHOLDS["MODERATE_MAX"]:
        return "Moderate"
    if score <= THRESHOLDS["HIGH_MAX"]:
        return "High"
    return "Critical"

def simulate_day_weather(day_date: date, rng: random.Random) -> dict:
    """Simulates realistic daily weather for Jaipur."""
    month = day_date.month
    t_min, t_max, base_rain_prob = JAIPUR_CLIMATE_MONTHS[month]

    # Inter-day temperature variation (+/- 2.0C)
    day_t_min = t_min + rng.gauss(0, 1.2)
    day_t_max = t_max + rng.gauss(0, 1.5)

    # Determine if it rains on this day
    has_rain = rng.random() < base_rain_prob

    # Pre-generate hourly temperature and conditions
    hourly_weather = []
    for h in range(24):
        # Diurnal temperature cycle: lowest at 06:00, highest at 15:00
        if 6 <= h <= 15:
            # Warming phase
            phase = (h - 6) / 9.0
            temp = day_t_min + (day_t_max - day_t_min) * (math.sin(phase * math.pi / 2) ** 1.6)
        elif 15 < h <= 23:
            # Evening cooling phase
            phase = (h - 15) / 9.0
            temp = day_t_max - (day_t_max - day_t_min) * 0.7 * (phase ** 0.8)
        else:
            # Midnight to dawn cooling
            phase = h / 6.0
            temp = day_t_min + 2.0 * (1.0 - phase)

        # Micro-variation
        temp += rng.gauss(0, 0.3)
        temp = round(temp, 1)

        # Rain probability & condition
        if has_rain:
            # In Jaipur, monsoon rain predominantly occurs between 13:00 and 19:00
            if 13 <= h <= 19:
                rain_prob = min(0.95, max(0.40, round(rng.uniform(0.60, 0.92), 2)))
                condition = "rain" if rng.random() < rain_prob else "overcast"
            elif 10 <= h < 13 or 20 <= h <= 22:
                rain_prob = round(rng.uniform(0.20, 0.45), 2)
                condition = "overcast"
            else:
                rain_prob = round(rng.uniform(0.05, 0.20), 2)
                condition = "clear"
        else:
            rain_prob = round(rng.uniform(0.00, 0.08), 2)
            if temp >= 38.0:
                condition = "hot"
            elif month in (12, 1) and h in (6, 7, 8) and temp <= 11.5:
                condition = "haze"
            else:
                condition = "clear"

        hourly_weather.append({
            "hour": h,
            "temperature": temp,
            "rain_probability": rain_prob,
            "weather_condition": condition
        })

    return {"date": day_date, "has_rain": has_rain, "hourly": hourly_weather}

# =============================================================================
# DATASET GENERATION CORE
# =============================================================================

def generate_synthetic_dataset():
    print(f"[*] Starting Raahi Synthetic Jaipur Crowd Dataset Generation (Version: {DATASET_VERSION})")
    print(f"[*] Target: {SIMULATION_YEAR}-01-01 to {SIMULATION_YEAR}-12-31 (365 days x 24 hours x 16 destinations = 140,160 records)")

    # 1. Initialize deterministic RNG
    rng = random.Random(RANDOM_SEED)

    # 2. Load destination profiles
    if not os.path.exists(PROFILES_PATH):
        raise FileNotFoundError(f"Destination profiles not found at {PROFILES_PATH}")

    with open(PROFILES_PATH, "r", encoding="utf-8") as f:
        profiles_meta = json.load(f)

    destinations = profiles_meta["destinations"]
    dest_map = {d["id"]: d for d in destinations}
    print(f"[*] Loaded {len(destinations)} destination profiles from {PROFILES_PATH}")

    # 3. Pre-simulate daily weather for all 365 days of 2025
    start_date = date(SIMULATION_YEAR, 1, 1)
    end_date = date(SIMULATION_YEAR, 12, 31)
    total_days = (end_date - start_date).days + 1
    assert total_days == 365, f"Expected 365 days in 2025, got {total_days}"

    print(f"[*] Pre-simulating {total_days} days of Jaipur climate data...")
    daily_weather = []
    for day_offset in range(total_days):
        current_day = start_date + timedelta(days=day_offset)
        daily_weather.append(simulate_day_weather(current_day, rng))

    # 4. History buffers for zero target leakage lag calculation
    # dest_id -> list of occupancy_percent values indexed by time_step (0 to 8759)
    occ_history = {d["id"]: [] for d in destinations}

    all_records = []
    category_counts = {"Low": 0, "Moderate": 0, "High": 0, "Critical": 0}

    print(f"[*] Generating records chronologically across all destinations...")

    # Iterate through every hour of the year chronologically
    time_step = 0
    for day_idx, day_weather_info in enumerate(daily_weather):
        current_date = day_weather_info["date"]
        date_str = current_date.isoformat()
        month = current_date.month

        # Calendar features
        # Python weekday: Mon=0 .. Sun=6.
        # src/lib/ml-pipeline.ts day_of_week: Sun=0, Mon=1 .. Sat=6.
        py_weekday = current_date.weekday()
        day_of_week = (py_weekday + 1) % 7 # 0=Sun, 1=Mon, ..., 6=Sat
        is_weekend = 1 if day_of_week in (0, 6) else 0

        # Check holiday and festival
        is_holiday = 1 if date_str in GAZETTED_HOLIDAYS_2025 else 0
        festival_info = FESTIVALS_2025.get(date_str)
        is_festival = 1 if festival_info is not None else 0
        event_intensity = festival_info["intensity"] if festival_info else 0.0

        for h in range(24):
            w = day_weather_info["hourly"][h]
            temp = w["temperature"]
            rain_prob = w["rain_probability"]
            condition = w["weather_condition"]

            # ISO 8601 IST timestamp (+05:30)
            timestamp_str = f"{date_str}T{h:02d}:00:00+05:30"

            # Process all 16 destinations for this hour
            for dest in destinations:
                dest_id = dest["id"]
                dest_archetype = dest.get("archetype", "")
                base_pop = dest["base_popularity"]
                cap_est = dest["capacity_estimate"]
                open_hours = dest["open_hours"]
                night_hours = dest.get("night_tourism")
                peak_hours = dest["peak_hours"]
                best_hours = dest["best_hours"]
                wknd_mult = dest.get("weekend_multiplier", 1.30)
                heat_sens = dest.get("heat_sensitivity", 0.80)
                rain_sens = dest.get("rain_sensitivity", 0.85)

                # Check if open to regular visitors
                is_open = False
                if open_hours[0] <= h < open_hours[1]:
                    is_open = True
                elif night_hours and night_hours[0] <= h < night_hours[1]:
                    is_open = True

                # Compute lag features STRICTLY before current time step (Zero Leakage!)
                if time_step == 0:
                    prev_1h = None
                else:
                    prev_1h = occ_history[dest_id][time_step - 1]

                if time_step < 24:
                    prev_24h = None
                else:
                    prev_24h = occ_history[dest_id][time_step - 24]

                if not is_open:
                    # Destination is closed
                    occupancy = 0.0
                    score = 5
                    category = "Low"
                else:
                    # Destination is open: simulate realistic footfall dynamics

                    # 1. Diurnal hourly effect
                    if peak_hours[0] <= h <= peak_hours[1]:
                        time_effect = rng.uniform(16.0, 24.0)
                    elif best_hours[0] <= h <= best_hours[1]:
                        time_effect = rng.uniform(-2.0, 5.0)
                    elif h == open_hours[0]:
                        time_effect = rng.uniform(-10.0, -5.0)
                    elif h == open_hours[1] - 1 and (not night_hours or h != night_hours[0] - 1):
                        time_effect = rng.uniform(-8.0, -3.0)
                    else:
                        time_effect = rng.uniform(2.0, 10.0)

                    # 2. Weekend effect
                    if is_weekend:
                        weekend_effect = (base_pop * (wknd_mult - 1.0)) + rng.uniform(2.0, 6.0)
                    else:
                        weekend_effect = 0.0

                    # 3. Seasonal tourism effect
                    # Dec/Jan/Feb is peak tourist season in Jaipur (+12 to +20)
                    # Oct/Nov is autumn opening season (+6 to +12)
                    # Jul/Aug is monsoon: lush scenic viewpoints +8 to +14, dusty forts -4
                    # May/Jun is intense summer heat (-10 to -16 for outdoor, +2 for indoor)
                    if month in (12, 1):
                        season_effect = rng.uniform(12.0, 19.0)
                    elif month in (2, 11):
                        season_effect = rng.uniform(8.0, 14.0)
                    elif month in (3, 10):
                        season_effect = rng.uniform(3.0, 7.0)
                    elif month in (7, 8):
                        if rain_sens > 1.0: # scenic lush viewpoints like Nahargarh, Jal Mahal, Kanak Ghati
                            season_effect = rng.uniform(6.0, 12.0)
                        else:
                            season_effect = rng.uniform(-5.0, 2.0)
                    else: # Apr, May, Jun
                        if "museum" in dest_archetype:
                            season_effect = rng.uniform(0.0, 3.0)
                        else:
                            season_effect = rng.uniform(-14.0, -8.0)

                    # 4. Festival / Event effect
                    event_effect = 0.0
                    if is_festival and festival_info:
                        affinities = festival_info.get("affinity", [])
                        is_relevant = any(aff in dest_archetype or aff in dest.get("tags", []) for aff in affinities)
                        base_boost = event_intensity * 22.0
                        event_effect = base_boost * (1.35 if is_relevant else 0.70)
                    elif is_holiday:
                        event_effect = rng.uniform(6.0, 12.0)

                    # 5. Weather sensitivity effect
                    weather_effect = 0.0
                    if condition == "hot" and 11 <= h <= 16:
                        weather_effect = (heat_sens - 1.0) * 25.0 # dampens outdoor visits
                    elif condition == "rain":
                        weather_effect = (rain_sens - 1.0) * 20.0

                    # 6. Overdispersed stochastic fluctuation (bus groups, tour arrivals)
                    noise = rng.gauss(0, 3.2)

                    # Aggregate score
                    raw_score = (
                        base_pop +
                        time_effect +
                        weekend_effect +
                        season_effect +
                        event_effect +
                        weather_effect +
                        noise
                    )
                    score = max(5, min(99, int(round(raw_score))))
                    category = get_crowd_category(score)

                    # Calculate realistic occupancy percentage (calibrated to capacity)
                    # When score is 5 -> occupancy ~0-5%
                    # When score is 50 -> occupancy ~45-55%
                    # When score is 85 -> occupancy ~80-92%
                    # When score is 98 -> occupancy ~95-99%
                    raw_occ = (score / 99.0) * 100.0 * rng.uniform(0.92, 1.04)
                    occupancy = round(max(3.0, min(98.8, raw_occ)), 1)

                # Store occupancy in buffer for future lag computation
                occ_history[dest_id].append(occupancy)
                category_counts[category] += 1

                # Construct record dictionary matching exact schema
                record_id = f"{dest_id}_{current_date.strftime('%Y%m%d')}_{h:02d}"
                record = {
                    "record_id": record_id,
                    "timestamp": timestamp_str,
                    "destination_id": dest_id,
                    "hour": h,
                    "day_of_week": day_of_week,
                    "is_weekend": is_weekend,
                    "month": month,
                    "is_holiday": is_holiday,
                    "is_festival": is_festival,
                    "event_intensity": round(event_intensity, 2),
                    "temperature": temp,
                    "rain_probability": rain_prob,
                    "weather_condition": condition,
                    "capacity_estimate": cap_est,
                    "popularity_factor": base_pop,
                    "previous_hour_occupancy": prev_1h,
                    "previous_day_same_hour": prev_24h,
                    "occupancy_percent": occupancy,
                    "crowd_score": score,
                    "crowd_category": category,
                    "data_source": DATA_SOURCE,
                    "dataset_version": DATASET_VERSION
                }
                all_records.append(record)

            time_step += 1

    total_records = len(all_records)
    expected_records = 365 * 24 * 16
    assert total_records == expected_records, f"Record count mismatch: expected {expected_records}, got {total_records}"
    print(f"[+] Successfully generated {total_records:,} records.")

    # 5. Ensure output directory exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    csv_file = os.path.join(OUTPUT_DIR, "jaipur_crowd_v1.csv")
    json_file = os.path.join(OUTPUT_DIR, "jaipur_crowd_v1.json")
    meta_file = os.path.join(OUTPUT_DIR, "generation_metadata.json")

    # 6. Export CSV
    print(f"[*] Writing CSV dataset to {csv_file}...")
    fieldnames = list(all_records[0].keys())
    with open(csv_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_records)
    csv_bytes = os.path.getsize(csv_file)
    print(f"[+] CSV exported: {csv_bytes / (1024 * 1024):.2f} MB")

    # 7. Export JSON
    print(f"[*] Writing JSON dataset to {json_file}...")
    with open(json_file, "w", encoding="utf-8") as f:
        json.dump(all_records, f, indent=None) # Compact JSON
    json_bytes = os.path.getsize(json_file)
    print(f"[+] JSON exported: {json_bytes / (1024 * 1024):.2f} MB")

    # 8. Compute distribution statistics
    scores = [r["crowd_score"] for r in all_records]
    occupancies = [r["occupancy_percent"] for r in all_records]

    score_mean = sum(scores) / len(scores)
    score_sorted = sorted(scores)
    score_median = score_sorted[len(scores) // 2]
    score_std = math.sqrt(sum((s - score_mean) ** 2 for s in scores) / len(scores))

    occ_mean = sum(occupancies) / len(occupancies)
    occ_sorted = sorted(occupancies)
    occ_median = occ_sorted[len(occupancies) // 2]
    occ_std = math.sqrt(sum((o - occ_mean) ** 2 for o in occupancies) / len(occupancies))

    # 9. Export Metadata
    print(f"[*] Writing generation metadata to {meta_file}...")
    metadata = {
        "dataset_name": "Raahi Jaipur Synthetic Crowd Congestion Dataset",
        "dataset_version": DATASET_VERSION,
        "data_source": DATA_SOURCE,
        "generator_script": "ml/generate_dataset.py",
        "random_seed": RANDOM_SEED,
        "generated_at": datetime.now().isoformat(),
        "temporal_range": {
            "start_date": "2025-01-01",
            "end_date": "2025-12-31",
            "total_days": 365,
            "total_hours_per_day": 24,
            "total_destination_hours": 8760
        },
        "spatial_scope": {
            "city": "Jaipur, Rajasthan",
            "total_destinations": 16,
            "destination_ids": [d["id"] for d in destinations]
        },
        "total_records": total_records,
        "feature_schema": {
            "record_id": {"type": "string", "description": "Deterministic unique record key (e.g. amber_20250101_00)"},
            "timestamp": {"type": "string (ISO 8601)", "description": "Local observation hour in Asia/Kolkata (IST = UTC+5:30)"},
            "destination_id": {"type": "string", "description": "Canonical Jaipur destination identifier"},
            "hour": {"type": "integer [0, 23]", "description": "Hour of day"},
            "day_of_week": {"type": "integer [0, 6]", "description": "Day of week (0=Sunday, 1=Monday ... 6=Saturday)"},
            "is_weekend": {"type": "integer [0, 1]", "description": "1 if Saturday or Sunday, else 0"},
            "month": {"type": "integer [1, 12]", "description": "Month of year"},
            "is_holiday": {"type": "integer [0, 1]", "description": "1 if Rajasthan gazetted public holiday, else 0"},
            "is_festival": {"type": "integer [0, 1]", "description": "1 if major Jaipur cultural festival/event active, else 0"},
            "event_intensity": {"type": "float [0.0, 1.0]", "description": "Calibrated crowd surge multiplier for festivals"},
            "temperature": {"type": "float", "description": "Simulated ambient temperature in Celsius"},
            "rain_probability": {"type": "float [0.0, 1.0]", "description": "Simulated hourly rain probability"},
            "weather_condition": {"type": "string", "description": "Categorical condition: clear, hot, rain, overcast, haze"},
            "capacity_estimate": {"type": "integer", "description": "Assumed safe hourly venue throughput based on monument footprint"},
            "popularity_factor": {"type": "integer [10, 70]", "description": "Heuristic baseline popularity prior"},
            "previous_hour_occupancy": {"type": "float or null", "description": "Occupancy percent at T-1 hour for destination (Strictly zero target leakage)"},
            "previous_day_same_hour": {"type": "float or null", "description": "Occupancy percent at T-24 hours for destination (Strictly zero target leakage)"},
            "occupancy_percent": {"type": "float [0.0, 100.0]", "description": "Venue capacity utilization percentage"},
            "crowd_score": {"type": "integer [5, 99]", "description": "Raahi canonical relative congestion index"},
            "crowd_category": {"type": "string", "description": "Low (<=34), Moderate (35-59), High (60-79), Critical (>=80)"},
            "data_source": {"type": "string", "description": "Constant 'synthetic_simulation'"},
            "dataset_version": {"type": "string", "description": "Constant 'v1.0'"}
        },
        "crowd_category_thresholds": THRESHOLDS,
        "summary_statistics": {
            "category_distribution": {
                k: {
                    "count": v,
                    "percent": round(v / total_records * 100, 2)
                } for k, v in category_counts.items()
            },
            "crowd_score": {
                "min": min(scores),
                "max": max(scores),
                "mean": round(score_mean, 2),
                "median": score_median,
                "std": round(score_std, 2)
            },
            "occupancy_percent": {
                "min": min(occupancies),
                "max": max(occupancies),
                "mean": round(occ_mean, 2),
                "median": occ_median,
                "std": round(occ_std, 2)
            }
        },
        "files_generated": [
            {"filename": "jaipur_crowd_v1.csv", "format": "CSV", "bytes": csv_bytes, "records": total_records},
            {"filename": "jaipur_crowd_v1.json", "format": "JSON", "bytes": json_bytes, "records": total_records},
            {"filename": "generation_metadata.json", "format": "JSON", "bytes": os.path.getsize(meta_file) if os.path.exists(meta_file) else 0}
        ],
        "disclaimer": "This dataset was synthetically generated for ML pipeline prototyping and algorithm benchmarking in the Raahi crowd intelligence platform. Hourly values simulate behavioral trends, opening hours, weather sensitivities, and festival surges. They DO NOT represent verified ground-truth sensor telemetry."
    }

    with open(meta_file, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print(f"[+] Metadata exported: {meta_file}")
    print("\n" + "=" * 60)
    print("RAAHI DATASET GENERATION COMPLETE")
    print("=" * 60)
    print(f"Total Records:      {total_records:,}")
    print(f"Low Category:       {category_counts['Low']:,} ({category_counts['Low']/total_records*100:.1f}%)")
    print(f"Moderate Category:  {category_counts['Moderate']:,} ({category_counts['Moderate']/total_records*100:.1f}%)")
    print(f"High Category:      {category_counts['High']:,} ({category_counts['High']/total_records*100:.1f}%)")
    print(f"Critical Category:  {category_counts['Critical']:,} ({category_counts['Critical']/total_records*100:.1f}%)")
    print(f"Crowd Score Mean:   {score_mean:.1f} (std: {score_std:.1f}, range: [{min(scores)}, {max(scores)}])")
    print(f"Occupancy Mean:     {occ_mean:.1f}% (std: {occ_std:.1f}%, range: [{min(occupancies)}%, {max(occupancies)}%])")
    print("=" * 60)

if __name__ == "__main__":
    generate_synthetic_dataset()
