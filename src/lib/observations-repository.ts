import { PLACES, byId } from "./jaipur-data";
import { type VerifiedObservation, getCurrentJaipurTime } from "./crowd-service";
import {
  CROWD_CATEGORY_MAP,
  generateTrainingDataset,
  exportDatasetAsCsv,
  evaluateBaselineModel,
  evaluatePromotionGate,
  baselinePredictor,
  type TrainingRecord,
  type EvaluationReport,
  type PromotionGateResult,
} from "./ml-pipeline";

export type ModerationStatus = "pending" | "verified" | "rejected";

export interface CrowdReportRecord {
  id: string;
  destinationId: string;
  destinationName: string;
  hindiName: string;
  statusLevel: "Quiet" | "Moderate" | "Busy";
  tipText: string;
  userAlias: string;
  userSessionHash: string;
  submittedAt: string; // ISO string
  moderationStatus: ModerationStatus;
  moderatedAt?: string;
  moderatedBy?: string;
  moderationNotes?: string;
  relatedObservationId?: string;
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

export interface UserRewardsProfile {
  sessionHash: string;
  points: number;
  unlockedBadges: string[];
  submissionHistory: { destinationId: string; timestamp: number }[];
}

export interface SubmitReportInput {
  destinationId: string;
  statusLevel: "Quiet" | "Moderate" | "Busy";
  tipText: string;
  userAlias?: string;
  weather?: "clear" | "hot" | "rain";
  festivalActive?: boolean;
}

export interface SubmitReportResult {
  success: boolean;
  message: string;
  report?: CrowdReportRecord;
  pointsAwarded: number;
  cooldownSeconds?: number;
}

const STORAGE_KEYS = {
  REPORTS: "raahi_crowd_reports_v1",
  OBSERVATIONS: "raahi_crowd_observations_v1",
  USER_PROFILE: "raahi_user_profile_v1",
  ADMIN_OVERRIDES: "raahi_admin_overrides_v1",
  ACTIVE_BROADCAST: "raahi_active_broadcast_v1",
};

// Default seed observations to ensure initial testability
const INITIAL_SEED_REPORTS: CrowdReportRecord[] = [
  {
    id: "rep-seed-1",
    destinationId: "panna",
    destinationName: "Panna Meena Kund",
    hindiName: "पन्ना मीणा कुंड",
    statusLevel: "Quiet",
    tipText: "Only 5 people here, stunning water reflection!",
    userAlias: "Riya",
    userSessionHash: "seed-user-1",
    submittedAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
    moderationStatus: "verified",
    moderatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    moderatedBy: "DoT Jaipur Officer",
    relatedObservationId: "obs-seed-1",
  },
  {
    id: "rep-seed-2",
    destinationId: "amber",
    destinationName: "Amber Fort",
    hindiName: "आमेर किला",
    statusLevel: "Busy",
    tipText: "Suraj Pol entrance queue ~40 min. Elephant ramp congested.",
    userAlias: "Kabir",
    userSessionHash: "seed-user-2",
    submittedAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
    moderationStatus: "verified",
    moderatedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    moderatedBy: "DoT Jaipur Officer",
    relatedObservationId: "obs-seed-2",
  },
  {
    id: "rep-seed-3",
    destinationId: "hawa",
    destinationName: "Hawa Mahal",
    hindiName: "हवा महल",
    statusLevel: "Moderate",
    tipText: "Wind View Café rooftop has good seating.",
    userAlias: "Sophie",
    userSessionHash: "seed-user-3",
    submittedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    moderationStatus: "verified",
    moderatedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    moderatedBy: "DoT Jaipur Officer",
    relatedObservationId: "obs-seed-3",
  },
  {
    id: "rep-seed-4",
    destinationId: "albert",
    destinationName: "Albert Hall Museum",
    hindiName: "अल्बर्ट हॉल",
    statusLevel: "Quiet",
    tipText: "Quiet galleries, AC inside is refreshing.",
    userAlias: "Arjun",
    userSessionHash: "seed-user-4",
    submittedAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    moderationStatus: "pending",
  },
];

const INITIAL_SEED_OBSERVATIONS: VerifiedObservation[] = [
  {
    id: "obs-seed-1",
    destinationId: "panna",
    crowdLevel: "Quiet",
    observedAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
    sourceType: "community_verified",
    confidence: 0.9,
    expiresAt: new Date(Date.now() + 84 * 60 * 1000).toISOString(),
    verifiedBy: "DoT Jaipur Officer",
    tip: "Only 5 people here, stunning water reflection!",
  },
  {
    id: "obs-seed-2",
    destinationId: "amber",
    crowdLevel: "Busy",
    observedAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
    sourceType: "community_verified",
    confidence: 0.95,
    expiresAt: new Date(Date.now() + 76 * 60 * 1000).toISOString(),
    verifiedBy: "DoT Jaipur Officer",
    tip: "Suraj Pol entrance queue ~40 min. Elephant ramp congested.",
  },
  {
    id: "obs-seed-3",
    destinationId: "hawa",
    crowdLevel: "Moderate",
    observedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    sourceType: "community_verified",
    confidence: 0.85,
    expiresAt: new Date(Date.now() + 65 * 60 * 1000).toISOString(),
    verifiedBy: "DoT Jaipur Officer",
    tip: "Wind View Café rooftop has good seating.",
  },
];

// Helper to generate anonymous browser session ID
function getOrCreateSessionHash(): string {
  if (typeof window === "undefined") return "ssr-session";
  let hash = localStorage.getItem("raahi_session_hash");
  if (!hash) {
    hash = "usr-" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    localStorage.setItem("raahi_session_hash", hash);
  }
  return hash;
}

// Memory fallback for SSR / environments without localStorage
class MemoryStore {
  reports: CrowdReportRecord[] = [...INITIAL_SEED_REPORTS];
  observations: VerifiedObservation[] = [...INITIAL_SEED_OBSERVATIONS];
  overrides: Record<string, number> = {};
  broadcast: string | null = "Traffic advisory: Diverting Amer Fort visitors to Jaigarh & Panna Meena Kund.";
  profile: UserRewardsProfile = {
    sessionHash: "default-user",
    points: 40,
    unlockedBadges: [],
    submissionHistory: [],
  };
}

const memoryFallback = new MemoryStore();

/**
 * Observations & Reports Repository.
 * Transparently manages shared persistence across tourist check-ins,
 * admin moderation, and live baseline calculations.
 */
export class ObservationsRepository {
  private listeners: (() => void)[] = [];
  private isSupabaseConfigured: boolean;
  private supabaseUrl: string = "";
  private supabaseKey: string = "";

  constructor() {
    const rawUrl = typeof process !== "undefined" && process.env?.VITE_SUPABASE_URL
      ? process.env.VITE_SUPABASE_URL
      : (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_SUPABASE_URL);
    const rawKey = typeof process !== "undefined" && process.env?.VITE_SUPABASE_ANON_KEY
      ? process.env.VITE_SUPABASE_ANON_KEY
      : (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY);

    this.supabaseUrl = rawUrl ? String(rawUrl).replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "") : "";
    this.supabaseKey = rawKey ? String(rawKey) : "";
    this.isSupabaseConfigured = Boolean(this.supabaseUrl && this.supabaseKey);

    if (typeof window !== "undefined") {
      this.initLocalStorage();
      window.addEventListener("storage", (e) => {
        if (e.key && Object.values(STORAGE_KEYS).includes(e.key)) {
          this.notifyListeners();
        }
      });
      if (this.isSupabaseConfigured) {
        this.syncFromSupabase().catch(() => {});
      }
    }
  }

  public getBackendMode(): "supabase" | "local_persistent" {
    return this.isSupabaseConfigured ? "supabase" : "local_persistent";
  }

  private initLocalStorage() {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(STORAGE_KEYS.REPORTS)) {
      localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(INITIAL_SEED_REPORTS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.OBSERVATIONS)) {
      localStorage.setItem(STORAGE_KEYS.OBSERVATIONS, JSON.stringify(INITIAL_SEED_OBSERVATIONS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.ADMIN_OVERRIDES)) {
      localStorage.setItem(STORAGE_KEYS.ADMIN_OVERRIDES, JSON.stringify({}));
    }
    if (!localStorage.getItem(STORAGE_KEYS.USER_PROFILE)) {
      const initialProfile: UserRewardsProfile = {
        sessionHash: getOrCreateSessionHash(),
        points: 40,
        unlockedBadges: [],
        submissionHistory: [],
      };
      localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(initialProfile));
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch (err) {
        console.error("Error in repository update listener", err);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // OBSERVATIONS (For crowd-service live calculations & ML training)
  // ---------------------------------------------------------------------------
  public getAllObservations(): VerifiedObservation[] {
    let list: VerifiedObservation[] = [];
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem(STORAGE_KEYS.OBSERVATIONS);
      list = raw ? JSON.parse(raw) : INITIAL_SEED_OBSERVATIONS;
    } else {
      list = memoryFallback.observations;
    }

    // Sort descending by observedAt
    list.sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime());
    return list;
  }

  public getActiveObservations(): VerifiedObservation[] {
    const list = this.getAllObservations();
    const now = Date.now();
    // Filter active observations: expiresAt must be in the future
    return list.filter((o) => {
      const exp = new Date(o.expiresAt).getTime();
      return !isNaN(exp) && exp > now;
    });
  }

  public getStaleObservations(): VerifiedObservation[] {
    const list = this.getAllObservations();
    const now = Date.now();
    // Filter historical/stale observations: expiresAt in the past
    return list.filter((o) => {
      const exp = new Date(o.expiresAt).getTime();
      return isNaN(exp) || exp <= now;
    });
  }

  // ---------------------------------------------------------------------------
  // REPORTS (Tourist Check-Ins)
  // ---------------------------------------------------------------------------
  public getReports(filter?: ModerationStatus | "all"): CrowdReportRecord[] {
    let list: CrowdReportRecord[] = [];
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem(STORAGE_KEYS.REPORTS);
      list = raw ? JSON.parse(raw) : INITIAL_SEED_REPORTS;
    } else {
      list = memoryFallback.reports;
    }

    // Sort descending by submittedAt
    list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    if (!filter || filter === "all") return list;
    return list.filter((r) => r.moderationStatus === filter);
  }

  /**
   * Submit tourist check-in report.
   * Enforces destination validation and 15-minute anti-farming cooldown.
   * Preserves rich contextual feature snapshot at observation time (zero PII).
   */
  public submitReport(input: SubmitReportInput): SubmitReportResult {
    const place = PLACES.find((p) => p.id === input.destinationId);
    if (!place) {
      return {
        success: false,
        message: "Invalid destination ID. Must be a curated Jaipur monument.",
        pointsAwarded: 0,
      };
    }

    const sessionHash = getOrCreateSessionHash();
    const profile = this.getUserProfile();
    const now = Date.now();

    // Anti-farming rule: 1 submission per destination every 15 mins (900 seconds)
    const recentForPlace = profile.submissionHistory.find(
      (h) => h.destinationId === input.destinationId && now - h.timestamp < 15 * 60 * 1000
    );

    if (recentForPlace) {
      const remainingSec = Math.ceil((15 * 60 * 1000 - (now - recentForPlace.timestamp)) / 1000);
      return {
        success: false,
        message: `You recently submitted a check-in for ${place.name}. Please wait ${Math.ceil(remainingSec / 60)} min before submitting again.`,
        pointsAwarded: 0,
        cooldownSeconds: remainingSec,
      };
    }

    const currentJaipur = getCurrentJaipurTime();
    const contextSnapshot = {
      dayOfWeek: currentJaipur.day,
      hourOfDay: currentJaipur.hour,
      isWeekend: currentJaipur.day === "Sat" || currentJaipur.day === "Sun",
      weather: input.weather || "clear",
      festivalActive: Boolean(input.festivalActive),
      baselinePriorScore: place.base,
      clientTimestamp: new Date().toISOString(),
    };

    const newReport: CrowdReportRecord = {
      id: "rep-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      destinationId: place.id,
      destinationName: place.name,
      hindiName: place.hindi,
      statusLevel: input.statusLevel,
      tipText: input.tipText.trim().slice(0, 160),
      userAlias: input.userAlias?.trim() || "You",
      userSessionHash: sessionHash,
      submittedAt: new Date().toISOString(),
      moderationStatus: "pending",
      contextSnapshot,
    };

    // Update reports list
    const reports = this.getReports("all");
    reports.unshift(newReport);

    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(reports));
    } else {
      memoryFallback.reports = reports;
    }

    // Award +20 points and record submission history
    profile.points += 20;
    profile.submissionHistory.unshift({ destinationId: place.id, timestamp: now });
    this.saveUserProfile(profile);

    this.notifyListeners();

    // Async sync to Supabase if configured (fire & forget, graceful fallback)
    if (this.isSupabaseConfigured && this.supabaseUrl) {
      this.pushReportToSupabase(newReport).catch((err) => {
        console.warn("Supabase report upload pending sync:", err);
      });
    }

    return {
      success: true,
      message: `Report submitted for ${place.name}! +20 points earned. Awaiting DoT verification.`,
      report: newReport,
      pointsAwarded: 20,
    };
  }

  // ---------------------------------------------------------------------------
  // ADMIN MODERATION (Command Center Actions)
  // ---------------------------------------------------------------------------
  public moderateReport(
    reportId: string,
    decision: "verify" | "reject",
    moderatorName = "DoT Officer"
  ): { success: boolean; message: string } {
    const reports = this.getReports("all");
    const target = reports.find((r) => r.id === reportId);
    if (!target) {
      return { success: false, message: "Report not found." };
    }

    target.moderationStatus = decision === "verify" ? "verified" : "rejected";
    target.moderatedAt = new Date().toISOString();
    target.moderatedBy = moderatorName;

    let createdObs: VerifiedObservation | undefined;

    if (decision === "verify") {
      // Create accepted observation with 90 min validity
      const obsId = "obs-" + Date.now();
      target.relatedObservationId = obsId;

      const numericTarget = CROWD_CATEGORY_MAP[target.statusLevel]?.numericTarget || 50;

      const newObs: VerifiedObservation = {
        id: obsId,
        destinationId: target.destinationId,
        crowdLevel: target.statusLevel,
        observedAt: target.submittedAt,
        sourceType: "community_verified",
        confidence: 0.9,
        expiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
        verifiedBy: moderatorName,
        tip: target.tipText,
        relatedReportId: target.id,
        numericEquivalentScore: numericTarget,
        contextSnapshot: target.contextSnapshot,
      };

      createdObs = newObs;
      // Retain full observation history (never overwrite or wipe stale observations)
      const allObservations = this.getAllObservations();
      allObservations.unshift(newObs);

      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEYS.OBSERVATIONS, JSON.stringify(allObservations));
      } else {
        memoryFallback.observations = allObservations;
      }
    }

    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(reports));
    } else {
      memoryFallback.reports = reports;
    }

    this.notifyListeners();

    // Async sync to Supabase if configured (fire & forget)
    if (this.isSupabaseConfigured && this.supabaseUrl) {
      this.pushModerationToSupabase(target, createdObs).catch((err) => {
        console.warn("Supabase moderation update pending sync:", err);
      });
    }

    return {
      success: true,
      message: `Report ${decision === "verify" ? "verified and added to crowd forecast" : "rejected"}.`,
    };
  }

  // ---------------------------------------------------------------------------
  // ADMIN OVERRIDES & BROADCASTS
  // ---------------------------------------------------------------------------
  public getAdminOverrides(): Record<string, number> {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem(STORAGE_KEYS.ADMIN_OVERRIDES);
      return raw ? JSON.parse(raw) : {};
    }
    return memoryFallback.overrides;
  }

  public setAdminOverride(destinationId: string, delta: number) {
    const overrides = this.getAdminOverrides();
    if (delta === 0) {
      delete overrides[destinationId];
    } else {
      overrides[destinationId] = Math.max(-30, Math.min(30, delta));
    }

    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.ADMIN_OVERRIDES, JSON.stringify(overrides));
    } else {
      memoryFallback.overrides = overrides;
    }
    this.notifyListeners();
  }

  public getActiveBroadcast(): string | null {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEYS.ACTIVE_BROADCAST) || memoryFallback.broadcast;
    }
    return memoryFallback.broadcast;
  }

  public setActiveBroadcast(msg: string | null) {
    if (typeof window !== "undefined") {
      if (msg) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_BROADCAST, msg);
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_BROADCAST);
      }
    }
    memoryFallback.broadcast = msg;
    this.notifyListeners();
  }

  // ---------------------------------------------------------------------------
  // USER PROFILE & REWARDS
  // ---------------------------------------------------------------------------
  public getUserProfile(): UserRewardsProfile {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      if (raw) return JSON.parse(raw);
    }
    return memoryFallback.profile;
  }

  public saveUserProfile(profile: UserRewardsProfile) {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
    } else {
      memoryFallback.profile = profile;
    }
    this.notifyListeners();
  }

  public awardPoints(amount: number) {
    const p = this.getUserProfile();
    p.points += amount;
    this.saveUserProfile(p);
  }

  // ---------------------------------------------------------------------------
  // SUPABASE POSTGREST INTEGRATION (Async Background Sync)
  // ---------------------------------------------------------------------------
  public async syncFromSupabase(): Promise<void> {
    if (!this.isSupabaseConfigured || !this.supabaseUrl) return;

    try {
      const headers: Record<string, string> = {
        apikey: this.supabaseKey,
        Authorization: `Bearer ${this.supabaseKey}`,
      };

      // 1. Fetch reports from Supabase
      const reportsRes = await fetch(
        `${this.supabaseUrl}/rest/v1/crowd_reports?select=*&order=submitted_at.desc`,
        { headers }
      );
      if (reportsRes.ok) {
        const rows: any[] = await reportsRes.json();
        if (Array.isArray(rows) && rows.length > 0) {
          const mappedReports: CrowdReportRecord[] = rows.map((r) => {
            const place = PLACES.find((p) => p.id === r.destination_id);
            return {
              id: String(r.id),
              destinationId: r.destination_id,
              destinationName: place?.name || r.destination_id,
              hindiName: place?.hindi || "",
              statusLevel: r.status_level,
              tipText: r.tip_text || "",
              userAlias: r.user_alias || "Traveller",
              userSessionHash: r.user_session_hash,
              submittedAt: r.submitted_at,
              moderationStatus: r.moderation_status,
              moderatedAt: r.moderated_at,
              moderatedBy: r.moderated_by,
              moderationNotes: r.moderation_notes,
              relatedObservationId: r.related_observation_id,
            };
          });

          if (typeof window !== "undefined") {
            localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(mappedReports));
          } else {
            memoryFallback.reports = mappedReports;
          }
        }
      }

      // 2. Fetch active observations from Supabase
      const obsRes = await fetch(
        `${this.supabaseUrl}/rest/v1/crowd_observations?select=*&is_active=eq.true&order=observed_at.desc`,
        { headers }
      );
      if (obsRes.ok) {
        const rows: any[] = await obsRes.json();
        if (Array.isArray(rows) && rows.length > 0) {
          const mappedObs: VerifiedObservation[] = rows.map((o) => ({
            id: String(o.id),
            destinationId: o.destination_id,
            crowdLevel: o.crowd_level,
            observedAt: o.observed_at,
            sourceType: o.source_type,
            confidence: Number(o.confidence) || 0.9,
            expiresAt: o.expires_at,
            verifiedBy: o.verified_by,
            tip: o.tip_text,
          }));

          if (typeof window !== "undefined") {
            localStorage.setItem(STORAGE_KEYS.OBSERVATIONS, JSON.stringify(mappedObs));
          } else {
            memoryFallback.observations = mappedObs;
          }
        }
      }

      this.notifyListeners();
    } catch (err) {
      console.warn("Supabase background sync paused (using local state):", err);
    }
  }

  private async pushReportToSupabase(report: CrowdReportRecord): Promise<void> {
    if (!this.isSupabaseConfigured || !this.supabaseUrl) return;
    try {
      await fetch(`${this.supabaseUrl}/rest/v1/crowd_reports`, {
        method: "POST",
        headers: {
          apikey: this.supabaseKey,
          Authorization: `Bearer ${this.supabaseKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          id: report.id,
          destination_id: report.destinationId,
          status_level: report.statusLevel,
          tip_text: report.tipText,
          user_alias: report.userAlias,
          user_session_hash: report.userSessionHash,
          moderation_status: report.moderationStatus,
          submitted_at: report.submittedAt,
        }),
      });
    } catch (err) {
      console.warn("Failed to push report to Supabase:", err);
    }
  }

  private async pushModerationToSupabase(
    report: CrowdReportRecord,
    observation?: VerifiedObservation
  ): Promise<void> {
    if (!this.isSupabaseConfigured || !this.supabaseUrl) return;
    try {
      const headers = {
        apikey: this.supabaseKey,
        Authorization: `Bearer ${this.supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      };

      // 1. Update crowd_reports record
      await fetch(`${this.supabaseUrl}/rest/v1/crowd_reports?id=eq.${encodeURIComponent(report.id)}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          moderation_status: report.moderationStatus,
          moderated_at: report.moderatedAt,
          moderated_by: report.moderatedBy,
        }),
      });

      // 2. If verified, insert into crowd_observations
      if (observation) {
        await fetch(`${this.supabaseUrl}/rest/v1/crowd_observations`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            id: observation.id,
            destination_id: observation.destinationId,
            crowd_level: observation.crowdLevel,
            source_type: observation.sourceType,
            confidence: observation.confidence,
            tip_text: observation.tip,
            observed_at: observation.observedAt,
            expires_at: observation.expiresAt,
            is_active: true,
            related_report_id: report.id,
            verified_by: observation.verifiedBy,
          }),
        });
      }
    } catch (err) {
      console.warn("Failed to push moderation to Supabase:", err);
    }
  }

  // ---------------------------------------------------------------------------
  // ML READINESS & TRAINING DATA ACCESSORS
  // ---------------------------------------------------------------------------
  public getTrainingDataset(horizonHours: number = 0): TrainingRecord[] {
    const all = this.getAllObservations();
    return generateTrainingDataset(all, horizonHours);
  }

  public exportTrainingCsv(horizonHours: number = 0): string {
    const records = this.getTrainingDataset(horizonHours);
    return exportDatasetAsCsv(records);
  }

  public getEvaluationReport(minThreshold: number = 10): EvaluationReport {
    const all = this.getAllObservations();
    return evaluateBaselineModel(all, minThreshold);
  }

  public getPromotionGateStatus(): PromotionGateResult {
    const evalReport = this.getEvaluationReport(10);
    return evaluatePromotionGate(baselinePredictor, evalReport);
  }
}

// Export singleton instance for app-wide use
export const observationsRepository = new ObservationsRepository();
