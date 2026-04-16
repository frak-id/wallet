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
- Bundled nine individual `frak_*` options into a single autoloaded `frak_settings` array (one-time migration on first load) to reduce `wp_options` footprint and collapse reads into a single in-memory lookup. `frak_webhook_secret` and `frak_webhook_logs` remain standalone because of their distinct semantics.
- Marked `frak_webhook_logs` as non-autoloaded — the log list is only read from the settings page, so it no longer hydrates on every request.
- Refactored `Frak_WooCommerce` to a stateless hook container (no instance held in memory between requests).
- Declared WooCommerce HPOS compatibility (`custom_order_tables`) via `before_woocommerce_init`.
- Replaced the hard-coded WooCommerce post-purchase injection with two independent surfaces: a new `frak/post-purchase` Gutenberg block for the UI, and a lightweight inline `trackPurchaseStatus` fallback for attribution. Both recognise the WooCommerce order-received (thank-you, URL-key guarded) and view-order (My Account, `view_order` capability guarded) endpoints, so `customer-id` / `order-id` / `token` are resolved server-side and auto-injected into the block. When the block renders with that context it suppresses the inline fallback so the reward endpoint is never called twice; when the block is absent, the `wp_footer` fallback still fires so tracking keeps working.
- Dropped jQuery from the admin bundle. `admin/js/admin.js` rewritten in vanilla JS using `fetch`, `URLSearchParams`, and modern DOM APIs.
- Floating wallet button removed entirely. All related settings (`enable_floating_button`, `show_reward`, `button_classname`, `floating_button_position`), admin UI, and `wp_footer` render path are gone. Users place buttons via the new `frak/share-button` Gutenberg block when they want one.
- Per-site modal i18n and language overrides removed from the plugin — these are now driven by the Frak merchant dashboard (`business.frak.id`), keeping the WordPress admin surface focused on what's WP-specific.
- WooCommerce purchase-tracking toggle (`enable_purchase_tracking`) removed. Tracking is now automatic whenever WooCommerce is active; the admin panel just explains when and how it fires.
- Replaced the ad-hoc `frak-integration.php` SPL autoloader with Composer's classmap autoloader. `composer.json` now maps both `includes/` and `admin/`; `build.sh` runs `composer install --optimize-autoloader` so production zips ship a warm classmap and no SPL closures fire per request.
- Settings page CSRF protection: form now emits `wp_nonce_field( Frak_Admin::SETTINGS_NONCE_ACTION )`, and `Frak_Admin::save_settings()` calls `check_admin_referer()` + a second `current_user_can( 'manage_options' )` check before persisting.
- Dropped `image/svg+xml` from the allowed logo upload types (avoids XSS via unsanitized SVG).
- Removed the unused `wp_enqueue_code_editor()` call from the admin settings-page enqueue path.
- Dropped the site-wide `wp_cache_flush()` from the settings save handler — we now only ping page-cache plugins (WP Rocket, W3TC, WP Super Cache) so persistent object caches (Redis, Memcached) are not invalidated on every save.
- `Frak_WooCommerce::init()` only registers `woocommerce_order_status_changed` + `frak_dispatch_webhook` when a webhook secret is configured, so unconfigured stores pay zero cost on order-status transitions.
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
