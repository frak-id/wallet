# Infrastructure Context

## Multi-Cloud Strategy

- **AWS (SST v3)**: Frontends, CDN, static assets, example apps
- **GCP (Pulumi)**: Backend service only (Kubernetes)

## Key Files

- `sst.config.ts` - SST v3 configuration (AWS)
- `infra/gcp/` - Pulumi configuration (GCP)
- `infra/components/` - Reusable infrastructure components
- `Dockerfile.base` - Base Docker image
- `services/backend/MigrationDockerfile` - Database migration image

## SST v3 Configuration

**Root Config** (`sst.config.ts`):
```typescript
export default $config({
  app(input) {
    return {
      name: "frak-wallet",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
    };
  },
  async run() {
    await import("./infra/dashboard");
    await import("./infra/example");
  },
});
```

**Stages:**
- `$dev` - Local development (ephemeral)
- `dev` - Development environment (AWS)
- `prod` - Production environment (AWS)

## GCP Configuration

**Stages:**
- `gcp-staging` - GCP staging environment
- `gcp-production` - GCP production environment

**Components:**
- Kubernetes cluster
- Container registry
- Load balancer
- Cloud SQL (PostgreSQL)
- MongoDB Atlas integration

## Environment Variables

**Frontend Apps (Vite):**
- Prefix: `VITE_*`
- Injected at build time via `define` config

**Backend Service:**
- Runtime environment variables
- Secrets via SST Resource (AWS) or Secret Manager (GCP)

## Deployment Commands

```bash
# AWS (SST)
bun run deploy             # Dev stage
bun run deploy:prod        # Prod stage

# GCP (Backend)
bun run deploy-gcp:staging
bun run deploy-gcp:prod
```

## Secrets Management

**AWS (SST):**
```bash
sst secret set DatabaseUrl "postgresql://..."
sst secret list
```

**GCP (Secret Manager):**
```bash
gcloud secrets create jwt-secret --data-file=-
```

## Database Migrations

**Development:**
```bash
cd services/backend
bun run db:generate        # Generate migration
bun run db:migrate         # Apply migration
```

**Production (GCP):**
1. Build migration Docker image
2. Run as Kubernetes Job
3. Deploy backend service

## Rollback

```bash
# SST (AWS)
sst deploy --stage prod --rollback

# GCP (Kubernetes)
kubectl rollout undo deployment/backend
```

## Security

1. Never commit secrets to git
2. Use SST Secret or GCP Secret Manager
3. Principle of least privilege for IAM roles
4. HTTPS only, VPC isolation
