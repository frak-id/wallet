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
 * Gated on `did_action( 'elementor/loaded' )` (see {@see init()}). Without
 * Elementor active the entire integration is a no-op so the merchant pays no
 * per-request cost when running classic / Gutenberg only.
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
	 * Called once from {@see Frak_Plugin::boot()}. Bails when Elementor isn't
	 * active so dropping Elementor never breaks the plugin and merchants
	 * without Elementor pay no per-request cost.
	 */
	public static function init() {
		if ( ! did_action( 'elementor/loaded' ) ) {
			return;
		}

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
		// (`action=elementor_ajax`). Detect via $_REQUEST so both POST and GET
		// flavours match. Read-only check — no nonce needed because we only
		// branch rendering behaviour, never mutate state.
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only context detection.
		if ( isset( $_REQUEST['action'] ) && 'elementor_ajax' === $_REQUEST['action'] ) {
			return true;
		}

		return false;
	}
}
