import express from "express";
import { PLACES, byId } from "../data/places.js";
import { crowdScore } from "../engine/crowdEngine.js";

const router = express.Router();

router.post("/", (req, res) => {
  const {
    day = "Sun",
    time = "full",
    budget = 2000,
    type = "solo",
    interests = ["heritage"],
    crowd = "avoid",
    must = "amber",
  } = req.body || {};

  const chosenMust = must || "amber";
  const mustPlace = byId(chosenMust) || PLACES[0];

  // Original itinerary
  const baseStops = [
    { time: "11:00 AM", hour: 11, id: "hawa" },
    { time: "1:00 PM", hour: 13, id: "jantar" },
    { time: "4:00 PM", hour: 16, id: mustPlace.id },
    { time: "6:30 PM", hour: 18, id: "nahargarh" },
  ];
  const origStops = time === "half" ? baseStops.slice(1, 3) : baseStops;

  const scoreOf = (s) =>
    s.food ? 30 : crowdScore(byId(s.id), { day, hour: s.hour, festival: false, weather: "clear" }).score;

  const origStopsWithScore = origStops.map((s) => ({
    ...s,
    name: byId(s.id)?.name || s.id,
    hindi: byId(s.id)?.hindi || "",
    gem: byId(s.id)?.gem || false,
    score: scoreOf(s),
  }));

  const origAvg = Math.round(
    origStopsWithScore.reduce((acc, s) => acc + s.score, 0) / origStopsWithScore.length
  );
  const origCost = origStops.reduce((a, s) => a + (byId(s.id)?.entry || 0), 0) + 600;

  // Smart optimized itinerary
  const alts = mustPlace.alternatives || ["panna", "jaigarh"];
  const smartBase = [
    { time: "9:00 AM", hour: 9, id: mustPlace.id, note: "Moved to morning, before tour buses" },
    { time: "11:30 AM", hour: 11, id: alts[1] || "panna", note: "Hidden gem, 4 km away" },
    { time: "1:00 PM", hour: 13, id: "food", food: true, note: "Local thali — Laxmi Misthan Bhandar style" },
    { time: "3:00 PM", hour: 15, id: alts[0] || "jaigarh", note: "Similar vibe, half the crowd" },
    { time: "5:30 PM", hour: 17, id: "jalmahal", note: "Evening viewpoint" },
  ];
  const smartStops = time === "half" ? smartBase.slice(0, 3) : smartBase;

  const smartStopsWithScore = smartStops.map((s) => ({
    ...s,
    name: s.food ? "Local food stop" : (byId(s.id)?.name || s.id),
    hindi: s.food ? "स्थानीय भोजन" : (byId(s.id)?.hindi || ""),
    gem: s.food ? false : (byId(s.id)?.gem || false),
    score: scoreOf(s),
  }));

  const smartAvg = Math.round(
    smartStopsWithScore.reduce((acc, s) => acc + s.score, 0) / smartStopsWithScore.length
  );
  const smartCost = smartStops.reduce((a, s) => a + (s.food ? 250 : (byId(s.id)?.entry || 0)), 0) + 600;

  const mustScoreAtPeak = crowdScore(mustPlace, { day, hour: 16, festival: false, weather: "clear" }).score;

  return res.json({
    day,
    time,
    budget,
    type,
    must: mustPlace,
    mustPeakAlert: {
      score: mustScoreAtPeak,
      warning: `${mustPlace.name} at 4 PM: ${mustScoreAtPeak}/100 crowd pressure. Expected wait 40+ minutes.`,
    },
    original: {
      stops: origStopsWithScore,
      avgScore: origAvg,
      estimatedCost: origCost,
      waitingTimeMin: 110,
      travelTimeMin: 95,
      hiddenGemsCount: 0,
      rewardsPoints: 0,
    },
    smart: {
      stops: smartStopsWithScore,
      avgScore: smartAvg,
      estimatedCost: smartCost,
      waitingTimeMin: 35,
      travelTimeMin: 70,
      hiddenGemsCount: smartStopsWithScore.filter((s) => s.gem).length,
      rewardsPoints: 80,
    },
    comparison: {
      crowdExposureOriginal: `${origAvg}/100`,
      crowdExposureSmart: `${smartAvg}/100`,
      crowdReductionPercent: Math.round(((origAvg - smartAvg) / origAvg) * 100),
      waitingTimeSavedMin: 75,
      travelTimeSavedMin: 25,
      rewardPointsEarned: 80,
    },
  });
});

export default router;
