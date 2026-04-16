<?php
/**
 * Server render for the `frak/post-purchase` block.
 *
 * Customer / order / token are deliberately NOT exposed as block attributes:
 * on a WooCommerce thank-you page, {@see Frak_WooCommerce::render_purchase_tracker()}
 * already fires the core SDK tracking call, so this block is pure UI. On a
 * non-WC custom thank-you page the merchant is expected to trigger tracking
 * themselves (via `window.FrakSetup.core.trackPurchaseStatus`).
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

$frak_wrapper_attributes = get_block_wrapper_attributes();

printf(
	'<div %1$s><frak-post-purchase %2$s></frak-post-purchase></div>',
	$frak_wrapper_attributes, // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- pre-escaped by WordPress.
	implode( ' ', $frak_attr_pairs ) // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped per-attribute above.
);
