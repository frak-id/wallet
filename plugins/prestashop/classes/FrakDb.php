<?php

/**
 * Shared infrastructure factory.
 *
 * Single source of truth for the cross-cutting infrastructure objects
 * every Frak class shares: Doctrine DBAL connection, Symfony Cache pool,
 * Symfony Lock store + factory, and Symfony HttpClient. Despite the
 * historical `FrakDb` name the responsibility is broader than DBAL — it's
 * the module's service registry, kept on a single class so the per-request
 * memo lives in one place and reset() can wipe it atomically for tests.
 *
 * Why one shared connection / client / pool:
 *   - Cache (`DoctrineDbalAdapter`), Lock (`DoctrineDbalStore`), and the
 *     webhook queue (`FrakWebhookQueue`) all hit the same MySQL instance
 *     PrestaShop is already wired against. A single DBAL connection serves
 *     all three — keeps the per-request connection count to PS native + 1.
 *   - HttpClient pools TCP / TLS state internally; sharing one client
 *     between the merchant resolver and the webhook helper means the
 *     resolver's TLS handshake to `backend.frak.id` warms the connection
 *     for the immediately-following webhook send when both fire on the
 *     same order transition.
 *   - Per-request memo on every accessor: callers like the cron drainer
 *     hit `cache()` + `lockStore()` + DBAL queries dozens of times per
 *     tick; rebuilding any of them would be wasted work.
 *
 * Why DBAL 4 + Symfony 6 components:
 *   - PrestaShop 8.1 ships Symfony 4.4 LTS for its core but the autoloader
 *     ordering means our newer vendor copies take precedence for classes
 *     PrestaShop doesn't directly autoload (the Cache / Lock / HttpClient
 *     adapters live in subnamespaces PS doesn't bundle).
 *   - DoctrineDbalAdapter (Cache) and DoctrineDbalStore (Lock) accept a
 *     DBAL Connection directly — single shared infrastructure object.
 *
 * Why fresh PDO via `_DB_SERVER_` instead of reusing `Db::getInstance()->getLink()`:
 *   - PrestaShop's `Db` singleton can be backed by either `DbPDO` (returns
 *     `\PDO`) or `DbMySQLi` (returns `\mysqli`) depending on `PS_USE_PDO`
 *     in `parameters.php`. Reaching into `getLink()` blindly breaks on
 *     mysqli shops.
 *   - Building a DBAL connection from the PS constants is platform-agnostic
 *     and gives us a guaranteed-PDO-backed handle.
 *   - `_DB_SERVER_` may embed the port via `host:port` syntax — parsed
 *     out below so it lands in the correct DBAL key.
 */
class FrakDb
{
    /**
     * Shared DBAL connection. Reset to `null` by `reset()` for tests.
     */
    private static ?\Doctrine\DBAL\Connection $connection = null;

    /**
     * Cache pool memo. Hydrated lazily so a request that never touches
     * the cache (e.g. a static asset pipe-through) pays nothing.
     */
    private static ?\Symfony\Component\Cache\Adapter\DoctrineDbalAdapter $cache = null;

    /**
     * Lock factory memo. Same lazy contract as `$cache`.
     */
    private static ?\Symfony\Component\Lock\LockFactory $lockFactory = null;

    /**
     * Lock store memo. Held separately from the factory so the cron
     * drainer's `prune()` call can drive GC against the same store the
     * factory wraps — building a second store would create a duplicate
     * connection-bound object and split the GC surface in two.
     */
    private static ?\Symfony\Component\Lock\Store\DoctrineDbalStore $lockStore = null;

    /**
     * Shared HttpClient memo. The underlying transport (curl extension
     * when available, PHP streams otherwise) pools TCP + TLS state across
     * `request()` calls, so reusing one client across the resolver and
     * the webhook helper means warm connections to `backend.frak.id`
     * across the whole request lifecycle.
     */
    private static ?\Symfony\Contracts\HttpClient\HttpClientInterface $httpClient = null;

    /**
     * Cache namespace prepended to every key. Mirrors WordPress's
     * `frak_` transient prefix so the two plugins keep symmetric naming
     * conventions when both are inspected on the same backend.
     */
    public const CACHE_NAMESPACE = 'frak';

    /**
     * MySQL table name (without prefix) used by the Symfony Cache adapter.
     * Created on first miss via `cache()->createTable()`.
     */
    public const CACHE_TABLE = 'frak_cache_items';

    /**
     * MySQL table name (without prefix) used by the Symfony Lock store.
     * Created on first lock acquisition via `lockStore()->createTable()`.
     */
    public const LOCK_TABLE = 'frak_lock_keys';

    /**
     * Build (or return the memoised) DBAL connection. Driver is forced to
     * `pdo_mysql` to match PrestaShop's MySQL-only stance — keeps the
     * connection params predictable and avoids surprising fallbacks on
     * shops with weird `_DB_SERVER_` syntax.
     */
    public static function connection(): \Doctrine\DBAL\Connection
    {
        if (self::$connection !== null) {
            return self::$connection;
        }

        // PrestaShop allows `host:port` in `_DB_SERVER_` — split it out so
        // DBAL's connection params get the canonical (host, port) pair
        // instead of an opaque string MySQL would reject.
        $server = (string) _DB_SERVER_;
        $host = $server;
        $port = null;
        if (preg_match('/^(.+?):(\d+)$/', $server, $matches) === 1) {
            $host = $matches[1];
            $port = (int) $matches[2];
        }

        $params = [
            'driver' => 'pdo_mysql',
            'host' => $host,
            'dbname' => (string) _DB_NAME_,
            'user' => (string) _DB_USER_,
            'password' => (string) _DB_PASSWD_,
            'charset' => 'utf8mb4',
        ];
        if ($port !== null) {
            $params['port'] = $port;
        }

        self::$connection = \Doctrine\DBAL\DriverManager::getConnection($params);
        return self::$connection;
    }

    /**
     * Symfony Cache pool backed by `frak_cache_items`. PSR-6 compliant —
     * `getItem()` / `save()` work with any serialisable value (no manual
     * JSON encoding from callers).
     *
     * Default lifetime = 0 means "no implicit expiry". Callers pin
     * per-item TTLs via `CacheItemInterface::expiresAfter()`.
     */
    public static function cache(): \Symfony\Component\Cache\Adapter\DoctrineDbalAdapter
    {
        if (self::$cache !== null) {
            return self::$cache;
        }
        self::$cache = new \Symfony\Component\Cache\Adapter\DoctrineDbalAdapter(
            self::connection(),
            self::CACHE_NAMESPACE,
            0,
            ['db_table' => _DB_PREFIX_ . self::CACHE_TABLE]
        );
        return self::$cache;
    }

    /**
     * Symfony Lock factory backed by `frak_lock_keys`. Used by the cron
     * drainer to prevent overlapping ticks (5-min TTL). The store's
     * `gcProbability` sweeps expired rows opportunistically so a crashed
     * holder never wedges the lock past its TTL.
     */
    public static function lockFactory(): \Symfony\Component\Lock\LockFactory
    {
        if (self::$lockFactory !== null) {
            return self::$lockFactory;
        }
        self::$lockFactory = new \Symfony\Component\Lock\LockFactory(self::lockStore());
        return self::$lockFactory;
    }

    /**
     * Symfony Lock store backed by `frak_lock_keys`. Exposed so the cron
     * drainer can call `prune()` after each tick — the factory itself
     * doesn't surface the store, but pruning the underlying rows is what
     * keeps the table bounded across long-running shops.
     */
    public static function lockStore(): \Symfony\Component\Lock\Store\DoctrineDbalStore
    {
        if (self::$lockStore !== null) {
            return self::$lockStore;
        }
        self::$lockStore = new \Symfony\Component\Lock\Store\DoctrineDbalStore(
            self::connection(),
            ['db_table' => _DB_PREFIX_ . self::LOCK_TABLE]
        );
        return self::$lockStore;
    }

    /**
     * Shared Symfony HttpClient. Lazily built so requests that never
     * touch the network (e.g. an admin page render that doesn't refresh
     * the merchant resolver) pay nothing.
     *
     * Both `timeout` (per-operation) and `max_duration` (full request)
     * clamp at the same window so a misbehaving backend can't wedge the
     * cron tick or the order-status hook past its allotted budget.
     * `http_version => '2.0'` hints curl to attempt HTTP/2 multiplexing
     * — the Frak backend supports it, and `sendBatch()`'s parallel
     * requests collapse onto a single TLS connection with multiplexed
     * streams instead of N parallel handshakes.
     */
    public static function httpClient(int $timeout = 5): \Symfony\Contracts\HttpClient\HttpClientInterface
    {
        if (self::$httpClient !== null) {
            return self::$httpClient;
        }
        self::$httpClient = \Symfony\Component\HttpClient\HttpClient::create([
            'timeout' => $timeout,
            'max_duration' => $timeout,
            'http_version' => '2.0',
        ]);
        return self::$httpClient;
    }

    /**
     * Provision the Cache + Lock tables. Called from install + the upgrade
     * migrator so the schema is in place before the first request lands.
     * Both adapters are idempotent — re-running on an existing table is a
     * no-op (the underlying `CREATE TABLE IF NOT EXISTS` swallows the
     * collision).
     */
    public static function createInfrastructureTables(): void
    {
        self::cache()->createTable();
        self::lockStore()->createTable();
    }

    /**
     * Drop the Cache + Lock tables. Called from uninstall so the merchant
     * leaves no schema artefacts behind. `DROP TABLE IF EXISTS` keeps the
     * teardown idempotent on partial-uninstall edge cases.
     */
    public static function dropInfrastructureTables(): void
    {
        $conn = self::connection();
        $conn->executeStatement(
            'DROP TABLE IF EXISTS `' . _DB_PREFIX_ . self::CACHE_TABLE . '`'
        );
        $conn->executeStatement(
            'DROP TABLE IF EXISTS `' . _DB_PREFIX_ . self::LOCK_TABLE . '`'
        );
    }

    /**
     * Reset every memoised handle. Test-only — production callers never
     * need this since the memos live for one request anyway. Exposed so
     * PHPUnit tests that swap underlying constants / connections can
     * force a fresh build.
     */
    public static function reset(): void
    {
        if (self::$connection !== null) {
            // Closing here surfaces accidental connection leaks during
            // long-running test suites; production code path never hits
            // this branch since `reset()` isn't called from the runtime.
            self::$connection->close();
        }
        self::$connection = null;
        self::$cache = null;
        self::$lockFactory = null;
        self::$lockStore = null;
        self::$httpClient = null;
    }
}
