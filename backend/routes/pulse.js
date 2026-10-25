import express from "express";
import { byId } from "../data/places.js";

const router = express.Router();

let reports = [
  { id: 1, place: "amber", user: "Rohan K.", status: "Busy", tip: "Elephant ride line stretching to road", ago: "12m ago" },
  { id: 2, place: "jaigarh", user: "Meera S.", status: "Quiet", tip: "Jaivana cannon area almost deserted", ago: "24m ago" },
  { id: 3, place: "hawa", user: "Dev P.", status: "Busy", tip: "Wind view windows crowded, good photo from wind café opposite", ago: "40m ago" },
  { id: 4, place: "panna", user: "Aanya", status: "Quiet", tip: "Calm vibes, only 4 people here", ago: "1h ago" },
];

let pulseAdjustments = {
  amber: 15,
  jaigarh: -15,
  hawa: 15,
  panna: -15,
};

router.get("/", (req, res) => {
  return res.json({
    reports,
    pulseAdjustments,
  });
});

router.post("/", (req, res) => {
  const { place = "hawa", status = "Quiet", tip = "", user = "You", image = null } = req.body || {};

  const newReport = {
    id: Date.now(),
    place,
    user,
    status,
    tip,
    image,
    ago: "just now",
  };

  reports = [newReport, ...reports];

  const adjustment = status === "Busy" ? 15 : status === "Quiet" ? -15 : 0;
  pulseAdjustments = {
    ...pulseAdjustments,
    [place]: adjustment,
  };

  return res.status(201).json({
    success: true,
    report: newReport,
    reports,
    pulseAdjustments,
    rewardPointsAdded: 20,
    message: "Check-in shared · +20 points!",
  });
});

export default router;
