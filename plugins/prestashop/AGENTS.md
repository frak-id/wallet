# plugins/prestashop — Compass

PrestaShop module: Frak SDK injection, order webhook sender, admin config. PHP 8.1+, PrestaShop 8.1+. Module slug `frakintegration`. Installed via admin zip uploader (vendor/ ships inside the zip — no merchant-side composer).

## Quick Commands
```bash
composer install                             # Deps (from this dir)
./build.sh                                   # Package module zip for release (dist/)
vendor/bin/phpunit                           # Unit tests (test/Unit)
composer analyse                             # phpstan vs. real PrestaShop 8.2.6 sources
vendor/bin/phpcs --standard=phpcs.xml.dist   # Style (PSR-12 baseline)
```

## Key Files
- `frakintegration.php` — module bootstrap; thin router. Every `hookXxx()` is a one-line delegator (PrestaShop discovers hooks via reflection, so they MUST live on the Module class).
- `config.xml` / `composer.json` — manifest + canonical version source (`composer.json#version`); `build.sh` propagates into `config.xml` + `frakintegration.php` inside the staged zip only.
- `classes/` — per-surface helpers: `FrakInstaller`, `FrakFrontend`, `FrakOrderWebhook`, `FrakOrderRender`, `FrakDisplayDispatcher`, `FrakSmartyPlugins`, `FrakWebhookHelper`, `FrakWebhookQueue`, `FrakWebhookCron`, `FrakConfig`, `FrakInfra`, `FrakHttpClient`, `FrakPlacementRegistry`, `FrakComponentRenderer`, `FrakMerchantResolver`, `FrakOrderResolver`, `FrakUrls`, `FrakUtils`.
- `controllers/admin/AdminFrakIntegrationController.php` — settings form (brand + secret + placement toggles + maintenance buttons).
- `controllers/front/cron.php` — token-guarded cron front controller (peer of the `actionCronJob` hook).
- `sql/install.php` / `sql/uninstall.php` — schema lifecycle for `frak_webhook_queue`.
- `upgrade/install-X.Y.Z.php` — PrestaShop-native upgrade scripts (auto-discovered; `ps_module.version` is the migration state).
- `override/` — empty stub (PrestaShop expects the directory on every module).
- `views/` — Smarty templates · `test/Unit/` — PHPUnit · `test/docker-compose.yaml` — manual integration env.

## Non-Obvious Patterns
- **Reflection-based hooks**: `hookXxx()` methods MUST stay on the Module class; bodies delegate to `classes/` helpers. Never grow the bootstrap beyond a router.
- **Webhook dispatched at PHP shutdown** (`register_shutdown_function` + `fastcgi_finish_request`) — order responses flush before the HTTP socket opens. Use `actionOrderStatusPostUpdate` (post-commit), NOT `actionOrderStatusUpdate`.
- **HMAC is base64, not hex**: `base64_encode(hash_hmac('sha256', $body, $secret, true))`. Forgetting the third arg silently fails verification on the backend.
- **Webhook URL is `/webhook/custom`** — reuses the cross-platform Elysia route, no `/webhook/prestashop`.
- **Webhook secret is pasted from `business.frak.id`** — no local generation.
- **Cron has two paths**: `actionCronJob` hook (auto-discovered by `ps_cronjobs`) + `controllers/front/cron.php` URL (token-guarded via `hash_equals`). Both share `FrakWebhookCron::run()`; Symfony Lock prevents double-drain.
- **Placements driven by `FrakPlacementRegistry`** — adding a placement = one entry + matching `hookXxx()` delegating to `FrakDisplayDispatcher::dispatch()`. Install/uninstall/migrator/dispatch all read the same list.
- **Hidden `__present` markers for placement checkboxes** — unchecked checkboxes don't submit; without the marker merchants can never disable a placement.
- **One shared DBAL connection + one shared HttpClient**: `FrakInfra::connection()` (Cache + Lock + queue) and `FrakHttpClient::getInstance()` (resolver + webhook). Never instantiate fresh.
- **PHPStan against real PS sources**: `composer analyse` clones `PrestaShop/PrestaShop@8.2.6` into `.cache/prestashop-core/`. Bump in `composer.json#ps-core:fetch` + workflow cache key to roll forward.
- **Vendor ships in the zip**: `build.sh` runs `composer install --no-dev`; `.distignore` excludes `composer.json`/`composer.lock` so merchants can't re-run composer.
- **All `FRAK_*` Configuration access via `FrakConfig`** — typed accessor, no magic strings.
- **Backend-driven SDK config**: only `metadata.{name,logoUrl}` is injected on `window.FrakSetup`; everything else (i18n, modal, share copy) lives on `business.frak.id`.

## Anti-Patterns
Hand-editing `config.xml` / `frakintegration.php` versions (let `build.sh` propagate) · committing `vendor/` (gitignored) · fire-and-forget webhook HTTP without queue fallback · `actionOrderStatusUpdate` instead of `actionOrderStatusPostUpdate` · hex HMAC signature · hard-coding placement hooks outside `FrakPlacementRegistry` · omitting `__present` markers · putting maintenance buttons inside the main settings form · fresh DBAL/HttpClient instances bypassing `FrakInfra`/`FrakHttpClient` · hard-coding `backend.frak.id` / `cdn.jsdelivr.net` outside `FrakUrls` · raw `Configuration::get/updateValue('FRAK_*')` outside `FrakConfig` · reintroducing per-merchant SDK config (lives on dashboard).

## Release Flow
- CI: `.github/workflows/php-plugins.yaml` runs `cs` + `analyse` + `test` on every push.
- Release: dispatch `release-prestashop.yml` with the new version → bump-PR → merge with `release:prestashop` label → tag + zip + GitHub release.

## See Also
Parent `/AGENTS.md` · `plugins/wordpress/AGENTS.md` · `plugins/magento/AGENTS.md` · `services/backend/` (webhook receiver).
