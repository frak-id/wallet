# Frak PrestaShop Module

> Integrates the Frak SDK with PrestaShop 1.7+ / 8.x: rewards-aware share buttons, post-purchase referral surfaces, and HMAC-signed order webhooks for purchase attribution.

| Surface           | Value                                              |
| ----------------- | -------------------------------------------------- |
| Module slug       | `frakintegration`                                  |
| Type              | `prestashop-module`                                |
| PrestaShop        | 1.7.8 → 8.x                                        |
| PHP               | 8.1+ (CI runs 8.4)                                 |
| Distribution      | Admin uploader (zip, no merchant-side composer)    |
| License           | GPL-3.0-only                                       |
| Sister plugins    | [`plugins/wordpress`](../wordpress/) · [`plugins/magento`](../magento/) |

## Installation

1. Download `frakintegration-<version>.zip` from the [GitHub releases](https://github.com/frak-id/wallet/releases?q=prestashop) page.
2. In your PrestaShop back office, go to **Modules → Module Manager → Upload a module** and select the zip.
3. Once uploaded, click **Configure** to open the Frak Integration settings page.
4. Register the shop domain on your [Frak business dashboard](https://business.frak.id) under **Merchant → Allowed Domains** so the merchant resolver can map this shop to a Frak merchant UUID.
5. Copy the webhook secret from **Merchant → Purchase Tracker** in the dashboard, paste it into the **Webhook Secret** field on the module config page, and click **Save**.
6. Click **Refresh Merchant** if the badge does not flip to green automatically.

The module ships its `vendor/` directory inside the zip, so no composer install is required on the merchant side.

## Configuration

The Frak Integration page is reachable from **Modules → Module Manager → Frak → Configure** and exposes:

- **Brand**: shop name + logo URL (defaults to PS_SHOP_NAME + PS_LOGO). Surfaced to the SDK as `metadata.{name,logoUrl}`.
- **Webhook Secret**: the HMAC signing key copied from the Frak business dashboard. Outbound order webhooks are rejected by the backend without a matching secret.
- **Merchant**: read-only display of the resolved Frak merchant UUID + the shop's normalized domain.
- **Refresh Merchant**: invalidates the cached resolver record and forces a fresh `GET /user/merchant/resolve` round-trip — use after a domain rename or after registering the shop on the dashboard for the first time.

The SDK pulls everything else (i18n strings, modal language, share-button copy) from the Frak business dashboard once the merchant is registered, so the module's configuration surface is intentionally minimal.

## Components

### `<frak-button-share>` — Product page share CTA

Rendered automatically on `displayProductAdditionalInfo` via `FrakComponentRenderer::shareButton(['placement' => 'product'])`. Picks up Bootstrap's `btn btn-secondary` classes from the theme by default; the merchant tunes copy and behaviour from the Frak business dashboard.

### `<frak-post-purchase>` — Order confirmation card

Rendered automatically on `displayOrderConfirmation` via `FrakComponentRenderer::postPurchase(...)`. The hook hands `customerId`, `orderId`, and `token` (`secure_key_orderId`) directly to the renderer — no client-side data resolution needed.

### Order status → Frak webhook

`hookActionOrderStatusPostUpdate` maps PrestaShop's `OrderState` ids to Frak's webhook status:

| Trigger                                                    | Frak status |
| ---------------------------------------------------------- | ----------- |
| `PS_OS_WS_PAYMENT`, `PS_OS_PAYMENT`, `PS_OS_DELIVERED`     | `confirmed` |
| `PS_OS_CANCELED`                                           | `cancelled` |
| `PS_OS_REFUND`                                             | `refunded`  |
| `PS_OS_SHIPPING`, `PS_OS_PREPARATION`                      | (skipped)   |
| any other state                                            | `pending`   |

Each delivery is HMAC-SHA256 signed (base64-encoded raw digest, `x-hmac-sha256` header) against the `FRAK_WEBHOOK_SECRET` and POSTed to `https://backend.frak.id/ext/merchant/{merchantId}/webhook/custom`. The hook attempts a synchronous send with tight timeouts (5 s request / 3 s connect); any failure (network, non-2xx, timeout) lands in the `frak_webhook_queue` table and is retried by a cron drainer with exponential backoff (5 min → 24 h, 5 attempts) so order-status transitions never block the merchant for more than a few seconds. Delivery attempts are logged to **Advanced Parameters → Logs** with the `FrakIntegration` prefix.

### Retry cron

Failed webhook deliveries are persisted to a custom `{prefix}frak_webhook_queue` table and drained by a token-guarded front controller exposed at:

```
https://{shop}/index.php?fc=module&module=frakintegration&controller=cron&token={FRAK_CRON_TOKEN}
```

The exact URL is shown on the module configuration page. Wire it into a 5-minute cron — either via the official `ps_cronjobs` module or a server-level cron entry (`*/5 * * * * curl -fs '<URL>'`). The token is generated on install with `bin2hex(random_bytes(32))` and stored under `Configuration::FRAK_CRON_TOKEN`; comparison goes through `hash_equals` to be timing-safe. To rotate, delete the configuration row and reinstall the module.

## Development

```bash
composer install                             # Install runtime + dev dependencies
composer run cs                              # PSR-12 coding standard (phpcs)
composer run analyse                         # Static analysis (phpstan)
composer run test                            # Unit tests (phpunit)
./build.sh                                   # Package the module zip into dist/
```

The `test/docker-compose.yaml` file spins a local PrestaShop instance (PrestaShop + MySQL on `localhost:8080`) for manual smoke testing — see the demo credentials in the file.

The full architecture and refactor roadmap lives in [`docs/prestashop-refactor-plan.md`](../../docs/prestashop-refactor-plan.md).

## Release

The release flow lives in [`.github/workflows/release-prestashop.yml`](../../.github/workflows/release-prestashop.yml):

1. Dispatch the workflow with the new version (e.g. `1.0.1`). It opens a `release/prestashop-<version>` PR that bumps `composer.json#version` and promotes `[Unreleased]` to a dated section in `CHANGELOG.md`.
2. Merge the PR with the `release:prestashop` label. The publish job tags `prestashop-<version>`, builds the zip via `build.sh`, and uploads the artifact to a GitHub Release.

`composer.json#version` is the canonical source of truth for the module version. `build.sh` propagates the resolved version into `config.xml` and `frakintegration.php` inside the staged build directory only — the source tree carries the last-released values, and the released zip always reflects the resolved version.

## Support

For bugs, feature requests, or integration help, open an issue at [github.com/frak-id/wallet](https://github.com/frak-id/wallet/issues). Merchant-facing documentation is at [docs.frak.id](https://docs.frak.id).
