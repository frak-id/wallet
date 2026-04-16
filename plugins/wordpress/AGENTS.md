# plugins/wordpress — Compass

WordPress plugin: Frak SDK + WooCommerce order webhook sender + admin settings.

## Quick Commands
```bash
composer install                             # Deps (from this dir)
./build.sh                                   # Package plugin zip for release (dist/)
vendor/bin/phpunit                           # Unit tests
vendor/bin/phpstan analyse                   # Static analysis (uses phpstan-bootstrap.php for WP/WC stubs)
vendor/bin/phpcs --standard=phpcs.xml.dist   # Style
```

## Key Files
- `frak-integration.php` — plugin bootstrap (WP plugin header + hook registration)
- `includes/` — core classes (autoload via classmap in `composer.json`)
- `admin/` — settings pages, admin notices, meta boxes
- `phpstan-bootstrap.php` — stubs for WordPress + WooCommerce functions (so phpstan runs without WP loaded)
- `test/` — PHPUnit tests
- `README.txt` — WordPress.org readme format (sections: Description, Installation, Changelog)
- `dist/` — build output (packaged zip lives here)

## Non-Obvious Patterns
- **Classmap autoloading** (not PSR-4) for `includes/` and `admin/` — match class name to filename exactly or WP can't find it.
- **`phpstan-bootstrap.php` required**: WP/WC functions aren't available to static analysis without it — contributing without this triggers `UnknownFunction` errors.
- **WooCommerce is optional but expected**: guard with `class_exists('WooCommerce')` before hooking order lifecycle.
- **Webhook sender pattern mirrors Magento** (HMAC-signed, retry-aware) — kept intentionally parallel for backend simplicity.
- **Admin settings** go through WP Settings API — never write directly to `wp_options` outside sanitize callbacks.
- **`README.txt` is NOT markdown**: it's WP.org's shortcode-flavoured format; the `Stable tag:` header drives release picking.
- **`./build.sh` produces `dist/*.zip`** — that zip is the artifact uploaded to WordPress.org / self-hosted.

## Anti-Patterns
PSR-4 imports (use classmap) · raw `wp_options` writes · fire-and-forget webhook HTTP · Markdown in `README.txt` · depending on WooCommerce without `class_exists` guard · ignoring `phpstan-bootstrap.php`.

## See Also
Parent `/AGENTS.md` · `plugins/magento/AGENTS.md` (parallel integration) · `services/backend/` (webhook receiver).
