<?php
/**
 * Sidebar widget registrar.
 *
 * Hooks `widgets_init` and registers the three concrete `WP_Widget`
 * subclasses shipped by the plugin:
 *
 *   - {@see Frak_Banner_Widget}
 *   - {@see Frak_Share_Button_Widget}
 *   - {@see Frak_Post_Purchase_Widget}
 *
 * Each widget delegates rendering to {@see Frak_Component_Renderer} so the
 * output matches the block and shortcode surfaces byte-for-byte. Registration
 * lives in its own class (rather than in the widget constructors) because
 * `WP_Widget::__construct()` is invoked once per widget instance by core —
 * self-registration would fire on every widget render, not once per request.
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_Widgets
 */
class Frak_Widgets {

	/**
	 * Hook the registration. Called once from {@see Frak_Plugin::init()}.
	 */
	public static function init() {
		add_action( 'widgets_init', array( __CLASS__, 'register' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_media_picker' ) );
		add_action( 'customize_controls_enqueue_scripts', array( __CLASS__, 'enqueue_media_picker_customizer' ) );
	}

	/**
	 * Register each widget with the core widget factory.
	 */
	public static function register() {
		register_widget( 'Frak_Banner_Widget' );
		register_widget( 'Frak_Share_Button_Widget' );
		register_widget( 'Frak_Post_Purchase_Widget' );
	}

	/**
	 * Enqueue the WP media library + our small picker glue on the classic
	 * widgets admin screen. Gated on the page hook so we don't inflate
	 * every admin page with `wp.media`'s ~150 KB of dependencies.
	 *
	 * @param string $hook Current admin page hook.
	 */
	public static function enqueue_media_picker( $hook ) {
		if ( 'widgets.php' !== $hook ) {
			return;
		}
		self::enqueue_media_picker_assets();
	}

	/**
	 * Same as {@see enqueue_media_picker()} but for the Customizer surface,
	 * which fires a different hook (`customize_controls_enqueue_scripts`)
	 * and has no `$hook_suffix` gating.
	 */
	public static function enqueue_media_picker_customizer() {
		self::enqueue_media_picker_assets();
	}

	/**
	 * Shared enqueue body. Lives in a private helper so the two entry
	 * points stay one-liners.
	 */
	private static function enqueue_media_picker_assets() {
		wp_enqueue_media();
		wp_enqueue_script(
			'frak-widget-media',
			FRAK_PLUGIN_URL . 'admin/js/widget-media.js',
			array( 'jquery', 'media-editor' ),
			FRAK_PLUGIN_VERSION,
			true
		);
	}
}
