<?php

/**
 * Single source of truth for component placements.
 *
 * A "placement" is the tuple `(component, hook, placement-attr)` describing
 * where in the storefront a Frak web component should be auto-rendered. The
 * registry exists so:
 *
 *   - The module bootstrap (`frakintegration.php`) registers every hook in a
 *     loop driven by this list, instead of carrying parallel
 *     `registerHook(...)` / `hookFooBar()` pairs that drift.
 *   - The admin configuration page renders one checkbox per placement, mapped
 *     1:1 to a key inside the bundled `FRAK_PLACEMENTS` Configuration row.
 *   - The Smarty function plugins (`{frak_banner}`, …) reuse the same
 *     `placement` attribute strings the auto-render hooks emit, so backend
 *     placement-config in `business.frak.id` only has to know about the
 *     storefront-side identifiers listed below.
 *
 * Adding a new placement is a single-line entry here plus a matching
 * `hookXxx()` callback on `FrakIntegration`. Removing one is symmetric (drop
 * the entry; add an `upgrade/install-X.Y.Z.php` script that strips the dead
 * key from the bundled storage row).
 *
 * **Bundled storage:** every placement's enable/disable flag lives in
 * a SINGLE JSON-encoded `FRAK_PLACEMENTS` Configuration row instead of N
 * separate `FRAK_PLACEMENT_*` rows. Mirrors the WordPress sibling's
 * `frak_settings` pattern ({@see Frak_Settings::OPTION_KEY}). Rationale:
 *   - One autoloaded row vs N — `ps_configuration` is loaded entirely into
 *     memory on every request; smaller payload is real RAM saved per page.
 *   - One `Configuration::updateValue` write per save vs N — admin save is
 *     atomic at the storage layer.
 *   - Per-request memo `self::$enabledCache` collapses every `isEnabled()`
 *     call within the request to a single decode — `dispatchHook()` and the
 *     admin renderer no longer trigger N lookups per page.
 *
 * The legacy `config_key` field on each placement (`FRAK_PLACEMENT_FOO`) is
 * preserved so the admin form's `<input name="…">` markers stay stable for
 * merchants who scripted their PrestaShop admin and to keep
 * {@see FrakPlacementRegistryTest} drift-checks meaningful — the form name
 * is decoupled from the storage backend.
 *
 * Mirrors how WordPress lets merchants drop blocks/shortcodes/widgets/Elementor
 * widgets anywhere — PrestaShop's hook system is closer to the WP "widget
 * area" model, so we expose flexibility through opt-in toggles rather than a
 * block editor.
 */
class FrakPlacementRegistry
{
    /**
     * Component identifiers correspond to `FrakComponentRenderer` static
     * methods (`banner`, `shareButton`, `postPurchase`).
     */
    public const COMPONENT_BANNER = 'banner';
    public const COMPONENT_SHARE_BUTTON = 'shareButton';
    public const COMPONENT_POST_PURCHASE = 'postPurchase';

    /**
     * Bundled-storage Configuration row holding the JSON-encoded
     * `{placement_id: enabled}` map. Replaces the per-placement
     * `FRAK_PLACEMENT_*` rows that an unreleased pre-1.0.1 iteration of the
     * module wrote out per placement. `upgrade/install-1.0.1.php` folds any
     * such rows on dev shops into the bundled storage and deletes them.
     */
    public const STORAGE_KEY = 'FRAK_PLACEMENTS';

    /**
     * Authoritative placement list. Keys are stable identifiers used both as
     * admin-form ids and as storage map keys. Hook strings match
     * PrestaShop's `display*` family verbatim — `registerHook()` strips the
     * `hook` prefix so we keep the canonical PrestaShop names here.
     *
     * `default` controls whether the placement is opt-in (`false`) or
     * opt-out (`true`) on a fresh install. The product / order placements
     * are opt-out (existing module behaviour); the auxiliary top-banner
     * surface is opt-in so we don't change merchants' storefronts on
     * upgrade without their consent.
     *
     * `placement_attr` is forwarded as the `placement="..."` HTML attribute
     * on the rendered web component. The Frak business dashboard keys
     * placement-specific copy/styling off this string (Merchant → Placements).
     *
     * `config_key` is the form input name used by the admin template. It is
     * NOT used as a Configuration row key in the bundled-storage layout;
     * storage lives in the {@see self::STORAGE_KEY} row. The field is
     * preserved for form-name stability and so
     * stability and so {@see FrakPlacementRegistryTest::testConfigKeysAreUnique}
     * keeps catching duplicate-id drift.
     *
     * @var array<string, array{
     *     component: string,
     *     hook: string,
     *     config_key: string,
     *     default: bool,
     *     placement_attr: string,
     *     label: string,
     *     description: string,
     * }>
     */
    public const PLACEMENTS = [
        // Share button —————————————————————————————————————————————————
        'share_product' => [
            'component' => self::COMPONENT_SHARE_BUTTON,
            'hook' => 'displayProductAdditionalInfo',
            'config_key' => 'FRAK_PLACEMENT_SHARE_PRODUCT',
            'default' => true,
            'placement_attr' => 'product',
            'label' => 'Share button on product pages',
            'description' => 'Renders the share-and-earn button under each product\'s additional info block.',
        ],

        // Banner ———————————————————————————————————————————————————————
        'banner_top' => [
            'component' => self::COMPONENT_BANNER,
            'hook' => 'displayTop',
            'config_key' => 'FRAK_PLACEMENT_BANNER_TOP',
            'default' => false,
            'placement_attr' => 'top',
            'label' => 'Banner at the top of every page',
            'description' => 'Renders the referral / in-app browser banner above the storefront content. Auto-hides when the SDK has nothing to surface.',
        ],

        // Post-purchase ————————————————————————————————————————————————
        'post_purchase_confirmation' => [
            'component' => self::COMPONENT_POST_PURCHASE,
            'hook' => 'displayOrderConfirmation',
            'config_key' => 'FRAK_PLACEMENT_POST_PURCHASE_CONFIRMATION',
            'default' => true,
            'placement_attr' => 'order-confirmation',
            'label' => 'Post-purchase card on the order confirmation page',
            'description' => 'Shows the post-purchase reward card on the thank-you page so referrers can share immediately.',
        ],
        'post_purchase_detail' => [
            'component' => self::COMPONENT_POST_PURCHASE,
            'hook' => 'displayOrderDetail',
            'config_key' => 'FRAK_PLACEMENT_POST_PURCHASE_DETAIL',
            'default' => true,
            'placement_attr' => 'view-order',
            'label' => 'Post-purchase card on My Account → Orders → Detail',
            'description' => 'Re-fires the post-purchase tracker + card when the customer revisits the order from the account area or the order email link.',
        ],
    ];

    /**
     * Per-request cache of the resolved enabled map. Hydrated lazily on
     * the first {@see isEnabled()} / {@see getEnabledMap()} call and reset
     * by {@see setEnabledMap()} / {@see clearAll()} so writes are visible
     * to the same request that issued them.
     *
     * Mirrors WordPress's `Frak_Settings::$cache`
     * ({@see plugins/wordpress/includes/class-frak-settings.php#L87}).
     *
     * @var array<string, bool>|null
     */
    private static ?array $enabledCache = null;

    /**
     * Distinct hooks to register on install. PrestaShop's `registerHook()`
     * is idempotent per (module, hook) but we still de-dupe so the install
     * loop doesn't redundantly hit the DB.
     *
     * @return string[]
     */
    public static function distinctHooks(): array
    {
        $hooks = [];
        foreach (self::PLACEMENTS as $placement) {
            $hooks[$placement['hook']] = true;
        }
        return array_keys($hooks);
    }

    /**
     * Subset of placements bound to a specific PrestaShop hook. The hook
     * callbacks (`hookDisplayTop`, …) iterate this list so a single hook
     * surface can host multiple placements (e.g. share button + banner).
     *
     * @return array<string, array{
     *     component: string,
     *     hook: string,
     *     config_key: string,
     *     default: bool,
     *     placement_attr: string,
     *     label: string,
     *     description: string,
     * }>
     */
    public static function forHook(string $hook): array
    {
        $matched = [];
        foreach (self::PLACEMENTS as $id => $placement) {
            if ($placement['hook'] === $hook) {
                $matched[$id] = $placement;
            }
        }
        return $matched;
    }

    /**
     * Read the merchant's enable-flag for a placement. Falls back to the
     * declared default when the placement is missing from the bundled
     * storage row (fresh install or upgrade before the migrator ran).
     */
    public static function isEnabled(string $id): bool
    {
        if (!isset(self::PLACEMENTS[$id])) {
            return false;
        }
        $map = self::getEnabledMap();
        return $map[$id] ?? self::PLACEMENTS[$id]['default'];
    }

    /**
     * Resolved `{placement_id: bool}` map for the current request. Hydrates
     * the per-request cache on first access and merges declared defaults so
     * callers can iterate every placement without missing keys.
     *
     * @return array<string, bool>
     */
    public static function getEnabledMap(): array
    {
        if (self::$enabledCache !== null) {
            return self::$enabledCache;
        }

        $stored = self::loadStoredMap();
        $resolved = [];
        foreach (self::PLACEMENTS as $id => $placement) {
            $resolved[$id] = $stored[$id] ?? $placement['default'];
        }
        self::$enabledCache = $resolved;
        return $resolved;
    }

    /**
     * Persist a partial `{placement_id: bool}` map. Existing entries for
     * placements not present in `$updates` are preserved (so the admin form
     * can post only the placements it actually rendered without nuking the
     * rest). Drops the per-request cache so subsequent reads see the new
     * values.
     *
     * @param array<string, bool> $updates
     */
    public static function setEnabledMap(array $updates): bool
    {
        $stored = self::loadStoredMap();
        $merged = $stored;
        foreach ($updates as $id => $value) {
            if (!isset(self::PLACEMENTS[$id])) {
                continue;
            }
            $merged[$id] = (bool) $value;
        }
        // Trim ghost entries (placements that were removed from PLACEMENTS
        // but linger in the stored map from a previous version).
        $merged = array_intersect_key($merged, self::PLACEMENTS);

        $encoded = json_encode($merged);
        if ($encoded === false) {
            return false;
        }
        $ok = (bool) Configuration::updateValue(self::STORAGE_KEY, $encoded);
        if ($ok) {
            // Re-prime the cache so the same request sees the new values.
            $resolved = [];
            foreach (self::PLACEMENTS as $id => $placement) {
                $resolved[$id] = $merged[$id] ?? $placement['default'];
            }
            self::$enabledCache = $resolved;
        }
        return $ok;
    }

    /**
     * Seed every placement's flag with its declared default. Called from
     * `install()` and from `upgrade/install-1.0.1.php`. No-ops when the
     * bundled row already exists so merchant choices on previously-stored
     * placements survive upgrades.
     */
    public static function seedDefaults(): void
    {
        if (Configuration::hasKey(self::STORAGE_KEY)) {
            return;
        }
        $defaults = [];
        foreach (self::PLACEMENTS as $id => $placement) {
            $defaults[$id] = $placement['default'];
        }
        $encoded = json_encode($defaults);
        if ($encoded !== false) {
            Configuration::updateValue(self::STORAGE_KEY, $encoded);
        }
        self::$enabledCache = null;
    }

    /**
     * Wipe the bundled storage row plus any lingering legacy
     * `FRAK_PLACEMENT_*` rows. Called from `uninstall()`. The legacy sweep
     * is safe-by-default — those keys are only ever present on dev shops
     * that ran a pre-1.0.1 iteration of the module locally; production
     * v0.0.4 shops never wrote them. The cleanup here also catches
     * partial-uninstall edge cases.
     */
    public static function clearAll(): void
    {
        Configuration::deleteByName(self::STORAGE_KEY);
        foreach (self::PLACEMENTS as $placement) {
            if (isset($placement['config_key'])) {
                Configuration::deleteByName($placement['config_key']);
            }
        }
        self::$enabledCache = null;
    }

    /**
     * Decode the bundled storage row. Returns an empty array on absence /
     * malformed JSON so the caller can `?? $default` safely. Public-static
     * because the upgrade migrator and the admin controller both need to
     * peek at the raw stored shape without going through the defaults
     * merge.
     *
     * @return array<string, bool>
     */
    public static function loadStoredMap(): array
    {
        $raw = Configuration::get(self::STORAGE_KEY);
        if (!$raw) {
            return [];
        }
        $decoded = json_decode((string) $raw, true);
        if (!is_array($decoded)) {
            return [];
        }
        $resolved = [];
        foreach ($decoded as $id => $value) {
            $resolved[(string) $id] = (bool) $value;
        }
        return $resolved;
    }

    /**
     * Reset the per-request memo. Test-only — production callers should
     * never need this because writes go through {@see setEnabledMap()}
     * which re-primes the cache. Exposed so PHPUnit tests that mutate the
     * underlying Configuration row directly can force a fresh load.
     */
    public static function resetCache(): void
    {
        self::$enabledCache = null;
    }
}
