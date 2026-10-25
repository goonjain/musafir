import { PLACES, byId, type Place, type Level } from "./jaipur-data";

/**
 * Crowd Category classifications.
 * Consistent across Explore, Live Map, Plan Trip, and Admin Command Center.
 */
export type CrowdCategory = Level; // "Low" | "Moderate" | "High" | "Critical"

/**
 * Explicit labeling of the source and methodology behind the score.
 * Never claim an estimated score is an observation or trained ML model.
 */
export type PredictionType = "observed" | "estimated" | "insufficient_data";

export type EvidenceStatus =
  | "verified_recent"    // Verified on-ground observation within past 45 mins
  | "stale_observation"  // Observation exists but is 45-90 mins old
  | "baseline_only"      // Heuristic baseline prior only; no active observations
  | "insufficient_data"; // Destination unmapped or parameters missing

export interface VerifiedObservation {
  id: string;
  destinationId: string;
  crowdLevel: "Quiet" | "Moderate" | "Busy";
  observedAt: string; // ISO timestamp
  sourceType: "community_verified" | "authority_override" | "staff_check";
  confidence: number; // 0.0 - 1.0
  expiresAt: string;  // ISO timestamp (usually observedAt + 90 min)
  verifiedBy?: string;
  tip?: string;
  relatedReportId?: string;
  numericEquivalentScore?: number; // 20 (Quiet), 50 (Moderate), 80 (Busy)
  contextSnapshot?: {
    dayOfWeek: string;
    hourOfDay: number;
    isWeekend: boolean;
    weather?: "clear" | "hot" | "rain";
    festivalActive?: boolean;
    baselinePriorScore?: number;
    clientTimestamp?: string;
  };
}

export interface PredictionInput {
  day?: string;                    // "Mon" - "Sun", defaults to current Jaipur day
  hour?: number;                   // 0 - 23, defaults to current Jaipur hour
  festival?: boolean;              // Festival surge active
  weather?: "clear" | "hot" | "rain";
  observations?: VerifiedObservation[];
  adminOverrideDelta?: number;     // Direct authority throttle offset
}

export interface FactorAttribution {
  historicalBase: number;
  weekendEffect: number;
  timeOfDayEffect: number;
  eventEffect: number;
  weatherEffect: number;
  observationAdjustment: number;
}

export interface CrowdPrediction {
  destinationId: string;
  destinationName: string;
  hindiName: string;
  /**
   * Relative crowd congestion index from 5 to 99.
   * NOTE: This is a relative congestion score, NOT a percentage of venue capacity.
   */
  score: number;
  category: CrowdCategory;
  predictionType: PredictionType;
  modelVersion: string; // "baseline-v1.0"
  forecastTime: {
    day: string;
    hour: number;
    formattedTime: string;
    isWeekend: boolean;
  };
  evidence: {
    status: EvidenceStatus;
    dataFreshnessMinutes: number | null;
    lastObservedTimestamp: string | null;
    activeObservationsCount: number;
    hasAdminOverride: boolean;
  };
  factors: FactorAttribution;
  recommendations: {
    shouldDivert: boolean;
    reason: string;
    suggestedAlternativeId?: string;
    suggestedVisitingWindow: string;
  };
  venueContext: {
    safeHourlyCapacity: number;
    entryFee: number;
    isGem: boolean;
    tags: string[];
  };
}

export const BASELINE_VERSION = "baseline-v1.0";

// Threshold boundaries - strictly standardized across all views
export const THRESHOLDS = {
  LOW_MAX: 34,
  MODERATE_MAX: 59,
  HIGH_MAX: 79,
  CRITICAL_MIN: 80,
} as const;

export function getCrowdCategory(score: number): CrowdCategory {
  if (score <= THRESHOLDS.LOW_MAX) return "Low";
  if (score <= THRESHOLDS.MODERATE_MAX) return "Moderate";
  if (score <= THRESHOLDS.HIGH_MAX) return "High";
  return "Critical";
}

export function formatHour(hour: number): string {
  const h = ((hour + 11) % 12) + 1;
  const ampm = hour < 12 ? "AM" : "PM";
  return `${h}:00 ${ampm}`;
}

export function getCurrentJaipurTime(): { day: string; hour: number } {
  // Asia/Kolkata (IST = UTC+5:30)
  const now = new Date();
  const istFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "numeric",
    hour12: false,
  });
  const parts = istFormatter.formatToParts(now);
  const day = parts.find((p) => p.type === "weekday")?.value.slice(0, 3) || "Sun";
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "16", 10);
  return { day, hour: isNaN(hour) ? 16 : hour };
}

/**
 * Calculate observation pulse adjustment with exponential decay:
 * Active impact = delta * e^(-ageMinutes / 45)
 * Observations > 90 mins old have 0 impact.
 */
export function calculateObservationAdjustment(
  observations: VerifiedObservation[] | undefined,
  destinationId: string,
  targetTimeMs: number
): { adjustment: number; freshestMs: number | null; activeCount: number } {
  if (!observations || observations.length === 0) {
    return { adjustment: 0, freshestMs: null, activeCount: 0 };
  }

  const relevant = observations.filter((o) => o.destinationId === destinationId);
  if (relevant.length === 0) {
    return { adjustment: 0, freshestMs: null, activeCount: 0 };
  }

  let totalDelta = 0;
  let freshestMs: number | null = null;
  let activeCount = 0;

  for (const obs of relevant) {
    const obsTime = new Date(obs.observedAt).getTime();
    if (isNaN(obsTime)) continue;

    const ageMinutes = (targetTimeMs - obsTime) / (60 * 1000);
    // Ignore future observations or observations older than 90 minutes
    if (ageMinutes < -5 || ageMinutes > 90) continue;

    const nonNegativeAge = Math.max(0, ageMinutes);
    const decayFactor = Math.exp(-nonNegativeAge / 45); // Half-life ~31 minutes

    const baseDelta =
      obs.crowdLevel === "Busy"
        ? 18
        : obs.crowdLevel === "Quiet"
        ? -18
        : 0;

    const effectiveDelta = baseDelta * decayFactor * (obs.confidence || 1.0);
    totalDelta += effectiveDelta;
    activeCount += 1;

    if (freshestMs === null || obsTime > freshestMs) {
      freshestMs = obsTime;
    }
  }

  // Bound maximum cumulative pulse adjustment to [-25, +25]
  const clampedAdjustment = Math.max(-25, Math.min(25, Math.round(totalDelta)));
  return { adjustment: clampedAdjustment, freshestMs, activeCount };
}

/**
 * Predict crowd congestion score and explainable attribution for any Jaipur destination.
 * Deterministic for identical inputs.
 */
export function predictCrowd(
  destinationId: string,
  input: PredictionInput = {}
): CrowdPrediction {
  const place = PLACES.find((p) => p.id === destinationId);

  // Safe fallback for unmapped or invalid destinations
  if (!place) {
    const current = getCurrentJaipurTime();
    return {
      destinationId,
      destinationName: "Unknown Destination",
      hindiName: "अज्ञात स्थल",
      score: 50,
      category: "Moderate",
      predictionType: "insufficient_data",
      modelVersion: BASELINE_VERSION,
      forecastTime: {
        day: input.day || current.day,
        hour: input.hour ?? current.hour,
        formattedTime: formatHour(input.hour ?? current.hour),
        isWeekend: (input.day || current.day) === "Sat" || (input.day || current.day) === "Sun",
      },
      evidence: {
        status: "insufficient_data",
        dataFreshnessMinutes: null,
        lastObservedTimestamp: null,
        activeObservationsCount: 0,
        hasAdminOverride: false,
      },
      factors: {
        historicalBase: 50,
        weekendEffect: 0,
        timeOfDayEffect: 0,
        eventEffect: 0,
        weatherEffect: 0,
        observationAdjustment: 0,
      },
      recommendations: {
        shouldDivert: false,
        reason: "Destination details are unavailable in the Jaipur curated registry.",
        suggestedVisitingWindow: "Regular hours",
      },
      venueContext: {
        safeHourlyCapacity: 500,
        entryFee: 0,
        isGem: false,
        tags: [],
      },
    };
  }

  const nowJaipur = getCurrentJaipurTime();
  const day = input.day || nowJaipur.day;
  const hour = input.hour ?? nowJaipur.hour;
  const isWeekend = day === "Sat" || day === "Sun";
  const weather = input.weather || "clear";
  const festival = input.festival || false;

  // 1. Weekend Factor
  const weekendEffect = isWeekend ? 12 : 0;

  // 2. Time-of-day Factor
  // Hidden gems draw fewer peak spikes than flagship monuments
  const timeOfDayEffect = place.gem
    ? 4
    : hour >= 15 && hour <= 19
    ? 18
    : hour >= 11 && hour <= 14
    ? 8
    : -6;

  // 3. Event / Festival Effect
  const eventEffect = festival ? (place.gem ? 6 : 14) : 0;

  // 4. Weather Effect (Dampens open-air fort visits)
  const weatherEffect =
    weather === "rain"
      ? -10
      : weather === "hot" && hour >= 12 && hour <= 16
      ? -6
      : 0;

  // 5. Community Verified Observations & Decay
  const targetTimeMs = Date.now();
  const { adjustment: observationAdjustment, freshestMs, activeCount } =
    calculateObservationAdjustment(input.observations, destinationId, targetTimeMs);

  // 6. Admin Manual Override Delta (if actively applied by authority)
  const adminOverrideDelta = input.adminOverrideDelta || 0;

  // Aggregate Raw Score
  const rawScore =
    place.base +
    weekendEffect +
    timeOfDayEffect +
    eventEffect +
    weatherEffect +
    observationAdjustment +
    adminOverrideDelta;

  const score = Math.max(5, Math.min(99, Math.round(rawScore)));
  const category = getCrowdCategory(score);

  // Evidence Status & Freshness
  let evidenceStatus: EvidenceStatus = "baseline_only";
  let freshnessMinutes: number | null = null;
  let lastObservedIso: string | null = null;
  let predictionType: PredictionType = "estimated";

  if (freshestMs !== null) {
    freshnessMinutes = Math.max(1, Math.round((targetTimeMs - freshestMs) / (60 * 1000)));
    lastObservedIso = new Date(freshestMs).toISOString();

    if (freshnessMinutes <= 45) {
      evidenceStatus = "verified_recent";
      predictionType = "observed";
    } else {
      evidenceStatus = "stale_observation";
      predictionType = "estimated";
    }
  }

  // Recommendations & Diversion Logic
  const shouldDivert = category === "High" || category === "Critical";
  const alternativeId = place.alternatives?.[0];
  let diversionReason = "";

  if (shouldDivert && alternativeId) {
    const altPlace = byId(alternativeId);
    diversionReason = `${place.name} is experiencing ${category.toLowerCase()} congestion. Consider visiting ${altPlace?.name || "nearby gem"} which offers a similar cultural experience with significantly lower crowd pressure.`;
  } else if (shouldDivert) {
    diversionReason = `${place.name} is at peak hours. We recommend visiting during its optimal window (${place.best}).`;
  } else {
    diversionReason = `${place.name} is currently within comfortable visitor thresholds. Ideal time to explore.`;
  }

  // Venue Capacity estimation (approximate historical safe hourly throughput)
  const safeHourlyCapacity = place.gem ? 350 : 2500;

  return {
    destinationId: place.id,
    destinationName: place.name,
    hindiName: place.hindi,
    score,
    category,
    predictionType,
    modelVersion: BASELINE_VERSION,
    forecastTime: {
      day,
      hour,
      formattedTime: formatHour(hour),
      isWeekend,
    },
    evidence: {
      status: evidenceStatus,
      dataFreshnessMinutes: freshnessMinutes,
      lastObservedTimestamp: lastObservedIso,
      activeObservationsCount: activeCount,
      hasAdminOverride: adminOverrideDelta !== 0,
    },
    factors: {
      historicalBase: place.base,
      weekendEffect,
      timeOfDayEffect,
      eventEffect,
      weatherEffect,
      observationAdjustment,
    },
    recommendations: {
      shouldDivert,
      reason: diversionReason,
      suggestedAlternativeId: alternativeId,
      suggestedVisitingWindow: place.best,
    },
    venueContext: {
      safeHourlyCapacity,
      entryFee: place.entry,
      isGem: !!place.gem,
      tags: place.tags,
    },
  };
}

/**
 * Predict crowd congestion across all 16 Jaipur destinations at once.
 */
export function predictAllDestinations(
  input: PredictionInput = {}
): Record<string, CrowdPrediction> {
  const result: Record<string, CrowdPrediction> = {};
  for (const p of PLACES) {
    result[p.id] = predictCrowd(p.id, input);
  }
  return result;
}
