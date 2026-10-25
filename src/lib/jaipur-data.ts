export type Level = "Low" | "Moderate" | "High" | "Critical";

export type Place = {
  id: string;
  name: string;
  hindi: string;
  tags: string[];
  base: number; // historical crowd indicator
  x: number; // illustrative map % position
  y: number;
  lat: number;
  lng: number;
  best: string;
  peak: string;
  gem?: boolean;
  alternatives?: string[];
  update: string;
};

export const PLACES: Place[] = [
  {
    id: "amber",
    name: "Amber Fort",
    hindi: "आमेर किला",
    tags: ["heritage", "photography"],
    base: 62,
    x: 52,
    y: 14,
    lat: 26.9855,
    lng: 75.8513,
    best: "9:00–11:00 AM",
    peak: "4:00–7:00 PM",
    entry: 200,
    alternatives: ["jaigarh", "panna"],
    update: "Long queue at Suraj Pol, ~40 min wait",
  },
  {
    id: "jaigarh",
    name: "Jaigarh Fort",
    hindi: "जयगढ़ किला",
    tags: ["heritage", "photography", "nature"],
    base: 30,
    x: 44,
    y: 9,
    lat: 26.9858,
    lng: 75.8456,
    best: "10:00 AM–1:00 PM",
    peak: "3:00–5:00 PM",
    entry: 150,
    gem: true,
    update: "Very peaceful, cannon area almost empty",
  },
  {
    id: "panna",
    name: "Panna Meena Kund",
    hindi: "पन्ना मीणा कुंड",
    tags: ["photography", "heritage"],
    base: 18,
    x: 60,
    y: 18,
    lat: 26.9859,
    lng: 75.858,
    best: "8:00 AM–12:00 PM",
    peak: "5:00–6:00 PM",
    entry: 0,
    gem: true,
    update: "Golden light on steps right now",
  },
  {
    id: "nahargarh",
    name: "Nahargarh Fort",
    hindi: "नाहरगढ़ किला",
    tags: ["heritage", "nature", "photography"],
    base: 50,
    x: 36,
    y: 32,
    lat: 26.9374,
    lng: 75.8155,
    best: "10:00 AM–2:00 PM",
    peak: "5:00–7:30 PM",
    entry: 200,
    alternatives: ["jaigarh", "jalmahal"],
    update: "Sunset crowd building up",
  },
  {
    id: "jalmahal",
    name: "Jal Mahal",
    hindi: "जल महल",
    tags: ["photography", "nature"],
    base: 40,
    x: 50,
    y: 34,
    lat: 26.9656,
    lng: 75.846,
    best: "7:00–9:00 AM",
    peak: "5:00–7:00 PM",
    entry: 0,
    alternatives: ["sisodia", "kanak"],
    update: "Clear reflection, light traffic",
  },
  {
    id: "kanak",
    name: "Kanak Ghati",
    hindi: "कनक घाटी",
    tags: ["nature", "photography"],
    base: 15,
    x: 58,
    y: 28,
    lat: 26.962,
    lng: 75.8524,
    best: "8:00–11:00 AM",
    peak: "4:00–5:00 PM",
    entry: 0,
    gem: true,
    update: "Peacocks spotted near the garden",
  },
  {
    id: "hawa",
    name: "Hawa Mahal",
    hindi: "हवा महल",
    tags: ["heritage", "photography", "shopping"],
    base: 58,
    x: 48,
    y: 56,
    lat: 26.9239,
    lng: 75.8267,
    best: "8:00–10:00 AM",
    peak: "11:00 AM–4:00 PM",
    entry: 50,
    alternatives: ["albert", "patrika"],
    update: "Tour buses just arrived",
  },
  {
    id: "jantar",
    name: "Jantar Mantar",
    hindi: "जंतर मंतर",
    tags: ["heritage"],
    base: 48,
    x: 44,
    y: 60,
    lat: 26.9248,
    lng: 75.8246,
    best: "9:00–10:30 AM",
    peak: "12:00–3:00 PM",
    entry: 50,
    alternatives: ["citypalace", "anokhi"],
    update: "School groups inside",
  },
  {
    id: "citypalace",
    name: "City Palace",
    hindi: "सिटी पैलेस",
    tags: ["heritage", "photography"],
    base: 45,
    x: 41,
    y: 55,
    lat: 26.9258,
    lng: 75.8237,
    best: "9:30–11:00 AM",
    peak: "1:00–4:00 PM",
    entry: 300,
    update: "Moderate, Pritam Niwas Chowk is lovely",
  },
  {
    id: "albert",
    name: "Albert Hall Museum",
    hindi: "अल्बर्ट हॉल",
    tags: ["heritage", "photography"],
    base: 28,
    x: 52,
    y: 72,
    lat: 26.9116,
    lng: 75.8195,
    best: "10:00 AM–1:00 PM",
    peak: "6:00–8:00 PM",
    entry: 40,
    gem: true,
    update: "Quiet galleries, AC inside",
  },
  {
    id: "patrika",
    name: "Patrika Gate",
    hindi: "पत्रिका गेट",
    tags: ["photography"],
    base: 25,
    x: 66,
    y: 84,
    lat: 26.8398,
    lng: 75.8052,
    best: "7:00–9:00 AM",
    peak: "4:00–6:00 PM",
    entry: 0,
    gem: true,
    update: "Empty before 9 — perfect for reels",
  },
  {
    id: "bapu",
    name: "Bapu Bazaar",
    hindi: "बापू बाज़ार",
    tags: ["shopping", "food"],
    base: 55,
    x: 56,
    y: 62,
    lat: 26.9198,
    lng: 75.8242,
    best: "11:00 AM–1:00 PM",
    peak: "5:00–9:00 PM",
    entry: 0,
    alternatives: ["tripolia", "sanganer"],
    update: "Lane packed near Sanganeri Gate",
  },
  {
    id: "tripolia",
    name: "Tripolia Bazaar",
    hindi: "त्रिपोलिया बाज़ार",
    tags: ["shopping"],
    base: 30,
    x: 38,
    y: 64,
    lat: 26.9245,
    lng: 75.8214,
    best: "11:00 AM–2:00 PM",
    peak: "6:00–8:00 PM",
    entry: 0,
    gem: true,
    update: "Brass and lac bangle shops open",
  },
  {
    id: "anokhi",
    name: "Anokhi Museum",
    hindi: "अनोखी संग्रहालय",
    tags: ["heritage", "shopping"],
    base: 12,
    x: 56,
    y: 20,
    lat: 26.9897,
    lng: 75.8532,
    best: "10:30 AM–4:00 PM",
    peak: "—",
    entry: 80,
    gem: true,
    update: "Block-print demo at 2 PM",
  },
  {
    id: "sisodia",
    name: "Sisodia Rani Garden",
    hindi: "सिसोदिया रानी बाग",
    tags: ["nature", "photography", "heritage"],
    base: 22,
    x: 80,
    y: 48,
    lat: 26.892,
    lng: 75.8677,
    best: "9:00 AM–12:00 PM",
    peak: "4:00–6:00 PM",
    entry: 50,
    gem: true,
    update: "Fountains running, very calm",
  },
  {
    id: "sanganer",
    name: "Sanganer Craft Area",
    hindi: "सांगानेर",
    tags: ["shopping", "photography"],
    base: 15,
    x: 62,
    y: 95,
    lat: 26.8228,
    lng: 75.7725,
    best: "10:00 AM–3:00 PM",
    peak: "—",
    entry: 0,
    gem: true,
    update: "Hand-block printing workshops open",
  },
];

export const byId = (id: string): Place => {
  const place = PLACES.find((p) => p.id === id);
  if (!place) {
    throw new Error(`Place with id "${id}" not found.`);
  }
  return place;
};

export type ForecastInput = {
  day: string;
  hour: number;
  festival: boolean;
  weather: "clear" | "hot" | "rain";
};
export type ForecastInput = {
  day: string;
  hour: number;
  festival: boolean;
  weather: "clear" | "hot" | "rain";
};

export function crowdScore(p: Place, f: ForecastInput, pulse = 0) {
  const weekend = f.day === "Sat" || f.day === "Sun" ? 12 : 0;
  const peakHour = p.gem ? 4 : f.hour >= 15 && f.hour <= 19 ? 18 : f.hour >= 11 ? 8 : -6;
  const event = f.festival ? (p.gem ? 6 : 14) : 0;
  const weather =
    f.weather === "rain" ? -10 : f.weather === "hot" && f.hour >= 12 && f.hour <= 16 ? -6 : 0;
  const s = p.base + weekend + peakHour + event + weather + pulse;
  return {
    score: Math.max(5, Math.min(99, Math.round(s))),
    factors: { historical: p.base, weekend, timeOfDay: peakHour, event, weather, community: pulse },
  };
}

export function level(score: number): Level {
  if (score < 35) return "Low";
  if (score < 60) return "Moderate";
  if (score < 80) return "High";
  return "Critical";
}

export const levelClass: Record<Level, string> = {
  Low: "bg-crowd-low text-primary-foreground",
  Moderate: "bg-crowd-moderate text-foreground",
  High: "bg-crowd-high text-primary-foreground",
  Critical: "bg-crowd-critical text-primary-foreground",
};

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const INTERESTS = ["heritage", "food", "photography", "shopping", "nature", "cafes"];
