# SDK CDN pointer

## What ships in this PR

A stable, first-party URL — `https://sdk.frak.id/components.js` (prod) /
`https://sdk-dev.frak.id/components.js` (dev) — serving the same one-line
shim `sdk/components/cdn/components.js` builds, which pins one exact jsDelivr
version (`@frak-labs/components@<version>/cdn/loader.js`). It is an S3
object behind a CloudFront `sst.aws.Router`, with `Cache-Control: public,
max-age=300, stale-while-revalidate=86400, stale-if-error=604800` — a
release reaches merchants in minutes instead of jsDelivr's 7-day
floating-tag TTL, while the loader and chunks stay on jsDelivr as immutable
exact-version URLs, so no bandwidth moves.

The pointer is entirely Pulumi-managed. `infra/sdk-pointer.ts` generates the
object content from `sdk/components/package.json`, so `bun sst deploy --stage
sdk-pointer` (or `sdk-pointer-dev`) *is* the flip: a version change is a
diff on the object, and the Router invalidates `/components.js` whenever the
version token changes. The stages are separate from `prod`/`dev` on purpose:
the release workflow and `deploy.yml` both run on `main`, and separate stages
mean separate state locks.

Out of scope here: switching any merchant-facing default to `sdk.frak.id`
(`infra/config.ts` `componentsUrl`, the WordPress/PrestaShop plugins,
`apps/shopify` `listener.liquid` + `buildFrakSnippet`). Those still load
jsDelivr `@latest`/`@beta` directly and are a follow-up PR.

## Deploy order

1. Merge. Nothing deploys yet — `deploy.yml` never touches these stages.
2. The next SDK release (`release.yml` on `main`, `beta-release.yml` on
   `dev`) publishes to npm, waits until jsDelivr serves
   `@<version>/cdn/loader.js` (`scripts/wait-for-jsdelivr.ts`), then runs
   `bun sst deploy --stage sdk-pointer[-dev]`. The first run creates the
   bucket, the distribution and the ACM certificate (a few minutes); later
   runs only rewrite the object and invalidate.
3. Verify: `curl -I https://sdk.frak.id/components.js` — expect `200`,
   `content-type: text/javascript; charset=utf-8`, the `Cache-Control`
   above, and the edge-injected headers (`access-control-allow-origin: *`,
   `cross-origin-resource-policy: cross-origin`, `timing-allow-origin: *`,
   `x-content-type-options: nosniff`).
4. Follow-up PR: move merchant-facing defaults to `sdk.frak.id` /
   `sdk-dev.frak.id` — `infra/config.ts` `componentsUrl`,
   `plugins/wordpress`, `plugins/prestashop` `FrakUrls`, and
   `apps/shopify`'s `listener.liquid` + `buildFrakSnippet` — and
   `<link rel="preconnect">` to both the pointer host and
   `cdn.jsdelivr.net`, since the module fetch still goes there.

## Rollback / hotfix pin

```bash
SDK_POINTER_VERSION=1.2.1 bun sst deploy --stage sdk-pointer
```

Any published version works; `scripts/wait-for-jsdelivr.ts` honours the
same variable if you want the readiness check first. The bucket also keeps
object versions (`versioning: true`) as a last resort.

## Residual risks

- Verified before merge (2026-09-18): the `frak.id` hosted zone lives in
  Route53 in account `262732185023`, so the Router's `domain` can create the
  alias record and validate the ACM certificate on its own; and
  `github-action-deploy-role` carries `PowerUserAccess` with an OIDC trust
  on `repo:frak-id/*:*`, which covers the deploy from both release
  workflows.
- Deploying `sdk-pointer` from a branch points every merchant on the
  pointer at that branch's `package.json` version. It is published as long
  as the branch is `main` after a release; from anywhere else, run the
  readiness script first or set `SDK_POINTER_VERSION`.
- Safari does not honour `stale-while-revalidate`, so a Safari client past
  the 5-minute `max-age` blocks on a synchronous refetch of ~150 bytes
  instead of refreshing in the background as Chrome/Firefox do.
