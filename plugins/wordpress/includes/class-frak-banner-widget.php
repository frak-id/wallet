<?php
/**
 * Sidebar widget wrapping `<frak-banner>`.
 *
 * Delegates to {@see Frak_Component_Renderer::banner()} so the HTML matches
 * the `frak/banner` block and the `[frak_banner]` shortcode byte-for-byte.
 * The schema mirrors `includes/blocks/banner/block.json` minus the editor-only
 * `previewMode` attribute (irrelevant outside the block editor).
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_Banner_Widget
 */
class Frak_Banner_Widget extends Frak_Widget_Base {

	/**
	 * Register the widget with WP core.
	 */
	public function __construct() {
		parent::__construct(
			'frak_banner_widget',
			__( 'Frak Banner', 'frak' ),
			array(
				'description' => __( 'Referral-success and in-app-browser prompt banner. Auto-hides when not applicable.', 'frak' ),
				'classname'   => 'frak-widget frak-widget--banner',
			)
		);
	}

	/**
	 * Schema mirrors `includes/blocks/banner/block.json`.
	 *
	 * @return array<string, array{type: string, label: string, help?: string, options?: array<string, string>}>
	 */
	protected function field_schema(): array {
		return array(
			'referralTitle'       => array(
				'type'  => 'text',
				'label' => __( 'Referral — title', 'frak' ),
			),
			'referralDescription' => array(
				'type'  => 'textarea',
				'label' => __( 'Referral — description', 'frak' ),
			),
			'referralCta'         => array(
				'type'  => 'text',
				'label' => __( 'Referral — call to action', 'frak' ),
			),
			'inappTitle'          => array(
				'type'  => 'text',
				'label' => __( 'In-app browser — title', 'frak' ),
			),
			'inappDescription'    => array(
				'type'  => 'textarea',
				'label' => __( 'In-app browser — description', 'frak' ),
			),
			'inappCta'            => array(
				'type'  => 'text',
				'label' => __( 'In-app browser — call to action', 'frak' ),
			),
			'placement'           => array(
				'type'  => 'text',
				'label' => __( 'Placement ID', 'frak' ),
				'help'  => __( 'Backend placement identifier (optional).', 'frak' ),
			),
			'interaction'         => array(
				'type'  => 'text',
				'label' => __( 'Interaction', 'frak' ),
			),
			'classname'           => array(
				'type'  => 'text',
				'label' => __( 'CSS class name', 'frak' ),
			),
		);
	}

	/**
	 * Delegate to the shared renderer.
	 *
	 * @param array<string, mixed> $attrs Widget instance values.
	 * @return string
	 */
	protected function render_component( array $attrs ): string {
		return Frak_Component_Renderer::banner( $attrs );
	}
}
