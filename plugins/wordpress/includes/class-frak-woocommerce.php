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
	 * the `$cap` argument on {@see get_order_products()}.
	 *
	 * @var int
	 */
	private const DEFAULT_PRODUCT_CAP = 6;

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
	 * Resolve the WooCommerce order context for the current request.
	 *
	 * Supports two order-scoped endpoints:
	 *   - `order-received` (post-checkout thank-you page): public, guarded
	 *     by the `key` query arg matching the stored order key — the same
	 *     anti-enumeration check WooCommerce's own template performs.
	 *   - `view-order` (My Account → Orders → View): authenticated, guarded
	 *     by the `view_order` meta capability (current user must own the
	 *     order, or be a shop manager).
	 *
	 * Returns null on any other endpoint or when the guard fails.
	 *
	 * Shared by the `frak/post-purchase` block (to auto-inject HTML
	 * attributes) and {@see render_purchase_tracker()} (for its payload).
	 *
	 * @return array<string, string>|null Map of HTML attribute name → value.
	 */
	public static function get_order_context() {
		$order = self::resolve_current_order();
		if ( ! $order ) {
			return null;
		}

		$order_id = $order->get_id();

		return array(
			'customer-id' => (string) $order->get_user_id(),
			'order-id'    => (string) $order_id,
			'token'       => $order->get_order_key() . '_' . $order_id,
		);
	}

	/**
	 * Resolve the line items for the current request as a list of
	 * {@see SharingPageProduct}-shaped associative arrays.
	 *
	 * Mirrors the endpoint + capability guards from {@see get_order_context()}
	 * so this only ever returns data on the WooCommerce `order-received`
	 * (post-checkout) and `view-order` (My Account) endpoints. Returns
	 * null when:
	 *   - the request is not on a recognised order endpoint;
	 *   - the URL key / `view_order` capability check fails;
	 *   - the order has zero line items;
	 *   - none of the line items resolve to a real {@see WC_Product}
	 *     (rare, but possible for orders whose products were deleted).
	 *
	 * Each entry contains:
	 *   - `title`    : line-item name (variation-aware, falls back to product name)
	 *   - `imageUrl` : `medium`-size featured image URL (omitted when missing)
	 *   - `link`     : product permalink (omitted when missing)
	 *
	 * Variation products inherit their parent's image when no variation-
	 * specific image is set — standard WooCommerce behaviour.
	 *
	 * @param int $cap Maximum number of products to return. Caller-overridable
	 *                 because attribute serialisation costs scale linearly
	 *                 with the cap; defaults to {@see DEFAULT_PRODUCT_CAP}.
	 * @return array<int, array{title: string, imageUrl?: string, link?: string}>|null
	 */
	public static function get_order_products( $cap = self::DEFAULT_PRODUCT_CAP ) {
		$order = self::resolve_current_order();
		if ( ! $order ) {
			return null;
		}

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
	 * + capability guards used by both {@see get_order_context()} and
	 * {@see get_order_products()}. Returns null on any other endpoint or when
	 * the guard fails.
	 *
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
	 * Inline tracker fired from `woocommerce_thankyou` and `woocommerce_view_order`
	 * — always emits the `trackPurchaseStatus` call so reward attribution works
	 * even when the merchant has not placed the `frak/post-purchase` block on
	 * their template.
	 *
	 * The `frak/post-purchase` block, when present, ALSO fires `trackPurchaseStatus`
	 * from its `<frak-post-purchase>` web component on mount. The duplicate call
	 * is intentional — the SDK is idempotent on the same `(customerId, orderId,
	 * token)` triple, and having both surfaces fire keeps tracking working when
	 * either one is missing (block absent, or block present but SDK still warming).
	 *
	 * WooCommerce has already run its own endpoint + capability checks before
	 * firing these actions, so we trust the `$order_id` argument and skip the
	 * URL-key / `view_order` guard that {@see get_order_context()} performs.
	 *
	 * @param int $order_id Order ID provided by the WooCommerce action.
	 */
	public static function render_purchase_tracker_for_order( $order_id ) {
		$order_id = absint( $order_id );
		if ( ! $order_id ) {
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

		wp_print_inline_script_tag( $script, array( 'id' => 'frak-purchase-tracker-inline' ) );
	}
}
