# plugins/wordpress — Compass

WordPress plugin: Frak SDK + WooCommerce order webhook sender + admin settings.

## Quick Commands
```bash
composer install                             # Deps (from this dir)
./build.sh                                   # Package plugin zip for release (dist/)
vendor/bin/phpstan analyse --memory-limit=1G # Static analysis (uses phpstan-bootstrap.php for WP/WC stubs; 128M default runs out)
vendor/bin/phpcs --standard=phpcs.xml.dist   # Style
```

## Key Files
- `frak-integration.php` — plugin bootstrap (WP plugin header + hook registration)
- `includes/` — core classes (autoload via classmap in `composer.json`)
- `admin/` — settings pages, admin notices, meta boxes
- `phpstan-bootstrap.php` — stubs for WordPress + WooCommerce functions (so phpstan runs without WP loaded)
- `test/docker-compose.yaml` — manual integration env (procedure below). There is no PHPUnit suite here; CI (`.github/workflows/php-plugins.yaml`) runs `cs` + `analyse` only.
- `README.txt` — WordPress.org readme format (sections: Description, Installation, Changelog)
- `dist/` — build output (packaged zip lives here)

## Local Test Site
WordPress on `http://localhost:8000`, with this directory mounted as `wp-content/plugins/frak-integration` (the database and WordPress live in `test/db_data` and `test/wordpress`, both gitignored). From `test/`:

```bash
# 0. The dev bundle must define the component (expect the beta version):
curl -s https://sdk-dev.frak.id/components.js
# 1. vendor/ is gitignored and the plugin registers nothing without its autoloader:
(cd .. && composer install)
# 2. Start, install, activate (WooCommerce only for the webhook checks):
docker compose up -d
docker compose run --rm cli wp core install --url=http://localhost:8000 --title="Frak WP" \
  --admin_user=admin --admin_password=admin --admin_email=admin@example.com --skip-email
docker compose run --rm cli wp plugin activate frak-integration
docker compose run --rm cli wp plugin install woocommerce --activate
# 3. Dev stack + a dev merchant that has an active campaign (localhost is no merchant):
docker compose run --rm cli wp config set FRAK_ENV dev --type=constant
docker compose run --rm cli wp config set FRAK_MERCHANT_DOMAIN <domain> --type=constant
```

- `<domain>` must resolve on `https://backend.gcp-dev.frak.id/user/merchant/resolve?domain=<domain>`; register it on `business-dev.frak.id` if not. Settings → Frak shows the dev-mode notice and "Connected". A lookup that failed in the last 5 minutes is cached: click **Refresh Merchant** after changing the domain.
- `FRAK_ENV` set to anything but `dev` is ignored (Settings says so). Removing it re-resolves the production merchant on the next admin page.
- After toggling `FRAK_ENV`, clear the browser's site data for `localhost:8000`: the SDK caches the merchant in `localStorage` (`frak-config-cache…`) and `sessionStorage` (`frak-merchant-id`) without the environment.
- Ambassador page smoke checklist. Each step starts from the state it describes: when it needs no live page, `wp post delete <id> --force` the pages earlier steps left (a trashed created page only offers Restore); when it needs the created page, create it first, with the step 6 mu-plugin removed:
  1. On Twenty Twenty-Five, Settings → Frak → *Create my ambassador page*: the row shows it live; the page shows every section, wide, with the merchant's rewards.
  2. Switch to a classic theme with no full-width template (`wp theme install twentytwentyone --activate`), create again: the body is `[frak_ambassador]` and the row says the template can be switched.
  3. Publish a page you build with the shortcode: it shows as live, with no create button.
  4. Trash the created page → *Restore my ambassador page* brings it back at the same URL.
  5. Rewards show with the constants set; without them the page renders nothing until the components release is live.
  6. Drop an mu-plugin that forces `post_status` to `pending` through `wp_insert_post_data`, click create: the notice gives the reason, no page or draft remains, the button works again. Repeat with a filter that empties `post_content`.
  7. Replace the created page's body with your own text, keep it published: the row shows no page, and create leaves your page untouched.
  8. With WooCommerce active and a webhook set up, remove `FRAK_ENV` and open the Plugins screen, then Settings: either the production merchant shows and the webhook points at `backend.frak.id`, or (domain not a production merchant, as with a dev domain) no merchant shows and the webhook is gone rather than left on the dev backend.
- Tear down with `docker compose down`, then delete `test/db_data` and `test/wordpress` to start from zero.

## Non-Obvious Patterns
- **Classmap autoloading** (not PSR-4) for `includes/` and `admin/` — match class name to filename exactly or WP can't find it.
- **`phpstan-bootstrap.php` required**: WP/WC functions aren't available to static analysis without it — contributing without this triggers `UnknownFunction` errors.
- **WooCommerce is optional but expected**: guard with `class_exists('WooCommerce')` before hooking order lifecycle.
- **The plugin does not send the order webhook**: `includes/class-frak-wc-webhook-registrar.php` only ensures a native `WC_Webhook` row exists with the right URL and secret. WooCommerce owns signing, retries and delivery logging.
- **Admin settings** go through WP Settings API — never write directly to `wp_options` outside sanitize callbacks.
- **`README.txt` is NOT markdown**: it's WP.org's shortcode-flavoured format; the `Stable tag:` header drives release picking.
- **`./build.sh` produces `dist/*.zip`** — that zip is the artifact uploaded to WordPress.org / self-hosted.

## Anti-Patterns
PSR-4 imports (use classmap) · raw `wp_options` writes · fire-and-forget webhook HTTP · Markdown in `README.txt` · depending on WooCommerce without `class_exists` guard · ignoring `phpstan-bootstrap.php`.

## See Also
Parent `/AGENTS.md` · `plugins/magento/AGENTS.md` (parallel integration) · `services/backend/` (webhook receiver).
