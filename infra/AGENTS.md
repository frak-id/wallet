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
- `infra/components/KubernetesService.ts` — Deployment + Service + HPA + Ingress + ServiceMonitor
- `infra/components/KubernetesJob.ts` — one-shot K8s Job (e.g., bootstrap migrations + bucket provisioning)
- `infra/utils.ts` — stage helpers: `isProd`, `isGcp`, `isV2`, `normalizedStageName`
- `Dockerfile.base` — pre-builds SDK packages once (~3–4 min); app Dockerfiles `FROM` this for cached layers
- `apps/*/Dockerfile` — multi-stage → `nginx:1.29.1` with pre-compressed gzip
- `services/backend/Dockerfile` — backend runtime image
- `services/bootstrap/Dockerfile` — one-shot bootstrap image (Drizzle migrations + RustFS bucket provisioning)

## Stages
`$dev` (local) · `dev` / `prod` (AWS) · `gcp-staging` / `gcp-production` (GCP).

## Non-Obvious Patterns
- **Bootstrap Job gate**: `KubernetesJob` (`services/bootstrap`) runs Drizzle migrations (Postgres + libSQL) AND RustFS bucket provisioning. MUST finish before backend `KubernetesService` — enforced by Pulumi `dependsOn`. Skipping = broken pods.
- **Listener is path-routed** at `/listener` on the wallet ingress — no standalone service.
- **Frontend secrets are BUILD-TIME only** (BuildKit `--mount=type=secret`); runtime pod specs must never expose them.
- **Backend secrets**: GCP Secret Manager → K8s env vars. AWS dev: `sst secret set Key "value"`.
- **HPA defaults**: backend min=1, max=2, CPU target 120%. Health probes on `/health`.
- **Cloud SQL schema** depends on stage: `staging_v2` or `production_v2`. Local dev via `cloud-sql-proxy` tunnel.
- **Vite `define`** injects `VITE_*` env at build time for frontends — runtime env is unused.
- **Stage literal trap**: Shopify + SST forbid `"prod"` — use `"production"`. Check before adding new stages.
- **Dockerfile.base is a caching choice**: changes there rebuild everything. Touch it carefully.

## CI/CD (.github/workflows)
- `deploy.yml` — path-based triggers; `main` → prod, `dev` → staging
- `release.yml` — Changesets → npm publish + jsDelivr cache purge
- `beta-release.yml` — SDK changes on `dev` → beta publish tagged with content hash
- `tauri-mobile-release.yml` — manual → iOS TestFlight + Android Play Store

## Anti-Patterns
Runtime frontend secrets · hardcoded stage names (use `infra/utils.ts`) · skipping bootstrap Job · editing `Dockerfile.base` casually · stage `"prod"`.

## See Also
Parent `/AGENTS.md` · `services/backend/AGENTS.md` (consumer of bootstrap Job) · `services/bootstrap/` (migrations + bucket provisioning) · `apps/*/Dockerfile`.
