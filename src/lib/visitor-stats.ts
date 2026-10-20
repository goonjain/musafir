// Visitor statistics for Jaipur attractions
export type VisitorRecord = {
  id: string; // matches Place.id
  year: number;
  domesticVisitors?: number; // null if unavailable
  foreignVisitors?: number; // null if unavailable
  sourceUrl: string;
  verified: boolean;
};

// Simple localStorage based storage (client‑side)
export function getVisitorStats(): VisitorRecord[] {
  const raw = typeof window !== "undefined" ? localStorage.getItem("visitorStats") : null;
  if (!raw) return [];
  try {
    return JSON.parse(raw) as VisitorRecord[];
  } catch {
    return [];
  }
}

export function setVisitorStats(stats: VisitorRecord[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem("visitorStats", JSON.stringify(stats));
  }
}

// Attempt to fetch machine‑readable data (CSV) from official source.
export async function syncVisitorStats(sourceUrl: string): Promise<void> {
  try {
    const resp = await fetch(sourceUrl);
    if (!resp.ok) throw new Error("Network error");
    const text = await resp.text();
    // Expect CSV with headers matching VisitorRecord fields
    const lines = text.trim().split(/\r?\n/);
    const header = lines[0].split(",");
    const records: VisitorRecord[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      const rec: any = {};
      header.forEach((h, idx) => (rec[h] = cols[idx]));
      records.push({
        id: rec.destination_id,
        year: Number(rec.reporting_period),
        domesticVisitors: rec.domestic_visitors ? Number(rec.domestic_visitors) : undefined,
        foreignVisitors: rec.foreign_visitors ? Number(rec.foreign_visitors) : undefined,
        sourceUrl,
        verified: rec.verified === "true",
      });
    }
    setVisitorStats(records);
  } catch (e) {
    console.error("Visitor stats sync failed", e);
  }
}

