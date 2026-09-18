# SDK CDN pointer

## What ships in this PR

A stable, first-party URL — `https://sdk.frak.id/components.js` (prod) /
`https://sdk-dev.frak.id/components.js` (dev) — serving the same one-line
shim `sdk/components/cdn/components.js` builds, which pins one exact jsDelivr
version (`@frak-labs/components@<version>/cdn/loader.js`). It is an S3
object behind a CloudFront `sst.aws.Router`, with `Cache-Control: public,
max-age=300, stale-if-error=604800` — a release reaches merchants within
5 minutes plus one page load instead of jsDelivr's 7-day floating-tag TTL,
while the loader and chunks stay on jsDelivr as immutable exact-version
URLs, so no bandwidth moves.

Deliberately no `stale-while-revalidate`: it would let a browser run the
old version for one more page load after the 5 minutes, in exchange for
hiding a single `304` round trip that the deferred script mostly hides
behind HTML parsing anyway (and Safari ignores the directive). Every
browser therefore converges on the same schedule: next page load after
`max-age`. `stale-if-error` stays so an outage of the pointer keeps serving
the last known version for a week; a first visit during an outage takes
the `onerror` fallback instead.

The pointer is entirely Pulumi-managed. `infra/sdk-pointer.ts` generates the
object content from `sdk/components/package.json`, so `bun sst deploy --stage
sdk-pointer` (or `sdk-pointer-dev`) *is* the flip: a version change is a
diff on the object, and a `command.local.Command` keyed on the version runs
`aws cloudfront create-invalidation` for `/components.js` and waits for it
(`sst.aws.Router` declares an `invalidation` arg but does not implement it in
4.14.3, and SST's internal `DistributionInvalidation` provider cannot be
imported from user code: the config is bundled before `.sst/platform` is
extracted, so a fresh checkout fails to build). Deploying these stages
therefore needs the AWS CLI on the machine; GitHub runners ship it. The
stages are separate from `prod`/`dev` on purpose:
the release workflow and `deploy.yml` both run on `main`, and separate stages
mean separate state locks.

Every merchant-facing integration now points at the pointer instead of
jsDelivr's floating tag, as a **classic deferred script** (not `type=module`)
with an `onerror` fallback and asymmetric preconnects:

```html
<link rel="dns-prefetch" href="https://sdk.frak.id">
<link rel="preconnect" href="https://sdk.frak.id">
<link rel="dns-prefetch" href="https://cdn.jsdelivr.net">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<script
    src="https://sdk.frak.id/components.js"
    defer="defer"
    onerror="var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@frak-labs/components@latest/cdn/components.js';s.defer=true;document.head.appendChild(s)"
></script>
```

The pointer file is a single `import()` statement, so a failed load executed
nothing — the fallback replaces it wholesale without double-evaluating
anything. The `crossorigin` asymmetry is deliberate: the pointer's own fetch
is no-cors, so its preconnect must not carry `crossorigin`, while the
fallback's `import()` is a CORS-mode module fetch, so jsDelivr's must — the
browser only reuses a preconnected socket when the credentials mode matches.

Covered: `infra/config.ts` `componentsUrl` (flows into Shopify as
`FRAK_COMPONENTS_URL`), `apps/shopify`'s `listener.liquid` theme block and
`buildFrakSnippet.ts` copy-paste snippet (both derive the preconnect host and
the fallback tag from the resolved URL: `sdk-dev.frak.id` → `@beta`, else
`@latest`), `sdk/components`
README, `plugins/wordpress`, `plugins/prestashop`, and the deployed
`example/vanilla-js` demo (`vanilla.frak-labs.com`, stage `example`), which
loads `sdk-dev.frak.id` like a dev-stage merchant — the place to watch a
beta release propagate. `plugins/magento` is
excluded by policy (dead scaffolding, see `plugins/magento/AGENTS.md`).

## Deploy order

1. Merge. Nothing deploys yet — `deploy.yml` never touches the pointer
   stages, and the merchant-facing changes here only take effect once each
   surface is redeployed/republished (Shopify app deploy, plugin releases).
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
4. Ship the merchant-facing changes: redeploy `apps/shopify` (the metafield
   sync in `ensureComponentsUrlMetafield` rewrites `frak.components_url` on
   the shop's next admin load once `FRAK_COMPONENTS_URL` changes) and cut
   new releases of `plugins/wordpress` / `plugins/prestashop`.

## Rollback / hotfix pin

```bash
SDK_POINTER_VERSION=1.2.1 bun sst deploy --stage sdk-pointer
```

Any published version works; `scripts/wait-for-jsdelivr.ts` honours the
same variable if you want the readiness check first. The bucket also keeps
object versions (`versioning: true`) as a last resort. Independently, every
integration's `onerror` fallback covers the pointer being unreachable at all
(CloudFront/S3 outage, DNS) by loading jsDelivr's floating tag instead.

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
- Once per visitor per 5-minute window, the components boot one round trip
  later (`If-None-Match` → `304` on the preconnected socket, ~30–100 ms);
  the loader chain behind it is several times that.
- The `onerror` fallback only fires on a *load* failure (network error,
  DNS, non-2xx on the script fetch); it cannot catch the pointer serving a
  200 with broken content, which is why `release.yml` verifies the exact
  jsDelivr URL before flipping rather than trusting the fallback for that case.
