<?php
/**
 * Sidebar widget wrapping `<frak-button-share>`.
 *
 * Delegates to {@see Frak_Component_Renderer::share_button()} so the HTML
 * matches the `frak/share-button` block and the `[frak_share_button]`
 * shortcode byte-for-byte. Schema mirrors
 * `includes/blocks/share-button/block.json`.
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_Share_Button_Widget
 */
class Frak_Share_Button_Widget extends Frak_Widget_Base {

	/**
	 * Register the widget with WP core.
	 */
	public function __construct() {
		parent::__construct(
			'frak_share_button_widget',
			__( 'Frak Share Button', 'frak' ),
			array(
				'description' => __( 'Button that opens the Frak sharing flow so users can earn rewards by sharing.', 'frak' ),
				'classname'   => 'frak-widget frak-widget--share-button',
			)
		);
	}

	/**
	 * Schema mirrors `includes/blocks/share-button/block.json`.
	 *
	 * @return array<string, array{type: string, label: string, help?: string, options?: array<string, string>}>
	 */
	protected function field_schema(): array {
		return array(
			'text'              => array(
				'type'  => 'text',
				'label' => __( 'Button text', 'frak' ),
				'help'  => __( 'Use {REWARD} to inject the live reward amount.', 'frak' ),
			),
			'useReward'         => array(
				'type'  => 'checkbox',
				'label' => __( 'Show potential reward', 'frak' ),
			),
			'noRewardText'      => array(
				'type'  => 'text',
				'label' => __( 'Fallback text (no reward)', 'frak' ),
			),
			'clickAction'       => array(
				'type'    => 'select',
				'label'   => __( 'Click action', 'frak' ),
				'options' => array(
					'embedded-wallet' => __( 'Embedded wallet', 'frak' ),
					'share-modal'     => __( 'Share modal', 'frak' ),
					'sharing-page'    => __( 'Sharing page', 'frak' ),
				),
			),
			'placement'         => array(
				'type'  => 'text',
				'label' => __( 'Placement ID', 'frak' ),
				'help'  => __( 'Backend placement identifier (optional).', 'frak' ),
			),
			'targetInteraction' => array(
				'type'  => 'text',
				'label' => __( 'Target interaction', 'frak' ),
			),
			'classname'         => array(
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
		return Frak_Component_Renderer::share_button( $attrs );
	}
}
