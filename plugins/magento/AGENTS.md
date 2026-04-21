# plugins/magento — Compass

Magento 2 module: Frak SDK injection, order webhook sender, admin config. PHP 8.3+. PSR-4 `FrakLabs\Sdk\`. Installed as `frak-labs/magento-sdk`.

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
- `etc/{webapi.xml, crontab.xml, queue*.xml}` — REST endpoints, cron, message queue
- `Observer/` — hooks into `sales_order_place_after`, `sales_order_save_after`
- `Model/WebhookSender.php` — HMAC-signed purchase/order webhooks to Frak backend
- `Model/Retry/` — retry strategy: cron + async message queue (failed webhooks are NOT dropped)
- `Block/` — admin + frontend blocks (phtml templates in `view/`)
- `view/frontend/templates/*.phtml` — Liquid-free, CSP-compliant script rendering
- `Api/` — public interfaces for DI contracts
- `Test/Unit/` — PHPUnit tests
- `i18n/` — translations

## Non-Obvious Patterns
- **CSP-compliant phtml**: inline scripts use `$block->escapeJs()` + nonce-based injection — never echo raw JS.
- **Webhook reliability = cron + MQ**: `Model/Retry/` schedules retries via Magento message queue; a single transient failure doesn't lose the event.
- **HMAC signing**: webhooks carry SHA-256 HMAC of body using configured shared secret — backend rejects unsigned.
- **Observers over plugins**: Frak intercepts `sales_order_place_after` via observer (declarative in `events.xml`); do not add `<plugin>` interceptors for order lifecycle.
- **Admin config** surfaced via `system.xml` → `Model/Config` — never read `env/.ini` directly.
- **No Composer autoloader runtime install**: Magento compiles DI (`bin/magento setup:di:compile`) — changing constructors requires recompile.
- **phpstan level is strict** (see `phpstan.neon`) — no mixed types in new code.
- **`vendor/` is checked in per release zip** (not git) for merchant installability — build via `./build.sh`.

## Anti-Patterns
Raw JS in phtml (CSP violation) · fire-and-forget HTTP in webhooks (use `WebhookSender` + retry) · `<plugin>` for order lifecycle (use observer) · reading admin config outside `Model/Config` · editing compiled `generated/` code.

## See Also
Parent `/AGENTS.md` · `services/backend/` (webhook receiver) · `plugins/wordpress/AGENTS.md` (sibling integration pattern).
