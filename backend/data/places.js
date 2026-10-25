export const PLACES = [
  { id: "amber", name: "Amber Fort", hindi: "आमेर किला", tags: ["heritage", "photography"], base: 62, x: 52, y: 14, best: "9:00–11:00 AM", peak: "4:00–7:00 PM", entry: 200, alternatives: ["jaigarh", "panna"], update: "Long queue at Suraj Pol, ~40 min wait" },
  { id: "jaigarh", name: "Jaigarh Fort", hindi: "जयगढ़ किला", tags: ["heritage", "photography", "nature"], base: 30, x: 44, y: 9, best: "10:00 AM–1:00 PM", peak: "3:00–5:00 PM", entry: 150, gem: true, update: "Very peaceful, cannon area almost empty" },
  { id: "panna", name: "Panna Meena Kund", hindi: "पन्ना मीणा कुंड", tags: ["photography", "heritage"], base: 18, x: 60, y: 18, best: "8:00 AM–12:00 PM", peak: "5:00–6:00 PM", entry: 0, gem: true, update: "Golden light on steps right now" },
  { id: "nahargarh", name: "Nahargarh Fort", hindi: "नाहरगढ़ किला", tags: ["heritage", "nature", "photography"], base: 50, x: 36, y: 32, best: "10:00 AM–2:00 PM", peak: "5:00–7:30 PM", entry: 200, alternatives: ["jaigarh", "jalmahal"], update: "Sunset crowd building up" },
  { id: "jalmahal", name: "Jal Mahal", hindi: "जल महल", tags: ["photography", "nature"], base: 40, x: 50, y: 34, best: "7:00–9:00 AM", peak: "5:00–7:00 PM", entry: 0, alternatives: ["sisodia", "kanak"], update: "Clear reflection, light traffic" },
  { id: "kanak", name: "Kanak Ghati", hindi: "कनक घाटी", tags: ["nature", "photography"], base: 15, x: 58, y: 28, best: "8:00–11:00 AM", peak: "4:00–5:00 PM", entry: 0, gem: true, update: "Peacocks spotted near the garden" },
  { id: "hawa", name: "Hawa Mahal", hindi: "हवा महल", tags: ["heritage", "photography", "shopping"], base: 58, x: 48, y: 56, best: "8:00–10:00 AM", peak: "11:00 AM–4:00 PM", entry: 50, alternatives: ["albert", "patrika"], update: "Tour buses just arrived" },
  { id: "jantar", name: "Jantar Mantar", hindi: "जंतर मंतर", tags: ["heritage"], base: 48, x: 44, y: 60, best: "9:00–10:30 AM", peak: "12:00–3:00 PM", entry: 50, alternatives: ["citypalace", "anokhi"], update: "School groups inside" },
  { id: "citypalace", name: "City Palace", hindi: "सिटी पैलेस", tags: ["heritage", "photography"], base: 45, x: 41, y: 55, best: "9:30–11:00 AM", peak: "1:00–4:00 PM", entry: 300, update: "Moderate, Pritam Niwas Chowk is lovely" },
  { id: "albert", name: "Albert Hall Museum", hindi: "अल्बर्ट हॉल", tags: ["heritage", "photography"], base: 28, x: 52, y: 72, best: "10:00 AM–1:00 PM", peak: "6:00–8:00 PM", entry: 40, gem: true, update: "Quiet galleries, AC inside" },
  { id: "patrika", name: "Patrika Gate", hindi: "पत्रिका गेट", tags: ["photography"], base: 25, x: 66, y: 84, best: "7:00–9:00 AM", peak: "4:00–6:00 PM", entry: 0, gem: true, update: "Empty before 9 — perfect for reels" },
  { id: "bapu", name: "Bapu Bazaar", hindi: "बापू बाज़ार", tags: ["shopping", "food"], base: 55, x: 56, y: 62, best: "11:00 AM–1:00 PM", peak: "5:00–9:00 PM", entry: 0, alternatives: ["tripolia", "sanganer"], update: "Lane packed near Sanganeri Gate" },
  { id: "tripolia", name: "Tripolia Bazaar", hindi: "त्रिपोलिया बाज़ार", tags: ["shopping"], base: 30, x: 38, y: 64, best: "11:00 AM–2:00 PM", peak: "6:00–8:00 PM", entry: 0, gem: true, update: "Brass and lac bangle shops open" },
  { id: "anokhi", name: "Anokhi Museum", hindi: "अनोखी संग्रहालय", tags: ["heritage", "shopping"], base: 12, x: 56, y: 20, best: "10:30 AM–4:00 PM", peak: "—", entry: 80, gem: true, update: "Block-print demo at 2 PM" },
  { id: "sisodia", name: "Sisodia Rani Garden", hindi: "सिसोदिया रानी बाग", tags: ["nature", "photography", "heritage"], base: 22, x: 80, y: 48, best: "9:00 AM–12:00 PM", peak: "4:00–6:00 PM", entry: 50, gem: true, update: "Fountains running, very calm" },
  { id: "sanganer", name: "Sanganer Craft Area", hindi: "सांगानेर", tags: ["shopping", "photography"], base: 15, x: 62, y: 95, best: "10:00 AM–3:00 PM", peak: "—", entry: 0, gem: true, update: "Hand-block printing workshops open" },
];

export const byId = (id) => PLACES.find((p) => p.id === id);
