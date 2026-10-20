
import { createFileRoute } from "@tanstack/react-router";
import officialData from "@/lib/officialVisitsData.json";

type VisitRecord = {
  id: string;
  year: number;
  domesticVisitors: number;
};

export const Route = createFileRoute("/api/official-visits")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const yearParam = url.searchParams.get("year");

        if (
          yearParam !== null &&
          (!/^\d{4}$/.test(yearParam) ||
            !Number.isInteger(Number(yearParam)))
        ) {
          return Response.json(
            { error: "Invalid year" },
            { status: 400 }
          );
        }

        const year =
          yearParam === null ? undefined : Number(yearParam);

        
type VisitRecord = {
  id: string;
  year: number;
  domesticVisitors: number;
};

const imported: unknown = officialData;

const records: VisitRecord[] = Array.isArray(imported)
  ? imported
  : imported !== null &&
      typeof imported === "object" &&
      "data" in imported &&
      Array.isArray(imported.data)
    ? imported.data
    : [];

const filtered = records.filter(
  (record) =>
    year === undefined || record.year === year
);

return Response.json({
  data: filtered.map((record) => ({
    id: record.id,
    value: record.domesticVisitors,
  })),
});


        return Response.json({
          data: records.map((record) => ({
            id: record.id,
            value: record.domesticVisitors,
          })),
        });
      },
    },
  },
});
