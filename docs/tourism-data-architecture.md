# Raahi — Tourism Data Architecture & Canonical Schema

**Document Version**: 1.0.0  
**Target Environment**: TanStack Start / Nitro / Client  

---

## 1. Architectural Overview

Raahi integrates verified historical tourism statistics from official Indian government bodies (Ministry of Tourism and Rajasthan Department of Archaeology and Museums) into its travel planning platform.

The architecture comprises:
1. **Canonical Ingestion Engine**: Validates, normalizes, and fingerprints official records.
2. **Server-Side Data Store**: Persistent, queryable in-memory and file-backed canonical store with transactional upsert semantics.
3. **API Layer**: Typed Nitro endpoints providing ranked popularity, trends, and sync health.
4. **UI Integrations**: Explore popularity filter, destination details trend charts (Recharts), Live Map historical markers, and itinerary planner context.

---

## 2. Canonical Data Models

### Entity: `TourismSource`
Represents an authentic government reporting authority.

```typescript
export interface TourismSource {
  id: string; // "mot-india" | "rajasthan-dam" | "trust-reports"
  publisher: string;
  sourceUrl: string;
  datasetTitle: string;
  metricDefinition: string;
  license: string;
  retrievalMethod: "official-compendium" | "administrative-return" | "automated-api";
  lastChecked: string;
  lastSuccessfulImport: string;
}
```

### Entity: `AnnualVisitorStatistic`
Represents a single year's verified visitor count for a destination.

```typescript
export interface AnnualVisitorStatistic {
  id: string; // e.g. "amber-2024-mot"
  destinationId: string; // Canonical destination ID matching PLACES in jaipur-data.ts
  reportingYear: number;
  domesticVisitors: number | null;
  foreignVisitors: number | null;
  totalVisitors: number | null;
  metricType: "ticketed_admissions";
  sourceId: string;
  sourcePublicationDate: string;
  verificationStatus: "verified" | "preliminary" | "untracked";
  notes?: string;
  revision: number;
}
```

### Entity: `DataSyncRun`
Maintains an auditable log of ingestion and sync executions.

```typescript
export interface DataSyncRun {
  id: string;
  sourceId: string;
  startedAt: string;
  finishedAt: string;
  status: "success" | "partial" | "failed";
  recordsProcessed: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsRejected: number;
  errorSummary?: string;
  sourceFingerprint: string;
}
```

### Entity: `DestinationSourceMapping`
Maps external government nomenclature to canonical Raahi destination IDs.

```typescript
export interface DestinationSourceMapping {
  externalName: string;
  canonicalId: string;
  confidence: number;
  isAmbiguous: boolean;
}
```

---

## 3. Data Flow & Synchronization Lifecycle

```
[Official Source: Ministry of Tourism / Raj DAM]
                      │
                      ▼
            [Source Adapter / File Import]
                      │
                      ▼
           [Schema Validation & Normalization]
                      │ (Reject invalid counts or years)
                      ▼
          [Destination Name Matcher & Resolver]
                      │ (Map "Amer Palace" -> "amber")
                      ▼
         [SHA-256 Fingerprint Check & Diff]
          ├── If identical: Skip (Idempotent)
          └── If modified / new:
                      │
                      ▼
          [Transactional Upsert & History Log]
                      │
                      ▼
          [Cache Refresh & API Serving]
                      │
                      ▼
      [Explore / Live Map / Details / Planner UI]
```

---

## 4. API Endpoint Contracts

- `GET /api/destinations`: List of canonical destinations with tourism coverage status.
- `GET /api/destinations/:id/statistics`: Historical visitor series for a specific attraction.
- `GET /api/tourism/popular`: Ranked attractions by verified footfall for a selected reporting year.
- `GET /api/tourism/trends`: Multi-year trends and year-over-year changes.
- `GET /api/tourism/available-years`: List of available reporting years (e.g. `[2024, 2023, 2022, 2021, 2019, 2018]`).
- `GET /api/admin/tourism-sync/status`: Synchronization health, freshness, and last audit log.
- `POST /api/admin/tourism-sync`: Secure manual trigger for dataset synchronization.

