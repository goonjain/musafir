import express from "express";
import { byId } from "../data/places.js";

const router = express.Router();

let votes = {
  jaigarh: 2,
  panna: 1,
  albert: 1,
};

const members = [
  { id: "A", name: "Alice" },
  { id: "P", name: "Paridhi" },
  { id: "As", name: "Ashwajeet" },
  { id: "G", name: "Goon" },
];

router.get("/", (req, res) => {
  const options = Object.entries(votes).map(([id, count]) => ({
    id,
    name: byId(id)?.name || id,
    votes: count,
  }));

  return res.json({
    tripName: "Jaipur Sunday Circle",
    members,
    options,
    inviteLink: "https://musafir.app/circle/jaipur-sunday",
  });
});

router.post("/vote", (req, res) => {
  const { placeId } = req.body || {};
  if (!placeId) {
    return res.status(400).json({ error: "placeId is required" });
  }

  votes[placeId] = (votes[placeId] || 0) + 1;

  const options = Object.entries(votes).map(([id, count]) => ({
    id,
    name: byId(id)?.name || id,
    votes: count,
  }));

  return res.json({
    success: true,
    votes,
    options,
  });
});

export default router;
