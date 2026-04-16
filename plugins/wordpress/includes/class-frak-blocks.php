<?php
/**
 * Gutenberg block registration.
 *
 * Every block bundled with the plugin lives in its own folder under
 * `includes/blocks/*`, providing a `block.json`, a vanilla-JS editor script
 * (no build pipeline), and a PHP `render.php`. The list is hard-coded below
 * so we avoid a `glob()` disk scan on every `init` firing; adding a new
 * block is a single-line change here plus dropping the folder.
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_Blocks
 */
class Frak_Blocks {

	/**
	 * Folder names under `includes/blocks/` to register. Kept explicit so we
	 * trade one cheap constant lookup for a filesystem scan per request.
	 *
	 * @var string[]
	 */
	private const BLOCKS = array(
		'banner',
		'post-purchase',
		'share-button',
	);

	/**
	 * Register hooks. Called once from {@see Frak_Plugin::init()}.
	 */
	public static function init() {
		add_action( 'init', array( __CLASS__, 'register_blocks' ) );
	}

	/**
	 * Register every bundled block via its `block.json` manifest.
	 */
	public static function register_blocks() {
		foreach ( self::BLOCKS as $slug ) {
			register_block_type( FRAK_PLUGIN_DIR . 'includes/blocks/' . $slug );
		}
	}
}
