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
- Cleaned up `window.FrakSetup` injection to match the current `@frak-labs/components` contract: only `config` and `modalWalletConfig` are emitted, removed dead `modalConfig` / `modalShareConfig` and redundant `walletUrl` / `domain` defaults.
- Added proper plugin headers: `Text Domain`, `Domain Path`, `Requires at least`, `Requires PHP`, `License`, `License URI`.
- Switched to WP 6.3+ script loading strategy (`strategy => 'defer'`) and injected inline config with `'before'` so `window.FrakSetup` is populated prior to SDK bootstrap.
- Bundled nine individual `frak_*` options into a single autoloaded `frak_settings` array (one-time migration on first load) to reduce `wp_options` footprint and collapse reads into a single in-memory lookup. `frak_webhook_secret` and `frak_webhook_logs` remain standalone because of their distinct semantics.
- Marked `frak_webhook_logs` as non-autoloaded — the log list is only read from the settings page, so it no longer hydrates on every request.
- Refactored `Frak_WooCommerce` to a stateless hook container (no instance held in memory between requests).
- Declared WooCommerce HPOS compatibility (`custom_order_tables`) via `before_woocommerce_init`.
- Replaced the inline `fetch()` post-purchase tracker with the SDK's `<frak-post-purchase>` web component on the WooCommerce thank-you page. The component handles auth headers, merchant resolution, and renders the Share & Earn UI without any PHP-side fetch orchestration.
- Dropped jQuery from the admin bundle. `admin/js/admin.js` rewritten in vanilla JS using `fetch`, `URLSearchParams`, and modern DOM APIs.

## [1.0.0] - 2026-04-16

### Added

- Initial release of the Frak WordPress plugin.

[unreleased]: https://github.com/frak-id/wallet/compare/wordpress-1.0.0...HEAD
[1.0.0]: https://github.com/frak-id/wallet/releases/tag/wordpress-1.0.0
