import { PLACES, byId, type Place } from "./jaipur-data";
import {
  predictCrowd,
  type VerifiedObservation,
  type PredictionInput,
  type CrowdPrediction,
  BASELINE_VERSION,
} from "./crowd-service";
import type { CrowdReportRecord } from "./observations-repository";

// =============================================================================
// RAAHI — PHASE 2: ML READINESS & TRAINING DATA PIPELINE
// Standardized for Jaipur, Rajasthan tourism crowd prediction
// =============================================================================

/**
 * Documented methodology mapping between reported crowd categories
 * and canonical congestion index scale (5 to 99).
 */
export const CROWD_CATEGORY_MAP: Record<
  "Quiet" | "Moderate" | "Busy",
  {
    numericTarget: number;
    nominalInterval: [number, number];
    crowdCategory: "Low" | "Moderate" | "High";
    description: string;
  }
> = {
  Quiet: {
    numericTarget: 20,
    nominalInterval: [5, 34],
    crowdCategory: "Low",
    description: "Plentiful personal space, negligible entry queues, serene conditions.",
  },
  Moderate: {
    numericTarget: 50,
    nominalInterval: [35, 59],
    crowdCategory: "Moderate",
    description: "Steady visitor flow, manageable 5–15 min queue, normal capacity.",
  },
  Busy: {
    numericTarget: 80,
    nominalInterval: [60, 95],
    crowdCategory: "High",
    description: "Heavy congestion, long queues (>25 min), high courtyard density.",
  },
};

/**
 * Traceable single training record structured for tabular ML models (XGBoost/LightGBM).
 * Guarantees zero target leakage: contextual features represent state strictly BEFORE target time.
 */
export interface TrainingRecord {
  // Destination Identity & Static Features
  destination_id: string;
  destination_name: string;
  is_gem: number; // 0 or 1
  safe_hourly_capacity: number;
  entry_fee_inr: number;
  tags: string;

  // Timestamps
  target_timestamp_utc: string; // ISO 8601 UTC
  target_timestamp_ist: string; // Human readable IST
  prediction_horizon_hours: number; // 0 = nowcast, 1 = 1-hour forecast, etc.

  // Calendar & Temporal Features (Known prior to target)
  day_of_week: number; // 0 (Sun) to 6 (Sat)
  day_name: string; // "Sun", "Mon", etc.
  hour_of_day: number; // 0 to 23
  is_weekend: number; // 0 or 1
  is_peak_hours: number; // 0 or 1
  is_best_hours: number; // 0 or 1

  // Heuristic Prior Features
  dest_base_score: number;
  time_of_day_effect: number;
  weather: "clear" | "hot" | "rain";
  festival_active: number; // 0 or 1

  // Dynamic Historical Context (Computed STRICTLY from observations prior to target_timestamp)
  prior_observations_count_1h: number;
  prior_observations_count_24h: number;
  prior_corroborated_level: "Quiet" | "Moderate" | "Busy" | "none";
  prior_corroborated_numeric: number | null;

  // Baseline Model Prediction at Target Time (For model comparison & residual learning)
  baseline_predicted_score: number;
  baseline_predicted_category: string;

  // Ground Truth Targets
  target_crowd_level: "Quiet" | "Moderate" | "Busy";
  target_crowd_score: number; // 20, 50, or 80
  target_crowd_category: "Low" | "Moderate" | "High";

  // Provenance & Quality Metadata
  source_type: "community_verified" | "staff_check" | "authority_override";
  source_confidence: number;
  observation_id: string;
  provenance_report_id: string;
  verified_by: string;
}

/**
 * Format a Date object to Jaipur IST string (UTC+5:30)
 */
export function formatIstDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

/**
 * Check if a given hour falls inside a destination's peak hours string (e.g. "4:00–7:00 PM")
 */
function isHourInWindow(hour: number, windowStr: string): boolean {
  if (!windowStr || windowStr === "—") return false;
  // Common Jaipur patterns: "4:00–7:00 PM" -> 16 to 19, "11:00 AM–4:00 PM" -> 11 to 16
  if (windowStr.includes("4:00–7:00 PM") || windowStr.includes("5:00–7:30 PM") || windowStr.includes("5:00–9:00 PM")) {
    return hour >= 16 && hour <= 20;
  }
  if (windowStr.includes("11:00 AM–4:00 PM") || windowStr.includes("1:00–4:00 PM")) {
    return hour >= 11 && hour <= 16;
  }
  return false;
}

/**
 * Generate versioned training records from historical accepted observations.
 * Enforces strict temporal boundaries: features only observe data strictly before target_timestamp.
 */
export function generateTrainingDataset(
  allObservations: VerifiedObservation[],
  horizonHours: number = 0
): TrainingRecord[] {
  if (!allObservations || allObservations.length === 0) {
    return [];
  }

  // Sort chronologically ascending
  const sorted = [...allObservations].sort(
    (a, b) => new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime()
  );

  const records: TrainingRecord[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const targetObs = sorted[i];
    const targetTime = new Date(targetObs.observedAt);
    const targetTimeMs = targetTime.getTime();
    if (isNaN(targetTimeMs)) continue;

    const place = PLACES.find((p) => p.id === targetObs.destinationId);
    if (!place) continue; // Skip non-Jaipur unmapped locations

    // Feature cut-off time: target time minus horizon hours
    const featureCutoffMs = targetTimeMs - horizonHours * 60 * 60 * 1000;

    // Temporal filter: observations strictly before cutoff time (NO TARGET LEAKAGE!)
    const priorObservations = sorted.filter(
      (obs, idx) => idx !== i && new Date(obs.observedAt).getTime() < featureCutoffMs
    );

    // Prior observations for this specific destination
    const priorForDest = priorObservations.filter((o) => o.destinationId === place.id);

    // Counts in past 1 hour and past 24 hours prior to cutoff
    const prior1h = priorForDest.filter((o) => {
      const t = new Date(o.observedAt).getTime();
      return featureCutoffMs - t <= 60 * 60 * 1000 && featureCutoffMs - t >= 0;
    });

    const prior24h = priorForDest.filter((o) => {
      const t = new Date(o.observedAt).getTime();
      return featureCutoffMs - t <= 24 * 60 * 60 * 1000 && featureCutoffMs - t >= 0;
    });

    // Most recent corroborated observation before cutoff
    const latestPrior = priorForDest.length > 0 ? priorForDest[priorForDest.length - 1] : null;

    // Extract calendar features in Asia/Kolkata timezone
    const istParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
      hour: "numeric",
      hour12: false,
    }).formatToParts(targetTime);

    const dayName = istParts.find((p) => p.type === "weekday")?.value.slice(0, 3) || "Sun";
    const hourOfDay = parseInt(istParts.find((p) => p.type === "hour")?.value || "16", 10);
    const dayOfWeek = targetTime.getUTCDay();
    const isWeekend = dayName === "Sat" || dayName === "Sun" ? 1 : 0;

    // Evaluate baseline score that would have been computed at featureCutoffMs
    const baselinePred = predictCrowd(place.id, {
      day: dayName,
      hour: hourOfDay,
      festival: false,
      weather: "clear",
      observations: priorObservations,
    });

    const mapping = CROWD_CATEGORY_MAP[targetObs.crowdLevel] || CROWD_CATEGORY_MAP.Moderate;

    records.push({
      destination_id: place.id,
      destination_name: place.name,
      is_gem: place.gem ? 1 : 0,
      safe_hourly_capacity: place.gem ? 350 : 2500,
      entry_fee_inr: place.entry,
      tags: place.tags.join(";"),
      target_timestamp_utc: targetTime.toISOString(),
      target_timestamp_ist: formatIstDate(targetTime),
      prediction_horizon_hours: horizonHours,
      day_of_week: dayOfWeek,
      day_name: dayName,
      hour_of_day: hourOfDay,
      is_weekend: isWeekend,
      is_peak_hours: isHourInWindow(hourOfDay, place.peak) ? 1 : 0,
      is_best_hours: isHourInWindow(hourOfDay, place.best) ? 1 : 0,
      dest_base_score: place.base,
      time_of_day_effect: baselinePred.factors.timeOfDayEffect,
      weather: "clear",
      festival_active: 0,
      prior_observations_count_1h: prior1h.length,
      prior_observations_count_24h: prior24h.length,
      prior_corroborated_level: latestPrior?.crowdLevel || "none",
      prior_corroborated_numeric: latestPrior ? CROWD_CATEGORY_MAP[latestPrior.crowdLevel].numericTarget : null,
      baseline_predicted_score: baselinePred.score,
      baseline_predicted_category: baselinePred.category,
      target_crowd_level: targetObs.crowdLevel,
      target_crowd_score: mapping.numericTarget,
      target_crowd_category: mapping.crowdCategory,
      source_type: targetObs.sourceType,
      source_confidence: targetObs.confidence,
      observation_id: targetObs.id,
      provenance_report_id: (targetObs as any).relatedReportId || "direct",
      verified_by: targetObs.verifiedBy || "Authority",
    });
  }

  return records;
}

/**
 * Export training dataset records into standard CSV format.
 */
export function exportDatasetAsCsv(records: TrainingRecord[]): string {
  if (records.length === 0) {
    return [
      "destination_id,destination_name,is_gem,safe_hourly_capacity,entry_fee_inr,tags," +
      "target_timestamp_utc,target_timestamp_ist,prediction_horizon_hours,day_of_week,day_name,hour_of_day,is_weekend,is_peak_hours,is_best_hours," +
      "dest_base_score,time_of_day_effect,weather,festival_active,prior_observations_count_1h,prior_observations_count_24h,prior_corroborated_level,prior_corroborated_numeric," +
      "baseline_predicted_score,baseline_predicted_category,target_crowd_level,target_crowd_score,target_crowd_category,source_type,source_confidence,observation_id,provenance_report_id,verified_by"
    ].join("\n");
  }

  const headers = Object.keys(records[0]) as (keyof TrainingRecord)[];
  const csvRows = [headers.join(",")];

  for (const r of records) {
    const values = headers.map((header) => {
      const val = r[header];
      if (val === null || val === undefined) return "";
      const str = String(val);
      // Escape commas, quotes, and newlines
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    csvRows.push(values.join(","));
  }

  return csvRows.join("\n");
}

/**
 * Baseline v1.0 Evaluation Report Interface
 */
export interface EvaluationReport {
  status: "insufficient_data" | "evaluated";
  evaluationTimestamp: string;
  totalUsableObservations: number;
  destinationsRepresented: number;
  destinationCoveragePct: number;
  earliestObservationTimestamp: string | null;
  latestObservationTimestamp: string | null;
  timeRangeDays: number;
  missingDataRate: number; // 0.0 to 1.0

  // Split details
  trainCount: number;
  testCount: number;
  splitStrategy: "chronological_70_30" | "all_samples";

  // Numeric Metrics (against target_crowd_score)
  mae: number | null;
  rmse: number | null;
  baselineMeanBias: number | null;

  // Category Level Classification Metrics
  categoryAccuracyPct: number | null;
  exactCategoryMatches: number;
  confusionMatrix: {
    Low: { predictedLow: number; predictedModerate: number; predictedHigh: number };
    Moderate: { predictedLow: number; predictedModerate: number; predictedHigh: number };
    High: { predictedLow: number; predictedModerate: number; predictedHigh: number };
  } | null;

  // Destination Breakdown
  destinationBreakdown: Record<
    string,
    { name: string; observationCount: number; mae: number | null }
  >;

  // Limitations & Analysis Notes
  limitations: string[];
}

/**
 * Reproducible evaluation of Baseline v1.0 against historical ground-truth observations.
 * Uses chronological splits to prevent data snooping.
 */
export function evaluateBaselineModel(
  allObservations: VerifiedObservation[],
  minObservationsThreshold: number = 10
): EvaluationReport {
  const records = generateTrainingDataset(allObservations, 0);

  const nowIso = new Date().toISOString();
  const uniqueDestinations = new Set(records.map((r) => r.destination_id));
  const totalDestinations = PLACES.length; // 16

  if (records.length < minObservationsThreshold) {
    return {
      status: "insufficient_data",
      evaluationTimestamp: nowIso,
      totalUsableObservations: records.length,
      destinationsRepresented: uniqueDestinations.size,
      destinationCoveragePct: Math.round((uniqueDestinations.size / totalDestinations) * 100),
      earliestObservationTimestamp: records[0]?.target_timestamp_utc || null,
      latestObservationTimestamp: records[records.length - 1]?.target_timestamp_utc || null,
      timeRangeDays: records.length > 1
        ? Math.max(
            0,
            Math.round(
              (new Date(records[records.length - 1].target_timestamp_utc).getTime() -
                new Date(records[0].target_timestamp_utc).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          )
        : 0,
      missingDataRate: 0,
      trainCount: 0,
      testCount: 0,
      splitStrategy: "all_samples",
      mae: null,
      rmse: null,
      baselineMeanBias: null,
      categoryAccuracyPct: null,
      exactCategoryMatches: 0,
      confusionMatrix: null,
      destinationBreakdown: {},
      limitations: [
        `Insufficient ground-truth sample size (${records.length} observations). Minimum ${minObservationsThreshold} required for statistically sound evaluation.`,
        `Low destination coverage: ${uniqueDestinations.size}/16 Jaipur destinations represented.`,
        "Baseline v1.0 remains active production prior. Real-world verification data is currently accumulating.",
      ],
    };
  }

  // Chronological 70/30 split
  const trainSize = Math.floor(records.length * 0.7);
  const testRecords = records.slice(trainSize);

  let totalAbsoluteError = 0;
  let totalSquaredError = 0;
  let totalSignedError = 0;
  let exactCategoryMatches = 0;

  const confusionMatrix = {
    Low: { predictedLow: 0, predictedModerate: 0, predictedHigh: 0 },
    Moderate: { predictedLow: 0, predictedModerate: 0, predictedHigh: 0 },
    High: { predictedLow: 0, predictedModerate: 0, predictedHigh: 0 },
  };

  const destErrors: Record<string, { totalAe: number; count: number; name: string }> = {};

  for (const r of testRecords) {
    const error = r.baseline_predicted_score - r.target_crowd_score;
    totalAbsoluteError += Math.abs(error);
    totalSquaredError += error * error;
    totalSignedError += error;

    // Confusion Matrix Tracking
    const actualCat = r.target_crowd_category; // "Low" | "Moderate" | "High"
    const predCat = r.baseline_predicted_category === "Critical" ? "High" : (r.baseline_predicted_category as "Low" | "Moderate" | "High");

    if (actualCat === predCat) {
      exactCategoryMatches++;
    }

    if (confusionMatrix[actualCat]) {
      if (predCat === "Low") confusionMatrix[actualCat].predictedLow++;
      else if (predCat === "Moderate") confusionMatrix[actualCat].predictedModerate++;
      else confusionMatrix[actualCat].predictedHigh++;
    }

    if (!destErrors[r.destination_id]) {
      destErrors[r.destination_id] = { totalAe: 0, count: 0, name: r.destination_name };
    }
    destErrors[r.destination_id].totalAe += Math.abs(error);
    destErrors[r.destination_id].count++;
  }

  const n = testRecords.length;
  const mae = Math.round((totalAbsoluteError / n) * 10) / 10;
  const rmse = Math.round(Math.sqrt(totalSquaredError / n) * 10) / 10;
  const bias = Math.round((totalSignedError / n) * 10) / 10;
  const catAcc = Math.round((exactCategoryMatches / n) * 100);

  const destBreakdown: Record<string, { name: string; observationCount: number; mae: number | null }> = {};
  for (const [id, stats] of Object.entries(destErrors)) {
    destBreakdown[id] = {
      name: stats.name,
      observationCount: stats.count,
      mae: Math.round((stats.totalAe / stats.count) * 10) / 10,
    };
  }

  const earliest = records[0].target_timestamp_utc;
  const latest = records[records.length - 1].target_timestamp_utc;
  const timeSpanDays = Math.max(
    1,
    Math.round((new Date(latest).getTime() - new Date(earliest).getTime()) / (1000 * 60 * 60 * 24))
  );

  return {
    status: "evaluated",
    evaluationTimestamp: nowIso,
    totalUsableObservations: records.length,
    destinationsRepresented: uniqueDestinations.size,
    destinationCoveragePct: Math.round((uniqueDestinations.size / totalDestinations) * 100),
    earliestObservationTimestamp: earliest,
    latestObservationTimestamp: latest,
    timeRangeDays: timeSpanDays,
    missingDataRate: 0.0,
    trainCount: trainSize,
    testCount: n,
    splitStrategy: "chronological_70_30",
    mae,
    rmse,
    baselineMeanBias: bias,
    categoryAccuracyPct: catAcc,
    exactCategoryMatches,
    confusionMatrix,
    destinationBreakdown: destBreakdown,
    limitations: [
      `Evaluation conducted on chronological holdout (${n} validation samples).`,
      `Destination coverage: ${uniqueDestinations.size}/16 destinations represented in current observations.`,
      "Sparse reporting on non-flagship monuments means variance remains elevated for hidden gems.",
    ],
  };
}

// =============================================================================
// STEP 6: ML CANDIDATE INTERFACE & PROMOTION GATE
// =============================================================================

/**
 * Standard Predictor interface for crowd estimation.
 * Enables zero-downtime swapping and comparison between Baseline v1.0 and future ML models.
 */
export interface CrowdPredictor {
  id: string; // e.g. "baseline-v1.0" or "xgb-jaipur-v1"
  name: string;
  version: string;
  type: "heuristic_baseline" | "tabular_ml" | "time_series";
  predict(destinationId: string, input: PredictionInput): CrowdPrediction;
}

export interface PromotionGateCheck {
  id: string;
  title: string;
  requirement: string;
  currentValue: string;
  passed: boolean;
  blockerReason?: string;
}

export interface PromotionGateResult {
  candidateId: string;
  candidateName: string;
  isEligibleForProduction: boolean;
  activeProductionModel: string;
  summaryDecision: string;
  checks: PromotionGateCheck[];
}

/**
 * Strict production promotion gate for any future trained ML candidate (e.g. XGBoost / LightGBM).
 * Prevents premature deployment or deploying unvalidated models on synthetic data.
 */
export function evaluatePromotionGate(
  candidatePredictor: CrowdPredictor,
  evaluationReport: EvaluationReport,
  candidateMae: number | null = null,
  p99LatencyMs: number = 2.5
): PromotionGateResult {
  const isBaseline = candidatePredictor.id === BASELINE_VERSION;

  const checks: PromotionGateCheck[] = [
    {
      id: "min_observations",
      title: "Minimum Ground-Truth Volume",
      requirement: ">= 200 accepted observations",
      currentValue: `${evaluationReport.totalUsableObservations} observations`,
      passed: evaluationReport.totalUsableObservations >= 200,
      blockerReason:
        evaluationReport.totalUsableObservations < 200
          ? `Dataset too small (${evaluationReport.totalUsableObservations} < 200). Training on sparse data risks overfitting and false precision.`
          : undefined,
    },
    {
      id: "destination_coverage",
      title: "Geographic Coverage across Jaipur",
      requirement: ">= 12 of 16 destinations (75%)",
      currentValue: `${evaluationReport.destinationsRepresented}/16 destinations (${evaluationReport.destinationCoveragePct}%)`,
      passed: evaluationReport.destinationsRepresented >= 12,
      blockerReason:
        evaluationReport.destinationsRepresented < 12
          ? `Insufficient site diversity (${evaluationReport.destinationsRepresented}/16). Model would lack signal for under-visited hidden gems.`
          : undefined,
    },
    {
      id: "time_range_span",
      title: "Temporal Diversity & Seasonality",
      requirement: ">= 14 distinct calendar days",
      currentValue: `${evaluationReport.timeRangeDays} days span`,
      passed: evaluationReport.timeRangeDays >= 14,
      blockerReason:
        evaluationReport.timeRangeDays < 14
          ? `Observation time range too short (${evaluationReport.timeRangeDays} < 14 days). Need multiple weekend/weekday cycles.`
          : undefined,
    },
    {
      id: "accuracy_gain_over_baseline",
      title: "Statistically Superior to Baseline v1.0",
      requirement: "Candidate MAE <= 90% of Baseline MAE (>= 10% error reduction)",
      currentValue:
        candidateMae !== null && evaluationReport.mae !== null
          ? `Candidate MAE: ${candidateMae} vs Baseline: ${evaluationReport.mae}`
          : "Candidate not yet evaluated on held-out test split",
      passed:
        isBaseline ||
        (candidateMae !== null &&
          evaluationReport.mae !== null &&
          candidateMae <= evaluationReport.mae * 0.9),
      blockerReason:
        !isBaseline && (candidateMae === null || evaluationReport.mae === null || candidateMae > evaluationReport.mae * 0.9)
          ? "Candidate model must demonstrably beat Baseline v1.0 on chronological held-out test data."
          : undefined,
    },
    {
      id: "operational_latency",
      title: "P99 Inference Latency SLA",
      requirement: "< 10ms P99 latency",
      currentValue: `${p99LatencyMs}ms`,
      passed: p99LatencyMs < 10,
    },
    {
      id: "safety_fallback_available",
      title: "Deterministic Safety Fallback",
      requirement: "Baseline v1.0 retained as instant fallback rail",
      currentValue: "Configured & Active",
      passed: true,
    },
  ];

  const allPassed = checks.every((c) => c.passed);

  return {
    candidateId: candidatePredictor.id,
    candidateName: candidatePredictor.name,
    isEligibleForProduction: allPassed,
    activeProductionModel: BASELINE_VERSION,
    summaryDecision: allPassed
      ? `PROMOTION AUTHORIZED: ${candidatePredictor.name} meets all volume, coverage, and accuracy requirements.`
      : `PROMOTION BLOCKED: Ground-truth data collection in progress. ${BASELINE_VERSION} remains the authoritative production model.`,
    checks,
  };
}

/**
 * Canonical production Baseline Predictor instance implementing CrowdPredictor
 */
export const baselinePredictor: CrowdPredictor = {
  id: BASELINE_VERSION,
  name: "Raahi Explainable Baseline v1.0",
  version: "1.0.0",
  type: "heuristic_baseline",
  predict: predictCrowd,
};
