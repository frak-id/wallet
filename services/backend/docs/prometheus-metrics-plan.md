# Prometheus Metrics Plan — services/backend

Status: **proposal** — nothing is instrumented yet. Grep confirms no `prom-client`/metrics library anywhere in the backend; this is greenfield.

Goal: expose a `/metrics` endpoint (Prometheus text format) and instrument the backend across four layers — HTTP, infrastructure, background jobs, and business flows — to power a monitoring dashboard and alerting.

---

## 0. Setup

| Item | Recommendation |
|---|---|
| Library | `prom-client` (works on Bun) with a single shared `Registry` in `src/infrastructure/telemetry/` |
| Endpoint | `GET /metrics` mounted in `src/index.ts` (protect via network policy / internal-only ingress, not app auth) |
| Default collectors | Enable `collectDefaultMetrics()` (event loop lag, RSS, heap) — especially valuable given the known Bun RSS-leak workaround (`src/index.ts:56-67` forces `/health` 500 after 24h uptime) |
| HTTP plugin | One Elysia plugin using `onRequest` / `onAfterResponse` / `onError`, mounted next to `log.into(...)` in `src/index.ts:41` |

### Cardinality guardrails (apply everywhere)

- Label by **matched route template** (`ctx.route`, e.g. `/business/merchant/:id/campaigns`), never the raw URL.
- Never label by IP, wallet address, referral code, or unbounded IDs. Keep those in logs.
- `merchant_id` as a label is acceptable only if merchant count stays small (< a few hundred); otherwise drop it and rely on logs.
- Give `/health` its own route label or exclude it from latency histograms (K8s probes are noisy).

---

## 1. HTTP layer (global Elysia plugin)

Routes are split across 4 BFFs + legacy mapper (`src/index.ts:71-79`): `/business`, `/user`, `/ext`, `/common`, legacy redirects.

| Metric | Type | Labels | Source |
|---|---|---|---|
| `http_requests_total` | Counter | `method`, `route`, `status_code`, `bff` (`business\|user\|external\|common\|legacy`) | global plugin |
| `http_request_duration_seconds` | Histogram | `method`, `route`, `bff` | `onRequest` → `onAfterResponse` |
| `http_requests_in_flight` | Gauge | `bff` | inc/dec in hooks; pairs with graceful-shutdown drain (`src/index.ts:141-151`) |
| `http_errors_total` | Counter | `route`, `status_code`, `error_code` | global `onError` — `error_code` = `HttpError.code` (`src/utils/httpError.ts`), else `unknown` |

⚠️ Two error patterns escape a naive `onError`-only approach:

1. **Soft errors** — handlers returning `status(4xx, {...})` directly (e.g. `src/api/user/track/interaction.ts:20-32`) never throw. Catch them in `onAfterResponse` by checking `set.status >= 400`.
2. **Error-as-body 200** — webhook ingestion (`src/api/external/merchant/webhook/index.ts:16-30`) forces `set.status = 200` + `"ko: ..."` body so e-commerce platforms don't retry-storm. Instrument **inside that `.onError` handler**:

| Metric | Type | Labels |
|---|---|---|
| `webhook_errors_total` | Counter | `provider` (`shopify\|woocommerce\|magento\|custom`) |

### Auth & rate limiting

| Metric | Type | Labels | Source |
|---|---|---|---|
| `http_auth_failures_total` | Counter | `scheme` (`wallet\|wallet-sdk\|business\|shopify`), `reason` | `AUTH_ERROR_HEADER` value in `onAfterResponse` (`src/infrastructure/macro/session.ts`, `src/api/business/middleware/session.ts`) |
| `rate_limit_rejected_total` | Counter | `route` | at the 429 branch, `src/infrastructure/rateLimit/rateLimiter.ts:143-152` |
| `rate_limit_store_size` | Gauge | `store` | sample during `purgeExpired()` (`rateLimiter.ts:93-99`) — catches unbounded Map growth |
| `rate_limit_ip_unresolved_total` | Counter | — | `ipKeyExtractor` null path (`rateLimiter.ts:118-124`) |

### WebSocket (pairing relay — `src/api/user/wallet/pairing/ws.ts`)

| Metric | Type | Labels |
|---|---|---|
| `ws_connections_active` | Gauge | — (inc `open`, dec `close`) |
| `ws_messages_total` | Counter | `direction` (`in\|out`), out = `server.publish` wrapper (`ws.ts:22-32`) |
| `ws_rate_limit_rejected_total` | Counter | `action` (`initiate\|resume`) — WS has its own limiter (`ws.ts:53-68`) |

---

## 2. Infrastructure layer

### Postgres (`src/infrastructure/persistence/postgres.ts` — postgres-js pool, max 10)

| Metric | Type | Labels |
|---|---|---|
| `pg_query_duration_seconds` | Histogram | `operation` (repository method / table) |
| `pg_query_errors_total` | Counter | `operation` |
| `advisory_lock_acquired_total` / `advisory_lock_contended_total` | Counter | `lock_name` (symbolic: `settlement`, `takeads_ingestion`) — in `tryWithAdvisoryLock` (`postgres.ts:104`) |
| `advisory_lock_hold_duration_seconds` | Histogram | `lock_name` |

### LibSQL/Turso (`src/infrastructure/persistence/libsql.ts` — auth domain only)

| Metric | Type | Labels |
|---|---|---|
| `libsql_query_duration_seconds` | Histogram | `operation` |
| `libsql_query_errors_total` | Counter | `operation` |

### Blockchain RPC (viem, `src/infrastructure/blockchain/`)

Transport is `fallback([erpc, drpc])`; money path is `RewardsHubRepository` (`blockchain/contracts/RewardsHubRepository.ts`).

| Metric | Type | Labels |
|---|---|---|
| `blockchain_rpc_requests_total` | Counter | `method` (`multicall\|sendTransaction\|getTransactionReceipt\|...`) |
| `blockchain_rpc_duration_seconds` | Histogram | `method` |
| `blockchain_rpc_errors_total` | Counter | `method`, `error_type` (existing catch blocks: `TransactionNotFoundError`, `TransactionReceiptNotFoundError`) |
| `blockchain_tx_broadcast_total` | Counter | `contract`, `status` (`confirmed\|reverted\|timeout`) — from `SettlementTxResult` in `executeTransaction` |
| `blockchain_tx_confirmation_duration_seconds` | Histogram | `contract` |
| `blockchain_tx_gas_used` | Histogram | `contract` — `receipt.gasUsed` already logged (`RewardsHubRepository.ts:206`), just not metricized |

### LRU caches (uniform pattern)

Instances: token metadata (`TokenMetadataRepository.ts:14`), admin wallet keys (`keys/AdminWalletsRepository.ts:20`), FX rates (`pricing/FxRateRepository.ts:35`), token prices (`pricing/PricingRepository.ts:56`), identity resolution, bank on-chain state.

| Metric | Type | Labels |
|---|---|---|
| `cache_hits_total` / `cache_misses_total` | Counter | `cache` (`token_metadata\|admin_wallet_key\|fx_rate\|token_price\|identity\|bank_state`) |
| `cache_size` | Gauge | `cache` (sample `.size` periodically) |

### Admin-wallet mutexes (shared on-chain signer EOAs)

`AdminWalletsRepository.getMutexForAccount` serializes nonce allocation for `rewarder`, `bank-manager`, `minter` keys — this directly bounds settlement/deploy throughput.

| Metric | Type | Labels |
|---|---|---|
| `admin_wallet_mutex_wait_seconds` | Histogram | `key` |
| `admin_wallet_mutex_hold_seconds` | Histogram | `key` |

### External APIs (uniform pattern across all `ky` clients)

Providers: OpenPanel, Airtable, Slack, TakeAds, Resend, Frankfurter, open.er-api, CoinGecko.

| Metric | Type | Labels |
|---|---|---|
| `external_api_requests_total` | Counter | `provider`, `status` (HTTP class or `error`) |
| `external_api_duration_seconds` | Histogram | `provider` |
| `external_api_retries_total` | Counter | `provider` — via ky `beforeRetry` hook (retries are currently silent) |
| `external_api_fallback_used_total` | Counter | `provider="fx_rate"` — Frankfurter → er-api fallback (`FxRateRepository.ts:141`) |
| `openpanel_export_degraded_total` | Counter | — silently returns `{series:[]}` on failure (`OpenPanelExportClient.ts:54-57`); invisible today |

### Pricing integrity (money path)

| Metric | Type | Labels |
|---|---|---|
| `fx_rate_sanity_band_rejections_total` | Counter | `pair` — `checkAgainstBaseline` rejection (`FxRateRepository.ts:104-110`) |
| `pricing_conversion_failures_total` | Counter | `reason` (`fx_rate_unavailable\|token_price_unavailable`) |

### Event bus (`src/infrastructure/messaging/events.ts`)

| Metric | Type | Labels |
|---|---|---|
| `domain_events_emitted_total` | Counter | `event` (`newInteraction\|newPendingRewards\|notification`) — one wrapper at the emitter, cheap high-signal activity view |

---

## 3. Background jobs (highest ROI — instrument once in `MutexCron`)

All 10 jobs run through `MutexCron` (`src/utils/mutexCron.ts`, coalescing scheduler). One wrapper gives every job metrics for free:

| Metric | Type | Labels |
|---|---|---|
| `cron_runs_total` | Counter | `cron`, `outcome` (`success\|error\|skipped_running\|skipped_locked`) |
| `cron_run_duration_seconds` | Histogram | `cron` |
| `cron_last_success_timestamp_seconds` | Gauge | `cron` — **the key alerting metric** for silently-dead jobs: `time() - cron_last_success_timestamp_seconds > threshold` |

Jobs covered: `processRewards` (5min), `settleRewards` (hourly, advisory-locked), `requeueDepletedRewards` (3h), `expireRewards` (daily), `ingestAffiliateActions` (hourly, advisory-locked), `sendScheduledNotifications` (1min), `cleanupPairings`, `cleanupExpiredSignatureRequests`, `cleanupExpiredInstallCodes`, `cleanupExpiredEmailVerificationCodes`.

---

## 4. Business flows

### Reward pipeline (interaction → pending reward → on-chain settlement)

**Batch reward calc** (`orchestration/BatchRewardOrchestrator.ts`):

| Metric | Type | Labels |
|---|---|---|
| `reward_interactions_processed_total` | Counter | `outcome` (`success\|deferred\|error\|cancelled`) — from `result.processedCount/deferredCount/errors` |
| `reward_rewards_created_total` | Counter | `asset_type` |
| `reward_batch_size` | Histogram | — interactions per run |
| `reward_deferred_total` | Counter | `reason` (e.g. `pricing_unavailable`) |
| `campaign_budget_consumed_total` / `campaign_budget_restored_total` | Counter | `reason` (restore) — `CampaignRuleRepository.consumeBudget/restoreBudget` |

**Settlement** (`orchestration/SettlementOrchestrator.ts`, `domain/rewards/services/SettlementService.ts`):

| Metric | Type | Labels |
|---|---|---|
| `settlement_rewards_settled_total` / `settlement_rewards_failed_total` | Counter | `token`; `reason` on failed |
| `settlement_tx_broadcast_total` | Counter | `status` (`confirmed\|reverted\|timeout`) |
| `settlement_reconciled_stuck_total` | Counter | `outcome` (`settled\|reverted\|pending`) — stuck-`processing` reconciliation |
| `settlement_bank_depleted_rewards_total` | Counter | `token` — bank ran out of balance/allowance |
| `settlement_requeued_rewards_total` | Counter | `token` — from 3h requeue cron |
| `reward_settlement_attempts_exhausted_total` | Counter | — reward hit `maxAttempts=5` |
| `campaign_bank_balance_wei` / `campaign_bank_allowance_wei` | Gauge | `bank`, `token` — set at each cache-busted `getBankOnChainState` read; **dashboard star: alert before banks deplete** |

**Lifecycle** (`orchestration/RewardLifecycleOrchestrator.ts`):

| Metric | Type | Labels |
|---|---|---|
| `reward_lifecycle_terminated_total` | Counter | `reason` (`refund\|expired`) |

### Interaction submission (`orchestration/interaction-submission/`)

| Metric | Type | Labels |
|---|---|---|
| `interaction_submissions_total` | Counter | `type`, `outcome` (`created\|duplicate` — idempotent insert) |

### Purchases (`orchestration/PurchaseWebhookOrchestrator.ts`)

| Metric | Type | Labels |
|---|---|---|
| `purchase_webhooks_total` | Counter | `platform`, `status`, `identity_path` (`claim\|cart_attribute\|pending`) — pending = attribution not yet linked |
| `purchase_pending_claims` | Gauge | — count of unlinked claims; surfaces stuck attribution |
| `purchase_duplicate_webhooks_total` | Counter | `platform` |

### Auth / wallet (`domain/auth/services/WebAuthNService.ts`, `orchestration/identity/WalletSessionOrchestrator.ts`)

| Metric | Type | Labels |
|---|---|---|
| `webauthn_verifications_total` | Counter | `outcome` (`success\|parse_error\|unknown_credential\|bad_signature`) — requires adding outcome granularity; service currently collapses to boolean |
| `wallet_session_minted_total` | Counter | `path` (`verified_credential\|explicit_wallet\|merge`) |
| `wallet_binding_resolution_total` | Counter | `source` (`active_binding\|derived_fallback`) |

### Pairing (`orchestration/pairing/PairingRouterOrchestrator.ts`)

| Metric | Type | Labels |
|---|---|---|
| `pairing_signature_requests_total` | Counter | `outcome` (`responded\|rejected\|expired`) |
| `pairing_signature_request_duration_seconds` | Histogram | — request → response/expiry |

### Notifications (`domain/notifications/services/{NotificationsService,FcmSender}.ts`)

| Metric | Type | Labels |
|---|---|---|
| `notifications_sent_total` | Counter | `channel` (`webpush\|fcm`), `outcome` (`success\|invalid_token\|retryable_exhausted\|error`) |
| `notifications_invalid_tokens_pruned_total` | Counter | `channel` — 404/410 web-push, `UNREGISTERED` FCM |
| `notifications_by_trigger_total` | Counter | `trigger` (`reward_pending\|reward_settled\|signature_request\|scheduled_broadcast`) |
| `fcm_send_retries_total` | Counter | `error_code` — exponential backoff retries (`MAX_RETRIES=4`) currently invisible |
| `fcm_token_refresh_total` | Counter | `outcome` |

### Affiliate ingestion (`orchestration/TakeAdsIngestionOrchestrator.ts`)

| Metric | Type | Labels |
|---|---|---|
| `affiliate_ingestion_actions_total` | Counter | `outcome` (`created\|custom\|cancelled\|skipped\|error`) — from `IngestionSummary` |
| `affiliate_ingestion_watermark_lag_seconds` | Gauge | — `now - watermark`; **the single best health signal** for this job |
| `affiliate_ingestion_poison_actions_total` | Counter | — retry budget (5) exhausted |
| `affiliate_ingestion_consecutive_stalls` | Gauge | — mirrors in-memory counter in `jobs/affiliateIngestion.ts` |

### Media (`domain/media/services/ImageProcessingService.ts`)

| Metric | Type | Labels |
|---|---|---|
| `media_uploads_processed_total` | Counter | `image_type`, `outcome` (`success\|too_small\|invalid_ratio\|invalid_dimensions`) |
| `media_upload_processing_duration_seconds` | Histogram | `image_type` — sharp is CPU-bound, can block the event loop |

### Campaign bank deployment (`domain/campaign-bank/services/CampaignBankService.ts`)

| Metric | Type | Labels |
|---|---|---|
| `campaign_bank_deployments_total` | Counter | `outcome` |
| `campaign_bank_salt_collisions_total` | Counter | — CREATE2 retry loop (max 16) |

---

## 5. Suggested rollout order

1. **Phase 1 — foundations**: `/metrics` endpoint, default collectors, HTTP plugin (`http_*`), `MutexCron` wrapper (`cron_*`). Covers ~80% of dashboard value with 3 touch points.
2. **Phase 2 — money path**: settlement + reward pipeline + bank balance gauges + blockchain tx metrics + admin-wallet mutexes.
3. **Phase 3 — reliability**: external API metrics, webhook `ko:` errors, notifications/FCM, affiliate watermark lag, advisory locks, rate limiting.
4. **Phase 4 — fine-grained**: caches, pricing integrity, WebAuthn outcomes, pairing, media, DB query timing.

## 6. Alerting starters

| Alert | Expression sketch |
|---|---|
| Job dead | `time() - cron_last_success_timestamp_seconds{cron=...} > 3 * schedule_interval` |
| Bank depleting | `campaign_bank_balance_wei < threshold` or `rate(settlement_rewards_failed_total{reason="bank_depleted"}[1h]) > 0` |
| Settlement stuck | `rate(settlement_tx_broadcast_total{status="timeout"}[1h]) > 0` or `settlement_reconciled_stuck_total` increasing |
| Affiliate lag | `affiliate_ingestion_watermark_lag_seconds > 6h` |
| Webhook failures | `rate(webhook_errors_total[15m]) > 0` (invisible via status codes — always 200) |
| Error rate | `rate(http_requests_total{status_code=~"5.."}[5m]) / rate(http_requests_total[5m]) > 1%` |
| Bun RSS leak | default collector `process_resident_memory_bytes` trending toward restart threshold |
| Pricing integrity | `rate(fx_rate_sanity_band_rejections_total[1h]) > 0` |
