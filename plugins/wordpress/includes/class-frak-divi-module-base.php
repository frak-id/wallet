<?php
/**
 * Base class for Frak Divi Builder modules.
 *
 * Divi counterpart to {@see Frak_Elementor_Widget_Base}. Surfaces the same
 * three components (Banner, Share Button, Post-Purchase) as native Divi
 * modules so merchants on a Divi theme find them in the module list and edit
 * them with the Visual Builder. All rendering goes through
 * {@see Frak_Component_Renderer} so block / shortcode / sidebar widget /
 * Elementor widget / Divi module surfaces emit byte-identical HTML.
 *
 * Subclasses declare:
 *   - `$slug` — unique module slug. Prefixed `frak_divi_*` so it never
 *     collides with the `[frak_*]` shortcode tags registered by
 *     {@see Frak_Shortcodes} (a Divi module slug doubles as a shortcode tag).
 *   - `init()` — set `$this->name` and the settings-modal toggles, then call
 *     {@see disable_design_options()}.
 *   - `get_fields()` — the Divi field schema (snake_case keys).
 *   - `field_keys()` — whitelist of field names forwarded to the renderer.
 *   - `render_component()` — delegate to {@see Frak_Component_Renderer}.
 *
 * Shared concerns lifted into the base:
 *   - `$vb_support = 'partial'` — Divi renders the PHP {@see render()} output
 *     via AJAX inside the Visual Builder, so the live preview works without a
 *     compiled React/JSX twin. Full (`'on'`) support would require shipping a
 *     JS component; `partial` keeps the PHP renderer as the single source of
 *     truth, matching the Elementor integration's deliberate pure-PHP render.
 *   - {@see render()} filters `$this->props` to the whitelisted keys,
 *     normalises snake_case → camelCase, detects the Visual Builder context,
 *     then returns the renderer output. The `preview` flag is forwarded so the
 *     web components bypass backend RPC gates that would otherwise keep them
 *     hidden until a referral / merchant context exists.
 *   - {@see disable_design_options()} empties `$this->advanced_fields`: the SDK
 *     web components ship hardcoded vanilla-extract styles whose class-level
 *     specificity overrides values inherited from the wrapper, so Divi's
 *     auto-added typography / spacing / border controls would either no-op or
 *     paint a misleading frame around the already-styled component. Same
 *     trade-off documented in {@see Frak_Elementor_Widget_Base}.
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_Divi_Module_Base
 */
abstract class Frak_Divi_Module_Base extends ET_Builder_Module {

	/**
	 * Visual Builder support level. `partial` renders the PHP {@see render()}
	 * output over AJAX — no JS/JSX component required.
	 *
	 * @var string
	 */
	public $vb_support = 'partial';

	/**
	 * Whitelist of Divi field names (snake_case) forwarded to the renderer.
	 *
	 * Divi merges its own internal keys (`_builder_version`, design-tab
	 * options, etc.) into `$this->props`; forwarding the full bag would leak
	 * those as unknown HTML attributes on the web component, so each subclass
	 * declares exactly the keys that map to {@see Frak_Component_Renderer}.
	 *
	 * @return string[]
	 */
	abstract protected function field_keys(): array;

	/**
	 * Delegate to the shared renderer for the given (already snake→camel
	 * normalised) attribute bag. The `$preview` flag is true when rendering
	 * inside the Visual Builder — subclasses pass it straight to the matching
	 * `Frak_Component_Renderer` method.
	 *
	 * @param array<string, mixed> $attrs   Filtered, camelCase renderer attributes.
	 * @param bool                 $preview Whether to emit the bare `preview` attribute.
	 * @return string
	 */
	abstract protected function render_component( array $attrs, bool $preview ): string;

	/**
	 * Render the module on both the frontend and the Visual Builder preview.
	 *
	 * Values are read from the processed `$this->props` bag (not the raw
	 * `$attrs` parameter, which carries unprocessed shortcode strings), so the
	 * first two signature parameters are intentionally unused.
	 *
	 * The renderer output is wrapped in Divi's standard module container via
	 * `_render_module_wrapper()`. This is required for `partial` Visual Builder
	 * support: the wrapper carries the `.et_pb_module` markup + data attributes
	 * the builder uses to locate and re-inject the module on each partial
	 * (AJAX) re-render. Without it the live preview updates unreliably — the
	 * symptom being components that fail to (re)appear in the editor. On the
	 * public frontend it yields the same wrapper every native Divi module emits.
	 *
	 * @param array<string, string> $attrs       Raw shortcode attributes (unused).
	 * @param string|null           $content     Inner content (unused).
	 * @param string                $render_slug Module slug being rendered.
	 * @return string
	 */
	public function render( $attrs, $content, $render_slug ): string {
		$preview = Frak_Divi::is_editor_context();
		$output  = $this->render_component( $this->extract_props(), $preview );
		return $this->_render_module_wrapper( $output, $render_slug );
	}

	/**
	 * Filter `$this->props` down to the renderer-relevant keys, then normalise
	 * snake_case field names to the renderer's camelCase keys.
	 *
	 * @return array<string, mixed>
	 */
	protected function extract_props(): array {
		$out = array();
		foreach ( $this->field_keys() as $key ) {
			if ( array_key_exists( $key, $this->props ) ) {
				$out[ $key ] = $this->props[ $key ];
			}
		}
		return Frak_Component_Renderer::snake_keys_to_camel( $out );
	}

	/**
	 * Shared `placement` + `classname` fields present on every Frak module,
	 * grouped under the common `advanced` toggle. Subclasses spread the
	 * returned array into their own {@see get_fields()} output.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	protected function advanced_fields_common(): array {
		return array(
			'placement' => array(
				'label'           => esc_html__( 'Placement ID', 'frak' ),
				'type'            => 'text',
				'option_category' => 'basic_option',
				'description'     => esc_html__( 'Backend placement identifier (optional).', 'frak' ),
				'toggle_slug'     => 'advanced',
			),
			'classname' => array(
				'label'           => esc_html__( 'CSS class name', 'frak' ),
				'type'            => 'text',
				'option_category' => 'basic_option',
				'toggle_slug'     => 'advanced',
			),
		);
	}

	/**
	 * Opt out of Divi's auto-added Design-tab options. Called from each
	 * subclass `init()`. See the class docblock for the rationale.
	 *
	 * @return void
	 */
	protected function disable_design_options(): void {
		$this->advanced_fields = array();
	}
}
