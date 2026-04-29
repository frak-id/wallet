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
	 * Tag-specific HTML attributes injected alongside the bare `preview` flag
	 * when {@see wrap()} is called with `$preview = true`.
	 *
	 * `<frak-banner>` and `<frak-post-purchase>` both ship two preview
	 * variants (referral / in-app, referrer / referee) and require an explicit
	 * `preview-mode` / `preview-variant` HTML attribute to know which to
	 * paint — without it the component waits for a runtime context that
	 * never arrives in the editor iframe and renders blank. The Gutenberg
	 * editor scripts inject these defaults from JS (see
	 * `includes/blocks/banner/editor.js` + `includes/blocks/post-purchase/editor.js`);
	 * we mirror them here so every PHP-rendered preview surface (Elementor
	 * today, future REST / page-builder integrations tomorrow) gets the same
	 * out-of-the-box behaviour. `<frak-button-share>` is intentionally absent
	 * — `preview` alone is enough for it.
	 *
	 * @var array<string, array<string, string>>
	 */
	private const PREVIEW_DEFAULT_ATTRS = array(
		'frak-banner'        => array(
			'preview-mode' => 'referral',
		),
		'frak-post-purchase' => array(
			'preview-variant' => 'referrer',
		),
	);

	/**
	 * Render `<frak-banner>` with the supplied attributes.
	 *
	 * @param array<string, mixed>  $attrs             Map of camelCase attribute keys.
	 * @param string                $wrapper           Pre-escaped wrapper attributes (typically from `get_block_wrapper_attributes()`); empty emits the web component without a surrounding div.
	 * @param bool                  $preview           When true emit a bare `preview` HTML attribute on the web component so it bypasses backend RPC gates and renders its preview state. Used by the Elementor widget when rendering inside the editor iframe — the Gutenberg path injects `preview` from JS instead.
	 * @param array<string, string> $preview_overrides Optional companion attributes that override {@see PREVIEW_DEFAULT_ATTRS}. Currently used to forward the merchant-selected `preview-mode` from the Elementor widget's *Editor preview* SELECT control. Ignored when `$preview = false`.
	 * @return string
	 */
	public static function banner( array $attrs, string $wrapper = '', bool $preview = false, array $preview_overrides = array() ): string {
		return self::render( 'frak-banner', self::BANNER_ATTRS, self::merge_classnames( $attrs ), $wrapper, $preview, $preview_overrides );
	}

	/**
	 * Render `<frak-button-share>` with the supplied attributes.
	 *
	 * @param array<string, mixed> $attrs   Map of camelCase attribute keys.
	 * @param string               $wrapper Pre-escaped wrapper attributes; empty emits the component bare.
	 * @param bool                 $preview When true emit the bare `preview` HTML attribute (Elementor editor render path).
	 * @return string
	 */
	public static function share_button( array $attrs, string $wrapper = '', bool $preview = false ): string {
		return self::render( 'frak-button-share', self::SHARE_BUTTON_ATTRS, self::apply_share_button_style( self::merge_classnames( $attrs ) ), $wrapper, $preview );
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
	 * Merge Gutenberg's standard `className` (capital N — populated by the
	 * Advanced → "Additional CSS Class(es)" panel) into our SDK-side
	 * `classname` (lowercase) attribute so the merchant's class lands on the
	 * inner web component DOM alongside the BEM hooks
	 * (`.frak-banner__title`, `.frak-banner__cta`, etc.) where merchant theme
	 * CSS can actually target it. The wrapper `<div>` keeps the class too via
	 * {@see get_block_wrapper_attributes()} — duplication is intentional so
	 * descendant selectors like `.merchant-class .frak-banner__title { … }`
	 * match regardless of which scope the merchant aimed at.
	 *
	 * Pre-existing posts that set the legacy `classname` attribute via the
	 * (now-removed) inspector field keep working: both values are joined and
	 * forwarded.
	 *
	 * `className` is unset from the returned array so it doesn't leak to the
	 * web component as an unknown HTML attribute.
	 *
	 * @param array<string, mixed> $attrs Raw camelCase attribute map.
	 * @return array<string, mixed>
	 */
	private static function merge_classnames( array $attrs ): array {
		$wp_class = isset( $attrs['className'] ) ? trim( (string) $attrs['className'] ) : '';
		$legacy   = isset( $attrs['classname'] ) ? trim( (string) $attrs['classname'] ) : '';
		unset( $attrs['className'] );

		if ( '' === $wp_class ) {
			return $attrs;
		}
		$attrs['classname'] = '' === $legacy ? $wp_class : $wp_class . ' ' . $legacy;
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
	 * @param array<string, mixed>  $attrs             Map of camelCase attribute keys.
	 * @param string                $wrapper           Pre-escaped wrapper attributes; empty emits the component bare.
	 * @param bool                  $preview           When true emit the bare `preview` HTML attribute (Elementor editor render path).
	 * @param array<string, string> $preview_overrides Optional companion attributes that override {@see PREVIEW_DEFAULT_ATTRS}. Currently used to forward the merchant-selected `preview-variant` from the Elementor widget's *Editor preview* SELECT control. Ignored when `$preview = false`.
	 * @return string
	 */
	public static function post_purchase( array $attrs, string $wrapper = '', bool $preview = false, array $preview_overrides = array() ): string {
		$show_products = self::should_show_products( $attrs );
		$html_attrs    = self::build_html_attrs( self::POST_PURCHASE_ATTRS, self::merge_classnames( $attrs ) );

		if ( class_exists( 'Frak_WooCommerce' ) ) {
			// Single-pass resolution: one `is_wc_endpoint_url()` + one
			// `wc_get_order()` covers both the context (customer/order/token)
			// and the optional product gallery, instead of resolving the
			// order twice when both pieces are needed.
			$data = Frak_WooCommerce::get_post_purchase_data( $show_products );
			if ( null !== $data ) {
				foreach ( $data['context'] as $html_attr => $value ) {
					$html_attrs[] = sprintf( '%s="%s"', esc_attr( $html_attr ), esc_attr( $value ) );
				}

				// Forward order line items to the SDK so the sharing page can
				// show product cards. Sent as a JSON-stringified attribute
				// because `preact-custom-element` only delivers attribute
				// values as strings; the component parses it back into an
				// array on mount. Skipped when `showProducts` is explicitly
				// disabled, when the request is not on an order endpoint, or
				// when the order has no resolvable products.
				if ( null !== $data['products'] ) {
					$json = wp_json_encode( $data['products'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
					if ( is_string( $json ) ) {
						$html_attrs[] = sprintf( 'products="%s"', esc_attr( $json ) );
					}
				}
			}
		}

		return self::wrap( 'frak-post-purchase', $html_attrs, $wrapper, $preview, $preview_overrides );
	}

	/**
	 * Whether order products should be auto-injected into the rendered
	 * `<frak-post-purchase>` markup. Defaults to true — merchants opt out by
	 * setting the block attribute / shortcode parameter / widget field to a
	 * recognisable falsy value.
	 *
	 * Returns true when the key is missing, null, or an empty string so the
	 * default-on behaviour survives older block instances saved before this
	 * attribute existed and shortcodes that pass `show_products=""`. String
	 * inputs are trimmed + lower-cased before matching against the falsy set
	 * `{0, false, no, off}` so trailing whitespace from copy-paste does not
	 * silently flip the toggle.
	 *
	 * @param array<string, mixed> $attrs Block attribute values.
	 * @return bool
	 */
	private static function should_show_products( array $attrs ): bool {
		if ( ! array_key_exists( 'showProducts', $attrs ) ) {
			return true;
		}
		$value = $attrs['showProducts'];
		// Treat null and the empty string as "unset" so they preserve the
		// default-true behaviour rather than silently disabling products.
		if ( null === $value ) {
			return true;
		}
		if ( false === $value ) {
			return false;
		}
		if ( is_string( $value ) ) {
			$normalised = strtolower( trim( $value ) );
			if ( '' === $normalised ) {
				return true;
			}
			return ! in_array( $normalised, array( '0', 'false', 'no', 'off' ), true );
		}
		if ( is_int( $value ) ) {
			return 0 !== $value;
		}
		return (bool) $value;
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
	 * @param string                $tag               Web component tag name.
	 * @param array<string,string>  $map               Block-attr => HTML-attr map.
	 * @param array<string, mixed>  $attrs             Block attribute values.
	 * @param string                $wrapper           Wrapper attributes string.
	 * @param bool                  $preview           Whether to emit a bare `preview` attribute on the web component.
	 * @param array<string, string> $preview_overrides Optional companion attributes that override {@see PREVIEW_DEFAULT_ATTRS}. Ignored when `$preview = false`.
	 * @return string
	 */
	private static function render( string $tag, array $map, array $attrs, string $wrapper, bool $preview = false, array $preview_overrides = array() ): string {
		return self::wrap( $tag, self::build_html_attrs( $map, $attrs ), $wrapper, $preview, $preview_overrides );
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
	 * `$preview = true` prepends `preview="true"` plus any tag-specific
	 * companion attributes from {@see PREVIEW_DEFAULT_ATTRS} so the web
	 * component renders its preview state without waiting for a runtime
	 * context. The string-valued `"true"` is intentional: every component
	 * (`<frak-banner>`, `<frak-post-purchase>`, `<frak-button-share>`)
	 * computes `isPreview = !!preview` against the prop value, and a bare
	 * `preview` HTML attribute deserialises to an empty string in the DOM
	 * — falsy under `!!`. Matches what the Gutenberg `editor.js` paths
	 * (`includes/blocks/banner/editor.js`, `…/post-purchase/editor.js`,
	 * `…/share-button/editor.js`) already emit (`preview: 'true'`).
	 *
	 * Caller-supplied `$preview_overrides` take precedence over the per-tag
	 * defaults so the Elementor widget can forward the merchant's *Editor
	 * preview* SELECT choice (e.g. `preview-mode → inapp`) while unconfigured
	 * surfaces still render the default referral / referrer variant.
	 *
	 * @param string                $tag               Web component tag name.
	 * @param string[]              $html_attrs        Already-escaped attribute pairs.
	 * @param string                $wrapper           Wrapper attributes (pre-escaped by WordPress).
	 * @param bool                  $preview           Whether to emit `preview="true"` on the web component.
	 * @param array<string, string> $preview_overrides Caller-supplied companion attributes that override the per-tag defaults from {@see PREVIEW_DEFAULT_ATTRS}. Ignored when `$preview = false`.
	 * @return string
	 */
	private static function wrap( string $tag, array $html_attrs, string $wrapper, bool $preview = false, array $preview_overrides = array() ): string {
		if ( $preview ) {
			$defaults  = isset( self::PREVIEW_DEFAULT_ATTRS[ $tag ] ) ? self::PREVIEW_DEFAULT_ATTRS[ $tag ] : array();
			$effective = array_merge( $defaults, $preview_overrides );

			$preview_pairs = array( 'preview="true"' );
			foreach ( $effective as $attr_name => $attr_value ) {
				$preview_pairs[] = sprintf( '%s="%s"', esc_attr( $attr_name ), esc_attr( (string) $attr_value ) );
			}
			$html_attrs = array_merge( $preview_pairs, $html_attrs );
		}
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
