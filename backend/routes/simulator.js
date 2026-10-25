import express from "express";
import { getLevel } from "../engine/crowdEngine.js";

const router = express.Router();

router.post("/", (req, res) => {
  const { shift = 20 } = req.body || {};
  const clampedShift = Math.max(0, Math.min(50, Number(shift) || 0));

  const amberScore = Math.round(86 - clampedShift * 1.1);
  const jaigarhScore = Math.round(42 + clampedShift * 0.5);
  const pannaScore = Math.round(28 + clampedShift * 0.4);

  const avgWaitAmber = Math.round(110 - clampedShift * 2.4);
  const businessUpliftLakhs = Math.round(clampedShift * 0.9 * 10) / 10;

  return res.json({
    shift: clampedShift,
    amber: {
      name: "Amber Fort",
      score: amberScore,
      level: getLevel(amberScore),
    },
    jaigarh: {
      name: "Jaigarh Fort",
      score: jaigarhScore,
      level: getLevel(jaigarhScore),
    },
    panna: {
      name: "Panna Meena Kund",
      score: pannaScore,
      level: getLevel(pannaScore),
    },
    metrics: {
      avgWaitTimeAmberMinutes: avgWaitAmber,
      localBusinessUpliftLakhs: businessUpliftLakhs,
    },
  });
});

export default router;
