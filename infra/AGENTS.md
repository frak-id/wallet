# Infrastructure Context

## Multi-Cloud Strategy

- **AWS (SST v3)**: Admin dashboard, example apps, dev deployments
- **GCP (Pulumi)**: All production apps (backend, wallet, business, listener) on GKE

## Key Files

| File | Purpose |
|------|---------|
| `sst.config.ts` | SST v3 root config (AWS) |
| `infra/gcp/*.ts` | Pulumi resources per app (backend, wallet, business) |
| `infra/components/` | Reusable K8s components (`KubernetesService`, `KubernetesJob`) |
| `infra/utils.ts` | Stage detection helpers (`isProd`, `isGcp`, `isV2`, `normalizedStageName`) |
| `Dockerfile.base` | Base image — pre-builds SDK packages for all app Dockerfiles |
| `apps/*/Dockerfile` | Per-app: multi-stage build → nginx:1.29.1 with pre-compressed gzip |
| `services/backend/Dockerfile` | Backend app image (Bun runtime) |
| `services/backend/MigrationDockerfile` | Database migration K8s Job image |

## Reusable Components

**`KubernetesService`** (in `infra/components/`):
- Creates: Deployment + Service + HPA + Ingress + ServiceMonitor
- Used by: backend, wallet, business

**`KubernetesJob`**:
- One-shot K8s Job (e.g., database migrations)

## Docker Strategy

- **`Dockerfile.base`**: Builds SDK packages once (3-4min), providing a shared layer for all apps.
- **Frontends**: Multi-stage builds ending in `nginx:1.29.1` with pre-compressed gzip assets.
- **Backend**: Bun runtime for high-performance execution.
- **Secrets**: Frontend secrets are build-time only (BuildKit `--mount=type=secret`), backend secrets are runtime K8s env vars.

## GCP Architecture

**Stages**: `gcp-staging`, `gcp-production`

**K8s (GKE)**:
- **Backend**: HPA min=1, max=2, CPU=120%. Health probes on `/health`.
- **Routing**: Path-based ingress. Listener served via wallet ingress at `/listener`.

**Database**: Cloud SQL PostgreSQL.
- **Schema**: `staging_v2` or `production_v2`.
- **Migrations**: `KubernetesJob` runs Drizzle migrate before deployment.
- **Access**: Local dev via `cloud-sql-proxy` tunnel.

## SST Config

**AWS (eu-west-1)**: Deploys admin dashboard and example apps.
**GCP (europe-west1)**: Provider `frak-main-v1` for production apps.

```typescript
export default $config({
    app(input) {
        return { 
            name: "wallet", 
            home: "aws",
            providers: { aws: { region: "eu-west-1" } }
        };
    },
    async run() {
        // ... imports for dashboard and example
    },
});
```

## CI/CD Workflows

- **`deploy.yml`**: Path-based triggers. `main` → prod, `dev` → staging.
- **`release.yml`**: Changesets → npm publish + jsDelivr cache purge.
- **`beta-release.yml`**: SDK changes on `dev` → beta publish with content hash.
- **`tauri-mobile-release.yml`**: Manual trigger → iOS TestFlight + Android Play Store.

## Environment Variables

**Frontend (Vite)**: `VITE_*` prefix, baked at build time via `define` config
**Backend**: Runtime env vars from K8s pod spec + Secret Manager

## Secrets Management

| Context | Mechanism |
|---------|-----------|
| AWS dev | `sst secret set Key "value"` |
| GCP prod | GCP Secret Manager → K8s env vars |
| Frontend build | BuildKit `--mount=type=secret` (never in runtime) |

## Database

```bash
cd services/backend
bun db:generate    # Generate migration from schema
bun db:migrate     # Apply migration locally
bun db:studio      # Open Drizzle Studio
```

**Production**: Migration Docker image → `KubernetesJob` → then deploy backend

## Deployment Commands

```bash
# AWS (SST)
bun run deploy             # Dev
bun run deploy:prod        # Prod

# GCP (Pulumi)
bun run deploy-gcp:staging
bun run deploy-gcp:prod
```

## Anti-Patterns

- Never expose runtime secrets in frontend pod specs (config is build-time only)
- Never hardcode stage names — use `infra/utils.ts` helpers
- Never skip migration Job before backend deployment
