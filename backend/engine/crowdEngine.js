export function crowdScore(place, forecastInput = {}, pulse = 0) {
  const { day = "Sun", hour = 16, festival = false, weather = "clear" } = forecastInput;
  const weekend = day === "Sat" || day === "Sun" ? 12 : 0;
  const peakHour = place.gem ? 4 : hour >= 15 && hour <= 19 ? 18 : hour >= 11 ? 8 : -6;
  const event = festival ? (place.gem ? 6 : 14) : 0;
  const weatherAdj = weather === "rain" ? -10 : weather === "hot" && hour >= 12 && hour <= 16 ? -6 : 0;
  const s = place.base + weekend + peakHour + event + weatherAdj + pulse;
  const finalScore = Math.max(5, Math.min(99, Math.round(s)));

  return {
    score: finalScore,
    level: getLevel(finalScore),
    factors: {
      historical: place.base,
      weekend,
      timeOfDay: peakHour,
      event,
      weather: weatherAdj,
      community: pulse,
    },
  };
}

export function getLevel(score) {
  if (score < 35) return "Low";
  if (score < 60) return "Moderate";
  if (score < 80) return "High";
  return "Critical";
}

export function getHourlyCurve(place, forecastInput, pulse = 0) {
  const hours = Array.from({ length: 13 }, (_, i) => i + 7); // 7 AM to 19 (7 PM)
  return hours.map((h) => {
    const res = crowdScore(place, { ...forecastInput, hour: h }, pulse);
    return {
      hour: h,
      time: `${((h + 11) % 12) + 1}:00 ${h < 12 ? "AM" : "PM"}`,
      score: res.score,
      level: res.level,
    };
  });
}
