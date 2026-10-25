import express from "express";
import { PLACES, byId } from "../data/places.js";
import { crowdScore } from "../engine/crowdEngine.js";

const router = express.Router();

const DISTANCES = {
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

router.get("/", (req, res) => {
  const hotspotId = req.query.hotspot || "amber";
  const parent = byId(hotspotId) || PLACES[0];
  const hotspots = PLACES.filter((p) => p.alternatives);

  const altIds = [...(parent.alternatives || []), ...(hotspotId === "amber" ? ["sisodia"] : [])];

  const recommendations = altIds.map((id, index) => {
    const gem = byId(id);
    if (!gem) return null;
    const { score, level } = crowdScore(gem, { day: "Sun", hour: 16, festival: false, weather: "clear" });
    const matchedTags = gem.tags.filter((t) => parent.tags.includes(t));
    const matchPercent = Math.min(98, Math.round((matchedTags.length / parent.tags.length) * 40 + 55));

    return {
      ...gem,
      score,
      level,
      vibeMatchPercent: matchPercent,
      distance: DISTANCES[id] || "3 km",
      extraTravelTime: `${8 + index * 6} min travel`,
      matchedTags,
    };
  }).filter(Boolean);

  return res.json({
    currentHotspot: parent,
    availableHotspots: hotspots.map((h) => ({ id: h.id, name: h.name })),
    recommendations,
  });
});

export default router;
