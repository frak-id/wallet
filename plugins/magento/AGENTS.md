# plugins/magento — Compass

Magento 2 module: Frak SDK injection, order webhook sender, admin config. PHP 8.4 (`composer.json#config.platform`). PSR-4 `FrakLabs\Sdk\`. Installed as `frak-labs/magento2-module`.

## Quick Commands
```bash
composer install                          # Deps (from this dir)
./build.sh                                # Package module zip for release
vendor/bin/phpunit                        # Unit tests (phpunit.xml)
vendor/bin/phpstan analyse                # Static analysis (phpstan.neon)
vendor/bin/phpcs --standard=phpcs.xml.dist # Style (Magento2 PSR-12 variant)
```

## Key Files
- `registration.php` — Magento 2 module registration
- `etc/module.xml` — declaration · `etc/di.xml` — DI bindings · `etc/events.xml` — observer wiring
- `etc/config.xml` — defaults · `etc/adminhtml/system.xml` — admin store-config form
- `etc/acl.xml` — admin ACL · `etc/csp_whitelist.xml` — CSP origins
- `Observer/` — hooks into `checkout_submit_all_after`, `sales_order_invoice_pay`, `sales_order_creditmemo_save_after` (see `etc/events.xml`)
- `Model/WebhookSender.php` — HMAC-signed purchase/order webhooks to Frak backend
- `Model/Retry/` — retry strategy: cron + async message queue (failed webhooks are NOT dropped)
- `Block/` — admin + frontend blocks (phtml templates in `view/`)
- `view/frontend/templates/*.phtml` — Liquid-free, CSP-compliant script rendering
- `Api/` — public interfaces for DI contracts
- `Test/Unit/` — PHPUnit tests
- `i18n/` — translations

## Non-Obvious Patterns
- **CSP-compliant phtml**: inline scripts use `$block->escapeJs()` + nonce-based injection — never echo raw JS.
- **`Model/Retry/` is not runnable yet**: `CronRetry` inserts into `fraklabs_webhook_queue`, but the module ships no `etc/db_schema.xml`, no `etc/crontab.xml` and no queue topology, and `MessageQueueRetry::processRetries()` is empty. Treat a failed webhook as dropped until that is finished; the backend reconciles by `(order id, protectCode)`.
- **HMAC signing**: webhooks carry SHA-256 HMAC of body using configured shared secret — backend rejects unsigned.
- **Observers over plugins**: Frak intercepts the order lifecycle via observers (declarative in `etc/events.xml`); do not add `<plugin>` interceptors for it.
- **Admin config** surfaced via `system.xml` → `Model/Config` — never read `env/.ini` directly.
- **No Composer autoloader runtime install**: Magento compiles DI (`bin/magento setup:di:compile`) — changing constructors requires recompile.
- **phpstan level is strict** (see `phpstan.neon`) — no mixed types in new code.
- **`vendor/` is checked in per release zip** (not git) for merchant installability — build via `./build.sh`.

## Anti-Patterns
Raw JS in phtml (CSP violation) · fire-and-forget HTTP in webhooks (use `WebhookSender`) · `<plugin>` for order lifecycle (use observer) · reading admin config outside `Model/Config` · editing compiled `generated/` code.

## See Also
Parent `/AGENTS.md` · `services/backend/` (webhook receiver) · `plugins/wordpress/AGENTS.md` (sibling integration pattern).
