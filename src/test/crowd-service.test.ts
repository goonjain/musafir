import { describe, expect, it } from "vitest";
import {
  predictCrowd,
  predictAllDestinations,
  getCrowdCategory,
  THRESHOLDS,
  BASELINE_VERSION,
  type VerifiedObservation,
} from "../lib/crowd-service";
import { PLACES } from "../lib/jaipur-data";

describe("Raahi Crowd Service (Baseline v1.0)", () => {
  it("computes deterministic crowd scores bounded between 5 and 99", () => {
    for (const place of PLACES) {
      const pred = predictCrowd(place.id, { day: "Sun", hour: 16 });
      expect(pred.score).toBeGreaterThanOrEqual(5);
      expect(pred.score).toBeLessThanOrEqual(99);
      expect(pred.destinationId).toBe(place.id);
      expect(pred.destinationName).toBe(place.name);
      expect(pred.modelVersion).toBe(BASELINE_VERSION);
    }
  });

  it("produces identical predictions for identical inputs (deterministic)", () => {
    const run1 = predictCrowd("amber", { day: "Sun", hour: 16, weather: "clear" });
    const run2 = predictCrowd("amber", { day: "Sun", hour: 16, weather: "clear" });
    expect(run1.score).toBe(run2.score);
    expect(run1.category).toBe(run2.category);
    expect(run1.factors).toEqual(run2.factors);
  });

  it("strictly enforces category threshold boundaries", () => {
    expect(getCrowdCategory(5)).toBe("Low");
    expect(getCrowdCategory(THRESHOLDS.LOW_MAX)).toBe("Low");
    expect(getCrowdCategory(THRESHOLDS.LOW_MAX + 1)).toBe("Moderate");
    expect(getCrowdCategory(THRESHOLDS.MODERATE_MAX)).toBe("Moderate");
    expect(getCrowdCategory(THRESHOLDS.MODERATE_MAX + 1)).toBe("High");
    expect(getCrowdCategory(THRESHOLDS.HIGH_MAX)).toBe("High");
    expect(getCrowdCategory(THRESHOLDS.CRITICAL_MIN)).toBe("Critical");
    expect(getCrowdCategory(99)).toBe("Critical");
  });

  it("incorporates fresh verified observations and marks predictionType as 'observed'", () => {
    const recentObs: VerifiedObservation = {
      id: "obs-test-1",
      destinationId: "amber",
      crowdLevel: "Busy",
      observedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 min ago
      sourceType: "community_verified",
      confidence: 1.0,
      expiresAt: new Date(Date.now() + 80 * 60 * 1000).toISOString(),
    };

    const predWithObs = predictCrowd("amber", {
      day: "Sun",
      hour: 16,
      observations: [recentObs],
    });

    const predWithoutObs = predictCrowd("amber", {
      day: "Sun",
      hour: 16,
      observations: [],
    });

    expect(predWithObs.score).toBeGreaterThan(predWithoutObs.score);
    expect(predWithObs.predictionType).toBe("observed");
    expect(predWithObs.evidence.status).toBe("verified_recent");
    expect(predWithObs.evidence.dataFreshnessMinutes).toBeLessThanOrEqual(15);
  });

  it("decays and ignores observations older than 90 minutes", () => {
    const expiredObs: VerifiedObservation = {
      id: "obs-expired",
      destinationId: "amber",
      crowdLevel: "Busy",
      observedAt: new Date(Date.now() - 95 * 60 * 1000).toISOString(), // 95 min ago
      sourceType: "community_verified",
      confidence: 1.0,
      expiresAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    };

    const pred = predictCrowd("amber", {
      day: "Sun",
      hour: 16,
      observations: [expiredObs],
    });

    expect(pred.factors.observationAdjustment).toBe(0);
    expect(pred.predictionType).toBe("estimated");
    expect(pred.evidence.status).toBe("baseline_only");
  });

  it("handles invalid or unmapped destination gracefully without throwing", () => {
    const pred = predictCrowd("invalid-place-id", { day: "Sun", hour: 14 });
    expect(pred.destinationId).toBe("invalid-place-id");
    expect(pred.score).toBe(50);
    expect(pred.predictionType).toBe("insufficient_data");
    expect(pred.evidence.status).toBe("insufficient_data");
  });

  it("applies admin manual overrides deterministically", () => {
    const baseline = predictCrowd("nahargarh", { day: "Mon", hour: 10 });
    const boosted = predictCrowd("nahargarh", { day: "Mon", hour: 10, adminOverrideDelta: 15 });
    const throttled = predictCrowd("nahargarh", { day: "Mon", hour: 10, adminOverrideDelta: -10 });

    expect(boosted.score).toBeGreaterThan(baseline.score);
    expect(throttled.score).toBeLessThan(baseline.score);
    expect(boosted.evidence.hasAdminOverride).toBe(true);
  });

  it("predicts crowd across all 16 destinations in bulk", () => {
    const all = predictAllDestinations({ day: "Sun", hour: 17 });
    expect(Object.keys(all).length).toBe(16);
    expect(all["amber"].score).toBeDefined();
    expect(all["panna"].score).toBeDefined();
  });
});
