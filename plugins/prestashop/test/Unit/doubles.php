<?php

declare(strict_types=1);

/*
 * Shared PrestaShop runtime doubles for the unit suite. PHPUnit loads every
 * test file into one process, so a global class may be declared once only:
 * test files `require_once` this file instead of declaring their own.
 * Call `frak_test_reset_doubles()` from setUp() to start from empty stores.
 */

if (!defined('_DB_PREFIX_')) {
    define('_DB_PREFIX_', 'ps_');
}

if (!function_exists('pSQL')) {
    function pSQL($value, $html_ok = false)
    {
        return is_string($value) ? $value : (string) $value;
    }
}

if (!class_exists('FrakTestDbRecorder')) {
    /** Records every SQL string so tests can assert which statements ran. */
    class FrakTestDbRecorder
    {
        /** @var string[] */
        public static array $executed = [];

        /** @var string[] `cache_key` of every delete() call */
        public static array $deletedCacheKeys = [];

        /** @var array<string, string> JSON `cache_value` of `frak_cache` rows, by key */
        public static array $cacheRows = [];

        public static function reset(): void
        {
            self::$executed = [];
            self::$deletedCacheKeys = [];
            self::$cacheRows = [];
        }

        /** @return true */
        public function delete($table, $where = '')
        {
            if (preg_match("/`cache_key` = '([^']*)'/", (string) $where, $m) === 1) {
                self::$deletedCacheKeys[] = $m[1];
            }

            return true;
        }

        /** @return true */
        public function execute($sql)
        {
            self::$executed[] = (string) $sql;

            return true;
        }

        /** @return int */
        public function getValue($sql)
        {
            return 0;
        }

        /** @return array{cnt: int} */
        public function getRow($sql)
        {
            if (preg_match("/`cache_key` = '([^']*)'/", (string) $sql, $m) === 1) {
                return isset(self::$cacheRows[$m[1]])
                    ? ['cache_value' => self::$cacheRows[$m[1]], 'expires_at' => null]
                    : false;
            }

            return ['cnt' => 0];
        }
    }
}

if (!class_exists('Db')) {
    class Db
    {
        public static function getInstance()
        {
            return new \FrakTestDbRecorder();
        }
    }
}

if (!class_exists('Cache')) {
    class Cache
    {
        /** @return true */
        public static function clean($pattern)
        {
            return true;
        }
    }
}

if (!class_exists('Configuration')) {
    /** In-memory `ps_configuration`: values written are read back. */
    class Configuration
    {
        /** @var array<string, mixed> */
        public static array $store = [];

        public static function reset(): void
        {
            self::$store = [];
        }

        /** @return true */
        public static function deleteByName($key)
        {
            unset(self::$store[$key]);

            return true;
        }

        /** @return mixed false when the key is absent, like PrestaShop */
        public static function get($key)
        {
            return self::$store[$key] ?? false;
        }

        /**
         * @param string[] $keys
         * @return array<string, mixed>
         */
        public static function getMultiple($keys)
        {
            $out = [];
            foreach ($keys as $key) {
                $out[$key] = self::get($key);
            }

            return $out;
        }

        public static function hasKey($key): bool
        {
            return array_key_exists($key, self::$store);
        }

        /** @return true */
        public static function updateValue($key, $value)
        {
            self::$store[$key] = $value;

            return true;
        }
    }
}

if (!class_exists('Tools')) {
    class Tools
    {
        public static string $shopDomain = 'shop.example.com';

        public static function getShopDomain($http = false, $entities = false)
        {
            return self::$shopDomain;
        }
    }
}

if (!class_exists('Module')) {
    class Module
    {
        public string $name = 'frakintegration';

        public int $active = 1;
    }
}

if (!function_exists('frak_test_reset_doubles')) {
    function frak_test_reset_doubles(): void
    {
        \FrakTestDbRecorder::reset();
        \Configuration::reset();
        \Tools::$shopDomain = 'shop.example.com';
    }
}
