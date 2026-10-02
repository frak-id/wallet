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

if (!defined('_PS_VERSION_')) {
    define('_PS_VERSION_', '8.2.6');
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

        /** @var string[] every `ps_cms_lang` lookup, answered from the CMS double's store */
        public static array $cmsQueries = [];

        public static function reset(): void
        {
            self::$executed = [];
            self::$deletedCacheKeys = [];
            self::$cacheRows = [];
            self::$cmsQueries = [];
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

        /** @return int|string|false */
        public function getValue($sql)
        {
            if (strpos((string) $sql, '_cms_lang') !== false) {
                self::$cmsQueries[] = (string) $sql;
                preg_match("/LIKE '%([^']*)%'/", (string) $sql, $m);

                return \CMS::newestActiveHolding($m[1] ?? '');
            }

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

if (!class_exists('PrestaShopException')) {
    class PrestaShopException extends \Exception
    {
    }
}

if (!class_exists('PrestaShopLogger')) {
    /** Records `addLog()` calls so tests can assert what was logged. */
    class PrestaShopLogger
    {
        /** @var array<int, array{string, int}> */
        public static array $logs = [];

        public static function reset(): void
        {
            self::$logs = [];
        }

        /** @return true */
        public static function addLog($message, $severity = 1)
        {
            self::$logs[] = [(string) $message, (int) $severity];

            return true;
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

        public static function str2url($str)
        {
            return trim((string) preg_replace('/[^a-z0-9]+/', '-', strtolower((string) $str)), '-');
        }
    }
}

if (!class_exists('Module')) {
    class Module
    {
        public string $name = 'frakintegration';

        public int $active = 1;

        /** @return true */
        public function unregisterHook($hook)
        {
            return true;
        }

        public function getLocalPath(): string
        {
            return __DIR__ . '/../../';
        }
    }
}

if (!class_exists('Language')) {
    class Language
    {
        /** @var array<int, array{id_lang: int, iso_code: string}> */
        public static array $languages = [];

        public static function getLanguages($active = true)
        {
            return self::$languages;
        }
    }
}

if (!class_exists('Link')) {
    class Link
    {
        public function getCMSLink($cms, $alias = null, $ssl = null, $idLang = null)
        {
            return 'https://shop.example/' . (int) $idLang . '/content/' . (int) $cms->id;
        }

        public function getAdminLink($controller, $withToken = true, $sfRouteParams = [], $params = [])
        {
            return 'https://shop.example/admin/index.php?controller=' . $controller . '&' . http_build_query($params);
        }
    }
}

if (!class_exists('Context')) {
    class Context
    {
        public static ?Context $instance = null;

        public object $language;

        public object $shop;

        public Link $link;

        public function __construct()
        {
            $this->language = (object) ['id' => 1];
            $this->shop = (object) ['id' => 1];
            $this->link = new \Link();
        }

        public static function getContext(): Context
        {
            return self::$instance ??= new self();
        }

        public static function reset(): void
        {
            self::$instance = null;
        }
    }
}

if (!class_exists('CMS')) {
    /** In-memory `ps_cms` + `ps_cms_lang`: per-language fields are arrays keyed by `id_lang`, as on a multilang ObjectModel. */
    class CMS
    {
        private const FIELDS = ['id_cms_category', 'active', 'indexation', 'meta_title', 'link_rewrite', 'content'];

        /** @var array<int, array<string, mixed>> */
        public static array $rows = [];

        public static int $nextId = 1;

        /** @var callable|null Rewrites a row as it is persisted, to play a save that does not stick. */
        public static $onPersist = null;

        /** @var \Throwable|null Thrown by every add()/update(), to play a database error. */
        public static ?\Throwable $onPersistThrows = null;

        public $id;

        public $id_cms_category;

        public $active;

        public $indexation;

        public $meta_title;

        public $link_rewrite;

        public $content;

        public function __construct($id = null)
        {
            if ($id && isset(self::$rows[(int) $id])) {
                $this->id = (int) $id;
                foreach (self::$rows[(int) $id] as $field => $value) {
                    $this->$field = $value;
                }
            }
        }

        public static function reset(): void
        {
            self::$rows = [];
            self::$nextId = 1;
            self::$onPersist = null;
            self::$onPersistThrows = null;
        }

        /**
         * @param array<int, string> $content by id_lang
         * @return int new page id
         */
        public static function seed(array $content, bool $active = true): int
        {
            $id = self::$nextId++;
            self::$rows[$id] = [
                'id_cms_category' => 1,
                'active' => $active,
                'indexation' => true,
                'meta_title' => array_map(static fn ($c) => 'Page ' . $id, $content),
                'link_rewrite' => array_map(static fn ($c) => 'page-' . $id, $content),
                'content' => $content,
            ];

            return $id;
        }

        /** @return int|false id of the newest active page whose content holds `$needle` */
        public static function newestActiveHolding(string $needle)
        {
            $found = false;
            foreach (self::$rows as $id => $row) {
                foreach ($row['content'] as $html) {
                    if ($row['active'] && strpos($html, $needle) !== false) {
                        $found = max((int) $found, $id);
                    }
                }
            }

            return $found;
        }

        public function add()
        {
            $this->id = self::$nextId++;

            return $this->persist();
        }

        public function update()
        {
            return $this->id ? $this->persist() : false;
        }

        public function delete()
        {
            unset(self::$rows[(int) $this->id]);

            return true;
        }

        private function persist(): bool
        {
            if (self::$onPersistThrows !== null) {
                throw self::$onPersistThrows;
            }
            $row = [];
            foreach (self::FIELDS as $field) {
                $row[$field] = $this->$field;
            }
            $row['active'] = (bool) $row['active'];
            self::$rows[(int) $this->id] = self::$onPersist !== null ? (self::$onPersist)($row) : $row;

            return true;
        }
    }
}

if (!class_exists('CmsController')) {
    class CmsController
    {
        public $cms;

        /** @var array<int, array{string, string}> */
        public array $stylesheets = [];

        public function registerStylesheet($id, $path, $params = [])
        {
            $this->stylesheets[] = [$id, $path];
        }
    }
}

if (!function_exists('frak_test_reset_doubles')) {
    function frak_test_reset_doubles(): void
    {
        \FrakTestDbRecorder::reset();
        \Configuration::reset();
        \Tools::$shopDomain = 'shop.example.com';
        \CMS::reset();
        \PrestaShopLogger::reset();
        \Context::reset();
        \Language::$languages = [];
    }
}
