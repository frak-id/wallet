<?php

/**
 * Cron front controller. Drains the webhook retry queue on every hit.
 *
 * URL: `https://{shop}/index.php?fc=module&module=frakintegration&controller=cron&token={FRAK_CRON_TOKEN}`
 *
 * Authentication: a 64-char hex token (`Configuration::get('FRAK_CRON_TOKEN')`)
 * generated on install with `bin2hex(random_bytes(32))`. The merchant copies
 * the URL from the admin page and wires it into either `ps_cronjobs` (the
 * official PrestaShop cron module) or a server-level cron job. We use a
 * URL-token rather than admin auth because PrestaShop front controllers run
 * outside the admin session, and shared-secret URL tokens are the
 * conventional pattern for module crons (`ps_cronjobs` itself uses one).
 *
 * Token comparison goes through `hash_equals` to keep the auth check
 * timing-attack resistant — a naive `==` would leak the token byte-by-byte
 * to a network-adjacent attacker.
 *
 * The controller intentionally returns plain text (not JSON) so curl-based
 * cron invocations log human-readable output. HTTP status codes carry the
 * machine-readable signal: 204 for "drained N rows", 403 for bad token,
 * 500 for unexpected throwables.
 */
class FrakIntegrationCronModuleFrontController extends ModuleFrontController
{
    /** No customer auth required; URL token is the auth surface. */
    public $auth = false;
    /** Anonymous: we don't want PrestaShop to spawn a guest visitor row per cron tick. */
    public $guestAllowed = true;
    /** Don't render any theme; this is a machine endpoint. */
    public $display_header = false;
    public $display_footer = false;
    public $display_column_left = false;
    public $display_column_right = false;
    public $ssl = true;

    public function init(): void
    {
        // Skip the parent's heavy theme bootstrap (lookups, hooks, etc.) — we
        // only need the module loaded. Calling `Controller::init()` directly
        // is the documented escape hatch for cron-style endpoints.
        Controller::init();
    }

    public function postProcess()
    {
        $expected = (string) Configuration::get('FRAK_CRON_TOKEN');
        $provided = (string) Tools::getValue('token');

        if ($expected === '' || !hash_equals($expected, $provided)) {
            // Buffered file log instead of `PrestaShopLogger::addLog`: a
            // brute-force scan of the cron URL would otherwise spam `ps_log`
            // (synchronous DB write per attempt). `FrakLogger::warning`
            // buffers to a per-day rotated file and never escalates below
            // `LEVEL_ERROR`, so token-probe noise stays out of the admin
            // log surface entirely. Manual flush since the front controller
            // exits before PHP's natural shutdown handler fires.
            FrakLogger::warning('cron rejected — invalid token');
            FrakLogger::flush();
            header('HTTP/1.1 403 Forbidden');
            echo 'forbidden';
            exit;
        }

        try {
            $stats = FrakWebhookCron::run();
            header('HTTP/1.1 200 OK');
            header('Content-Type: text/plain; charset=utf-8');
            echo sprintf(
                "ok processed=%d success=%d failure=%d\n",
                $stats['processed'],
                $stats['success'],
                $stats['failure']
            );
            exit;
        } catch (Throwable $e) {
            FrakLogger::error('cron crashed: ' . $e->getMessage());
            FrakLogger::flush();
            header('HTTP/1.1 500 Internal Server Error');
            echo 'cron error';
            exit;
        }
    }
}
