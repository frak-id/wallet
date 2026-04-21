<?php
/**
 * Server render for the `frak/post-purchase` block.
 *
 * Thin wrapper over {@see Frak_Component_Renderer::post_purchase()} — the
 * actual attribute → HTML mapping plus the WooCommerce order-context
 * auto-injection live there so the `[frak_post_purchase]` shortcode and the
 * `Frak_Post_Purchase_Widget` sidebar widget all benefit from the same
 * thank-you / view-order context detection. The block web component and
 * the inline `woocommerce_thankyou` fallback both fire `trackPurchaseStatus`
 * with the same `(customerId, orderId, token)` triple; the SDK is
 * idempotent on that triple so the duplicate call is intentional — it
 * keeps attribution working when either surface is missing.
 *
 * @package Frak_Integration
 *
 * @var array<string, mixed> $attributes Block attributes.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Renderer escapes each attribute internally; wrapper comes from get_block_wrapper_attributes() which is pre-escaped by core.
echo Frak_Component_Renderer::post_purchase( $attributes, get_block_wrapper_attributes() );
