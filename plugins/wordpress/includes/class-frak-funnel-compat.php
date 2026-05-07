<?php
/**
 * Funnel-builder compatibility layer.
 *
 * Detects FunnelKit (Funnel Builder + One-Click Upsell + Aero Checkout)
 * and CartFlows thank-you contexts and ensures the inline `trackPurchaseStatus`
 * script fires there, even when those plugins bypass WooCommerce's standard
 * `woocommerce_thankyou` hook.
 *
 * Why this exists:
 * Unlike Shopify (which rides the Frak `clientId` through cart attributes
 * back into the order webhook), WooCommerce webhooks are blind to the
 * browser identity. The backend `PurchaseWebhookOrchestrator` records the
 * order in `pending_claim` state and **no reward is issued** until a
 * browser-side `trackPurchaseStatus` call lands and links the order to
 * the user's `clientId`. The native `woocommerce_thankyou` hook fires
 * that call on standard thank-you pages, but funnel builders that swap
 * the thank-you template can bypass it. This class plugs every well-known
 * funnel surface so attribution stays intact without merchant action.
 *
 * Hooks attached (each is a no-op when the corresponding plugin is absent):
 *   - `wfocu_custom_purchase_tracking` — fires on FunnelKit's standard
 *     thank-you page AND after every successful WFOCU one-click upsell
 *     offer. Carries `transaction_id` in the payload.
 *   - `wp_footer` — late-bound fallback that detects:
 *       * FunnelKit Funnel Builder thank-you steps via
 *         `function_exists('wffn_is_thankyou_page')`.
 *       * CartFlows thank-you steps via `_is_wcf_thankyou_type()` (with a
 *         direct post-type + `wcf-step-type` meta probe as fallback for
 *         white-label forks that drop the helper).
 *
 * Idempotency: emission goes through {@see Frak_WooCommerce::render_purchase_tracker_for_order()}
 * which keeps a per-order-id latch so each distinct order id emits at most
 * once per request — `woocommerce_thankyou`, `woocommerce_view_order`,
 * `wfocu_custom_purchase_tracking` and the `wp_footer` fallback all funnel
 * through the same dedupe surface. Different order ids in the same request
 * still each get their own emission, which matters on WFOCU final TY pages
 * that can carry both a parent order and a child upsell order.
 *
 * Trust model: callers (FunnelKit / CartFlows) have already gone through
 * their own checkout / order-completion flow before invoking these
 * surfaces. For URL-derived order ids (`?wcf-order` / `?wc_order`) we
 * additionally validate the matching `?wcf-key` / `?key` query var
 * against `$order->get_order_key()` — defence-in-depth that mirrors
 * {@see Frak_WooCommerce::resolve_current_order()} and protects against
 * a buggy custom template that bypasses CartFlows's own
 * `secure_thank_you_page()` gate.
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_Funnel_Compat
 *
 * Stateless static class — mirrors the pattern used by {@see Frak_WooCommerce}.
 * All handlers are static so no instance is held in memory between requests.
 */
class Frak_Funnel_Compat {

	/**
	 * Wire the compat hooks. Called once from {@see Frak_Plugin::init()} and
	 * short-circuits when neither FunnelKit nor CartFlows is active so sites
	 * without a funnel plugin pay zero per-request cost.
	 *
	 * Caller already gates on `class_exists( 'WooCommerce' )`, so this
	 * method only needs to verify the funnel-plugin presence.
	 */
	public static function init() {
		if ( ! self::is_funnelkit_active() && ! self::is_cartflows_active() ) {
			return;
		}

		// FunnelKit One-Click Upsell native tracking hook. Fires on the
		// standard FunnelKit thank-you AND after every successful upsell
		// offer in the WFOCU flow — covers the case where `woocommerce_thankyou`
		// has already been bypassed by the upsell pipeline.
		if ( self::is_funnelkit_active() ) {
			add_action( 'wfocu_custom_purchase_tracking', array( __CLASS__, 'render_tracker_from_funnelkit_payload' ), 10, 1 );
		}

		// `wp_footer` fallback for funnel-step thank-you pages whose render
		// path doesn't fire `woocommerce_thankyou` at all. Default priority
		// (10) runs before WP core's `wp_print_footer_scripts` (priority 20)
		// so the inline tracker lands ahead of the SDK <script> tag — but the
		// tracker is self-bootstrapping (synchronous FrakSetup probe + a
		// one-shot `frak:client` listener fallback) so ordering isn't critical.
		add_action( 'wp_footer', array( __CLASS__, 'maybe_render_tracker_for_funnel_step' ) );
	}

	/**
	 * Render the tracker from FunnelKit's `wfocu_custom_purchase_tracking`
	 * payload. The hook is the canonical integration point for tracking
	 * plugins (Klaviyo, FB Pixel, GA4) per FunnelKit's developer docs.
	 *
	 * @param mixed $data Payload from FunnelKit. Expected shape includes
	 *                    `transaction_id`, `total`, `currency`, `email`,
	 *                    `items`, etc. We only use `transaction_id` and
	 *                    re-resolve the order from WooCommerce so the
	 *                    emitted token / customer id stay authoritative.
	 */
	public static function render_tracker_from_funnelkit_payload( $data ) {
		if ( ! is_array( $data ) || empty( $data['transaction_id'] ) ) {
			return;
		}
		$order_id = absint( $data['transaction_id'] );
		if ( ! $order_id ) {
			return;
		}
		Frak_WooCommerce::render_purchase_tracker_for_order( $order_id );
	}

	/**
	 * Late-bound `wp_footer` fallback. Detects funnel-step thank-you
	 * contexts that the standard {@see Frak_WooCommerce} hook chain misses
	 * and emits the tracker script.
	 *
	 * No-op when:
	 *   - we're not on a recognised funnel-step thank-you page;
	 *   - the funnel plugin didn't expose a resolvable order id;
	 *   - the resolved order has already been emitted earlier in the request
	 *     (handled inside {@see Frak_WooCommerce::render_purchase_tracker_for_order()}'s
	 *     per-order latch, so we can call it unconditionally here).
	 */
	public static function maybe_render_tracker_for_funnel_step() {
		$order_id = self::resolve_funnel_order_id();
		if ( ! $order_id ) {
			return;
		}
		Frak_WooCommerce::render_purchase_tracker_for_order( $order_id );
	}

	/**
	 * Resolve the order id for the current funnel-step thank-you page.
	 *
	 * Returns 0 when the request isn't on a recognised funnel TY surface
	 * so {@see maybe_render_tracker_for_funnel_step()} can short-circuit.
	 *
	 * @return int Order id, or 0 when not on a funnel TY page or unresolvable.
	 */
	private static function resolve_funnel_order_id(): int {
		if ( self::is_funnelkit_thankyou() ) {
			$order_id = self::funnelkit_thankyou_order_id();
			if ( $order_id ) {
				return $order_id;
			}
		}

		if ( self::is_cartflows_thankyou() ) {
			$order_id = self::cartflows_thankyou_order_id();
			if ( $order_id ) {
				return $order_id;
			}
		}

		return 0;
	}

	/**
	 * Whether the current request is rendering a FunnelKit Funnel Builder
	 * thank-you step. FunnelKit ships `wffn_is_thankyou_page()` for exactly
	 * this purpose — it inspects the resolved post type + step meta.
	 *
	 * @return bool
	 */
	private static function is_funnelkit_thankyou(): bool {
		return function_exists( 'wffn_is_thankyou_page' ) && wffn_is_thankyou_page();
	}

	/**
	 * Resolve the order id on a FunnelKit thank-you step.
	 *
	 * FunnelKit doesn't ship a public helper for this — the canonical path
	 * is the WooCommerce session (`order_awaiting_payment` is set right
	 * after the order is placed, and the funnel TY step renders before
	 * WC clears it). The session id is tied to the user's WC session so
	 * no URL-key validation is needed there. We fall back to the standard
	 * WC `?wc_order=` / `?key=` query vars for redirect-style flows, with
	 * the key validated against the order to mirror the anti-enumeration
	 * check in {@see Frak_WooCommerce::resolve_current_order()}.
	 *
	 * @return int Order id, or 0 when unresolvable.
	 */
	private static function funnelkit_thankyou_order_id(): int {
		$session_order_id = self::wc_session_order_id();
		if ( $session_order_id ) {
			return $session_order_id;
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only context detection on a public TY page.
		if ( ! isset( $_GET['wc_order'] ) ) {
			return 0;
		}
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only context detection on a public TY page.
		$order_id = absint( wp_unslash( $_GET['wc_order'] ) );
		return self::validate_order_id_against_url_key( $order_id, 'key' );
	}

	/**
	 * Whether the current request is rendering a CartFlows thank-you step.
	 *
	 * Prefers CartFlows's public `_is_wcf_thankyou_type()` helper which
	 * encapsulates the post-type + `wcf-step-type` probe (and any future
	 * detection logic CartFlows adds). Falls back to a direct probe so
	 * white-label forks that strip the helper still resolve correctly.
	 *
	 * @return bool
	 */
	private static function is_cartflows_thankyou(): bool {
		if ( function_exists( '_is_wcf_thankyou_type' ) ) {
			return (bool) _is_wcf_thankyou_type();
		}
		if ( ! is_singular( 'cartflows_step' ) ) {
			return false;
		}
		$step_id = get_queried_object_id();
		if ( ! $step_id ) {
			return false;
		}
		return 'thankyou' === get_post_meta( $step_id, 'wcf-step-type', true );
	}

	/**
	 * Resolve the order id on a CartFlows thank-you step.
	 *
	 * CartFlows exposes the order via a `wcf-order` query var on the
	 * thank-you redirect URL (set by `Cartflows_Thankyou::set_thankyou_url`),
	 * with `wcf-key` carrying the matching order key. CartFlows's own
	 * `secure_thank_you_page()` `wp_die`s if either is missing or the key
	 * doesn't match — by the time this runs in `wp_footer` the user has
	 * already cleared that gate. We re-validate `wcf-key` against the order
	 * anyway as defence-in-depth in case a buggy custom template bypasses
	 * CartFlows's gate. The WC session slot is intentionally not consulted
	 * here: CartFlows's `[cartflows_order_details]` shortcode (the standard
	 * TY template) explicitly `unset`s `order_awaiting_payment` before
	 * `wp_footer` runs, so the slot is dead-code on the canonical render
	 * path; custom templates that reach us still pass through the same
	 * `secure_thank_you_page()` gate that requires `wcf-order` + `wcf-key`.
	 *
	 * @return int Order id, or 0 when unresolvable.
	 */
	private static function cartflows_thankyou_order_id(): int {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only context detection on a public TY page.
		if ( ! isset( $_GET['wcf-order'] ) ) {
			return 0;
		}
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only context detection on a public TY page.
		$order_id = absint( wp_unslash( $_GET['wcf-order'] ) );
		return self::validate_order_id_against_url_key( $order_id, 'wcf-key' );
	}

	/**
	 * Pull the order id from the WooCommerce session's
	 * `order_awaiting_payment` slot. Set by `WC_Checkout::create_order()`
	 * during checkout and cleared on `template_redirect` once the order is
	 * paid — funnel TY steps render inside that window.
	 *
	 * The `function_exists('WC')` guard covers the case where the WC plugin
	 * is missing/disabled. Beyond that we trust WC's stubs: by `wp_footer`
	 * time `woocommerce_init` (which boots `WC_Session_Handler`) has fired,
	 * so `WC()->session` is reliably non-null on the only context that calls
	 * us. The slot's documented return type is `array|string`; we coerce
	 * scalar values via `absint()` and reject anything else (e.g. a stray
	 * array set by a third-party plugin) so a malformed session never
	 * produces a bogus order id.
	 *
	 * @return int Order id, or 0 when no session / no slot value.
	 */
	private static function wc_session_order_id(): int {
		if ( ! function_exists( 'WC' ) ) {
			return 0;
		}
		$value = WC()->session->get( 'order_awaiting_payment' );
		return is_scalar( $value ) ? absint( $value ) : 0;
	}

	/**
	 * Defence-in-depth: validate that a URL-derived order id is paired with
	 * the matching order key on the same URL. Mirrors the anti-enumeration
	 * check {@see Frak_WooCommerce::resolve_current_order()} performs on the
	 * standard `?key=` query var.
	 *
	 * Returns the validated order id, or 0 when the id is missing/invalid,
	 * the matching `$key_param` query var is absent, or the supplied key
	 * doesn't match `$order->get_order_key()`. The funnel plugins (CartFlows,
	 * FunnelKit) already enforce this gate themselves before letting the user
	 * reach a TY page; this is a second line of defence in case a custom
	 * template circumvents it.
	 *
	 * @param int    $order_id  Resolved order id from the URL (already absint'd).
	 * @param string $key_param Query-var name carrying the matching order key
	 *                          (`wcf-key` for CartFlows, `key` for FunnelKit /
	 *                          standard WC).
	 * @return int Validated order id, or 0 when validation fails.
	 */
	private static function validate_order_id_against_url_key( int $order_id, string $key_param ): int {
		if ( ! $order_id ) {
			return 0;
		}
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only context detection on a public TY page.
		if ( ! isset( $_GET[ $key_param ] ) ) {
			return 0;
		}
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only context detection on a public TY page.
		$url_key = sanitize_text_field( wp_unslash( $_GET[ $key_param ] ) );
		if ( '' === $url_key ) {
			return 0;
		}
		$order = wc_get_order( $order_id );
		if ( ! $order || $url_key !== $order->get_order_key() ) {
			return 0;
		}
		return $order_id;
	}

	/**
	 * Whether FunnelKit (any of the three sub-plugins) is active.
	 *
	 * Surface for {@see Frak_Plugin::init()} init gate and for the admin
	 * settings page to render a "FunnelKit detected" notice.
	 *
	 * @return bool
	 */
	public static function is_funnelkit_active(): bool {
		return class_exists( 'WFFN_Core' )
			|| class_exists( 'WFOCU_Core' )
			|| class_exists( 'WFACP_Common' );
	}

	/**
	 * Whether CartFlows is active.
	 *
	 * `Cartflows_Loader` covers the free plugin, `CARTFLOWS_VER` covers
	 * the constant set by both free and pro, `post_type_exists` covers
	 * white-label forks that swap the class name.
	 *
	 * @return bool
	 */
	public static function is_cartflows_active(): bool {
		return class_exists( 'Cartflows_Loader' )
			|| defined( 'CARTFLOWS_VER' )
			|| post_type_exists( 'cartflows_step' );
	}
}
