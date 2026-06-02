<?php
/**
 * Divi module wrapping `<frak-banner>`.
 *
 * Mirrors the `frak/banner` Gutenberg block + Elementor widget 1:1 — same
 * controls, same defaults — and delegates rendering to
 * {@see Frak_Component_Renderer::banner()} so the emitted HTML matches every
 * other surface byte-for-byte.
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_Divi_Banner_Module
 */
class Frak_Divi_Banner_Module extends Frak_Divi_Module_Base {

	/**
	 * Unique module slug. Prefixed `frak_divi_` to avoid colliding with the
	 * `[frak_banner]` shortcode tag registered by {@see Frak_Shortcodes}.
	 *
	 * @var string
	 */
	public $slug = 'frak_divi_banner';

	/**
	 * Set the display name + the settings-modal toggles, and disable the
	 * Design-tab options (see {@see Frak_Divi_Module_Base}).
	 *
	 * @return void
	 */
	public function init() {
		$this->name      = esc_html__( 'Frak Banner', 'frak' );
		$this->icon_path = FRAK_PLUGIN_DIR . 'includes/divi/icons/banner.svg';

		$this->settings_modal_toggles = array(
			'general' => array(
				'toggles' => array(
					'referral' => esc_html__( 'Referral mode', 'frak' ),
					'inapp'    => esc_html__( 'In-app browser mode', 'frak' ),
					'image'    => esc_html__( 'Image', 'frak' ),
					'preview'  => esc_html__( 'Editor preview', 'frak' ),
					'advanced' => esc_html__( 'Advanced', 'frak' ),
				),
			),
		);

		$this->disable_design_options();
	}

	/**
	 * Field names forwarded to {@see Frak_Component_Renderer::banner()}.
	 * `preview_mode` is editor-only and stripped before the renderer call.
	 *
	 * @return string[]
	 */
	protected function field_keys(): array {
		return array(
			'referral_title',
			'referral_description',
			'referral_cta',
			'inapp_title',
			'inapp_description',
			'inapp_cta',
			'allow_inapp_redirect',
			'image_url',
			'preview_mode',
			'placement',
			'interaction',
			'classname',
		);
	}

	/**
	 * Divi field schema. Mirrors the Gutenberg `frak/banner` block inspector:
	 * Referral mode, In-app browser mode, Image, Editor preview, Advanced.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	public function get_fields(): array {
		return array_merge(
			array(
				'referral_title'       => array(
					'label'           => esc_html__( 'Title', 'frak' ),
					'type'            => 'text',
					'option_category' => 'basic_option',
					'toggle_slug'     => 'referral',
				),
				'referral_description' => array(
					'label'           => esc_html__( 'Description', 'frak' ),
					'type'            => 'textarea',
					'option_category' => 'basic_option',
					'toggle_slug'     => 'referral',
				),
				'referral_cta'         => array(
					'label'           => esc_html__( 'CTA label', 'frak' ),
					'type'            => 'text',
					'option_category' => 'basic_option',
					'toggle_slug'     => 'referral',
				),
				'inapp_title'          => array(
					'label'           => esc_html__( 'Title', 'frak' ),
					'type'            => 'text',
					'option_category' => 'basic_option',
					'toggle_slug'     => 'inapp',
				),
				'inapp_description'    => array(
					'label'           => esc_html__( 'Description', 'frak' ),
					'type'            => 'textarea',
					'option_category' => 'basic_option',
					'toggle_slug'     => 'inapp',
				),
				'inapp_cta'            => array(
					'label'           => esc_html__( 'CTA label', 'frak' ),
					'type'            => 'text',
					'option_category' => 'basic_option',
					'toggle_slug'     => 'inapp',
				),
				'allow_inapp_redirect' => array(
					'label'           => esc_html__( 'Allow in-app browser redirect', 'frak' ),
					'type'            => 'yes_no_button',
					'option_category' => 'configuration',
					'options'         => array(
						'off' => esc_html__( 'Off', 'frak' ),
						'on'  => esc_html__( 'On', 'frak' ),
					),
					'default'         => 'off',
					'description'     => esc_html__( 'When enabled, prompts users opening this page in Instagram or Facebook in-app browsers to switch to their system browser. Disabled by default — enable only on surfaces that drive users into a flow requiring WebAuthn (passkey login, transaction signing).', 'frak' ),
					'toggle_slug'     => 'inapp',
				),
				'image_url'            => array(
					'label'              => esc_html__( 'Image', 'frak' ),
					'type'               => 'upload',
					'option_category'    => 'basic_option',
					'upload_button_text' => esc_attr__( 'Upload an image', 'frak' ),
					'choose_text'        => esc_attr__( 'Choose an image', 'frak' ),
					'update_text'        => esc_attr__( 'Set as image', 'frak' ),
					'description'        => esc_html__( 'Override the gift icon on the left. Leave empty to keep the default.', 'frak' ),
					'toggle_slug'        => 'image',
				),
				'preview_mode'         => array(
					'label'           => esc_html__( 'Preview mode', 'frak' ),
					'type'            => 'select',
					'option_category' => 'configuration',
					'options'         => array(
						'referral' => esc_html__( 'Referral success', 'frak' ),
						'inapp'    => esc_html__( 'In-app browser prompt', 'frak' ),
						'none'     => esc_html__( 'Disabled', 'frak' ),
					),
					'default'         => 'referral',
					'description'     => esc_html__( 'Only affects the builder preview — at runtime the mode is picked from the request context. Choose "Disabled" to hide the preview in the builder (useful when the banner sits in a global header / footer / theme-builder template, where it would otherwise show on every page being edited).', 'frak' ),
					'toggle_slug'     => 'preview',
				),
				'interaction'          => array(
					'label'           => esc_html__( 'Interaction filter', 'frak' ),
					'type'            => 'text',
					'option_category' => 'basic_option',
					'description'     => esc_html__( 'e.g. "purchase" to limit rewards to a specific interaction.', 'frak' ),
					'toggle_slug'     => 'advanced',
				),
			),
			$this->advanced_fields_common()
		);
	}

	/**
	 * Delegate to the shared renderer.
	 *
	 * `previewMode` is editor-only — it sets the `<frak-banner preview-mode="…">`
	 * companion attribute telling the web component which preview state to
	 * paint. Outside the editor (`$preview = false`) it's stripped before the
	 * renderer call so it never leaks as an unknown HTML attribute.
	 *
	 * The `none` value disables the builder preview entirely: a banner placed
	 * in a global header / footer / theme-builder template otherwise paints on
	 * every page the merchant edits. When selected, the editor render emits
	 * nothing (the matching short-circuit lives in the React twin in
	 * `builder-modules.js` for the live preview). The public frontend is never
	 * affected — `$preview` is false there, so this branch is skipped and the
	 * banner renders normally from the request context.
	 *
	 * @param array<string, mixed> $attrs   Filtered renderer attributes.
	 * @param bool                 $preview Whether the bare `preview` attribute should be emitted.
	 * @return string
	 */
	protected function render_component( array $attrs, bool $preview ): string {
		if ( $preview && isset( $attrs['previewMode'] ) && 'none' === $attrs['previewMode'] ) {
			return '';
		}

		$preview_overrides = array();
		if ( $preview && ! empty( $attrs['previewMode'] ) ) {
			$preview_overrides['preview-mode'] = (string) $attrs['previewMode'];
		}
		unset( $attrs['previewMode'] );

		return Frak_Component_Renderer::banner( $attrs, '', $preview, $preview_overrides );
	}
}
