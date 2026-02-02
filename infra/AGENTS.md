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

## Docker Build Strategy

1. `Dockerfile.base` builds SDK packages once (shared layer)
2. App Dockerfiles extend base, build specific app with Vite
3. Frontend apps: final stage copies static files to `nginx:1.29.1`
4. **Secrets**: Frontend secrets are build-time only (BuildKit `--mount=type=secret`), backend secrets are runtime K8s env vars

## GCP Production Architecture

**Stages**: `gcp-staging`, `gcp-production`

**Routing**: Path-based ingress — listener is NOT standalone, served via wallet ingress at `/listener` path

**HPA**: Backend min=1, max=2, target CPU=120%

**Database**: PostgreSQL on Cloud SQL
- Schema naming: `staging_v2`, `production_v2`
- Local access: GCP tunnel (`cloud-sql-proxy`)
- Migrations: `KubernetesJob` runs Drizzle migrate

## SST v3 (AWS)

**Stages**: `$dev` (local), `dev`, `prod`

**Deploys**: Admin dashboard, example apps only (production frontends are on GCP)

```typescript
export default $config({
    app(input) {
        return { name: "frak-wallet", home: "aws" };
    },
    async run() {
        await import("./infra/dashboard");
        await import("./infra/example");
    },
});
```

## CI/CD

**GitHub Actions**: `.github/workflows/deploy.yml` — path-based triggers

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
