# Changelog

All notable changes to the Frak PrestaShop module are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Add entries under `[Unreleased]` as you work. The release workflow
(`.github/workflows/release-prestashop.yml`) promotes `[Unreleased]` to the new
version on dispatch.

## [Unreleased]

### Added

- **Custom cache table (`frak_cache`)**: backs the new `FrakCache` class — a generic key/value/TTL store living outside the autoloaded `ps_configuration` table. Replaces `FRAK_MERCHANT` / `FRAK_MERCHANT_UNRESOLVED_AT` (formerly autoloaded ~1-4 KB JSON blobs hit on every front + back-office request) and hosts the cron drainer's overlap-prevention lock. PrestaShop has no `autoload=no` flag (unlike WordPress's `update_option(..., false)`), so a custom table is the only way to keep cold data cold. Lazy expiry on read, atomic upserts via `INSERT ... ON DUPLICATE KEY UPDATE`, per-request memo for repeat lookups.
- **Buffered file logger (`FrakLogger`)**: replaces direct `PrestaShopLogger::addLog()` calls on hot paths with an in-memory buffer that flushes to per-day rotated files in `_PS_CACHE_DIR_/frak/` at request shutdown. `LEVEL_ERROR` / `LEVEL_CRITICAL` entries still forward to `PrestaShopLogger` so `Advanced Parameters → Logs` keeps the failure trail. Removes the synchronous `ps_log` INSERT per order-status hook (was 5+ rows per transition on the happy path) and per cron-row retry (was 1 info row + 1 error row per row × 25 rows per tick).
- **Cron drainer parallelism (`FrakWebhookHelper::sendBatch()`)**: 25-rows-per-tick batches now dispatch in parallel via `curl_multi_*`. Sequential 2 s requests collapse from ~50 s into a single ~2 s `curl_multi_select` window — the difference between an overlapping cron run (next 5-min tick fires while the previous is still draining) and a single tick that fits inside the cron interval.
- **Cron drainer overlap protection (`FrakCache::acquireLock()`)**: 5-minute TTL'd lock acquired before draining. If a previous tick is still running, the new tick early-returns with a `skipped: true` stat instead of double-sending rows whose state hasn't been updated yet. Stale locks self-clear via the `expires_at` column so a crashed cron never wedges the queue.
- **`FrakWebhookHelper::send()` now accepts an optional pre-loaded `Order`**: `hookActionOrderStatusPostUpdate` already loads the order; passing it through skips the duplicate `new Order($id)` round-trip on the merchant's checkout path.
- **Static request-cache primitives**: `FrakPlacementRegistry::isEnabled()` reads through a per-request memo (one bundled-row decode regardless of how many `display*` hooks fire on a page); `FrakWebhookHelper::getCachedSecret()` / `getWebhookUrl()` cache after first lookup so the cron drainer's 25-row loop hits `Configuration::get('FRAK_WEBHOOK_SECRET')` exactly once.
- **Resource hints in the `<head>`**: `dns-prefetch` + `preconnect` to `cdn.jsdelivr.net` so the browser warms the TLS handshake while parsing continues. Mirrors the WordPress sibling's `wp_resource_hints` filter — saves ~100-300 ms TTFB on first SDK paint over mobile networks.
- **`FrakLoggerTest`** (PHPUnit): seven pure-PHP tests covering buffer order, level numbering, `LEVEL_*` constants matching `PrestaShopLogger` severity, and `drainForTesting()` semantics.

### Changed

- **Bundled placement storage**: the per-placement `FRAK_PLACEMENT_*` Configuration rows that an unreleased pre-1.0.1 iteration of the module wrote out separately collapse into a single JSON-encoded `FRAK_PLACEMENTS` row. One autoloaded row vs N — `ps_configuration` is loaded entirely into memory on every request, so a smaller payload is real RAM saved per page. One `Configuration::updateValue` per save vs N — admin save is atomic at the storage layer. Mirrors the WordPress sibling's `frak_settings` pattern. Production v0.0.4 shops never wrote the per-placement rows; dev shops on the unreleased layout have their choices migrated verbatim by `upgrade/install-1.0.1.php`.
- **SDK script registration moved to `actionFrontControllerSetMedia` hook**: the `<script src="...">` tag now flows through PrestaShop's native `registerJavascript()` with `attribute: defer` + `position: bottom` + `priority: 200`. Asset-manager-aware (CCC dedupes if another module asks for the same URL) and merchant-controllable via `Performance → CCC`. Mirrors the WordPress sibling's `wp_enqueue_script(..., strategy: defer, in_footer: true)` pattern. `head.tpl` is reduced to resource hints + the inline `window.FrakSetup` config block (the latter must stay inline so the SDK reads a non-empty config when it boots from the deferred tag).
- **`hookActionOrderStatusPostUpdate` hot-path order**: skip-list check (`PS_OS_SHIPPING` / `PS_OS_PREPARATION`) now runs BEFORE the `Order` load. Most state transitions on a busy shop go through `preparation → shipping`, both of which are skipped — the previous code paid for an `Order` instantiation + a `ps_log` write before throwing the result away. `PS_OS_*` lookups batched via `Configuration::getMultiple()` so the 7 individual calls collapse into one autoload-cache walk.
- **Smarty plugin registration is now request-idempotent**: a static `$smartyRegistered` flag short-circuits the `unregisterPlugin` + `registerPlugin` × 3 dance after the first call. PrestaShop news up the module class multiple times per request (header hook, dispatch, admin link); the previous code paid for 6 × N array writes per request.
- **`FrakMerchantResolver` storage moved to `FrakCache`**: the merchant record (`merchant:{host}`) and negative cache (`merchant_unresolved:{host}`) now live in the new cache table with a TTL'd `expires_at` column. The previous Configuration-backed negative cache stored a unix timestamp and forced every reader to do the math. `LEGACY_CONFIG_KEY` / `LEGACY_NEGATIVE_CACHE_KEY` constants preserved so the uninstall path and the upgrade migrator can defensively sweep any pre-1.0.1 dev rows that still linger.
- **Admin controller batch reads**: `Configuration::getMultiple()` for the 4 brand + webhook keys instead of 4 separate calls. `buildPlacementGroups()` reads the bundled placement map once via `FrakPlacementRegistry::getEnabledMap()` instead of N `isEnabled()` calls per render.

### Removed

- **Per-row `Configuration::get('FRAK_PLACEMENT_*')` lookups**: replaced by the bundled storage row + per-request memo (see Changed → bundled placement storage). Any pre-1.0.1 dev rows are folded into the bundled storage and deleted by `upgrade/install-1.0.1.php`.
- **`PrestaShopLogger::addLog` happy-path spam**: dropped the "Triggered" / "Started" / "Sent successfully" trio that wrote to `ps_log` synchronously per order transition and contained zero actionable information. Failures still log via `FrakLogger::error()` which forwards to `PrestaShopLogger`.

### Added

- **Banner component is now reachable**: previously `FrakComponentRenderer::banner()` existed but no PrestaShop hook ever invoked it. New auto-render placements expose it on `displayTop` and `displayHome` (both opt-in by default).
- **Auxiliary share-button placement**: opt-in `displayShoppingCart` placement so merchants can ship a “share your cart” referral CTA.
- **Placement registry** (`FrakPlacementRegistry`): single source of truth mapping each component × hook tuple to a `FRAK_PLACEMENT_*` Configuration toggle. Adding / removing a storefront surface is now a one-line registry edit — the install / uninstall / migration / dispatch paths read from the same list. Mirrors the WordPress plugin’s flexibility (block / shortcode / widget / Elementor) using PrestaShop’s native hook + Smarty surfaces instead of a block editor.
- **Smarty function plugins** (`{frak_banner}`, `{frak_share_button}`, `{frak_post_purchase}`): merchants can drop Frak components anywhere in their `.tpl` files or CMS pages without forking the module. Snake_case attribute keys are normalised to camelCase at the boundary so templates read naturally (`{frak_banner referral_title="..."}`). Mirrors WordPress’s `[frak_*]` shortcodes byte-for-byte.
- **Renderer**: `FrakComponentRenderer::snakeKeysToCamel()` public helper used by the Smarty boundary (and any future surface that arrives with snake_case input).
- **Admin: placement toggles**: one checkbox per registered placement, grouped by component. Reads / writes the `FRAK_PLACEMENT_*` Configuration rows. Hidden `__present` markers let the controller distinguish “unchecked” from “not in form” so toggles can be turned off.
- **Admin: webhook queue health panel**: surfaces pending / delivered / failed counts, the next-attempt timestamp, and the most recent error from `FrakWebhookQueue::stats()`. New “Drain now” button calls `FrakWebhookCron::run()` synchronously — useful when the cron URL has not been wired up yet, or to flush a backlog after fixing a backend outage.
- **`FrakWebhookQueue::stats()`**: aggregated `(state, count, oldest_pending_at)` snapshot plus the latest non-empty `last_error` row. Two queries total, indexed lookups only, safe to call on every admin render.
- **Admin sidebar entry**: `AdminFrakIntegration` is now registered as a first-class `Tab` under Modules in the back-office sidebar. Daily operational tooling (queue health, Drain queue, Refresh merchant) gets one-click access instead of routing through Module Manager → Configure on every visit, and the Tab gates per-employee access through PrestaShop’s standard Permissions panel.
- **`FrakLogoUploaderTest`** (PHPUnit): six pure-PHP tests covering the extension allowlist, oversize rejection, case-insensitive extension handling, and the `isLocalUrl()` happy-path / foreign-domain / missing-file branches. The `move_uploaded_file()` happy path needs a real HTTP POST context and stays out of unit-test scope.

### Changed

- **Admin form**: collapsed the two separate Save buttons (Brand / Webhook) into a single “Save Settings” submit that also persists placement toggles. Refresh Merchant + Drain Queue moved to a dedicated “Maintenance” panel because they are stateful operations, not config writes.
- **PrestaShop module file layout**: schema lifecycle moved to `sql/install.php` + `sql/uninstall.php`; legacy-options sweep + cron-token provisioning + hook migration moved to `upgrade/install-1.0.1.php` (auto-discovered by PrestaShop on version bump). `index.php` directory-listing stubs added in every shipped directory; `override/` committed as an empty placeholder so the source tree mirrors the released zip layout.
- **Hook registration**: `install()` / `uninstall()` / `upgrade/install-1.0.1.php` now drive their hook lists from `FrakPlacementRegistry::distinctHooks()` instead of hard-coded chains. Removes the “forget to register a hook in three different places” failure mode.
- **Native PrestaShop versioning replaces `FRAK_SETTINGS_VERSION`**: PrestaShop's own `ps_module.version` is now the single source of truth for migration state. Existing v0.0.4 installs run `upgrade/install-1.0.1.php` once (auto-dispatched on first admin load after the version bump), which fixes two gaps the previous in-class sweep missed: the `FRAK_FLOATING_BUTTON_ENABLED` / `FRAK_FLOATING_BUTTON_POSITION` rows and the `displayFooter` hook registration.
- **Admin JS extracted to `views/js/admin.js`**: the logo-preview script that previously lived inline in `configure.tpl` is now a static file loaded via `setMedia()`. Browsers cache it across admin renders (was re-shipped on every render) and merchants running Content-Security-Policy no longer need `unsafe-inline` for this admin page.
- **`FrakLogoUploader` extracted from the admin controller**: file validation (extension allowlist, 2 MB cap) and the `isLocalUrl()` prefix + `file_exists()` guard live in an i18n-agnostic helper class. The controller maps `ERROR_*` codes to translated messages — the helper itself is unit-testable without bootstrapping PrestaShop. `processBrandFields()` shrinks from 47 to 25 lines.
- **Hook registration unified via `CORE_HOOKS` const**: `install()` and `uninstall()` now register both plumbing hooks (`header`, `actionOrderStatusPostUpdate`) and `FrakPlacementRegistry::distinctHooks()` through one `array_merge` loop. One edit covers both paths instead of three independent chains.
- **Dropped per-class `require_once` chain**: composer’s classmap autoload already covers `classes/`, so the eight `require_once` lines in `frakintegration.php` plus six in the admin controller were redundant `stat()` syscalls on every request. Only `vendor/autoload.php` is retained.
- **Lint configs cover migrations**: `phpcs.xml.dist` and `phpstan.neon` now include `sql/` and `upgrade/` so future migration scripts get style-checked and analysed. PHPStan ignore pattern broadened to cover `parent::setMedia()` style “static method” errors on the stubbed `ModuleAdminController`.
- **Runtime uploads gitignored**: only the `.htaccess` security stub stays tracked. The admin controller already calls `mkdir()` lazily on first logo upload, so the runtime path is unchanged.

### Removed

- `FrakIntegration::ensureSettingsMigrated()` + `cleanupLegacyOptions()` + `ensureCronTokenExists()` + `migrateOrderStatusHook()` and the `SETTINGS_VERSION` constant. Migration logic is now in `upgrade/install-1.0.1.php`, dispatched by PrestaShop's native upgrade discovery.
- `FrakWebhookQueue::createTable()` / `dropTable()`. Schema lifecycle lives in `sql/install.php` / `sql/uninstall.php` — single source of truth.

### Fixed

- **Webhook signature format**: send `base64_encode(hash_hmac('sha256', $body, $secret, true))` (raw bytes, base64-encoded) instead of the default hex digest, matching the backend's `Buffer.from(sig, 'base64')` decode in `validateBodyHmac`. Hex signatures decoded to a 64-byte buffer (vs the expected 32-byte raw digest) and silently failed verification on every dispatch.
- **Webhook endpoint URL**: switch from `/ext/merchant/{id}/webhook/prestashop` (which was never registered on the backend and 404’d every request) to `/ext/merchant/{id}/webhook/custom`, the existing route whose DTO already matches the PrestaShop payload shape.

### Changed

- **Order status hook**: switch from `actionOrderStatusUpdate` (pre-commit, raced under multistore / high load) to `actionOrderStatusPostUpdate` (post-commit), per the official PrestaShop docs.
- **Webhook timeouts**: tighten cURL request timeout to 5 s and connect timeout to 3 s (was 30 s / 10 s). Worst-case delay on the merchant’s checkout path is now bounded; failures hit the retry queue instead.

### Added

- **Async webhook retry queue** (`FrakWebhookQueue` + `FrakWebhookCron`): the order hook attempts a synchronous send with tight timeouts; any failure (network, non-2xx, exception) is enqueued into a custom `{prefix}frak_webhook_queue` table and retried by a cron drainer with exponential backoff (5 min → 24 h, 5 attempts max). Idempotent re-delivery via the backend’s `(merchantId, externalId, status)` dedupe key.
- **Cron front controller** (`controllers/front/cron.php`): token-guarded (`hash_equals` against `FRAK_CRON_TOKEN`) endpoint that drains the retry queue per tick. The full URL is shown on the admin configuration page so the merchant can wire it into `ps_cronjobs` or a server-level cron job.
- **Settings migrator**: existing installs auto-provision the queue table, generate `FRAK_CRON_TOKEN`, and re-register from the old `actionOrderStatusUpdate` hook to `actionOrderStatusPostUpdate` on first request after upgrade (rolled into the existing v2 settings bump).
- **Initial release of the Frak PrestaShop module.**
- Post-purchase tracker: inline `<script>` fires `window.FrakSetup.core.trackPurchaseStatus({customerId, orderId, token})` on the order-confirmation and customer order-detail pages, with a `frak:client` event fallback for the SDK-not-yet-ready race. Mirrors the WordPress `Frak_WooCommerce::render_purchase_tracker_for_order` flow.
- Post-purchase component: `<frak-post-purchase>` now auto-receives `products` (JSON-encoded line items: title / image URL / product link, capped at 6) on the order-confirmation page so the sharing UI can render product cards out of the box.
- New hook `displayOrderDetail`: customer My-Account → Orders → Detail page now renders the same `<frak-post-purchase>` + tracker pair, keeping attribution working when the merchant lands on the order via the post-checkout email link.
- New `views/templates/hook/post-purchase.tpl` Smarty partial: theme-overridable wrapper for the post-purchase markup. Override path: `themes/<theme>/modules/frakintegration/views/templates/hook/post-purchase.tpl`.
- New `FrakOrderResolver` class: single-pass extraction of customer/order/token context plus product line items from a resolved `Order`, fail-soft on missing images / deleted products. Sibling of the WordPress `Frak_WooCommerce::get_post_purchase_data()` helper.

[unreleased]: https://github.com/frak-id/wallet/commits/main/plugins/prestashop
