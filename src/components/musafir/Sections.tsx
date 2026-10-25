<<<<<<< HEAD
import { useCallback, useMemo, useState } from "react";
=======
import { useEffect, useMemo, useState } from "react";
>>>>>>> origin/main
import {
  PLACES,
  byId,
  level,
  levelClass,
  DAYS,
  INTERESTS,
  type ForecastInput,
  type Place,
} from "@/lib/jaipur-data";
<<<<<<< HEAD
import { rankAlternatives, formatDistance } from "@/lib/recommendation";
import { planItinerary } from "@/lib/itinerary-planner";
=======
import {
  predictCrowd,
  type CrowdPrediction,
  type PredictionType,
  type VerifiedObservation,
} from "@/lib/crowd-service";
import { observationsRepository, type CrowdReportRecord } from "@/lib/observations-repository";
>>>>>>> origin/main

export type Report = {
  id: string | number;
  place: string;
  user: string;
  status: "Quiet" | "Moderate" | "Busy";
  tip: string;
  ago: string;
  moderationStatus?: "pending" | "verified" | "rejected";
};

export function SectionTitle({
  kicker,
  title,
  sub,
}: {
  kicker: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="mb-8 text-center">
      <p className="font-display text-lg text-saffron">{kicker}</p>
      <h2 className="mt-1 text-4xl text-primary md:text-5xl">{title}</h2>
      {sub && <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">{sub}</p>}
      <div className="mx-auto mt-4 flex items-center justify-center gap-2 text-gold">✦ ❁ ✦</div>
    </div>
  );
}

export function Badge({
  score,
  type,
  showLabel = true,
}: {
  score: number;
  type?: PredictionType;
  showLabel?: boolean;
}) {
  const l = level(score);
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${levelClass[l]}`}>
        {score}/100 {showLabel ? `· ${l}` : ""}
      </span>
      {type && (
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${
            type === "observed"
              ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30"
              : "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30"
          }`}
          title={
            type === "observed"
              ? "Ground truth verified from on-ground traveler report"
              : "Estimated via baseline v1.0 multi-factor formula"
          }
        >
          {type === "observed" ? "● Observed" : "○ Estimated"}
        </span>
      )}
    </span>
  );
}

/* ---------------- Planner ---------------- */
export type Plan = {
  day: string;
  time: "half" | "full";
  budget: number;
  interests: string[];
  type: string;
  crowd: string;
  must: string;
<<<<<<< HEAD
  mustVisits?: string[];
  fromDate?: string;
  fromTime?: string;
  toDate?: string;
  toTime?: string;
  foodInterests?: string[];
  dietary?: string[];
  notes?: string;
  pacePreference?: string;
  stopReplacements?: Record<string, string> | undefined;
};

const FOOD_OPTIONS = [
  { id: "thali", label: "Rajasthani Thali" },
  { id: "street_food", label: "Street Food & Chaat" },
  { id: "cafes", label: "Heritage Cafes" },
  { id: "sweets_chai", label: "Mithai & Chai" },
  { id: "fine_dining", label: "Royal Dining" },
];

const COMPANION_OPTIONS = [
  { id: "solo", label: "Solo" },
  { id: "couple", label: "Couple" },
  { id: "friends", label: "Friends" },
  { id: "family", label: "Family" },
  { id: "mixed", label: "Mixed group" },
];

const CROWD_OPTIONS = [
  { id: "avoid", label: "Avoid crowds" },
  { id: "balanced", label: "Balanced" },
  { id: "don't mind", label: "Don't mind" },
];

const DIETARY_OPTIONS = [
  { id: "vegetarian", label: "Pure Veg" },
  { id: "jain", label: "Jain (No Root Veg)" },
  { id: "vegan", label: "Vegan" },
  { id: "halal", label: "Halal" },
  { id: "no_restrictions", label: "No Restrictions" },
];

const PACE_OPTIONS = [
  { id: "relaxed", label: "Relaxed pace" },
  { id: "balanced", label: "Balanced standard" },
  { id: "active", label: "Fast-paced sprint" },
];

=======
};

>>>>>>> origin/main
export function Planner({
  plan,
  setPlan,
  onGenerate,
}: {
  plan: Plan;
  setPlan: (p: Plan) => void;
  onGenerate: () => void;
}) {
<<<<<<< HEAD
  const [detailsOpen, setDetailsOpen] = useState(false);

  const chip = (active: boolean) =>
    `h-9 px-3.5 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-full border transition cursor-pointer flex items-center justify-center shrink-0 ${
      active
        ? "border-primary bg-primary text-primary-foreground shadow-sm"
        : "border-border bg-card text-foreground hover:border-primary/60 hover:bg-muted/40"
    }`;

  // Derive day of week (e.g., "Sun") from date string
  const deriveDay = (dateStr?: string): string => {
    if (!dateStr) return plan.day || "Sun";
    try {
      const d = new Date(dateStr + "T00:00:00");
      if (isNaN(d.getTime())) return plan.day || "Sun";
      const dayMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return dayMap[d.getDay()] ?? "Sun";
    } catch {
      return plan.day || "Sun";
    }
  };

  // Compute duration window
  const computeDurationInfo = (
    fromDate?: string,
    fromTime?: string,
    toDate?: string,
    toTime?: string
  ): { label: string; mode: "half" | "full" } => {
    const fDate = fromDate || "2026-10-18";
    const tDate = toDate || fDate;
    const fTime = fromTime || "09:00";
    const tTime = toTime || "19:00";

    try {
      const start = new Date(`${fDate}T${fTime}:00`);
      const end = new Date(`${tDate}T${tTime}:00`);
      const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      if (diffHours <= 0 || isNaN(diffHours)) return { label: "1 Day (Standard)", mode: "full" };
      if (diffHours <= 6) return { label: `Half-day (~${Math.max(1, Math.round(diffHours))}h)`, mode: "half" };
      return { label: `Full-day (~${Math.round(diffHours)}h)`, mode: "full" };
    } catch {
      return { label: "Full-day", mode: "full" };
    }
  };

  const currentDuration = computeDurationInfo(plan.fromDate, plan.fromTime, plan.toDate, plan.toTime);

  const handleFromDateChange = (newDate: string) => {
    const newDay = deriveDay(newDate);
    const toDate = plan.toDate && plan.toDate >= newDate ? plan.toDate : newDate;
    const dur = computeDurationInfo(newDate, plan.fromTime, toDate, plan.toTime);
    setPlan({
      ...plan,
      fromDate: newDate,
      toDate,
      day: newDay,
      time: dur.mode,
    });
  };

  const handleToDateChange = (newDate: string) => {
    const dur = computeDurationInfo(plan.fromDate, plan.fromTime, newDate, plan.toTime);
    setPlan({
      ...plan,
      toDate: newDate,
      time: dur.mode,
    });
  };

  const handleFromTimeChange = (newTime: string) => {
    const dur = computeDurationInfo(plan.fromDate, newTime, plan.toDate, plan.toTime);
    setPlan({
      ...plan,
      fromTime: newTime,
      time: dur.mode,
    });
  };

  const handleToTimeChange = (newTime: string) => {
    const dur = computeDurationInfo(plan.fromDate, plan.fromTime, plan.toDate, newTime);
    setPlan({
      ...plan,
      toTime: newTime,
      time: dur.mode,
    });
  };

  // Must-visit multiple selections
  const currentMusts = plan.mustVisits ?? (plan.must ? [plan.must] : []);
  const toggleMustVisit = (placeId: string) => {
    const next = currentMusts.includes(placeId)
      ? currentMusts.filter((id) => id !== placeId)
      : [...currentMusts, placeId];
    setPlan({
      ...plan,
      mustVisits: next,
      must: next[0] ?? "",
    });
  };

  const landmarkPlaces = PLACES.filter((p) => !p.gem);

  return (
    <div className="arch relative mx-auto max-w-4xl overflow-hidden border-4 border-double border-gold bg-card p-6 pt-12 shadow-2xl md:p-10 md:pt-14">
      {/* Restrained decorative jaali lattice background */}
      <div className="jaali pointer-events-none absolute inset-0 opacity-25" />

      <div className="relative space-y-9">
        {/* ==================== 01 — YOUR TIME ==================== */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
            <h3 className="font-serif text-xl text-primary flex items-center gap-2">
              <span className="font-display text-sm tracking-wider text-saffron uppercase">01</span>
              <span>Your time</span>
            </h3>
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
              {currentDuration.label} · {plan.day}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="planner-from-date" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                From Date & Start Time
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  id="planner-from-date"
                  type="date"
                  value={plan.fromDate ?? "2026-10-18"}
                  onChange={(e) => handleFromDateChange(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs md:text-sm font-medium text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  id="planner-from-time"
                  type="time"
                  value={plan.fromTime ?? "09:00"}
                  onChange={(e) => handleFromTimeChange(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs md:text-sm font-medium text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label htmlFor="planner-to-date" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                To Date & End Time
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  id="planner-to-date"
                  type="date"
                  value={plan.toDate ?? plan.fromDate ?? "2026-10-18"}
                  min={plan.fromDate}
                  onChange={(e) => handleToDateChange(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs md:text-sm font-medium text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  id="planner-to-time"
                  type="time"
                  value={plan.toTime ?? "19:00"}
                  onChange={(e) => handleToTimeChange(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs md:text-sm font-medium text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ==================== 02 — YOUR TRAVEL VIBE ==================== */}
        <section className="space-y-4">
          <div className="border-b border-border/60 pb-2.5">
            <h3 className="font-serif text-xl text-primary flex items-center gap-2">
              <span className="font-display text-sm tracking-wider text-saffron uppercase">02</span>
              <span>Your travel vibe</span>
            </h3>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="planner-budget-slider" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Estimated Trip Budget
                </label>
                <span className="font-bold text-base text-primary">
                  ₹{plan.budget.toLocaleString("en-IN")}
                </span>
              </div>
              <input
                id="planner-budget-slider"
                type="range"
                min={500}
                max={10000}
                step={250}
                value={plan.budget}
                onChange={(e) => setPlan({ ...plan, budget: +e.target.value })}
                className="w-full accent-[var(--primary)] cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                <span>₹500 (Budget)</span>
                <span>₹5,000 (Standard)</span>
                <span>₹10,000+ (Luxury)</span>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Crowd Preference
              </p>
              <div className="flex flex-wrap gap-2">
                {CROWD_OPTIONS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={chip(plan.crowd === c.id)}
                    onClick={() => setPlan({ ...plan, crowd: c.id })}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Travelling as
              </p>
              <div className="flex flex-wrap gap-2">
                {COMPANION_OPTIONS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={chip(plan.type === t.id)}
                    onClick={() => setPlan({ ...plan, type: t.id })}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ==================== 03 — WHAT FEELS LIKE YOU? ==================== */}
        <section className="space-y-4">
          <div className="border-b border-border/60 pb-2.5">
            <h3 className="font-serif text-xl text-primary flex items-center gap-2">
              <span className="font-display text-sm tracking-wider text-saffron uppercase">03</span>
              <span>What feels like you?</span>
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Interests & Experiences (Multiple)
              </p>
              <div className="flex flex-wrap gap-2">
                {INTERESTS.map((i) => {
                  const on = plan.interests.includes(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      className={chip(on)}
                      onClick={() =>
                        setPlan({
                          ...plan,
                          interests: on
                            ? plan.interests.filter((x) => x !== i)
                            : [...plan.interests, i],
                        })
                      }
                    >
                      {i}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Food & Dining Interests
              </p>
              <div className="flex flex-wrap gap-2">
                {FOOD_OPTIONS.map((f) => {
                  const currentFoods = plan.foodInterests ?? ["thali"];
                  const on = currentFoods.includes(f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      className={chip(on)}
                      onClick={() => {
                        const next = on
                          ? currentFoods.filter((x) => x !== f.id)
                          : [...currentFoods, f.id];
                        setPlan({
                          ...plan,
                          foodInterests: next.length > 0 ? next : ["thali"],
                        });
                      }}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Must-Visit Landmarks (Select one or more)
                </p>
                {currentMusts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPlan({ ...plan, mustVisits: [], must: "" })}
                    className="text-xs text-primary underline hover:text-saffron transition"
                  >
                    Clear selections
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {landmarkPlaces.map((p) => {
                  const isSelected = currentMusts.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={chip(isSelected)}
                      onClick={() => toggleMustVisit(p.id)}
                    >
                      {isSelected ? `✓ ${p.name}` : p.name}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Tip: Leave unselected for an automatic, crowd-balanced Jaipur itinerary.
              </p>
            </div>
          </div>
        </section>

        {/* ==================== 04 — THE LITTLE DETAILS ==================== */}
        <section className="rounded-2xl border border-border/70 bg-secondary/35 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-lg text-primary flex items-center gap-2">
              <span className="font-display text-xs tracking-wider text-saffron uppercase">04</span>
              <span>The little details</span>
            </h3>
            <button
              type="button"
              onClick={() => setDetailsOpen(!detailsOpen)}
              className="text-xs font-semibold text-primary hover:text-saffron transition"
            >
              {detailsOpen ? "Hide details ▲" : "Show details ▼"}
            </button>
          </div>

          {detailsOpen ? (
            <div className="mt-4 space-y-4 border-t border-border/50 pt-4 animate-in fade-in">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Dietary Preferences
                </p>
                <div className="flex flex-wrap gap-2">
                  {DIETARY_OPTIONS.map((d) => {
                    const currentDiet = plan.dietary ?? ["vegetarian"];
                    const on = currentDiet.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        className={chip(on)}
                        onClick={() => {
                          const next = on
                            ? currentDiet.filter((x) => x !== d.id)
                            : [...currentDiet, d.id];
                          setPlan({
                            ...plan,
                            dietary: next.length > 0 ? next : ["vegetarian"],
                          });
                        }}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Pace Preference
                </p>
                <div className="flex flex-wrap gap-2">
                  {PACE_OPTIONS.map((p) => {
                    const active = (plan.pacePreference ?? "balanced") === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={chip(active)}
                        onClick={() => setPlan({ ...plan, pacePreference: p.id })}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label htmlFor="planner-special-notes" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Special Requests or Notes (Optional)
                </label>
                <input
                  id="planner-special-notes"
                  type="text"
                  maxLength={160}
                  value={plan.notes ?? ""}
                  onChange={(e) => setPlan({ ...plan, notes: e.target.value })}
                  placeholder="e.g. Senior-citizen friendly, prefer shaded walks, golden hour photography"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs md:text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Optional dietary requirements, touring pace, and custom notes.
            </p>
          )}
        </section>

        {/* ==================== ACTION CTA BUTTON ==================== */}
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={onGenerate}
            className="w-full md:w-auto min-w-[300px] rounded-full bg-primary px-8 py-3.5 font-display text-lg text-primary-foreground shadow-xl transition hover:scale-[1.02] hover:bg-saffron cursor-pointer"
=======
  const chip = (active: boolean) =>
    `rounded-full border px-4 py-1.5 text-sm capitalize transition ${
      active
        ? "border-primary bg-primary text-primary-foreground shadow"
        : "border-border bg-card hover:border-primary"
    }`;
  return (
    <div className="arch mx-auto max-w-4xl border-4 border-double border-gold bg-card p-6 pt-14 shadow-xl md:p-10 md:pt-16">
      <div className="grid gap-6 md:grid-cols-2">
        <Field label="Travel day">
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => (
              <button
                key={d}
                className={chip(plan.day === d)}
                onClick={() => setPlan({ ...plan, day: d })}
              >
                {d}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Available time">
          <div className="flex gap-2">
            <button
              className={chip(plan.time === "half")}
              onClick={() => setPlan({ ...plan, time: "half" })}
            >
              Half-day
            </button>
            <button
              className={chip(plan.time === "full")}
              onClick={() => setPlan({ ...plan, time: "full" })}
            >
              Full day
            </button>
          </div>
        </Field>
        <Field label={`Budget: ₹${plan.budget.toLocaleString("en-IN")}`}>
          <input
            type="range"
            min={500}
            max={6000}
            step={250}
            value={plan.budget}
            onChange={(e) => setPlan({ ...plan, budget: +e.target.value })}
            className="w-full accent-[var(--primary)]"
          />
        </Field>
        <Field label="Travelling as">
          <div className="flex flex-wrap gap-2">
            {["solo", "friends", "couple", "family"].map((t) => (
              <button
                key={t}
                className={chip(plan.type === t)}
                onClick={() => setPlan({ ...plan, type: t })}
              >
                {t}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Interests">
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((i) => {
              const on = plan.interests.includes(i);
              return (
                <button
                  key={i}
                  className={chip(on)}
                  onClick={() =>
                    setPlan({
                      ...plan,
                      interests: on
                        ? plan.interests.filter((x) => x !== i)
                        : [...plan.interests, i],
                    })
                  }
                >
                  {i}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Crowd preference">
          <div className="flex flex-wrap gap-2">
            {["avoid", "balanced", "don't mind"].map((c) => (
              <button
                key={c}
                className={chip(plan.crowd === c)}
                onClick={() => setPlan({ ...plan, crowd: c })}
              >
                {c === "avoid" ? "Avoid crowds" : c}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Must-visit (optional)">
          <select
            value={plan.must}
            onChange={(e) => setPlan({ ...plan, must: e.target.value })}
            className="w-full rounded-lg border bg-background px-3 py-2"
          >
            <option value="">None</option>
            {PLACES.filter((p) => !p.gem).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex items-end">
          <button
            onClick={onGenerate}
            className="w-full rounded-full bg-primary px-6 py-3 font-display text-lg text-primary-foreground shadow-lg transition hover:scale-[1.02] hover:bg-saffron"
>>>>>>> origin/main
          >
            Plan my Jaipur day →
          </button>
          <p className="mt-2 text-xs text-muted-foreground">
            Crafts a crowd-aware, personalized itinerary honoring your vibe and timing.
          </p>
        </div>
      </div>
    </div>
  );
}

<<<<<<< HEAD
=======
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}
>>>>>>> origin/main

/* ---------------- Itinerary + Smart Route ---------------- */
export type Stop = { time: string; hour: number; id: string; note?: string; food?: boolean };

export function resolveStop(stop: Stop, replacements?: Record<string, string>): Stop {
  if (stop.food || !replacements) return stop;
  const replacementId = replacements[stop.id];
  if (replacementId && replacementId !== stop.id) {
    try {
      const originalPlace = byId(stop.id);
      const newPlace = byId(replacementId);
      return {
        ...stop,
        id: replacementId,
        note: `Replaced crowded ${originalPlace.name} with ${newPlace.name}`,
      };
    } catch {
      return stop;
    }
  }
  return stop;
}

export function buildOriginal(plan: Plan): Stop[] {
  const must = plan.must || "amber";
  const raw: Stop[] = [
    { time: "11:00 AM", hour: 11, id: "hawa" },
    { time: "1:00 PM", hour: 13, id: "jantar" },
    { time: "4:00 PM", hour: 16, id: must },
    { time: "6:30 PM", hour: 18, id: "nahargarh" },
  ];
  const sliced = plan.time === "half" ? raw.slice(1, 3) : raw;
  const resolved = sliced.map((s) => resolveStop(s, plan.stopReplacements));

  // If there are replacements for hotspots not present in sliced stops, include them
  if (plan.stopReplacements) {
    Object.entries(plan.stopReplacements).forEach(([hotspotId, gemId]) => {
      if (!sliced.some((s) => s.id === hotspotId)) {
        if (!resolved.some((s) => s.id === gemId)) {
          try {
            const hotspot = byId(hotspotId);
            resolved.push({
              time: "5:00 PM",
              hour: 17,
              id: gemId,
              note: `Added as quieter alternative to crowded ${hotspot.name}`,
            });
          } catch {
            // ignore
          }
        }
      }
    });
  }

  resolved.sort((a, b) => a.hour - b.hour);
  return resolved;
}


export function buildSmart(plan: Plan): Stop[] {
  const must = plan.must || "amber";
  const p = byId(must);
  const alts = p.alternatives ?? ["panna", "jaigarh"];
  const s: Stop[] = [
    { time: "9:00 AM", hour: 9, id: must, note: "Moved to morning to avoid midday tour buses" },
    {
      time: "11:30 AM",
      hour: 11,
      id: alts[1] ?? "panna",
      note: "Hidden gem alternative, 4 km away",
    },
    {
      time: "1:00 PM",
      hour: 13,
      id: "food",
      food: true,
      note: "Local Rajasthani thali — Laxmi Misthan Bhandar style",
    },
    {
      time: "3:00 PM",
      hour: 15,
      id: alts[0] ?? "jaigarh",
      note: "Rich heritage vibe, half the crowd",
    },
    { time: "5:30 PM", hour: 17, id: "jalmahal", note: "Sunset promenade viewpoint" },
  ];
  const sliced = plan.time === "half" ? raw.slice(0, 3) : raw;
  const resolved = sliced.map((s) => resolveStop(s, plan.stopReplacements));

  // If there are replacements for hotspots not present in sliced stops, include them
  if (plan.stopReplacements) {
    Object.entries(plan.stopReplacements).forEach(([hotspotId, gemId]) => {
      if (!sliced.some((s) => s.id === hotspotId)) {
        if (!resolved.some((s) => s.id === gemId)) {
          try {
            const hotspot = byId(hotspotId);
            resolved.push({
              time: "4:30 PM",
              hour: 16,
              id: gemId,
              note: `Added as quieter alternative to crowded ${hotspot.name}`,
            });
          } catch {
            // ignore
          }
        }
      }
    });
  }

  // Avoid duplicate stops across the itinerary
  const used = new Set<string>();
  for (let i = 0; i < resolved.length; i++) {
    const s = resolved[i];
    if (!s || s.food) continue;
    if (used.has(s.id)) {
      const unusedAlt =
        alts.find((a) => !used.has(a)) ??
        PLACES.find((pl) => pl.gem && !used.has(pl.id))?.id ??
        "jaigarh";
      resolved[i] = {
        time: s.time,
        hour: s.hour,
        id: unusedAlt,
        note: "Hidden gem, quieter alternative",
      };
      used.add(unusedAlt);
    } else {
      used.add(s.id);
    }
  }

  resolved.sort((a, b) => a.hour - b.hour);
  return resolved;
}

export function Itinerary({
  plan,
  optimized,
  setOptimized,
  onReward,
  observations = [],
}: {
  plan: Plan;
  optimized: boolean;
  setOptimized: (b: boolean) => void;
  onReward: (n: number) => void;
  observations?: VerifiedObservation[];
}) {
  const day = plan.day;
<<<<<<< HEAD

  // Run the rule-based engine
  const enginePlan = useMemo(() => {
    const startDateTime = `${plan.fromDate ?? "2026-10-18"}T${plan.fromTime ?? "09:00"}:00`;
    const endDateTime = `${plan.toDate ?? plan.fromDate ?? "2026-10-18"}T${plan.toTime ?? "19:00"}:00`;

    return planItinerary({
      startDateTime,
      endDateTime,
      budget: plan.budget,
      interests: plan.interests,
      groupType: plan.type,
      crowdPreference: optimized ? "avoid" : plan.crowd,
      mustVisitPlaceIds:
        plan.mustVisits && plan.mustVisits.length > 0
          ? plan.mustVisits
          : plan.must
            ? [plan.must]
            : ["amber"],
      foodPreferences: plan.foodInterests,
      dietaryRequirements: plan.dietary,
      additionalRequests: plan.notes,
      stopReplacements: plan.stopReplacements,
      pacePreference: plan.pacePreference,
    });
  }, [plan, optimized]);

  // Stops to display
  const stops = useMemo(() => {
    if (enginePlan.allStops.length > 0) {
      return enginePlan.allStops.map((s) => ({
        time: s.startTime,
        hour: Math.round(s.startHour),
        id: s.id,
        note: s.recommendationReason,
        food: s.isFoodStop,
        transitSummary: s.transitSummary,
        cost: s.estimatedCostInr,
      }));
    }
    return optimized ? buildSmart(plan) : buildOriginal(plan);
  }, [enginePlan, optimized, plan]);

  const scoreOf = useCallback(
    (s: { id: string; hour: number; food?: boolean }) =>
      s.food ? 30 : crowdScore(byId(s.id), { day, hour: s.hour, festival: false, weather: "clear" }).score,
    [day]
  );
  const avg = Math.round(stops.reduce((a, s) => a + scoreOf(s), 0) / Math.max(1, stops.length));
  const unreplacedPlan = { ...plan, stopReplacements: undefined };
  const origAvg = Math.round(
    buildOriginal(unreplacedPlan).reduce((a, s) => a + scoreOf(s), 0) /
      Math.max(1, buildOriginal(unreplacedPlan).length)
  );
=======
  const stops = optimized ? buildSmart(plan) : buildOriginal(plan);

  const getPredictionForStop = (s: Stop) => {
    if (s.food) {
      return { score: 30, category: "Low" as const, predictionType: "estimated" as const };
    }
    return predictCrowd(s.id, { day, hour: s.hour, observations });
  };

  const scores = stops.map((s) => getPredictionForStop(s).score);
  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / stops.length);

  const origStops = buildOriginal(plan);
  const origScores = origStops.map((s) => getPredictionForStop(s).score);
  const origAvg = Math.round(origScores.reduce((a, b) => a + b, 0) / origStops.length);

  const cost = stops.reduce((a, s) => a + (s.food ? 250 : byId(s.id).entry), 0) + 600;
>>>>>>> origin/main
  const must = byId(plan.must || "amber");
  const mustPred = predictCrowd(must.id, { day, hour: 16, observations });

  // Dynamic travel & wait times
  const totalTravelMin = useMemo(() => {
    const calc = enginePlan.days.reduce((acc, d) => acc + d.totalTravelTimeMinutes, 0);
    if (calc > 0) return calc;
    return hasReplacements ? 75 : optimized ? 70 : 95;
  }, [enginePlan, hasReplacements, optimized]);

  const totalWaitMin = useMemo(() => {
    return Math.max(
      25,
      Math.round(
        stops.reduce((acc, s) => acc + (scoreOf(s) > 60 ? 30 : scoreOf(s) > 40 ? 15 : 5), 0)
      )
    );
  }, [stops, scoreOf]);

  const totalCostEstimate = useMemo(() => {
    return enginePlan.allStops.reduce((acc, s) => acc + (s.estimatedCostInr ?? 0), 0);
  }, [enginePlan]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <div className="rounded-2xl border bg-card p-6 shadow">
        {!optimized && !hasReplacements && (
          <div className="mb-5 rounded-xl border-l-4 border-crowd-critical bg-secondary p-4">
            <p className="font-bold">
              ⚠ {must.name} at 4 PM: {mustPred.score}/100 crowd pressure — {mustPred.category}
            </p>
            <p className="text-sm text-muted-foreground">
              {day} plus evening tourist rush. Estimated entry queue ~40+ minutes.
            </p>
          </div>
        )}

        {/* Engine Warnings & Conflict Notices */}
        {enginePlan.warnings.length > 0 && (
          <div className="mb-5 space-y-2">
            {enginePlan.warnings.map((w, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-foreground animate-in fade-in"
              >
                <span className="shrink-0 text-amber-600 font-bold text-sm">ℹ</span>
                <p className="leading-snug">{w.message}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
<<<<<<< HEAD
          <h3 className="text-2xl">{optimized ? "Musafir Smart Route" : "Your itinerary plan"}</h3>
          <span className="text-sm text-muted-foreground">
            {day} · {plan.type} · ₹{plan.budget} · {stops.length} stops
=======
          <h3 className="text-2xl">{optimized ? "Raahi Smart Route" : "Your original plan"}</h3>
          <span className="text-sm text-muted-foreground">
            {day} · {plan.type} · ₹{plan.budget}
>>>>>>> origin/main
          </span>
        </div>

        <ol className="mt-5 space-y-4 border-l-2 border-dashed border-primary pl-6">
          {stops.map((s, i) => {
            const p = s.food ? null : byId(s.id);
            const pred = getPredictionForStop(s);
            return (
              <li
                key={i}
                className="relative animate-in fade-in slide-in-from-left-4"
                style={{ animationDelay: `${i * 90}ms`, animationFillMode: "both" }}
              >
                <span className="absolute -left-[33px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-saffron ring-4 ring-background" />
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-display text-primary">{s.time}</span>
<<<<<<< HEAD
                  <span className="font-semibold">{p ? p.name : s.id === "food" ? "Local food stop" : "Food stop"}</span>
                  {p?.gem && <span className="rounded-full bg-gem px-2 py-0.5 text-xs text-primary-foreground">★ Hidden gem</span>}
                  <Badge score={scoreOf(s)} />
                  {s.cost !== null && s.cost !== undefined && (
                    <span className="text-xs text-muted-foreground font-mono">
                      · {s.cost === 0 ? "Free entry" : `₹${s.cost}`}
                    </span>
                  )}
                </div>
                {s.note && <p className="text-sm text-muted-foreground mt-0.5">{s.note}</p>}
                {i < stops.length - 1 && (
                  <p className="text-xs text-muted-foreground">
                    ↓ {s.transitSummary || `~${15 + i * 5} min by auto-rickshaw`}
=======
                  <span className="font-semibold">{p ? p.name : "Local food stop"}</span>
                  {p?.gem && (
                    <span className="rounded-full bg-gem px-2 py-0.5 text-xs text-primary-foreground">
                      ★ Hidden gem
                    </span>
                  )}
                  <Badge score={pred.score} type={pred.predictionType} />
                </div>
                {s.note && optimized && <p className="text-sm text-muted-foreground">{s.note}</p>}
                {i < stops.length - 1 && (
                  <p className="text-xs text-muted-foreground">
                    ↓ ~{15 + i * 5} min by auto-rickshaw
>>>>>>> origin/main
                  </p>
                )}
              </li>
            );
          })}
        </ol>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="text-sm">
            Est. budget: <b>₹{cost.toLocaleString("en-IN")}</b> (monument tickets + food +
            transport)
          </span>
          {!optimized ? (
            <button
              onClick={() => {
                setOptimized(true);
                onReward(80);
              }}
              className="ml-auto rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-foreground shadow transition hover:bg-saffron"
            >
              ✨ Optimize My Route
            </button>
          ) : (
            <button
              onClick={() => setOptimized(false)}
              className="ml-auto rounded-full border px-5 py-2.5 text-sm"
            >
              View original
            </button>
          )}
        </div>
      </div>
<<<<<<< HEAD
      <div className="rounded-2xl bg-indigo-deep p-6 text-primary-foreground shadow">
        <h3 className="text-2xl text-gold">Before vs after</h3>
        <table className="mt-4 w-full text-sm">
          <thead><tr className="text-left opacity-70"><th className="py-2">Metric</th><th>Original</th><th>Current Plan</th></tr></thead>
          <tbody className="[&_td]:border-t [&_td]:border-primary-foreground/15 [&_td]:py-2.5">
            <tr><td>Crowd exposure</td><td>{origAvg}/100</td><td className="font-bold text-gold">{avg}/100</td></tr>
            <tr><td>Estimated wait</td><td>110 min</td><td className="font-bold text-gold">{totalWaitMin} min</td></tr>
            <tr><td>Road transit</td><td>95 min</td><td className="font-bold text-gold">{totalTravelMin} min</td></tr>
            <tr><td>Estimated expenses</td><td>₹1,200</td><td className="font-bold text-gold">₹{totalCostEstimate.toLocaleString("en-IN")}</td></tr>
            <tr><td>Hidden gems</td><td>0</td><td className="font-bold text-gold">{stops.filter((s) => !s.food && byId(s.id).gem).length}</td></tr>
            <tr><td>Rewards</td><td>0</td><td className="font-bold text-gold">{hasReplacements ? "+20 pts" : optimized ? "+80 pts" : "—"}</td></tr>
          </tbody>
        </table>
        <p className="mt-4 text-xs opacity-70">Estimates dynamically reflect active destination replacements & transit models.</p>
=======
      <div className="rounded-2xl bg-indigo-deep p-6 text-primary-foreground shadow flex flex-col justify-between">
        <div>
          <h3 className="text-2xl text-gold">Before vs after</h3>
          <p className="text-xs text-primary-foreground/75 mt-1">
            Comparing typical tourist route against crowd-diverted Raahi schedule
          </p>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left opacity-70">
                <th className="py-2">Metric</th>
                <th>Original</th>
                <th>Smart</th>
              </tr>
            </thead>
            <tbody className="[&_td]:border-t [&_td]:border-primary-foreground/15 [&_td]:py-2.5">
              <tr>
                <td>Average crowd index</td>
                <td>{origAvg}/100</td>
                <td className="font-bold text-gold">{optimized ? `${avg}/100` : "—"}</td>
              </tr>
              <tr>
                <td>Estimated queue wait</td>
                <td>110 min</td>
                <td className="font-bold text-gold">{optimized ? "35 min" : "—"}</td>
              </tr>
              <tr>
                <td>Hidden gems visited</td>
                <td>0</td>
                <td className="font-bold text-gold">{optimized ? 2 : "—"}</td>
              </tr>
              <tr>
                <td>Raahi Points earned</td>
                <td>0</td>
                <td className="font-bold text-gold">{optimized ? "+80 pts" : "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs opacity-60">
          Evaluated using Raahi Baseline v1.0 with congestion diversion rules.
        </p>
>>>>>>> origin/main
      </div>
    </div>
  );
}

/* ---------------- Forecast ---------------- */
export function Forecast({ observations = [] }: { observations?: VerifiedObservation[] }) {
  const [f, setF] = useState<ForecastInput>({
    day: "Sun",
    hour: 16,
    festival: false,
    weather: "clear",
  });
  const [sel, setSel] = useState("amber");
  const p = byId(sel);

  const pred = predictCrowd(sel, {
    day: f.day,
    hour: f.hour,
    festival: f.festival,
    weather: f.weather,
    observations,
  });

  const fmt = (h: number) => `${((h + 11) % 12) + 1}:00 ${h < 12 ? "AM" : "PM"}`;
  const hours = Array.from({ length: 13 }, (_, i) => i + 7);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
      <div className="space-y-4 rounded-2xl border bg-card p-6">
        <select
          value={sel}
          onChange={(e) => setSel(e.target.value)}
          className="w-full rounded-lg border bg-background px-3 py-2 font-semibold"
        >
          {PLACES.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name} ({x.hindi})
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1">
          {DAYS.map((d) => (
            <button
              key={d}
              onClick={() => setF({ ...f, day: d })}
              className={`rounded-md px-2.5 py-1 text-sm ${
                f.day === d ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
        <label className="block text-sm">
          Time: <b>{fmt(f.hour)}</b>
          <input
            type="range"
            min={7}
            max={19}
            value={f.hour}
            onChange={(e) => setF({ ...f, hour: +e.target.value })}
            className="w-full accent-[var(--primary)]"
          />
        </label>
        <div className="flex flex-wrap gap-2 text-sm">
          <button
            onClick={() => setF({ ...f, festival: !f.festival })}
            className={`rounded-full border px-3 py-1 ${
              f.festival ? "bg-saffron text-primary-foreground" : ""
            }`}
          >
            🪔 Festival Surge
          </button>
          {(["clear", "hot", "rain"] as const).map((w) => (
            <button
              key={w}
              onClick={() => setF({ ...f, weather: w })}
              className={`rounded-full border px-3 py-1 capitalize ${
                f.weather === w ? "bg-indigo-deep text-primary-foreground" : ""
              }`}
            >
              {w === "clear" ? "☀" : w === "hot" ? "🔥" : "🌧"} {w}
            </button>
          ))}
        </div>

        {/* Transparent Factor Attribution */}
        <div className="rounded-xl bg-muted p-4 text-sm space-y-1.5">
          <div className="flex items-center justify-between font-semibold border-b pb-1.5 mb-2">
            <span>Factor Attribution</span>
            <span className="text-xs text-muted-foreground font-mono">{pred.modelVersion}</span>
          </div>
          <div className="flex justify-between">
            <span>Historical Base Score</span>
            <span>{pred.factors.historicalBase}</span>
          </div>
          <div className="flex justify-between">
            <span>Weekend Factor ({f.day})</span>
            <span>
              {pred.factors.weekendEffect >= 0 ? "+" : ""}
              {pred.factors.weekendEffect}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Time of Day ({fmt(f.hour)})</span>
            <span>
              {pred.factors.timeOfDayEffect >= 0 ? "+" : ""}
              {pred.factors.timeOfDayEffect}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Event / Festival</span>
            <span>
              {pred.factors.eventEffect >= 0 ? "+" : ""}
              {pred.factors.eventEffect}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Weather ({f.weather})</span>
            <span>
              {pred.factors.weatherEffect >= 0 ? "+" : ""}
              {pred.factors.weatherEffect}
            </span>
          </div>
          <div className="flex justify-between border-t pt-1 font-medium">
            <span>Verified Observations Adjustment</span>
            <span
              className={pred.factors.observationAdjustment !== 0 ? "text-primary font-bold" : ""}
            >
              {pred.factors.observationAdjustment >= 0 ? "+" : ""}
              {pred.factors.observationAdjustment}
            </span>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border bg-card p-6 flex flex-col justify-between">
        <div className="jaali absolute inset-0 opacity-60 pointer-events-none" />
        <div className="relative">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-display text-saffron">{p.hindi}</p>
              <h3 className="text-3xl font-bold">{p.name}</h3>
            </div>
            <div className="text-right">
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                  pred.predictionType === "observed"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                }`}
              >
                {pred.predictionType === "observed"
                  ? "● Verified Observation"
                  : "○ Estimated — Baseline v1.0"}
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {pred.evidence.dataFreshnessMinutes
                  ? `Freshness: ${pred.evidence.dataFreshnessMinutes}m ago`
                  : "Baseline prior (no live reports)"}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-end gap-4">
            <span className="font-serif text-7xl text-primary transition-all">{pred.score}</span>
            <div className="pb-3">
              <span className="text-muted-foreground">/100 Congestion Index</span>
              <div>
                <Badge score={pred.score} type={pred.predictionType} />
              </div>
            </div>
          </div>

          <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-crowd-low via-crowd-moderate to-crowd-critical transition-all duration-500"
              style={{ width: `${pred.score}%` }}
            />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-secondary p-3">
              <p className="text-muted-foreground">Best visiting window</p>
              <p className="font-bold">{p.best}</p>
            </div>
            <div className="rounded-lg bg-secondary p-3">
              <p className="text-muted-foreground">Predicted peak hours</p>
              <p className="font-bold">{p.peak}</p>
            </div>
          </div>

          <p className="mt-3 text-sm">
            <b>Recommendation:</b> {pred.recommendations.reason}
          </p>

          <div className="mt-5 flex h-24 items-end gap-1">
            {hours.map((h) => {
              const hourlyPred = predictCrowd(sel, {
                day: f.day,
                hour: h,
                festival: f.festival,
                weather: f.weather,
                observations,
              });
              const s = hourlyPred.score;
              return (
                <button
                  key={h}
                  onClick={() => setF({ ...f, hour: h })}
                  className="group flex flex-1 flex-col items-center gap-1"
                  title={`${fmt(h)}: ${s}/100 (${hourlyPred.category})`}
                >
                  <div
                    className={`w-full rounded-t ${levelClass[level(s)].split(" ")[0]} ${
                      h === f.hour ? "ring-2 ring-foreground" : "opacity-80 group-hover:opacity-100"
                    }`}
                    style={{ height: `${Math.round(s * 0.8)}px` }}
                  />
                  <span className="text-[10px] text-muted-foreground">{h > 12 ? h - 12 : h}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Hidden gems ---------------- */
export function HiddenGems({ observations = [] }: { observations?: VerifiedObservation[] }) {
  const [hot, setHot] = useState("amber");
  const hotspots = PLACES.filter((p) => p.alternatives);
  const p = byId(hot);
  const dist: Record<string, string> = {
    jaigarh: "3.5 km",
    panna: "4.2 km",
    sisodia: "8 km",
    albert: "1.8 km",
    patrika: "6 km",
    citypalace: "0.4 km",
    anokhi: "11 km",
    jalmahal: "5 km",
    kanak: "1 km",
    tripolia: "1.2 km",
    sanganer: "13 km",
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap justify-center gap-2">
        {hotspots.map((h) => (
          <button
            key={h.id}
            onClick={() => setHot(h.id)}
            className={`rounded-full border px-4 py-1.5 text-sm ${
              hot === h.id
                ? "border-crowd-critical bg-crowd-critical text-primary-foreground"
                : "bg-card"
            }`}
          >
            {h.name}
          </button>
        ))}
      </div>
      <p className="mb-6 text-center text-muted-foreground">
        {p.name} attracts heavy tour buses. Try these nearby cultural alternatives:
      </p>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...(p.alternatives ?? []), ...(hot === "amber" ? ["sisodia"] : [])].map((id, i) => {
          const g = byId(id);
          const pred = predictCrowd(g.id, { day: "Sun", hour: 16, observations });
          const match = Math.round(
            (g.tags.filter((t) => p.tags.includes(t)).length / p.tags.length) * 40 + 55,
          );
          return (
            <div
              key={id}
              className="arch group border-2 border-gold bg-card p-6 pt-12 text-center shadow transition hover:-translate-y-1 hover:shadow-xl animate-in fade-in zoom-in-95"
              style={{ animationDelay: `${i * 100}ms`, animationFillMode: "both" }}
            >
              <p className="font-display text-saffron">{g.hindi}</p>
              <h3 className="text-2xl font-bold">{g.name}</h3>
              <div className="my-3 flex justify-center gap-2 flex-wrap">
                <Badge score={pred.score} type={pred.predictionType} />
                <span className="rounded-full bg-gem px-2.5 py-0.5 text-xs font-bold text-primary-foreground">
                  {Math.min(match, 98)}% vibe match
                </span>
              </div>
              <p className="text-sm">Shared tags: {g.tags.join(", ")}</p>
              <p className="text-sm text-muted-foreground">
                {dist[id] ?? "3 km"} away · +{8 + i * 6} min by auto
              </p>
              <p className="mt-3 rounded-lg bg-secondary p-2 text-sm italic">“{g.update}”</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Live map ---------------- */
export { LiveMap } from "./LiveMap";

/* ---------------- Pulse (Community Reporting) ---------------- */
export function Pulse({
  reports,
  onSubmitReport,
}: {
  reports: CrowdReportRecord[];
  onSubmitReport: (placeId: string, status: "Quiet" | "Moderate" | "Busy", tip: string) => void;
}) {
  const [place, setPlace] = useState("amber");
  const [status, setStatus] = useState<"Quiet" | "Moderate" | "Busy">("Quiet");
  const [tip, setTip] = useState("");
  const tone = {
    Quiet: "bg-crowd-low",
    Moderate: "bg-crowd-moderate",
    Busy: "bg-crowd-critical",
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitReport(place, status, tip);
    setTip("");
  };

  const getFormatAgo = (dateStr: string) => {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 60000;
    if (isNaN(diff)) return "recently";
    if (diff < 1) return "just now";
    if (diff < 60) return `${Math.floor(diff)} min ago`;
    return `${Math.floor(diff / 60)}h ago`;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
        <h3 className="text-2xl font-bold">I'm here right now</h3>
        <p className="text-xs text-muted-foreground">
          Contribute on-ground crowd intelligence. Reports are verified by Rajasthan Tourism
          Command.
        </p>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase">Monument</label>
          <select
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 mt-1"
          >
            {PLACES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.hindi})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase">
            Current Crowd Level
          </label>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {(["Quiet", "Moderate", "Busy"] as const).map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => setStatus(s)}
                className={`rounded-lg border-2 py-3 font-semibold text-sm transition ${
                  status === s
                    ? `${tone[s]} border-foreground text-primary-foreground shadow`
                    : "bg-background hover:bg-muted"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase">
            On-ground Tip (Optional)
          </label>
          <input
            value={tip}
            onChange={(e) => setTip(e.target.value)}
            maxLength={140}
            placeholder="e.g. Suraj Pol entry queue is short right now!"
            className="w-full rounded-lg border bg-background px-3 py-2 mt-1 text-sm"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-full bg-primary py-2.5 font-semibold text-primary-foreground shadow hover:bg-saffron transition"
        >
          Share Check-In · +20 Raahi Pts
        </button>
        <p className="text-[11px] text-muted-foreground text-center">
          1 check-in per spot every 15 min. Verified reports influence the public map and forecast.
        </p>
      </form>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>Recent Community Reports ({reports.length})</span>
          <span>DoT Moderation Active</span>
        </div>
        <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
          {reports.map((r) => {
            const placeObj = byId(r.destinationId);
            return (
              <div
                key={r.id}
                className="flex gap-3 rounded-xl border bg-card p-4 animate-in fade-in slide-in-from-top-2"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-saffron font-display text-primary-foreground font-bold">
                  {r.userAlias?.[0] || "T"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <b>{r.userAlias}</b>
                    <span className="text-muted-foreground text-xs">
                      at {placeObj?.name || r.destinationName} · {getFormatAgo(r.submittedAt)}
                    </span>
                    <span
                      className={`ml-auto rounded-full px-2 py-0.5 text-xs text-primary-foreground ${
                        tone[r.statusLevel]
                      }`}
                    >
                      {r.statusLevel}
                    </span>
                  </div>
                  {r.tipText && <p className="mt-1 text-sm text-foreground/90">"{r.tipText}"</p>}
                  <div className="mt-2 flex items-center gap-2 text-[11px]">
                    <span
                      className={`rounded px-1.5 py-0.2 border ${
                        r.moderationStatus === "verified"
                          ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                          : r.moderationStatus === "rejected"
                            ? "bg-red-500/10 text-red-700 border-red-500/30"
                            : "bg-amber-500/10 text-amber-700 border-amber-500/30"
                      }`}
                    >
                      {r.moderationStatus === "verified"
                        ? "✓ Verified by Authority"
                        : r.moderationStatus === "rejected"
                          ? "✕ Flagged / Disregarded"
                          : "⏳ Pending DoT Review"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Rewards / Circle / What-If ---------------- */
export function Extras({ points }: { points: number }) {
  const [shift, setShift] = useState(20);
  const [votes, setVotes] = useState<Record<string, number>>({ jaigarh: 2, panna: 1, albert: 1 });
  const badges = [
    { n: "Hidden Gem Hunter", need: 80, icon: "💎" },
    { n: "Smart Explorer", need: 120, icon: "🧭" },
    { n: "Crowd Navigator", need: 200, icon: "🐘" },
  ];
  const sim = useMemo(() => {
    const amber = 86 - shift * 1.1;
    return {
      amber: Math.round(amber),
      jaigarh: Math.round(42 + shift * 0.5),
      panna: Math.round(28 + shift * 0.4),
      wait: Math.round(110 - shift * 2.4),
      revenue: Math.round(shift * 0.9 * 10) / 10,
    };
  }, [shift]);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="rounded-2xl bg-gradient-to-br from-primary to-saffron p-6 text-primary-foreground shadow">
        <h3 className="text-2xl font-bold">Raahi Rewards</h3>
        <p className="mt-2 font-serif text-6xl">{points}</p>
        <p className="opacity-80">points earned (persisted across sessions)</p>
        <div className="mt-5 space-y-2">
          {badges.map((b) => (
            <div
              key={b.n}
              className={`flex items-center gap-3 rounded-lg bg-background/15 p-2.5 ${
                points >= b.need ? "" : "opacity-45 grayscale"
              }`}
            >
              <span className="text-2xl">{b.icon}</span>
              <span className="flex-1 font-semibold">{b.n}</span>
              <span className="text-xs">{points >= b.need ? "Unlocked" : `${b.need} pts`}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border bg-card p-6">
        <h3 className="text-2xl font-bold">Raahi Circle</h3>
        <p className="text-sm text-muted-foreground">
          Trip with friends — vote on the 3 PM low-crowd stop
        </p>
        <div className="my-4 flex -space-x-2">
          {["A", "P", "As", "G"].map((m) => (
            <span
              key={m}
              className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-card bg-indigo-deep text-sm text-primary-foreground"
            >
              {m}
            </span>
          ))}
        </div>
        {Object.entries(votes).map(([id, v]) => (
          <button
            key={id}
            onClick={() => setVotes({ ...votes, [id]: v + 1 })}
            className="mb-2 block w-full rounded-lg border p-2 text-left text-sm hover:border-primary"
          >
            <div className="flex justify-between">
              <span>{byId(id).name}</span>
              <span>{v} 👍</span>
            </div>
            <div className="mt-1 h-1.5 rounded bg-muted">
              <div className="h-full rounded bg-saffron" style={{ width: `${(v / 8) * 100}%` }} />
            </div>
          </button>
        ))}
        <button
          onClick={() => navigator.clipboard?.writeText("https://raahi-seven-xi.vercel.app")}
          className="mt-2 w-full rounded-full border border-primary py-2 text-sm text-primary"
        >
          🔗 Copy invite link
        </button>
      </div>
      <div className="rounded-2xl bg-indigo-deep p-6 text-primary-foreground">
        <h3 className="text-2xl text-gold font-bold">What-If Dispersal Model</h3>
        <p className="text-xs opacity-75">Tourism Authority crowd simulation</p>
        <label className="mt-4 block text-sm">
          Shift <b className="text-gold">{shift}%</b> of Amer Fort visitors
          <input
            type="range"
            min={0}
            max={30}
            step={10}
            value={shift}
            onChange={(e) => setShift(+e.target.value)}
            className="w-full accent-[var(--gold)]"
          />
        </label>
        <div className="mt-4 space-y-2 text-sm">
          {[
            ["Amer Fort", sim.amber],
            ["Jaigarh Fort", sim.jaigarh],
            ["Panna Meena Kund", sim.panna],
          ].map(([n, v]) => (
            <div key={n as string}>
              <div className="flex justify-between">
                <span>{n}</span>
                <span>{v}/100</span>
              </div>
              <div className="h-2 rounded bg-primary-foreground/15">
                <div
                  className={`h-full rounded ${
                    levelClass[level(v as number)].split(" ")[0]
                  } transition-all`}
                  style={{ width: `${v}%` }}
                />
              </div>
            </div>
          ))}
          <p className="pt-2 text-xs">
            Avg wait at Amer: <b className="text-gold">{sim.wait} min</b>
          </p>
          <p className="text-xs">
            Local business uplift: <b className="text-gold">+₹{sim.revenue}L / month</b>
          </p>
        </div>
      </div>
    </div>
  );
}
