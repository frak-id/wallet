# Frak SDK — Adobe Commerce (Magento 2) Module

## Implementation Plan

**Date:** 2026-03-24
**Target:** Adobe Commerce Enterprise 2.4.8 (PHP 8.3/8.4)
**Client stack:** Custom Luma-child theme, Fastly CDN, Sansec CSP module, Composer-based integration
**Module name:** `frak-labs/magento2-module` (Composer type: `magento2-module`)
**Location:** `plugins/magento/` in the Frak wallet monorepo

---

## Table of Contents

1. [Overview & Goals](#1-overview--goals)
2. [Architecture Decision: Monorepo Placement](#2-architecture-decision-monorepo-placement)
3. [Module Structure](#3-module-structure)
4. [Feature Breakdown](#4-feature-breakdown)
   - 4.1 [SDK Injection (all pages)](#41-sdk-injection-all-pages)
   - 4.2 [Web Components (product/category pages)](#42-web-components-productcategory-pages)
   - 4.3 [Post-Purchase Webhook (server-side)](#43-post-purchase-webhook-server-side)
   - 4.4 [Client-Side Purchase Tracking (success page)](#44-client-side-purchase-tracking-success-page)
   - 4.5 [Ad-Blocker Resistant Identity (frak-client-id)](#45-ad-blocker-resistant-identity-frak-client-id)
   - 4.6 [Admin Configuration](#46-admin-configuration)
   - 4.7 [CSP Whitelist](#47-csp-whitelist)
5. [Backend Integration Contract](#5-backend-integration-contract)
6. [Shopify vs Magento Feature Map](#6-shopify-vs-magento-feature-map)
7. [Potential Roadblocks & Mitigations](#7-potential-roadblocks--mitigations)
8. [Testing Strategy](#8-testing-strategy)
9. [CI Pipeline](#9-ci-pipeline)
10. [Publishing & Distribution](#10-publishing--distribution)
11. [Monorepo Config Changes](#11-monorepo-config-changes)
12. [Implementation Phases](#12-implementation-phases)
13. [Open Questions](#13-open-questions)
14. [Oracle Review — Corrections & Additions](#14-oracle-review--corrections--additions)

---

## 1. Overview & Goals

Build a Composer-installable PHP module for Adobe Commerce 2.4.8 that replicates the Frak Shopify app's core functionality:

1. **SDK injection** — Load `@frak-labs/components` from CDN on every storefront page with `window.FrakSetup` config
2. **Web Components** — Render `<frak-button-share>`, `<frak-button-wallet>`, `<frak-open-in-app>` on product pages
3. **Post-purchase webhook** — Send order data to Frak backend on purchase completion
4. **Client-side purchase tracking** — Track purchases via JS on the checkout success page (identity linking)
5. **Ad-blocker resistant identity** — Capture `frak_client_id` in HTTP checkout context and forward it in the initial webhook
6. **Admin configuration** — Merchant-configurable settings in `Stores > Configuration > Frak`
7. **CSP compliance** — Ship `csp_whitelist.xml` for all required Frak domains

### What We're NOT Building

- **No embedded merchant dashboard** — Merchants use `business.frak.id` directly
- **No OAuth / session management** — Module runs inside Magento admin natively
- **No Magento-side database** (for purchases) — Purchase tracking goes to Frak backend. Only a small `fraklabs_webhook_queue` table for retry queue.
- **No app billing** — Handled via Frak business dashboard

### Backend Changes Required

A dedicated `/webhook/magento` endpoint with a `MagentoWebhookDto` (includes `clientId` field). Plus `"magento"` added to `WebhookPlatformSchema`. See [§5 Backend Integration Contract](#5-backend-integration-contract) for details.

---

## 2. Architecture Decision: Monorepo Placement

**Decision:** Keep the module in the monorepo under `plugins/magento/`.

**Rationale:**
- Atomic cross-cutting changes when backend API contracts change (same PR for backend + Shopify + Magento)
- Proven pattern — Shopify was migrated from its own repo for the same reasons
- PHP footprint is small (~25 files) — manageable with path-scoped tooling isolation
- Oracle consultation confirmed this approach

**Guardrails:**
- Strict toolchain isolation — `plugins/` excluded from Biome, TSConfig, Knip, Bun workspaces
- Path-filtered CI — PHP pipeline only runs when `plugins/` changes
- Independent release cycles — Magento versioned separately from npm SDK
- CODEOWNERS file for `plugins/` directory

**Future:** WordPress plugin will move from its separate repo to `plugins/wordpress/` following the same pattern.

---

## 3. Module Structure

```
plugins/magento/
├── composer.json                           # type: magento2-module, frak-labs/magento2-module
├── registration.php                        # ComponentRegistrar::register()
├── phpunit.xml                             # PHPUnit config for standalone unit tests
├── phpstan.neon                            # PHPStan config (level 5+, bitexpert/phpstan-magento)
├── phpcs.xml.dist                          # PHPCS Magento2 coding standard
├── PLAN.md                                 # This file
├── AGENTS.md                               # AI agent knowledge base (generated)
├── etc/
│   ├── module.xml                          # Module declaration, sequence after Checkout+Sales
│   ├── config.xml                          # Default admin config values (enabled=0, URLs)
│   ├── acl.xml                             # Admin ACL: FrakLabs_Sdk::config
│   ├── di.xml                              # Dependency injection bindings
│   ├── csp_whitelist.xml                   # CSP: cdn.jsdelivr.net, wallet.frak.id, backend.frak.id
│   ├── events.xml                          # Observers: order placed + invoice pay + creditmemo
│   └── adminhtml/
│       └── system.xml                      # Admin config UI definition
├── Block/
│   ├── SdkLoader.php                       # Loads SDK + sets window.FrakSetup (all pages)
│   ├── ShareButton.php                     # <frak-button-share> (product pages)
│   ├── WalletButton.php                    # <frak-button-wallet> (configurable placement)
│   ├── OpenInApp.php                       # <frak-open-in-app> deep-link component
│   └── PurchaseTracker.php                 # Client-side tracking (checkout success page)
├── Model/
│   ├── Config.php                          # ScopeConfig wrapper (+ webhook_secret decryption guard for 0:3: prefix)
│   ├── WebhookSender.php                   # GuzzleHttp POST to Frak backend with HMAC signing
│   ├── WebhookRetryFactory.php             # Runtime retry backend selection (MQ vs cron)
│   └── Retry/
│       ├── MessageQueueRetry.php           # Uses Magento MQ (RabbitMQ/MySQL) when available
│       └── CronRetry.php                   # Fallback: DB table + cron with exponential backoff
├── Observer/
│   ├── OrderPlaceAfterObserver.php         # checkout_submit_all_after → sends webhook (pending)
│   └── OrderStatusUpdateObserver.php       # invoice_pay → confirmed, creditmemo → refunded
├── Api/
│   └── WebhookRetryInterface.php           # Interface for retry mechanism
├── view/
│   └── frontend/
│       ├── layout/
│       │   ├── default.xml                 # SDK loader + wallet button + open-in-app on all pages
│       │   ├── catalog_product_view.xml    # Share button on product pages
│       │   └── checkout_onepage_success.xml  # Purchase tracker on success page
│       ├── templates/
│       │   ├── sdk_loader.phtml            # SDK script + window.FrakSetup config
│       │   ├── share_button.phtml          # <frak-button-share> web component
│       │   ├── wallet_button.phtml         # <frak-button-wallet> web component
│       │   ├── open_in_app.phtml           # <frak-open-in-app> web component
│       │   └── purchase_tracker.phtml      # Client-side POST to /user/track/purchase
├── Test/
│   └── Unit/
│       ├── Model/
│       │   ├── ConfigTest.php
│       │   └── WebhookSenderTest.php
│       ├── Observer/
│       │   └── OrderPlaceAfterObserverTest.php
│       └── Block/
│           └── SdkLoaderTest.php
└── i18n/
    ├── en_US.csv                           # English translations
    └── fr_FR.csv                           # French translations
```

---

## 4. Feature Breakdown

### 4.1 SDK Injection (all pages)

**Goal:** Load the Frak SDK and set `window.FrakSetup` on every storefront page.

**Implementation:**

Layout XML (`view/frontend/layout/default.xml`):
```xml
<page xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:noNamespaceSchemaLocation="urn:magento:framework:View/Layout/etc/page_configuration.xsd">
    <body>
        <!-- Use after.body.start (page layout skeleton tier) — NOT head.additional
             Reason: after.body.start is defined in page_layout/empty.xml (skeleton).
             A theme that overrides Magento_Theme/layout/default.xml cannot kill it.
             head.additional IS defined in that overridable file and can be silently orphaned. -->
        <referenceContainer name="after.body.start">
            <block class="FrakLabs\Sdk\Block\SdkLoader"
                   name="fraklabs_sdk_loader"
                   template="FrakLabs_Sdk::sdk_loader.phtml"
                   before="-"/>
        </referenceContainer>
    </body>
</page>
```

Template (`view/frontend/templates/sdk_loader.phtml`):
```php
<?php
/** @var \FrakLabs\Sdk\Block\SdkLoader $block */
/** @var \Magento\Framework\Escaper $escaper */
/** @var \Magento\Framework\View\Helper\SecureHtmlRenderer $secureRenderer */

if (!$block->isEnabled()) {
    return;
}

$componentsUrl = $block->getComponentsUrl();
$config = $block->getFrakConfig();
?>

<!-- IMPORTANT: Set config FIRST, then load SDK script.
     type="module" scripts are deferred by default — but we want FrakSetup
     to be available the moment the SDK initializes, with no race condition. -->

<!-- Set window.FrakSetup config (runs immediately, before SDK loads) -->
<?= /* @noEscape */ $secureRenderer->renderTag(
    'script',
    [],
    'window.FrakSetup = ' . /* @noEscape */ $config . ';',
    false
) ?>

<!-- Load Frak SDK components from CDN (deferred, runs after config is set) -->
<?= /* @noEscape */ $secureRenderer->renderTag(
    'script',
    ['type' => 'module', 'src' => $escaper->escapeUrl($componentsUrl)],
    '',
    false
) ?>
```

`SdkLoader` must generate full Shopify-parity setup fields:
```javascript
window.FrakSetup = {
    config: {
        walletUrl: "...",
        metadata: {
            name: "...",
            lang: "...",
            logoUrl: "...",
            merchantId: "...",
        },
        customizations: {
            css: null,
            i18n: {},
        },
        domain: window.location.host,
    },
    modalConfig: {
        login: {
            allowSso: true,
            ssoMetadata: {
                logoUrl: "...",
                homepageLink: window.location.host,
            },
        },
    },
    modalShareConfig: { link: window.location.href },
    modalWalletConfig: { metadata: { position: "..." } },
};
```

**Why `$secureRenderer->renderTag()`:** This is mandatory for CSP compliance since Magento 2.4.7+. It automatically computes a SHA-256 hash of the script content and adds it to the CSP header. Raw `<script>` tags are blocked on checkout pages (restrict mode) and will eventually be blocked everywhere.

**Why `after.body.start` and not `head.additional`:**
- `after.body.start` is defined in `page_layout/empty.xml` (skeleton tier) — themes that override `Magento_Theme/layout/default.xml` cannot remove it
- `head.additional` is defined in module layout tier and can be silently orphaned by theme overrides
- Magento core itself uses `after.body.start` for RequireJS config (if themes removed it, the entire store would break)
- Trade-off: scripts load from `<body>` not `<head>`. The `defer` attribute on the external script mitigates this — it downloads in parallel regardless of DOM position

**Fastly cache compatibility:**
- Block is cacheable by default (no `cacheable="false"` attribute)
- Config values read from Magento's core_config_data cache, not per-request DB queries
- `$secureRenderer` uses hash-based CSP (not nonces) on cached pages — compatible with FPC + Fastly

---

### 4.2 Web Components (product/category pages)

**Goal:** Render Frak web components on product pages.

Layout XML (`view/frontend/layout/catalog_product_view.xml`):
```xml
<page xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:noNamespaceSchemaLocation="urn:magento:framework:View/Layout/etc/page_configuration.xsd">
    <body>
        <!-- Share button on product pages -->
        <referenceContainer name="product.info.main">
            <block class="FrakLabs\Sdk\Block\ShareButton"
                   name="fraklabs_sdk_share_button"
                   template="FrakLabs_Sdk::share_button.phtml"
                   after="product.info.addtocart"/>
        </referenceContainer>
    </body>
</page>
```

Template (`view/frontend/templates/share_button.phtml`):
```php
<?php
/** @var \FrakLabs\Sdk\Block\ShareButton $block */
if (!$block->isEnabled() || !$block->showShareButton()) {
    return;
}
?>
<div class="fraklabs-share-button">
    <frak-button-share
        text="<?= $escaper->escapeHtmlAttr($block->getShareButtonText()) ?>"
        <?= $block->useReward() ? 'use-reward' : '' ?>
    ></frak-button-share>
</div>
```

**Placement strategy:** Use `product.info.main` container which is standard across Luma-based themes. The `after="product.info.addtocart"` positions it after the add-to-cart button. Custom themes that reorganize product pages may need merchant-side layout XML override — but this is expected and documented.

**Wallet button** follows the same pattern but is placed in `default.xml` (all pages) using `after.body.start` container for the floating button, with a configurable position (left/right) from admin config.

**Open-in-app component** is also rendered from `default.xml` via an `OpenInApp` block and `open_in_app.phtml` template:
```php
<frak-open-in-app></frak-open-in-app>
```

**Category pages (Phase 2):** v1 intentionally scopes share-button integration to product pages only. Category listing integration is deferred post-launch and can be added with `view/frontend/layout/catalog_category_view.xml` once UX placement is validated.

---

### 4.3 Post-Purchase Webhook (server-side)

**Goal:** Send order data to Frak backend when an order is placed.

**This is the PRIMARY tracking mechanism** — more reliable than client-side because it doesn't depend on JS execution, ad-blockers, or browser behavior.

**Event choice:** `checkout_submit_all_after`
- Fires after the complete quote-to-order conversion
- Provides both `$order` and `$quote` objects
- Fires once per checkout (unlike `sales_order_save_after` which fires on every order save)

> **Lifecycle caveat:** `checkout_submit_all_after` fires when the order is created in Magento's database. For synchronous payments (credit card, PayPal Express in-context), this happens during checkout. For asynchronous/redirect payments (PayPal redirect, bank transfer), the order may already exist with `pending_payment` status. The `sales_order_invoice_pay` observer handles payment confirmation for these cases, which is why full lifecycle observation is required.

Events XML (`etc/events.xml`):
```xml
<?xml version="1.0"?>
<config xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:noNamespaceSchemaLocation="urn:magento:framework:Event/etc/events.xsd">
    <!-- Order placed → status: pending -->
    <event name="checkout_submit_all_after">
        <observer name="fraklabs_sdk_order_place_after"
                  instance="FrakLabs\Sdk\Observer\OrderPlaceAfterObserver"/>
    </event>
    <!-- Invoice paid → status: confirmed -->
    <event name="sales_order_invoice_pay">
        <observer name="fraklabs_sdk_order_invoice_pay"
                  instance="FrakLabs\Sdk\Observer\OrderStatusUpdateObserver"/>
    </event>
    <!-- Credit memo → status: refunded -->
    <event name="sales_order_creditmemo_save_after">
        <observer name="fraklabs_sdk_order_creditmemo"
                  instance="FrakLabs\Sdk\Observer\OrderStatusUpdateObserver"/>
    </event>
</config>
```

Observer (`Observer/OrderPlaceAfterObserver.php`):
```php
<?php
declare(strict_types=1);

namespace FrakLabs\Sdk\Observer;

use FrakLabs\Sdk\Model\Config;
use FrakLabs\Sdk\Model\WebhookSender;
use Magento\Framework\Event\Observer;
use Magento\Framework\Event\ObserverInterface;
use Magento\Framework\Stdlib\Cookie\CookieReaderInterface;
use Psr\Log\LoggerInterface;

class OrderPlaceAfterObserver implements ObserverInterface
{
    public function __construct(
        private readonly Config $config,
        private readonly WebhookSender $webhookSender,
        private readonly CookieReaderInterface $cookieReader,
        private readonly LoggerInterface $logger
    ) {}

    public function execute(Observer $observer): void
    {
        // Handle both single-order and multi-order events
        $order = $observer->getEvent()->getOrder();
        $orders = $observer->getEvent()->getOrders();

        if ($orders) {
            foreach ($orders as $singleOrder) {
                $this->processOrder($singleOrder);
            }
        } elseif ($order) {
            $this->processOrder($order);
        }
    }

    private function processOrder($order): void
    {
        // CRITICAL: resolve config for the ORDER's store, not the current store
        // Global observers don't automatically scope config to the order's store view
        if (!$this->config->isEnabled($order->getStoreId())) {
            return;
        }

        if (!$order->getId()) {
            return;
        }

        try {
            // Cookie exists only in checkout HTTP context
            $clientId = $this->cookieReader->getCookie('frak_client_id');
            $this->webhookSender->sendOrderWebhook($order, 'pending', $clientId);
        } catch (\Exception $e) {
            // CRITICAL: Never let webhook failure break checkout.
            // Log and move on. The purchase claim flow handles reconciliation.
            $this->logger->error(
                '[FrakSDK] Webhook failed: ' . $e->getMessage(),
                ['order_id' => $order->getIncrementId()]
            );
        }
    }
}
```

Observer (`Observer/OrderStatusUpdateObserver.php`):
```php
<?php
declare(strict_types=1);

namespace FrakLabs\Sdk\Observer;

use FrakLabs\Sdk\Model\Config;
use FrakLabs\Sdk\Model\WebhookSender;
use Magento\Framework\Event\Observer;
use Magento\Framework\Event\ObserverInterface;

class OrderStatusUpdateObserver implements ObserverInterface
{
    public function __construct(
        private readonly Config $config,
        private readonly WebhookSender $webhookSender
    ) {}

    public function execute(Observer $observer): void
    {
        $eventName = (string) $observer->getEvent()->getName();

        if ($eventName === 'sales_order_invoice_pay') {
            $invoice = $observer->getEvent()->getInvoice();
            $order = $invoice?->getOrder();
            if ($order && $this->config->isEnabled($order->getStoreId())) {
                // Admin/cron contexts may not have browser cookie; clientId intentionally omitted
                $this->webhookSender->sendOrderWebhook($order, 'confirmed', null);
            }
            return;
        }

        if ($eventName === 'sales_order_creditmemo_save_after') {
            $creditmemo = $observer->getEvent()->getCreditmemo();
            $order = $creditmemo?->getOrder();
            if ($order && $this->config->isEnabled($order->getStoreId())) {
                $this->webhookSender->sendOrderWebhook($order, 'refunded', null);
            }
        }
    }
}
```

Webhook Sender (`Model/WebhookSender.php`):
```php
<?php
declare(strict_types=1);

namespace FrakLabs\Sdk\Model;

use GuzzleHttp\ClientFactory;
use Magento\Sales\Api\Data\OrderInterface;
use Psr\Log\LoggerInterface;

class WebhookSender
{
    public function __construct(
        private readonly Config $config,
        private readonly ClientFactory $clientFactory,
        private readonly LoggerInterface $logger
    ) {}

    public function sendOrderWebhook(
        OrderInterface $order,
        string $status,
        ?string $clientId
    ): void
    {
        $merchantId = $this->config->getMerchantId($order->getStoreId());
        $webhookSecret = $this->config->getWebhookSecret($order->getStoreId());
        $backendUrl = $this->config->getBackendUrl($order->getStoreId());

        if (!$merchantId || !$webhookSecret) {
            $this->logger->warning('[FrakSDK] Missing merchantId or webhook secret');
            return;
        }

        // Build payload matching MagentoWebhookDto
        $payload = $this->buildPayload($order, $status, $clientId);
        $body = json_encode($payload, JSON_THROW_ON_ERROR);

        // HMAC-SHA256 signature (base64-encoded, raw binary)
        $signature = base64_encode(
            hash_hmac('sha256', $body, $webhookSecret, true)
        );

        $url = rtrim($backendUrl, '/')
            . '/ext/merchant/' . $merchantId . '/webhook/magento';

        $client = $this->clientFactory->create([
            'config' => [
                'timeout' => 5,
                'connect_timeout' => 3,
            ],
        ]);

        $response = $client->request('POST', $url, [
            'headers' => [
                'Content-Type' => 'application/json',
                'x-hmac-sha256' => $signature,
            ],
            'body' => $body,
        ]);

        // IMPORTANT: Backend always returns HTTP 200.
        // Success = body "ok", Failure = body "ko: {message}"
        $responseBody = (string) $response->getBody();
        if (str_starts_with($responseBody, 'ko:')) {
            $this->logger->warning(
                '[FrakSDK] Webhook rejected by backend: ' . $responseBody,
                ['order' => $order->getIncrementId()]
            );
        }
    }

    private function buildPayload(
        OrderInterface $order,
        string $status,
        ?string $clientId
    ): array
    {
        $items = [];
        foreach ($order->getAllVisibleItems() as $item) {
            $items[] = [
                'productId' => (string) $item->getProductId(),
                'quantity' => (int) $item->getQtyOrdered(),
                'price' => (string) $item->getPrice(),
                'name' => (string) $item->getSku(),
                'title' => (string) $item->getName(),
            ];
        }

        return [
            'id' => (string) $order->getIncrementId(),
            'customerId' => (string) ($order->getCustomerId() ?? $order->getCustomerEmail()),
            'status' => $this->mapOrderStatus($status),
            // Canonical token is protectCode. Keep quoteId fallback only here.
            'token' => (string) ($order->getProtectCode() ?? $order->getQuoteId()),
            'currency' => $order->getOrderCurrencyCode(),
            'totalPrice' => (string) $order->getGrandTotal(),
            'items' => $items,
            // clientId captured during checkout_submit_all_after HTTP request
            'clientId' => $clientId,
        ];
    }

    private function mapOrderStatus(string $status): string
    {
        return match ($status) {
            'confirmed' => 'confirmed',
            'refunded' => 'refunded',
            default => 'pending',
        };
    }
}
```

**Key design decisions:**
- Uses dedicated `MagentoWebhookDto` format on `/webhook/magento`
- HMAC-SHA256 with base64 encoding (matches `validateBodyHmac()` in backend)
- Connect timeout: 3s, request timeout: 5s — never blocks checkout for long
- All errors caught in observer — checkout completion is never affected
- Uses `$order->getProtectCode()` as the canonical purchase token

---

### 4.4 Client-Side Purchase Tracking (success page)

**Goal:** On the checkout success page, POST to `/user/track/purchase` with identity headers to link the purchase to a Frak user.

**Why this is needed in addition to the server-side webhook:**
The server-side webhook sends order data but has no way to include the SDK identity tokens (`x-wallet-sdk-auth`, `x-frak-client-id`) that live in the browser's sessionStorage/localStorage. The client-side tracker bridges this gap.

Layout XML (`view/frontend/layout/checkout_onepage_success.xml`):
```xml
<page xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:noNamespaceSchemaLocation="urn:magento:framework:View/Layout/etc/page_configuration.xsd">
    <body>
        <referenceContainer name="content">
            <block class="FrakLabs\Sdk\Block\PurchaseTracker"
                   name="fraklabs_sdk_purchase_tracker"
                   template="FrakLabs_Sdk::purchase_tracker.phtml"
                   after="-"/>
        </referenceContainer>
    </body>
</page>
```

Template (`view/frontend/templates/purchase_tracker.phtml`):
```php
<?php
/** @var \FrakLabs\Sdk\Block\PurchaseTracker $block */
/** @var \Magento\Framework\View\Helper\SecureHtmlRenderer $secureRenderer */

if (!$block->isEnabled()) {
    return;
}

$orderData = $block->getOrderTrackingData();
if (!$orderData) {
    return;
}
?>

<?= /* @noEscape */ $secureRenderer->renderTag(
    'script',
    [],
    <<<JS
    (function() {
        var interactionToken = sessionStorage.getItem('frak-wallet-interaction-token');
        var clientId = localStorage.getItem('frak-client-id');

        if (!interactionToken && !clientId) return;

        var headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };
        if (interactionToken) headers['x-wallet-sdk-auth'] = interactionToken;
        if (clientId) headers['x-frak-client-id'] = clientId;

        fetch('{$block->escapeJs($block->getBackendUrl())}/user/track/purchase', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({$orderData}),
            keepalive: true
        }).catch(function() {});
    })();
    JS,
    false
) ?>
```

**The PurchaseTracker block** reads the last order from `CheckoutSession::getLastRealOrder()` and builds the JSON payload with `orderId`, `customerId`, `token` (= protectCode), and `merchantId`.

`protectCode` availability note: `CheckoutSession::getLastRealOrder()->getProtectCode()` is available server-side on the order object retrieved from checkout session and is rendered directly into the JS payload.

---

### 4.5 Ad-Blocker Resistant Identity (frak-client-id)

**Goal:** Even when ad-blockers prevent JS tracking, link purchases to Frak identity via server-side webhook payload.

**How it works in Shopify:**
1. `listener.liquid` syncs `frak-client-id` from localStorage to Shopify cart attributes via `POST /cart/update.js`
2. Cart attributes flow to order `note_attributes`
3. Shopify webhook includes `note_attributes` → backend extracts `_frak-client-id`

**Magento equivalent:**

**Step 1 — Client-side:** Inject JS that reads `frak-client-id` from localStorage and sets a cookie (note: cookie name uses underscores for PHP compatibility, localStorage key uses hyphens as set by the SDK):
```javascript
// In sdk_loader.phtml, after FrakSetup config
(function() {
    var clientId = localStorage.getItem('frak-client-id');
    if (clientId) {
        document.cookie = 'frak_client_id=' + encodeURIComponent(clientId)
            + ';path=/;max-age=86400;SameSite=Lax';
    }
    window.addEventListener('frakClientReady', function() {
        var id = window.FrakSetup?.core?.getClientId?.()
            ?? localStorage.getItem('frak-client-id');
        if (id) {
            document.cookie = 'frak_client_id=' + encodeURIComponent(id)
                + ';path=/;max-age=86400;SameSite=Lax';
        }
    }, { once: true });
})();
```

**Step 2 — Server-side:** Capture the cookie in `OrderPlaceAfterObserver` (HTTP checkout context) and pass it to `WebhookSender` as a method parameter. The retry queue persists this payload, including `clientId`, so retries do not depend on cookie access:

```php
<?php
declare(strict_types=1);

namespace FrakLabs\Sdk\Observer;

use Magento\Framework\Stdlib\Cookie\CookieReaderInterface;

class OrderPlaceAfterObserver
{
    public function __construct(
        private readonly WebhookSender $webhookSender,
        private readonly CookieReaderInterface $cookieReader
    ) {}

    private function processOrder(OrderInterface $order): void
    {
        $clientId = $this->cookieReader->getCookie('frak_client_id');
        $this->webhookSender->sendOrderWebhook($order, 'pending', $clientId);
    }
}
```

**Step 3 — Non-checkout lifecycle events:** `sales_order_invoice_pay` and `sales_order_creditmemo_save_after` may run from admin actions or cron/MQ contexts where browser cookies are unavailable. This is expected. Those webhooks send status updates (`confirmed`/`refunded`) without `clientId`; identity linkage is established by the initial `pending` webhook.

> Cookie survival caveat: the `frak_client_id` cookie uses `SameSite=Lax` and `path=/`, which survives standard same-origin checkout flows and PayPal-style redirects that return to the same domain. However, it may **not** survive: (1) subdomain changes mid-checkout, (2) EU cookie consent rejection, (3) private browsing restrictions. Server-side `clientId` forwarding is therefore best-effort and intentionally limited to the initial `pending` call.

---

### 4.6 Admin Configuration

**Goal:** Provide a simple admin config page at `Stores > Configuration > Frak`.

`etc/adminhtml/system.xml`:
```xml
<config xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:noNamespaceSchemaLocation="urn:magento:module:Magento_Config:etc/system_file.xsd">
    <system>
        <tab id="fraklabs" translate="label" sortOrder="500">
            <label>Frak</label>
        </tab>
        <section id="fraklabs_sdk" translate="label" sortOrder="10"
                 showInDefault="1" showInWebsite="1" showInStore="1">
            <label>Frak SDK</label>
            <tab>fraklabs</tab>
            <resource>FrakLabs_Sdk::config</resource>

            <group id="general" translate="label" sortOrder="10"
                   showInDefault="1" showInWebsite="1" showInStore="1">
                <label>General</label>
                <field id="enabled" translate="label" type="select" sortOrder="10"
                       showInDefault="1" showInWebsite="1" showInStore="1">
                    <label>Enable Frak SDK</label>
                    <source_model>Magento\Config\Model\Config\Source\Yesno</source_model>
                </field>
                <field id="merchant_id" translate="label comment" type="text" sortOrder="20"
                       showInDefault="1" showInWebsite="1" showInStore="1">
                    <label>Merchant ID</label>
                    <comment>UUID from Frak business dashboard</comment>
                    <validate>required-entry</validate>
                </field>
                <field id="webhook_secret" translate="label comment" type="obscure" sortOrder="30"
                       showInDefault="1" showInWebsite="1" showInStore="0">
                    <label>Webhook Secret</label>
                    <comment>HMAC signing key from Frak webhook settings (website scope so all store views in the same website share one secret)</comment>
                    <backend_model>Magento\Config\Model\Config\Backend\Encrypted</backend_model>
                </field>
            </group>

            <group id="urls" translate="label" sortOrder="20"
                   showInDefault="1" showInWebsite="1" showInStore="1">
                <label>URLs</label>
                <field id="wallet_url" translate="label" type="text" sortOrder="10"
                       showInDefault="1" showInWebsite="1" showInStore="1">
                    <label>Wallet URL</label>
                    <comment>Default: https://wallet.frak.id</comment>
                </field>
                <field id="components_url" translate="label" type="text" sortOrder="20"
                       showInDefault="1" showInWebsite="1" showInStore="1">
                    <label>Components CDN URL</label>
                    <comment>Default: https://cdn.jsdelivr.net/npm/@frak-labs/components@latest</comment>
                </field>
                <field id="backend_url" translate="label" type="text" sortOrder="30"
                       showInDefault="1" showInWebsite="1" showInStore="1">
                    <label>Backend URL</label>
                    <comment>Default: https://backend.frak.id</comment>
                </field>
            </group>

            <group id="appearance" translate="label" sortOrder="30"
                   showInDefault="1" showInWebsite="1" showInStore="1">
                <label>Appearance</label>
                <field id="language" translate="label" type="select" sortOrder="10"
                       showInDefault="1" showInWebsite="1" showInStore="1">
                    <label>Language</label>
                    <source_model>FrakLabs\Sdk\Model\Config\Source\Language</source_model>
                </field>
                <field id="logo_url" translate="label" type="text" sortOrder="20"
                       showInDefault="1" showInWebsite="1" showInStore="1">
                    <label>Logo URL</label>
                    <comment>Custom logo for Frak SDK modals</comment>
                </field>
                <field id="share_button_enabled" translate="label" type="select" sortOrder="30"
                       showInDefault="1" showInWebsite="1" showInStore="1">
                    <label>Show Share Button on Product Pages</label>
                    <source_model>Magento\Config\Model\Config\Source\Yesno</source_model>
                </field>
                <field id="wallet_button_position" translate="label" type="select" sortOrder="40"
                       showInDefault="1" showInWebsite="1" showInStore="1">
                    <label>Wallet Button Position</label>
                    <source_model>FrakLabs\Sdk\Model\Config\Source\ButtonPosition</source_model>
                </field>
            </group>
        </section>
    </system>
</config>
```

Most settings are store-view scoped. `webhook_secret` is website-scoped so all store views under one website share the same signing secret.

---

### 4.7 CSP Whitelist

`etc/csp_whitelist.xml`:
```xml
<?xml version="1.0"?>
<csp_whitelist xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xsi:noNamespaceSchemaLocation="urn:magento:module:Magento_Csp:etc/csp_whitelist.xsd">
    <policies>
        <!-- Load SDK from jsDelivr CDN -->
        <policy id="script-src">
            <values>
                <value id="fraklabs-jsdelivr" type="host">https://cdn.jsdelivr.net</value>
            </values>
        </policy>
        <!-- Also add to script-src-elem (some modules define this separately,
             browsers take the most restrictive directive) -->
        <policy id="script-src-elem">
            <values>
                <value id="fraklabs-jsdelivr-elem" type="host">https://cdn.jsdelivr.net</value>
            </values>
        </policy>

        <!-- Embed Frak wallet listener iframe -->
        <policy id="frame-src">
            <values>
                <value id="fraklabs-wallet" type="host">https://wallet.frak.id</value>
                <value id="fraklabs-wallet-dev" type="host">https://wallet-dev.frak.id</value>
            </values>
        </policy>

        <!-- SDK API calls to Frak backend -->
        <policy id="connect-src">
            <values>
                <value id="fraklabs-backend" type="host">https://backend.frak.id</value>
                <value id="fraklabs-backend-dev" type="host">https://backend.gcp-dev.frak.id</value>
                <value id="fraklabs-openpanel" type="host">https://op-api.gcp.frak.id</value>
            </values>
        </policy>

        <!-- SDK fonts/images -->
        <policy id="font-src">
            <values>
                <value id="fraklabs-fonts-googleapis" type="host">https://fonts.googleapis.com</value>
                <value id="fraklabs-fonts-gstatic" type="host">https://fonts.gstatic.com</value>
            </values>
        </policy>
        <policy id="style-src">
            <values>
                <value id="fraklabs-fonts-googleapis-style" type="host">https://fonts.googleapis.com</value>
                <!-- Components loader may inject CSS from jsDelivr -->
                <value id="fraklabs-jsdelivr-style" type="host">https://cdn.jsdelivr.net</value>
            </values>
        </policy>
        <policy id="style-src-elem">
            <values>
                <value id="fraklabs-jsdelivr-style-elem" type="host">https://cdn.jsdelivr.net</value>
                <value id="fraklabs-fonts-googleapis-style-elem" type="host">https://fonts.googleapis.com</value>
            </values>
        </policy>
    </policies>
</csp_whitelist>
```

**Sansec Watch compatibility:** Confirmed additive (merges cleanly via `CompositePolicyCollector`). No conflict.

**Fastly compatibility:** CSP host entries are static — they get baked into the cached CSP header. No nonce issues.

> ⚠️ **CSP limitation:** If merchants override default URLs (`wallet_url`, `components_url`, `backend_url`) with non-standard domains, those domains are **not** automatically whitelisted by this module's `csp_whitelist.xml`. Merchants must add those custom domains to CSP manually. Standard Frak URLs are fully covered by the shipped whitelist.

---

## 5. Backend Integration Contract

### Backend Changes Required

The following changes are needed in `services/backend/`:

1. **New `MagentoWebhookDto`** at `src/domain/purchases/dto/MagentoWebhook.ts`:
   ```typescript
   export type MagentoWebhookDto = Readonly<{
       id: string;              // Magento order increment_id
       customerId: string;      // Customer ID or email
       status: "pending" | "confirmed" | "cancelled" | "refunded";
       token: string;           // protectCode (for purchase claim reconciliation)
       currency?: string;
       totalPrice?: string;
       clientId?: string;       // frak_client_id from cookie (ad-blocker resistant)
       items?: {
           productId: string;
           quantity: number;
           price: string;
           name: string;
           title: string;
           image?: string;
       }[];
   }>;
   ```

2. **New `magentoWebhook.ts`** route at `src/api/external/merchant/webhook/magentoWebhook.ts` — same pattern as `wooCommerceWebhook.ts` but uses `MagentoWebhookDto` and passes `clientId` to `upsertPurchase`.

3. **Add `"magento"` to `WebhookPlatformSchema`** in `src/domain/purchases/schemas/index.ts`:
   ```typescript
   export const WebhookPlatformSchema = t.Union([
       t.Literal("shopify"),
       t.Literal("woocommerce"),
       t.Literal("magento"),    // ← new
       t.Literal("custom"),
       t.Literal("internal"),
   ]);
   ```

4. **Register in webhook index** at `src/api/external/merchant/webhook/index.ts`.

5. **Business dashboard platform selector update** in `apps/business/`: include `"magento"` as a supported webhook platform option alongside Shopify/WooCommerce/custom in the webhook creation UI schema/options.

### Endpoint: `POST /ext/merchant/:merchantId/webhook/magento`

**Request:**
```
POST https://backend.frak.id/ext/merchant/{merchantId}/webhook/magento
Content-Type: application/json
x-hmac-sha256: {base64(HMAC-SHA256(body, webhookSecret))}
```

**Body (MagentoWebhookDto):**
```json
{
    "id": "100000123",
    "customerId": "customer@email.com",
    "status": "pending",
    "token": "a8f3k2m9",
    "currency": "EUR",
    "totalPrice": "99.99",
    "clientId": "uuid-from-frak-sdk",
    "items": [
        {
            "productId": "789",
            "quantity": 2,
            "price": "49.99",
            "name": "awesome-product",
            "title": "Awesome Product"
        }
    ]
}
```

**HMAC Signature:**
```php
$signature = base64_encode(hash_hmac('sha256', $bodyString, $webhookSecret, true));
```

**Response:** `"ok"` on success, `"ko: {message}"` on error (always HTTP 200).

### Endpoint: `POST /user/track/purchase` (client-side)

Called from the checkout success page JS.

**Headers:** `x-wallet-sdk-auth` and/or `x-frak-client-id`

**Body:**
```json
{
    "customerId": "customer@email.com",
    "orderId": "100000123",
    "token": "a8f3k2m9",
    "merchantId": "uuid"
}
```

**Token matching:** Both the webhook and the client-side tracker must use the same `token` value (`$order->getProtectCode()`). This is how the backend reconciles the server-side webhook with the client-side purchase claim.

### Webhook Platform Registration

Before the module can send webhooks, the merchant must register a webhook via the Frak business dashboard:
1. Go to `business.frak.id` → merchant settings → webhooks
2. Create webhook with platform: `magento`
3. Copy the `hookSignatureKey` (webhook secret)
4. Paste into Magento admin: `Stores > Configuration > Frak > Webhook Secret`

---

## 6. Shopify vs Magento Feature Map

| Feature | Shopify Implementation | Magento Implementation | Diff |
|---|---|---|---|
| SDK injection | `listener.liquid` theme block (manual add) | `default.xml` layout (auto on install) | Easier |
| Config source | Shop metafields via GraphQL | `system.xml` admin config | Simpler |
| Web Components | Liquid blocks (manual add to theme) | Layout XML blocks (auto on install) | Easier |
| Post-purchase (primary) | Checkout pixel (JS, client-side only) | Observer (PHP, server-side) | More reliable |
| Post-purchase (identity) | Checkout pixel sends identity headers | Success page JS sends identity headers | Same |
| Ad-blocker path | Cart attributes → note_attributes | Cookie captured in `checkout_submit_all_after` observer and persisted in retry payload | Same concept |
| Backend endpoint | `/webhook/shopify` (dedicated) | `/webhook/magento` (dedicated) | New backend route |
| Status lifecycle | `ORDERS_CREATE` + `ORDERS_UPDATED` | `checkout_submit_all_after` + `sales_order_invoice_pay` + `sales_order_creditmemo_save_after` | Equivalent lifecycle coverage |
| Dashboard | Full embedded React app (Polaris) | Not needed (use business.frak.id) | Way less work |
| Merchant config | Metafields + embedded app | `system.xml` native Magento admin | Simpler |
| OAuth/session | Custom Shopify OAuth + Drizzle DB | Native Magento admin session | None needed |
| Database | 2 tables (session, purchase) | None (all data goes to Frak backend) | Simpler |
| Billing | In-app purchases via Shopify | Via Frak business dashboard | None needed |
| Theme detection | GraphQL theme inspection | Not needed (layout XML is automatic) | Not needed |
| Onboarding wizard | 6-step validation flow | Not needed (just admin config) | Not needed |
| CSP | Shopify manages | `csp_whitelist.xml` | Standard |
| Caching | Shopify CDN | Fastly FPC | Compatible |
| **Total files** | **~100+ files** | **~25 files** | **75% less** |

---

## 7. Potential Roadblocks & Mitigations

### Critical Risk: Theme Override Kills SDK Injection

**Problem:** Custom Luma-child theme could override `Magento_Theme/layout/default.xml` and inadvertently remove `head.additional`.

**Mitigation:** We use `after.body.start` (page layout skeleton tier) instead. This container is defined in `page_layout/empty.xml` and cannot be removed by theme layout overrides. Magento's own RequireJS config lives here — if a theme removed it, the entire store would break.

**Detection:** The module should log a warning if its blocks don't render. Add a verification endpoint or CLI command that checks if the SDK loaded successfully.

### Critical Risk: Inline Script CSP Blocking

**Problem:** Magento 2.4.7+ enforces restrict-mode CSP on checkout pages. Raw `<script>` tags are blocked.

**Mitigation:** All inline scripts use `$secureRenderer->renderTag()` which auto-hashes content and adds to CSP header. Never use raw `<script>` tags in `.phtml` templates.

**Gotcha:** Nonces get cached by FPC+Fastly (known bug #38615). The `$secureRenderer` uses hashes on cacheable pages and nonces only on uncacheable pages — this is the correct behavior and handles the caching issue.

### Medium Risk: ES Module Loading

**Problem:** Frak's `@frak-labs/components` is loaded as `type="module"` in Shopify. Magento's layout XML `<script>` tag doesn't support `type="module"`. RequireJS may conflict.

**Mitigation:** Load via `.phtml` template using `$secureRenderer->renderTag('script', ['type' => 'module', 'src' => $url])`. The SDK is completely isolated (no Magento AMD dependencies). Use `defer` attribute. Test thoroughly with RequireJS to ensure no interference.

### Medium Risk: frak-client-id Cookie vs Magento Cookie Consent

**Problem:** The `frak_client_id` cookie we set for ad-blocker-resistant tracking may be blocked by cookie consent mechanisms (EU cookie law, Magento's built-in cookie restriction mode).

**Mitigation:** Classify the cookie as "functional" (not analytics/marketing) since it enables core purchase tracking. Document this classification for merchants. If blocked, the server-side webhook still works — just without the identity linking fallback.

### Medium Risk: `clientId` Availability in Async Status Updates

**Problem:** `sales_order_invoice_pay` and `sales_order_creditmemo_save_after` may execute outside the browser request lifecycle (admin actions, cron, MQ), so browser cookies are unavailable there.

**Mitigation:** Capture `frak_client_id` only during `checkout_submit_all_after` (HTTP context), include it in the initial `pending` webhook payload, and persist that payload in retry storage. Status update webhooks intentionally omit `clientId` and reconcile by order ID + token.

### Low Risk: GuzzleHttp Timeout Blocking Checkout

**Problem:** If the Frak backend is slow/down, the HTTP call in the observer could delay checkout completion.

**Mitigation:** 
- Connect timeout: 3s, request timeout: 5s
- All errors caught in observer try/catch — never propagate
- Consider async approach for high-traffic stores: Magento MessageQueue (RabbitMQ) to decouple webhook from request. Start synchronous, move to async if needed.

### Low Risk: Fastly Cache Invalidation

**Problem:** When merchant changes SDK config in admin, cached pages still serve the old config.

**Mitigation:** Magento's standard cache invalidation flow handles this — config changes invalidate FPC cache tags, and the Magento-Fastly integration purges corresponding pages automatically.

---

## 8. Testing Strategy

### Unit Tests (standalone, no Magento install)

**Tools:** PHPUnit 10+, `magento/framework` as dev dependency

**What to test:**
- `Config.php` — Config value reading, default fallbacks, enabled/disabled toggle
- `WebhookSender.php` — Payload building, HMAC signature generation, status mapping
- `OrderPlaceAfterObserver.php` — Calls webhook sender when enabled, skips when disabled, catches exceptions
- `SdkLoader.php` — Config JSON generation, URL escaping, enabled guard
- `PurchaseTracker.php` — Order data extraction from checkout session

**Mocking strategy:**
- Mock `ScopeConfigInterface` for all config reads
- Mock `GuzzleHttp\ClientFactory` for HTTP calls (never hit real API in tests)
- Mock `CheckoutSession` for order data in PurchaseTracker
- Mock `Observer`/`Event` objects for observer tests

```bash
# Run locally
composer install
composer run test
```

### Static Analysis

**PHPStan** (level 5, with `bitexpert/phpstan-magento` for generated class autoloading):
```bash
composer run analyse
```

**PHPCS** (Magento2 coding standard):
```bash
composer run cs        # check
composer run cs-fix    # auto-fix
```

### Integration Testing (CI-only, requires full Magento)

**When:** On `main` branch merges only (expensive — requires MySQL + Elasticsearch + full Magento install).

**What to test:**
- Module installs cleanly (`setup:module:enable`, `setup:di:compile`)
- Layout XML renders expected blocks (smoke test)
- CSP whitelist XML validates against Magento XSD
- Admin config saves and retrieves correctly

**Framework:** Use `graycoreio/github-actions-magento2` v6.0.0 for CI setup with Mage-OS mirror (no Adobe credentials needed).

### Manual QA Checklist

- [ ] SDK loader renders on all page types (home, category, product, CMS)
- [ ] `window.FrakSetup` config matches admin settings
- [ ] `window.FrakSetup` includes walletUrl, metadata (name/lang/logoUrl/merchantId), customizations, domain, modalConfig, modalShareConfig, modalWalletConfig
- [ ] Share button renders on product pages (when enabled)
- [ ] Wallet button renders in configured position
- [ ] Frak iframe loads (check Network tab for `/listener` request)
- [ ] Frak modals open when buttons are clicked
- [ ] Place test order → verify webhook arrives at Frak backend
- [ ] Check success page → verify `/user/track/purchase` POST in Network tab
- [ ] Disable module → verify no SDK injection, no webhooks
- [ ] Test with ad-blocker enabled → verify `frak-client-id` cookie path works
- [ ] Test CSP: no violations in browser console (Developer Tools > Console > Errors)
- [ ] Test with Fastly: clear cache, verify SDK loads on cached page
- [ ] Test on mobile: buttons render, modals work

---

## 9. CI Pipeline

### Path-Filtered GitHub Actions

Only run PHP CI when `plugins/magento/**` changes. Separate from the TS pipeline.

```yaml
# .github/workflows/ci-magento.yml
name: CI - Magento Module

on:
  push:
    branches: [main, dev]
    paths: ['plugins/magento/**']
  pull_request:
    paths: ['plugins/magento/**']

defaults:
  run:
    working-directory: plugins/magento

jobs:
  coding-standard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: shivammathur/setup-php@v2
        with: { php-version: '8.3', tools: 'composer:v2', coverage: none }
      - run: composer install --no-interaction --prefer-dist
      - run: composer run cs

  phpstan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: shivammathur/setup-php@v2
        with: { php-version: '8.3', tools: 'composer:v2', coverage: none }
      - run: composer install --no-interaction --prefer-dist
      - run: composer run analyse

  unit-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        php: ['8.3', '8.4']
    steps:
      - uses: actions/checkout@v4
      - uses: shivammathur/setup-php@v2
        with: { php-version: '${{ matrix.php }}', tools: 'composer:v2' }
      - run: composer install --no-interaction --prefer-dist
      - run: composer run test

  integration-tests:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    services:
      mysql:
        image: mysql:8.0
        env: { MYSQL_ROOT_PASSWORD: root, MYSQL_DATABASE: magento_tests }
        ports: ['3306:3306']
    steps:
      - uses: actions/checkout@v4
      - uses: graycoreio/github-actions-magento2/setup-magento@main
        id: magento
        with: { php-version: '8.3', mode: extension, magento_version: '2.4.8' }
      # ... (see full workflow in Testing section)
```

---

## 10. Publishing & Distribution

### Primary: Packagist (public)

```json
{
    "name": "frak-labs/magento2-module",
    "type": "magento2-module",
    "description": "Frak SDK integration for Adobe Commerce / Magento 2",
    "license": "GPL-3.0-only",
    "require": {
        "php": "~8.3.0 || ~8.4.0",
        "magento/framework": "^103.0",
        "magento/module-store": "^101.0",
        "magento/module-checkout": "^100.4",
        "magento/module-sales": "^103.0",
        "magento/module-config": "^101.2",
        "magento/module-csp": "^100.4",
        "guzzlehttp/guzzle": "^7.0"
    },
    "require-dev": {
        "phpunit/phpunit": "^10 || ^11",
        "phpstan/phpstan": "^2.0",
        "bitexpert/phpstan-magento": "*",
        "phpstan/extension-installer": "^1.3",
        "magento/magento-coding-standard": "^40"
    }
}
```

**Installation for merchants:**
```bash
composer require frak-labs/magento2-module
bin/magento module:enable FrakLabs_Sdk
bin/magento setup:upgrade
bin/magento cache:clean
```

### Alternative: Direct GitHub VCS (for this client specifically)

If we don't want to publish to Packagist yet, the client's integrator can use the GitHub repo directly:

```json
{
    "repositories": [
        {
            "type": "path",
            "url": "../../plugins/magento"
        }
    ],
    "require": {
        "frak-labs/magento2-module": "@dev"
    }
}
```

Or via Git VCS:
```json
{
    "repositories": [
        {
            "type": "vcs",
            "url": "https://github.com/frak-id/wallet"
        }
    ]
}
```

### Release Process

1. Tag the release in git: `git tag -a magento/v1.0.0 -m "Initial release"`
2. Packagist auto-syncs via webhook
3. Merchants update: `composer update frak-labs/magento2-module`

**Versioning:** SemVer. Independent from SDK/npm versions. Use `magento/` tag prefix to distinguish from other releases in the monorepo.

---

## 11. Monorepo Config Changes

The following root-level configs need `plugins/` exclusions to prevent TS tooling from processing PHP files:

| File | Section | Change |
|---|---|---|
| `biome.json` | `files.includes` | Add `!plugins/**` |
| `tsconfig.json` | `exclude` | Add `"plugins/**"` |
| `knip.ts` | `ignore` | Add `"plugins/**"` |
| `package.json` | `workspaces.packages` | Add `"!plugins/*"` (or leave as-is if not matching) |

**Files that need no changes:**
- `vitest.config.ts` — project globs don't match `plugins/`
- `bunfig.toml` — only configures install behavior
- `sst.config.ts` — only watches `infra/`

---

## 12. Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Create module skeleton (`registration.php`, `composer.json`, `module.xml`)
- [ ] Set up admin config (`system.xml`, `config.xml`, `acl.xml`, `Config.php`)
- [ ] Add CSP whitelist (`csp_whitelist.xml`)
- [ ] Update monorepo configs (biome, tsconfig, knip exclusions)
- [ ] Set up PHPUnit, PHPStan, PHPCS tooling
- [ ] Write first unit tests for `Config.php`

### Phase 2: SDK Injection (Week 1)
- [ ] Create `SdkLoader` block with `isEnabled()` guard
- [ ] Create `sdk_loader.phtml` template with `$secureRenderer`
- [ ] Add `default.xml` layout (using `after.body.start`)
- [ ] Build `window.FrakSetup` JSON from admin config
- [ ] Unit test SdkLoader block

### Phase 3: Web Components (Week 1)
- [ ] Create `ShareButton`, `WalletButton`, and `OpenInApp` blocks
- [ ] Create templates with web component tags (`share_button.phtml`, `wallet_button.phtml`, `open_in_app.phtml`)
- [ ] Add `catalog_product_view.xml` layout for share button
- [ ] Add wallet and open-in-app blocks to `default.xml`
- [ ] Handle enabled/disabled per component
- [ ] Document category-page share integration as Phase 2 follow-up (`catalog_category_view.xml`)

### Phase 4: Webhooks (Week 2)
- [ ] Create `WebhookSender` model with HMAC signing
- [ ] Create `OrderPlaceAfterObserver` (checkout_submit_all_after → pending)
- [ ] Create `OrderStatusUpdateObserver` (invoice_pay → confirmed, creditmemo → refunded)
- [ ] Register all 3 events in `events.xml`
- [ ] Build `MagentoWebhookDto`-compatible payload with `clientId` captured in OrderPlaceAfterObserver and status passed explicitly
- [ ] Unit test HMAC generation, payload building, observer flow, status mapping
- [ ] **Backend:** Create `MagentoWebhookDto`, `/webhook/magento` endpoint, add `"magento"` to platform enum
- [ ] **Business app:** Add `"magento"` option in webhook platform selector

### Phase 5: Client-Side Purchase Tracking (Week 2)
- [ ] Create `PurchaseTracker` block reading from `CheckoutSession`
- [ ] Create `purchase_tracker.phtml` with fetch() call
- [ ] Add `checkout_onepage_success.xml` layout
- [ ] Ensure canonical `token` (`protectCode`) matches between webhook and client tracker

### Phase 6: Retry Queue & Ad-Blocker Identity (Week 2)
- [ ] Define `WebhookRetryInterface` with `MessageQueueRetry` and `CronRetry` implementations
- [ ] Create `fraklabs_webhook_queue` DB table via `db_schema.xml`
- [ ] Implement `CronRetry` with exponential backoff cron job
- [ ] Implement `MessageQueueRetry` using `Magento\Framework\MessageQueue\PublisherInterface`
- [ ] Implement `WebhookRetryFactory` (runtime AMQP detection via DeploymentConfig) and wire through DI
- [ ] Add `frak_client_id` cookie sync to `sdk_loader.phtml`
- [ ] Wire cookie capture in `OrderPlaceAfterObserver` and persist payload for retry
- [ ] Test the cookie → webhook → backend flow

### Phase 7: QA & Polish (Week 2)
- [ ] Manual QA on a Magento 2.4.8 test instance with Luma-child theme
- [ ] Test with Fastly CDN enabled
- [ ] Test CSP compliance (no browser console violations)
- [ ] Test with ad-blocker (uBlock Origin)
- [ ] Set up CI pipeline (GitHub Actions)
- [ ] Write integration tests

### Phase 8: First Client Deployment
- [ ] Publish to Packagist (or provide VCS repo to client integrator)
- [ ] Provide installation documentation
- [ ] Client integrator installs via Composer
- [ ] Configure admin settings (merchant ID, webhook secret)
- [ ] Verify end-to-end: SDK loads → user clicks share → places order → webhook fires → Frak backend processes

---

## 13. Open Questions — All Resolved

### Q1: Backend endpoint for Magento ✅ RESOLVED

**Decision:** **(b) Create a dedicated `/webhook/magento` endpoint** with an extended DTO that includes `clientId`.

This gives us a Magento-specific DTO with the `clientId` field for ad-blocker-resistant identity linking, clean separation from the generic custom webhook, and room for Magento-specific logic later. Backend changes required:
- New `MagentoWebhookDto` in `services/backend/src/domain/purchases/dto/MagentoWebhook.ts`
- New `magentoWebhook.ts` route in `services/backend/src/api/external/merchant/webhook/`
- Register in webhook index.ts alongside Shopify/WooCommerce/Custom

### Q2: Add `"magento"` to WebhookPlatformSchema ✅ RESOLVED

**Decision:** Yes. Add `t.Literal("magento")` to the enum in `services/backend/src/domain/purchases/schemas/index.ts`. Merchants register webhooks with `platform: "magento"` via the business dashboard.

### Q3: Purchase token ✅ RESOLVED

**Decision:** Use `$order->getProtectCode()` as canonical token. Fallback implementation is documented once in §4.3 payload code.

### Q4: Multiple webhook calls per order lifecycle ✅ RESOLVED

**Decision:** **(b) Full lifecycle from day one.** Observe all three key events:

| Event | Fires When | Status Sent |
|---|---|---|
| `checkout_submit_all_after` | Order placed | `"pending"` |
| `sales_order_invoice_pay` | Invoice paid (payment captured) | `"confirmed"` |
| `sales_order_creditmemo_save_after` | Credit memo created (refund) | `"refunded"` |

The backend already handles `upsertPurchase` (insert-or-update by externalId), so subsequent calls update the purchase status. This matches Shopify's `ORDERS_UPDATED` behavior and enables accurate reward calculation from day one.

Additional event registrations in `etc/events.xml`:
```xml
<event name="sales_order_invoice_pay">
    <observer name="fraklabs_sdk_order_invoice_pay"
              instance="FrakLabs\Sdk\Observer\OrderStatusUpdateObserver"/>
</event>
<event name="sales_order_creditmemo_save_after">
    <observer name="fraklabs_sdk_order_creditmemo"
              instance="FrakLabs\Sdk\Observer\OrderStatusUpdateObserver"/>
</event>
```

A single `OrderStatusUpdateObserver` handles both events, mapping the event type to the correct status.

### Q5: ES Module loading ✅ RESOLVED

**Decision:** ES module only (`type="module"`), no IIFE fallback or admin toggle. Target browsers (Chrome 100+, Safari 14+, Firefox 91+) all support ES modules. No RequireJS conflict since ES modules run in isolated scope. Keep it simple.

### Q6: Composer publishing ✅ RESOLVED

**Decision:** **(c) `danharrin/monorepo-split` GitHub Action.** Same pattern as Laravel's illuminate/* packages.

CI workflow on push to `main`/`dev`:
```yaml
- uses: danharrin/monorepo-split@v2
  with:
    package_directory: 'plugins/magento'
    repository_organization: 'frak-labs'
    repository_name: 'magento2-module'
```

The read-only `frak-labs/magento2-module` repo is what Packagist watches. Development happens in the monorepo.

### Q7: Webhook retry mechanism ✅ RESOLVED

**Decision:** Configurable — runtime detect AMQP config and use Magento MessageQueue when available, otherwise fall back to cron + DB table.

The client runs Adobe Commerce Enterprise with thousands of orders/day and likely has RabbitMQ configured. The module should leverage it when available.

**Implementation:**
1. Define a `WebhookRetryInterface` with two implementations:
   - `MessageQueueRetry` — uses `Magento\Framework\MessageQueue\PublisherInterface` (async, scales well)
   - `CronRetry` — uses `fraklabs_webhook_queue` DB table + cron job (fallback)
2. Add `WebhookRetryFactory` that reads `DeploymentConfig::get('queue/amqp')` at runtime and returns the correct implementation
3. The observer pushes failed webhooks to whichever implementation is active
4. Both implementations use exponential backoff (5m → 15m → 1h → 6h → 24h) and cap at 5 retries

```php
<?php
declare(strict_types=1);

namespace FrakLabs\Sdk\Model;

use FrakLabs\Sdk\Api\WebhookRetryInterface;
use FrakLabs\Sdk\Model\Retry\CronRetry;
use FrakLabs\Sdk\Model\Retry\MessageQueueRetry;
use Magento\Framework\App\DeploymentConfig;

class WebhookRetryFactory
{
    public function __construct(
        private readonly DeploymentConfig $deploymentConfig,
        private readonly MessageQueueRetry $mqRetry,
        private readonly CronRetry $cronRetry
    ) {}

    public function create(): WebhookRetryInterface
    {
        $amqpConfig = $this->deploymentConfig->get('queue/amqp');
        if (!empty($amqpConfig)) {
            return $this->mqRetry;
        }
        return $this->cronRetry;
    }
}
```

```xml
<!-- etc/di.xml — bind concrete retry implementations; selection is runtime via WebhookRetryFactory -->
<type name="FrakLabs\Sdk\Model\WebhookRetryFactory">
    <arguments>
        <argument name="mqRetry" xsi:type="object">FrakLabs\Sdk\Model\Retry\MessageQueueRetry</argument>
        <argument name="cronRetry" xsi:type="object">FrakLabs\Sdk\Model\Retry\CronRetry</argument>
    </arguments>
</type>
```

This adds ~1.5 days of effort but provides production-grade reliability for a high-volume client.

---

## 14. Oracle Review — Corrections & Additions

The following issues were identified during Oracle review of the plan. All critical items have been incorporated inline into the relevant sections above.

### Corrections Applied

| # | Issue | Section Updated | Fix |
|---|---|---|---|
| 1 | **Webhook response detection** — Backend always returns HTTP 200, success is body `"ok"`, failure is `"ko: ..."`. Status code alone is insufficient. | §4.3 WebhookSender | Check response body for `"ko:"` prefix, not status code |
| 2 | **Store-scoped config in observer** — Global observer doesn't auto-scope config to the order's store view. Must resolve using `$order->getStoreId()`. | §4.3 Observer | Pass `storeId` to all `Config` method calls |
| 3 | **Multi-order events** — `checkout_submit_all_after` can carry either `order` (single) or `orders` (multi-address checkout). Handle both. | §4.3 Observer | Check both `getOrder()` and `getOrders()`, iterate if array |
| 4 | **Script init order** — `window.FrakSetup` must be set BEFORE the SDK script loads. Race condition if reversed. | §4.1 Template | Config script first, SDK script (type=module, deferred) second |
| 5 | **Purchase token security** — Canonical token is `$order->getProtectCode()` (random string). | §4.3 Payload, §Q3 | Standardized on `protectCode` with one documented fallback in payload code |
| 6 | **clientId propagation reliability** — Cookie access in `WebhookSender` fails in cron/MQ retry contexts. | §4.3, §4.5 | Capture `frak_client_id` in checkout observer, pass/persist payload, omit for async status updates |
| 7 | **CSP: jsDelivr in style-src** — Components loader injects CSS from jsDelivr. Must whitelist in `style-src` and `style-src-elem` too. | §4.7 | Added jsDelivr to style-src and style-src-elem policies |
| 8 | **Cookie name consistency** — Plan mixed `frak-client-id` (hyphen) and `frak_client_id` (underscore). Standardized: localStorage key = `frak-client-id` (set by SDK), cookie name = `frak_client_id` (PHP convention). | §4.5 | Added clarifying comment in JS snippet |

### New Recommendation: Webhook Retry Queue

**Problem:** Synchronous observer with try/catch silently swallows webhook failures. No retry mechanism means lost purchase data.

**Solution:** Add retry abstraction with runtime backend selection (MQ when configured, cron fallback):

1. Create a small `fraklabs_webhook_queue` table:
   ```sql
   CREATE TABLE fraklabs_webhook_queue (
       id INT AUTO_INCREMENT PRIMARY KEY,
       order_id VARCHAR(32) NOT NULL,
       store_id INT NOT NULL,
       payload TEXT NOT NULL,
       attempts INT DEFAULT 0,
       last_attempt_at TIMESTAMP NULL,
       next_retry_at TIMESTAMP NOT NULL,
       status ENUM('pending', 'success', 'failed') DEFAULT 'pending',
       error_message TEXT NULL,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       INDEX (status, next_retry_at)
   );
   ```

2. On webhook failure in observer, enqueue payload (including optional `clientId` captured at checkout) via `WebhookRetryFactory->create()`
3. Cron job runs every 5 minutes, retries pending items with exponential backoff (5m, 15m, 1h, 6h, 24h)
4. After 5 failed attempts, mark as `failed` and log error for manual investigation
5. Admin grid (optional, Phase 2) to view/retry failed webhooks

**Effort:** ~1 extra day. Worth it for production reliability.

**Escalation trigger:** Start with factory-based MQ/cron abstraction from day one; tune queue backend per merchant infra and traffic profile.

### New Recommendation: Admin "Test Connection" Button

Add a button in admin config that sends a test webhook payload to the configured backend URL. This validates:
- Merchant ID is correct
- Webhook secret produces valid HMAC signature
- Backend URL is reachable
- Webhook is registered for this merchant

Saves debugging time during initial setup.

### Additional Security Note: Encrypted Config Decryption

The `webhook_secret` field uses `backend_model="Magento\Config\Model\Config\Backend\Encrypted"` which stores the value encrypted in the database. When reading via `ScopeConfigInterface::getValue()`, Magento **automatically decrypts** it. However, if using a custom config model or reading from the database directly, you must handle decryption explicitly via `Magento\Framework\Encryption\EncryptorInterface::decrypt()`. The `Config::getWebhookSecret()` method should verify it receives a decrypted value (non-empty, doesn't start with Magento's encryption prefix `0:3:`).
