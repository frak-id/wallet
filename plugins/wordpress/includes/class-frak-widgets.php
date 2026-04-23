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
	}

	/**
	 * Register each widget with the core widget factory.
	 */
	public static function register() {
		register_widget( 'Frak_Banner_Widget' );
		register_widget( 'Frak_Share_Button_Widget' );
		register_widget( 'Frak_Post_Purchase_Widget' );
	}
}
