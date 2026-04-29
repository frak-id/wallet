<?php

/**
 * Hand-written PrestaShop core stubs for PHPStan.
 *
 * Why hand-written instead of pulling `prestashop/php-dev-tools`:
 *   - `php-dev-tools` drags Symfony 4.4 + Twig + the full PS dev kernel as
 *     transitive deps (~50+ packages, multi-MB vendor footprint just to
 *     analyse this module). The same trade-off the WordPress sibling makes
 *     against pulling `wp-coding-standards/wpcs`.
 *   - We only consume a thin slice of the PS API surface (Configuration,
 *     Tools, Context, Order, Validate, Db, Tab, Language, PrestaShopLogger,
 *     Hook, Module, ModuleAdminController, ModuleFrontController,
 *     FrontController). Hand-stubbing those is ~150 lines and keeps the
 *     CI lane free of dep churn.
 *   - When PrestaShop ships a method we use, we add it here. Method
 *     signatures track the PrestaShop core implementation closely enough
 *     for level-1 PHPStan; we are not trying to enforce strict type
 *     correctness against PS's internals (those have their own surface
 *     drift between 1.7 and 8.x).
 *
 * Constants are `define()`d below so phpstan stops flagging
 * `_DB_PREFIX_` etc. as unknown. The values mirror the PrestaShop runtime
 * defaults but they're never read at analysis time \u2014 phpstan only checks
 * that the constant exists.
 */

// PrestaShop runtime constants -------------------------------------------
if (!defined('_PS_VERSION_')) {
    define('_PS_VERSION_', '8.1.0');
}
if (!defined('_DB_PREFIX_')) {
    define('_DB_PREFIX_', 'ps_');
}
if (!defined('_DB_SERVER_')) {
    define('_DB_SERVER_', 'localhost');
}
if (!defined('_DB_NAME_')) {
    define('_DB_NAME_', 'prestashop');
}
if (!defined('_DB_USER_')) {
    define('_DB_USER_', 'root');
}
if (!defined('_DB_PASSWD_')) {
    define('_DB_PASSWD_', '');
}
if (!defined('_PS_IMG_')) {
    define('_PS_IMG_', '/img/');
}
if (!defined('_PS_MODULE_DIR_')) {
    define('_PS_MODULE_DIR_', '/var/www/html/modules/');
}
if (!defined('_PS_CACHE_DIR_')) {
    define('_PS_CACHE_DIR_', '/var/www/html/var/cache/');
}
if (!defined('_PS_ADMIN_DIR_')) {
    define('_PS_ADMIN_DIR_', '/var/www/html/admin/');
}
if (!defined('_MYSQL_ENGINE_')) {
    define('_MYSQL_ENGINE_', 'InnoDB');
}

// Standalone helper functions --------------------------------------------
if (!function_exists('pSQL')) {
    /**
     * Sanitise a value for inclusion in a raw SQL fragment. Mirrors the
     * PrestaShop helper used throughout the module.
     */
    function pSQL($string, $html_ok = false): string
    {
        return (string) $string;
    }
}

// Configuration ----------------------------------------------------------
if (!class_exists('Configuration')) {
    class Configuration
    {
        /** @return mixed */
        public static function get($name, $id_lang = null, $id_shop_group = null, $id_shop = null, $default = false)
        {
            return null;
        }

        /** @param string[] $names @return array<string,mixed> */
        public static function getMultiple($names, $id_lang = null, $id_shop_group = null, $id_shop = null): array
        {
            return [];
        }

        public static function updateValue($name, $value, $html = false, $id_shop_group = null, $id_shop = null): bool
        {
            return true;
        }

        public static function hasKey($name, $id_lang = null, $id_shop_group = null, $id_shop = null): bool
        {
            return false;
        }

        public static function deleteByName($name): bool
        {
            return true;
        }
    }
}

// Tools ------------------------------------------------------------------
if (!class_exists('Tools')) {
    class Tools
    {
        /** @return mixed */
        public static function getValue($key, $default_value = false)
        {
            return $default_value;
        }

        public static function getIsset($key): bool
        {
            return false;
        }

        public static function isSubmit($name): bool
        {
            return false;
        }

        public static function redirectAdmin($url): void
        {
        }

        public static function getShopDomain($http = false, $entities = false): string
        {
            return '';
        }
    }
}

// Validate ---------------------------------------------------------------
if (!class_exists('Validate')) {
    class Validate
    {
        /** @param mixed $object */
        public static function isLoadedObject($object): bool
        {
            return false;
        }

        public static function isUrl($url): bool
        {
            return false;
        }

        public static function isGenericName($name): bool
        {
            return false;
        }
    }
}

// Db / DbCore ------------------------------------------------------------
if (!class_exists('DbCore')) {
    class DbCore
    {
        /** @param string|array<string> $sql */
        public function execute($sql, $use_cache = true): bool
        {
            return true;
        }

        /** @return array<int, array<string, mixed>>|false */
        public function executeS($sql, $array = true, $use_cache = true)
        {
            return [];
        }

        /** @return array<string, mixed>|false */
        public function getRow($sql, $use_cache = true)
        {
            return [];
        }

        /** @return string|false */
        public function getValue($sql, $use_cache = true)
        {
            return '';
        }

        /** @param array<string, mixed>|array<int, array<string, mixed>> $data */
        public function insert($table, $data, $null_values = false, $use_cache = true, $type = 0, $add_prefix = true): bool
        {
            return true;
        }

        /** @param array<string, mixed> $data */
        public function update($table, $data, $where = '', $limit = 0, $null_values = false, $use_cache = true, $add_prefix = true): bool
        {
            return true;
        }
    }
}

if (!class_exists('Db')) {
    class Db extends DbCore
    {
        public static function getInstance($master = true): DbCore
        {
            return new DbCore();
        }
    }
}

// Hook -------------------------------------------------------------------
if (!class_exists('Hook')) {
    class Hook
    {
        /** @return mixed */
        public static function exec($hook_name, $hook_args = [], $id_module = null)
        {
            return null;
        }
    }
}

// PrestaShopLogger -------------------------------------------------------
if (!class_exists('PrestaShopLogger')) {
    class PrestaShopLogger
    {
        public static function addLog($message, $severity = 1, $error_code = null, $object_type = null, $object_id = null, $allow_duplicate = false): bool
        {
            return true;
        }
    }
}

// Order / Customer / Currency / Image -----------------------------------
if (!class_exists('Order')) {
    class Order
    {
        /** @var int */
        public $id = 0;
        /** @var int */
        public $id_customer = 0;
        /** @var int */
        public $id_currency = 0;
        /** @var string */
        public $secure_key = '';
        /** @var float */
        public $total_paid_tax_incl = 0.0;

        public function __construct($id = null, $id_lang = null)
        {
        }

        /** @return array<int, array<string, mixed>> */
        public function getProducts(): array
        {
            return [];
        }
    }
}

if (!class_exists('Customer')) {
    class Customer
    {
        /** @var int */
        public $id = 0;

        public function __construct($id = null)
        {
        }
    }
}

if (!class_exists('Currency')) {
    class Currency
    {
        /** @var int */
        public $id = 0;
        /** @var string */
        public $iso_code = '';

        public function __construct($id = null, $id_lang = null, $id_shop = null)
        {
        }
    }
}

if (!class_exists('Image')) {
    class Image
    {
        /** @var int */
        public $id = 0;
    }
}

// Tab / Language ---------------------------------------------------------
if (!class_exists('Tab')) {
    class Tab
    {
        /** @var int */
        public $active = 1;
        /** @var string */
        public $class_name = '';
        /** @var array<int, string> */
        public $name = [];
        /** @var int */
        public $id_parent = 0;
        /** @var string */
        public $module = '';

        public function __construct($id = null, $id_lang = null, $id_shop = null)
        {
        }

        public static function getIdFromClassName($class_name): int
        {
            return 0;
        }

        public function add($auto_date = true, $null_values = false): bool
        {
            return true;
        }
    }
}

if (!class_exists('Language')) {
    class Language
    {
        /** @return array<int, array<string, mixed>> */
        public static function getLanguages($active = true, $id_shop = false): array
        {
            return [];
        }
    }
}

// Context / Link ---------------------------------------------------------
if (!class_exists('Link')) {
    class Link
    {
        public function getMediaLink($file_uri): string
        {
            return '';
        }

        public function getAdminLink($controller, $with_token = true, $params = [], $params_as_query = []): string
        {
            return '';
        }

        public function getBaseLink($id_shop = null, $ssl = null, $relative_protocol = false): string
        {
            return '';
        }

        public function getProductLink($product, $alias = null): string
        {
            return '';
        }

        public function getImageLink($name, $ids, $type = null): string
        {
            return '';
        }
    }
}

if (!class_exists('Smarty')) {
    class Smarty
    {
        public function assign($tpl_var, $value = null): void
        {
        }

        public function fetch($template = null): string
        {
            return '';
        }

        public function registerPlugin($type, $name, $callback): void
        {
        }

        public function unregisterPlugin($type, $name): void
        {
        }
    }
}

if (!class_exists('Context')) {
    class Context
    {
        /** @var Link */
        public $link;
        /** @var Smarty */
        public $smarty;
        /** @var FrontController|ModuleAdminController|null */
        public $controller;

        public static function getContext(): self
        {
            return new self();
        }
    }
}

// Module / FrontController / AdminController ----------------------------
if (!class_exists('Module')) {
    class Module
    {
        /** @var string */
        public $name = '';
        /** @var string */
        public $version = '';
        /** @var string */
        public $author = '';
        /** @var string */
        public $tab = '';
        /** @var string */
        public $displayName = '';
        /** @var string */
        public $description = '';
        /** @var string */
        public $confirmUninstall = '';
        /** @var int */
        public $need_instance = 0;
        /** @var array<string, string> */
        public $ps_versions_compliancy = [];
        /** @var bool */
        public $bootstrap = false;
        /** @var Context */
        public $context;

        public function __construct()
        {
            $this->context = Context::getContext();
        }

        public function install(): bool
        {
            return true;
        }

        public function uninstall(): bool
        {
            return true;
        }

        public function registerHook($hook_name, $shop_list = null): bool
        {
            return true;
        }

        public function unregisterHook($hook_name, $shop_list = null): bool
        {
            return true;
        }

        public function l($string, $specific = false, $locale = null): string
        {
            return $string;
        }

        public function display($file, $template, $cache_id = null, $compile_id = null): string
        {
            return '';
        }

        public function getPathUri(): string
        {
            return '';
        }
    }
}

if (!class_exists('Controller')) {
    class Controller
    {
        public function init(): void
        {
        }
    }
}

if (!class_exists('FrontController')) {
    class FrontController extends Controller
    {
        /** @var bool */
        public $ajax = false;

        /** @param array<string, mixed> $params */
        public function registerJavascript($id, $relative_path, $params = []): void
        {
        }

        /** @param array<string, mixed> $params */
        public function registerStylesheet($id, $relative_path, $params = []): void
        {
        }
    }
}

if (!class_exists('ModuleFrontController')) {
    class ModuleFrontController extends FrontController
    {
        /** @var bool */
        public $auth = false;
        /** @var bool */
        public $guestAllowed = true;
        /** @var bool */
        public $display_header = false;
        /** @var bool */
        public $display_footer = false;
        /** @var bool */
        public $display_column_left = false;
        /** @var bool */
        public $display_column_right = false;
        /** @var bool */
        public $ssl = false;
        /** @var Module */
        public $module;
    }
}

if (!class_exists('ModuleAdminController')) {
    class ModuleAdminController
    {
        /** @var bool */
        public $bootstrap = false;
        /** @var string */
        public $display = '';
        /** @var string */
        public $meta_title = '';
        /** @var Context */
        public $context;
        /** @var Module */
        public $module;
        /** @var array<int, string> */
        public $errors = [];
        /** @var array<int, string> */
        public $confirmations = [];

        public function __construct()
        {
            $this->context = Context::getContext();
        }

        public function setMedia($isNewTheme = false): void
        {
        }

        public function addJS($js_uri, $check_path = true): void
        {
        }

        public function l($string, $class = null, $addslashes = false, $htmlentities = true): string
        {
            return $string;
        }

        public function getTemplatePath(): string
        {
            return '';
        }
    }
}
