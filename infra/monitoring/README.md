# Monitoring

Grafana dashboards + monitoring assets for Frak services.

## Backend overview dashboard

`dashboards/backend-overview.json` — a ready-to-import Grafana dashboard for the
Elysia backend (`services/backend`), built on the Prometheus metrics it exposes
at `GET /metrics` (see `services/backend/docs/prometheus-metrics-plan.md`).

### Prerequisites

- A Prometheus scraping the backend. In GKE this is wired by the `ServiceMonitor`
  in `infra/gcp/backend.ts` (`port: http`, `path: /metrics`, `interval: 15s`),
  discovered by the kube-prometheus-stack (`release: prometheus`).
- A Grafana with that Prometheus configured as a data source.

### Import

1. Grafana → **Dashboards → New → Import**.
2. **Upload JSON file** → pick `dashboards/backend-overview.json`
   (or paste its contents).
3. When prompted, select your Prometheus data source (the dashboard uses a
   `datasource` variable, so nothing is hard-coded).
4. Import. UID is `frak-backend-overview` — re-importing updates in place.

### Layout

| Section | What it shows |
| --- | --- |
| **HTTP — Golden signals** | request rate, 5xx error %, in-flight, latency p50/p95/p99, rate by BFF & status, top/slowest routes |
| **Runtime / health** | RSS & heap (watch the Bun RSS growth toward the 24h restart), event-loop lag, CPU |
| **Background jobs** | time since last successful run per cron (dead-job detector), runs by outcome, duration p95 |
| **Money path** | settlement rewards by outcome (settled/failed/depleted), tx/errors/requeues, reward interactions, advisory locks |
| **Reliability** | affiliate ingestion watermark lag, hidden webhook `ko:` errors, rate-limit rejections, notifications, domain events |

### Template variables

- `datasource` — pick your Prometheus.
- `bff` — filter HTTP panels by `business` / `user` / `external` / `common`.
- `pod` — filter runtime panels by pod.

### Suggested alerts

These map to panels above (thresholds already color-coded):

- **Dead job**: `time() - cron_last_success_timestamp_seconds > 3 * interval`.
- **Affiliate lag**: `affiliate_ingestion_watermark_lag_seconds > 6h`.
- **Webhook failures**: `rate(webhook_errors_total[15m]) > 0` (invisible via HTTP status).
- **Error rate**: `sum(rate(http_requests_total{status_code=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) > 0.01`.
- **Settlement stuck**: `rate(settlement_errors_total[1h]) > 0` or rising `settlement_rewards_total{outcome="depleted"}`.
- **Bun RSS leak**: `process_resident_memory_bytes` trending toward the restart threshold.
