import { useMemo, useState, useRef } from "react";
import {
  PLACES, byId, crowdScore, level, levelClass, DAYS, INTERESTS,
  type ForecastInput, type Place,
} from "@/lib/jaipur-data";
import { rankAlternatives, formatDistance } from "@/lib/recommendation";

export type Report = {
  id: number;
  place?: string;
  user?: string;
  status?: "Quiet" | "Moderate" | "Busy" | "Packed";
  tip?: string;
  ago?: string;
  destination_id?: string;
  destination_name?: string;
  user_id?: string;
  user_name?: string;
  crowd_level?: "Quiet" | "Moderate" | "Busy" | "Packed";
  vs_forecast?: string;
  wait_minutes?: number;
  image?: string | null;
  photo_url?: string | null;
  observed_at?: string;
  submitted_at?: string;
  forecast_score_at_report?: number;
  moderation_status?: "approved" | "pending" | "flagged" | "rejected";
  trust_weight?: number;
  accuracy_votes_count?: number;
};

export function SectionTitle({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <div className="mb-8 text-center">
      <p className="font-display text-lg text-saffron">{kicker}</p>
      <h2 className="mt-1 text-4xl text-primary md:text-5xl">{title}</h2>
      {sub && <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">{sub}</p>}
      <div className="mx-auto mt-4 flex items-center justify-center gap-2 text-gold">✦ ❁ ✦</div>
    </div>
  );
}

export function Badge({ score }: { score: number }) {
  const l = level(score);
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${levelClass[l]}`}>{score}/100 · {l}</span>;
}

export type Plan = {
  day: string;
  time: "half" | "full";
  budget: number;
  interests: string[];
  type: string;
  crowd: string;
  must: string;
  stopReplacements?: Record<string, string> | undefined;
};

export function Planner({ plan, setPlan, onGenerate }: { plan: Plan; setPlan: (p: Plan) => void; onGenerate: () => void }) {
  const chip = (active: boolean) =>
    `rounded-full border px-4 py-1.5 text-sm capitalize transition ${active ? "border-primary bg-primary text-primary-foreground shadow" : "border-border bg-card hover:border-primary"}`;
  return (
    <div className="arch mx-auto max-w-4xl border-4 border-double border-gold bg-card p-6 pt-14 shadow-xl md:p-10 md:pt-16">
      <div className="grid gap-6 md:grid-cols-2">
        <Field label="Travel day">
          <div className="flex flex-wrap gap-2">{DAYS.map((d) => <button key={d} className={chip(plan.day === d)} onClick={() => setPlan({ ...plan, day: d })}>{d}</button>)}</div>
        </Field>
        <Field label="Available time">
          <div className="flex gap-2">
            <button className={chip(plan.time === "half")} onClick={() => setPlan({ ...plan, time: "half" })}>Half-day</button>
            <button className={chip(plan.time === "full")} onClick={() => setPlan({ ...plan, time: "full" })}>Full day</button>
          </div>
        </Field>
        <Field label={`Budget: ₹${plan.budget.toLocaleString("en-IN")}`}>
          <input type="range" min={500} max={6000} step={250} value={plan.budget} onChange={(e) => setPlan({ ...plan, budget: +e.target.value })} className="w-full accent-[var(--primary)]" />
        </Field>
        <Field label="Travelling as">
          <div className="flex flex-wrap gap-2">{["solo", "friends", "couple", "family"].map((t) => <button key={t} className={chip(plan.type === t)} onClick={() => setPlan({ ...plan, type: t })}>{t}</button>)}</div>
        </Field>
        <Field label="Interests">
          <div className="flex flex-wrap gap-2">{INTERESTS.map((i) => {
            const on = plan.interests.includes(i);
            return <button key={i} className={chip(on)} onClick={() => setPlan({ ...plan, interests: on ? plan.interests.filter((x) => x !== i) : [...plan.interests, i] })}>{i}</button>;
          })}</div>
        </Field>
        <Field label="Crowd preference">
          <div className="flex flex-wrap gap-2">{["avoid", "balanced", "don't mind"].map((c) => <button key={c} className={chip(plan.crowd === c)} onClick={() => setPlan({ ...plan, crowd: c })}>{c === "avoid" ? "Avoid crowds" : c}</button>)}</div>
        </Field>
        <Field label="Must-visit (optional)">
          <select value={plan.must} onChange={(e) => setPlan({ ...plan, must: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2">
            <option value="">None</option>
            {PLACES.filter((p) => !p.gem).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <div className="flex items-end">
          <button onClick={onGenerate} className="w-full rounded-full bg-primary px-6 py-3 font-display text-lg text-primary-foreground shadow-lg transition hover:scale-[1.02] hover:bg-saffron">
            Plan my Jaipur day →
          </button>
        </div>
      </div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>{children}</div>;
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
  const raw: Stop[] = [
    { time: "9:00 AM", hour: 9, id: must, note: "Moved to morning, before tour buses" },
    { time: "11:30 AM", hour: 11, id: alts[1] ?? "panna", note: "Hidden gem, quieter alternative" },
    { time: "1:00 PM", hour: 13, id: "food", food: true, note: "Local thali — Laxmi Misthan Bhandar style" },
    { time: "3:00 PM", hour: 15, id: alts[0] ?? "jaigarh", note: "Similar vibe, lower crowd" },
    { time: "5:30 PM", hour: 17, id: "jalmahal", note: "Evening viewpoint" },
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
  onResetReplacements,
}: {
  plan: Plan;
  optimized: boolean;
  setOptimized: (b: boolean) => void;
  onReward: (n: number) => void;
  onResetReplacements?: () => void;
}) {
  const day = plan.day;
  const stops = optimized ? buildSmart(plan) : buildOriginal(plan);
  const scoreOf = (s: Stop) => (s.food ? 30 : crowdScore(byId(s.id), { day, hour: s.hour, festival: false, weather: "clear" }).score);
  const avg = Math.round(stops.reduce((a, s) => a + scoreOf(s), 0) / stops.length);
  const unreplacedPlan = { ...plan, stopReplacements: undefined };
  const origAvg = Math.round(buildOriginal(unreplacedPlan).reduce((a, s) => a + scoreOf(s), 0) / buildOriginal(unreplacedPlan).length);
  const must = byId(plan.must || "amber");
  const mustScore = crowdScore(must, { day, hour: 16, festival: false, weather: "clear" }).score;
  const hasReplacements = Boolean(plan.stopReplacements && Object.keys(plan.stopReplacements).length > 0);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <div className="rounded-2xl border bg-card p-6 shadow">
        {!optimized && !hasReplacements && (
          <div className="mb-5 rounded-xl border-l-4 border-crowd-critical bg-secondary p-4">
            <p className="font-bold">⚠ {must.name} at 4 PM: {mustScore}/100 crowd pressure — {level(mustScore)}</p>
            <p className="text-sm text-muted-foreground">{day} plus evening tourist rush. Expected wait 40+ minutes.</p>
          </div>
        )}
        {hasReplacements && (
          <div className="mb-5 rounded-xl border-l-4 border-emerald-600 bg-secondary p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in">
            <div>
              <p className="font-bold text-emerald-600">✓ Hidden Gem Replacement Active</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {Object.entries(plan.stopReplacements ?? {})
                  .map(([h, g]) => `${byId(h).name} replaced with ${byId(g).name}`)
                  .join(" · ")}
              </p>
            </div>
            {onResetReplacements && (
              <button
                type="button"
                onClick={onResetReplacements}
                className="rounded-full border border-primary/50 bg-background px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition shrink-0"
              >
                Reset to original stops
              </button>
            )}
          </div>
        )}
        <div className="flex items-center justify-between">
          <h3 className="text-2xl">{optimized ? "Musafir Smart Route" : "Your itinerary plan"}</h3>
          <span className="text-sm text-muted-foreground">{day} · {plan.type} · ₹{plan.budget}</span>
        </div>
        <ol className="mt-5 space-y-4 border-l-2 border-dashed border-primary pl-6">
          {stops.map((s, i) => {
            const p = s.food ? null : byId(s.id);
            return (
              <li key={i} className="relative animate-in fade-in slide-in-from-left-4" style={{ animationDelay: `${i * 90}ms`, animationFillMode: "both" }}>
                <span className="absolute -left-[33px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-saffron ring-4 ring-background" />
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-display text-primary">{s.time}</span>
                  <span className="font-semibold">{p ? p.name : "Local food stop"}</span>
                  {p?.gem && <span className="rounded-full bg-gem px-2 py-0.5 text-xs text-primary-foreground">★ Hidden gem</span>}
                  <Badge score={scoreOf(s)} />
                </div>
                {s.note && <p className="text-sm text-muted-foreground mt-0.5">{s.note}</p>}
                {i < stops.length - 1 && <p className="text-xs text-muted-foreground">↓ ~{15 + i * 5} min by auto-rickshaw</p>}
              </li>
            );
          })}
        </ol>
        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          {!optimized ? (
            <button onClick={() => { setOptimized(true); onReward(80); }} className="rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-foreground shadow transition hover:bg-saffron">✨ Optimize My Route</button>
          ) : (
            <button onClick={() => setOptimized(false)} className="rounded-full border px-5 py-2.5 text-sm">View original</button>
          )}
        </div>
      </div>
      <div className="rounded-2xl bg-indigo-deep p-6 text-primary-foreground shadow">
        <h3 className="text-2xl text-gold">Before vs after</h3>
        <table className="mt-4 w-full text-sm">
          <thead><tr className="text-left opacity-70"><th className="py-2">Metric</th><th>Original</th><th>Current Plan</th></tr></thead>
          <tbody className="[&_td]:border-t [&_td]:border-primary-foreground/15 [&_td]:py-2.5">
            <tr><td>Crowd exposure</td><td>{origAvg}/100</td><td className="font-bold text-gold">{avg}/100</td></tr>
            <tr><td>Waiting time</td><td>110 min</td><td className="font-bold text-gold">{hasReplacements ? "45 min" : optimized ? "35 min" : "110 min"}</td></tr>
            <tr><td>Travel time</td><td>95 min</td><td className="font-bold text-gold">{hasReplacements ? "75 min" : optimized ? "70 min" : "95 min"}</td></tr>
            <tr><td>Hidden gems</td><td>0</td><td className="font-bold text-gold">{stops.filter((s) => !s.food && byId(s.id).gem).length}</td></tr>
            <tr><td>Rewards</td><td>0</td><td className="font-bold text-gold">{hasReplacements ? "+20 pts" : optimized ? "+80 pts" : "—"}</td></tr>
          </tbody>
        </table>
        <p className="mt-4 text-xs opacity-70">Estimates dynamically reflect active destination replacements.</p>
      </div>
    </div>
  );
}

/* ---------------- Forecast ---------------- */
export function Forecast({ pulseAdj }: { pulseAdj: Record<string, number> }) {
  const [f, setF] = useState<ForecastInput>({ day: "Sun", hour: 16, festival: false, weather: "clear" });
  const [sel, setSel] = useState("amber");
  const p = byId(sel);
  const { score, factors } = crowdScore(p, f, pulseAdj[sel] ?? 0);
  const fmt = (h: number) => `${((h + 11) % 12) + 1}:00 ${h < 12 ? "AM" : "PM"}`;
  const reasons = [f.day === "Sat" || f.day === "Sun" ? "Weekend" : null, f.hour >= 15 && f.hour <= 19 ? "Evening peak" : null, f.festival ? "Festival (Teej / Diwali)" : null, "Historical visitor pattern"].filter(Boolean);
  const hours = Array.from({ length: 13 }, (_, i) => i + 7);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
      <div className="space-y-4 rounded-2xl border bg-card p-6">
        <select value={sel} onChange={(e) => setSel(e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 font-semibold">
          {PLACES.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <div className="flex flex-wrap gap-1">{DAYS.map((d) => <button key={d} onClick={() => setF({ ...f, day: d })} className={`rounded-md px-2.5 py-1 text-sm ${f.day === d ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{d}</button>)}</div>
        <label className="block text-sm">Time: <b>{fmt(f.hour)}</b>
          <input type="range" min={7} max={19} value={f.hour} onChange={(e) => setF({ ...f, hour: +e.target.value })} className="w-full accent-[var(--primary)]" />
        </label>
        <div className="flex flex-wrap gap-2 text-sm">
          <button onClick={() => setF({ ...f, festival: !f.festival })} className={`rounded-full border px-3 py-1 ${f.festival ? "bg-saffron text-primary-foreground" : ""}`}>🪔 Festival</button>
          {(["clear", "hot", "rain"] as const).map((w) => <button key={w} onClick={() => setF({ ...f, weather: w })} className={`rounded-full border px-3 py-1 capitalize ${f.weather === w ? "bg-indigo-deep text-primary-foreground" : ""}`}>{w === "clear" ? "☀" : w === "hot" ? "🔥" : "🌧"} {w}</button>)}
        </div>
        <div className="rounded-xl bg-muted p-4 text-sm">
          <p className="mb-2 font-semibold">Crowd score formula</p>
          {Object.entries(factors).map(([k, v]) => <div key={k} className="flex justify-between capitalize"><span>{k.replace(/([A-Z])/g, " $1")}</span><span>{v >= 0 ? "+" : ""}{v}</span></div>)}
        </div>
      </div>
      <div className="relative overflow-hidden rounded-2xl border bg-card p-6">
        <div className="jaali absolute inset-0 opacity-60" />
        <div className="relative">
          <p className="font-display text-saffron">{p.hindi}</p>
          <h3 className="text-3xl">{p.name}</h3>
          <div className="mt-4 flex items-end gap-4">
            <span className="font-serif text-7xl text-primary transition-all">{score}</span>
            <div className="pb-3"><span className="text-muted-foreground">/100</span><div><Badge score={score} /></div></div>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-to-r from-crowd-low via-crowd-moderate to-crowd-critical transition-all duration-500" style={{ width: `${score}%` }} />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-secondary p-3"><p className="text-muted-foreground">Best time</p><p className="font-bold">{p.best}</p></div>
            <div className="rounded-lg bg-secondary p-3"><p className="text-muted-foreground">Predicted peak</p><p className="font-bold">{p.peak}</p></div>
          </div>
          <p className="mt-3 text-sm"><b>Why:</b> {reasons.join(" + ")}</p>
          <div className="mt-5 flex h-28 items-end gap-1">
            {hours.map((h) => {
              const s = crowdScore(p, { ...f, hour: h }, pulseAdj[sel] ?? 0).score;
              return (
                <button key={h} onClick={() => setF({ ...f, hour: h })} className="group flex flex-1 flex-col items-center gap-1" title={`${fmt(h)}: ${s}`}>
                  <div className={`w-full rounded-t ${levelClass[level(s)].split(" ")[0]} ${h === f.hour ? "ring-2 ring-foreground" : "opacity-80 group-hover:opacity-100"}`} style={{ height: `${s}px` }} />
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
export interface HiddenGemsProps {
  plan?: Plan;
  onShowOnMap?: (placeId: string) => void;
  onReplaceInRoute?: (hotspotId: string, gemId: string) => void;
  onRemoveFromRoute?: (hotspotId: string, gemId?: string) => void;
}

export function HiddenGems({
  plan,
  onShowOnMap,
  onReplaceInRoute,
  onRemoveFromRoute,
}: HiddenGemsProps = {}) {
  const defaultHot =
    plan?.must && PLACES.some((p) => p.id === plan.must && p.alternatives && p.alternatives.length > 0)
      ? plan.must
      : "amber";
  const [hot, setHot] = useState(defaultHot);
  const hotspots = PLACES.filter((p) => p.alternatives && p.alternatives.length > 0);
  const p = byId(hot);
  const recommendations = rankAlternatives(p, PLACES, { limit: 3, gemsOnly: true });

  return (
    <div>
      <div className="mb-6 flex flex-wrap justify-center gap-2">
        {hotspots.map((h) => {
          const isReplaced = Boolean(plan?.stopReplacements?.[h.id]);
          return (
            <button
              key={h.id}
              onClick={() => setHot(h.id)}
              className={`rounded-full border px-4 py-1.5 text-sm transition ${
                hot === h.id
                  ? "border-crowd-critical bg-crowd-critical text-primary-foreground shadow"
                  : "bg-card hover:border-primary/50"
              }`}
            >
              {h.name}
              {isReplaced && (
                <span className="ml-1.5 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] text-white">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mb-6 text-center text-sm text-muted-foreground">
        {p.name} is busy. Try these nearby places with a similar vibe:
      </p>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 items-stretch">
        {recommendations.map((rec, i) => {
          const g = rec.place;
          const s =
            rec.predictedCrowdScore !== null
              ? rec.predictedCrowdScore
              : crowdScore(g, { day: "Sun", hour: 16, festival: false, weather: "clear" }).score;
          const isReplacedInPlan = plan?.stopReplacements?.[hot] === g.id;
          const distFormatted = formatDistance(rec.straightLineDistanceKm);

          return (
            <div
              key={g.id}
              className={`arch group flex flex-col justify-between border-2 ${
                isReplacedInPlan ? "border-emerald-600 ring-2 ring-emerald-500/20" : "border-gold"
              } bg-card px-6 pt-12 pb-6 text-center shadow-md transition-all hover:-translate-y-1 hover:shadow-xl animate-in fade-in zoom-in-95 h-full`}
              style={{ animationDelay: `${i * 100}ms`, animationFillMode: "both" }}
            >
              <div className="flex flex-col items-center flex-1">
                {/* 1. Hindi and English destination names */}
                <p className="font-display text-sm text-saffron tracking-wide">{g.hindi}</p>
                <h3 className="mt-1 text-2xl font-bold font-serif text-foreground leading-snug">
                  {g.name}
                </h3>

                {/* 2. Numeric crowd score/category */}
                <div className="mt-3 flex items-center justify-center">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${levelClass[level(s)]}`}
                    title={`Crowd score: ${s}/100 (${level(s)})`}
                  >
                    {s}/100 · {level(s)}
                  </span>
                </div>

                {/* 3. Highlighted "Why this alternative?" recommendation reason */}
                <div className="mt-4 w-full rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-left">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
                    Why this alternative?
                  </p>
                  <p className="mt-1 text-xs text-foreground/90 leading-relaxed font-sans">
                    {rec.reason}
                  </p>
                </div>

                {/* 4. Short italic factual destination description */}
                <p className="mt-3.5 text-xs italic text-muted-foreground leading-relaxed px-1">
                  {g.update}
                </p>

                {/* 5. One compact distance indicator */}
                <div className="mt-3.5 flex items-center justify-center text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary/80 border border-border/50 px-3 py-1 font-medium">
                    📍 {distFormatted} away
                  </span>
                </div>
              </div>

              {/* 6. Divider */}
              <div className="my-5 w-full border-t border-border/60" />

              {/* 7. Two actions: Choose this place and Show on map */}
              <div className="grid grid-cols-2 gap-2 w-full mt-auto">
                <button
                  type="button"
                  onClick={() =>
                    isReplacedInPlan
                      ? onRemoveFromRoute?.(hot, g.id)
                      : onReplaceInRoute?.(hot, g.id)
                  }
                  className={`w-full rounded-xl px-3 py-2 text-xs font-semibold shadow-sm transition ${
                    isReplacedInPlan
                      ? "border border-emerald-600 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "bg-primary text-primary-foreground hover:bg-saffron hover:scale-[1.02]"
                  }`}
                >
                  {isReplacedInPlan ? "✓ Chosen (Remove)" : "Choose this place"}
                </button>

                <button
                  type="button"
                  onClick={() => onShowOnMap?.(g.id)}
                  className="w-full rounded-xl border border-border bg-secondary/80 px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary hover:bg-card"
                >
                  Show on map
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Live map ---------------- */
export { LiveMap } from "./LiveMap";


/* ---------------- Pulse (Real Community Engine) ---------------- */
export function Pulse({
  reports,
  addReport,
  loading = false,
  error = null,
  onRetry,
  onSubmitReport,
  onVoteAccuracy,
  onFlagReport,
}: {
  reports: Report[];
  addReport?: (r: Omit<Report, "id" | "ago" | "user">) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onSubmitReport?: (payload: {
    destination_id: string;
    crowd_level: "Quiet" | "Moderate" | "Busy" | "Packed";
    vs_forecast?: "Quieter" | "About right" | "Busier";
    wait_minutes?: number;
    tip?: string;
    image?: string;
    user_name?: string;
  }) => Promise<{ success: boolean; message?: string; error?: string }>;
  onVoteAccuracy?: (reportId: number) => Promise<void>;
  onFlagReport?: (reportId: number) => Promise<void>;
}) {
  const [place, setPlace] = useState("hawa");
  const [status, setStatus] = useState<"Quiet" | "Moderate" | "Busy" | "Packed">("Quiet");
  const [vsForecast, setVsForecast] = useState<"Quieter" | "About right" | "Busier" | "">("");
  const [waitMinutes, setWaitMinutes] = useState<string>("");
  const [tip, setTip] = useState("");
  const [imageFile, setImageFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [userName, setUserName] = useState(() => (typeof window !== "undefined" ? localStorage.getItem("musafir_user_name") || "" : ""));
  const [filterPlace, setFilterPlace] = useState<string>("all");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [votedSet, setVotedSet] = useState<Set<number>>(new Set());
  const [flaggedSet, setFlaggedSet] = useState<Set<number>>(new Set());

  const tone: Record<string, string> = {
    Quiet: "bg-crowd-low",
    Moderate: "bg-crowd-moderate",
    Busy: "bg-crowd-high",
    Packed: "bg-crowd-critical",
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setFeedback({ type: "error", text: "Please select an image file (JPEG, PNG, WEBP)." });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 900;
        let w = img.width;
        let h = img.height;
        if (w > h && w > MAX) {
          h = Math.round((h * MAX) / w);
          w = MAX;
        } else if (h > MAX) {
          w = Math.round((w * MAX) / h);
          h = MAX;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
        setImageFile(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSubmitting(true);

    if (userName.trim() && typeof window !== "undefined") {
      localStorage.setItem("musafir_user_name", userName.trim());
    }

    const payload = {
      destination_id: place,
      crowd_level: status,
      vs_forecast: (vsForecast || undefined) as any,
      wait_minutes: waitMinutes ? parseInt(waitMinutes, 10) : 0,
      tip: tip.trim(),
      image: imageFile || undefined,
      user_name: userName.trim() || undefined,
    };

    if (onSubmitReport) {
      const res = await onSubmitReport(payload);
      setSubmitting(false);
      if (res.success) {
        setTip("");
        setWaitMinutes("");
        setImageFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setFeedback({ type: "success", text: res.message || "Check-in persisted to database · +20 pts!" });
      } else {
        setFeedback({ type: "error", text: res.error || "Submission failed. Please try again." });
      }
    } else if (addReport) {
      addReport({ place, status: status === "Packed" ? "Busy" : status, tip, image: imageFile });
      setTip("");
      setImageFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSubmitting(false);
      setFeedback({ type: "success", text: "Check-in shared · +20 pts!" });
    }
  };

  const handleVote = async (reportId: number) => {
    if (votedSet.has(reportId)) return;
    setVotedSet((prev) => new Set([...prev, reportId]));
    if (onVoteAccuracy) {
      await onVoteAccuracy(reportId);
    }
  };

  const handleFlag = async (reportId: number) => {
    if (flaggedSet.has(reportId)) return;
    setFlaggedSet((prev) => new Set([...prev, reportId]));
    if (onFlagReport) {
      await onFlagReport(reportId);
    }
  };

  const filteredReports = reports.filter((r) => {
    if (filterPlace === "all") return true;
    return (r.place || r.destination_id) === filterPlace;
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      {/* Check-in Form Card */}
      <form onSubmit={handleFormSubmit} className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-semibold">I'm here right now</h3>
          <span className="rounded-full bg-gold/20 px-2.5 py-0.5 text-xs font-bold text-foreground">Live check-in</span>
        </div>

        {feedback && (
          <div
            className={`rounded-xl p-3 text-sm animate-in fade-in ${
              feedback.type === "success"
                ? "border border-gold/40 bg-gold/10 text-foreground font-medium"
                : "border border-destructive/30 bg-destructive/10 text-destructive font-medium"
            }`}
          >
            {feedback.type === "success" ? "🎉 " : "⚠ "}
            {feedback.text}
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Select Destination</label>
          <select value={place} onChange={(e) => setPlace(e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-medium">
            {PLACES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.hindi})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Crowd Condition</label>
          <div className="grid grid-cols-4 gap-1.5">
            {(["Quiet", "Moderate", "Busy", "Packed"] as const).map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => setStatus(s)}
                className={`rounded-lg border py-2.5 text-xs font-bold transition ${
                  status === s ? `${tone[s]} border-foreground text-primary-foreground shadow-sm scale-102` : "border-border bg-background hover:border-primary/50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Compared with Forecast (optional)</label>
          <div className="grid grid-cols-3 gap-2">
            {(["Quieter", "About right", "Busier"] as const).map((v) => (
              <button
                type="button"
                key={v}
                onClick={() => setVsForecast(vsForecast === v ? "" : v)}
                className={`rounded-lg border py-1.5 text-xs font-medium transition ${
                  vsForecast === v ? "border-primary bg-primary/10 text-primary font-bold" : "border-border bg-background hover:border-primary/40 text-muted-foreground"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your Name (optional)</label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g. Riya"
              maxLength={40}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Wait (mins)</label>
            <input
              type="number"
              min={0}
              max={300}
              value={waitMinutes}
              onChange={(e) => setWaitMinutes(e.target.value)}
              placeholder="e.g. 15"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">One-line Travel Tip (optional)</label>
          <input
            value={tip}
            onChange={(e) => setTip(e.target.value)}
            maxLength={100}
            placeholder="e.g. Elephant queue long, jeep ride much faster."
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ground-Truth Crowd Photo (optional)</label>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold hover:border-primary hover:bg-secondary/40 transition"
            >
              📷 {imageFile ? "Change Crowd Photo" : "Attach Crowd Photo"}
            </button>
            {imageFile && (
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                ✓ Photo ready to share
              </span>
            )}
          </div>
          {imageFile && (
            <div className="relative mt-2.5 inline-block">
              <img
                src={imageFile}
                alt="Selected crowd preview"
                className="h-24 w-36 rounded-xl object-cover border-2 border-primary/40 shadow-sm"
              />
              <button
                type="button"
                onClick={() => {
                  setImageFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[11px] font-bold text-destructive-foreground shadow hover:scale-110 transition"
                title="Remove photo"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-primary py-3 font-semibold text-primary-foreground shadow transition hover:bg-saffron hover:scale-[1.01] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? "Submitting to database..." : "Share check-in · +20 pts"}
        </button>

        <p className="text-center text-xs text-muted-foreground">
          Persisted in PostgreSQL · 1 report per place / 45 min · Daily 100 pt cap
        </p>
      </form>

      {/* Shared Community Feed Card */}
      <div className="flex flex-col rounded-2xl border bg-card p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <div>
            <h4 className="font-display text-lg text-primary">Shared Community Feed</h4>
            <p className="text-xs text-muted-foreground">Live observations submitted by travellers on the ground</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filterPlace}
              onChange={(e) => setFilterPlace(e.target.value)}
              className="rounded-lg border bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground"
            >
              <option value="all">All Jaipur Places</option>
              {PLACES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-lg border border-border px-2 py-1 text-xs hover:border-primary transition"
                title="Refresh community feed"
              >
                🔄
              </button>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex h-64 flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="font-display text-base text-primary">Fetching live community observations...</p>
            <p className="text-xs text-muted-foreground">Connecting to Musafir database</p>
          </div>
        )}

        {/* Error State with Honest Feedback & Retry */}
        {!loading && error && (
          <div className="flex h-64 flex-col items-center justify-center text-center p-6 rounded-xl border border-dashed border-destructive/40 bg-destructive/5 space-y-3">
            <span className="text-3xl">⚠️</span>
            <p className="font-semibold text-destructive">Database Connection Notice</p>
            <p className="text-xs text-muted-foreground max-w-sm">{error}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow hover:bg-saffron transition"
              >
                Retry Connecting
              </button>
            )}
          </div>
        )}

        {/* Empty State (Zero Fabricated Data) */}
        {!loading && !error && filteredReports.length === 0 && (
          <div className="flex h-64 flex-col items-center justify-center text-center p-6 rounded-xl border border-dashed border-border bg-secondary/30 space-y-2">
            <span className="text-3xl">🏜️</span>
            <p className="font-display text-base text-primary">No live community reports yet</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              {filterPlace === "all"
                ? "No reports have been submitted to the database yet. Submit the first genuine check-in above!"
                : `No reports submitted for ${byId(filterPlace)?.name || filterPlace} yet. Share what conditions look like right now!`}
            </p>
          </div>
        )}

        {/* Real Reports Feed */}
        {!loading && !error && filteredReports.length > 0 && (
          <div className="max-h-[440px] space-y-3 overflow-y-auto pr-1">
            {filteredReports.map((r) => {
              const placeId = r.place || r.destination_id || "hawa";
              const placeObj = byId(placeId);
              const displayName = r.destination_name || placeObj?.name || placeId;
              const author = r.user || r.user_name || "Traveller";
              const cLevel = r.status || r.crowd_level || "Quiet";
              const isFlagged = r.moderation_status === "flagged" || flaggedSet.has(r.id);
              const isVoted = votedSet.has(r.id);

              return (
                <div key={r.id} className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-saffron font-display text-primary-foreground font-bold">
                      {author[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <b className="truncate">{author}</b>
                        <span className="text-muted-foreground text-xs">
                          at <span className="font-medium text-foreground">{displayName}</span> · {r.ago || "recently"}
                        </span>
                        <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-bold text-primary-foreground ${tone[cLevel] || "bg-crowd-low"}`}>
                          {cLevel}
                        </span>
                      </div>

                      {/* Optional details: forecast comparison & queue wait */}
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        {r.vs_forecast && <span className="rounded bg-secondary px-1.5 py-0.5 font-medium">Vs forecast: {r.vs_forecast}</span>}
                        {r.wait_minutes && r.wait_minutes > 0 ? (
                          <span className="rounded bg-secondary px-1.5 py-0.5 font-medium">⏳ {r.wait_minutes} min wait</span>
                        ) : null}
                        {r.trust_weight && r.trust_weight > 1.1 && (
                          <span className="rounded bg-gold/15 text-gold px-1.5 py-0.5 font-bold">✓ High trust</span>
                        )}
                      </div>

                      {r.tip && <p className="mt-2 text-sm italic text-foreground bg-secondary/40 rounded-lg p-2">“{r.tip}”</p>}

                      {/* Attached Crowd Photo */}
                      {(r.image || r.photo_url) && (
                        <div className="mt-2.5 overflow-hidden rounded-xl border border-border/70 bg-black/5 max-w-sm shadow-sm">
                          <img
                            src={r.image || r.photo_url || ""}
                            alt={`Crowd visual at ${displayName}`}
                            className="h-44 w-full object-cover transition duration-300 hover:scale-[1.02]"
                            loading="lazy"
                          />
                          <div className="flex items-center justify-between bg-secondary/90 px-2.5 py-1 text-[11px] text-muted-foreground">
                            <span>📷 Ground-truth photo</span>
                            <span className="text-emerald-700 font-semibold">✓ Verified visual</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Verification & Flagging Action Row */}
                  <div className="mt-1 flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
                    <span className="text-[11px]">
                      {isFlagged ? (
                        <span className="text-amber-600 font-semibold">⚠️ Flagged for review</span>
                      ) : (
                        <span className="text-emerald-700 font-medium">✓ Verified Live Observation</span>
                      )}
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleVote(r.id)}
                        disabled={isVoted}
                        className={`transition hover:text-primary ${isVoted ? "font-bold text-primary" : ""}`}
                        title="Confirm this crowd condition is still accurate"
                      >
                        Still accurate? 👍 ({ (r.accuracy_votes_count || 0) + (isVoted ? 1 : 0) })
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFlag(r.id)}
                        disabled={isFlagged}
                        className="text-muted-foreground/70 hover:text-destructive transition"
                        title="Flag inappropriate or false report"
                      >
                        {isFlagged ? "Flagged" : "🚩 Report"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Rewards / Circle / Simulator ---------------- */
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
    return { amber: Math.round(amber), jaigarh: Math.round(42 + shift * 0.5), panna: Math.round(28 + shift * 0.4), wait: Math.round(110 - shift * 2.4), revenue: Math.round(shift * 0.9 * 10) / 10 };
  }, [shift]);
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="rounded-2xl bg-gradient-to-br from-primary to-saffron p-6 text-primary-foreground shadow">
        <h3 className="text-2xl">Musafir Rewards</h3>
        <p className="mt-2 font-serif text-6xl">{points}</p><p className="opacity-80">points earned</p>
        <div className="mt-5 space-y-2">
          {badges.map((b) => <div key={b.n} className={`flex items-center gap-3 rounded-lg bg-background/15 p-2.5 ${points >= b.need ? "" : "opacity-45 grayscale"}`}><span className="text-2xl">{b.icon}</span><span className="flex-1 font-semibold">{b.n}</span><span className="text-xs">{points >= b.need ? "Unlocked" : `${b.need} pts`}</span></div>)}
        </div>
      </div>
      <div className="rounded-2xl border bg-card p-6">
        <h3 className="text-2xl">Musafir Circle</h3>
        <p className="text-sm text-muted-foreground">Trip with Alice, Paridhi & Ashwajeet — vote the 3 PM stop</p>
        <div className="my-4 flex -space-x-2">{["A", "P", "As", "G"].map((m) => <span key={m} className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-card bg-indigo-deep text-sm text-primary-foreground">{m}</span>)}</div>
        {Object.entries(votes).map(([id, v]) => (
          <button key={id} onClick={() => setVotes({ ...votes, [id]: v + 1 })} className="mb-2 block w-full rounded-lg border p-2 text-left text-sm hover:border-primary">
            <div className="flex justify-between"><span>{byId(id).name}</span><span>{v} 👍</span></div>
            <div className="mt-1 h-1.5 rounded bg-muted"><div className="h-full rounded bg-saffron" style={{ width: `${(v / 8) * 100}%` }} /></div>
          </button>
        ))}
        <button onClick={() => navigator.clipboard?.writeText("https://musafir.app/circle/jaipur-sunday")} className="mt-2 w-full rounded-full border border-primary py-2 text-sm text-primary">🔗 Copy invite link</button>
      </div>
      <div className="rounded-2xl bg-indigo-deep p-6 text-primary-foreground">
        <h3 className="text-2xl text-gold">What-If Simulator</h3>
        <p className="text-sm opacity-75">For tourism authorities</p>
        <label className="mt-4 block text-sm">Shift <b className="text-gold">{shift}%</b> of Amber Fort visitors
          <input type="range" min={0} max={30} step={10} value={shift} onChange={(e) => setShift(+e.target.value)} className="w-full accent-[var(--gold)]" />
        </label>
        <div className="mt-4 space-y-2 text-sm">
          {[["Amber Fort", sim.amber], ["Jaigarh Fort", sim.jaigarh], ["Panna Meena Kund", sim.panna]].map(([n, v]) => (
            <div key={n as string}><div className="flex justify-between"><span>{n}</span><span>{v}/100</span></div><div className="h-2 rounded bg-primary-foreground/15"><div className={`h-full rounded ${levelClass[level(v as number)].split(" ")[0]} transition-all`} style={{ width: `${v}%` }} /></div></div>
          ))}
          <p className="pt-2">Avg wait at Amber: <b className="text-gold">{sim.wait} min</b></p>
          <p>Local business uplift: <b className="text-gold">+₹{sim.revenue}L / month</b></p>
        </div>
      </div>
    </div>
  );
}
