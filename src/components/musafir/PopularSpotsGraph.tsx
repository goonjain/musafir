import React, { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import { PLACES } from "@/lib/jaipur-data";

// Official source reference
const OFFICIAL_SOURCE = "https://finance.rajasthan.gov.in/docs/budget/statebudget/2026-2027/Economicreviewe.pdf";

// Simple tooltip showing only domestic visits
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const { name, value } = payload[0].payload;
  return (
    <div className="bg-background p-2 border rounded shadow">
      <p className="font-medium">{name}</p>
      <p>{value?.toLocaleString("en-IN")} visitors</p>
    </div>
  );
};

export function PopularSpotsGraph() {
  const [year, setYear] = useState(2025);
  const [data, setData] = useState<Array<{ name: string; value: number }>>([]);
  const [loading, setLoading] = useState(true);

  // Fetch domestic visitor counts from backend endpoint
  useEffect(() => {
    setLoading(true);
    fetch(`/api/official-visits?year=${year}`)
      .then((res) => res.json())
      .then((json) => {
        // json.data: [{ id: string, value: number }]
        const mapped = json.data
          .map((item: any) => {
            const place = PLACES.find((p) => p.id === item.id);
            return place ? { name: place.name, value: item.value } : null;
          })
          .filter((x): x is { name: string; value: number } => x !== null);
        const sorted = mapped.sort((a, b) => b.value - a.value);
        setData(sorted);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [year]);

  return (
    <section className="my-8 min-w-0">
      <h2 className="mb-2 text-2xl font-bold">Popular Tourist Spots in Jaipur</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Verified annual domestic tourist visits at four Jaipur heritage sites. Other locations are omitted because comparable official counts have not been confirmed.
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label htmlFor="popular-spots-year" className="text-sm font-medium">Year:</label>
        <select
          id="popular-spots-year"
          className="rounded border bg-background px-3 py-2 text-foreground"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          <option value={2025}>2025</option>
          <option value={2024}>2024</option>
        </select>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading visitor data…</p>
      ) : (
        <div className="w-full min-w-0" style={{ height: 350 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 12, right: 80, left: 10, bottom: 12 }}>
              <XAxis type="number" tickFormatter={(value: number) => `${(value / 100000).toFixed(0)}L`} />
              <YAxis type="category" dataKey="name" width={115} tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Domestic visits" fill="#ff9933" isAnimationActive={false}>
                <LabelList dataKey="value" position="right" formatter={(value: number | string) => Number(value).toLocaleString("en-IN")} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="mt-3 text-sm text-muted-foreground">
        Source: <a href={OFFICIAL_SOURCE} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">View official report</a>.
      </p>
    </section>
  );
}
