<?php
/**
 * Gutenberg block registration.
 *
 * Every block bundled with the plugin is self-contained in its own folder
 * under `includes/blocks/*`, each providing a `block.json`, a vanilla-JS
 * editor script (no build pipeline), and a PHP `render.php`. Registration
 * is a single `init`-hooked loop so adding a new block only requires
 * dropping a new folder next to the existing ones.
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_Blocks
 */
class Frak_Blocks {

	/**
	 * Register hooks. Called once from {@see Frak_Plugin::init()}.
	 */
	public static function init() {
		add_action( 'init', array( __CLASS__, 'register_blocks' ) );
	}

	/**
	 * Discover every block folder under `includes/blocks/` and register it.
	 *
	 * Each block folder must contain a `block.json`. Dynamic rendering is
	 * handled via the `render` property inside that file, so no per-block
	 * PHP wiring is required here.
	 */
	public static function register_blocks() {
		$blocks_dir = FRAK_PLUGIN_DIR . 'includes/blocks';
		if ( ! is_dir( $blocks_dir ) ) {
			return;
		}

		$folders = glob( $blocks_dir . '/*', GLOB_ONLYDIR );
		if ( empty( $folders ) ) {
			return;
		}

		foreach ( $folders as $folder ) {
			if ( file_exists( $folder . '/block.json' ) ) {
				register_block_type( $folder );
			}
		}
	}
}
