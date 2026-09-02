# Changelog

All notable changes to the Frak Magento 2 module are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Add entries under `[Unreleased]` as you work. The release workflow
(`.github/workflows/release-php-plugins.yml`) promotes `[Unreleased]` to the new
version on dispatch.

## [Unreleased]

### Changed

- **The floating wallet button now opens the Frak sharing page.** The embedded wallet drawer it used to open has been retired. No admin action is needed: the block, the `wallet_button.phtml` template and the `Show Wallet Button` / `Wallet Button Position` settings are unchanged, and the position injected through `window.FrakSetup.modalWalletConfig` is still honoured.
- **BREAKING: `window.FrakSetup.config.walletUrl` is replaced by `config.env`, which states the wallet and backend origins together.** The SDK dropped `walletUrl` in `@frak-labs/core-sdk` 2.0.0 / `@frak-labs/components` 2.0.0, where the backend origin is no longer guessed from the wallet URL. `SdkLoader::getFrakConfig()` now emits `env: { wallet, backend }` built from the existing **Stores → Configuration → Frak SDK → URLs** fields, so no admin change is required. The pair is resolved as a unit by `Config::getEnvironment()` — clearing either URL field falls both back to production and logs a warning, rather than pairing a custom origin with the other environment's default. The purchase tracker and the order webhook read the same pair, so a half-configured store cannot track against a backend the SDK was never told about.

  **Upgrading requires `bin/magento setup:di:compile`.** `SdkLoader` takes a new constructor argument; a compiled store that drops in the new files without recompiling will fatal.

  **Release step — pin the Components CDN default in this release, not before.** `etc/config.xml` defaults `components_url` to `@frak-labs/components@latest`, so jsDelivr, not the merchant, picks the bundle. Releasing this module against `@latest` leaves a default-config store running a 2.0.0 bundle that reads `env` while the module still sends `walletUrl`, falling back to the production wallet with no deploy and no warning. The release commit MUST move that default to `@frak-labs/components@2` **in the same release that ships this module**, and 2.0.0 must already be on npm when it does: `@2` resolves to nothing until then, so pinning ahead of the publish breaks every default-config store on the current 1.x. Merchants who pinned the field to a `@1.x` bundle must move it in the same deploy as this module.
- **Order webhooks now send an explicit per-item `sku`, aligning the Magento payload with WooCommerce/PrestaShop/custom webhooks.** `WebhookSender::buildPayload()` adds a `sku` key (from `$item->getSku()`) to every line item; `name` now carries the human-readable product name (`$item->getName()`) instead of doubling as the SKU. The backend's Magento webhook handler drops its special name-as-SKU mapping and reads the explicit `sku` field like every other integration, so product-scoped campaigns match on SKU consistently across all storefronts.

## [1.0.0] - 2026-03-26

### Added

- Initial release of the Frak Magento 2 module.

[unreleased]: https://github.com/frak-id/wallet/compare/magento-1.0.0...HEAD
[1.0.0]: https://github.com/frak-id/wallet/releases/tag/magento-1.0.0
