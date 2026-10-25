import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PLACES, type Place, level } from "@/lib/jaipur-data";
import { predictCrowd, type VerifiedObservation } from "@/lib/crowd-service";
import { observationsRepository, type CrowdReportRecord } from "@/lib/observations-repository";
import {
  Users,
  AlertTriangle,
  Radio,
  TrendingUp,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  Sliders,
  Send,
  ArrowLeft,
  Search,
  Activity,
  Compass,
  MapPin,
  Clock,
  Eye,
  BellRing,
  XCircle,
  Database,
  Download,
  FileSpreadsheet,
  Layers,
  Lock,
  Scale,
  CheckCircle,
  FileText,
} from "lucide-react";
import { formatIstDate } from "@/lib/ml-pipeline";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Raahi Admin — Jaipur Crowd Command Center" },
      {
        name: "description",
        content:
          "Real-time crowd intelligence, visitor capacity management, and emergency broadcast dispatch for Jaipur tourism authority.",
      },
    ],
  }),
  component: AdminDashboard,
});

interface SiteState extends Place {
  liveScore: number;
  capacityLimit: number;
  sensorStatus: "online" | "degraded" | "offline";
  overrideActive: boolean;
  predictionType: "observed" | "estimated" | "insufficient_data";
}

interface IncidentReport {
  id: string;
  placeName: string;
  type: "congestion" | "queue" | "parking" | "weather";
  reporter: string;
  time: string;
  description: string;
  verified: boolean;
}

const INITIAL_HOURLY_DATA = [
  { hour: "8 AM", actual: 3200, capacity: 8000, forecast: 3100 },
  { hour: "10 AM", actual: 6900, capacity: 8000, forecast: 6500 },
  { hour: "12 PM", actual: 9800, capacity: 10000, forecast: 9200 },
  { hour: "2 PM", actual: 8400, capacity: 10000, forecast: 8900 },
  { hour: "4 PM", actual: 11200, capacity: 10000, forecast: 10500 },
  { hour: "6 PM", actual: 12400, capacity: 10000, forecast: 11800 },
  { hour: "8 PM", actual: 6100, capacity: 7000, forecast: 6300 },
];

const ZONE_DATA = [
  { name: "Walled City (Hawa, Bapu)", value: 42, color: "#d94f30" },
  { name: "Amer Fort Zone", value: 31, color: "#e88b2e" },
  { name: "Central Heritage (Albert)", value: 16, color: "#2e8b57" },
  { name: "Outer Arts (Patrika, Sanganer)", value: 11, color: "#d4af37" },
];

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<
    "overview" | "sites" | "incidents" | "broadcast" | "ml-readiness"
  >("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastStatus, setBroadcastStatus] = useState<string | null>(null);

  // Persistent repository bindings
  const [reports, setReports] = useState<CrowdReportRecord[]>(() =>
    observationsRepository.getReports("all"),
  );
  const [observations, setObservations] = useState<VerifiedObservation[]>(() =>
    observationsRepository.getActiveObservations(),
  );
  const [allObservations, setAllObservations] = useState<VerifiedObservation[]>(() =>
    observationsRepository.getAllObservations(),
  );
  const [adminOverrides, setAdminOverrides] = useState<Record<string, number>>(() =>
    observationsRepository.getAdminOverrides(),
  );
  const [activeBroadcast, setActiveBroadcast] = useState<string | null>(() =>
    observationsRepository.getActiveBroadcast(),
  );

  // Sync with persistent repository
  useEffect(() => {
    const unsubscribe = observationsRepository.subscribe(() => {
      setReports(observationsRepository.getReports("all"));
      setObservations(observationsRepository.getActiveObservations());
      setAllObservations(observationsRepository.getAllObservations());
      setAdminOverrides(observationsRepository.getAdminOverrides());
      setActiveBroadcast(observationsRepository.getActiveBroadcast());
    });
    return unsubscribe;
  }, []);

  const handleDownloadCsv = () => {
    const csvContent = observationsRepository.exportTrainingCsv(0);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `raahi_jaipur_crowd_training_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadJson = () => {
    const data = observationsRepository.getTrainingDataset(0);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `raahi_jaipur_crowd_dataset_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Compute live site metrics from canonical crowd service
  const sites: SiteState[] = PLACES.map((p) => {
    const override = adminOverrides[p.id] ?? 0;
    const pred = predictCrowd(p.id, {
      day: "Sun",
      hour: 17,
      festival: false,
      weather: "clear",
      observations,
      adminOverrideDelta: override,
    });
    return {
      ...p,
      liveScore: pred.score,
      capacityLimit: p.gem ? 350 : 2500,
      sensorStatus: p.id === "nahargarh" ? "degraded" : "online",
      overrideActive: override !== 0,
      predictionType: pred.predictionType,
    };
  });

  const [incidents, setIncidents] = useState<IncidentReport[]>([
    {
      id: "INC-101",
      placeName: "Amer Fort",
      type: "queue",
      reporter: "Jaipur Police Unit 4",
      time: "4 mins ago",
      description: "Suraj Pol entrance bottleneck: ~45 min wait time. Gate surge throttle advised.",
      verified: true,
    },
    {
      id: "INC-102",
      placeName: "Hawa Mahal",
      type: "congestion",
      reporter: "Rooftop Watcher (Sophie)",
      time: "14 mins ago",
      description: "Tour bus cluster on Badi Chaupar blocking pedestrian crossing.",
      verified: false,
    },
    {
      id: "INC-103",
      placeName: "Bapu Bazaar",
      type: "parking",
      reporter: "Sanganeri Gate Police Post",
      time: "28 mins ago",
      description: "Sanganeri Gate 2-wheeler bay is at 98% occupancy.",
      verified: true,
    },
  ]);

  // Adjust score via admin controls (persists across sessions)
  const handleScoreAdjust = (id: string, delta: number) => {
    const current = adminOverrides[id] ?? 0;
    observationsRepository.setAdminOverride(id, current + delta);
  };

  const handleToggleGate = (id: string) => {
    const current = adminOverrides[id] ?? 0;
    observationsRepository.setAdminOverride(id, current !== 0 ? 0 : 20);
  };

  const handleVerifyTouristReport = (reportId: string) => {
    observationsRepository.moderateReport(reportId, "verify", "DoT Command Officer");
  };

  const handleRejectTouristReport = (reportId: string) => {
    observationsRepository.moderateReport(reportId, "reject", "DoT Command Officer");
  };

  const handleVerifyIncident = (incId: string) => {
    setIncidents((prev) =>
      prev.map((inc) => (inc.id === incId ? { ...inc, verified: !inc.verified } : inc)),
    );
  };

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMsg.trim()) return;
    observationsRepository.setActiveBroadcast(broadcastMsg);
    setBroadcastStatus("Broadcast sent to all active Raahi mobile users and live app!");
    setBroadcastMsg("");
    setTimeout(() => setBroadcastStatus(null), 4000);
  };

  const handleClearBroadcast = () => {
    observationsRepository.setActiveBroadcast(null);
  };

  // High-level metrics
  const totalSites = sites.length;
  const criticalSites = sites.filter(
    (s) => level(s.liveScore) === "Critical" || level(s.liveScore) === "High",
  ).length;
  const avgCrowd = Math.round(sites.reduce((acc, s) => acc + s.liveScore, 0) / sites.length);
  const activeGems = sites.filter((s) => s.gem).length;

  const filteredSites = sites.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.hindi.includes(searchQuery);
    const lvl = level(s.liveScore);
    const matchesLevel = filterLevel === "all" || lvl.toLowerCase() === filterLevel.toLowerCase();
    return matchesSearch && matchesLevel;
  });

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-neutral-800 bg-neutral-900/90 backdrop-blur sticky top-0 z-50 px-4 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-700 bg-neutral-800/80 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-neutral-400" />
            Back to Public App
          </Link>
          <div className="h-4 w-px bg-neutral-800 hidden sm:block" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-xl tracking-tight text-amber-500">
                राही Command
              </span>
              <span className="text-xs text-neutral-400 font-semibold">| Raahi DoT</span>
              <span className="bg-red-500/20 border border-red-500/40 text-red-400 px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Live Ops
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Jaipur Tourism & Crowd Dispersal Authority (DoT)
            </p>
          </div>
        </div>

        {/* Global Action Nav */}
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1.5 text-xs text-neutral-300 mr-2 bg-neutral-800/80 px-2.5 py-1 rounded border border-neutral-700">
            <Database className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {observationsRepository.getBackendMode() === "supabase"
                ? "● Supabase PostgreSQL Synced"
                : "○ Local Storage (Credentials Pending)"}
            </span>
          </div>
          <button
            onClick={handleClearBroadcast}
            className="text-xs px-2.5 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 transition"
          >
            Clear Banner
          </button>
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-xs font-medium text-amber-300">
            Jaipur IST: 17:45
          </div>
        </div>
      </header>

      {/* Active City Broadcast Alert Banner */}
      {activeBroadcast && (
        <div className="bg-gradient-to-r from-amber-950/80 via-red-950/80 to-amber-950/80 border-b border-amber-500/40 px-4 py-2.5 flex items-center justify-between text-xs sm:text-sm text-amber-200">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <BellRing className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
            <span className="font-semibold text-white uppercase tracking-wider text-[11px] bg-red-600/80 px-1.5 py-0.5 rounded">
              Active Push Alert:
            </span>
            <span className="truncate">{activeBroadcast}</span>
          </div>
          <button
            onClick={() => setActiveBroadcast(null)}
            className="text-neutral-400 hover:text-white text-xs ml-3 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="border-b border-neutral-800 bg-neutral-900/50 px-4 lg:px-8">
        <div className="flex space-x-1 sm:space-x-4">
          {[
            { id: "overview", label: "Overview & Telemetry", icon: Activity },
            { id: "sites", label: "Site Capacity & Overrides", icon: Sliders },
            { id: "incidents", label: "Community & Police Pulse", icon: ShieldAlert },
            { id: "broadcast", label: "City Broadcast Dispatch", icon: Send },
            { id: "ml-readiness", label: "ML Pipeline & Training Readiness", icon: Database },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-3 px-3 text-xs sm:text-sm font-medium border-b-2 transition ${
                  active
                    ? "border-amber-500 text-amber-400 font-semibold"
                    : "border-transparent text-neutral-400 hover:text-neutral-200 hover:border-neutral-700"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-400">
              <span className="text-xs uppercase font-medium tracking-wider">
                Active Observations
              </span>
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-2">
              <span className="text-2xl lg:text-3xl font-bold font-mono text-emerald-400">
                {observations.length}
              </span>
              <span className="text-xs text-neutral-400 ml-2 font-medium">active reports</span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">
              Verified on-ground traveler telemetry
            </p>
          </div>

          <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-400">
              <span className="text-xs uppercase font-medium tracking-wider">
                Avg City Congestion
              </span>
              <TrendingUp className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-2 flex items-baseline">
              <span className="text-2xl lg:text-3xl font-bold font-mono text-amber-400">
                {avgCrowd}%
              </span>
              <span className="text-xs text-neutral-400 ml-2 font-medium">Moderate</span>
            </div>
            <div className="w-full bg-neutral-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full transition-all"
                style={{ width: `${avgCrowd}%` }}
              />
            </div>
          </div>

          <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-400">
              <span className="text-xs uppercase font-medium tracking-wider">Congested Sites</span>
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <div className="mt-2">
              <span className="text-2xl lg:text-3xl font-bold font-mono text-red-400">
                {criticalSites}
              </span>
              <span className="text-xs text-neutral-400 ml-2">of {totalSites} monuments</span>
            </div>
            <p className="text-[11px] text-red-400/80 mt-1">Amber Fort, Hawa Mahal, Bapu Bazaar</p>
          </div>

          <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-400">
              <span className="text-xs uppercase font-medium tracking-wider">
                Dispersal Alternatives
              </span>
              <Compass className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-2">
              <span className="text-2xl lg:text-3xl font-bold font-mono text-emerald-400">
                {activeGems} Gems
              </span>
              <span className="text-xs text-emerald-300 ml-2">absorbing 2,400+ pax</span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">Panna Meena, Jaigarh, Albert Hall</p>
          </div>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Footfall Trend Area Chart */}
              <div className="lg:col-span-2 bg-neutral-900/80 border border-neutral-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-neutral-100 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-amber-500" />
                      Jaipur Hourly Visitor Flow vs. Safe Capacity
                    </h3>
                    <p className="text-xs text-neutral-400">
                      Live counts vs AI predictive forecast across all 16 monuments
                    </p>
                  </div>
                  <span className="text-xs font-mono bg-neutral-800 border border-neutral-700 px-2 py-1 rounded text-neutral-300">
                    Real-time (Sunday)
                  </span>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={INITIAL_HOURLY_DATA}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#d94f30" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#d94f30" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#d4af37" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#d4af37" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="hour" stroke="#737373" fontSize={11} tickLine={false} />
                      <YAxis stroke="#737373" fontSize={11} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#171717",
                          borderColor: "#404040",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                        itemStyle={{ color: "#f5f5f5" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="actual"
                        name="Actual Footfall"
                        stroke="#d94f30"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#actualGrad)"
                      />
                      <Area
                        type="monotone"
                        dataKey="forecast"
                        name="AI Forecast"
                        stroke="#d4af37"
                        strokeDasharray="4 4"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#forecastGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Zone Distribution Doughnut */}
              <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <h3 className="font-semibold text-neutral-100 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    City Zone Distribution
                  </h3>
                  <p className="text-xs text-neutral-400">Share of current active tourists</p>
                </div>
                <div className="h-48 w-full my-auto">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={ZONE_DATA}
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {ZONE_DATA.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#171717",
                          borderColor: "#404040",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 text-xs">
                  {ZONE_DATA.map((z) => (
                    <div key={z.name} className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-neutral-300">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: z.color }}
                        />
                        {z.name}
                      </span>
                      <span className="font-mono font-bold text-neutral-100">{z.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Critical Attention Panel */}
            <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-neutral-100 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-400" />
                    Congestion Threshold Watchlist
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Places currently at High or Critical crowd capacity
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("sites")}
                  className="text-xs text-amber-400 hover:text-amber-300 font-medium underline"
                >
                  Manage all {sites.length} sites →
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {sites
                  .filter((s) => level(s.liveScore) === "High" || level(s.liveScore) === "Critical")
                  .map((place) => (
                    <div
                      key={place.id}
                      className="border border-red-900/50 bg-red-950/20 rounded-lg p-3.5 flex flex-col justify-between"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-sm text-white">{place.name}</div>
                          <div className="text-xs text-neutral-400">{place.hindi}</div>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-red-500/20 text-red-400 border border-red-500/30">
                          {level(place.liveScore)} ({place.liveScore})
                        </span>
                      </div>
                      <p className="text-xs text-neutral-300 mt-2 bg-neutral-900/60 p-2 rounded border border-neutral-800/80 italic">
                        "{place.update}"
                      </p>
                      <div className="mt-3 pt-3 border-t border-red-900/30 flex items-center justify-between">
                        <span className="text-[11px] text-neutral-400">Peak: {place.peak}</span>
                        <button
                          onClick={() => handleScoreAdjust(place.id, -15)}
                          className="text-xs px-2 py-1 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 transition"
                        >
                          Trigger Dispersal
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SITES CAPACITY & OVERRIDES */}
        {activeTab === "sites" && (
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-lg text-neutral-100">
                  Live Monument Capacity & Throttle Controller
                </h3>
                <p className="text-xs text-neutral-400">
                  Override crowd metrics, activate entry throttles, and push automated detour
                  suggestions to tourists.
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Search monument..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-500 w-44 sm:w-56"
                  />
                </div>
                <select
                  value={filterLevel}
                  onChange={(e) => setFilterLevel(e.target.value)}
                  className="py-1.5 px-2.5 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="all">All Levels</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="moderate">Moderate</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            {/* Sites Table */}
            <div className="overflow-x-auto border border-neutral-800 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-950/80 text-neutral-400 border-b border-neutral-800">
                  <tr>
                    <th className="py-3 px-4 font-medium">Monument</th>
                    <th className="py-3 px-4 font-medium">Category</th>
                    <th className="py-3 px-4 font-medium">Live Congestion</th>
                    <th className="py-3 px-4 font-medium">Best Hours</th>
                    <th className="py-3 px-4 font-medium">Telemetry</th>
                    <th className="py-3 px-4 font-medium text-right">Crowd Manual Overrides</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {filteredSites.map((place) => {
                    const lvl = level(place.liveScore);
                    const badgeColor =
                      lvl === "Critical"
                        ? "bg-red-500/20 text-red-400 border-red-500/40"
                        : lvl === "High"
                          ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                          : lvl === "Moderate"
                            ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/40"
                            : "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";

                    return (
                      <tr key={place.id} className="hover:bg-neutral-800/40 transition">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-neutral-100 flex items-center gap-1.5">
                            {place.name}
                            {place.gem && (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-500/30">
                                Gem
                              </span>
                            )}
                            {place.overrideActive && (
                              <span className="text-[10px] bg-sky-500/20 text-sky-400 px-1 py-0.2 rounded">
                                Override
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-neutral-400">{place.hindi}</div>
                        </td>
                        <td className="py-3 px-4 text-neutral-400">
                          {place.tags.slice(0, 2).join(", ")}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold border ${badgeColor}`}
                            >
                              {lvl} ({place.liveScore})
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-medium border ${
                                place.predictionType === "observed"
                                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                  : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                              }`}
                            >
                              {place.predictionType === "observed" ? "● Observed" : "○ Baseline"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-neutral-300">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-neutral-500" />
                            {place.best}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-mono ${
                              place.sensorStatus === "online"
                                ? "text-emerald-400"
                                : "text-amber-400"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                place.sensorStatus === "online" ? "bg-emerald-400" : "bg-amber-400"
                              }`}
                            />
                            {place.sensorStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => handleScoreAdjust(place.id, -10)}
                              className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-mono"
                              title="Decrease crowd score (simulate dispersal)"
                            >
                              -10
                            </button>
                            <button
                              onClick={() => handleScoreAdjust(place.id, 10)}
                              className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-mono"
                              title="Increase crowd score (simulate sudden surge)"
                            >
                              +10
                            </button>
                            <button
                              onClick={() => handleToggleGate(place.id)}
                              className={`px-2.5 py-1 rounded text-xs font-medium border transition ${
                                lvl === "Critical" || lvl === "High"
                                  ? "bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30"
                                  : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30"
                              }`}
                            >
                              {lvl === "Critical" ? "Release Throttle" : "Throttle Entry"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: INCIDENTS & COMMUNITY PULSE */}
        {activeTab === "incidents" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-neutral-900/80 border border-neutral-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg text-neutral-100 flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-amber-500" />
                    Incoming Pulse Dispatches & Crowd Flags
                  </h3>
                  <p className="text-xs text-neutral-400">
                    User crowd feedback, on-ground Jaipur police dispatches, and parking telemetry
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-1 rounded">
                    {reports.filter((r) => r.moderationStatus === "pending").length} Pending
                    Traveler Reports
                  </span>
                  <span className="text-xs bg-neutral-800 text-neutral-300 px-2 py-1 rounded border border-neutral-700">
                    {incidents.filter((i) => !i.verified).length} Unverified Incidents
                  </span>
                </div>
              </div>

              {/* Tourist Pulse Reports (Live from Public App) */}
              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 pt-2">
                  <Activity className="w-3.5 h-3.5" />
                  Live Traveler Check-In Reports ({reports.length})
                </div>

                {reports.map((r) => (
                  <div
                    key={r.id}
                    className={`p-4 rounded-xl border transition ${
                      r.moderationStatus === "verified"
                        ? "bg-neutral-950/70 border-emerald-900/50"
                        : r.moderationStatus === "rejected"
                          ? "bg-neutral-950/70 border-red-900/50 opacity-60"
                          : "bg-amber-950/20 border-amber-500/40"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-white text-sm">
                            {r.destinationName}
                          </span>
                          <span className="text-xs text-neutral-400">({r.hindiName})</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                              r.statusLevel === "Quiet"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : r.statusLevel === "Busy"
                                  ? "bg-red-500/20 text-red-300"
                                  : "bg-amber-500/20 text-amber-300"
                            }`}
                          >
                            Reported: {r.statusLevel}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                              r.moderationStatus === "verified"
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : r.moderationStatus === "rejected"
                                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                  : "bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse"
                            }`}
                          >
                            {r.moderationStatus === "verified"
                              ? "● Verified in Model"
                              : r.moderationStatus === "rejected"
                                ? "✕ Flagged / Disregarded"
                                : "⏳ Awaiting Review"}
                          </span>
                        </div>
                        {r.tipText && (
                          <p className="text-xs text-neutral-300 mt-1 italic">"{r.tipText}"</p>
                        )}
                        <div className="flex items-center gap-3 text-[11px] text-neutral-400 mt-2">
                          <span>
                            User: <strong className="text-neutral-300">{r.userAlias}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            {new Date(r.submittedAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {r.moderationStatus !== "verified" && (
                          <button
                            onClick={() => handleVerifyTouristReport(r.id)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 transition shadow-sm"
                            title="Verify report and apply decay adjustment to live baseline model"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Verify & Apply
                          </button>
                        )}
                        {r.moderationStatus !== "rejected" && (
                          <button
                            onClick={() => handleRejectTouristReport(r.id)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-neutral-800 hover:bg-red-950/80 text-neutral-300 hover:text-red-300 border border-neutral-700 hover:border-red-800/60 flex items-center gap-1 transition"
                            title="Reject report to prevent influencing crowd model"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5 pt-4 border-t border-neutral-800">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Police & Traffic Incidents
                </div>

                {incidents.map((inc) => (
                  <div
                    key={inc.id}
                    className={`p-4 rounded-xl border transition ${
                      inc.verified
                        ? "bg-neutral-950/60 border-neutral-800"
                        : "bg-amber-950/20 border-amber-500/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-neutral-400">
                            {inc.id}
                          </span>
                          <span className="font-semibold text-white text-sm">{inc.placeName}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-neutral-800 text-neutral-300 border border-neutral-700">
                            {inc.type}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-300 mt-1">{inc.description}</p>
                        <div className="flex items-center gap-3 text-[11px] text-neutral-400 mt-2">
                          <span>
                            Reported by:{" "}
                            <strong className="text-neutral-300">{inc.reporter}</strong>
                          </span>
                          <span>•</span>
                          <span>{inc.time}</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <button
                          onClick={() => handleVerifyIncident(inc.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                            inc.verified
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
                              : "bg-amber-500 text-neutral-950 hover:bg-amber-400 font-bold"
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {inc.verified ? "Verified ✓" : "Verify & Act"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Action Dispatch Card */}
            <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-5 space-y-4">
              <h3 className="font-semibold text-neutral-100 flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400" />
                Crowd Dispersal Playbooks
              </h3>
              <p className="text-xs text-neutral-400">
                Instantly trigger pre-programmed city diversion algorithms:
              </p>

              <div className="space-y-3">
                <div className="p-3 rounded-lg border border-neutral-800 bg-neutral-950/60 space-y-2">
                  <div className="font-medium text-xs text-amber-400">
                    Amer Fort Detour Playbook
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    Diverts 35% of incoming Amer tourists towards Jaigarh Fort & Panna Meena Kund
                    with instant +20 bonus points.
                  </p>
                  <button
                    onClick={() => {
                      handleScoreAdjust("amber", -15);
                      handleScoreAdjust("jaigarh", 10);
                      handleScoreAdjust("panna", 10);
                      observationsRepository.setActiveBroadcast(
                        "Advisory: Amber Fort entrance congested. Shuttle rerouted to Jaigarh & Panna Meena Kund (+20 bonus pts).",
                      );
                    }}
                    className="w-full py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-semibold transition"
                  >
                    Execute Playbook
                  </button>
                </div>

                <div className="p-3 rounded-lg border border-neutral-800 bg-neutral-950/60 space-y-2">
                  <div className="font-medium text-xs text-amber-400">Old City Bazaar Relief</div>
                  <p className="text-[11px] text-neutral-400">
                    Balances footfall between Bapu Bazaar and Tripolia / Sanganer Craft Area to
                    reduce narrow alley congestion.
                  </p>
                  <button
                    onClick={() => {
                      handleScoreAdjust("bapu", -12);
                      handleScoreAdjust("tripolia", 8);
                      observationsRepository.setActiveBroadcast(
                        "Advisory: Bapu Bazaar pedestrian lane packed. Diverting shoppers to Tripolia & Sanganer crafts.",
                      );
                    }}
                    className="w-full py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-semibold transition"
                  >
                    Execute Playbook
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: BROADCAST DISPATCH */}
        {activeTab === "broadcast" && (
          <div className="max-w-2xl mx-auto bg-neutral-900/80 border border-neutral-800 rounded-xl p-6 space-y-5">
            <div>
              <h3 className="font-semibold text-lg text-neutral-100 flex items-center gap-2">
                <Send className="w-5 h-5 text-amber-500" />
                Citywide Tourist Push Notification Broadcast
              </h3>
              <p className="text-xs text-neutral-400 mt-1">
                Broadcast official travel advisories, parking capacity notices, and dynamic
                incentives directly to all users exploring Jaipur in the Raahi app.
              </p>
            </div>

            <form onSubmit={handleSendBroadcast} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Advisory / Push Notification Text
                </label>
                <textarea
                  rows={4}
                  value={broadcastMsg}
                  onChange={(e) => setBroadcastMsg(e.target.value)}
                  placeholder="e.g. Amber Fort parking at 100% capacity. Free electric shuttle now departing from Jal Mahal every 8 mins."
                  className="w-full p-3 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {broadcastStatus && (
                <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  {broadcastStatus}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-neutral-500">
                  Target: Active app sessions within Jaipur boundary
                </span>
                <button
                  type="submit"
                  disabled={!broadcastMsg.trim()}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send Instant Alert
                </button>
              </div>
            </form>

            <div className="border-t border-neutral-800 pt-4 mt-4">
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-2">
                Quick Template Presets
              </span>
              <div className="space-y-2">
                {[
                  "Rain Alert: Slippery stairs at Nahargarh Fort. We recommend indoor galleries at Albert Hall Museum today.",
                  "Suraj Pol Congestion: 45 min queue detected. Take the 10 min scenic walk to Jaigarh Fort cannon viewpoint.",
                  "Night Bazaar Advisory: Johari & Bapu Bazaar vehicle entry restricted between 6 PM - 9 PM.",
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setBroadcastMsg(preset)}
                    className="w-full text-left p-2.5 rounded bg-neutral-950 hover:bg-neutral-800/80 border border-neutral-800 text-xs text-neutral-300 transition"
                  >
                    "{preset}"
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: ML READINESS & TRAINING DATA PIPELINE */}
        {activeTab === "ml-readiness" && (() => {
          const staleObservations = observationsRepository.getStaleObservations();
          const trainingRecords = observationsRepository.getTrainingDataset(0);
          const evaluationReport = observationsRepository.getEvaluationReport(10);
          const promotionGate = observationsRepository.getPromotionGateStatus();

          const totalReports = reports.length;
          const pendingReports = reports.filter((r) => r.moderationStatus === "pending").length;
          const verifiedReports = reports.filter((r) => r.moderationStatus === "verified").length;
          const rejectedReports = reports.filter((r) => r.moderationStatus === "rejected").length;

          const totalObs = allObservations.length;
          const activeObs = observations.length;
          const staleObs = staleObservations.length;

          const communityObs = allObservations.filter((o) => o.sourceType === "community_verified").length;
          const staffObs = allObservations.filter((o) => o.sourceType === "staff_check").length;
          const authorityObs = allObservations.filter((o) => o.sourceType === "authority_override").length;

          const quietObs = allObservations.filter((o) => o.crowdLevel === "Quiet").length;
          const moderateObs = allObservations.filter((o) => o.crowdLevel === "Moderate").length;
          const busyObs = allObservations.filter((o) => o.crowdLevel === "Busy").length;

          return (
            <div className="space-y-6">
              {/* Executive Status Banner */}
              <div className="bg-gradient-to-r from-neutral-900 via-amber-950/30 to-neutral-900 border border-amber-500/30 rounded-xl p-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Database className="w-5 h-5 text-amber-500" />
                      <h3 className="font-bold text-lg text-neutral-100">
                        Jaipur Crowd Model Pipeline & Production Gate
                      </h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-semibold">
                        Phase 2 ML Ready
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 max-w-3xl">
                      Reproducible, zero-leakage training data extraction from verified on-ground observations.
                      Enforces objective governance before any future tabular ML model (XGBoost/LightGBM) can be deployed to production.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      onClick={handleDownloadCsv}
                      disabled={trainingRecords.length === 0}
                      className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Training CSV ({trainingRecords.length})
                    </button>
                    <button
                      onClick={handleDownloadJson}
                      disabled={trainingRecords.length === 0}
                      className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold border border-neutral-700 transition flex items-center gap-1.5"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      Export JSON
                    </button>
                  </div>
                </div>
              </div>

              {/* Data Pipeline Volume KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-3.5 space-y-1">
                  <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
                    Total Reports
                  </span>
                  <div className="text-2xl font-bold text-neutral-100">{totalReports}</div>
                  <div className="text-[11px] text-neutral-500 flex gap-1.5">
                    <span className="text-amber-400">{pendingReports} pend</span>
                    <span>•</span>
                    <span className="text-emerald-400">{verifiedReports} ver</span>
                    <span>•</span>
                    <span className="text-red-400">{rejectedReports} rej</span>
                  </div>
                </div>

                <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-3.5 space-y-1">
                  <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
                    Accepted Observations
                  </span>
                  <div className="text-2xl font-bold text-neutral-100">{totalObs}</div>
                  <div className="text-[11px] text-neutral-500 flex gap-1.5">
                    <span className="text-emerald-400 font-semibold">{activeObs} active</span>
                    <span>•</span>
                    <span className="text-neutral-400">{staleObs} historical</span>
                  </div>
                </div>

                <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-3.5 space-y-1">
                  <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
                    Destination Coverage
                  </span>
                  <div className="text-2xl font-bold text-neutral-100">
                    {evaluationReport.destinationsRepresented}/16
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    {evaluationReport.destinationCoveragePct}% of curated Jaipur sites
                  </div>
                </div>

                <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-3.5 space-y-1">
                  <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
                    Temporal Span
                  </span>
                  <div className="text-2xl font-bold text-neutral-100">
                    {evaluationReport.timeRangeDays} {evaluationReport.timeRangeDays === 1 ? "day" : "days"}
                  </div>
                  <div className="text-[11px] text-neutral-500 truncate">
                    {evaluationReport.earliestObservationTimestamp
                      ? new Date(evaluationReport.earliestObservationTimestamp).toLocaleDateString()
                      : "No data"}
                  </div>
                </div>

                <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-3.5 space-y-1">
                  <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
                    Training Features
                  </span>
                  <div className="text-2xl font-bold text-emerald-400">32 cols</div>
                  <div className="text-[11px] text-neutral-500">
                    0% missing rate • Zero leakage
                  </div>
                </div>
              </div>

              {/* Data Quality & Provenance Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                    <h4 className="font-semibold text-sm text-neutral-100 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-amber-500" />
                      Observation Provenance & Class Distribution
                    </h4>
                    <span className="text-xs text-neutral-400">N = {totalObs}</span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs text-neutral-300 mb-1">
                        <span>Source Breakdown</span>
                        <span className="text-neutral-500">Confidence Weighting</span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs p-2 rounded bg-neutral-950 border border-neutral-800">
                          <span className="text-neutral-300">Community Verified Reports</span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-neutral-100">{communityObs}</span>
                            <span className="text-[10px] text-neutral-500">(0.85–0.90 conf)</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-xs p-2 rounded bg-neutral-950 border border-neutral-800">
                          <span className="text-neutral-300">Staff Confirmed Checks</span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-neutral-100">{staffObs}</span>
                            <span className="text-[10px] text-neutral-500">(1.00 conf)</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-xs p-2 rounded bg-neutral-950 border border-neutral-800">
                          <span className="text-neutral-300">Authority Overrides</span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-neutral-100">{authorityObs}</span>
                            <span className="text-[10px] text-neutral-500">(0.95 conf)</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-neutral-300 mb-1">
                        <span>Target Crowd Levels</span>
                        <span className="text-neutral-500">Numeric Mapping</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="p-2.5 rounded bg-emerald-950/20 border border-emerald-500/30 text-center">
                          <div className="text-[10px] text-emerald-400 font-bold uppercase">Quiet</div>
                          <div className="text-lg font-bold text-emerald-200">{quietObs}</div>
                          <div className="text-[10px] text-neutral-500">Score = 20</div>
                        </div>
                        <div className="p-2.5 rounded bg-amber-950/20 border border-amber-500/30 text-center">
                          <div className="text-[10px] text-amber-400 font-bold uppercase">Moderate</div>
                          <div className="text-lg font-bold text-amber-200">{moderateObs}</div>
                          <div className="text-[10px] text-neutral-500">Score = 50</div>
                        </div>
                        <div className="p-2.5 rounded bg-red-950/20 border border-red-500/30 text-center">
                          <div className="text-[10px] text-red-400 font-bold uppercase">Busy</div>
                          <div className="text-lg font-bold text-red-200">{busyObs}</div>
                          <div className="text-[10px] text-neutral-500">Score = 80</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                    <h4 className="font-semibold text-sm text-neutral-100 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-emerald-400" />
                      Target Leakage Prevention & Traceability
                    </h4>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">
                      Enforced
                    </span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 space-y-1">
                      <div className="font-semibold text-neutral-200 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Strict Temporal Boundaries
                      </div>
                      <p className="text-[11px] text-neutral-400">
                        Feature extraction guarantees that calendar indicators, prior crowd levels, and weather are evaluated strictly prior to the observation target timestamp (T_features &lt; T_target).
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 space-y-1">
                      <div className="font-semibold text-neutral-200 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Zero Personal Information (PII)
                      </div>
                      <p className="text-[11px] text-neutral-400">
                        Anti-farming rate limits use non-reversible browser session hashes. No tourist names, phone numbers, or device identifiers enter the training dataset.
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 space-y-1">
                      <div className="font-semibold text-neutral-200 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Full Lineage & Audit Trail
                      </div>
                      <p className="text-[11px] text-neutral-400">
                        Every exported training row retains explicit links to its parent observation ID, source report ID, and verifying official credentials.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Baseline Evaluation & Validation Panel */}
              <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <div>
                    <h4 className="font-semibold text-sm text-neutral-100 flex items-center gap-2">
                      <Scale className="w-4 h-4 text-amber-500" />
                      Baseline v1.0 Statistical Evaluation
                    </h4>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Evaluated on chronologically held-out observations to benchmark explainable prior against on-ground observations.
                    </p>
                  </div>

                  <span
                    className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border ${
                      evaluationReport.status === "evaluated"
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                        : "bg-amber-500/20 text-amber-400 border-amber-500/40"
                    }`}
                  >
                    {evaluationReport.status === "evaluated" ? "Benchmarked" : "Insufficient Data"}
                  </span>
                </div>

                {evaluationReport.status === "insufficient_data" ? (
                  <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h5 className="text-xs font-bold text-amber-300">
                        Statistically Sound Evaluation Requires Additional Observations
                      </h5>
                      <p className="text-xs text-neutral-300 leading-relaxed">
                        Currently {evaluationReport.totalUsableObservations} observations are recorded in the data layer.
                        A minimum of 10 observations across multiple distinct days and monuments is required before publishing numeric MAE/RMSE metrics.
                        Publishing metrics on sparse samples would create false precision.
                      </p>
                      <div className="pt-2 text-[11px] text-neutral-400">
                        Active Production Model: <b className="text-neutral-200">Baseline v1.0 (Explainable Heuristic Prior)</b>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800">
                      <div className="text-[10px] text-neutral-500 uppercase">Numeric MAE</div>
                      <div className="text-xl font-bold text-neutral-100">{evaluationReport.mae} pts</div>
                      <div className="text-[10px] text-neutral-500">Mean Absolute Error</div>
                    </div>
                    <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800">
                      <div className="text-[10px] text-neutral-500 uppercase">Numeric RMSE</div>
                      <div className="text-xl font-bold text-neutral-100">{evaluationReport.rmse} pts</div>
                      <div className="text-[10px] text-neutral-500">Root Mean Square Error</div>
                    </div>
                    <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800">
                      <div className="text-[10px] text-neutral-500 uppercase">Category Match</div>
                      <div className="text-xl font-bold text-emerald-400">{evaluationReport.categoryAccuracyPct}%</div>
                      <div className="text-[10px] text-neutral-500">Exact category agreement</div>
                    </div>
                    <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800">
                      <div className="text-[10px] text-neutral-500 uppercase">Validation Set</div>
                      <div className="text-xl font-bold text-neutral-100">{evaluationReport.testCount} obs</div>
                      <div className="text-[10px] text-neutral-500">Chronological 30% split</div>
                    </div>
                  </div>
                )}
              </div>

              {/* ML Candidate Promotion Gate Checklist */}
              <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-3">
                  <div>
                    <h4 className="font-semibold text-sm text-neutral-100 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-amber-500" />
                      Future ML Candidate Production Promotion Gate
                    </h4>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Objective criteria required before any candidate model (XGBoost/LightGBM) can replace Baseline v1.0.
                    </p>
                  </div>

                  <span
                    className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border shrink-0 ${
                      promotionGate.isEligibleForProduction
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                        : "bg-amber-500/20 text-amber-400 border-amber-500/40"
                    }`}
                  >
                    {promotionGate.isEligibleForProduction ? "Eligible for Promotion" : "Promotion Blocked"}
                  </span>
                </div>

                <div className="space-y-2">
                  {promotionGate.checks.map((check) => (
                    <div
                      key={check.id}
                      className={`p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition ${
                        check.passed
                          ? "bg-emerald-950/10 border-emerald-500/20 text-neutral-200"
                          : "bg-neutral-950 border-neutral-800 text-neutral-400"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          {check.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-amber-500 shrink-0" />
                          )}
                          <span className="font-semibold text-neutral-200">{check.title}</span>
                          <span className="text-[10px] text-neutral-500 bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800">
                            Required: {check.requirement}
                          </span>
                        </div>
                        {check.blockerReason && (
                          <p className="text-[11px] text-amber-400/90 pl-6">{check.blockerReason}</p>
                        )}
                      </div>

                      <div className="text-right shrink-0 pl-6 sm:pl-0">
                        <span
                          className={`font-mono text-xs ${
                            check.passed ? "text-emerald-400 font-bold" : "text-neutral-400"
                          }`}
                        >
                          {check.currentValue}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-400 flex items-center justify-between">
                  <span>Current Production Model:</span>
                  <span className="font-bold text-amber-400">
                    {promotionGate.activeProductionModel} (Explainable Deterministic Prior)
                  </span>
                </div>
              </div>

              {/* Training Dataset Preview Table */}
              <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <div>
                    <h4 className="font-semibold text-sm text-neutral-100 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-neutral-400" />
                      Training Dataset Preview (First 5 Rows)
                    </h4>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Standard tabular layout ready for Scikit-learn, XGBoost, or Pandas export.
                    </p>
                  </div>
                  <span className="text-xs text-neutral-500">
                    Total extracted: {trainingRecords.length} records
                  </span>
                </div>

                {trainingRecords.length === 0 ? (
                  <p className="text-xs text-neutral-500 italic py-4 text-center">
                    No verified observations available in data layer yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-neutral-950 text-neutral-400 text-[10px] uppercase border-b border-neutral-800">
                        <tr>
                          <th className="p-2">Destination</th>
                          <th className="p-2">Target Time (IST)</th>
                          <th className="p-2">Prior Base</th>
                          <th className="p-2">Time Eff</th>
                          <th className="p-2">Prior 1h Obs</th>
                          <th className="p-2">Target Level</th>
                          <th className="p-2">Target Score</th>
                          <th className="p-2">Source Type</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800/60">
                        {trainingRecords.slice(0, 5).map((row, idx) => (
                          <tr key={idx} className="hover:bg-neutral-800/30">
                            <td className="p-2 font-semibold text-neutral-200">{row.destination_name}</td>
                            <td className="p-2 text-neutral-400">{row.target_timestamp_ist}</td>
                            <td className="p-2 text-neutral-300">{row.dest_base_score}</td>
                            <td className="p-2 text-neutral-300">{row.time_of_day_effect}</td>
                            <td className="p-2 text-neutral-400">{row.prior_observations_count_1h}</td>
                            <td className="p-2">
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                  row.target_crowd_level === "Quiet"
                                    ? "bg-emerald-500/20 text-emerald-400"
                                    : row.target_crowd_level === "Moderate"
                                    ? "bg-amber-500/20 text-amber-400"
                                    : "bg-red-500/20 text-red-400"
                                }`}
                              >
                                {row.target_crowd_level}
                              </span>
                            </td>
                            <td className="p-2 font-bold text-neutral-100">{row.target_crowd_score}</td>
                            <td className="p-2 text-neutral-400 text-[10px]">{row.source_type}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </main>
    </div>
  );
}
