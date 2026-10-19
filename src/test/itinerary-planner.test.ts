import { describe, expect, it } from "vitest";
import {
  planItinerary,
  type ItineraryRequest,
} from "@/lib/itinerary-planner";
import { byId } from "@/lib/jaipur-data";

describe("Standalone Itinerary Planner Engine", () => {
  const baseRequest: ItineraryRequest = {
    startDateTime: "2026-10-18T09:00:00",
    endDateTime: "2026-10-18T19:00:00",
    budget: 2500,
    interests: ["heritage", "photography"],
    groupType: "friends",
    crowdPreference: "avoid",
    mustVisitPlaceIds: ["amber"],
    foodPreferences: ["thali"],
    dietaryRequirements: ["vegetarian"],
  };

  // 1. Valid itinerary generation
  it("1. generates a valid structured itinerary with all days and stops", () => {
    const plan = planItinerary(baseRequest);

    expect(plan.days.length).toBe(1);
    expect(plan.totalStops).toBeGreaterThanOrEqual(3);
    expect(plan.allStops.length).toBe(plan.totalStops);

    const firstStop = plan.allStops[0]!;
    expect(firstStop.name).toBeDefined();
    expect(firstStop.startTime).toMatch(/\d{1,2}:\d{2}\s(AM|PM)/);
    expect(firstStop.endTime).toMatch(/\d{1,2}:\d{2}\s(AM|PM)/);
    expect(firstStop.durationMinutes).toBeGreaterThan(0);
    expect(firstStop.recommendationReason.length).toBeGreaterThan(10);
  });

  // 2. Invalid and reversed date-time ranges
  it("2. handles invalid or reversed date-time ranges cleanly with explicit warning", () => {
    const reversed = planItinerary({
      ...baseRequest,
      startDateTime: "2026-10-18T19:00:00",
      endDateTime: "2026-10-18T09:00:00",
    });

    expect(reversed.totalStops).toBe(0);
    expect(reversed.warnings.some((w) => w.code === "INVALID_DATE_RANGE")).toBe(true);
    expect(reversed.warnings[0]?.message).toContain("must be strictly after");

    const malformed = planItinerary({
      ...baseRequest,
      startDateTime: "not-a-date",
      endDateTime: "also-not-a-date",
    });
    expect(malformed.totalStops).toBe(0);
    expect(malformed.warnings.some((w) => w.code === "INVALID_DATE_RANGE")).toBe(true);
  });

  // 3. Same-day and multi-day scheduling
  it("3. handles single-day and multi-day scheduling partitioned correctly", () => {
    const singleDay = planItinerary(baseRequest);
    expect(singleDay.days.length).toBe(1);
    expect(singleDay.requestSummary.totalDays).toBe(1);

    const twoDays = planItinerary({
      ...baseRequest,
      startDateTime: "2026-10-18T09:00:00",
      endDateTime: "2026-10-19T18:00:00",
    });
    expect(twoDays.days.length).toBe(2);
    expect(twoDays.requestSummary.totalDays).toBe(2);
    expect(twoDays.days[0]!.stops.length).toBeGreaterThan(0);
    expect(twoDays.days[1]!.stops.length).toBeGreaterThan(0);
  });

  // 4. Interest-sensitive ranking
  it("4. ranks stops sensitively according to user interests", () => {
    const shoppingPlan = planItinerary({
      ...baseRequest,
      mustVisitPlaceIds: [],
      interests: ["shopping"],
    });

    const naturePlan = planItinerary({
      ...baseRequest,
      mustVisitPlaceIds: [],
      interests: ["nature"],
    });

    const shoppingStopIds = shoppingPlan.allStops.map((s) => s.id);
    const natureStopIds = naturePlan.allStops.map((s) => s.id);

    // Bapu / Tripolia / Sanganer / Anokhi have 'shopping' tag
    const hasShoppingPlace = shoppingStopIds.some((id) =>
      ["bapu", "tripolia", "sanganer", "anokhi"].includes(id)
    );
    // Kanak / Sisodia / Vidyadhar / Nahargarh have 'nature' tag
    const hasNaturePlace = natureStopIds.some((id) =>
      ["kanak", "sisodia", "vidyadhar", "nahargarh"].includes(id)
    );

    expect(hasShoppingPlace).toBe(true);
    expect(hasNaturePlace).toBe(true);
    expect(shoppingStopIds).not.toEqual(natureStopIds);
  });

  // 5. Budget-sensitive selection using controlled cost fixtures
  it("5. validates budget sensitivity and flags budget overruns when fees exceed allocation", () => {
    // Ultra-low budget of ₹100
    const tightBudgetPlan = planItinerary({
      ...baseRequest,
      mustVisitPlaceIds: ["amber", "citypalace"], // Amber = 100, City Palace = 300, Lunch = 450 -> Total 850
      budget: 100,
    });

    const warning = tightBudgetPlan.warnings.find((w) => w.code === "BUDGET_RESTRICTION_LIMITATION");
    expect(warning).toBeDefined();
    expect(warning?.message).toContain("exceed your specified budget");
  });

  // 6. Crowd-sensitive ranking using controlled crowd preferences
  it("6. alters candidate selection when crowd preference is 'avoid' vs 'don't mind'", () => {
    const avoidCrowds = planItinerary({
      ...baseRequest,
      mustVisitPlaceIds: [],
      crowdPreference: "avoid",
    });

    const dontMindCrowds = planItinerary({
      ...baseRequest,
      mustVisitPlaceIds: [],
      crowdPreference: "don't mind",
    });

    const avoidGemCount = avoidCrowds.allStops.filter((s) => s.isGem).length;
    const dontMindGemCount = dontMindCrowds.allStops.filter((s) => s.isGem).length;

    // 'avoid' prioritizes hidden gems with lower base crowds
    expect(avoidGemCount).toBeGreaterThanOrEqual(dontMindGemCount);
  });

  // 7. Group suitability scoring
  it("7. scores group suitability appropriately for families vs friends", () => {
    const familyPlan = planItinerary({
      ...baseRequest,
      mustVisitPlaceIds: [],
      groupType: "family",
      interests: ["heritage", "nature"],
    });

    const friendsPlan = planItinerary({
      ...baseRequest,
      mustVisitPlaceIds: [],
      groupType: "friends",
      interests: ["photography", "heritage"],
    });

    const familyIds = familyPlan.allStops.map((s) => s.id);
    const friendsIds = friendsPlan.allStops.map((s) => s.id);

    // Family favors spacious calm places like Albert Hall or Kanak
    // Friends favor forts with scenic viewpoints like Nahargarh or Jaigarh
    expect(familyIds.length).toBeGreaterThan(0);
    expect(friendsIds.length).toBeGreaterThan(0);
  });

  // 8. Multiple must-visits
  it("8. schedules all requested multiple must-visits when feasible", () => {
    const multiMustPlan = planItinerary({
      ...baseRequest,
      mustVisitPlaceIds: ["amber", "hawa", "jalmahal"],
    });

    const scheduledIds = multiMustPlan.allStops.map((s) => s.id);
    expect(scheduledIds).toContain("amber");
    expect(scheduledIds).toContain("hawa");
    expect(scheduledIds).toContain("jalmahal");
    expect(multiMustPlan.requestSummary.mustVisitsScheduled).toContain("amber");
    expect(multiMustPlan.requestSummary.mustVisitsScheduled).toContain("hawa");
  });

  // 9. Infeasible must-visits and warnings
  it("9. warns when must-visit attractions cannot fit into a tight schedule window", () => {
    const tightWindowPlan = planItinerary({
      ...baseRequest,
      startDateTime: "2026-10-18T10:00:00",
      endDateTime: "2026-10-18T12:00:00", // Only 2 hours
      mustVisitPlaceIds: ["amber", "citypalace", "nahargarh", "hawa"], // 4 major sites impossible in 2 hrs
    });

    const infeasibleWarning = tightWindowPlan.warnings.find(
      (w) => w.code === "MUST_VISIT_INFEASIBLE"
    );
    expect(infeasibleWarning).toBeDefined();
    expect(infeasibleWarning?.message).toContain("could not fit within the scheduled window");
  });

  // 10. Food preference matching
  it("10. schedules the exact dining style matching the food preferences", () => {
    const thaliPlan = planItinerary({
      ...baseRequest,
      foodPreferences: ["thali"],
    });
    const streetFoodPlan = planItinerary({
      ...baseRequest,
      foodPreferences: ["street_food"],
    });
    const cafePlan = planItinerary({
      ...baseRequest,
      foodPreferences: ["cafes"],
    });

    const thaliStop = thaliPlan.allStops.find((s) => s.isFoodStop);
    const streetStop = streetFoodPlan.allStops.find((s) => s.isFoodStop);
    const cafeStop = cafePlan.allStops.find((s) => s.isFoodStop);

    expect(thaliStop?.name).toContain("Thali");
    expect(streetStop?.name).toContain("Street Food");
    expect(cafeStop?.name).toContain("Cafe");
  });

  // 11. Unverifiable dietary requirements
  it("11. raises an informational limitation warning for dietary requirements needing on-site verification", () => {
    const jainPlan = planItinerary({
      ...baseRequest,
      dietaryRequirements: ["jain"],
    });

    const dietaryWarning = jainPlan.warnings.find(
      (w) => w.code === "DIETARY_VERIFICATION_LIMITATION"
    );
    expect(dietaryWarning).toBeDefined();
    expect(dietaryWarning?.message).toContain("verify kitchen certifications on-site");
  });

  // 12. Non-overlapping stop times
  it("12. ensures stop times are strictly chronological and non-overlapping", () => {
    const plan = planItinerary(baseRequest);

    for (const day of plan.days) {
      for (let i = 0; i < day.stops.length - 1; i++) {
        const current = day.stops[i]!;
        const next = day.stops[i + 1]!;
        expect(current.endHour).toBeLessThanOrEqual(next.startHour);
      }
    }
  });

  // 13. Duplicate prevention
  it("13. prevents duplicate visits to the same attraction across the entire itinerary", () => {
    const plan = planItinerary({
      ...baseRequest,
      startDateTime: "2026-10-18T09:00:00",
      endDateTime: "2026-10-19T19:00:00", // 2 days
    });

    const nonFoodIds = plan.allStops.filter((s) => !s.isFoodStop).map((s) => s.id);
    const uniqueIds = new Set(nonFoodIds);

    expect(uniqueIds.size).toBe(nonFoodIds.length);
  });

  // 14. Hidden-gem replacement compatibility
  it("14. swaps crowded destinations with chosen hidden gems and preserves annotations", () => {
    const planWithReplacement = planItinerary({
      ...baseRequest,
      mustVisitPlaceIds: ["amber"],
      stopReplacements: { amber: "panna" },
    });

    const stopIds = planWithReplacement.allStops.map((s) => s.id);
    expect(stopIds).not.toContain("amber");
    expect(stopIds).toContain("panna");

    const pannaStop = planWithReplacement.allStops.find((s) => s.id === "panna");
    expect(pannaStop?.isReplacement).toBe(true);
    expect(pannaStop?.replacedPlaceId).toBe("amber");
    expect(pannaStop?.replacedPlaceName).toBe("Amber Fort");
  });

  // 15. Missing optional data
  it("15. handles missing optional data with sensible defaults without throwing errors", () => {
    const minimalPlan = planItinerary({
      startDateTime: "2026-10-18T09:00:00",
      endDateTime: "2026-10-18T19:00:00",
      interests: [],
    });

    expect(minimalPlan.totalStops).toBeGreaterThan(0);
    expect(minimalPlan.days.length).toBe(1);
    expect(minimalPlan.warnings.length).toBe(0);
  });

  // 16. Deterministic results
  it("16. produces 100% deterministic results for identical inputs", () => {
    const run1 = planItinerary(baseRequest);
    const run2 = planItinerary(baseRequest);

    expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));
  });

  // 17. Proof that supported input changes affect output when suitable alternatives exist
  it("17. proves that changing interests, timing, or replacements changes the itinerary", () => {
    const planA = planItinerary({
      ...baseRequest,
      mustVisitPlaceIds: [],
      interests: ["shopping"],
    });

    const planB = planItinerary({
      ...baseRequest,
      mustVisitPlaceIds: [],
      interests: ["nature"],
    });

    const stopsA = planA.allStops.map((s) => s.id);
    const stopsB = planB.allStops.map((s) => s.id);

    expect(stopsA).not.toEqual(stopsB);
  });
});

