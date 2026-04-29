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
 *     1:1 to a key inside the bundled `FRAK_PLACEMENTS` Configuration row,
 *     plus per-placement option inputs (e.g. share-button style preset, banner
 *     custom CSS class).
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
 * **Bundled storage:** the bundled `FRAK_PLACEMENTS` row carries every
 * placement's enable flag AND its option values in a single JSON-encoded
 * payload. The on-disk shape is `{id: {enabled: bool, options: {key: value}}}`.
 * Mirrors the WordPress sibling's `frak_settings` pattern. Rationale:
 *   - One autoloaded row vs N — `ps_configuration` is loaded entirely into
 *     memory on every request; smaller payload is real RAM saved per page.
 *   - One `Configuration::updateValue` write per save vs N — admin save is
 *     atomic at the storage layer.
 *   - Per-request memo `self::$stateCache` collapses every read call within
 *     the request to a single decode — `dispatchHook()`, the admin renderer,
 *     and option lookups all share the same hashmap.
 *
 * Legacy `{id: bool}` rows from a pre-options dev iteration are tolerated on
 * read by {@see loadStoredMap()} so a partial-upgrade install self-heals on
 * the next admin save without breaking placement state.
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
     * Option-input types. The admin template keys off this string to pick the
     * `<select>` vs `<input type="text">` markup; the writer keys off it to
     * pick a validation strategy. Kept as constants so typos at declaration
     * time are PHPStan-flaggable rather than silently rendering the wrong
     * input.
     */
    public const OPTION_TYPE_SELECT = 'select';
    public const OPTION_TYPE_TEXT = 'text';

    /**
     * Bundled-storage Configuration row holding the JSON-encoded
     * `{id: {enabled: bool, options: {key: value}}}` payload. Replaces the
     * per-placement `FRAK_PLACEMENT_*` rows that an unreleased pre-1.0.1
     * iteration of the module wrote out per placement.
     * `upgrade/install-1.0.1.php` folds any such rows on dev shops into the
     * bundled storage and deletes them.
     */
    public const STORAGE_KEY = 'FRAK_PLACEMENTS';

    /**
     * Authoritative placement list. Keys are stable identifiers used both as
     * admin-form ids and as storage map keys. Hook strings match
     * PrestaShop's `display*` family verbatim — `registerHook()` strips the
     * `hook` prefix so we keep the canonical PrestaShop names here.
     *
     * `default` controls whether the placement is opt-in (`false`) or
     * opt-out (`true`) on a fresh install. The current product/order
     * placements are opt-out (existing module behaviour); the new auxiliary
     * surfaces (cart, top banner, customer-account) are opt-in so we don't
     * change merchants' storefronts on upgrade without their consent.
     *
     * `placement_attr` is forwarded as the `placement="..."` HTML attribute
     * on the rendered web component. The Frak business dashboard keys
     * placement-specific copy/styling off this string (Merchant → Placements).
     *
     * `config_key` is the form input name used by the admin template. It is
     * NOT used as a Configuration row key in the bundled-storage layout;
     * storage lives in the {@see self::STORAGE_KEY} row. The field is
     * preserved for form-name stability and so
     * {@see FrakPlacementRegistryTest::testConfigKeysAreUnique} keeps catching
     * duplicate-id drift.
     *
     * `options` (optional) declares merchant-tunable component attributes
     * surfaced as additional inputs in the admin form. Each entry is a
     * camelCase attribute key on the underlying web component
     * (`buttonStyle`, `classname`, …) carrying:
     *   - `type`: `OPTION_TYPE_SELECT` or `OPTION_TYPE_TEXT`.
     *   - `label`: short admin label.
     *   - `description`: help-block prose under the input.
     *   - `default`: value used when the merchant has not customised it.
     *   - `choices` (select only): `{value: label}` map driving the `<option>`
     *     list. Submitted values not in the map fall back to `default`.
     *   - `max_length` (text only, optional): hard cap. Defaults to 200.
     *   - `pattern` (text only, optional): PCRE regex used to validate the
     *     submitted value; mismatches fall back to `default`. Default keeps
     *     the value within a CSS-class-safe character set.
     *
     * Resolved option values are forwarded as renderer attributes by
     * {@see FrakDisplayDispatcher::dispatch()} — the schema doubles as a
     * declaration of which renderer attributes are merchant-tunable.
     *
     * @var array<string, array{
     *     component: string,
     *     hook: string,
     *     config_key: string,
     *     default: bool,
     *     placement_attr: string,
     *     label: string,
     *     description: string,
     *     options?: array<string, array<string, mixed>>,
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
            'options' => [
                'buttonStyle' => self::SHARE_BUTTON_STYLE_OPTION,
            ],
        ],

        // Banner ———————————————————————————————————————————————————————
        'banner_top' => [
            'component' => self::COMPONENT_BANNER,
            'hook' => 'displayTop',
            'config_key' => 'FRAK_PLACEMENT_BANNER_TOP',
            'default' => true,
            'placement_attr' => 'top',
            'label' => 'Banner at the top of every page',
            'description' => 'Renders the referral / in-app browser banner above the storefront content. Auto-hides when the SDK has nothing to surface.',
            'options' => [
                'classname' => self::BANNER_CLASSNAME_OPTION,
            ],
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
     * Shared `buttonStyle` option schema for share-button placements. Pulled
     * out as a class constant so the two share-button placements stay in sync
     * — drift between `share_product` and `share_cart` would mean the same
     * "primary" preset rendered different output on each surface.
     *
     * Choices map 1:1 to {@see FrakComponentRenderer::SHARE_BUTTON_STYLE_CLASSES}
     * keys. Default preserves the existing pre-options behaviour
     * (`secondary` → `btn btn-secondary`) so untouched merchants see no visual
     * change on upgrade.
     *
     * @var array<string, mixed>
     */
    private const SHARE_BUTTON_STYLE_OPTION = [
        'type' => self::OPTION_TYPE_SELECT,
        'label' => 'Button style',
        'description' => 'Bootstrap preset prepended to the rendered share button\'s class attribute. Pick "None" when your theme styles the button via a custom selector.',
        'choices' => [
            'primary' => 'Primary (btn btn-primary)',
            'secondary' => 'Secondary (btn btn-secondary)',
            'none' => 'None (no Bootstrap classes)',
        ],
        'default' => 'secondary',
    ];

    /**
     * Shared `classname` option schema for banner placements. Forwarded to
     * the `<frak-banner classname="…">` attribute (which the SDK applies onto
     * the banner's outer DOM) so merchant theme CSS can target the auto-
     * rendered banner via a custom selector.
     *
     * Validation hardcodes a CSS-class-safe character set
     * (`[A-Za-z0-9_ -]`) — keeps merchants from accidentally injecting
     * markup or quotes via the admin form even though access is already
     * gated behind PrestaShop admin auth.
     *
     * @var array<string, mixed>
     */
    private const BANNER_CLASSNAME_OPTION = [
        'type' => self::OPTION_TYPE_TEXT,
        'label' => 'Custom CSS class',
        'description' => 'Appended to the rendered banner\'s class attribute (theme-specific styling hook). Letters, digits, spaces, dashes and underscores only.',
        'default' => '',
        'max_length' => 200,
        'pattern' => '/^[A-Za-z0-9 _-]*$/',
    ];

    /**
     * Per-request cache of the resolved per-placement state. Hydrated lazily
     * on the first read call and reset by {@see setState()} /
     * {@see clearAll()} / {@see resetCache()} so writes are visible to the
     * same request that issued them.
     *
     * Mirrors WordPress's `Frak_Settings::$cache`
     * ({@see plugins/wordpress/includes/class-frak-settings.php#L87}).
     *
     * @var array<string, array{enabled: bool, options: array<string, mixed>}>|null
     */
    private static ?array $stateCache = null;

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
     *     options?: array<string, array<string, mixed>>,
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
        $state = self::getResolvedState();
        return $state[$id]['enabled'];
    }

    /**
     * Resolved option map for a placement. Defaults from the option schema
     * are merged in so callers can pass the result straight to the renderer
     * without per-key fallback logic. Returns an empty array for placements
     * with no `options` declared.
     *
     * @return array<string, mixed>
     */
    public static function getOptions(string $id): array
    {
        if (!isset(self::PLACEMENTS[$id])) {
            return [];
        }
        $state = self::getResolvedState();
        return $state[$id]['options'];
    }

    /**
     * Single-key option lookup. Convenience wrapper over {@see getOptions()}
     * for callers that only need one value.
     *
     * @return mixed
     */
    public static function getOption(string $id, string $key)
    {
        $options = self::getOptions($id);
        return $options[$key] ?? null;
    }

    /**
     * Resolved `{placement_id: bool}` map for the current request. Kept for
     * callers (admin renderer, tests) that only need the boolean view.
     *
     * @return array<string, bool>
     */
    public static function getEnabledMap(): array
    {
        $state = self::getResolvedState();
        $map = [];
        foreach ($state as $id => $entry) {
            $map[$id] = $entry['enabled'];
        }
        return $map;
    }

    /**
     * Resolved per-placement state (enabled flag + option map). Hydrates the
     * per-request cache on first access and merges declared defaults so
     * callers can iterate every placement without missing keys.
     *
     * @return array<string, array{enabled: bool, options: array<string, mixed>}>
     */
    public static function getResolvedState(): array
    {
        if (self::$stateCache !== null) {
            return self::$stateCache;
        }

        $stored = self::loadStoredMap();
        $resolved = [];
        foreach (self::PLACEMENTS as $id => $placement) {
            $stored_entry = $stored[$id] ?? [];
            $resolved[$id] = [
                'enabled' => array_key_exists('enabled', $stored_entry)
                    ? (bool) $stored_entry['enabled']
                    : $placement['default'],
                'options' => self::resolveOptionValues(
                    $placement['options'] ?? [],
                    is_array($stored_entry['options'] ?? null) ? $stored_entry['options'] : []
                ),
            ];
        }
        self::$stateCache = $resolved;
        return $resolved;
    }

    /**
     * Persist a partial state update. Each entry can carry `enabled` and/or
     * `options`; unspecified keys preserve existing values so the admin form
     * can post only the placements it actually rendered without nuking the
     * rest. Unknown placements and unknown option keys are dropped silently.
     *
     * Drops the per-request cache so subsequent reads see the new values.
     *
     * @param array<string, array{enabled?: bool, options?: array<string, mixed>}> $updates
     */
    public static function setState(array $updates): bool
    {
        $stored = self::loadStoredMap();

        foreach ($updates as $id => $update) {
            if (!isset(self::PLACEMENTS[$id])) {
                continue;
            }
            $current = $stored[$id] ?? [];

            if (array_key_exists('enabled', $update)) {
                $current['enabled'] = (bool) $update['enabled'];
            }
            if (array_key_exists('options', $update) && is_array($update['options'])) {
                $existing_options = is_array($current['options'] ?? null) ? $current['options'] : [];
                $current['options'] = self::sanitizeOptionUpdates(
                    self::PLACEMENTS[$id]['options'] ?? [],
                    $existing_options,
                    $update['options']
                );
            }
            $stored[$id] = $current;
        }

        // Trim ghost entries (placements that were removed from PLACEMENTS
        // but linger in the stored map from a previous version).
        $stored = array_intersect_key($stored, self::PLACEMENTS);

        $encoded = json_encode($stored);
        if ($encoded === false) {
            return false;
        }
        $ok = (bool) Configuration::updateValue(self::STORAGE_KEY, $encoded);
        if ($ok) {
            self::$stateCache = null;
        }
        return $ok;
    }

    /**
     * Legacy enabled-only writer kept for callers that only need to flip
     * checkboxes. Internally folds into {@see setState()}.
     *
     * @param array<string, bool> $updates
     */
    public static function setEnabledMap(array $updates): bool
    {
        $shaped = [];
        foreach ($updates as $id => $value) {
            $shaped[$id] = ['enabled' => (bool) $value];
        }
        return self::setState($shaped);
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
            $defaults[$id] = [
                'enabled' => $placement['default'],
                'options' => self::extractDefaultOptions($placement['options'] ?? []),
            ];
        }
        $encoded = json_encode($defaults);
        if ($encoded !== false) {
            Configuration::updateValue(self::STORAGE_KEY, $encoded);
        }
        self::$stateCache = null;
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
        self::$stateCache = null;
    }

    /**
     * Decode the bundled storage row. Returns the raw `{id: entry}` map
     * with `entry` shaped as `{enabled: bool, options: array}`. Tolerates
     * three on-disk shapes:
     *
     *   - Current: `{id: {enabled: bool, options: {…}}}`.
     *   - Legacy boolean: `{id: bool}` — produced by an unreleased dev
     *     iteration that pre-dated the options system. Lifted in-memory
     *     to `{enabled: bool, options: {}}`; the next admin save
     *     persists the new shape.
     *   - Empty / malformed: returns `[]` so callers `?? $default` safely.
     *
     * Public-static because the upgrade migrator and the admin controller
     * both need to peek at the raw stored shape without going through the
     * defaults merge.
     *
     * @return array<string, array{enabled: bool, options: array<string, mixed>}>
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
            $string_id = (string) $id;
            if (is_bool($value)) {
                // Legacy boolean shape — lift to the new structure on read so
                // the rest of the codebase only sees one storage layout.
                $resolved[$string_id] = ['enabled' => $value, 'options' => []];
                continue;
            }
            if (!is_array($value)) {
                continue;
            }
            $resolved[$string_id] = [
                'enabled' => array_key_exists('enabled', $value) ? (bool) $value['enabled'] : false,
                'options' => is_array($value['options'] ?? null) ? $value['options'] : [],
            ];
        }
        return $resolved;
    }

    /**
     * Reset the per-request memo. Test-only — production callers should
     * never need this because writes go through {@see setState()} which
     * re-primes the cache. Exposed so PHPUnit tests that mutate the
     * underlying Configuration row directly can force a fresh load.
     */
    public static function resetCache(): void
    {
        self::$stateCache = null;
    }

    /**
     * Default-option map extractor. Walks the option schema and returns the
     * `{key: default}` map used by both {@see seedDefaults()} (write path)
     * and {@see resolveOptionValues()} (read path).
     *
     * @param array<string, array<string, mixed>> $option_schema
     * @return array<string, mixed>
     */
    private static function extractDefaultOptions(array $option_schema): array
    {
        $defaults = [];
        foreach ($option_schema as $key => $meta) {
            $defaults[$key] = $meta['default'] ?? null;
        }
        return $defaults;
    }

    /**
     * Merge stored option values with declared defaults. Drops any stored key
     * that is no longer in the schema (so renamed / removed options don't
     * leak to the renderer) and fills in defaults for keys the merchant has
     * not customised yet.
     *
     * @param array<string, array<string, mixed>> $option_schema
     * @param array<string, mixed>                $stored
     * @return array<string, mixed>
     */
    private static function resolveOptionValues(array $option_schema, array $stored): array
    {
        $resolved = [];
        foreach ($option_schema as $key => $meta) {
            $resolved[$key] = array_key_exists($key, $stored)
                ? $stored[$key]
                : ($meta['default'] ?? null);
        }
        return $resolved;
    }

    /**
     * Validate + merge a partial option update. Each schema-known key in
     * `$updates` is run through the matching validator (select choices /
     * text length + pattern); rejects fall back to the existing stored
     * value, or the schema default when none exists. Keys absent from the
     * update preserve their existing values.
     *
     * @param array<string, array<string, mixed>> $option_schema
     * @param array<string, mixed>                $existing
     * @param array<string, mixed>                $updates
     * @return array<string, mixed>
     */
    private static function sanitizeOptionUpdates(array $option_schema, array $existing, array $updates): array
    {
        $merged = $existing;
        foreach ($option_schema as $key => $meta) {
            if (!array_key_exists($key, $updates)) {
                continue;
            }
            $candidate = $updates[$key];
            $fallback = $existing[$key] ?? ($meta['default'] ?? null);

            $type = (string) ($meta['type'] ?? '');
            if ($type === self::OPTION_TYPE_SELECT) {
                $choices = is_array($meta['choices'] ?? null) ? $meta['choices'] : [];
                $value = is_string($candidate) || is_int($candidate) ? (string) $candidate : '';
                $merged[$key] = array_key_exists($value, $choices) ? $value : $fallback;
                continue;
            }
            if ($type === self::OPTION_TYPE_TEXT) {
                $merged[$key] = self::sanitizeTextOption($candidate, $meta, $fallback);
                continue;
            }
        }
        return $merged;
    }

    /**
     * Trim + length-cap + pattern-validate a text-input option value. Empty
     * strings are accepted (a blank `classname` is the natural way to opt
     * out). Anything that fails the regex falls back to the previous stored
     * value so a typo in the admin form doesn't silently overwrite a known-
     * good value with garbage.
     *
     * @param mixed                $candidate
     * @param array<string, mixed> $meta
     * @param mixed                $fallback
     * @return mixed
     */
    private static function sanitizeTextOption($candidate, array $meta, $fallback)
    {
        if (!is_string($candidate)) {
            return $fallback;
        }
        $trimmed = trim($candidate);
        $max_length = isset($meta['max_length']) ? (int) $meta['max_length'] : 200;
        if ($max_length > 0 && strlen($trimmed) > $max_length) {
            $trimmed = substr($trimmed, 0, $max_length);
        }
        $pattern = isset($meta['pattern']) ? (string) $meta['pattern'] : '';
        if ($pattern !== '' && preg_match($pattern, $trimmed) !== 1) {
            return $fallback;
        }
        return $trimmed;
    }
}
