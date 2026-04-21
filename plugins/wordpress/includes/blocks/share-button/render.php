<?php
/**
 * Server render for the `frak/share-button` block.
 *
 * Thin wrapper over {@see Frak_Component_Renderer::share_button()} — the
 * actual attribute → HTML mapping lives there so the `[frak_share_button]`
 * shortcode and the `Frak_Share_Button_Widget` sidebar widget emit
 * byte-identical output.
 *
 * @package Frak_Integration
 *
 * @var array<string, mixed> $attributes Block attributes.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Renderer escapes each attribute internally; wrapper comes from get_block_wrapper_attributes() which is pre-escaped by core.
echo Frak_Component_Renderer::share_button( $attributes, get_block_wrapper_attributes() );
