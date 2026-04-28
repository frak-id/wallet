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
- `frakintegration.php` — module bootstrap (`class FrakIntegration extends Module`, hook registration, install/uninstall)
- `config.xml` — PrestaShop module manifest (display name, version, tab) — version is rewritten by `build.sh`
- `composer.json` — canonical version source (`"version"` field). No prod deps; only dev tooling (phpunit / phpstan / phpcs).
- `classes/FrakMerchantResolver.php` — resolves the Frak merchant UUID from the shop domain via `GET /user/merchant/resolve`, with eternal cache and 5-min negative cache (mirrors WordPress `Frak_Merchant`).
- `classes/FrakWebhookHelper.php` — HMAC-SHA256 signed `POST /ext/merchant/{id}/webhook/prestashop` sender + Configuration-backed log ring (50 entries).
- `controllers/` — admin + front controllers
- `views/` — Smarty templates + admin assets
- `uploads/` — runtime uploads dir (shipped empty)
- `test/Unit/` — PHPUnit tests
- `test/docker-compose.yaml` — manual integration env (PrestaShop + MySQL on `localhost:8080`)
- `dist/` — build output (zip lives here, gitignored)

## Non-Obvious Patterns
- **Three version surfaces, one source**: `composer.json#version` is canonical. `build.sh` propagates to `config.xml` (`<version>`) and `frakintegration.php` (`$this->version`) inside the staged build dir only — the source tree carries the last-released values, the released zip always reflects the resolved version. Bump composer.json (the release workflow does this for you), never edit the other two by hand for releases.
- **Vendor ships in the zip**: PrestaShop merchants install via admin upload, not composer. `build.sh` runs `composer install --no-dev --optimize-autoloader` before staging, and `.distignore` keeps `composer.json` / `composer.lock` out (so composer can't accidentally re-run on the merchant side).
- **`override/` must exist** — PrestaShop expects the directory even when empty; `build.sh` creates it as a safeguard.
- **Webhook contract mirrors WordPress** (HMAC-signed, merchant-id keyed endpoint) — kept intentionally parallel for backend simplicity. `x-hmac-sha256` header, raw JSON body.
- **PSR-12, not PrestaShop's own ruleset** — phpcs uses the PSR-12 baseline shipped with phpcs to avoid pulling `prestashop/php-dev-tools` (heavy dep tree). Layer the PrestaShop ruleset later if needed.
- **PHPStan runs at level 0 with broad `ignoreErrors`** — PrestaShop core classes (`Module`, `Configuration`, `Tools`, `Context`, `Order`, …) aren't loaded during analysis. Mirrors the wordpress plugin's bootstrap pattern; the proper fix is to add a `phpstan-bootstrap.php` with PrestaShop class stubs.
- **`./build.sh` produces `dist/frakintegration-<version>.zip`** — that zip is the artifact uploaded to merchants via the PrestaShop admin uploader.

## Release Flow
- CI: `.github/workflows/php-plugins.yaml` runs `cs` + `analyse` + `test` on every push touching `plugins/**`.
- Release: dispatch `.github/workflows/release-prestashop.yml` with the new version → opens a `release/prestashop-<version>` PR (bumps `composer.json`, promotes `[Unreleased]` in `CHANGELOG.md`). Merging the PR with the `release:prestashop` label triggers the publish job, which tags `prestashop-<version>`, builds the zip, and creates a GitHub release.

## Anti-Patterns
Hand-editing `config.xml` / `frakintegration.php` versions for a release (let `build.sh` propagate) · committing `vendor/` (gitignored) · adding bundle/zip scripts outside `build.sh` (single source) · running fire-and-forget HTTP for webhooks (use `FrakWebhookHelper` + retry) · pulling the old `bundle_1.sh` / `bundle_2.sh` patterns (replaced by unified `build.sh`).

## See Also
Parent `/AGENTS.md` · `plugins/magento/AGENTS.md` (parallel build/CI pattern) · `plugins/wordpress/AGENTS.md` (parallel build/CI pattern) · `services/backend/` (webhook receiver) · `.github/actions/release-plugin-prepare-pr` + `release-plugin-publish` (shared release composites).
