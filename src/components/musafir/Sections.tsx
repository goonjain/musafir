import { useEffect, useMemo, useState } from "react";
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
import {
  predictCrowd,
  type CrowdPrediction,
  type PredictionType,
  type VerifiedObservation,
} from "@/lib/crowd-service";
import { observationsRepository, type CrowdReportRecord } from "@/lib/observations-repository";

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
};

export function Planner({
  plan,
  setPlan,
  onGenerate,
}: {
  plan: Plan;
  setPlan: (p: Plan) => void;
  onGenerate: () => void;
}) {
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
          >
            Plan my Jaipur day →
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const must = byId(plan.must || "amber");
  const mustPred = predictCrowd(must.id, { day, hour: 16, observations });

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
        <div className="flex items-center justify-between">
          <h3 className="text-2xl">{optimized ? "Raahi Smart Route" : "Your original plan"}</h3>
          <span className="text-sm text-muted-foreground">
            {day} · {plan.type} · ₹{plan.budget}
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
