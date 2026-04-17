<?php
/**
 * Editor-script dependencies for the `frak/post-purchase` block. Consumed by
 * WordPress when it registers the block via {@see register_block_type()}.
 *
 * @package Frak_Integration
 */

return array(
	'dependencies' => array( 'wp-blocks', 'wp-element', 'wp-block-editor', 'wp-components', 'wp-i18n', 'frak-sdk' ),
	'version'      => '1.1.0',
);
