# infra/ — Compass

Multi-cloud IaC. **AWS (SST v3)**: admin dashboard, examples, dev deployments. **GCP (Pulumi on GKE, `frak-main-v1`, `europe-west1`)**: all production apps.

## Quick Commands
```bash
bun run build:infra         # Pre-build shared infra deps
bun run deploy              # SST → AWS dev
bun run deploy:prod         # SST → AWS prod
bun run deploy-gcp:staging  # Pulumi → GCP staging
bun run deploy-gcp:prod     # Pulumi → GCP production (all prod apps live here)
```

## Key Files
- `sst.config.ts` (root) — SST v3 app config (AWS)
- `infra/gcp/*.ts` — Pulumi resources per app (backend, wallet, business, listener)
- `infra/components/KubernetesService.ts` — Deployment + Service + HPA + Ingress + HTTPRoute (+ its BackendTrafficPolicies) + ServiceMonitor
- `infra/gcp/gateway.ts` — Envoy Gateway wiring: hostnames per app, the backend's upstream contract, and the (gated) vanity-host ListenerSet + certificates
- `infra/components/KubernetesJob.ts` — one-shot K8s Job (e.g., bootstrap migrations + bucket provisioning)
- `infra/utils.ts` — stage helpers: `isProd`, `normalizedStageName`
- `infra/sdk-pointer.ts` — S3 + CloudFront pointer at `sdk[-dev].frak.id/components.js`; its content is generated from `sdk/components/package.json`, so `sst deploy --stage sdk-pointer[-dev]` *is* the flip. `SDK_POINTER_VERSION=x.y.z` pins one by hand. `infra/config.ts` `componentsUrl` (Shopify's `FRAK_COMPONENTS_URL`) points here, with jsDelivr's floating tag kept only as each integration's `onerror` fallback. The same stack serves the Shopify ambassador proxy page at `sdk.frak.id/shopify/ambassador` (object built from `apps/shopify/proxy/ambassador.liquid`, `Content-Type: application/liquid`, every `/shopify/ambassador*` URI rewritten to it at the edge with the query string dropped) — deploy it before `shopify app deploy`
- `apps/*/Dockerfile` — self-contained multi-stage (each builds the SDK in its own `sdk-builder` stage) → `nginx:<pinned>-alpine` with pre-compressed gzip
- `services/backend/Dockerfile` — backend runtime image
- `services/bootstrap/Dockerfile` — one-shot bootstrap image (Drizzle migrations + RustFS bucket provisioning)

## Stages
`$dev` (local) · `dev` / `prod` (AWS) · `gcp-staging` / `gcp-production` (GCP) · `sdk-pointer` / `sdk-pointer-dev` (AWS, release workflows only — deploying them from a branch points merchants at that branch's `package.json` version, and every Shopify storefront at that branch's ambassador page).

## Non-Obvious Patterns
- **Bootstrap Job gate**: `KubernetesJob` (`services/bootstrap`) runs Drizzle migrations (Postgres + libSQL), the back-fills AND RustFS bucket provisioning. MUST finish before backend `KubernetesService` — enforced by Pulumi `dependsOn`. Skipping = broken pods.
- **Listener is path-routed** at `/listener` on the wallet ingress — no standalone service.
- **Gateway API dual-run (nginx → Envoy Gateway)**: every app publishes an `HTTPRoute` next to its `Ingress`, attached to infra-core's shared `networking/frak-gateway`. Real traffic still reaches nginx; the Gateway only answers on the shadow host `<app>.gw.gcp[-dev].frak.id` until the top-level DNS flips. Envoy traps that look like cleanup but are not:
  - A route-level `BackendTrafficPolicy` **replaces** the Gateway-level one unless it sets `mergeType`; Envoy's fallback is a 15s total timeout. A rule-level policy also replaces the route-level one, so `KubernetesService` renders each rule policy as route ⊕ rule.
  - `compressor` entries need their empty settings object (`brotli: {}`), or EG v1.9 drops them silently and still reports `Accepted`.
  - `connectionIdleTimeout` must stay **below** each app's keep-alive (Bun 30s, node:http 5s, nginx 75s), or a reused pooled connection 503s mid-request.
  - Vanity certs (`gateway.ts`) must carry the vanity name only. Any SAN overlapping the Gateway's `*.gcp[-dev].frak.id` wildcards (e.g. reusing nginx's `wallet-tls`) drops **every** :443 listener on the Gateway to HTTP/1.1.
  - Envoy forwards request bodies uncapped (nginx enforced 10m), so each server caps at 15 MiB itself: backend via `serve.maxRequestBodySize`, shopify via the header guard in `apps/shopify/server.js` (node:http has no limit, and `authenticate.webhook` buffers the body before its HMAC check).
- **Frontend secrets are BUILD-TIME only** (BuildKit `--mount=type=secret`); runtime pod specs must never expose them.
- **Backend secrets**: GCP Secret Manager → K8s env vars. AWS dev: `sst secret set Key "value"`.
- **HPA defaults**: backend min=1, max=2, CPU target 120%. Health probes on `/health`.
- **Cloud SQL schema** depends on stage: `staging_v2` or `production_v2`. Local dev via `cloud-sql-proxy` tunnel.
- **Vite `define`** injects `VITE_*` env at build time for frontends — runtime env is unused.
- **Stage literal trap**: Shopify + SST forbid `"prod"` — use `"production"`. Check before adding new stages.
- **`cachedImage` (`infra/gcp/utils.ts`)** wraps `dockerbuild.Image` with `cacheFrom`/`cacheTo` against in-cluster zot (`zot.zot.svc.cluster.local:5000`). Per-image cache repo + branch tag with `branch-dev` / `branch-main` fallback. The buildkit daemon already treats that hostname as HTTP via its `buildkitd.toml` — no insecure flag needed here.

## CI/CD (.github/workflows)
- `deploy.yml` — path-based triggers; `main` → prod, `dev` → staging
- `release.yml` — Changesets → npm publish → wait for jsDelivr → `sst deploy --stage sdk-pointer` → jsDelivr cache purge; on runs that publish nothing, its `ambassador-page` job redeploys `sdk-pointer` for the Shopify page with `SDK_POINTER_VERSION` pinned to the version already served
- `beta-release.yml` — SDK changes on `dev` → beta publish tagged with content hash → wait for jsDelivr → `sst deploy --stage sdk-pointer-dev`
- `tauri-mobile-release.yml` — manual → iOS TestFlight + Android Play Store

## Anti-Patterns
Runtime frontend secrets · hardcoded stage names (use `infra/utils.ts`) · skipping bootstrap Job · stage `"prod"`.

## See Also
Parent `/AGENTS.md` · `services/backend/AGENTS.md` (consumer of bootstrap Job) · `services/bootstrap/` (migrations + bucket provisioning) · `apps/*/Dockerfile`.
