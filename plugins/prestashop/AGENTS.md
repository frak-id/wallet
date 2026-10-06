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
- `classes/` — per-surface helpers: `FrakInstaller`, `FrakFrontend`, `FrakAmbassadorPage`, `FrakCmsMarkers`, `FrakEnv`, `FrakOrderWebhook`, `FrakOrderRender`, `FrakDisplayDispatcher`, `FrakSmartyPlugins`, `FrakWebhookHelper`, `FrakWebhookQueue`, `FrakWebhookCron`, `FrakConfig`, `FrakInfra`, `FrakHttpClient`, `FrakPlacementRegistry`, `FrakComponentRenderer`, `FrakMerchantResolver`, `FrakOrderResolver`, `FrakUrls`, `FrakUtils`.
- `controllers/admin/AdminFrakIntegrationController.php` — settings form (brand + secret + placement toggles + maintenance buttons).
- `controllers/front/cron.php` — token-guarded cron front controller (peer of the `actionCronJob` hook).
- `sql/install.php` / `sql/uninstall.php` — schema lifecycle for `frak_webhook_queue`.
- `upgrade/install-X.Y.Z.php` — PrestaShop-native upgrade scripts (auto-discovered; `ps_module.version` is the migration state).
- `override/` — empty stub (PrestaShop expects the directory on every module).
- `views/` — Smarty templates · `test/Unit/` — PHPUnit (global PrestaShop doubles live in `test/Unit/doubles.php`; never declare one in a test file) · `test/docker-compose.yaml` — local test shop (procedure below).

## Local Test Site
PrestaShop 8.2 on `http://localhost:8080` (back office `/admin4577`, `demo@prestashop.com` / `prestashop_demo`), with this directory mounted as `modules/frakintegration`. Shop and database live only inside the containers: `docker compose down` starts you from zero. The compose project is named `test`, like the WordPress test site: never pass `--remove-orphans`. From `test/`:

```bash
# 0. The dev bundle must define the component (expect the beta version):
curl -s https://sdk-dev.frak.id/components.js
# 1. vendor/ is gitignored and frakintegration.php requires its autoloader:
(cd .. && composer install)
# 2. Start (first boot installs PrestaShop, ~2 min), then install the module and a second language.
#    Run every console/PHP command as www-data: a root run leaves var/cache owned by root and the shop answers 500.
docker compose up -d
docker exec -u www-data prestashop php bin/console prestashop:module install frakintegration
docker exec -u www-data prestashop php -r 'require "config/config.inc.php"; Language::checkAndAddLanguage("fr");'
# 3. Dev stack + a dev merchant with an active campaign (localhost is no merchant):
docker exec prestashop sh -c "printf \"\ndefine('FRAK_ENV', 'dev');\ndefine('FRAK_MERCHANT_DOMAIN', 'frak-dev-08.myshopify.com');\n\" >> config/defines_custom.inc.php"
```

- `frak-dev-08.myshopify.com` resolves on `https://backend.gcp-dev.frak.id/user/merchant/resolve?domain=…` with an active ambassador campaign; any domain registered on `business-dev.frak.id` works. Settings shows the dev notice and "Connected". A failed lookup is cached for 5 minutes: click **Refresh Merchant** after changing the domain.
- Order webhooks in dev need that merchant's secret from `business-dev.frak.id`, pasted in Settings; the production secret does not verify on the dev backend.
- `FRAK_ENV` set to anything but `dev` is ignored (Settings says so). Remove the lines from `config/defines_custom.inc.php` to return to production; the production merchant cache was never touched.
- After changing a constant, clear the browser's site data for `localhost:8080`: the SDK caches the merchant in `localStorage` (`frak-config-cache…`) and `sessionStorage` (`frak-merchant-id`) without the environment.
- The module's own `config.xml` is mounted read-only because the back office rewrites it; the `config_<iso>.xml` it writes instead is gitignored.
- Ambassador page smoke checklist. Each step starts from the state it describes. To get back to "no ambassador page", delete the pages earlier steps left under Design → Pages (an inactive created page only offers Restore, a live page you built hides Create):
  1. With no constant set, the storefront head loads `sdk.frak.id` with no `env`; set both constants and it loads `sdk-dev.frak.id`, `components@beta`, `env:"dev"` and the domain, and Settings shows the notice.
  2. Build a page in Design → Pages with some text and `{frak_ambassador}` on its own line, save, publish: Settings shows it live with the line explaining why there is no Create button, and the page shows the theme heading, your text and the component.
  3. Set that page inactive. Settings → *Create my ambassador page*: one active page titled "Become an ambassador" / "Devenir ambassadeur" per language, showing the component with the merchant's rewards and no theme heading above it.
  4. A page holding `{frak_share_button text="Share & earn"}` shows the share button with that text, and none of the four tags is left as text in its HTML.
  5. Set the created page inactive in Design → Pages → *Restore my ambassador page*: the same page is live at the same URL, and no second page exists.
  6. Delete the created page: Settings offers Create again.
  7. With the created page live, disable the module in Module Manager: the page is inactive. Enable: it is live. Set it inactive yourself, disable, enable: it stays inactive.
  8. With the created page live and a page you built live, uninstall the module: the created page is inactive and still listed, your page is untouched (it shows the marker as text while the module is off). Reinstall: Settings offers Restore when your page is inactive.
  9. Remove both constants and open Settings: no notice, production dashboard links, and the merchant lookup goes to `backend.frak.id`.
  10. Upgrade check, before a release. Comment out the two `volumes:` lines, `docker compose down && docker compose up -d`, upload the previous release zip in Module Manager, add a CMS page with `{frak_ambassador}` (it shows as text), then upload `./build.sh <new version>`'s zip: the page shows the component. Upgrade scripts run only when the new version is above the installed one, so this release must be 1.1.0 or later.
- Tear down with `docker compose down`.

## Non-Obvious Patterns
- **Reflection-based hooks**: `hookXxx()` methods MUST stay on the Module class; bodies delegate to `classes/` helpers. Never grow the bootstrap beyond a router.
- **Webhook dispatched at PHP shutdown** (`register_shutdown_function` + `fastcgi_finish_request`) — order responses flush before the HTTP socket opens. Use `actionOrderStatusPostUpdate` (post-commit), NOT `actionOrderStatusUpdate`.
- **HMAC is base64, not hex**: `base64_encode(hash_hmac('sha256', $body, $secret, true))`. Forgetting the third arg silently fails verification on the backend.
- **Webhook URL is `/webhook/custom`** — reuses the cross-platform Elysia route, no `/webhook/prestashop`.
- **Webhook secret is pasted from `business.frak.id`** — no local generation.
- **Cron has two paths**: `actionCronJob` hook (auto-discovered by `ps_cronjobs`) + `controllers/front/cron.php` URL (token-guarded via `hash_equals`). Both share `FrakWebhookCron::run()`; `FrakLock` (MySQL `GET_LOCK`) prevents double-drain.
- **Placements driven by `FrakPlacementRegistry`** — adding a placement = one entry + matching `hookXxx()` delegating to `FrakDisplayDispatcher::dispatch()`. Install/uninstall/migrator/dispatch all read the same list.
- **Hidden `__present` markers for placement checkboxes** — unchecked checkboxes don't submit; without the marker merchants can never disable a placement.
- **One shared HttpClient**: `FrakHttpClient::getInstance()` (resolver + webhook). Never instantiate fresh.
- **PHPStan against real PS sources**: `composer analyse` clones `PrestaShop/PrestaShop@8.2.6` into `.cache/prestashop-core/`. Bump in `composer.json#ps-core:fetch` + workflow cache key to roll forward.
- **Vendor ships in the zip**: `build.sh` runs `composer install --no-dev`; `.distignore` excludes `composer.json`/`composer.lock` so merchants can't re-run composer.
- **All `FRAK_*` Configuration access via `FrakConfig`** — typed accessor, no magic strings.
- **Backend-driven SDK config**: only `metadata.{name,logoUrl}` is injected on `window.FrakSetup` (plus `env` / `domain` while a dev constant asks for them); everything else (i18n, modal, share copy) lives on `business.frak.id`.
- **Dev switch**: `FRAK_ENV` / `FRAK_MERCHANT_DOMAIN` constants, read by `FrakEnv`. Every origin that differs in dev is private in `FrakUrls` behind a method; only the env-invariant `CDN_BASE` and `WEBHOOK_PATH_SUFFIX` are public constants.
- **`{frak_*}` in CMS pages**: CMS content is printed without Smarty and the HTML cleaner strips `<frak-*>`, so `FrakCmsMarkers` swaps the text tags in the chained `filterCmsContent` hook (return the whole args array).
- **Ambassador page lifecycle**: `FRAK_AMBASSADOR_PAGE_ID` survives uninstall on purpose (a reinstall offers Restore); `enable()` / `disable()` overrides hide and republish the created page.
- **PrestaShop 9 drops what 8.x tolerated**: `AdminController::l()` is gone (use `$this->module->l()`), and `CmsController::$cms` is protected (read `Tools::getValue('id_cms')`). Check admin and front changes on the `prestashop/prestashop:9.1` image too, and run phpstan against a 9.x checkout once (`_PS_ROOT_DIR_=<ps9 root> vendor/bin/phpstan analyse`): `composer analyse` only sees 8.2.6.
- **`registerHook('header')` throws when already registered** on PS 8.2 (core checks it through its `displayHeader` alias). Upgrade scripts register only new hooks, or catch per hook.

## Anti-Patterns
Hand-editing `config.xml` / `frakintegration.php` versions (let `build.sh` propagate) · committing `vendor/` (gitignored) · fire-and-forget webhook HTTP without queue fallback · `actionOrderStatusUpdate` instead of `actionOrderStatusPostUpdate` · hex HMAC signature · hard-coding placement hooks outside `FrakPlacementRegistry` · omitting `__present` markers · putting maintenance buttons inside the main settings form · fresh HttpClient instances bypassing `FrakHttpClient` · hard-coding `backend.frak.id` / `cdn.jsdelivr.net` outside `FrakUrls` · adding a public `FrakUrls` constant for an origin that differs in dev · declaring PrestaShop doubles outside `test/Unit/doubles.php` · running console commands in the test container as root · raw `Configuration::get/updateValue('FRAK_*')` outside `FrakConfig` · reintroducing per-merchant SDK config (lives on dashboard).

## Release Flow
- CI: `.github/workflows/php-plugins.yaml` runs `cs` + `analyse` + `test` on every push.
- Release: dispatch `release-php-plugins.yml` with `prestashop_version` set (leave the other `*_version` inputs empty to skip them, or fill them for a multi-plugin train) → one `release/php-<slug>-<version>…` bump-PR carrying a `release:<plugin>` label per selected plugin → merge → per-plugin tag + zip + GitHub release.

## See Also
Parent `/AGENTS.md` · `plugins/wordpress/AGENTS.md` · `plugins/magento/AGENTS.md` · `services/backend/` (webhook receiver).
