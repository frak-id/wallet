# Changelog

All notable changes to the Frak WordPress plugin are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Add entries under `[Unreleased]` as you work. The release workflow
(`.github/workflows/release-wordpress.yml`) promotes `[Unreleased]` to the new
version on dispatch.

## [Unreleased]

### Changed

- Plugin now requires a block theme for frontend SDK injection (admin notice is shown otherwise).
- Dropped unused `simplito/elliptic-php` dependency (~2.9 MB in the shipped zip).
- Cleaned up `window.FrakSetup` injection to match the current `@frak-labs/components` contract: only `config.metadata` (site name + logo) is emitted; `modalWalletConfig`, `modalConfig`, `modalShareConfig`, per-site modal i18n, and redundant `walletUrl` / `domain` defaults are gone.
- Added proper plugin headers: `Text Domain`, `Domain Path`, `Requires at least`, `Requires PHP`, `License`, `License URI`.
- Switched to WP 6.3+ script loading strategy (`strategy => 'defer'`) and injected inline config with `'before'` so `window.FrakSetup` is populated prior to SDK bootstrap.
- Bundled nine individual `frak_*` options into a single autoloaded `frak_settings` array (one-time migration on first load) to reduce `wp_options` footprint and collapse reads into a single in-memory lookup. `frak_webhook_secret` remains standalone (with autoload forced to `no`) because of its distinct credential semantics. The legacy `frak_webhook_logs` ring buffer option — autoloaded on v1 and no longer written to — is purged from `wp_options` during migration so upgrading installs don't leak dead autoload weight.
- Refactored `Frak_WooCommerce` to a stateless hook container (no instance held in memory between requests).
- Declared WooCommerce HPOS compatibility (`custom_order_tables`) via `before_woocommerce_init`.
- Replaced the hard-coded WooCommerce post-purchase injection with two independent surfaces: a new `frak/post-purchase` Gutenberg block for the UI, and a lightweight inline `trackPurchaseStatus` fallback for attribution. Both recognise the WooCommerce order-received (thank-you, URL-key guarded) and view-order (My Account, `view_order` capability guarded) endpoints, so `customer-id` / `order-id` / `token` are resolved server-side and auto-injected into the block. The inline tracker ALWAYS fires on these endpoints as a failsafe — `trackPurchaseStatus` is idempotent on the same `(customerId, orderId, token)` triple, so the block's web component and the inline fallback can both call it without double-counting. This keeps attribution working when the block is present but the SDK is still warming up, or when the merchant hasn't placed the block at all.
- Dropped jQuery from the admin bundle. `admin/js/admin.js` rewritten in vanilla JS using `fetch`, `URLSearchParams`, and modern DOM APIs.
- Floating wallet button removed entirely. All related settings (`enable_floating_button`, `show_reward`, `button_classname`, `floating_button_position`), admin UI, and `wp_footer` render path are gone. Users place buttons via the new `frak/share-button` Gutenberg block when they want one.
- Per-site modal i18n and language overrides removed from the plugin — these are now driven by the Frak merchant dashboard (`business.frak.id`), keeping the WordPress admin surface focused on what's WP-specific.
- WooCommerce purchase-tracking toggle (`enable_purchase_tracking`) removed. Tracking is now automatic whenever WooCommerce is active; the admin panel just explains when and how it fires.
- Replaced the ad-hoc `frak-integration.php` SPL autoloader with Composer's classmap autoloader. `composer.json` now maps both `includes/` and `admin/`; `build.sh` runs `composer install --optimize-autoloader` so production zips ship a warm classmap and no SPL closures fire per request.
- Settings page CSRF protection: form now emits `wp_nonce_field( Frak_Admin::SETTINGS_NONCE_ACTION )`, and `Frak_Admin::save_settings()` calls `check_admin_referer()` + a second `current_user_can( 'manage_options' )` check before persisting.
- Dropped `image/svg+xml` from the allowed logo upload types (avoids XSS via unsanitized SVG).
- Removed the unused `wp_enqueue_code_editor()` call from the admin settings-page enqueue path.
- Dropped the site-wide `wp_cache_flush()` from the settings save handler — we now only ping page-cache plugins (WP Rocket, W3TC, WP Super Cache) so persistent object caches (Redis, Memcached) are not invalidated on every save.
- Delegated order-status webhook delivery to WooCommerce's native webhook pipeline (`WC_Webhook` + `woocommerce_deliver_webhook_async`). The plugin now creates/updates a single `order.updated` webhook pointing at `https://backend.frak.id/ext/merchant/<id>/webhook/woocommerce`, signed with WC's own `X-WC-Webhook-Signature` (base64 HMAC-SHA256). The `Frak_Webhook_Helper` class, custom HMAC dispatcher, Action Scheduler worker, `frak_dispatch_webhook` action, `woocommerce_order_status_changed` handler, and the ephemeral `wp_cache` log ring buffer were all removed — WooCommerce now owns retry, delivery logging (visible under `WooCommerce → Status → Logs`), and admin visibility under `WooCommerce → Settings → Advanced → Webhooks`. `Frak_WC_Webhook_Registrar::ensure()` now takes a short-lived transient lock and falls back to a name/topic lookup so concurrent admin requests can't spawn duplicate webhook rows, and also watches `update_option_home`/`update_option_siteurl` so domain changes automatically re-point the delivery URL. The `upgrader_process_complete` hook also calls `ensure()` so v1.0 installs (which dispatched webhooks from PHP without ever creating a `WC_Webhook` row) are auto-migrated on plugin update — operators don't have to visit the settings page to keep attribution flowing. The settings page health probe now compares topic, API version, and secret against WooCommerce, surfaces `pending_delivery` and `failure_count`, and renders a "Merchant → Allowed Domains" hint when the domain drifts. `admin/js/admin.js` `postAjax()` is hardened against non-JSON responses (network error, 4xx/5xx, nonce `-1`, missing-action `0`) so button clicks surface a real error notice instead of silently stalling. The backend `/ext/merchant/:id/webhook/woocommerce` handler now acknowledges WooCommerce's unsigned initial `deliver_ping()` (form body `webhook_id=N`) with 200 so new webhooks never get stuck in `pending_delivery=1`, and maps orders carrying any `refunds[]` entries to `refunded` so partial refunds void attribution the same way full refunds do.
- Removed the dead `register_setting()` calls (settings are persisted via the custom nonce-protected handler; registrations were never exercised).

### Added

- New Gutenberg blocks, usable from the FSE site editor on any page/template:
  - `frak/share-button` wraps `<frak-button-share>` (rewards-aware share CTA).
  - `frak/banner` wraps `<frak-banner>` (referral success + in-app browser prompt).
  - `frak/post-purchase` wraps `<frak-post-purchase>` (thank-you card with referrer/referee variants).
  All three are dynamic (`render.php`), attribute-driven, and rely on the globally enqueued SDK — no per-block bundle download.
- `Frak_Blocks` registers every folder under `includes/blocks/` on `init` via a single glob loop, so adding a new block only requires dropping a new folder with `block.json` + `editor.js` + `render.php`.

## [1.0.0] - 2026-04-16

### Added

- Initial release of the Frak WordPress plugin.

[unreleased]: https://github.com/frak-id/wallet/compare/wordpress-1.0.0...HEAD
[1.0.0]: https://github.com/frak-id/wallet/releases/tag/wordpress-1.0.0
