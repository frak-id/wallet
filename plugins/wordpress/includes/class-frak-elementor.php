<?php
/**
 * Elementor integration entry point.
 *
 * Registers a "Frak" category in the Elementor widget panel and three native
 * Elementor widgets (Banner, Share Button, Post-Purchase) that mirror the
 * Gutenberg blocks 1:1. All rendering goes through {@see Frak_Component_Renderer}
 * so block / shortcode / sidebar widget / Elementor widget surfaces emit
 * byte-identical HTML.
 *
 * Registration is wired through the canonical `elementor/loaded` action so
 * boot order between Elementor and this plugin doesn't matter — when
 * Elementor is absent the action never fires and the integration is a
 * no-op, so merchants without Elementor pay no per-request cost. When
 * Elementor has already booted by the time {@see init()} runs (typical for
 * `plugins_loaded@10` after Elementor's `plugins_loaded@0`) we register
 * synchronously to avoid a one-tick deferral.
 *
 * The SDK itself loads through the standard {@see Frak_Frontend::enqueue_scripts()}
 * pipeline because Elementor's preview iframe loads the actual frontend page
 * (the editor only injects controls / canvas chrome around it). The frontend
 * config script branches on {@see is_editor_context()} to flip
 * `waitForBackendConfig` off so `<frak-X preview>` renders immediately, even
 * on local dev without a real backend handshake.
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_Elementor
 */
class Frak_Elementor {

	/**
	 * Slug used for the custom Elementor widget-panel category. Shared with
	 * the concrete widgets via {@see Frak_Elementor_Widget_Base::get_categories()}.
	 */
	public const CATEGORY = 'frak';

	/**
	 * Wire the Elementor hooks.
	 *
	 * Called once from {@see Frak_Plugin::boot()}. Registration is gated
	 * through the `elementor/loaded` action, which fires during Elementor's
	 * own bootstrap on `plugins_loaded`. Hooking the action covers the case
	 * where Elementor loads after this plugin (alphabetical plugin order), and
	 * the `did_action()` short-circuit covers the typical case where Elementor
	 * has already booted by the time we run.
	 */
	public static function init() {
		if ( did_action( 'elementor/loaded' ) ) {
			self::register_hooks();
			return;
		}
		add_action( 'elementor/loaded', array( __CLASS__, 'register_hooks' ) );
	}

	/**
	 * Register the category + widget hooks. Split out from {@see init()} so
	 * it can be invoked synchronously when Elementor has already booted, or
	 * deferred to the `elementor/loaded` action when it hasn't.
	 */
	public static function register_hooks() {
		add_action( 'elementor/elements/categories_registered', array( __CLASS__, 'register_category' ) );
		add_action( 'elementor/widgets/register', array( __CLASS__, 'register_widgets' ) );
	}

	/**
	 * Register the "Frak" category in the Elementor widget panel.
	 *
	 * Uses an Eicon (Elementor's icon font) so the entry visually matches
	 * the rest of the panel without bundling a custom SVG. The slug is the
	 * same one each widget returns from `get_categories()`.
	 *
	 * @param \Elementor\Elements_Manager $elements_manager Elementor manager.
	 */
	public static function register_category( $elements_manager ) {
		$elements_manager->add_category(
			self::CATEGORY,
			array(
				'title' => esc_html__( 'Frak', 'frak' ),
				'icon'  => 'eicon-megaphone',
			)
		);
	}

	/**
	 * Register the three concrete widgets with Elementor's widgets manager.
	 *
	 * @param \Elementor\Widgets_Manager $widgets_manager Elementor manager.
	 */
	public static function register_widgets( $widgets_manager ) {
		$widgets_manager->register( new Frak_Elementor_Banner_Widget() );
		$widgets_manager->register( new Frak_Elementor_Share_Button_Widget() );
		$widgets_manager->register( new Frak_Elementor_Post_Purchase_Widget() );
	}

	/**
	 * Whether the current request is rendering for the Elementor editor.
	 *
	 * Returns true on:
	 *   - the editor admin page (`?action=elementor`) — `is_edit_mode()`
	 *   - the preview iframe (`?elementor-preview=...`) — `is_preview_mode()`
	 *   - admin-ajax widget rendering (`action=elementor_ajax`)
	 *
	 * Used by:
	 *   - {@see Frak_Elementor_Widget_Base::render()} to swap real markup for
	 *     the `preview` variant that bypasses backend RPC gates.
	 *   - {@see Frak_Frontend::generate_config_script()} to flip
	 *     `waitForBackendConfig` off in the preview iframe.
	 *   - {@see Frak_Shortcodes::is_renderable_context()} to allow shortcode
	 *     rendering inside Elementor's REST / AJAX render paths.
	 *
	 * @return bool
	 */
	public static function is_editor_context(): bool {
		if ( ! did_action( 'elementor/loaded' ) ) {
			return false;
		}
		if ( ! class_exists( '\Elementor\Plugin' ) ) {
			return false;
		}

		$plugin = \Elementor\Plugin::$instance;
		if ( ! $plugin ) {
			return false;
		}

		// `editor` and `preview` are populated lazily by Elementor's bootstrap
		// (see `core/common/app.php`), so isset() guards are required for
		// edge cases where a hook fires before the editor module is wired.
		if ( isset( $plugin->editor ) && method_exists( $plugin->editor, 'is_edit_mode' ) && $plugin->editor->is_edit_mode() ) {
			return true;
		}
		if ( isset( $plugin->preview ) && method_exists( $plugin->preview, 'is_preview_mode' ) && $plugin->preview->is_preview_mode() ) {
			return true;
		}

		// Elementor's editor sends widget render requests through admin-ajax
		// (`action=elementor_ajax`). Gate on `wp_doing_ajax()` so a frontend page
		// load with `?action=elementor_ajax` in the query string can't trick us
		// into emitting preview-mode HTML / `waitForBackendConfig: false` for
		// public visitors. Read-only check — no nonce needed because we only
		// branch rendering behaviour, never mutate state.
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only context detection.
		if ( wp_doing_ajax() && isset( $_REQUEST['action'] ) && 'elementor_ajax' === $_REQUEST['action'] ) {
			return true;
		}

		return false;
	}
}
