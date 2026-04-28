<?php

/**
 * Shared component renderer for Frak web components.
 *
 * Produces the `<frak-X {attrs}>` markup consumed by PrestaShop hooks
 * (`displayProductAdditionalInfo`, `displayOrderConfirmation`, …). Single
 * source of truth for attribute → HTML mapping so every hook surface
 * emits identical output.
 *
 * Mirrors `Frak_Component_Renderer` in the WordPress plugin — same
 * camelCase attr keys, same tag names, same `buttonStyle` preset
 * abstraction (PrestaShop's bootstrap classes substitute for WP's
 * `wp-element-button`).
 *
 * Callers pass camelCase attribute keys; the renderer normalises them to
 * kebab-case HTML attributes per the per-component map below.
 */
class FrakComponentRenderer
{
    /**
     * Banner: camelCase attr key => kebab-case HTML attribute name.
     *
     * @var array<string, string>
     */
    private const BANNER_ATTRS = [
        'placement' => 'placement',
        'classname' => 'classname',
        'interaction' => 'interaction',
        'referralTitle' => 'referral-title',
        'referralDescription' => 'referral-description',
        'referralCta' => 'referral-cta',
        'inappTitle' => 'inapp-title',
        'inappDescription' => 'inapp-description',
        'inappCta' => 'inapp-cta',
    ];

    /**
     * Share-button: camelCase attr key => kebab-case HTML attribute name.
     *
     * @var array<string, string>
     */
    private const SHARE_BUTTON_ATTRS = [
        'text' => 'text',
        'placement' => 'placement',
        'classname' => 'classname',
        'useReward' => 'use-reward',
        'noRewardText' => 'no-reward-text',
        'targetInteraction' => 'target-interaction',
        'clickAction' => 'click-action',
    ];

    /**
     * PrestaShop button-style presets. The `buttonStyle` attribute does not
     * map to an HTML attribute on the web component — it is a plugin-side
     * convenience that prepends Bootstrap button classes onto `classname`
     * so the rendered button picks up the merchant theme's Bootstrap
     * styling without the merchant having to type the class names manually.
     *
     * Kept parallel with the WordPress plugin's
     * `Frak_Component_Renderer::SHARE_BUTTON_STYLE_CLASSES` (which uses
     * `wp-element-button wp-block-button__link` instead). Default preset
     * is `secondary` to preserve the visual baseline of the legacy
     * PrestaShop module (which hard-coded `btn btn-secondary`).
     *
     * @var array<string, string>
     */
    private const SHARE_BUTTON_STYLE_CLASSES = [
        'primary' => 'btn btn-primary',
        'secondary' => 'btn btn-secondary',
        'none' => '',
    ];

    /**
     * Post-purchase: camelCase attr key => kebab-case HTML attribute name.
     *
     * `customerId`, `orderId`, `token` are listed alongside the public
     * SDK attrs because the PrestaShop `displayOrderConfirmation` hook
     * supplies them directly from the resolved Order object — no
     * separate context-resolution helper is needed (unlike the WP plugin,
     * which extracts them from the WC endpoint via
     * `Frak_WooCommerce::get_post_purchase_data()`).
     *
     * @var array<string, string>
     */
    private const POST_PURCHASE_ATTRS = [
        'sharingUrl' => 'sharing-url',
        'merchantId' => 'merchant-id',
        'placement' => 'placement',
        'classname' => 'classname',
        'variant' => 'variant',
        'badgeText' => 'badge-text',
        'referrerText' => 'referrer-text',
        'refereeText' => 'referee-text',
        'ctaText' => 'cta-text',
        'customerId' => 'customer-id',
        'orderId' => 'order-id',
        'token' => 'token',
    ];

    /**
     * Attribute names rendered as bare presence attributes when truthy.
     * The web components treat `<frak-x use-reward>` as an "on" toggle —
     * emitting `use-reward="1"` would coerce to the string "1" which some
     * components treat as text content, not a toggle.
     *
     * @var string[]
     */
    private const BOOLEAN_HTML_ATTRS = [
        'use-reward',
    ];

    /**
     * Render `<frak-banner>` with the supplied attributes.
     *
     * @param array<string, mixed> $attrs Map of camelCase attribute keys.
     */
    public static function banner(array $attrs = []): string
    {
        return self::render('frak-banner', self::BANNER_ATTRS, $attrs);
    }

    /**
     * Render `<frak-button-share>` with the supplied attributes. Applies a
     * default `buttonStyle = secondary` preset so the share button picks
     * up Bootstrap styling out of the box; merchants opt out by passing
     * `'buttonStyle' => 'none'` or override by passing `'primary'`.
     *
     * @param array<string, mixed> $attrs Map of camelCase attribute keys.
     */
    public static function shareButton(array $attrs = []): string
    {
        return self::render(
            'frak-button-share',
            self::SHARE_BUTTON_ATTRS,
            self::applyShareButtonStyle($attrs)
        );
    }

    /**
     * Render `<frak-post-purchase>` with the supplied attributes. The
     * caller (typically the `displayOrderConfirmation` hook) supplies
     * `customerId`, `orderId`, `token` directly — no endpoint resolution
     * required.
     *
     * @param array<string, mixed> $attrs Map of camelCase attribute keys.
     */
    public static function postPurchase(array $attrs = []): string
    {
        return self::render('frak-post-purchase', self::POST_PURCHASE_ATTRS, $attrs);
    }

    /**
     * Prepend Bootstrap button-style classes onto `classname` based on the
     * caller-supplied `buttonStyle` preset. A missing or empty
     * `buttonStyle` falls back to `secondary` so every render path picks
     * up Bootstrap styling out of the box. `buttonStyle` is stripped from
     * the returned array so it never leaks to the HTML as an unknown
     * attribute on the web component.
     *
     * @param array<string, mixed> $attrs Raw camelCase attribute map.
     * @return array<string, mixed>
     */
    private static function applyShareButtonStyle(array $attrs): array
    {
        $style = (isset($attrs['buttonStyle']) && $attrs['buttonStyle'] !== '')
            ? (string) $attrs['buttonStyle']
            : 'secondary';
        unset($attrs['buttonStyle']);

        $style_classes = self::SHARE_BUTTON_STYLE_CLASSES[$style] ?? '';
        if ($style_classes === '') {
            return $attrs;
        }

        $existing = isset($attrs['classname']) ? trim((string) $attrs['classname']) : '';
        $attrs['classname'] = $existing === '' ? $style_classes : $style_classes . ' ' . $existing;
        return $attrs;
    }

    /**
     * Internal: build the escaped attribute pairs then assemble the markup.
     *
     * @param array<string, string> $map   camelCase => kebab-case map.
     * @param array<string, mixed>  $attrs Block attribute values.
     */
    private static function render(string $tag, array $map, array $attrs): string
    {
        $pairs = self::buildHtmlAttrs($map, $attrs);
        $attr_string = implode(' ', $pairs);
        $attr_fragment = $attr_string !== '' ? ' ' . $attr_string : '';
        return sprintf('<%1$s%2$s></%1$s>', $tag, $attr_fragment);
    }

    /**
     * Convert an attr map into escaped `name="value"` pairs.
     *
     * Skips keys that are absent / null / empty-string. Boolean HTML attrs
     * listed in `BOOLEAN_HTML_ATTRS` are emitted bare (presence = true,
     * absence = false) rather than as `key="value"`.
     *
     * @param array<string, string> $map   camelCase => kebab-case map.
     * @param array<string, mixed>  $attrs Attribute values.
     * @return string[]
     */
    private static function buildHtmlAttrs(array $map, array $attrs): array
    {
        $pairs = [];
        foreach ($map as $key => $html_attr) {
            if (!array_key_exists($key, $attrs)) {
                continue;
            }
            $value = $attrs[$key];

            if (in_array($html_attr, self::BOOLEAN_HTML_ATTRS, true)) {
                if (self::isTruthy($value)) {
                    $pairs[] = htmlspecialchars($html_attr, ENT_QUOTES, 'UTF-8');
                }
                continue;
            }

            if ($value === '' || $value === null) {
                continue;
            }

            $pairs[] = sprintf(
                '%s="%s"',
                htmlspecialchars($html_attr, ENT_QUOTES, 'UTF-8'),
                htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8')
            );
        }
        return $pairs;
    }

    /**
     * Coerce a raw value into a boolean. Mirrors WP's handling so the two
     * plugins agree on the same truthy set.
     *
     * @param mixed $value Raw value.
     */
    private static function isTruthy($value): bool
    {
        if (is_bool($value)) {
            return $value;
        }
        if (is_string($value)) {
            return in_array(strtolower($value), ['1', 'true', 'yes', 'on'], true);
        }
        return (bool) $value;
    }
}
