<?php
/**
 * Server render for the `frak/banner` block.
 *
 * @package Frak_Integration
 *
 * @var array<string, mixed> $attributes Block attributes.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$frak_attr_map = array(
	'placement'            => 'placement',
	'classname'            => 'classname',
	'interaction'          => 'interaction',
	'referral-title'       => 'referralTitle',
	'referral-description' => 'referralDescription',
	'referral-cta'         => 'referralCta',
	'inapp-title'          => 'inappTitle',
	'inapp-description'    => 'inappDescription',
	'inapp-cta'            => 'inappCta',
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
	'<div %1$s><frak-banner %2$s></frak-banner></div>',
	$frak_wrapper_attributes, // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- pre-escaped by WordPress.
	implode( ' ', $frak_attr_pairs ) // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped per-attribute above.
);
