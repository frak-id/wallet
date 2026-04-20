<?php
/**
 * Server render for the `frak/post-purchase` block.
 *
 * `customer-id` / `order-id` / `token` are NOT merchant-editable attributes.
 * They are auto-injected server-side on any valid WooCommerce order endpoint
 * — `order-received` (thank-you page, URL-key guarded) and `view-order` (My
 * Account view, capability guarded). That gives the component everything it
 * needs to render the rewards UI and fire `trackPurchaseStatus` on mount.
 * On a non-WC custom thank-you page the merchant is expected to trigger
 * tracking themselves via `window.FrakSetup.core.trackPurchaseStatus`.
 *
 * The inline `wp_footer`-adjacent tracker in {@see Frak_WooCommerce::render_purchase_tracker_for_order()}
 * ALSO fires on the same two endpoints. The duplicate call is intentional —
 * `trackPurchaseStatus` is idempotent on the same `(customerId, orderId, token)`
 * triple, and having both surfaces fire keeps attribution working when the
 * block is present but the SDK is still warming up, or vice versa.
 *
 * @package Frak_Integration
 *
 * @var array<string, mixed> $attributes Block attributes.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$frak_attr_map = array(
	'sharing-url'   => 'sharingUrl',
	'merchant-id'   => 'merchantId',
	'placement'     => 'placement',
	'classname'     => 'classname',
	'variant'       => 'variant',
	'badge-text'    => 'badgeText',
	'referrer-text' => 'referrerText',
	'referee-text'  => 'refereeText',
	'cta-text'      => 'ctaText',
);

$frak_attr_pairs = array();
foreach ( $frak_attr_map as $html_attr => $block_key ) {
	if ( ! array_key_exists( $block_key, $attributes ) ) {
		continue;
	}
	$frak_value = $attributes[ $block_key ];
	if ( '' === $frak_value || null === $frak_value ) {
		continue;
	}
	$frak_attr_pairs[] = sprintf( '%s="%s"', esc_attr( $html_attr ), esc_attr( (string) $frak_value ) );
}

// Auto-populate WC order context on the thank-you page. Merchant-set
// attributes win if any overlap, but today `customer-id` / `order-id` /
// `token` are not exposed in the editor, so this just adds them.
if ( class_exists( 'Frak_WooCommerce' ) ) {
	$frak_wc_context = Frak_WooCommerce::get_order_context();
	if ( null !== $frak_wc_context ) {
		foreach ( $frak_wc_context as $frak_html_attr => $frak_context_value ) {
			$frak_attr_pairs[] = sprintf( '%s="%s"', esc_attr( $frak_html_attr ), esc_attr( $frak_context_value ) );
		}
	}
}

$frak_wrapper_attributes = get_block_wrapper_attributes();

printf(
	'<div %1$s><frak-post-purchase %2$s></frak-post-purchase></div>',
	$frak_wrapper_attributes, // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- pre-escaped by WordPress.
	implode( ' ', $frak_attr_pairs ) // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped per-attribute above.
);
