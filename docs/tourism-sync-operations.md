# Raahi — Tourism Data Synchronization Operations Guide

---

## 1. Automated & Scheduled Synchronization

The tourism synchronization service checks for new or revised official statistics:
- **Frequency**: Checked daily (or on deployment) via the background synchronization worker.
- **Idempotency**: Computes a SHA-256 fingerprint of incoming datasets. If unchanged, no database writes or updates are executed.
- **Revision Tracking**: If a government agency revises a historical figure (e.g. 2023 preliminary figures converted to audited numbers), the engine increments the revision counter and retains historical provenance.

---

## 2. Admin API Operations

### A. Health & Status Check
- **Endpoint**: `GET /api/admin/tourism-sync/status`
- **Response**:
```json
{
  "status": "healthy",
  "sourcesCount": 2,
  "statisticsCount": 54,
  "latestReportingYear": 2024,
  "lastSuccessfulSync": "2026-10-19T10:00:00.000Z",
  "lastFingerprint": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "recentRuns": [
    {
      "id": "sync-1729332000000",
      "status": "success",
      "recordsProcessed": 54,
      "recordsInserted": 0,
      "recordsUpdated": 0,
      "recordsRejected": 0
    }
  ]
}
```

### B. Trigger Manual Synchronization
- **Endpoint**: `POST /api/admin/tourism-sync`
- **Headers**: `Authorization: Bearer <ADMIN_SYNC_SECRET>` (or development bypass in local dev).
- **Behavior**: Runs the full ingestion pipeline, validates records, updates statistics, and logs audit metrics.

---

## 3. Failure Handling & Circuit Breakers

1. **Source Unavailable**:
   - If an external source is unreachable or returns an error, the sync engine **retains the last verified dataset intact**.
   - No valid historical numbers are wiped, zeroed out, or overwritten with empty sets.
   - The failure is logged in `data_sync_runs` with status `"failed"` and an error message.
2. **Ambiguous or Unmapped Names**:
   - Attractions that cannot be safely resolved to canonical IDs are routed to an unmapped quarantine log for manual review, rather than being attached to the wrong monument.

