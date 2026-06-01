<?php
/**
 * Divi module wrapping `<frak-button-share>`.
 *
 * Mirrors the `frak/share-button` Gutenberg block + Elementor widget 1:1 —
 * same controls, same defaults — and delegates rendering to
 * {@see Frak_Component_Renderer::share_button()} so the emitted HTML matches
 * every other surface byte-for-byte.
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_Divi_Share_Button_Module
 */
class Frak_Divi_Share_Button_Module extends Frak_Divi_Module_Base {

	/**
	 * Unique module slug. Prefixed `frak_divi_` to avoid colliding with the
	 * `[frak_share_button]` shortcode tag registered by {@see Frak_Shortcodes}.
	 *
	 * @var string
	 */
	public $slug = 'frak_divi_share_button';

	/**
	 * Set the display name + the settings-modal toggles, and disable the
	 * Design-tab options (see {@see Frak_Divi_Module_Base}).
	 *
	 * @return void
	 */
	public function init() {
		$this->name      = esc_html__( 'Frak Share Button', 'frak' );
		$this->icon_path = FRAK_PLUGIN_DIR . 'includes/divi/icons/share-button.svg';

		$this->settings_modal_toggles = array(
			'general' => array(
				'toggles' => array(
					'button'   => esc_html__( 'Button', 'frak' ),
					'advanced' => esc_html__( 'Advanced', 'frak' ),
				),
			),
		);

		$this->disable_design_options();
	}

	/**
	 * Field names forwarded to {@see Frak_Component_Renderer::share_button()}.
	 *
	 * @return string[]
	 */
	protected function field_keys(): array {
		return array(
			'text',
			'button_style',
			'no_reward_text',
			'click_action',
			'placement',
			'target_interaction',
			'classname',
		);
	}

	/**
	 * Divi field schema. Mirrors the Gutenberg `frak/share-button` block
	 * inspector: Button (primary copy + style) and Advanced.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	public function get_fields(): array {
		return array_merge(
			array(
				'text'               => array(
					'label'           => esc_html__( 'Button text', 'frak' ),
					'type'            => 'text',
					'option_category' => 'basic_option',
					'default'         => esc_html__( 'Share and earn!', 'frak' ),
					'description'     => esc_html__( 'Use {REWARD} to inject the reward amount at runtime.', 'frak' ),
					'toggle_slug'     => 'button',
				),
				'button_style'       => array(
					'label'           => esc_html__( 'Button style', 'frak' ),
					'type'            => 'select',
					'option_category' => 'configuration',
					'options'         => array(
						'primary'   => esc_html__( 'Primary (theme button)', 'frak' ),
						'secondary' => esc_html__( 'Secondary (outline)', 'frak' ),
						'none'      => esc_html__( 'None (custom class only)', 'frak' ),
					),
					'default'         => 'primary',
					'description'     => esc_html__( 'Applies WordPress button classes so the button inherits your theme styling.', 'frak' ),
					'toggle_slug'     => 'button',
				),
				'no_reward_text'     => array(
					'label'           => esc_html__( 'Fallback text (no reward)', 'frak' ),
					'type'            => 'text',
					'option_category' => 'basic_option',
					'description'     => esc_html__( 'Shown when the button text contains {REWARD} but no reward is available.', 'frak' ),
					'toggle_slug'     => 'button',
				),
				'click_action'       => array(
					'label'           => esc_html__( 'Click action', 'frak' ),
					'type'            => 'select',
					'option_category' => 'configuration',
					'options'         => array(
						'sharing-page'    => esc_html__( 'Sharing page', 'frak' ),
						'embedded-wallet' => esc_html__( 'Embedded wallet', 'frak' ),
					),
					'default'         => 'sharing-page',
					'description'     => esc_html__( 'Override what happens when the button is clicked.', 'frak' ),
					'toggle_slug'     => 'advanced',
				),
				'target_interaction' => array(
					'label'           => esc_html__( 'Target interaction', 'frak' ),
					'type'            => 'text',
					'option_category' => 'basic_option',
					'toggle_slug'     => 'advanced',
				),
			),
			$this->advanced_fields_common()
		);
	}

	/**
	 * Delegate to the shared renderer.
	 *
	 * @param array<string, mixed> $attrs   Filtered renderer attributes.
	 * @param bool                 $preview Whether the bare `preview` attribute should be emitted.
	 * @return string
	 */
	protected function render_component( array $attrs, bool $preview ): string {
		return Frak_Component_Renderer::share_button( $attrs, '', $preview );
	}
}
