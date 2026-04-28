# plugins/prestashop — Compass

PrestaShop module: Frak SDK injection, order webhook sender, admin config. PHP 8.1+. Module slug `frakintegration`. Installed by uploading the build zip via the PrestaShop admin (no composer install on merchant side — vendor/ ships inside the zip).

## Quick Commands
```bash
composer install                             # Deps (from this dir)
./build.sh                                   # Package module zip for release (dist/)
vendor/bin/phpunit                           # Unit tests (test/Unit)
vendor/bin/phpstan analyse                   # Static analysis (lenient — see phpstan.neon)
vendor/bin/phpcs --standard=phpcs.xml.dist   # Style (PSR-12 baseline)
```

## Key Files
- `frakintegration.php` — module bootstrap (`class FrakIntegration extends Module`, hook registration, install/uninstall, one-shot `ensureSettingsMigrated()` legacy-options sweep keyed on `FRAK_SETTINGS_VERSION`).
- `config.xml` — PrestaShop module manifest (display name, version, tab) — version is rewritten by `build.sh`.
- `composer.json` — canonical version source (`"version"` field). No prod deps; only dev tooling (phpunit / phpstan / phpcs).
- `classes/FrakUtils.php` — host normaliser (`currentHost()`); mirrors WordPress `Frak_Utils::current_host()`.
- `classes/FrakMerchantResolver.php` — resolves the Frak merchant UUID from the shop domain via `GET /user/merchant/resolve`, with eternal cache and 5-min negative cache (mirrors WordPress `Frak_Merchant`).
- `classes/FrakWebhookHelper.php` — HMAC-SHA256 signed `POST /ext/merchant/{id}/webhook/custom` sender. Signature is `base64_encode(hash_hmac('sha256', $body, $secret, true))` (raw bytes, base64-encoded — NOT hex), matching `validateBodyHmac` in `services/backend/src/utils/bodyHmac.ts`. Tight 5 s request / 3 s connect timeouts. Delivery logs go through `PrestaShopLogger::addLog()` (no Configuration-backed log ring).
- `classes/FrakComponentRenderer.php` — emits `<frak-button-share>`, `<frak-post-purchase>`, `<frak-banner>` markup. Mirrors WordPress `Frak_Component_Renderer`; PrestaShop bootstrap classes substitute for WP's `wp-element-button` in the `buttonStyle` preset table.
- `controllers/` — admin + front controllers.
- `classes/FrakWebhookQueue.php` — `{prefix}frak_webhook_queue` table accessor (createTable, dropTable, enqueue, due, markSuccess, markFailure). Backoff schedule mirrors Magento: 5 m/15 m/1 h/6 h/24 h, max 5 attempts.
- `classes/FrakWebhookCron.php` — cron drainer (`run()` selects due rows, calls WebhookHelper, transitions state).
- `controllers/admin/AdminFrakIntegrationController.php` — admin form. Surfaces the cron URL (`{base}/index.php?fc=module&module=frakintegration&controller=cron&token=<FRAK_CRON_TOKEN>`) so the merchant can wire it into `ps_cronjobs` or server cron.
- `controllers/front/cron.php` — token-guarded (`hash_equals`) cron front controller; drains the retry queue per tick.
- `views/` — Smarty templates (`hook/head.tpl`, `admin/configure.tpl`).
- `test/Unit/` — PHPUnit tests.
- `test/docker-compose.yaml` — manual integration env (PrestaShop + MySQL on `localhost:8080`).
- `dist/` — build output (zip lives here, gitignored).

## Non-Obvious Patterns
- **Backend-driven configuration** — only `metadata.{name,logoUrl}` is injected on `window.FrakSetup`. Everything else (i18n, language, modal config, walletUrl, domain, share-button copy/style) is resolved by the SDK against `business.frak.id` once the merchant is registered. The legacy `FRAK_MODAL_LNG`/`FRAK_MODAL_I18N`/`FRAK_SHARING_BUTTON_*` rows are wiped by `ensureSettingsMigrated()` on first request after upgrade.
- **Webhook secret is pasted, not generated** — the merchant copies the secret from `business.frak.id` (Merchant → Purchase Tracker → PrestaShop) into the admin form. There is no "Generate" button; the dashboard owns the canonical value. Mirrors the WordPress plugin's flow.
- **Async webhook with retry queue** — `hookActionOrderStatusPostUpdate` (post-commit, NOT pre-commit `actionOrderStatusUpdate`) attempts a synchronous send with 5 s request / 3 s connect timeouts; any failure (network, non-2xx, exception) is enqueued into `frak_webhook_queue` for cron retry with exponential backoff (5 m/15 m/1 h/6 h/24 h, max 5 attempts). Order-status transitions never block the merchant for more than a few seconds. Idempotent: backend dedupes by `(merchantId, externalId, status)` so re-deliveries are safe.
- **Webhook signature is base64, not hex** — `base64_encode(hash_hmac('sha256', $body, $secret, true))`. The default hash_hmac() return value is hex; sending hex produces a 64-byte buffer after base64-decoding on the backend (vs the expected 32-byte raw digest) and silently fails verification. Magento and WooCommerce sister plugins use the same base64 contract.
- **Webhook URL is `/webhook/custom`** — reuses the existing `customWebhook` Elysia route on the backend (DTO matches what we send: `id`, `customerId`, `status`, `token`, `currency`, `totalPrice`, `items`). No platform-specific `/webhook/prestashop` route exists.
- **Cron token in URL, not session** — the cron front controller is hit by external cron (`ps_cronjobs` or server cron) outside any admin session, so authentication is a 64-char hex `FRAK_CRON_TOKEN` query param compared via `hash_equals`. The full URL is rendered on the admin configuration page for copy-paste. Rotating the token requires deleting `FRAK_CRON_TOKEN` and reinstalling.
- **Component rendering goes through `FrakComponentRenderer`** — every hook surface (`displayProductAdditionalInfo`, `displayOrderConfirmation`) calls `FrakComponentRenderer::shareButton(...)` / `::postPurchase(...)` / `::banner(...)` so emitted attribute serialisation stays consistent with the WordPress plugin's renderer.
- **Three version surfaces, one source**: `composer.json#version` is canonical. `build.sh` propagates to `config.xml` (`<version>`) and `frakintegration.php` (`$this->version`) inside the staged build dir only — the source tree carries the last-released values, the released zip always reflects the resolved version. Bump composer.json (the release workflow does this for you), never edit the other two by hand for releases.
- **Vendor ships in the zip**: PrestaShop merchants install via admin upload, not composer. `build.sh` runs `composer install --no-dev --optimize-autoloader` before staging, and `.distignore` keeps `composer.json` / `composer.lock` out (so composer can't accidentally re-run on the merchant side).
- **`override/` must exist** — PrestaShop expects the directory even when empty; `build.sh` creates it as a safeguard.
- **PSR-12, not PrestaShop's own ruleset** — phpcs uses the PSR-12 baseline shipped with phpcs to avoid pulling `prestashop/php-dev-tools` (heavy dep tree). Layer the PrestaShop ruleset later if needed.
- **PHPStan runs at level 0 with broad `ignoreErrors`** — PrestaShop core classes (`Module`, `Configuration`, `Tools`, `Context`, `Order`, …) aren't loaded during analysis. Mirrors the wordpress plugin's bootstrap pattern; the proper fix is to expand `phpstan-stubs.php` with PrestaShop class stubs.
- **`./build.sh` produces `dist/frakintegration-<version>.zip`** — that zip is the artifact uploaded to merchants via the PrestaShop admin uploader.

## Release Flow
- CI: `.github/workflows/php-plugins.yaml` runs `cs` + `analyse` + `test` on every push touching `plugins/**`.
- Release: dispatch `.github/workflows/release-prestashop.yml` with the new version → opens a `release/prestashop-<version>` PR (bumps `composer.json`, promotes `[Unreleased]` in `CHANGELOG.md`). Merging the PR with the `release:prestashop` label triggers the publish job, which tags `prestashop-<version>`, builds the zip, and creates a GitHub release.

## Anti-Patterns
Hand-editing `config.xml` / `frakintegration.php` versions for a release (let `build.sh` propagate) · committing `vendor/` (gitignored) · adding bundle/zip scripts outside `build.sh` (single source) · running fire-and-forget HTTP for webhooks from the order hook without a queue fallback (use the WebhookHelper + Queue + Cron triad) · using `actionOrderStatusUpdate` instead of `actionOrderStatusPostUpdate` (pre-commit hook races under multistore / high load) · sending the HMAC signature as hex (`hash_hmac('sha256', $body, $secret)` returns hex by default — the backend decodes as base64; ALWAYS pass the third arg `true` for raw and `base64_encode` the result) · reintroducing per-merchant share-button / modal-i18n config (live in `business.frak.id`) · reintroducing the Configuration-backed webhook log ring (use `PrestaShopLogger`) · generating the webhook secret locally (paste from dashboard) · storing the retry queue in `Configuration` (autoloads on every request, see `FrakWebhookQueue` rationale).

## See Also
Parent `/AGENTS.md` · `plugins/magento/AGENTS.md` (parallel build/CI pattern) · `plugins/wordpress/AGENTS.md` (parallel build/CI pattern) · `services/backend/` (webhook receiver) · `.github/actions/release-plugin-prepare-pr` + `release-plugin-publish` (shared release composites).
