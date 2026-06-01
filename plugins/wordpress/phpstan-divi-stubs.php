<?php
/**
 * Minimal Divi Builder stubs for PHPStan.
 *
 * Used solely by static analysis (referenced from `phpstan.neon` via
 * `scanFiles`). Production code never loads this file — when the Divi theme
 * (or the Divi Builder plugin) is active it ships the real classes; when it
 * isn't, our integration is gated on the `et_builder_ready` action so these
 * symbols are never referenced at runtime.
 *
 * Stubs are kept as thin as possible — only the surface our
 * `class-frak-divi*.php` files actually touch. Adding a new field accessor or
 * helper? Stub it here so PHPStan keeps passing.
 *
 * @package Frak_Integration
 */

if ( ! class_exists( 'ET_Builder_Module' ) ) {
	/**
	 * Stub for Divi's builder module base class.
	 */
	abstract class ET_Builder_Module {

		/**
		 * Processed field values, keyed by the field names declared in
		 * {@see get_fields()}.
		 *
		 * @var array<string, mixed>
		 */
		public $props = array();

		/**
		 * Module display name, set in {@see init()}.
		 *
		 * @var string
		 */
		public $name = '';

		/**
		 * Unique module slug (doubles as the shortcode tag).
		 *
		 * @var string
		 */
		public $slug = '';

		/**
		 * Visual Builder support level: 'off' | 'partial' | 'on'.
		 *
		 * @var string
		 */
		public $vb_support = '';

		/**
		 * ETmodules font-icon character shown in the module list / builder.
		 *
		 * @var string
		 */
		public $icon = '';

		/**
		 * Absolute path to a custom SVG icon. Takes precedence over `$icon`.
		 *
		 * @var string
		 */
		public $icon_path = '';

		/**
		 * Design-tab (advanced) options config. Emptied to opt out of the
		 * auto-added typography / spacing / border controls.
		 *
		 * @var array<string, mixed>
		 */
		public $advanced_fields = array();

		/**
		 * Settings-modal toggle (accordion) definitions.
		 *
		 * @var array<string, mixed>
		 */
		public $settings_modal_toggles = array();

		/**
		 * @return void
		 */
		public function init() {
		}

		/**
		 * @return array<string, array<string, mixed>>
		 */
		public function get_fields() {
			return array();
		}

		/**
		 * @param array<string, string> $attrs       Raw shortcode attributes.
		 * @param string|null           $content     Inner content.
		 * @param string                $render_slug Module slug being rendered.
		 * @return string
		 */
		public function render( $attrs, $content, $render_slug ) {
			return '';
		}

		/**
		 * Wrap rendered output in Divi's standard module container.
		 *
		 * @param string $output      Rendered module HTML.
		 * @param string $render_slug Module slug being rendered.
		 * @return string
		 */
		protected function _render_module_wrapper( $output, $render_slug ) {
			return $output;
		}
	}
}

if ( ! function_exists( 'et_core_is_fb_enabled' ) ) {
	/**
	 * Stub for Divi's Visual Builder detection helper.
	 *
	 * @return bool
	 */
	function et_core_is_fb_enabled() {
		return false;
	}
}
