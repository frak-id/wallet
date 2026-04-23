<?php
/**
 * Server render for the `frak/banner` block.
 *
 * Thin wrapper over {@see Frak_Component_Renderer::banner()} — the actual
 * attribute → HTML mapping lives there so the `[frak_banner]` shortcode and
 * the `Frak_Banner_Widget` sidebar widget emit byte-identical output.
 *
 * @package Frak_Integration
 *
 * @var array<string, mixed> $attributes Block attributes.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Renderer escapes each attribute internally; wrapper comes from get_block_wrapper_attributes() which is pre-escaped by core.
echo Frak_Component_Renderer::banner( $attributes, get_block_wrapper_attributes() );
