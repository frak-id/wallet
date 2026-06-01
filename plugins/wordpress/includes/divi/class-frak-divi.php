<?php
/**
 * Divi Builder integration entry point.
 *
 * Registers three native Divi modules (Banner, Share Button, Post-Purchase)
 * that mirror the Gutenberg blocks 1:1. All rendering goes through
 * {@see Frak_Component_Renderer} so every insertion surface emits identical
 * HTML.
 *
 * Registration is wired through Divi's canonical `et_builder_ready` action so
 * boot order between Divi and this plugin doesn't matter — when Divi is absent
 * the action never fires and the integration is a no-op, so merchants without
 * Divi pay no per-request cost. When Divi has already booted by the time
 * {@see init()} runs we register synchronously to avoid a one-tick deferral.
 *
 * Unlike Elementor there is no per-panel "category" API for third-party Divi 4
 * modules: the official Divi extension SDK exposes no `$module_category`
 * property, so the modules surface in the standard module list under their
 * `Frak …` display names (searchable by typing "Frak" in the module picker).
 *
 * The SDK itself loads through the standard {@see Frak_Frontend::enqueue_scripts()}
 * pipeline because Divi's Visual Builder renders the actual frontend page. The
 * frontend config script branches on {@see is_editor_context()} to flip
 * `waitForBackendConfig` off so `<frak-X preview>` renders immediately, even on
 * local dev without a real backend handshake.
 *
 * Each module declares `$vb_support = 'on'` (full Visual Builder support), so
 * Divi drives the live in-builder preview from a registered React component
 * rather than AJAX-re-running the PHP render. Those React twins ship as a
 * single hand-authored, no-build JS file (`includes/divi/builder-modules.js`)
 * enqueued only inside the builder by {@see enqueue_builder_modules()}; they
 * are thin wrappers that forward the merchant's fields to the same `<frak-*>`
 * web components the PHP renderer emits. Registering them silences Divi's
 * "module has no React component" notice and replaces the laggy AJAX preview
 * with an instant one.
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_Divi
 */
class Frak_Divi {

	/**
	 * Wire the Divi hooks.
	 *
	 * Called once from {@see Frak_Plugin::boot()}. Registration is gated
	 * through the `et_builder_ready` action, which fires once Divi's builder
	 * registry is ready. Hooking the action covers the case where Divi loads
	 * after this plugin, and the `did_action()` short-circuit covers the case
	 * where Divi has already booted by the time we run.
	 */
	public static function init() {
		// The React twins that power the full-VB live preview load only inside
		// the builder; the gate lives in {@see enqueue_builder_modules()} so
		// registering the hook stays a cheap no-op on every public request and
		// when Divi is absent (the callback short-circuits on
		// {@see is_editor_context()}).
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue_builder_modules' ) );

		if ( did_action( 'et_builder_ready' ) ) {
			self::register_modules();
			return;
		}
		add_action( 'et_builder_ready', array( __CLASS__, 'register_modules' ) );
	}

	/**
	 * Instantiate the three concrete modules. The `ET_Builder_Module`
	 * constructor self-registers each instance with Divi's module registry
	 * (via `ET_Builder_Element::_add_module_to_list()`), so no explicit
	 * manager call is needed — contrast Elementor's `$widgets_manager->register()`.
	 *
	 * The instances are collected into a local array (then released) so the
	 * side-effecting constructors are not bare, discarded `new` statements;
	 * Divi retains its own references through the registry, so nothing further
	 * is kept here.
	 *
	 * @return void
	 */
	public static function register_modules() {
		$modules = array(
			new Frak_Divi_Banner_Module(),
			new Frak_Divi_Share_Button_Module(),
			new Frak_Divi_Post_Purchase_Module(),
		);
		unset( $modules );
	}

	/**
	 * Enqueue the React twins that drive the full Visual Builder preview.
	 *
	 * Hooked on `wp_enqueue_scripts` but gated on {@see is_editor_context()},
	 * so the script downloads only inside the builder — public visitors and
	 * sites without Divi never pay for it.
	 *
	 * Declares `react` + `jquery` as dependencies: the file builds its
	 * components with `window.React` and registers them through
	 * `jQuery( window ).on( 'et_builder_api_ready', … )`, both guaranteed in
	 * the builder context. This mirrors the enqueue pattern in Elegant Themes'
	 * own `d5-extension-example-modules` and needs no build pipeline — the JS
	 * is hand-authored `React.createElement`, like the block `editor.js` files.
	 *
	 * @return void
	 */
	public static function enqueue_builder_modules() {
		if ( ! self::is_editor_context() ) {
			return;
		}
		wp_enqueue_script(
			'frak-divi-builder-modules',
			FRAK_PLUGIN_URL . 'includes/divi/builder-modules.js',
			array( 'react', 'jquery' ),
			FRAK_PLUGIN_VERSION,
			true
		);
	}

	/**
	 * Whether the current request is rendering inside the Divi Visual Builder.
	 *
	 * Divi calls the module's `render()` for both the public frontend and the
	 * Visual Builder (the latter over AJAX for `partial` VB support);
	 * `et_core_is_fb_enabled()` returns true only in the builder, so it cleanly
	 * distinguishes the two.
	 *
	 * Used by:
	 *   - {@see Frak_Divi_Module_Base::render()} to forward the `preview` flag
	 *     so web components bypass the backend RPC gates and paint their
	 *     preview state in the editor.
	 *   - {@see Frak_Frontend::generate_config_script()} to flip
	 *     `waitForBackendConfig` off in the builder.
	 *
	 * @return bool
	 */
	public static function is_editor_context(): bool {
		return function_exists( 'et_core_is_fb_enabled' ) && et_core_is_fb_enabled();
	}
}
