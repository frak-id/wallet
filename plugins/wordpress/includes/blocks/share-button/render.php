<?php
/**
 * Server render for the `frak/share-button` block.
 *
 * @package Frak_Integration
 *
 * @var array<string, mixed> $attributes Block attributes.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$frak_attr_map = array(
	'text'               => 'text',
	'placement'          => 'placement',
	'classname'          => 'classname',
	'use-reward'         => 'useReward',
	'no-reward-text'     => 'noRewardText',
	'target-interaction' => 'targetInteraction',
	'click-action'       => 'clickAction',
);

$frak_attr_pairs = array();
foreach ( $frak_attr_map as $html_attr => $block_key ) {
	if ( ! array_key_exists( $block_key, $attributes ) ) {
		continue;
	}
	$frak_value = $attributes[ $block_key ];
	if ( is_bool( $frak_value ) ) {
		if ( $frak_value ) {
			$frak_attr_pairs[] = esc_attr( $html_attr );
		}
		continue;
	}
	if ( '' === $frak_value || null === $frak_value ) {
		continue;
	}
	$frak_attr_pairs[] = sprintf( '%s="%s"', esc_attr( $html_attr ), esc_attr( (string) $frak_value ) );
}

$frak_wrapper_attributes = get_block_wrapper_attributes();

printf(
	'<div %1$s><frak-button-share %2$s></frak-button-share></div>',
	$frak_wrapper_attributes, // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- get_block_wrapper_attributes returns pre-escaped output.
	implode( ' ', $frak_attr_pairs ) // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- each attribute is escaped in the loop above.
);
