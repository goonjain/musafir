import { describe, expect, it, beforeEach } from "vitest";
import { ObservationsRepository } from "../lib/observations-repository";

describe("Raahi Observations Repository & Moderation Lifecycle", () => {
  let repo: ObservationsRepository;

  beforeEach(() => {
    // Instantiate clean repository instance for testing
    repo = new ObservationsRepository();
  });

  it("submits a valid tourist report with initial pending status and awards points", () => {
    const initialPoints = repo.getUserProfile().points;
    const result = repo.submitReport({
      destinationId: "jaigarh",
      statusLevel: "Quiet",
      tipText: "Cannon courtyard has barely any visitors today.",
      userAlias: "Ananya",
    });

    expect(result.success).toBe(true);
    expect(result.pointsAwarded).toBe(20);
    expect(result.report).toBeDefined();
    expect(result.report?.moderationStatus).toBe("pending");
    expect(result.report?.destinationId).toBe("jaigarh");
    expect(result.report?.statusLevel).toBe("Quiet");

    // Confirms points balance incremented and persisted
    const updatedPoints = repo.getUserProfile().points;
    expect(updatedPoints).toBe(initialPoints + 20);
  });

  it("rejects reports submitted for invalid or unmapped destinations", () => {
    const result = repo.submitReport({
      destinationId: "fake-monument-xyz",
      statusLevel: "Busy",
      tipText: "Too crowded here",
    });

    expect(result.success).toBe(false);
    expect(result.pointsAwarded).toBe(0);
    expect(result.message).toContain("Invalid destination");
  });

  it("enforces 15-minute anti-farming rate-limiting for the same destination", () => {
    const first = repo.submitReport({
      destinationId: "kanak",
      statusLevel: "Quiet",
      tipText: "Peacocks near the garden",
    });
    expect(first.success).toBe(true);

    // Immediate second attempt for same place
    const second = repo.submitReport({
      destinationId: "kanak",
      statusLevel: "Quiet",
      tipText: "Submitting again immediately for points",
    });

    expect(second.success).toBe(false);
    expect(second.pointsAwarded).toBe(0);
    expect(second.message).toContain("recently submitted a check-in");
    expect(second.cooldownSeconds).toBeGreaterThan(0);
  });

  it("moderates report: verification promotes report into an active observation", () => {
    const submission = repo.submitReport({
      destinationId: "sisodia",
      statusLevel: "Quiet",
      tipText: "Fountain area is serene.",
    });

    const reportId = submission.report!.id;
    const initialActiveCount = repo.getActiveObservations().length;

    // Admin verifies the report
    const modResult = repo.moderateReport(reportId, "verify", "DoT Inspector");
    expect(modResult.success).toBe(true);

    const updatedReports = repo.getReports("all");
    const target = updatedReports.find((r) => r.id === reportId);
    expect(target?.moderationStatus).toBe("verified");
    expect(target?.moderatedBy).toBe("DoT Inspector");

    // Confirms that a verified observation was created
    const activeObservations = repo.getActiveObservations();
    expect(activeObservations.length).toBe(initialActiveCount + 1);
    const createdObs = activeObservations.find((o) => o.destinationId === "sisodia");
    expect(createdObs).toBeDefined();
    expect(createdObs?.crowdLevel).toBe("Quiet");
    expect(createdObs?.sourceType).toBe("community_verified");
  });

  it("moderates report: rejection prevents report from influencing crowd observations", () => {
    const submission = repo.submitReport({
      destinationId: "tripolia",
      statusLevel: "Busy",
      tipText: "Fake report trying to alter crowd stats",
    });

    const reportId = submission.report!.id;
    const initialActiveCount = repo.getActiveObservations().length;

    // Admin rejects the report
    const modResult = repo.moderateReport(reportId, "reject", "DoT Inspector");
    expect(modResult.success).toBe(true);

    const updatedReports = repo.getReports("all");
    const target = updatedReports.find((r) => r.id === reportId);
    expect(target?.moderationStatus).toBe("rejected");

    // Verifies no observation was created
    const activeObservations = repo.getActiveObservations();
    expect(activeObservations.length).toBe(initialActiveCount);
  });

  it("persists admin overrides and emergency broadcasts across requests", () => {
    repo.setAdminOverride("amber", -15);
    expect(repo.getAdminOverrides()["amber"]).toBe(-15);

    repo.setAdminOverride("amber", 0);
    expect(repo.getAdminOverrides()["amber"]).toBeUndefined();

    repo.setActiveBroadcast("Test Alert: Traffic diversion active.");
    expect(repo.getActiveBroadcast()).toBe("Test Alert: Traffic diversion active.");

    repo.setActiveBroadcast(null);
    expect(repo.getActiveBroadcast()).toBeNull();
  });

  it("handles backend mode detection and graceful sync failure without crashing", async () => {
    expect(["supabase", "local_persistent"]).toContain(repo.getBackendMode());
    // Should resolve safely even if offline or table uninitialized
    await expect(repo.syncFromSupabase()).resolves.not.toThrow();
  });
});
