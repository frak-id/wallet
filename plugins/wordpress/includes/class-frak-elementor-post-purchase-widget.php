<?php
/**
 * Elementor widget wrapping `<frak-post-purchase>`.
 *
 * Mirrors the `frak/post-purchase` Gutenberg block 1:1 — same controls, same
 * defaults — and delegates rendering to {@see Frak_Component_Renderer::post_purchase()}
 * so the emitted HTML matches every other surface byte-for-byte.
 *
 * The renderer auto-injects the WooCommerce order context (customer-id /
 * order-id / token / products) when the widget is dropped onto a thank-you
 * or view-order template — same behaviour as the block / shortcode / sidebar
 * widget. Merchants typically add this widget to an Elementor "thank you"
 * template via Theme Builder or directly on the WC default thank-you page.
 *
 * Schema mirrors `includes/blocks/post-purchase/block.json`. The editor-only
 * `previewVariant` block attribute is intentionally omitted — Elementor's
 * preview iframe shows the live `<frak-post-purchase preview>` web component,
 * which defaults to the "referrer" copy.
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_Elementor_Post_Purchase_Widget
 */
class Frak_Elementor_Post_Purchase_Widget extends Frak_Elementor_Widget_Base {

	/**
	 * Unique widget slug.
	 *
	 * @return string
	 */
	public function get_name(): string {
		return 'frak-post-purchase';
	}

	/**
	 * Display name in the widget panel.
	 *
	 * @return string
	 */
	public function get_title(): string {
		return esc_html__( 'Frak Post-Purchase', 'frak' );
	}

	/**
	 * Eicon shown in the panel + on the canvas. Cart-themed to match the
	 * `cart` dashicon used by the Gutenberg block.
	 *
	 * @return string
	 */
	public function get_icon(): string {
		return 'eicon-cart-medium';
	}

	/**
	 * Search keywords surfaced in the panel.
	 *
	 * @return string[]
	 */
	public function get_keywords(): array {
		return array( 'frak', 'post purchase', 'thank you', 'reward', 'referral' );
	}

	/**
	 * Settings forwarded to {@see Frak_Component_Renderer::post_purchase()}.
	 *
	 * @return string[]
	 */
	protected function setting_keys(): array {
		return array(
			'badgeText',
			'referrerText',
			'refereeText',
			'ctaText',
			'variant',
			'sharingUrl',
			'showProducts',
			'placement',
			'merchantId',
			'classname',
		);
	}

	/**
	 * Register the panel controls. Three sections matching the block's
	 * inspector: Copy, Behaviour, Advanced.
	 */
	protected function register_controls(): void {
		$this->start_controls_section(
			'frak_copy_section',
			array(
				'label' => esc_html__( 'Copy', 'frak' ),
				'tab'   => \Elementor\Controls_Manager::TAB_CONTENT,
			)
		);

		$this->add_control(
			'badgeText',
			array(
				'label' => esc_html__( 'Badge text', 'frak' ),
				'type'  => \Elementor\Controls_Manager::TEXT,
			)
		);

		$this->add_control(
			'referrerText',
			array(
				'label'       => esc_html__( 'Referrer message', 'frak' ),
				'type'        => \Elementor\Controls_Manager::TEXTAREA,
				'description' => esc_html__( 'Shown to buyers who were not referred. Use {REWARD} for the reward amount.', 'frak' ),
			)
		);

		$this->add_control(
			'refereeText',
			array(
				'label'       => esc_html__( 'Referee message', 'frak' ),
				'type'        => \Elementor\Controls_Manager::TEXTAREA,
				'description' => esc_html__( 'Shown to buyers who came from a referral link. Use {REWARD} for the reward amount.', 'frak' ),
			)
		);

		$this->add_control(
			'ctaText',
			array(
				'label'       => esc_html__( 'CTA label', 'frak' ),
				'type'        => \Elementor\Controls_Manager::TEXT,
				'description' => esc_html__( 'Use {REWARD} to inject the reward amount.', 'frak' ),
			)
		);

		$this->end_controls_section();

		$this->start_controls_section(
			'frak_behaviour_section',
			array(
				'label' => esc_html__( 'Behaviour', 'frak' ),
				'tab'   => \Elementor\Controls_Manager::TAB_CONTENT,
			)
		);

		$this->add_control(
			'variant',
			array(
				'label'   => esc_html__( 'Forced variant', 'frak' ),
				'type'    => \Elementor\Controls_Manager::SELECT,
				'default' => '',
				'options' => array(
					''         => esc_html__( 'Auto (recommended)', 'frak' ),
					'referrer' => esc_html__( 'Referrer (invite to share)', 'frak' ),
					'referee'  => esc_html__( 'Referee (congratulations)', 'frak' ),
				),
			)
		);

		$this->add_control(
			'sharingUrl',
			array(
				'label'       => esc_html__( 'Sharing URL', 'frak' ),
				'type'        => \Elementor\Controls_Manager::TEXT,
				'description' => esc_html__( 'Defaults to the merchant domain if left empty.', 'frak' ),
			)
		);

		$this->add_control(
			'showProducts',
			array(
				'label'        => esc_html__( 'Show purchased products', 'frak' ),
				'type'         => \Elementor\Controls_Manager::SWITCHER,
				'label_on'     => esc_html__( 'Show', 'frak' ),
				'label_off'    => esc_html__( 'Hide', 'frak' ),
				'return_value' => 'yes',
				'default'      => 'yes',
				'description'  => esc_html__( 'When enabled, the sharing page shows cards for the items in this order so referees can share specific products. Auto-injected from the WooCommerce order — takes effect on the live thank-you / view-order page.', 'frak' ),
			)
		);

		$this->end_controls_section();

		$this->start_controls_section(
			'frak_advanced_section',
			array(
				'label' => esc_html__( 'Advanced', 'frak' ),
				'tab'   => \Elementor\Controls_Manager::TAB_CONTENT,
			)
		);

		$this->add_control(
			'placement',
			array(
				'label' => esc_html__( 'Placement ID', 'frak' ),
				'type'  => \Elementor\Controls_Manager::TEXT,
			)
		);

		$this->add_control(
			'merchantId',
			array(
				'label'       => esc_html__( 'Merchant ID override', 'frak' ),
				'type'        => \Elementor\Controls_Manager::TEXT,
				'description' => esc_html__( 'Leave empty to use the merchant ID from the global config.', 'frak' ),
			)
		);

		$this->add_control(
			'classname',
			array(
				'label' => esc_html__( 'CSS class name', 'frak' ),
				'type'  => \Elementor\Controls_Manager::TEXT,
			)
		);

		$this->end_controls_section();
	}

	/**
	 * Delegate to the shared renderer. Coerces the `showProducts` SWITCHER
	 * value into a real boolean so the renderer's `should_show_products()`
	 * gate matches the block path exactly.
	 *
	 * @param array<string, mixed> $attrs   Filtered renderer attributes.
	 * @param bool                 $preview Whether the bare `preview` attribute should be emitted.
	 * @return string
	 */
	protected function render_component( array $attrs, bool $preview ): string {
		if ( array_key_exists( 'showProducts', $attrs ) ) {
			$attrs['showProducts'] = self::switcher_to_bool( $attrs['showProducts'] );
		}
		return Frak_Component_Renderer::post_purchase( $attrs, '', $preview );
	}
}
