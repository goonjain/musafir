import express from "express";
import { PLACES, byId } from "../data/places.js";
import { crowdScore, getHourlyCurve } from "../engine/crowdEngine.js";

const router = express.Router();

router.post("/", (req, res) => {
  const {
    placeId = "amber",
    day = "Sun",
    hour = 16,
    festival = false,
    weather = "clear",
    pulse = 0,
  } = req.body || {};

  const place = byId(placeId) || PLACES[0];
  const { score, level, factors } = crowdScore(place, { day, hour, festival, weather }, pulse);
  const hourlyCurve = getHourlyCurve(place, { day, festival, weather }, pulse);

  const reasons = [
    day === "Sat" || day === "Sun" ? "Weekend" : null,
    hour >= 15 && hour <= 19 ? "Evening peak" : null,
    festival ? "Festival (Teej / Diwali)" : null,
    weather === "rain" ? "Monsoon rain" : weather === "hot" ? "Afternoon heat" : null,
    "Historical visitor pattern",
  ].filter(Boolean);

  return res.json({
    place,
    day,
    hour,
    festival,
    weather,
    score,
    level,
    factors,
    reasons,
    hourlyCurve,
  });
});

router.get("/map", (req, res) => {
  const hour = parseInt(req.query.hour || "16", 10);
  const day = req.query.day || "Sun";
  const festival = req.query.festival === "true";
  const weather = req.query.weather || "clear";

  const mapPlaces = PLACES.map((p) => {
    const { score, level } = crowdScore(p, { day, hour, festival, weather });
    return {
      ...p,
      currentScore: score,
      currentLevel: level,
    };
  });

  return res.json({
    hour,
    day,
    places: mapPlaces,
  });
});

export default router;
