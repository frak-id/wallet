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
 *     1:1 to a `FRAK_PLACEMENT_<ID>` Configuration row.
 *   - The Smarty function plugins (`{frak_banner}`, …) reuse the same
 *     `placement` attribute strings the auto-render hooks emit, so backend
 *     placement-config in `business.frak.id` only has to know about the
 *     storefront-side identifiers listed below.
 *
 * Adding a new placement is a single-line entry here plus a matching
 * `hookXxx()` callback on `FrakIntegration`. Removing one is symmetric (drop
 * the entry; bump `SETTINGS_VERSION` so the install path
 * `Configuration::deleteByName()`s the dead row).
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
     * Authoritative placement list. Keys are stable identifiers used in the
     * Configuration table (prefixed with `FRAK_PLACEMENT_`). Hook strings
     * match PrestaShop's `display*` family verbatim — `registerHook()` strips
     * the `hook` prefix so we keep the canonical PrestaShop names here.
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
        'share_cart' => [
            'component' => self::COMPONENT_SHARE_BUTTON,
            'hook' => 'displayShoppingCart',
            'config_key' => 'FRAK_PLACEMENT_SHARE_CART',
            'default' => false,
            'placement_attr' => 'cart',
            'label' => 'Share button on the shopping cart',
            'description' => 'Adds the share button to the cart summary. Useful for "share your cart" referral flows.',
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
        'banner_home' => [
            'component' => self::COMPONENT_BANNER,
            'hook' => 'displayHome',
            'config_key' => 'FRAK_PLACEMENT_BANNER_HOME',
            'default' => false,
            'placement_attr' => 'home',
            'label' => 'Banner on the homepage',
            'description' => 'Renders the banner inside the home page hook only — keeps the rest of the storefront unchanged.',
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
     * declared default when the row is absent (fresh install or upgrade
     * before the migrator ran).
     */
    public static function isEnabled(string $id): bool
    {
        if (!isset(self::PLACEMENTS[$id])) {
            return false;
        }
        $row = Configuration::get(self::PLACEMENTS[$id]['config_key']);
        if ($row === false || $row === null || $row === '') {
            return self::PLACEMENTS[$id]['default'];
        }
        return (bool) $row;
    }

    /**
     * Seed every placement's Configuration row with its declared default.
     * Called from `install()` and from the settings migrator so existing
     * installs pick up newly-added placements without overwriting merchant
     * choices on previously-stored ones (`updateValue` is a no-op when the
     * value already exists at the requested string representation, but we
     * use `Configuration::hasKey()` to be explicit).
     */
    public static function seedDefaults(): void
    {
        foreach (self::PLACEMENTS as $placement) {
            if (!Configuration::hasKey($placement['config_key'])) {
                Configuration::updateValue($placement['config_key'], $placement['default'] ? '1' : '0');
            }
        }
    }

    /**
     * Wipe every placement's Configuration row. Called from `uninstall()`.
     */
    public static function clearAll(): void
    {
        foreach (self::PLACEMENTS as $placement) {
            Configuration::deleteByName($placement['config_key']);
        }
    }
}
