<?php
/**
 * Divi module wrapping `<frak-post-purchase>`.
 *
 * Mirrors the `frak/post-purchase` Gutenberg block + Elementor widget 1:1 —
 * same controls, same defaults — and delegates rendering to
 * {@see Frak_Component_Renderer::post_purchase()} so the emitted HTML matches
 * every other surface byte-for-byte.
 *
 * The renderer auto-injects the WooCommerce order context (customer-id /
 * order-id / token / products) when the module is dropped onto a thank-you or
 * view-order template — same behaviour as the block / shortcode / sidebar
 * widget / Elementor widget.
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_Divi_Post_Purchase_Module
 */
class Frak_Divi_Post_Purchase_Module extends Frak_Divi_Module_Base {

	/**
	 * Unique module slug. Prefixed `frak_divi_` to avoid colliding with the
	 * `[frak_post_purchase]` shortcode tag registered by {@see Frak_Shortcodes}.
	 *
	 * @var string
	 */
	public $slug = 'frak_divi_post_purchase';

	/**
	 * Set the display name + the settings-modal toggles, and disable the
	 * Design-tab options (see {@see Frak_Divi_Module_Base}).
	 *
	 * @return void
	 */
	public function init() {
		$this->name      = esc_html__( 'Frak Post-Purchase', 'frak' );
		$this->icon_path = FRAK_PLUGIN_DIR . 'includes/divi/icons/post-purchase.svg';

		$this->settings_modal_toggles = array(
			'general' => array(
				'toggles' => array(
					'copy'      => esc_html__( 'Copy', 'frak' ),
					'behaviour' => esc_html__( 'Behaviour', 'frak' ),
					'image'     => esc_html__( 'Image', 'frak' ),
					'preview'   => esc_html__( 'Editor preview', 'frak' ),
					'advanced'  => esc_html__( 'Advanced', 'frak' ),
				),
			),
		);

		$this->disable_design_options();
	}

	/**
	 * Field names forwarded to {@see Frak_Component_Renderer::post_purchase()}.
	 * `preview_variant` is editor-only and stripped before the renderer call.
	 *
	 * @return string[]
	 */
	protected function field_keys(): array {
		return array(
			'badge_text',
			'referrer_text',
			'referee_text',
			'cta_text',
			'variant',
			'sharing_url',
			'show_products',
			'image_url',
			'preview_variant',
			'placement',
			'merchant_id',
			'classname',
		);
	}

	/**
	 * Divi field schema. Mirrors the Gutenberg `frak/post-purchase` block
	 * inspector: Copy, Behaviour, Image, Editor preview, Advanced.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	public function get_fields(): array {
		return array_merge(
			array(
				'badge_text'      => array(
					'label'           => esc_html__( 'Badge text', 'frak' ),
					'type'            => 'text',
					'option_category' => 'basic_option',
					'toggle_slug'     => 'copy',
				),
				'referrer_text'   => array(
					'label'           => esc_html__( 'Referrer message', 'frak' ),
					'type'            => 'textarea',
					'option_category' => 'basic_option',
					'description'     => esc_html__( 'Shown to buyers who were not referred. Use {REWARD} for the reward amount.', 'frak' ),
					'toggle_slug'     => 'copy',
				),
				'referee_text'    => array(
					'label'           => esc_html__( 'Referee message', 'frak' ),
					'type'            => 'textarea',
					'option_category' => 'basic_option',
					'description'     => esc_html__( 'Shown to buyers who came from a referral link. Use {REWARD} for the reward amount.', 'frak' ),
					'toggle_slug'     => 'copy',
				),
				'cta_text'        => array(
					'label'           => esc_html__( 'CTA label', 'frak' ),
					'type'            => 'text',
					'option_category' => 'basic_option',
					'description'     => esc_html__( 'Use {REWARD} to inject the reward amount.', 'frak' ),
					'toggle_slug'     => 'copy',
				),
				'variant'         => array(
					'label'           => esc_html__( 'Forced variant', 'frak' ),
					'type'            => 'select',
					'option_category' => 'configuration',
					'options'         => array(
						''         => esc_html__( 'Auto (recommended)', 'frak' ),
						'referrer' => esc_html__( 'Referrer (invite to share)', 'frak' ),
						'referee'  => esc_html__( 'Referee (congratulations)', 'frak' ),
					),
					'default'         => '',
					'toggle_slug'     => 'behaviour',
				),
				'sharing_url'     => array(
					'label'           => esc_html__( 'Sharing URL', 'frak' ),
					'type'            => 'text',
					'option_category' => 'basic_option',
					'description'     => esc_html__( 'Defaults to the merchant domain if left empty.', 'frak' ),
					'toggle_slug'     => 'behaviour',
				),
				'show_products'   => array(
					'label'           => esc_html__( 'Show purchased products', 'frak' ),
					'type'            => 'yes_no_button',
					'option_category' => 'configuration',
					'options'         => array(
						'on'  => esc_html__( 'Show', 'frak' ),
						'off' => esc_html__( 'Hide', 'frak' ),
					),
					'default'         => 'on',
					'description'     => esc_html__( 'When enabled, the sharing page shows cards for the items in this order so referees can share specific products. Auto-injected from the WooCommerce order — takes effect on the live thank-you / view-order page.', 'frak' ),
					'toggle_slug'     => 'behaviour',
				),
				'image_url'       => array(
					'label'              => esc_html__( 'Image', 'frak' ),
					'type'               => 'upload',
					'option_category'    => 'basic_option',
					'upload_button_text' => esc_attr__( 'Upload an image', 'frak' ),
					'choose_text'        => esc_attr__( 'Choose an image', 'frak' ),
					'update_text'        => esc_attr__( 'Set as image', 'frak' ),
					'description'        => esc_html__( 'Override the gift icon on the left. Leave empty to keep the default.', 'frak' ),
					'toggle_slug'        => 'image',
				),
				'preview_variant' => array(
					'label'           => esc_html__( 'Preview variant', 'frak' ),
					'type'            => 'select',
					'option_category' => 'configuration',
					'options'         => array(
						'referrer' => esc_html__( 'Referrer (invite to share)', 'frak' ),
						'referee'  => esc_html__( 'Referee (congratulations)', 'frak' ),
					),
					'default'         => 'referrer',
					'description'     => esc_html__( 'Only affects the editor preview — at runtime the variant is picked from the referral status.', 'frak' ),
					'toggle_slug'     => 'preview',
				),
				'merchant_id'     => array(
					'label'           => esc_html__( 'Merchant ID override', 'frak' ),
					'type'            => 'text',
					'option_category' => 'basic_option',
					'description'     => esc_html__( 'Leave empty to use the merchant ID from the global config.', 'frak' ),
					'toggle_slug'     => 'advanced',
				),
			),
			$this->advanced_fields_common()
		);
	}

	/**
	 * Delegate to the shared renderer.
	 *
	 * `show_products` arrives as the Divi yes/no string (`'on'` / `'off'`),
	 * which the renderer's `should_show_products()` gate already understands,
	 * so no boolean coercion is needed.
	 *
	 * `previewVariant` is editor-only — it sets the
	 * `<frak-post-purchase preview-variant="…">` companion attribute telling
	 * the web component which preview state to paint. Outside the editor
	 * (`$preview = false`) it's stripped before the renderer call so it never
	 * leaks as an unknown HTML attribute.
	 *
	 * @param array<string, mixed> $attrs   Filtered renderer attributes.
	 * @param bool                 $preview Whether the bare `preview` attribute should be emitted.
	 * @return string
	 */
	protected function render_component( array $attrs, bool $preview ): string {
		$preview_overrides = array();
		if ( $preview && ! empty( $attrs['previewVariant'] ) ) {
			$preview_overrides['preview-variant'] = (string) $attrs['previewVariant'];
		}
		unset( $attrs['previewVariant'] );

		return Frak_Component_Renderer::post_purchase( $attrs, '', $preview, $preview_overrides );
	}
}
