# SDK CDN pointer

## What ships in this PR

A stable, first-party URL — `https://sdk.frak.id/components.js` (prod) /
`https://sdk-dev.frak.id/components.js` (dev) — pointing at the same shim
`sdk/components/cdn/components.js` already builds, which itself pins one
exact jsDelivr version (`@frak-labs/components@<version>/cdn/loader.js`).
The pointer is served from S3 behind a CloudFront `sst.aws.Router`, with
`Cache-Control: public, max-age=300, stale-while-revalidate=86400,
stale-if-error=604800` — short enough that a release becomes live for
merchants in minutes instead of jsDelivr's 7-day floating-tag TTL, without
giving up the CDN's edge caching or its origin failover.

`infra/sdk-pointer.ts` creates the bucket, router and a one-time seed object
(pointing at `@latest` / `@beta` on jsDelivr) so the URL is never a 404
before the first release. `scripts/flip-sdk-pointer.ts` is what each release
workflow runs afterward to overwrite that seed with the just-published exact
version and invalidate the CloudFront cache.

Out of scope for this PR: switching any merchant-facing default to
`sdk.frak.id` (`infra/config.ts` `componentsUrl`, the WordPress/PrestaShop
plugins, `apps/shopify` `listener.liquid` + `buildFrakSnippet`). Those still
point at the jsDelivr `@latest`/`@beta` aliases directly and are a follow-up
PR.

## Deploy order

1. `bun sst deploy --stage prod` (and `--stage dev`) creates the bucket, the
   router + CloudFront distribution, and seeds `components.js`.
2. The next SDK release (`release.yml` for prod, `beta-release.yml` for dev)
   runs `bun run flip:sdk-pointer -- --stage <stage>` after `npm publish`,
   which polls jsDelivr for the exact version and then overwrites the
   pointer and invalidates it.
3. Verify: `curl -I https://sdk.frak.id/components.js` — expect `200`,
   `content-type: text/javascript; charset=utf-8`, the `Cache-Control`
   above, and the CORS/COEP headers from the CloudFront Function
   (`access-control-allow-origin: *`, `cross-origin-resource-policy:
   cross-origin`, `timing-allow-origin: *`, `x-content-type-options:
   nosniff`).
4. Follow-up PR: move merchant-facing defaults to `sdk.frak.id` /
   `sdk-dev.frak.id` — `infra/config.ts` `componentsUrl`,
   `plugins/wordpress`, `plugins/prestashop` `FrakUrls`, and
   `apps/shopify`'s `listener.liquid` + `buildFrakSnippet` — and add a
   `<link rel="preconnect">` to both `sdk.frak.id` (or `sdk-dev.frak.id`)
   and `cdn.jsdelivr.net`, since the pointer still redirects the actual
   module fetch there.

## Rollback

The bucket has `versioning: true`. To revert a bad flip:

```bash
aws s3api list-object-versions --bucket frak-sdk-pointer-<stage> --prefix components.js
aws s3api copy-object --bucket frak-sdk-pointer-<stage> --copy-source "frak-sdk-pointer-<stage>/components.js?versionId=<previous-version-id>" --key components.js
aws cloudfront create-invalidation --distribution-id <id> --paths /components.js
```

## Residual risks

- Verified before merge (2026-09-18): the `frak.id` hosted zone lives in
  Route53 in account `262732185023`, so the Router's `domain` can create the
  alias record and validate the ACM certificate on its own; and
  `github-action-deploy-role` carries `PowerUserAccess` with an OIDC trust
  on `repo:frak-id/*:*`, which covers `s3:PutObject`,
  `cloudfront:ListDistributions` and `cloudfront:CreateInvalidation` from
  both release workflows. Neither is a first-run surprise.
- `sst.config.ts` only loads `infra/sdk-pointer.ts` for the literal `prod`
  and `dev` stages: the bucket name and the `sdk[-dev].frak.id` alias are
  globally exclusive, so a personal AWS stage must never try to claim them.
- Safari does not honor `stale-while-revalidate`, so a Safari client past
  the 5-minute `max-age` blocks on a synchronous refetch instead of serving
  stale-while-refreshing in the background — a ~150 byte response, so the
  added latency is small, but it is not free like it is on Chrome/Firefox.
