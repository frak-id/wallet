<?php
/**
 * Elementor widget wrapping `<frak-banner>`.
 *
 * Mirrors the `frak/banner` Gutenberg block 1:1 — same controls, same
 * defaults — and delegates rendering to {@see Frak_Component_Renderer::banner()}
 * so the emitted HTML matches the block / `[frak_banner]` shortcode /
 * `Frak_Banner_Widget` sidebar widget byte-for-byte.
 *
 * Schema mirrors `includes/blocks/banner/block.json`. The editor-only
 * `previewMode` block attribute is intentionally omitted — the Elementor
 * preview iframe renders the live `<frak-banner preview>` web component, so
 * the merchant sees the actual referral copy without an extra mode toggle.
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_Elementor_Banner_Widget
 */
class Frak_Elementor_Banner_Widget extends Frak_Elementor_Widget_Base {

	/**
	 * Unique widget slug. Used by Elementor to persist instances in
	 * `_elementor_data` and as the type discriminator on render.
	 *
	 * @return string
	 */
	public function get_name(): string {
		return 'frak-banner';
	}

	/**
	 * Display name in the widget panel.
	 *
	 * @return string
	 */
	public function get_title(): string {
		return esc_html__( 'Frak Banner', 'frak' );
	}

	/**
	 * Eicon shown in the panel + on the canvas. `eicon-megaphone` matches
	 * the dashicon (`megaphone`) used by the Gutenberg block.
	 *
	 * @return string
	 */
	public function get_icon(): string {
		return 'eicon-megaphone';
	}

	/**
	 * Search keywords surfaced when merchants search the panel.
	 *
	 * @return string[]
	 */
	public function get_keywords(): array {
		return array( 'frak', 'banner', 'notification', 'referral' );
	}

	/**
	 * Settings forwarded to {@see Frak_Component_Renderer::banner()}.
	 *
	 * @return string[]
	 */
	protected function setting_keys(): array {
		return array(
			'referralTitle',
			'referralDescription',
			'referralCta',
			'inappTitle',
			'inappDescription',
			'inappCta',
			'previewMode',
			'placement',
			'interaction',
			'classname',
		);
	}

	/**
	 * Register the panel controls. Four sections matching the Gutenberg
	 * block's inspector: Referral mode, In-app browser mode, Editor preview,
	 * Advanced — plus the shared Style → Spacing section from
	 * {@see Frak_Elementor_Widget_Base::register_style_controls()}.
	 */
	protected function register_controls(): void {
		$this->start_controls_section(
			'frak_referral_section',
			array(
				'label' => esc_html__( 'Referral mode', 'frak' ),
				'tab'   => \Elementor\Controls_Manager::TAB_CONTENT,
			)
		);

		$this->add_control(
			'referralTitle',
			array(
				'label'   => esc_html__( 'Title', 'frak' ),
				'type'    => \Elementor\Controls_Manager::TEXT,
				'dynamic' => array( 'active' => true ),
			)
		);

		$this->add_control(
			'referralDescription',
			array(
				'label'   => esc_html__( 'Description', 'frak' ),
				'type'    => \Elementor\Controls_Manager::TEXTAREA,
				'dynamic' => array( 'active' => true ),
			)
		);

		$this->add_control(
			'referralCta',
			array(
				'label'   => esc_html__( 'CTA label', 'frak' ),
				'type'    => \Elementor\Controls_Manager::TEXT,
				'dynamic' => array( 'active' => true ),
			)
		);

		$this->end_controls_section();

		$this->start_controls_section(
			'frak_inapp_section',
			array(
				'label' => esc_html__( 'In-app browser mode', 'frak' ),
				'tab'   => \Elementor\Controls_Manager::TAB_CONTENT,
			)
		);

		$this->add_control(
			'inappTitle',
			array(
				'label'   => esc_html__( 'Title', 'frak' ),
				'type'    => \Elementor\Controls_Manager::TEXT,
				'dynamic' => array( 'active' => true ),
			)
		);

		$this->add_control(
			'inappDescription',
			array(
				'label'   => esc_html__( 'Description', 'frak' ),
				'type'    => \Elementor\Controls_Manager::TEXTAREA,
				'dynamic' => array( 'active' => true ),
			)
		);

		$this->add_control(
			'inappCta',
			array(
				'label'   => esc_html__( 'CTA label', 'frak' ),
				'type'    => \Elementor\Controls_Manager::TEXT,
				'dynamic' => array( 'active' => true ),
			)
		);

		$this->end_controls_section();

		$this->start_controls_section(
			'frak_editor_preview_section',
			array(
				'label' => esc_html__( 'Editor preview', 'frak' ),
				'tab'   => \Elementor\Controls_Manager::TAB_CONTENT,
			)
		);

		// SELECT defaults match the Gutenberg `frak/banner` block.json
		// (`previewMode: 'referral'`) so unconfigured widgets paint the same
		// preview state across both editors. The renderer also carries a
		// `PREVIEW_DEFAULT_ATTRS` backstop for the same value, so a saved
		// instance with an empty string still resolves to `referral`.
		$this->add_control(
			'previewMode',
			array(
				'label'       => esc_html__( 'Preview mode', 'frak' ),
				'type'        => \Elementor\Controls_Manager::SELECT,
				'default'     => 'referral',
				'options'     => array(
					'referral' => esc_html__( 'Referral success', 'frak' ),
					'inapp'    => esc_html__( 'In-app browser prompt', 'frak' ),
				),
				'description' => esc_html__( 'Only affects the editor preview — at runtime the mode is picked from the request context.', 'frak' ),
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
				'label'       => esc_html__( 'Placement ID', 'frak' ),
				'type'        => \Elementor\Controls_Manager::TEXT,
				'description' => esc_html__( 'Backend placement identifier (optional).', 'frak' ),
				'dynamic'     => array( 'active' => true ),
			)
		);

		$this->add_control(
			'interaction',
			array(
				'label'       => esc_html__( 'Interaction filter', 'frak' ),
				'type'        => \Elementor\Controls_Manager::TEXT,
				'description' => esc_html__( 'e.g. "purchase" to limit rewards to a specific interaction.', 'frak' ),
				'dynamic'     => array( 'active' => true ),
			)
		);

		$this->add_control(
			'classname',
			array(
				'label'   => esc_html__( 'CSS class name', 'frak' ),
				'type'    => \Elementor\Controls_Manager::TEXT,
				'dynamic' => array( 'active' => true ),
			)
		);

		$this->end_controls_section();

		$this->register_style_controls();
	}

	/**
	 * Delegate to the shared renderer.
	 *
	 * `previewMode` is editor-only — it sets the `<frak-banner preview-mode="…">`
	 * companion attribute that tells the web component which preview state to
	 * paint. Outside the editor (`$preview = false`) it's stripped before the
	 * renderer call so it never leaks as an unknown HTML attribute.
	 *
	 * @param array<string, mixed> $attrs   Filtered renderer attributes.
	 * @param bool                 $preview Whether the bare `preview` attribute should be emitted.
	 * @return string
	 */
	protected function render_component( array $attrs, bool $preview ): string {
		$preview_overrides = array();
		if ( $preview && ! empty( $attrs['previewMode'] ) ) {
			$preview_overrides['preview-mode'] = (string) $attrs['previewMode'];
		}
		unset( $attrs['previewMode'] );

		return Frak_Component_Renderer::banner( $attrs, '', $preview, $preview_overrides );
	}
}
