<?php

/**
 * Shared Symfony HttpClient for outbound Frak backend calls.
 *
 * Owns the single per-request HttpClient instance used by:
 *   - {@see FrakMerchantResolver} (`GET /user/merchant/resolve`)
 *   - {@see FrakWebhookHelper} (`POST /ext/merchant/{id}/webhook/custom`,
 *     single + batch)
 *
 * Why one shared client:
 *   - Symfony HttpClient pools TCP + TLS state internally. Sharing one
 *     instance between resolver and webhook helper means the TLS handshake
 *     to `backend.frak.id` warmed by a merchant-resolution call carries
 *     over to the immediately-following webhook send when both fire on
 *     the same order transition.
 *   - HTTP/2 multiplexing (hinted via `http_version => '2.0'`) collapses
 *     {@see FrakWebhookHelper::sendBatch()}'s 25 parallel requests onto a
 *     single TLS connection with multiplexed streams instead of N
 *     parallel handshakes.
 *
 * Lazily built so requests that never touch the network (e.g. an admin
 * page render that does not refresh the merchant resolver) pay nothing.
 *
 * Both `timeout` (per-operation) and `max_duration` (full request) clamp
 * at the same window so a misbehaving backend cannot wedge the cron tick
 * or the order-status hook past its allotted budget.
 *
 * Extracted from {@see FrakInfra} (formerly `FrakDb`) to keep that class
 * focused on database-bound infrastructure (DBAL connection + the Cache
 * and Lock adapters built against it). HTTP transport has no shared
 * state with the database connection.
 */
class FrakHttpClient
{
    /**
     * Per-request + max-duration timeout shared by every Frak outbound HTTP
     * caller. Tight enough that a misbehaving backend cannot wedge the
     * order-status hook past its allotted budget — failures land in the
     * webhook retry queue instead.
     */
    public const TIMEOUT = 5;

    /** Memoised HttpClient instance. Reset to `null` by {@see reset()} for tests. */
    private static ?\Symfony\Contracts\HttpClient\HttpClientInterface $client = null;

    /**
     * Build (or return the memoised) shared HttpClient. Subsequent calls
     * within the same request return the warm instance — TLS state pooled
     * across the resolver + webhook helper.
     *
     * Throws when PrestaShop's bundled Symfony HttpClient is not loadable
     * (see {@see isAvailable()}). Callers (`FrakWebhookHelper::send()` and
     * `FrakMerchantResolver::resolve()`) already wrap their HTTP entry
     * points in `try/catch (Exception)` so the failure surfaces as a
     * queue `last_error` row + a `PrestaShopLogger` entry rather than a
     * white-screen fatal.
     */
    public static function getInstance(): \Symfony\Contracts\HttpClient\HttpClientInterface
    {
        if (self::$client !== null) {
            return self::$client;
        }
        if (!self::isAvailable()) {
            throw new Exception(self::missingDependencyMessage());
        }
        self::$client = \Symfony\Component\HttpClient\HttpClient::create([
            'timeout' => self::TIMEOUT,
            'max_duration' => self::TIMEOUT,
            'http_version' => '2.0',
        ]);
        return self::$client;
    }

    /**
     * Whether `\Symfony\Component\HttpClient\HttpClient` is loadable via
     * the registered autoloaders. The merchant zip ships only the plugin's
     * classmap (composer.json no longer requires `symfony/http-client`); we
     * rely on PrestaShop 8.1+ bundling `symfony/symfony` 4.x with the
     * HttpClient component, which PS's autoloader exposes under the
     * `Symfony\Component\HttpClient` PSR-4 prefix.
     *
     * Used by:
     *   - {@see getInstance()}                — runtime guard.
     *   - {@see FrakInstaller::install()}     — fail fast on fresh installs.
     *   - `upgrade/install-1.0.1.php`         — fail fast on upgrades.
     *
     * `class_exists()` triggers the autoload chain, so a missing class
     * reliably returns `false` instead of a fatal — PHP's autoload is
     * lazy by design.
     */
    public static function isAvailable(): bool
    {
        return class_exists(\Symfony\Component\HttpClient\HttpClient::class);
    }

    /**
     * Centralised error string surfaced when {@see isAvailable()} returns
     * false. Public + static so the install / upgrade / runtime paths show
     * the merchant the same diagnostic regardless of which code path
     * detected the missing dependency.
     */
    public static function missingDependencyMessage(): string
    {
        return 'Frak requires Symfony HttpClient, normally bundled with PrestaShop 8.1+'
            . ' via the symfony/symfony package. Class \\Symfony\\Component\\HttpClient\\HttpClient'
            . ' was not found in the autoloader — verify that your PrestaShop installation is'
            . ' intact and ships its standard symfony/* vendor packages.';
    }

    /**
     * Reset the memoised client. Test-only — production callers never need
     * this since the memo lives for one request anyway. Exposed so PHPUnit
     * tests that swap underlying transports can force a fresh build.
     */
    public static function reset(): void
    {
        self::$client = null;
    }
}
