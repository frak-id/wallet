<?php
/**
 * Funnel-builder compatibility layer.
 *
 * Detects FunnelKit (Funnel Builder + One-Click Upsell) and CartFlows
 * thank-you contexts and ensures the inline `trackPurchaseStatus` script
 * fires there, even when those plugins bypass WooCommerce's standard
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
 *       * CartFlows thank-you steps via `is_singular('cartflows_step')`
 *         + `wcf-step-type` post meta = `thankyou`.
 *
 * Idempotency: emission goes through {@see Frak_WooCommerce::render_purchase_tracker_for_order()}
 * which is gated by an internal flag so a single page never outputs the
 * tracker script twice. `woocommerce_thankyou` (when fired by FunnelKit
 * Funnel Builder Lite v3.14+ / Pro #7630) wins and short-circuits the
 * fallback layers; this class fills the gap when the native hook never
 * fires.
 *
 * Trust model: callers (FunnelKit / CartFlows) have already gone through
 * their own checkout / order-completion flow before invoking these
 * surfaces — we trust the order id they hand us the same way
 * {@see Frak_WooCommerce::render_purchase_tracker_for_order()} trusts the
 * id passed by `woocommerce_thankyou`. The emitted token is
 * `$order_key . '_' . $order_id` which the backend verifies, so a
 * mismatched id at most produces a token the backend rejects — no
 * attribution leak.
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
		// path doesn't fire `woocommerce_thankyou` at all. Hooked at default
		// priority so this runs before the SDK is enqueued (which uses
		// `wp_enqueue_scripts`, fired earlier in the request lifecycle).
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
	 *   - the tracker has already been emitted earlier in the request
	 *     (e.g. via `woocommerce_thankyou` — modern FunnelKit re-fires it);
	 *   - we're not on a recognised funnel-step thank-you page;
	 *   - the funnel plugin didn't expose a resolvable order id.
	 */
	public static function maybe_render_tracker_for_funnel_step() {
		if ( Frak_WooCommerce::has_emitted_tracker() ) {
			return;
		}

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
	 * WC clears it). We fall back to the conventional `?wc_order` /
	 * `?order-received` query vars in case the merchant runs a custom
	 * step that mutates the URL.
	 *
	 * @return int Order id, or 0 when unresolvable.
	 */
	private static function funnelkit_thankyou_order_id(): int {
		$session_order_id = self::wc_session_order_id();
		if ( $session_order_id ) {
			return $session_order_id;
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only context detection on a public TY page.
		if ( isset( $_GET['wc_order'] ) ) {
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only context detection on a public TY page.
			$order_id = absint( wp_unslash( $_GET['wc_order'] ) );
			if ( $order_id ) {
				return $order_id;
			}
		}

		return 0;
	}

	/**
	 * Whether the current request is rendering a CartFlows thank-you step.
	 *
	 * CartFlows funnels use a custom `cartflows_step` post type, with the
	 * step kind stored in the `wcf-step-type` post meta. We match on the
	 * meta rather than templating because the step template can be
	 * overridden by themes / child plugins.
	 *
	 * @return bool
	 */
	private static function is_cartflows_thankyou(): bool {
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
	 * with the WooCommerce session as a fallback for in-place renders that
	 * skip the redirect.
	 *
	 * @return int Order id, or 0 when unresolvable.
	 */
	private static function cartflows_thankyou_order_id(): int {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only context detection on a public TY page.
		if ( isset( $_GET['wcf-order'] ) ) {
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only context detection on a public TY page.
			$order_id = absint( wp_unslash( $_GET['wcf-order'] ) );
			if ( $order_id ) {
				return $order_id;
			}
		}

		return self::wc_session_order_id();
	}

	/**
	 * Pull the order id from the WooCommerce session's
	 * `order_awaiting_payment` slot. Set by `WC_Checkout::process_checkout()`
	 * right before payment dispatch and cleared once the order is paid —
	 * funnel TY steps render inside that window.
	 *
	 * @return int Order id, or 0 when no session / no slot value.
	 */
	private static function wc_session_order_id(): int {
		if ( ! function_exists( 'WC' ) ) {
			return 0;
		}
		return absint( WC()->session->get( 'order_awaiting_payment' ) );
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
