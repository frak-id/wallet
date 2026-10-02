<?php
/**
 * Server render for the `frak/ambassador` block.
 *
 * Thin wrapper over {@see Frak_Component_Renderer::ambassador()} — the
 * `[frak_ambassador]` shortcode emits the same component.
 *
 * @package Frak_Integration
 *
 * @var array<string, mixed> $attributes Block attributes.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Renderer escapes each attribute internally; wrapper comes from get_block_wrapper_attributes() which is pre-escaped by core.
echo Frak_Component_Renderer::ambassador( $attributes, get_block_wrapper_attributes() );
