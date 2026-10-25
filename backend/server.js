import express from "express";
import cors from "cors";

import { PLACES } from "./data/places.js";
import plannerRouter from "./routes/planner.js";
import forecastRouter from "./routes/forecast.js";
import gemsRouter from "./routes/gems.js";
import pulseRouter from "./routes/pulse.js";
import circleRouter from "./routes/circle.js";
import simulatorRouter from "./routes/simulator.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Musafir Crowd Engine & Analytics API",
    version: "1.0.0",
  });
});

// Demo dataset endpoint
app.get("/api/places", (req, res) => {
  res.json({
    count: PLACES.length,
    places: PLACES,
  });
});

// Musafir Core Subsystems
app.use("/api/planner", plannerRouter);
app.use("/api/forecast", forecastRouter);
app.use("/api/gems", gemsRouter);
app.use("/api/pulse", pulseRouter);
app.use("/api/circle", circleRouter);
app.use("/api/simulator", simulatorRouter);

app.listen(PORT, () => {
  console.log(`🚀 Musafir Express Backend listening on http://localhost:${PORT}`);
});

export default app;
