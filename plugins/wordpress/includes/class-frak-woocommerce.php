<?php
/**
 * WooCommerce integration.
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_WooCommerce
 *
 * Stateless hook container — all handlers are static so no instance is held
 * in memory between requests. Hooks are registered in {@see init()}.
 */
class Frak_WooCommerce {

	/**
	 * Default cap on the number of order line items forwarded to the
	 * `<frak-post-purchase products>` HTML attribute. Big carts would
	 * otherwise serialise to multi-kilobyte attribute values — the sharing
	 * page UI also gets cluttered past ~6 items. Consumers can override via
	 * the `$cap` argument on {@see get_post_purchase_data()}.
	 *
	 * @var int
	 */
	private const DEFAULT_PRODUCT_CAP = 6;

	/**
	 * Idempotency latch — keyed by order id, populated on each successful
	 * tracker emission within a request and read by every additional call
	 * path so the same order never lands a duplicate inline `<script>` tag.
	 *
	 * Multiple surfaces can race to fire the tracker on the same request:
	 *   - `woocommerce_thankyou` (this class — primary path)
	 *   - `woocommerce_view_order` (this class — My Account → View Order)
	 *   - `wfocu_custom_purchase_tracking` (FunnelKit — see {@see Frak_Funnel_Compat})
	 *   - `wp_footer` funnel-step fallback ({@see Frak_Funnel_Compat::maybe_render_tracker_for_funnel_step()})
	 * Two of those can legitimately carry DIFFERENT order ids on the same
	 * request (e.g. `woocommerce_thankyou` for the parent order + a late
	 * `wfocu_custom_purchase_tracking` for an upsell child order on the
	 * final WFOCU thank-you page). A boolean latch would silently drop the
	 * second order and leave it stuck in `pending_claim` on the backend, so
	 * we key by order id and let each distinct order emit exactly once. The
	 * inline `<script>` tag's HTML id is suffixed with the order id so
	 * multi-emission requests still satisfy id-uniqueness.
	 *
	 * Backend `trackPurchaseStatus` is itself idempotent on the
	 * `(merchantId, orderId, token)` triple, so the latch is purely about
	 * HTML hygiene + parse cost, not correctness — but skipping a distinct
	 * order id WOULD harm correctness, hence the per-order keying.
	 *
	 * @var array<int, true>
	 */
	private static array $emitted_order_ids = array();

	/**
	 * Register WooCommerce hooks. Called once from {@see Frak_Plugin::init()}.
	 *
	 * Tracker registration uses `woocommerce_thankyou` and `woocommerce_view_order`
	 * instead of a universal `wp_footer` listener so the callback only runs on
	 * the exact two endpoints that carry an order — every other frontend page
	 * pays zero PHP for tracking.
	 *
	 * Order-status → webhook dispatch lives in WooCommerce's native webhook
	 * pipeline now (see {@see Frak_WC_Webhook_Registrar}); we no longer hook
	 * `woocommerce_order_status_changed` from PHP because WC's own
	 * `woocommerce_update_order` trigger + queued delivery + retry handles it.
	 */
	public static function init() {
		add_action( 'woocommerce_thankyou', array( __CLASS__, 'render_purchase_tracker_for_order' ) );
		add_action( 'woocommerce_view_order', array( __CLASS__, 'render_purchase_tracker_for_order' ) );
	}

	/**
	 * Resolve all server-side data needed by `<frak-post-purchase>` in a
	 * single pass: WooCommerce order context (customer / order / token) plus
	 * optional product line-items for the SDK's sharing-page UI.
	 *
	 * Replaces the previous `get_order_context()` + `get_order_products()`
	 * pair which both internally re-resolved the same `WC_Order`. The renderer
	 * now calls this once per post-purchase render, halving the WC order
	 * lookup cost (one `is_wc_endpoint_url()` + one `wc_get_order()` instead
	 * of two each).
	 *
	 * Endpoint guards (URL-key match on `order-received`, `view_order` cap on
	 * `view-order`) live in {@see resolve_current_order()}; this method
	 * returns null on any non-order endpoint or guard failure.
	 *
	 * Returned shape:
	 *   - `context`  : map of HTML attribute name → value (always present)
	 *   - `products` : list of {@see SharingPageProduct}-shaped arrays, or
	 *                  `null` when products were not requested / the order has
	 *                  zero resolvable line items.
	 *
	 * Each product entry contains:
	 *   - `title`    : line-item name (variation-aware, falls back to product name)
	 *   - `imageUrl` : `medium`-size featured image URL (omitted when missing)
	 *   - `link`     : product permalink (omitted when missing)
	 *
	 * Variation products inherit their parent's image when no variation-
	 * specific image is set — standard WooCommerce behaviour.
	 *
	 * @param bool $with_products Whether to extract product line items.
	 * @param int  $cap            Max products to include (default {@see DEFAULT_PRODUCT_CAP}).
	 *                              Caller-overridable because attribute serialisation
	 *                              cost scales linearly with the cap.
	 * @return array{context: array<string, string>, products: array<int, array{title: string, imageUrl?: string, link?: string}>|null}|null
	 */
	public static function get_post_purchase_data( bool $with_products = true, int $cap = self::DEFAULT_PRODUCT_CAP ) {
		$order = self::resolve_current_order();
		if ( ! $order ) {
			return null;
		}

		$order_id = $order->get_id();

		return array(
			'context'  => array(
				'customer-id' => (string) $order->get_user_id(),
				'order-id'    => (string) $order_id,
				'token'       => $order->get_order_key() . '_' . $order_id,
			),
			'products' => $with_products ? self::extract_order_products( $order, $cap ) : null,
		);
	}

	/**
	 * Extract line items from a resolved {@see WC_Order} as a list of
	 * {@see SharingPageProduct}-shaped associative arrays.
	 *
	 * Returns null when:
	 *   - the order has zero line items;
	 *   - none of the line items resolve to a real {@see WC_Product}
	 *     (rare, but possible for orders whose products were deleted).
	 *
	 * @param WC_Order $order Resolved order.
	 * @param int      $cap   Max products to include.
	 * @return array<int, array{title: string, imageUrl?: string, link?: string}>|null
	 */
	private static function extract_order_products( $order, int $cap ) {
		$items = $order->get_items();
		if ( empty( $items ) ) {
			return null;
		}

		$products = array();
		$count    = 0;
		foreach ( $items as $item ) {
			if ( $count >= $cap ) {
				break;
			}
			if ( ! ( $item instanceof WC_Order_Item_Product ) ) {
				continue;
			}
			$product = $item->get_product();
			if ( ! $product ) {
				continue;
			}

			$entry = array(
				'title' => (string) $item->get_name(),
			);

			$image_id = (int) $product->get_image_id();
			if ( $image_id > 0 ) {
				$image_url = wp_get_attachment_image_url( $image_id, 'medium' );
				if ( is_string( $image_url ) && '' !== $image_url ) {
					$entry['imageUrl'] = $image_url;
				}
			}

			$permalink = (string) $product->get_permalink();
			if ( '' !== $permalink ) {
				$entry['link'] = $permalink;
			}

			$products[] = $entry;
			++$count;
		}

		return ! empty( $products ) ? $products : null;
	}

	/**
	 * Resolve the current request's WooCommerce order with the same endpoint
	 * + capability guards used by {@see get_post_purchase_data()}. Returns null
	 * on any other endpoint or when the guard fails.
	 * Endpoints handled:
	 *   - `order-received` (post-checkout thank-you page): public, guarded
	 *     by the `key` query arg matching the stored order key — the same
	 *     anti-enumeration check WooCommerce's own template performs.
	 *   - `view-order` (My Account → Orders → View): authenticated, guarded
	 *     by the `view_order` meta capability (current user must own the
	 *     order, or be a shop manager).
	 *
	 * @return WC_Order|null
	 */
	private static function resolve_current_order() {
		if ( ! function_exists( 'is_wc_endpoint_url' ) ) {
			return null;
		}

		global $wp;

		if ( is_wc_endpoint_url( 'order-received' ) ) {
			$order_id = isset( $wp->query_vars['order-received'] ) ? absint( $wp->query_vars['order-received'] ) : 0;
			if ( ! $order_id ) {
				return null;
			}
			$candidate = wc_get_order( $order_id );
			if ( ! $candidate ) {
				return null;
			}
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Public endpoint; mirrors WooCommerce's own thank-you key check.
			$url_key = isset( $_GET['key'] ) ? sanitize_text_field( wp_unslash( $_GET['key'] ) ) : '';
			if ( '' === $url_key || $url_key !== $candidate->get_order_key() ) {
				return null;
			}
			return $candidate;
		}

		if ( is_wc_endpoint_url( 'view-order' ) ) {
			$order_id = isset( $wp->query_vars['view-order'] ) ? absint( $wp->query_vars['view-order'] ) : 0;
			if ( ! $order_id || ! current_user_can( 'view_order', $order_id ) ) {
				return null;
			}
			$candidate = wc_get_order( $order_id );
			if ( ! $candidate ) {
				return null;
			}
			return $candidate;
		}

		return null;
	}

	/**
	 * Inline tracker entrypoint — always emits the `trackPurchaseStatus`
	 * call so reward attribution works even when the merchant has not placed
	 * the `frak/post-purchase` block on their template.
	 *
	 * Hooked directly to `woocommerce_thankyou` and `woocommerce_view_order`
	 * for the standard WC paths, and called by {@see Frak_Funnel_Compat} for
	 * funnel-builder thank-you pages (FunnelKit / CartFlows). Each distinct
	 * order id emits at most once per request (see {@see $emitted_order_ids});
	 * subsequent calls for the same id within the same request short-circuit
	 * so a single page never emits two `<script id="frak-purchase-tracker-inline-{order_id}">`
	 * tags for the same order. Different order ids in the same request still
	 * each get their own emission — required for WFOCU upsell flows where the
	 * final TY page can carry both the parent order and a child upsell order.
	 *
	 * The `frak/post-purchase` block, when present, ALSO fires `trackPurchaseStatus`
	 * from its `<frak-post-purchase>` web component on mount. The duplicate call
	 * is intentional — the SDK is idempotent on the same `(customerId, orderId,
	 * token)` triple, and having both surfaces fire keeps tracking working when
	 * either one is missing (block absent, or block present but SDK still warming).
	 *
	 * WooCommerce has already run its own endpoint + capability checks before
	 * firing these actions, so we trust the `$order_id` argument and skip the
	 * URL-key / `view_order` guard that {@see resolve_current_order()} performs.
	 *
	 * @param int $order_id Order ID provided by the WooCommerce action.
	 */
	public static function render_purchase_tracker_for_order( $order_id ) {
		$order_id = absint( $order_id );
		if ( ! $order_id || isset( self::$emitted_order_ids[ $order_id ] ) ) {
			return;
		}

		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return;
		}

		$payload = array(
			'customerId' => (string) $order->get_user_id(),
			'orderId'    => (string) $order_id,
			'token'      => $order->get_order_key() . '_' . $order_id,
		);

		$payload_json = wp_json_encode( $payload, JSON_UNESCAPED_SLASHES );

		// Fires the tracking call as soon as the SDK client is ready. The
		// synchronous pre-check covers the case where the SDK bootstraps
		// before this inline script runs.
		$script = sprintf(
			'(function(p){var f=function(){var s=window.FrakSetup;if(s&&s.core&&s.core.trackPurchaseStatus){s.core.trackPurchaseStatus(p);return true;}return false;};if(!f())window.addEventListener("frak:client",f,{once:true});})(%s);',
			$payload_json
		);

		wp_print_inline_script_tag( $script, array( 'id' => 'frak-purchase-tracker-inline-' . $order_id ) );
		self::$emitted_order_ids[ $order_id ] = true;
	}

	/**
	 * Whether the inline tracker has already been emitted for the given
	 * order id within the current request. Surface for compat layers (see
	 * {@see Frak_Funnel_Compat}) that want to skip resolution work when the
	 * standard `woocommerce_thankyou` path has already covered the order.
	 *
	 * @param int $order_id Order ID to check.
	 * @return bool
	 */
	public static function has_emitted_tracker_for_order( int $order_id ): bool {
		return isset( self::$emitted_order_ids[ $order_id ] );
	}
}
