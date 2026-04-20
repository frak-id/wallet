<?php
/**
 * Shortcode surface for Frak web components.
 *
 * Provides `[frak_banner]`, `[frak_share_button]` and `[frak_post_purchase]`
 * so Classic Editor (TinyMCE) users, page builders (Elementor, Beaver, WPBakery),
 * and theme/plugin authors calling `do_shortcode()` from PHP templates can
 * drop Frak components anywhere, without depending on the block editor.
 *
 * Attribute names follow WP's snake_case convention (e.g. `referral_title`)
 * and are normalised to the renderer's camelCase keys at the boundary via
 * {@see Frak_Component_Renderer::snake_keys_to_camel()}. Boolean attributes
 * (currently `use_reward` on the share button) accept `"1" / "true" / "yes"
 * / "on"` — the renderer coerces them to real booleans.
 *
 * Shortcodes are registered unconditionally in every non-CLI request context
 * (via {@see Frak_Plugin::init()}) because `add_shortcode()` only attaches a
 * callback to the tag registry — the handler is invoked lazily, when the
 * post parser actually encounters the tag. Registering on admin requests is
 * cheap and lets preview / editor iframes render the same output.
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_Shortcodes
 */
class Frak_Shortcodes {

	/**
	 * Register the three shortcode handlers. Called once from
	 * {@see Frak_Plugin::init()}.
	 */
	public static function init() {
		add_shortcode( 'frak_banner', array( __CLASS__, 'render_banner' ) );
		add_shortcode( 'frak_share_button', array( __CLASS__, 'render_share_button' ) );
		add_shortcode( 'frak_post_purchase', array( __CLASS__, 'render_post_purchase' ) );
	}

	/**
	 * `[frak_banner placement="top" referral_title="Welcome!" ...]`
	 *
	 * @param array<string, string>|string $atts Shortcode attributes (WP passes `''` when none supplied).
	 * @return string
	 */
	public static function render_banner( $atts ): string {
		if ( ! self::is_renderable_context() ) {
			return '';
		}
		return Frak_Component_Renderer::banner( self::normalize( $atts ) );
	}

	/**
	 * `[frak_share_button text="Share & earn" use_reward="1" click_action="share-modal"]`
	 *
	 * @param array<string, string>|string $atts Shortcode attributes.
	 * @return string
	 */
	public static function render_share_button( $atts ): string {
		if ( ! self::is_renderable_context() ) {
			return '';
		}
		return Frak_Component_Renderer::share_button( self::normalize( $atts ) );
	}

	/**
	 * `[frak_post_purchase variant="referrer" cta_text="Earn"]`
	 *
	 * WC order context (customer-id / order-id / token) is still
	 * auto-injected by the renderer when the shortcode is used on a
	 * WooCommerce `order-received` / `view-order` endpoint, matching the
	 * block's behaviour.
	 *
	 * @param array<string, string>|string $atts Shortcode attributes.
	 * @return string
	 */
	public static function render_post_purchase( $atts ): string {
		if ( ! self::is_renderable_context() ) {
			return '';
		}
		return Frak_Component_Renderer::post_purchase( self::normalize( $atts ) );
	}

	/**
	 * Normalise the WP shortcode-parser output into the renderer's expected
	 * camelCase-keyed map.
	 *
	 * WP calls the handler with `''` (empty string) instead of `array()` when
	 * no attributes are supplied — guard against that before iterating.
	 *
	 * @param array<string, string>|string $atts Raw shortcode payload.
	 * @return array<string, mixed>
	 */
	private static function normalize( $atts ): array {
		if ( ! is_array( $atts ) ) {
			return array();
		}
		return Frak_Component_Renderer::snake_keys_to_camel( $atts );
	}

	/**
	 * Whether the current request is a context where emitting the web component
	 * markup is meaningful. Returns false in:
	 *
	 *   - RSS / Atom / JSON feeds (`is_feed()`) — feed readers can't execute the
	 *     web component and would render raw `<frak-*>` strings.
	 *   - oEmbed render contexts (`is_embed()`) — the embedded iframe response
	 *     doesn't carry the SDK, so the component would never hydrate.
	 *   - REST-API responses (`REST_REQUEST` constant, set by `WP_REST_Server`)
	 *     — `the_content` runs during `/wp/v2/posts/:id`, so without this guard
	 *     headless / mobile consumers get `<frak-banner>` markup baked into the
	 *     JSON `rendered` field. `wp_is_rest_endpoint()` would be preferable but
	 *     it only exists on WP 6.5+; the constant has been stable for years.
	 *
	 * The SDK is not loaded in any of these contexts (see
	 * {@see Frak_Frontend::enqueue_scripts()}, which only runs on
	 * `wp_enqueue_scripts`), so emitting the markup there would never render a
	 * working component — it would just clutter the response.
	 *
	 * @return bool
	 */
	private static function is_renderable_context(): bool {
		if ( function_exists( 'is_feed' ) && is_feed() ) {
			return false;
		}
		if ( function_exists( 'is_embed' ) && is_embed() ) {
			return false;
		}
		if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) {
			return false;
		}
		return true;
	}
}
