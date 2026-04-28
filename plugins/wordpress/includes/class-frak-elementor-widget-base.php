<?php
/**
 * Base class for Frak Elementor widgets.
 *
 * Subclasses declare:
 *   - `get_name()`, `get_title()`, `get_icon()`, `get_keywords()`
 *   - `register_controls()` — Elementor control schema (sections + controls)
 *   - `setting_keys()` — whitelist of settings forwarded to the renderer
 *   - `render_component()` — delegate to {@see Frak_Component_Renderer}
 *
 * Shared concerns lifted into the base:
 *   - `get_categories()` returns the shared `frak` panel category.
 *   - `get_custom_help_url()` points the widget's "?" affordance to the
 *     public Frak component docs so merchants can self-serve from the panel.
 *   - `render()` extracts the whitelisted settings, detects the editor /
 *     preview context, then echoes the renderer output. The `preview` flag
 *     is forwarded so web components bypass backend RPC gates that would
 *     otherwise keep them hidden until a referral / merchant context exists.
 *   - {@see content_template()} is intentionally NOT implemented. Pure-PHP
 *     `render()` keeps a single source of truth (the renderer) and the web
 *     components handle their own DOM lifecycle when Elementor re-runs the
 *     PHP render on each setting change. Adding a JS twin would either
 *     duplicate logic or skip the renderer entirely on live preview.
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_Elementor_Widget_Base
 */
abstract class Frak_Elementor_Widget_Base extends \Elementor\Widget_Base {

	/**
	 * Surface every Frak widget under the dedicated "Frak" category in the
	 * panel so merchants find them grouped instead of scattered through
	 * "Basic" / "General".
	 *
	 * @return string[]
	 */
	public function get_categories(): array {
		return array( Frak_Elementor::CATEGORY );
	}

	/**
	 * Surface a "?" affordance in the widget's panel header pointing at the
	 * public component docs. Same URL the plugin metadata uses (see
	 * `frak-integration.php` plugin header).
	 *
	 * @return string
	 */
	public function get_custom_help_url(): string {
		return 'https://docs.frak.id/components/frak-setup';
	}

	/**
	 * Whitelist of Elementor setting keys forwarded to the renderer.
	 *
	 * Elementor merges its own internal keys (`_padding`, `_margin`, custom
	 * CSS, etc.) into the settings array, plus any controls the widget
	 * defines for advanced styling. Forwarding the full bag would leak those
	 * as unknown HTML attributes on the web component, so each subclass
	 * declares the camelCase keys that map to {@see Frak_Component_Renderer}.
	 *
	 * @return string[]
	 */
	abstract protected function setting_keys(): array;

	/**
	 * Delegate to the shared renderer for the given (already-filtered)
	 * attribute bag. The `$preview` flag is true when rendering inside the
	 * Elementor editor / preview iframe — subclasses pass it straight to the
	 * matching `Frak_Component_Renderer` method.
	 *
	 * @param array<string, mixed> $attrs   Filtered renderer attributes.
	 * @param bool                 $preview Whether to emit the bare `preview` attribute.
	 * @return string
	 */
	abstract protected function render_component( array $attrs, bool $preview ): string;

	/**
	 * Render the widget on both frontend and editor preview.
	 *
	 * In editor mode the `preview` flag is forwarded to the renderer so
	 * the web component bypasses backend RPC gates that would otherwise
	 * keep it hidden until a referral / merchant context is detected.
	 */
	protected function render(): void {
		$attrs   = $this->extract_settings( $this->get_settings_for_display() );
		$preview = Frak_Elementor::is_editor_context();

		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Renderer escapes each attribute internally.
		echo $this->render_component( $attrs, $preview );
	}

	/**
	 * Filter the Elementor settings array down to renderer-relevant keys.
	 *
	 * Drops any control output (responsive variants, internal `_*` keys,
	 * etc.) that isn't part of the widget's declared schema so it doesn't
	 * leak to the web component as an unknown HTML attribute.
	 *
	 * @param array<string, mixed> $settings Settings from `get_settings_for_display()`.
	 * @return array<string, mixed>
	 */
	protected function extract_settings( array $settings ): array {
		$out = array();
		foreach ( $this->setting_keys() as $key ) {
			if ( array_key_exists( $key, $settings ) ) {
				$out[ $key ] = $settings[ $key ];
			}
		}
		return $out;
	}

	/**
	 * Coerce an Elementor SWITCHER value (`'yes'` / `''`) into the
	 * boolean shape the renderer expects for block-style boolean attributes.
	 *
	 * @param mixed $value Raw SWITCHER setting value.
	 * @return bool
	 */
	protected static function switcher_to_bool( $value ): bool {
		return 'yes' === $value;
	}
}
