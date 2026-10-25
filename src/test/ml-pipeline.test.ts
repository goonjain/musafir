import { describe, expect, it } from "vitest";
import {
  generateTrainingDataset,
  exportDatasetAsCsv,
  evaluateBaselineModel,
  evaluatePromotionGate,
  baselinePredictor,
  CROWD_CATEGORY_MAP,
  type TrainingRecord,
} from "../lib/ml-pipeline";
import { ObservationsRepository } from "../lib/observations-repository";
import type { VerifiedObservation } from "../lib/crowd-service";
import { PLACES } from "../lib/jaipur-data";

describe("Raahi ML Pipeline & Training Data Generation", () => {
  it("enforces canonical category mapping to numeric scores without distortion", () => {
    expect(CROWD_CATEGORY_MAP.Quiet.numericTarget).toBe(20);
    expect(CROWD_CATEGORY_MAP.Quiet.crowdCategory).toBe("Low");

    expect(CROWD_CATEGORY_MAP.Moderate.numericTarget).toBe(50);
    expect(CROWD_CATEGORY_MAP.Moderate.crowdCategory).toBe("Moderate");

    expect(CROWD_CATEGORY_MAP.Busy.numericTarget).toBe(80);
    expect(CROWD_CATEGORY_MAP.Busy.crowdCategory).toBe("High");
  });

  it("extracts leak-free training records with strict temporal boundaries", () => {
    const baseTime = Date.now();

    // 3 chronological observations for Amber Fort
    const sampleObs: VerifiedObservation[] = [
      {
        id: "obs-t1",
        destinationId: "amber",
        crowdLevel: "Quiet",
        observedAt: new Date(baseTime - 120 * 60 * 1000).toISOString(), // 2h ago
        sourceType: "community_verified",
        confidence: 0.9,
        expiresAt: new Date(baseTime - 30 * 60 * 1000).toISOString(),
        verifiedBy: "Inspector Verma",
      },
      {
        id: "obs-t2",
        destinationId: "amber",
        crowdLevel: "Moderate",
        observedAt: new Date(baseTime - 45 * 60 * 1000).toISOString(), // 45m ago
        sourceType: "staff_check",
        confidence: 1.0,
        expiresAt: new Date(baseTime + 45 * 60 * 1000).toISOString(),
        verifiedBy: "Officer Sharma",
      },
      {
        id: "obs-t3",
        destinationId: "amber",
        crowdLevel: "Busy",
        observedAt: new Date(baseTime).toISOString(), // now
        sourceType: "authority_override",
        confidence: 0.95,
        expiresAt: new Date(baseTime + 90 * 60 * 1000).toISOString(),
        verifiedBy: "DoT Control",
      },
    ];

    const dataset = generateTrainingDataset(sampleObs, 0);
    expect(dataset.length).toBe(3);

    // Record 1 (t1): Must have 0 prior observations (first in time)
    expect(dataset[0].destination_id).toBe("amber");
    expect(dataset[0].target_crowd_level).toBe("Quiet");
    expect(dataset[0].target_crowd_score).toBe(20);
    expect(dataset[0].prior_observations_count_1h).toBe(0);
    expect(dataset[0].prior_corroborated_level).toBe("none");

    // Record 2 (t2): Must see only t1 (1 prior observation)
    expect(dataset[1].target_crowd_level).toBe("Moderate");
    expect(dataset[1].target_crowd_score).toBe(50);
    expect(dataset[1].prior_observations_count_24h).toBe(1);
    expect(dataset[1].prior_corroborated_level).toBe("Quiet");

    // Record 3 (t3): Must see t1 and t2 (t2 was 45m ago, so prior_1h == 1)
    expect(dataset[2].target_crowd_level).toBe("Busy");
    expect(dataset[2].target_crowd_score).toBe(80);
    expect(dataset[2].prior_observations_count_1h).toBe(1);
    expect(dataset[2].prior_observations_count_24h).toBe(2);
    expect(dataset[2].prior_corroborated_level).toBe("Moderate");

    // Traceability checks
    expect(dataset[2].source_type).toBe("authority_override");
    expect(dataset[2].source_confidence).toBe(0.95);
    expect(dataset[2].observation_id).toBe("obs-t3");
  });

  it("exports valid, reproducible CSV with properly escaped headers and values", () => {
    const sampleObs: VerifiedObservation[] = [
      {
        id: "obs-panna-1",
        destinationId: "panna",
        crowdLevel: "Quiet",
        observedAt: "2026-10-15T10:00:00.000Z",
        sourceType: "community_verified",
        confidence: 0.85,
        expiresAt: "2026-10-15T11:30:00.000Z",
        verifiedBy: "DoT Officer",
        tip: "Only 4 people, crystal clear reflection",
      },
    ];

    const records = generateTrainingDataset(sampleObs, 0);
    const csv = exportDatasetAsCsv(records);

    const lines = csv.split("\n");
    expect(lines.length).toBe(2); // Header + 1 record
    expect(lines[0]).toContain("destination_id");
    expect(lines[0]).toContain("target_crowd_score");
    expect(lines[0]).toContain("baseline_predicted_score");
    expect(lines[1]).toContain("panna");
    expect(lines[1]).toContain("20");
    expect(lines[1]).toContain("Panna Meena Kund");
  });

  it("handles missing or empty observations gracefully without throwing", () => {
    expect(generateTrainingDataset([])).toEqual([]);
    const emptyCsv = exportDatasetAsCsv([]);
    expect(emptyCsv).toContain("destination_id,destination_name");
  });

  it("correctly identifies insufficient data when observations sample size is < 10", () => {
    const fewObs: VerifiedObservation[] = [
      {
        id: "obs-1",
        destinationId: "amber",
        crowdLevel: "Busy",
        observedAt: new Date().toISOString(),
        sourceType: "community_verified",
        confidence: 0.9,
        expiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
      },
    ];

    const evalReport = evaluateBaselineModel(fewObs, 10);
    expect(evalReport.status).toBe("insufficient_data");
    expect(evalReport.totalUsableObservations).toBe(1);
    expect(evalReport.mae).toBeNull();
    expect(evalReport.rmse).toBeNull();
    expect(evalReport.limitations.length).toBeGreaterThan(0);
    expect(evalReport.limitations[0]).toContain("Insufficient ground-truth sample size");
  });

  it("evaluates Baseline v1.0 with chronological 70/30 split when sufficient data exists", () => {
    const baseTime = new Date("2026-10-01T08:00:00Z").getTime();
    const mockObs: VerifiedObservation[] = [];

    // Generate 15 chronologically spaced observations across various Jaipur destinations
    const destinations = ["amber", "hawa", "citypalace", "nahargarh", "albert"];
    for (let i = 0; i < 15; i++) {
      const dest = destinations[i % destinations.length];
      const timeMs = baseTime + i * 4 * 60 * 60 * 1000; // 4 hours apart
      const levels: ("Quiet" | "Moderate" | "Busy")[] = ["Quiet", "Moderate", "Busy"];
      mockObs.push({
        id: `obs-eval-${i}`,
        destinationId: dest,
        crowdLevel: levels[i % 3],
        observedAt: new Date(timeMs).toISOString(),
        sourceType: "community_verified",
        confidence: 0.9,
        expiresAt: new Date(timeMs + 90 * 60 * 1000).toISOString(),
        verifiedBy: "Inspector DoT",
      });
    }

    const report = evaluateBaselineModel(mockObs, 10);
    expect(report.status).toBe("evaluated");
    expect(report.totalUsableObservations).toBe(15);
    expect(report.trainCount).toBe(10);
    expect(report.testCount).toBe(5);
    expect(report.mae).not.toBeNull();
    expect(report.rmse).not.toBeNull();
    expect(report.mae!).toBeGreaterThanOrEqual(0);
    expect(report.rmse!).toBeGreaterThanOrEqual(report.mae!);
    expect(report.categoryAccuracyPct).not.toBeNull();
    expect(report.confusionMatrix).toBeDefined();
  });

  it("rigorously evaluates promotion gate and blocks premature ML candidate deployment", () => {
    // Current sparse dataset evaluation
    const fewObs: VerifiedObservation[] = [
      {
        id: "obs-1",
        destinationId: "amber",
        crowdLevel: "Busy",
        observedAt: new Date().toISOString(),
        sourceType: "community_verified",
        confidence: 0.9,
        expiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
      },
    ];

    const evalReport = evaluateBaselineModel(fewObs, 10);
    const gateResult = evaluatePromotionGate(
      {
        id: "xgboost-jaipur-v1",
        name: "XGBoost Regressor v1.0",
        version: "1.0.0",
        type: "tabular_ml",
        predict: baselinePredictor.predict,
      },
      evalReport,
      12.5, // Candidate MAE
      4.2   // P99 latency
    );

    expect(gateResult.isEligibleForProduction).toBe(false);
    expect(gateResult.activeProductionModel).toBe("baseline-v1.0");
    expect(gateResult.summaryDecision).toContain("PROMOTION BLOCKED");

    // Check specific failed criteria
    const volumeCheck = gateResult.checks.find((c) => c.id === "min_observations");
    expect(volumeCheck?.passed).toBe(false);
    expect(volumeCheck?.blockerReason).toContain("Dataset too small");

    const coverageCheck = gateResult.checks.find((c) => c.id === "destination_coverage");
    expect(coverageCheck?.passed).toBe(false);

    // Fallback rail check must always be active
    const fallbackCheck = gateResult.checks.find((c) => c.id === "safety_fallback_available");
    expect(fallbackCheck?.passed).toBe(true);
  });
});

describe("ObservationsRepository Historical Retention & Lifecycle", () => {
  it("preserves historical stale observations instead of deleting them upon expiration", () => {
    const repo = new ObservationsRepository();
    const allInitial = repo.getAllObservations();
    const activeInitial = repo.getActiveObservations();

    expect(allInitial.length).toBeGreaterThanOrEqual(activeInitial.length);

    // Submit and verify a new report
    const sub = repo.submitReport({
      destinationId: "jaigarh",
      statusLevel: "Quiet",
      tipText: "Cannon courtyard very quiet today",
      weather: "clear",
    });

    expect(sub.success).toBe(true);
    const reportId = sub.report!.id;

    // Verify report
    const mod = repo.moderateReport(reportId, "verify", "DoT Testing Officer");
    expect(mod.success).toBe(true);

    const allAfter = repo.getAllObservations();
    expect(allAfter.length).toBe(allInitial.length + 1);

    // Verify that newly created observation preserves contextSnapshot and numericEquivalentScore
    const newObs = allAfter.find((o) => o.destinationId === "jaigarh");
    expect(newObs).toBeDefined();
    expect(newObs?.numericEquivalentScore).toBe(20);
    expect(newObs?.contextSnapshot).toBeDefined();
    expect(newObs?.contextSnapshot?.baselinePriorScore).toBe(30); // Jaigarh base score
  });

  it("exports training dataset directly from repository accessors", () => {
    const repo = new ObservationsRepository();
    const dataset = repo.getTrainingDataset();
    expect(Array.isArray(dataset)).toBe(true);
    expect(dataset.length).toBeGreaterThan(0);

    const csv = repo.exportTrainingCsv();
    expect(typeof csv).toBe("string");
    expect(csv).toContain("destination_id");

    const gate = repo.getPromotionGateStatus();
    expect(gate.activeProductionModel).toBe("baseline-v1.0");
    expect(gate.isEligibleForProduction).toBe(false); // Rigorous governance active
  });
});
