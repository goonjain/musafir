# Raahi — Jaipur Synthetic Crowd Congestion Dataset (v1.0)

> [!NOTE]
> **Provenance & Operational Classification: Synthetic Benchmark Data**  
> This dataset was generated synthetically to enable reproducible feature engineering, tabular ML training, and algorithm benchmarking for the **Raahi** crowd intelligence platform. It simulates hourly visitation behavior across 16 curated Jaipur destinations for 365 days of 2025.  
> **It does NOT represent verified ground-truth sensor telemetry or official government visitor counts.** In production, Raahi continues to run the verified Baseline v1.0 heuristic engine alongside live community reports.

---

## 1. Dataset Overview

| Specification | Metric / Value |
| :--- | :--- |
| **Dataset Version** | `v1.0` |
| **Data Source** | `synthetic_simulation` |
| **City & Scope** | Jaipur, Rajasthan (Strictly the 16 curated heritage & cultural destinations) |
| **Temporal Range** | `2025-01-01T00:00:00+05:30` to `2025-12-31T23:00:00+05:30` |
| **Temporal Resolution** | Hourly ($24$ records per day per destination) |
| **Total Simulated Days** | $365$ days (Non-leap year 2025) |
| **Total Destinations** | $16$ destinations |
| **Total Records** | **$140,160$ rows** ($365 \times 24 \times 16$) |
| **Random Seed** | `42` (100% reproducible across operating systems) |
| **Zero External Dependencies** | Pure Python standard library (`csv`, `json`, `math`, `random`, `datetime`) |

### Generated Artifacts
- **CSV Data:** `data/synthetic/jaipur_crowd_v1.csv` (~18.91 MB)
- **JSON Data:** `data/synthetic/jaipur_crowd_v1.json` (~74.25 MB)
- **Metadata:** `data/synthetic/generation_metadata.json` (Includes full schemas and distribution statistics)
- **Destination Config:** `ml/destination_profiles.json` (Archetypes, capacities, sensitivities)
- **Generator Script:** `ml/generate_dataset.py`
- **Validation Suite:** `ml/validate_dataset.py`

---

## 2. Spatial Scope: 16 Curated Jaipur Destinations

All destination profiles align with `src/lib/jaipur-data.ts`:

| Destination ID | English Name | Archetype | Safe Hourly Capacity | Opening Hours | Night Tourism |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `amber` | Amber Fort | `flagship_fort` | 2,500 | 08:00–18:00 | 18:00–21:00 |
| `jaigarh` | Jaigarh Fort | `heritage_fort_gem` | 800 | 09:00–17:00 | — |
| `nahargarh` | Nahargarh Fort | `sunset_fort` | 1,800 | 10:00–22:00 | 18:00–22:00 |
| `hawa` | Hawa Mahal | `urban_monument` | 1,600 | 09:00–17:00 | — |
| `citypalace` | City Palace | `royal_complex` | 1,400 | 09:00–18:00 | — |
| `jantar` | Jantar Mantar | `scientific_heritage` | 1,200 | 09:00–17:00 | — |
| `albert` | Albert Hall Museum | `indoor_museum_gem` | 1,000 | 09:00–17:00 | 19:00–22:00 |
| `jalmahal` | Jal Mahal | `promenade_view` | 1,500 | 06:00–23:00 | 19:00–23:00 |
| `patrika` | Patrika Gate | `monument_gem` | 700 | 06:00–22:00 | 19:00–22:00 |
| `bapu` | Bapu Bazaar | `commercial_bazaar` | 3,000 | 10:00–22:00 | 19:00–22:00 |
| `tripolia` | Tripolia Bazaar | `traditional_bazaar_gem` | 1,500 | 10:00–21:00 | 19:00–21:00 |
| `panna` | Panna Meena Kund | `stepwell_gem` | 300 | 06:00–19:00 | — |
| `kanak` | Kanak Ghati | `garden_gem` | 600 | 08:00–18:00 | — |
| `anokhi` | Anokhi Museum | `textile_museum_gem` | 200 | 10:00–17:00 | — |
| `sisodia` | Sisodia Rani Garden | `tiered_garden_gem` | 500 | 08:00–18:00 | — |
| `sanganer` | Sanganer Craft Area | `artisan_hub_gem` | 800 | 10:00–18:00 | — |

---

## 3. Simulation Methodology

### A. Diurnal Curves & Opening Hours
- **Closed Hours:** When a venue is closed to regular visitors (e.g. Amber Fort between 21:00 and 08:00), visitor footfall drops to zero: `occupancy_percent = 0.0%`, `crowd_score = 5` (baseline minimum), `crowd_category = "Low"`.
- **Peak Windows:** Hours identified in `peak_hours` receive a $+16$ to $+24$ congestion impulse (e.g. sunset at Nahargarh Fort, afternoon entry queues at Amber Fort).
- **Optimal Windows:** Recommended visiting windows (`best_hours`) exhibit pleasant, unhurried traffic ($-2$ to $+5$ adjustment).
- **Ramp-up / Ramp-down:** Entry queues gradually form in the first opening hour and dissolve in the final operating hour.

### B. Seasonality & Climate Dynamics
Based on historical India Meteorological Department (IMD) climatological normals for Jaipur:
- **Winter Peak Season (Nov, Dec, Jan, Feb):** Ideal Rajasthan climate (8°C to 25°C). Massive national and international tourist footfall ($+12$ to $+19$ points).
- **Shoulder Months (Mar, Oct):** Moderate pleasant weather ($+3$ to $+8$ points).
- **Extreme Summer (Apr, May, Jun):** Daytime temperatures exceed 40°C–44°C. Open-air hill forts experience severe midday visitor dropoffs ($-10$ to $-16$ points), whereas indoor museums (Albert Hall, Anokhi) remain climate-resilient refuges.
- **Monsoon Dynamics (Jul, Aug):** Heavy rain dampens outdoor walks at heritage forts, but triggers surges at lush viewpoints (Nahargarh sunset terrace, Jal Mahal lakeside promenade, Kanak Ghati).

### C. Jaipur Cultural Calendar & Festival Surges
Simulates specific local cultural surges in 2025:
- **Makar Sankranti / Kite Festival (Jan 14–15):** Intense rooftop and old-city congregating, Nahargarh, Jal Mahal, and Bapu Bazaar.
- **Jaipur Literature Festival (Jan 30 – Feb 3):** Cultural influx benefiting Albert Hall, City Palace, and walled-city bazaars.
- **Holi & Dhulandi (Mar 13–14):** Morning monument closures; evening festival celebrations in the historic centre.
- **Gangaur Festival (Apr 1–2):** Celebrated royal procession through City Palace and Tripolia Bazaar.
- **Teej Festival (Jul 27–28):** Historic monsoon royal procession through the walled city.
- **Diwali Illuminations (Oct 19–23):** Walled-city bazaars (Bapu, Tripolia) and Nahargarh sunset decks hit peak annual congestion.
- **Year-End Surge (Dec 24–31):** Sustained maximum winter holiday congestion across all major monuments.

### D. Zero Target Leakage Lag Formulation
Dynamic historical features are constructed with mathematical temporal isolation:
- `previous_hour_occupancy` represents strictly the venue occupancy at $T - 1$ hour. At $T = 0$ (2025-01-01 00:00 IST), it is set to `null` (empty in CSV).
- `previous_day_same_hour` represents strictly the venue occupancy at $T - 24$ hours. For the initial 24 hours ($T < 24$), it is set to `null` (empty in CSV).
- No future state, concurrent state, or subsequent observation leaks into context features.

---

## 4. Feature Schema

The dataset contains 22 standardized columns:

| Column | Type | Range / Format | Description |
| :--- | :--- | :--- | :--- |
| `record_id` | string | `[dest]_[YYYYMMDD]_[HH]` | Deterministic composite primary key |
| `timestamp` | string | ISO 8601 with IST offset | Local observation hour (`+05:30`) |
| `destination_id` | string | 16 canonical IDs | Destination identifier matching `jaipur-data.ts` |
| `hour` | integer | `0` to `23` | Hour of the day |
| `day_of_week` | integer | `0` to `6` | `0 = Sunday`, `1 = Monday` ... `6 = Saturday` |
| `is_weekend` | integer | `0` or `1` | `1` if Saturday or Sunday |
| `month` | integer | `1` to `12` | Month of year |
| `is_holiday` | integer | `0` or `1` | Rajasthan gazetted public holiday |
| `is_festival` | integer | `0` or `1` | Major Jaipur cultural event active |
| `event_intensity`| float | `0.00` to `1.00` | Surge multiplier for active festival |
| `temperature` | float | `-5.0` to `52.0` °C | Ambient temperature in Celsius |
| `rain_probability` | float | `0.00` to `1.00` | Hourly rain probability |
| `weather_condition` | string | categorical | `clear`, `hot`, `rain`, `overcast`, `haze` |
| `capacity_estimate` | integer | `200` to `3,000` | Assumed safe hourly venue capacity |
| `popularity_factor` | integer | `12` to `62` | Heuristic baseline popularity prior |
| `previous_hour_occupancy` | float / null | `0.0` to `100.0` | Occupancy at $T-1$ (Zero target leakage) |
| `previous_day_same_hour` | float / null | `0.0` to `100.0` | Occupancy at $T-24$ (Zero target leakage) |
| `occupancy_percent` | float | `0.0` to `100.0`% | Capacity utilization percentage |
| `crowd_score` | integer | `5` to `99` | Canonical relative congestion index |
| `crowd_category` | string | categorical | Aligned category: `Low`, `Moderate`, `High`, `Critical` |
| `data_source` | string | constant | `synthetic_simulation` |
| `dataset_version` | string | constant | `v1.0` |

---

## 5. Category Threshold Mapping

Thresholds are strictly synchronized with `src/lib/crowd-service.ts` (`THRESHOLDS`):

| Category | Score Interval | Operational Definition | Dataset Frequency |
| :--- | :--- | :--- | :--- |
| **Low** | $5 \le \text{Score} \le 34$ | Plentiful space, negligible queues, closed hours & serene mornings. | 95,114 (67.9%) |
| **Moderate** | $35 \le \text{Score} \le 59$ | Steady flow, manageable 5–15 min queue, normal operating density. | 23,228 (16.6%) |
| **High** | $60 \le \text{Score} \le 79$ | Heavy congestion, courtyard crowding, 20–35 min queues. Diversion recommended. | 12,664 (9.0%) |
| **Critical** | $80 \le \text{Score} \le 99$ | Near or exceeding capacity, gridlock entry lines, authority throttling active. | 9,154 (6.5%) |

> [!TIP]
> The ~67.9% representation in the **Low** category reflects reality in hourly time-series: historical monuments and bazaars are closed for 10 to 15 hours each night (where score is fixed at 5). During operating daylight hours, the distribution exhibits healthy representation across all four categories.

---

## 6. How to Run & Validate

### Generate the Dataset
```powershell
python ml/generate_dataset.py
```

### Run the Integrity & QA Validation Suite
```powershell
python ml/validate_dataset.py
```

### Verification Checks Performed by the Suite:
1. Exact row count ($140,160$ rows).
2. Schema completeness ($22$ columns).
3. Primary key and composite key uniqueness ($0$ duplicates).
4. Spatial completeness across all $16$ destinations ($8,760$ hours each).
5. Physical & logical bounds on scores ($5–99$), occupancy ($0–100\%$), temperatures, and probabilities.
6. Absolute category threshold consistency ($0$ errors against `src/lib/crowd-service.ts`).
7. Zero target leakage verification ($T-1$ and $T-24$ strictly verified against past states).
8. CSV and JSON parity ($100\%$ matched row-by-row).

---

## 7. Assumptions & Limitations

1. **Synthetic Nature:** All footfall values are generated using behavioral priors, diurnal curve equations, and IMD historical weather baselines. They simulate plausible dynamics but are not derived from physical IoT turnstiles or telecom mobility feeds.
2. **Capacity Estimates:** Venue hourly throughput limits (`capacity_estimate`) are architectural approximations based on monument courtyard area and ticketing window throughput.
3. **Model Integration Warning:** Any ML model trained on this dataset must be labeled as **Experimental** and evaluated offline. It must not overwrite production baseline predictions without user approval.
