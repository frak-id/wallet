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
- **Order webhooks now send an explicit per-item `sku`, aligning the Magento payload with WooCommerce/PrestaShop/custom webhooks.** `WebhookSender::buildPayload()` adds a `sku` key (from `$item->getSku()`) to every line item; `name` now carries the human-readable product name (`$item->getName()`) instead of doubling as the SKU. The backend's Magento webhook handler drops its special name-as-SKU mapping and reads the explicit `sku` field like every other integration, so product-scoped campaigns match on SKU consistently across all storefronts.

## [1.0.0] - 2026-03-26

### Added

- Initial release of the Frak Magento 2 module.

[unreleased]: https://github.com/frak-id/wallet/compare/magento-1.0.0...HEAD
[1.0.0]: https://github.com/frak-id/wallet/releases/tag/magento-1.0.0
