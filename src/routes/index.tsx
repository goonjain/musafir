import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import hero from "@/assets/hero-jaipur.jpg";
import {
  SectionTitle, Planner, Itinerary, Forecast, HiddenGems, LiveMap, Pulse, Extras,
  type Plan, type Report,
} from "@/components/musafir/Sections";
import { byId } from "@/lib/jaipur-data";
import { applyStopReplacement, removeStopReplacement } from "@/lib/recommendation";
import { api, type DestinationItem } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Musafir — Crowd-aware travel for Jaipur" },
      { name: "description", content: "Plan a low-crowd day in the Pink City with AI crowd forecasts, smart routes and hidden gems." },
      { property: "og:title", content: "Musafir — Crowd-aware travel for Jaipur" },
      { property: "og:description", content: "AI crowd forecasts, smart routes and hidden gems across Jaipur." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const NAV: [string, string][] = [
  ["planner", "Planner"],
  ["forecast", "Forecast"],
  ["gems", "Hidden gems"],
  ["map", "Live map"],
  ["pulse", "Pulse"],
  ["rewards", "Rewards"],
];

function computeAdjustments(reps: Report[]): Record<string, number> {
  const adj: Record<string, number> = {};
  for (const r of reps) {
    const p = r.place || r.destination_id;
    if (p && !(p in adj)) {
      const s = r.status || r.crowd_level;
      adj[p] = s === "Busy" ? 15 : s === "Packed" ? 25 : s === "Quiet" ? -15 : 0;
    }
  }
  return adj;
}

function Index() {
  const [plan, setPlan] = useState<Plan>({
    day: "Sun",
    time: "full",
    budget: 2000,
    interests: ["heritage", "photography"],
    type: "friends",
    crowd: "avoid",
    must: "amber",
  });
  const [shown, setShown] = useState(false);
  const [optimized, setOptimized] = useState(false);
  const [points, setPoints] = useState(0);
  const [reports, setReports] = useState<Report[]>([]);
  const [destinations, setDestinations] = useState<DestinationItem[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [pulseAdj, setPulseAdj] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<string | null>(null);

  // Stage 2: Map focus and destination selection state
  const [selectedMapPlaceId, setSelectedMapPlaceId] = useState<string | null>(null);
  const [mapFocusKey, setMapFocusKey] = useState<number>(0);

  const fetchDestinations = async () => {
    const list = await api.getDestinations();
    if (list && list.length > 0) {
      setDestinations(list);
    }
  };

  const fetchReports = async () => {
    setLoadingReports(true);
    setReportsError(null);
    const res = await api.getReports();
    if (res.data?.reports) {
      setReports(res.data.reports as Report[]);
      setPulseAdj(computeAdjustments(res.data.reports as Report[]));
      setReportsError(null);
    } else {
      setReportsError(res.error || "Unable to connect to community backend database.");
    }
    setLoadingReports(false);
  };

  const fetchRewards = async () => {
    const res = await api.getRewardBalance();
    if (res.data) {
      setPoints(res.data.total_points);
    }
  };

  useEffect(() => {
    fetchDestinations();
    fetchReports();
    fetchRewards();
  }, []);

  const reward = (n: number, msg = `+${n} Musafir points!`) => {
    setPoints((p) => p + n);
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  const handleShowOnMap = (placeId: string) => {
    setSelectedMapPlaceId(placeId);
    setMapFocusKey((k) => k + 1);
    go("map");
  };

  const handleReplaceInRoute = (hotspotId: string, gemId: string) => {
    setPlan((prevPlan) => applyStopReplacement(prevPlan, hotspotId, gemId));
    setShown(true);
    reward(20, `Added ${byId(gemId).name} to itinerary! (+20 pts)`);
  };

  const handleRemoveFromRoute = (hotspotId: string) => {
    setPlan((prevPlan) => removeStopReplacement(prevPlan, hotspotId));
    setToast(`Restored original stop for ${byId(hotspotId).name}`);
    setTimeout(() => setToast(null), 2000);
  };

  const handleResetReplacements = () => {
    setPlan((prevPlan) => ({
      ...prevPlan,
      stopReplacements: undefined,
    }));
    setToast("Reset all itinerary stops to original");
    setTimeout(() => setToast(null), 2000);
  };

  const handleSubmitReport = async (payload: {
    destination_id: string;
    crowd_level: "Quiet" | "Moderate" | "Busy" | "Packed";
    vs_forecast?: "Quieter" | "About right" | "Busier";
    wait_minutes?: number;
    tip?: string;
    image?: string;
    user_name?: string;
  }) => {
    const res = await api.submitReport(payload);
    if (res.data && res.data.success) {
      setReports((prev) => [res.data!.report as Report, ...prev]);
      setPoints(res.data.total_points);
      const shift =
        payload.crowd_level === "Busy"
          ? 15
          : payload.crowd_level === "Packed"
          ? 25
          : payload.crowd_level === "Quiet"
          ? -15
          : 0;
      setPulseAdj((a) => ({ ...a, [payload.destination_id]: shift }));
      setToast(res.data.message || `Check-in shared · +${res.data.points_awarded} pts!`);
      setTimeout(() => setToast(null), 2500);
      return { success: true, message: res.data.message };
    }
    return { success: false, error: res.error || "Check-in failed" };
  };

  const handleVoteAccuracy = async (reportId: number) => {
    const res = await api.voteAccuracy(reportId, 1);
    if (res.data?.success) {
      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? {
                ...r,
                accuracy_votes_count: (r.accuracy_votes_count || 0) + 1,
                trust_weight: res.data!.trust_weight,
              }
            : r
        )
      );
      setToast("Accuracy verified! Trust weight updated.");
      setTimeout(() => setToast(null), 2200);
    } else if (res.error) {
      setToast(res.error);
      setTimeout(() => setToast(null), 2200);
    }
  };

  const handleFlagReport = async (reportId: number) => {
    const res = await api.flagReport(reportId);
    if (res.data?.success) {
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, moderation_status: "flagged" } : r))
      );
      setToast("Report flagged for moderation review.");
      setTimeout(() => setToast(null), 2200);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
          <button onClick={() => go("top")} className="font-display text-2xl text-primary">
            मुसाफ़िर <span className="text-base text-foreground">Musafir</span>
          </button>
          <nav className="hidden flex-1 justify-center gap-5 text-sm md:flex">
            {NAV.map(([id, l]) => (
              <button key={id} onClick={() => go(id)} className="hover:text-primary">
                {l}
              </button>
            ))}
          </nav>
          <span className="ml-auto rounded-full bg-gold px-3 py-1 text-sm font-bold text-foreground md:ml-0">
            🪙 {points}
          </span>
        </div>
        <div className="border-bandhani" />
      </header>

      <section id="top" className="relative flex min-h-[88vh] items-center overflow-hidden">
        <img src={hero} alt="Hawa Mahal at sunrise, Jaipur" width={1600} height={912} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-deep/90 via-indigo-deep/55 to-transparent" />
        <div className="relative mx-auto w-full max-w-7xl px-4 text-primary-foreground">
          <p className="font-display text-xl text-gold">पधारो म्हारे देस · Welcome to the Pink City</p>
          <h1 className="mt-3 max-w-3xl text-5xl leading-tight md:text-7xl">
            Same city, same day. <span className="text-saffron">Half the crowd.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg opacity-90">
            Musafir predicts crowd pressure across Jaipur and redirects you to hidden gems that match your vibe — from Amber Fort mornings to quiet stepwells.
          </p>
          <button onClick={() => go("planner")} className="mt-8 rounded-full bg-primary px-8 py-3.5 font-display text-lg shadow-xl transition hover:scale-105 hover:bg-saffron">
            Plan my Jaipur day
          </button>
          <div className="mt-12 flex flex-wrap gap-8 text-sm">
            {[["428+ Cr", "domestic tourist visits, 2025"], ["16", "curated Jaipur places"], ["-45%", "crowd exposure on Smart Route"]].map(([a, b]) => (
              <div key={b}>
                <p className="font-serif text-3xl text-gold">{a}</p>
                <p className="opacity-80">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <main className="jaali">
        <section id="planner" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20">
          <SectionTitle kicker="Step 1 · यात्रा योजना" title="Personalized Trip Planner" sub="Tell us who you are. Musafir builds a Jaipur day that fits your time, budget and crowd tolerance." />
          <Planner plan={plan} setPlan={(p) => { setPlan(p); setOptimized(false); }} onGenerate={() => { setShown(true); setOptimized(false); setTimeout(() => go("itinerary"), 50); }} />
          {shown && (
            <div id="itinerary" className="mt-14 scroll-mt-24">
              <Itinerary
                plan={plan}
                optimized={optimized}
                setOptimized={setOptimized}
                onReward={(n) => reward(n, "Smart Route unlocked · +80 points!")}
                onResetReplacements={handleResetReplacements}
              />
            </div>
          )}
        </section>

        <section id="forecast" className="scroll-mt-20 bg-secondary/60 py-20">
          <div className="mx-auto max-w-7xl px-4">
            <SectionTitle kicker="Step 2 · भीड़ पूर्वानुमान" title="AI Crowd Forecast" sub="Change the day, hour, weather or festival and watch the prediction respond." />
            <Forecast pulseAdj={pulseAdj} />
          </div>
        </section>

        <section id="gems" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20">
          <SectionTitle kicker="Step 3 · छुपे रत्न" title="Nearby Hidden Gems" sub="Not random swaps — a crowded fort leads to quieter heritage, views and architecture." />
          <HiddenGems
            plan={plan}
            onShowOnMap={handleShowOnMap}
            onReplaceInRoute={handleReplaceInRoute}
            onRemoveFromRoute={handleRemoveFromRoute}
          />
        </section>

        <section id="map" className="scroll-mt-20 bg-secondary/60 py-20">
          <div className="mx-auto max-w-7xl px-4">
            <SectionTitle kicker="Step 4 · जीवंत नक्शा" title="Musafir Live Map" sub="Drag through the day and tap any marker to see crowd pressure across Jaipur." />
            <LiveMap
              pulseAdj={pulseAdj}
              reports={reports}
              selectedPlaceId={selectedMapPlaceId}
              focusKey={mapFocusKey}
              onOptimize={(id) => { setPlan({ ...plan, must: id }); setShown(true); setOptimized(false); setTimeout(() => go("itinerary"), 50); }}
            />
          </div>
        </section>

        <section id="pulse" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20">
          <SectionTitle kicker="Step 5 · समुदाय" title="Musafir Pulse" sub="Travellers on the ground keep the forecast honest." />
          <Pulse
            reports={reports}
            destinations={destinations}
            onDestinationAdded={(newDest) => setDestinations((prev) => [...prev, newDest])}
            loading={loadingReports}
            error={reportsError}
            onRetry={fetchReports}
            onSubmitReport={handleSubmitReport}
            onVoteAccuracy={handleVoteAccuracy}
            onFlagReport={handleFlagReport}
          />
        </section>

        <section id="rewards" className="scroll-mt-20 bg-secondary/60 py-20">
          <div className="mx-auto max-w-7xl px-4">
            <SectionTitle kicker="और भी · More" title="Rewards, Circle & Impact" />
            <Extras points={points} />
          </div>
        </section>
      </main>

      <footer className="bg-indigo-deep py-10 text-center text-primary-foreground">
        <div className="border-bandhani mb-8" />
        <p className="font-display text-2xl text-gold">मुसाफ़िर</p>
        <p className="mt-2 text-sm opacity-75">Built for HackPulse by Ashwajeet Sharma, Alice Sharma, Goon Jain & Paridhi Poddar</p>
        <p className="mt-1 text-xs opacity-50">Prototype demo — crowd values are simulated.</p>
      </footer>

      {toast && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-gold px-6 py-3 font-semibold text-foreground shadow-2xl animate-in fade-in slide-in-from-bottom-4">🎉 {toast}</div>}
    </div>
  );
}
