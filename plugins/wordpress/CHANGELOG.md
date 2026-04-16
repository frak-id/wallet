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
- Replaced the hard-coded WooCommerce post-purchase injection with two independent surfaces: a new `frak/post-purchase` Gutenberg block for the UI, and a lightweight inline `trackPurchaseStatus` call on the WooCommerce thank-you page for attribution. The two are decoupled — tracking still fires even if the merchant never drops the block onto their template.
- Dropped jQuery from the admin bundle. `admin/js/admin.js` rewritten in vanilla JS using `fetch`, `URLSearchParams`, and modern DOM APIs.
- Floating wallet button removed entirely. All related settings (`enable_floating_button`, `show_reward`, `button_classname`, `floating_button_position`), admin UI, and `wp_footer` render path are gone. Users place buttons via the new `frak/share-button` Gutenberg block when they want one.
- Per-site modal i18n and language overrides removed from the plugin — these are now driven by the Frak merchant dashboard (`business.frak.id`), keeping the WordPress admin surface focused on what's WP-specific.
- WooCommerce purchase-tracking toggle (`enable_purchase_tracking`) removed. Tracking is now automatic whenever WooCommerce is active; the admin panel just explains when and how it fires.

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
