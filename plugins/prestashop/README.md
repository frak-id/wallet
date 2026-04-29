# Frak PrestaShop Module

> Integrates the Frak SDK with PrestaShop 8.1+: rewards-aware share buttons, post-purchase referral surfaces, and HMAC-signed order webhooks for purchase attribution.

| Surface           | Value                                              |
| ----------------- | -------------------------------------------------- |
| Module slug       | `frakintegration`                                  |
| Type              | `prestashop-module`                                |
| PrestaShop        | 8.1+                                               |
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
- **Component Placements**: one checkbox per registered placement (share button on product / cart, banner at top / homepage, post-purchase on order confirmation / order detail). Lets merchants opt placements in or out without editing code or theme files.
- **Merchant**: read-only display of the resolved Frak merchant UUID + the shop's normalized domain.
- **Maintenance → Refresh Merchant**: invalidates the cached resolver record and forces a fresh `GET /user/merchant/resolve` round-trip — use after a domain rename or after registering the shop on the dashboard for the first time.
- **Maintenance → Webhook queue**: pending / delivered / parked counts pulled from `FrakWebhookQueue::stats()`, the next-attempt timestamp for the oldest pending row, and the most recent error message. The companion **Drain queue now** button calls `FrakWebhookCron::run()` synchronously — useful before the cron URL is wired up, or to flush a backlog after fixing a backend outage.

The SDK pulls everything else (i18n strings, modal language, share-button copy) from the Frak business dashboard once the merchant is registered, so the module's configuration surface is intentionally minimal.

## Components

Three Frak web components are available: `<frak-button-share>`, `<frak-banner>`, and `<frak-post-purchase>`. Each one can be auto-rendered on a configurable set of PrestaShop hooks (the **Component Placements** section in the admin), or dropped into any `.tpl` file / CMS page via Smarty function plugins.

### Auto-render placements

| Component | Placement id | PrestaShop hook | Default | `placement` attr |
| --- | --- | --- | --- | --- |
| `<frak-button-share>` | `share_product` | `displayProductAdditionalInfo` | enabled | `product` |
| `<frak-button-share>` | `share_cart` | `displayShoppingCart` | disabled | `cart` |
| `<frak-banner>` | `banner_top` | `displayTop` | disabled | `top` |
| `<frak-banner>` | `banner_home` | `displayHome` | disabled | `home` |
| `<frak-post-purchase>` | `post_purchase_confirmation` | `displayOrderConfirmation` | enabled | `order-confirmation` |
| `<frak-post-purchase>` | `post_purchase_detail` | `displayOrderDetail` | enabled | `view-order` |

Adding / removing a placement is a single edit in [`classes/FrakPlacementRegistry.php`](classes/FrakPlacementRegistry.php) plus a matching `hookXxx()` callback in [`frakintegration.php`](frakintegration.php) that delegates to `dispatchHook()`.

### Smarty function plugins

Theme files and CMS pages can drop Frak components anywhere via three Smarty function plugins registered by the module:

```smarty
{frak_banner placement="hero" referral_title="Welcome back!"}
{frak_share_button text="Share & earn" use_reward=1 placement="sidebar"}
{frak_post_purchase variant="referrer" cta_text="Earn rewards"}
```

Snake_case attribute keys are normalised to camelCase at the boundary so templates read naturally. The post-purchase variant emits the bare `<frak-post-purchase>` markup — order context (`customer-id` / `order-id` / `token`) is only auto-injected when the auto-render hooks (`displayOrderConfirmation`, `displayOrderDetail`) fire; pass the triple explicitly (`customer_id`, `order_id`, `token`) when calling the Smarty function on a non-order endpoint.

### Post-purchase order-context resolution

On the auto-render order hooks, `<frak-post-purchase>` receives `customerId`, `orderId`, and `token` (`secure_key_orderId`) resolved by `FrakOrderResolver::getPostPurchaseData()` — no client-side data resolution needed. The same call pulls up to 6 line items (title / image URL / product link) and forwards them as a JSON-encoded `products` attribute so the SDK can paint product cards out of the box.

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
