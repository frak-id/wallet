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
	 * Register every bundled block via its `block.json` manifest.
	 *
	 * Called from {@see Frak_Plugin::init()} which already runs on the `init`
	 * action — we register synchronously instead of nesting another `init`
	 * hook from inside one (same-priority callbacks added during iteration are
	 * unreliable in `WP_Hook::apply_filters`).
	 */
	public static function init() {
		self::register_blocks();
		add_action( 'enqueue_block_editor_assets', array( __CLASS__, 'enqueue_editor_assets' ) );
	}

	/**
	 * Register every bundled block via its `block.json` manifest.
	 */
	public static function register_blocks() {
		foreach ( self::BLOCKS as $slug ) {
			register_block_type( FRAK_PLUGIN_DIR . 'includes/blocks/' . $slug );
		}
	}

	/**
	 * Load the Frak SDK CDN inside the block editor so the bundled blocks can
	 * render the real web components with their `preview` attribute — giving
	 * merchants a faithful preview of Banner / Post-Purchase / Share Button.
	 *
	 * Each block's `editor.asset.php` lists `frak-sdk` as a dependency so
	 * WordPress forwards the script into the block-editor iframe in the right
	 * order.
	 */
	public static function enqueue_editor_assets() {
		wp_register_script(
			'frak-sdk',
			'https://cdn.jsdelivr.net/npm/@frak-labs/components',
			array(),
			null, // phpcs:ignore WordPress.WP.EnqueuedResourceParameters -- CDN serves latest version; avoid ?ver= query param.
			true
		);

		wp_add_inline_script( 'frak-sdk', self::generate_editor_config_script(), 'before' );

		wp_enqueue_script( 'frak-sdk' );
	}

	/**
	 * Build the inline `window.FrakSetup` stub used in the block editor.
	 *
	 * `waitForBackendConfig: false` short-circuits the SDK's "wait for
	 * backend-resolved config" gate so `<frak-banner preview>`,
	 * `<frak-post-purchase preview>` and `<frak-button-share preview>` render
	 * immediately in the editor iframe without a real Frak client.
	 *
	 * @return string
	 */
	private static function generate_editor_config_script() {
		$app_name_raw = Frak_Settings::get( 'app_name' );
		$app_name     = '' !== $app_name_raw ? $app_name_raw : get_bloginfo( 'name' );
		$logo_url     = Frak_Settings::get( 'logo_url' );

		$metadata = array_filter(
			array(
				'name'    => $app_name,
				'logoUrl' => '' !== $logo_url ? $logo_url : null,
			),
			static function ( $value ) {
				return null !== $value && '' !== $value;
			}
		);

		$config = array(
			'waitForBackendConfig' => false,
			'metadata'             => $metadata,
		);

		$config_json = wp_json_encode( $config, JSON_UNESCAPED_SLASHES );

		return sprintf(
			'window.FrakSetup=Object.assign(window.FrakSetup||{},{config:%s});',
			$config_json
		);
	}
}
