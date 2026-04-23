<?php
/**
 * Editor-script dependencies for the `frak/post-purchase` block. Consumed by
 * WordPress when it registers the block via {@see register_block_type()}.
 *
 * @package Frak_Integration
 */

return array(
	'dependencies' => array( 'wp-blocks', 'wp-element', 'wp-block-editor', 'wp-components', 'wp-i18n', 'frak-sdk', 'frak-editor-sdk-injector' ),
	'version'      => defined( 'FRAK_PLUGIN_VERSION' ) ? FRAK_PLUGIN_VERSION : '0.0.0',
);
