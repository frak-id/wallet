<?php
/**
 * Shared component renderer for Frak web components.
 *
 * Produces the `<frak-X {attrs}>` markup (optionally wrapped in a `<div>`)
 * consumed by the block `render.php` files, the `[frak_*]` shortcodes, and
 * the sidebar widgets. Single source of truth for attribute → HTML mapping
 * so every insertion surface emits identical output.
 *
 * Callers pass camelCase attribute keys matching each block's `block.json`
 * Surfaces driven by snake_case inputs (shortcodes, widgets) normalise keys
 * at their boundary via {@see snake_keys_to_camel()} before calling.
 *
 * Block render.php passes a pre-escaped `get_block_wrapper_attributes()`
 * string so the rendered div picks up `align*` / `className` support. The
 * shortcode + widget paths pass an empty wrapper so the bare web component
 * is emitted with no surrounding markup — the block's editor semantics are
 * not meaningful in those contexts.
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_Component_Renderer
 */
class Frak_Component_Renderer {

	/**
	 * Banner: camelCase block-attr key => kebab-case HTML attribute name.
	 *
	 * @var array<string, string>
	 */
	private const BANNER_ATTRS = array(
		'placement'           => 'placement',
		'classname'           => 'classname',
		'interaction'         => 'interaction',
		'referralTitle'       => 'referral-title',
		'referralDescription' => 'referral-description',
		'referralCta'         => 'referral-cta',
		'inappTitle'          => 'inapp-title',
		'inappDescription'    => 'inapp-description',
		'inappCta'            => 'inapp-cta',
	);

	/**
	 * Share-button: camelCase block-attr key => kebab-case HTML attribute name.
	 *
	 * @var array<string, string>
	 */
	private const SHARE_BUTTON_ATTRS = array(
		'text'              => 'text',
		'placement'         => 'placement',
		'classname'         => 'classname',
		'useReward'         => 'use-reward',
		'noRewardText'      => 'no-reward-text',
		'targetInteraction' => 'target-interaction',
		'clickAction'       => 'click-action',
	);

	/**
	 * WordPress-native button style presets. The `buttonStyle` attribute
	 * doesn't map to an HTML attribute on the web component — it's a
	 * plugin-side convenience that prepends WordPress core button classes
	 * onto the `classname` so the rendered `<button>` picks up the
	 * merchant theme's button styling (via `wp-element-button` applied by
	 * `theme.json` on WP 5.9+) without the merchant having to type the
	 * class names manually.
	 *
	 * `wp-element-button` alone triggers theme.json button colours;
	 * combining with `wp-block-button__link` picks up Button-block styling
	 * including the `is-style-outline` variation.
	 *
	 * @var array<string, string>
	 */
	private const SHARE_BUTTON_STYLE_CLASSES = array(
		'primary'   => 'wp-element-button wp-block-button__link',
		'secondary' => 'wp-element-button wp-block-button__link is-style-outline',
		'none'      => '',
	);

	/**
	 * Post-purchase: camelCase block-attr key => kebab-case HTML attribute name.
	 *
	 * @var array<string, string>
	 */
	private const POST_PURCHASE_ATTRS = array(
		'sharingUrl'   => 'sharing-url',
		'merchantId'   => 'merchant-id',
		'placement'    => 'placement',
		'classname'    => 'classname',
		'variant'      => 'variant',
		'badgeText'    => 'badge-text',
		'referrerText' => 'referrer-text',
		'refereeText'  => 'referee-text',
		'ctaText'      => 'cta-text',
	);

	/**
	 * Attribute names rendered as bare presence attributes when truthy. The
	 * web components treat `<frak-x use-reward>` as an "on" toggle — emitting
	 * `use-reward="1"` would coerce to the string "1" which some components
	 * treat as text content, not a toggle.
	 *
	 * @var string[]
	 */
	private const BOOLEAN_HTML_ATTRS = array(
		'use-reward',
	);

	/**
	 * Render `<frak-banner>` with the supplied attributes.
	 *
	 * @param array<string, mixed> $attrs   Map of camelCase attribute keys.
	 * @param string               $wrapper Pre-escaped wrapper attributes (typically from `get_block_wrapper_attributes()`); empty emits the web component without a surrounding div.
	 * @return string
	 */
	public static function banner( array $attrs, string $wrapper = '' ): string {
		return self::render( 'frak-banner', self::BANNER_ATTRS, $attrs, $wrapper );
	}

	/**
	 * Render `<frak-button-share>` with the supplied attributes.
	 *
	 * @param array<string, mixed> $attrs   Map of camelCase attribute keys.
	 * @param string               $wrapper Pre-escaped wrapper attributes; empty emits the component bare.
	 * @return string
	 */
	public static function share_button( array $attrs, string $wrapper = '' ): string {
		return self::render( 'frak-button-share', self::SHARE_BUTTON_ATTRS, self::apply_share_button_style( $attrs ), $wrapper );
	}

	/**
	 * Prepend the WordPress button-style classes onto `classname` based on
	 * the caller-supplied `buttonStyle` preset. A missing or empty
	 * `buttonStyle` falls back to `primary` so every surface (block,
	 * widget, shortcode) picks up WP-native styling out of the box;
	 * merchants opt out by passing `buttonStyle => 'none'`. Unknown
	 * presets are treated as a no-op. `buttonStyle` is stripped from the
	 * returned array so it never leaks to the HTML as an unknown
	 * attribute on the web component.
	 *
	 * @param array<string, mixed> $attrs Raw camelCase attribute map.
	 * @return array<string, mixed>
	 */
	private static function apply_share_button_style( array $attrs ): array {
		$style = ( isset( $attrs['buttonStyle'] ) && '' !== $attrs['buttonStyle'] ) ? (string) $attrs['buttonStyle'] : 'primary';
		unset( $attrs['buttonStyle'] );

		$style_classes = isset( self::SHARE_BUTTON_STYLE_CLASSES[ $style ] ) ? self::SHARE_BUTTON_STYLE_CLASSES[ $style ] : '';
		if ( '' === $style_classes ) {
			return $attrs;
		}

		$existing           = isset( $attrs['classname'] ) ? trim( (string) $attrs['classname'] ) : '';
		$attrs['classname'] = '' === $existing ? $style_classes : $style_classes . ' ' . $existing;
		return $attrs;
	}

	/**
	 * Render `<frak-post-purchase>` with the supplied attributes.
	 *
	 * When the current request is on a WooCommerce order endpoint the
	 * server-resolved context (customer-id / order-id / token) is appended
	 * to the HTML attributes so the web component can fire
	 * `trackPurchaseStatus` on mount. The inline `woocommerce_thankyou`
	 * fallback in {@see Frak_WooCommerce::render_purchase_tracker_for_order()}
	 * also fires with the same triple; the SDK is idempotent on
	 * `(customerId, orderId, token)` so the duplicate is intentional — it
	 * keeps attribution working when either surface is missing (block
	 * absent on a custom template, or block present but SDK still warming).
	 *
	 * Identical auto-injection logic to the previous in-render-file code, just
	 * centralised here so the shortcode and widget surfaces benefit too.
	 *
	 * @param array<string, mixed> $attrs   Map of camelCase attribute keys.
	 * @param string               $wrapper Pre-escaped wrapper attributes; empty emits the component bare.
	 * @return string
	 */
	public static function post_purchase( array $attrs, string $wrapper = '' ): string {
		$html_attrs = self::build_html_attrs( self::POST_PURCHASE_ATTRS, $attrs );

		if ( class_exists( 'Frak_WooCommerce' ) ) {
			$context = Frak_WooCommerce::get_order_context();
			if ( null !== $context ) {
				foreach ( $context as $html_attr => $value ) {
					$html_attrs[] = sprintf( '%s="%s"', esc_attr( $html_attr ), esc_attr( $value ) );
				}
			}
		}

		return self::wrap( 'frak-post-purchase', $html_attrs, $wrapper );
	}

	/**
	 * Normalise snake_case array keys to camelCase.
	 *
	 * Shortcode parser and widget form inputs arrive with snake_case keys
	 * (`referral_title`); the renderer + block attribute schema use camelCase
	 * (`referralTitle`). Callers pipe raw input through this helper before
	 * handing it to a `render_*` method.
	 *
	 * Keys without underscores are passed through unchanged so camelCase
	 * input (e.g. a widget storing settings in block-shape) still works.
	 *
	 * @param array<string, mixed> $attrs Arbitrary attribute map.
	 * @return array<string, mixed>
	 */
	public static function snake_keys_to_camel( array $attrs ): array {
		$normalized = array();
		foreach ( $attrs as $key => $value ) {
			if ( false === strpos( $key, '_' ) ) {
				$normalized[ $key ] = $value;
				continue;
			}
			$parts     = explode( '_', $key );
			$camel_key = array_shift( $parts );
			foreach ( $parts as $part ) {
				$camel_key .= ucfirst( $part );
			}
			$normalized[ $camel_key ] = $value;
		}
		return $normalized;
	}

	/**
	 * Internal: build the escaped attribute pairs then wrap.
	 *
	 * @param string               $tag     Web component tag name.
	 * @param array<string,string> $map     Block-attr => HTML-attr map.
	 * @param array<string, mixed> $attrs   Block attribute values.
	 * @param string               $wrapper Wrapper attributes string.
	 * @return string
	 */
	private static function render( string $tag, array $map, array $attrs, string $wrapper ): string {
		return self::wrap( $tag, self::build_html_attrs( $map, $attrs ), $wrapper );
	}

	/**
	 * Convert a block-attr map into escaped `name="value"` pairs.
	 *
	 * Skips keys that are absent / null / empty-string. Boolean HTML attrs
	 * listed in {@see BOOLEAN_HTML_ATTRS} are emitted bare (presence = true,
	 * absence = false) rather than as `key="value"`.
	 *
	 * @param array<string,string> $map   Block-attr => HTML-attr map.
	 * @param array<string, mixed> $attrs Block attribute values.
	 * @return string[] Escaped attribute pairs.
	 */
	private static function build_html_attrs( array $map, array $attrs ): array {
		$pairs = array();
		foreach ( $map as $block_key => $html_attr ) {
			if ( ! array_key_exists( $block_key, $attrs ) ) {
				continue;
			}
			$value = $attrs[ $block_key ];

			if ( in_array( $html_attr, self::BOOLEAN_HTML_ATTRS, true ) ) {
				if ( self::is_truthy( $value ) ) {
					$pairs[] = esc_attr( $html_attr );
				}
				continue;
			}

			if ( '' === $value || null === $value ) {
				continue;
			}

			$pairs[] = sprintf( '%s="%s"', esc_attr( $html_attr ), esc_attr( (string) $value ) );
		}
		return $pairs;
	}

	/**
	 * Assemble the final markup.
	 *
	 * When `$wrapper` is non-empty the web component is enclosed in a
	 * `<div {wrapper}>` (block path). When empty the bare web component is
	 * emitted (shortcode / widget path).
	 *
	 * @param string   $tag        Web component tag name.
	 * @param string[] $html_attrs Already-escaped attribute pairs.
	 * @param string   $wrapper    Wrapper attributes (pre-escaped by WordPress).
	 * @return string
	 */
	private static function wrap( string $tag, array $html_attrs, string $wrapper ): string {
		$attr_string   = implode( ' ', $html_attrs );
		$attr_fragment = '' !== $attr_string ? ' ' . $attr_string : '';

		if ( '' !== $wrapper ) {
			return sprintf( '<div %1$s><%2$s%3$s></%2$s></div>', $wrapper, $tag, $attr_fragment );
		}
		return sprintf( '<%1$s%2$s></%1$s>', $tag, $attr_fragment );
	}

	/**
	 * Coerce a raw value into a boolean.
	 *
	 * Shortcodes pass every attribute as a string, so `"1" / "true" / "yes" /
	 * "on"` must all map to true. Block boolean attrs arrive as real booleans
	 * already.
	 *
	 * @param mixed $value Raw value.
	 * @return bool
	 */
	private static function is_truthy( $value ): bool {
		if ( is_bool( $value ) ) {
			return $value;
		}
		if ( is_string( $value ) ) {
			return in_array( strtolower( $value ), array( '1', 'true', 'yes', 'on' ), true );
		}
		return (bool) $value;
	}
}
