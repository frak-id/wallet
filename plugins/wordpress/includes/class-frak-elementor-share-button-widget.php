<?php
/**
 * Elementor widget wrapping `<frak-button-share>`.
 *
 * Mirrors the `frak/share-button` Gutenberg block 1:1 — same controls, same
 * defaults — and delegates rendering to {@see Frak_Component_Renderer::share_button()}
 * so the emitted HTML matches every other surface byte-for-byte.
 *
 * Schema mirrors `includes/blocks/share-button/block.json`.
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_Elementor_Share_Button_Widget
 */
class Frak_Elementor_Share_Button_Widget extends Frak_Elementor_Widget_Base {

	/**
	 * Unique widget slug.
	 *
	 * @return string
	 */
	public function get_name(): string {
		return 'frak-share-button';
	}

	/**
	 * Display name in the widget panel.
	 *
	 * @return string
	 */
	public function get_title(): string {
		return esc_html__( 'Frak Share Button', 'frak' );
	}

	/**
	 * Eicon shown in the panel + on the canvas.
	 *
	 * @return string
	 */
	public function get_icon(): string {
		return 'eicon-share';
	}

	/**
	 * Search keywords surfaced in the panel.
	 *
	 * @return string[]
	 */
	public function get_keywords(): array {
		return array( 'frak', 'share', 'reward', 'referral', 'button' );
	}

	/**
	 * Settings forwarded to {@see Frak_Component_Renderer::share_button()}.
	 *
	 * @return string[]
	 */
	protected function setting_keys(): array {
		return array(
			'text',
			'buttonStyle',
			'noRewardText',
			'clickAction',
			'placement',
			'targetInteraction',
			'classname',
		);
	}

	/**
	 * Register the panel controls. Two sections matching the block's
	 * inspector: Button (primary copy + style) and Advanced.
	 */
	protected function register_controls(): void {
		$this->start_controls_section(
			'frak_button_section',
			array(
				'label' => esc_html__( 'Button', 'frak' ),
				'tab'   => \Elementor\Controls_Manager::TAB_CONTENT,
			)
		);

		$this->add_control(
			'text',
			array(
				'label'       => esc_html__( 'Button text', 'frak' ),
				'type'        => \Elementor\Controls_Manager::TEXT,
				'default'     => esc_html__( 'Share and earn!', 'frak' ),
				'description' => esc_html__( 'Use {REWARD} to inject the reward amount at runtime.', 'frak' ),
				'dynamic'     => array( 'active' => true ),
			)
		);

		$this->add_control(
			'buttonStyle',
			array(
				'label'       => esc_html__( 'Button style', 'frak' ),
				'type'        => \Elementor\Controls_Manager::SELECT,
				'default'     => 'primary',
				'options'     => array(
					'primary'   => esc_html__( 'Primary (theme button)', 'frak' ),
					'secondary' => esc_html__( 'Secondary (outline)', 'frak' ),
					'none'      => esc_html__( 'None (custom class only)', 'frak' ),
				),
				'description' => esc_html__( 'Applies WordPress button classes so the button inherits your theme styling.', 'frak' ),
			)
		);

		$this->add_control(
			'noRewardText',
			array(
				'label'       => esc_html__( 'Fallback text (no reward)', 'frak' ),
				'type'        => \Elementor\Controls_Manager::TEXT,
				'description' => esc_html__( 'Shown when the button text contains {REWARD} but no reward is available.', 'frak' ),
				'dynamic'     => array( 'active' => true ),
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
			'clickAction',
			array(
				'label'       => esc_html__( 'Click action', 'frak' ),
				'type'        => \Elementor\Controls_Manager::SELECT,
				'default'     => 'sharing-page',
				'options'     => array(
					'sharing-page'    => esc_html__( 'Sharing page', 'frak' ),
					'embedded-wallet' => esc_html__( 'Embedded wallet', 'frak' ),
				),
				'description' => esc_html__( 'Override what happens when the button is clicked.', 'frak' ),
			)
		);

		$this->add_control(
			'placement',
			array(
				'label'       => esc_html__( 'Placement ID', 'frak' ),
				'type'        => \Elementor\Controls_Manager::TEXT,
				'description' => esc_html__( 'Backend placement identifier (optional).', 'frak' ),
				'dynamic'     => array( 'active' => true ),
			)
		);

		$this->add_control(
			'targetInteraction',
			array(
				'label'   => esc_html__( 'Target interaction', 'frak' ),
				'type'    => \Elementor\Controls_Manager::TEXT,
				'dynamic' => array( 'active' => true ),
			)
		);

		$this->add_control(
			'classname',
			array(
				'label'       => esc_html__( 'CSS class name', 'frak' ),
				'type'        => \Elementor\Controls_Manager::TEXT,
				'description' => esc_html__( 'Additional classes appended after the button-style preset.', 'frak' ),
				'dynamic'     => array( 'active' => true ),
			)
		);

		$this->end_controls_section();

		$this->register_style_controls();
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
