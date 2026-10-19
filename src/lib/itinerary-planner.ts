import {
  PLACES,
  byId,
  crowdScore,
  level,
  type Place,
} from "./jaipur-data";
import {
  calculateStraightLineDistanceKm,
  formatDistance,
} from "./recommendation";

/* =====================================================================
 * 1. TYPE CONTRACTS (Independent of React components)
 * ===================================================================== */

export type GroupType = "solo" | "couple" | "friends" | "family" | "mixed";
export type CrowdPreference = "avoid" | "balanced" | "don't mind";
export type PacePreference = "relaxed" | "balanced" | "active";

export interface DayPreference {
  dayIndex: number;
  date?: string;
  focusInterests?: string[];
  pace?: PacePreference;
  notes?: string;
}

export interface ItineraryRequest {
  startDateTime: string; // ISO string e.g. "2026-10-18T09:00:00" or "2026-10-18T09:00"
  endDateTime: string;   // ISO string e.g. "2026-10-18T19:00:00" or "2026-10-18T19:00"
  budget?: number;       // In INR
  interests: string[];   // e.g. ["heritage", "photography"]
  groupType?: GroupType | string;
  crowdPreference?: CrowdPreference | string;
  mustVisitPlaceIds?: string[];
  foodPreferences?: string[];
  dietaryRequirements?: string[];
  additionalRequests?: string;
  dayPreferences?: DayPreference[];
  stopReplacements?: Record<string, string>; // hotspotId -> gemId
  pacePreference?: PacePreference | string;
}

export interface ScheduledStop {
  id: string;
  name: string;
  hindiName?: string;
  isFoodStop: boolean;
  dayIndex: number;
  date: string; // YYYY-MM-DD
  startTime: string; // e.g. "09:00 AM"
  endTime: string;   // e.g. "11:00 AM"
  startHour: number;
  endHour: number;
  durationMinutes: number;
  lat?: number;
  lng?: number;
  isMustVisit: boolean;
  isGem: boolean;
  isReplacement: boolean;
  replacedPlaceId?: string;
  replacedPlaceName?: string;
  recommendationReason: string;
  crowdScore: number | null;
  crowdLevel?: "Low" | "Moderate" | "High" | "Critical" | null;
  estimatedCostInr: number | null;
  travelTimeFromPreviousMinutes: number | null;
  travelDistanceFromPreviousKm: number | null;
  transitSummary?: string;
  matchedTags: string[];
}

export type WarningCode =
  | "INVALID_DATE_RANGE"
  | "MUST_VISIT_INFEASIBLE"
  | "TIME_WINDOW_TIGHT"
  | "BUDGET_RESTRICTION_LIMITATION"
  | "DIETARY_VERIFICATION_LIMITATION"
  | "UNINTERPRETED_REQUEST"
  | "MISSING_DATA"
  | "DUPLICATE_AVOIDED";

export interface ScheduleWarning {
  code: WarningCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface DayItinerary {
  dayIndex: number;
  date: string;
  dayOfWeek: string;
  stops: ScheduledStop[];
  totalVisitTimeMinutes: number;
  totalTravelTimeMinutes: number;
  totalEstimatedCostInr: number | null;
  averageCrowdScore: number | null;
}

export interface ItineraryPlan {
  days: DayItinerary[];
  totalStops: number;
  allStops: ScheduledStop[];
  warnings: ScheduleWarning[];
  requestSummary: {
    totalDays: number;
    budget: number | null;
    interests: string[];
    groupType: string;
    crowdPreference: string;
    mustVisitsRequested: string[];
    mustVisitsScheduled: string[];
    replacementsApplied: Record<string, string>;
  };
}

/* =====================================================================
 * 2. REFERENCE METADATA & REASON SYNTHESIZER
 * ===================================================================== */

// Verifiable admission costs (INR standard entry fee for Indian visitors)
const PLACE_ENTRY_COSTS_INR: Record<string, number> = {
  amber: 100,
  nahargarh: 50,
  jalmahal: 0, // Viewing promenade free
  hawa: 50,
  jantar: 50,
  citypalace: 300,
  bapu: 0,
  jaigarh: 100,
  panna: 0,
  jagat_shiromani: 0,
  gatore: 50,
  kanak: 50,
  albert: 100,
  patrika: 0,
  tripolia: 0,
  anokhi: 80,
  sisodia: 50,
  vidyadhar: 50,
  galtaji: 0,
  sanganer: 0,
  jkk: 0,
};

// Recommended duration per destination in minutes
const DURATION_MINUTES: Record<string, number> = {
  amber: 120,
  nahargarh: 105,
  jalmahal: 45,
  hawa: 60,
  jantar: 75,
  citypalace: 120,
  bapu: 90,
  jaigarh: 90,
  panna: 45,
  jagat_shiromani: 45,
  gatore: 60,
  kanak: 60,
  albert: 90,
  patrika: 45,
  tripolia: 75,
  anokhi: 60,
  sisodia: 60,
  vidyadhar: 60,
  galtaji: 75,
  sanganer: 90,
  jkk: 75,
};

// Food recommendations based on food preference IDs
const FOOD_RECOMMENDATIONS: Record<
  string,
  { name: string; note: string; cost: number }
> = {
  thali: {
    name: "Rajasthani Thali Lunch",
    note: "Authentic Dal Baati Churma & Gatte ki Sabzi at Laxmi Misthan Bhandar",
    cost: 450,
  },
  street_food: {
    name: "Jaipur Street Food & Chaat Break",
    note: "Pyaaz kachori, samosa, and golgappas at Masala Chowk",
    cost: 200,
  },
  cafes: {
    name: "Heritage Rooftop Cafe",
    note: "Coffee & light bites with Hawa Mahal views at Wind View Cafe",
    cost: 350,
  },
  sweets_chai: {
    name: "Mithai & Kulhad Chai Break",
    note: "Fresh mawa kachori and spiced kulhad chai at Rawat Misthan Bhandar",
    cost: 150,
  },
  fine_dining: {
    name: "Royal Heritage Dining",
    note: "Traditional Rajput court cuisine at 1135 AD Amber ramparts",
    cost: 1400,
  },
};

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTimeHour(hour24: number): string {
  const h = Math.floor(hour24);
  const m = Math.round((hour24 - h) * 60);
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = m < 10 ? `0${m}` : `${m}`;
  return `${displayH}:${displayM} ${period}`;
}

/* =====================================================================
 * 3. CORE RULE-BASED PLANNING ENGINE
 * ===================================================================== */

/**
 * Deterministic rule-based itinerary planner that schedules Jaipur trips
 * according to dates, times, interests, budget, crowd tolerance, group types,
 * must-visits, and hidden-gem replacements.
 */
export function planItinerary(request: ItineraryRequest): ItineraryPlan {
  const warnings: ScheduleWarning[] = [];

  // 1. Validate date/time range
  const start = new Date(request.startDateTime);
  const end = new Date(request.endDateTime);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
    warnings.push({
      code: "INVALID_DATE_RANGE",
      message: "End date-time must be strictly after start date-time.",
      details: {
        start: request.startDateTime,
        end: request.endDateTime,
      },
    });
    return {
      days: [],
      totalStops: 0,
      allStops: [],
      warnings,
      requestSummary: {
        totalDays: 0,
        budget: request.budget ?? null,
        interests: request.interests ?? [],
        groupType: request.groupType ?? "friends",
        crowdPreference: request.crowdPreference ?? "avoid",
        mustVisitsRequested: request.mustVisitPlaceIds ?? [],
        mustVisitsScheduled: [],
        replacementsApplied: request.stopReplacements ?? {},
      },
    };
  }

  // 2. Multi-day range partitioning
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const startDayTime = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const endDayTime = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  const dayCount = Math.max(1, Math.round((endDayTime - startDayTime) / MS_PER_DAY) + 1);

  // 3. Process must-visits and replacements
  const replacements = request.stopReplacements ?? {};
  const requestedMustVisits = [...(request.mustVisitPlaceIds ?? [])];
  const scheduledMustVisits = new Set<string>();

  // Verify requested must-visits exist in PLACES
  const validMustVisitIds = requestedMustVisits.filter((id) => {
    try {
      byId(id);
      return true;
    } catch {
      warnings.push({
        code: "MISSING_DATA",
        message: `Must-visit destination with id "${id}" was not found in Jaipur places catalog.`,
        details: { id },
      });
      return false;
    }
  });

  // Track global places used across all days to prevent duplicates
  const globalUsedPlaceIds = new Set<string>();

  // 4. Handle text request heuristics (e.g. sunset, photography)
  const additionalText = (request.additionalRequests ?? "").toLowerCase();
  const sunsetRequested = additionalText.includes("sunset") || additionalText.includes("golden hour");
  const sunriseRequested = additionalText.includes("sunrise") || additionalText.includes("early morning");
  const hasUninterpretedNotes =
    Boolean(request.additionalRequests?.trim()) &&
    !sunsetRequested &&
    !sunriseRequested &&
    !additionalText.includes("photo") &&
    !additionalText.includes("senior") &&
    !additionalText.includes("quiet");

  if (hasUninterpretedNotes) {
    warnings.push({
      code: "UNINTERPRETED_REQUEST",
      message: `Additional request "${request.additionalRequests}" recorded for on-trip reference. Manual review advised.`,
    });
  }

  // Dietary check
  if (
    request.dietaryRequirements &&
    request.dietaryRequirements.some((d) => ["jain", "vegan", "halal"].includes(d.toLowerCase()))
  ) {
    warnings.push({
      code: "DIETARY_VERIFICATION_LIMITATION",
      message: "Specialized dietary requirements applied to food recommendations. Please verify kitchen certifications on-site.",
      details: { dietary: request.dietaryRequirements },
    });
  }

  // 5. Build candidate ranking
  const candidatePlaces = PLACES.filter((p) => {
    // If gemsOnly or crowd avoid is active
    return true;
  });

  const scoredCandidates = candidatePlaces.map((place) => {
    // Interest tag match
    const userInterests = request.interests ?? [];
    const matched = place.tags.filter((t) => userInterests.includes(t));
    const tagMatchScore =
      userInterests.length > 0 ? matched.length / userInterests.length : 0.5;

    // Crowd penalty/bonus
    const crowdPref = request.crowdPreference ?? "avoid";
    let crowdScoreModifier = 0;
    if (crowdPref === "avoid") {
      crowdScoreModifier = place.gem ? 0.35 : place.base > 50 ? -0.3 : 0;
    } else if (crowdPref === "balanced") {
      crowdScoreModifier = place.gem ? 0.15 : 0.05;
    } else {
      // "don't mind": iconic places with high base rank well
      crowdScoreModifier = !place.gem ? 0.25 : 0;
    }

    // Group suitability
    const group = request.groupType ?? "friends";
    let groupModifier = 0;
    if (group === "family" && (place.id === "albert" || place.id === "kanak" || place.id === "citypalace")) {
      groupModifier = 0.2;
    } else if (group === "couple" && (place.id === "nahargarh" || place.id === "sisodia" || place.id === "jalmahal")) {
      groupModifier = 0.2;
    } else if (group === "solo" && (place.id === "anokhi" || place.id === "jkk" || place.id === "tripolia")) {
      groupModifier = 0.2;
    } else if (group === "friends" && (place.id === "nahargarh" || place.id === "jaigarh" || place.id === "amber")) {
      groupModifier = 0.2;
    }

    // Budget sensitivity
    const admissionCost = PLACE_ENTRY_COSTS_INR[place.id] ?? 0;
    let budgetModifier = 0;
    if (request.budget !== undefined) {
      if (request.budget <= 1000 && admissionCost > 150) {
        budgetModifier = -0.3;
      } else if (request.budget >= 4000) {
        budgetModifier = 0.1;
      }
    }

    const compositeScore = tagMatchScore * 0.5 + crowdScoreModifier + groupModifier + budgetModifier;

    return {
      place,
      matchedTags: matched,
      score: compositeScore,
    };
  });

  // Sort candidates by score descending
  scoredCandidates.sort((a, b) => b.score - a.score);

  // 6. Generate day-by-day itineraries
  const days: DayItinerary[] = [];
  const allStops: ScheduledStop[] = [];

  for (let dayIndex = 0; dayIndex < dayCount; dayIndex++) {
    const currentDayDate = new Date(startDayTime + dayIndex * MS_PER_DAY);
    const dateStr = currentDayDate.toISOString().split("T")[0] ?? "2026-10-18";
    const dayOfWeek = DAYS_OF_WEEK[currentDayDate.getDay()] ?? "Sun";

    // Determine day start and end hours
    let dayStartHour = 9.0;
    let dayEndHour = 19.0;

    if (dayIndex === 0) {
      const sH = start.getHours() + start.getMinutes() / 60;
      dayStartHour = Math.max(8.0, sH);
    }
    if (dayIndex === dayCount - 1) {
      const eH = end.getHours() + end.getMinutes() / 60;
      dayEndHour = Math.min(21.0, eH);
    }

    const availableHours = dayEndHour - dayStartHour;
    if (availableHours < 2) {
      warnings.push({
        code: "TIME_WINDOW_TIGHT",
        message: `Day ${dayIndex + 1} (${dateStr}) has a very short scheduling window (${availableHours.toFixed(1)} hrs).`,
        details: { dayIndex, availableHours },
      });
    }

    const dayStops: ScheduledStop[] = [];
    let currentHour = dayStartHour;
    let lunchScheduled = false;

    // Helper to add stop
    const schedulePlaceStop = (
      p: Place,
      isMust: boolean,
      reasonNote?: string
    ) => {
      // Check replacement
      let targetPlace = p;
      let isReplaced = false;
      let replacedPlaceId: string | undefined;
      let replacedPlaceName: string | undefined;

      if (replacements[p.id]) {
        try {
          const repId = replacements[p.id]!;
          targetPlace = byId(repId);
          isReplaced = true;
          replacedPlaceId = p.id;
          replacedPlaceName = p.name;
        } catch {
          // ignore invalid replacement id
        }
      }

      // Check duplicates
      if (globalUsedPlaceIds.has(targetPlace.id)) {
        warnings.push({
          code: "DUPLICATE_AVOIDED",
          message: `Omitted duplicate visit to ${targetPlace.name} on ${dateStr}.`,
          details: { placeId: targetPlace.id },
        });
        return;
      }

      const duration = DURATION_MINUTES[targetPlace.id] ?? 75;
      const durationHours = duration / 60;

      // Check if lunch should intervene
      if (!lunchScheduled && currentHour >= 12.5 && currentHour + durationHours > 13.5 && availableHours >= 4) {
        // Schedule lunch first
        scheduleLunchStop();
      }

      // If stop exceeds day end hour, check if we have room
      if (currentHour + durationHours > dayEndHour + 0.25) {
        if (isMust) {
          warnings.push({
            code: "MUST_VISIT_INFEASIBLE",
            message: `Must-visit "${p.name}" could not fit within the scheduled window for Day ${dayIndex + 1}.`,
            details: { placeId: p.id, dayIndex, dayEndHour, currentHour },
          });
        }
        return;
      }

      const startH = currentHour;
      const endH = currentHour + durationHours;

      // Calculate travel from previous stop
      let travelDistanceKm: number | null = null;
      let travelMinutes: number | null = null;
      let transitSummary: string | undefined;

      const previousStop = dayStops[dayStops.length - 1];
      if (previousStop && previousStop.lat !== undefined && previousStop.lng !== undefined) {
        travelDistanceKm = calculateStraightLineDistanceKm(
          previousStop.lat,
          previousStop.lng,
          targetPlace.lat,
          targetPlace.lng
        );
        // Defensible travel time model: ~20 km/h in city traffic + 5 min buffer
        travelMinutes = Math.max(10, Math.round(travelDistanceKm * 3.0 + 5));
        transitSummary = `~${travelMinutes} min (${formatDistance(travelDistanceKm)}) via local auto`;
      }

      // Crowd score at scheduled hour
      const cScoreObj = crowdScore(targetPlace, {
        day: dayOfWeek,
        hour: Math.round(startH),
        festival: false,
        weather: "clear",
      });

      // Reason
      let recReason = reasonNote;
      if (!recReason) {
        if (isReplaced) {
          recReason = `Quieter alternative replacing crowded ${replacedPlaceName}`;
        } else if (isMust) {
          recReason = `Must-visit highlight scheduled at optimal low-crowd time (${targetPlace.best})`;
        } else if (targetPlace.gem) {
          recReason = `Hidden gem featuring ${targetPlace.update.toLowerCase()}`;
        } else {
          recReason = `Matches your interest in ${targetPlace.tags.join(" & ")}`;
        }
      }

      const stop: ScheduledStop = {
        id: targetPlace.id,
        name: targetPlace.name,
        hindiName: targetPlace.hindi,
        isFoodStop: false,
        dayIndex,
        date: dateStr,
        startTime: formatTimeHour(startH),
        endTime: formatTimeHour(endH),
        startHour: Math.round(startH * 100) / 100,
        endHour: Math.round(endH * 100) / 100,
        durationMinutes: duration,
        lat: targetPlace.lat,
        lng: targetPlace.lng,
        isMustVisit: isMust,
        isGem: Boolean(targetPlace.gem),
        isReplacement: isReplaced,
        replacedPlaceId,
        replacedPlaceName,
        recommendationReason: recReason,
        crowdScore: cScoreObj.score,
        crowdLevel: level(cScoreObj.score),
        estimatedCostInr: PLACE_ENTRY_COSTS_INR[targetPlace.id] ?? null,
        travelTimeFromPreviousMinutes: travelMinutes,
        travelDistanceFromPreviousKm: travelDistanceKm ? Math.round(travelDistanceKm * 10) / 10 : null,
        transitSummary,
        matchedTags: targetPlace.tags.filter((t) => (request.interests ?? []).includes(t)),
      };

      dayStops.push(stop);
      globalUsedPlaceIds.add(targetPlace.id);
      if (isMust) {
        scheduledMustVisits.add(p.id);
      }

      // Advance time with a 15-minute inter-stop buffer
      currentHour = endH + (travelMinutes ? travelMinutes / 60 : 0.25);
    };

    const scheduleLunchStop = () => {
      lunchScheduled = true;
      const foodPrefKey = request.foodPreferences?.[0] ?? "thali";
      const rec = FOOD_RECOMMENDATIONS[foodPrefKey] ?? FOOD_RECOMMENDATIONS["thali"]!;

      const startH = Math.max(currentHour, 13.0);
      const endH = startH + 1.0; // 60 mins

      const stop: ScheduledStop = {
        id: "food",
        name: rec.name,
        hindiName: "भोजन",
        isFoodStop: true,
        dayIndex,
        date: dateStr,
        startTime: formatTimeHour(startH),
        endTime: formatTimeHour(endH),
        startHour: Math.round(startH * 100) / 100,
        endHour: Math.round(endH * 100) / 100,
        durationMinutes: 60,
        isMustVisit: false,
        isGem: false,
        isReplacement: false,
        recommendationReason: rec.note,
        crowdScore: 30,
        crowdLevel: "Low",
        estimatedCostInr: rec.cost,
        travelTimeFromPreviousMinutes: 5,
        travelDistanceFromPreviousKm: null,
        transitSummary: "~5 min walk to dining",
        matchedTags: ["food"],
      };

      dayStops.push(stop);
      currentHour = endH + 0.25;
    };

    // A. Priority 1: Schedule must-visits for this day
    for (const mustId of validMustVisitIds) {
      if (!scheduledMustVisits.has(mustId)) {
        try {
          const place = byId(mustId);
          // Check opening compatibility
          schedulePlaceStop(place, true);
        } catch {
          // ignore
        }
      }
    }

    // B. Priority 2: Lunch if between 12:30 and 14:30 and not scheduled yet
    if (!lunchScheduled && currentHour >= 12.0 && currentHour <= 14.5 && availableHours >= 4) {
      scheduleLunchStop();
    }

    // C. Priority 3: Sunset viewpoint heuristic if requested or appropriate
    if (sunsetRequested && currentHour < 18.0 && dayEndHour >= 18.0) {
      const sunsetCandidates = ["nahargarh", "jalmahal", "jaigarh"];
      const sunsetPick = sunsetCandidates.find((id) => !globalUsedPlaceIds.has(id));
      if (sunsetPick) {
        schedulePlaceStop(
          byId(sunsetPick),
          false,
          "Sunset viewpoint scheduled for panoramic golden hour"
        );
      }
    }

    // D. Priority 4: Fill remaining window with top ranked candidates
    for (const scored of scoredCandidates) {
      if (currentHour + 1.2 > dayEndHour) break;
      if (globalUsedPlaceIds.has(scored.place.id)) continue;

      schedulePlaceStop(scored.place, false);
    }

    // Wrap-up Day
    const totalVisit = dayStops.reduce((sum, s) => sum + s.durationMinutes, 0);
    const totalTravel = dayStops.reduce((sum, s) => sum + (s.travelTimeFromPreviousMinutes ?? 0), 0);
    const totalCost = dayStops.reduce((sum, s) => sum + (s.estimatedCostInr ?? 0), 0);
    const nonFoodStops = dayStops.filter((s) => !s.isFoodStop && s.crowdScore !== null);
    const avgCrowd =
      nonFoodStops.length > 0
        ? Math.round(nonFoodStops.reduce((sum, s) => sum + (s.crowdScore ?? 0), 0) / nonFoodStops.length)
        : null;

    days.push({
      dayIndex,
      date: dateStr,
      dayOfWeek,
      stops: dayStops,
      totalVisitTimeMinutes: totalVisit,
      totalTravelTimeMinutes: totalTravel,
      totalEstimatedCostInr: totalCost,
      averageCrowdScore: avgCrowd,
    });

    allStops.push(...dayStops);
  }

  // 7. Check unscheduled must-visits
  for (const mustId of validMustVisitIds) {
    if (!scheduledMustVisits.has(mustId)) {
      const place = byId(mustId);
      warnings.push({
        code: "MUST_VISIT_INFEASIBLE",
        message: `Must-visit attraction "${place.name}" could not be accommodated due to trip duration limits.`,
        details: { placeId: mustId },
      });
    }
  }

  // 8. Total budget audit
  const totalCostAllDays = allStops.reduce((sum, s) => sum + (s.estimatedCostInr ?? 0), 0);
  if (request.budget !== undefined && totalCostAllDays > request.budget) {
    warnings.push({
      code: "BUDGET_RESTRICTION_LIMITATION",
      message: `Estimated itinerary expenses (₹${totalCostAllDays.toLocaleString("en-IN")}) exceed your specified budget of ₹${request.budget.toLocaleString("en-IN")}.`,
      details: {
        budget: request.budget,
        totalCost: totalCostAllDays,
      },
    });
  }

  return {
    days,
    totalStops: allStops.length,
    allStops,
    warnings,
    requestSummary: {
      totalDays: dayCount,
      budget: request.budget ?? null,
      interests: request.interests ?? [],
      groupType: request.groupType ?? "friends",
      crowdPreference: request.crowdPreference ?? "avoid",
      mustVisitsRequested: requestedMustVisits,
      mustVisitsScheduled: Array.from(scheduledMustVisits),
      replacementsApplied: replacements,
    },
  };
}

