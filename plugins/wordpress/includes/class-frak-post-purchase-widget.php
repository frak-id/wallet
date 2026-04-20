<?php
/**
 * Sidebar widget wrapping `<frak-post-purchase>`.
 *
 * Delegates to {@see Frak_Component_Renderer::post_purchase()} — when the
 * widget renders on a WooCommerce `order-received` / `view-order` endpoint,
 * the renderer auto-injects `customer-id` / `order-id` / `token` so the
 * web component can fire `trackPurchaseStatus` on mount. The inline
 * `woocommerce_thankyou` tracker still fires with the same triple (the SDK
 * is idempotent, so the duplicate call is intentional) keeping attribution
 * working when either surface is missing.
 *
 * Schema mirrors `includes/blocks/post-purchase/block.json` minus the
 * editor-only `previewVariant` attribute.
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_Post_Purchase_Widget
 */
class Frak_Post_Purchase_Widget extends Frak_Widget_Base {

	/**
	 * Register the widget with WP core.
	 */
	public function __construct() {
		parent::__construct(
			'frak_post_purchase_widget',
			__( 'Frak Post-Purchase', 'frak' ),
			array(
				'description' => __( 'Thank-you card that congratulates referees and invites referrers to share for rewards.', 'frak' ),
				'classname'   => 'frak-widget frak-widget--post-purchase',
			)
		);
	}

	/**
	 * Schema mirrors `includes/blocks/post-purchase/block.json`.
	 *
	 * @return array<string, array{type: string, label: string, help?: string, options?: array<string, string>}>
	 */
	protected function field_schema(): array {
		return array(
			'variant'      => array(
				'type'  => 'text',
				'label' => __( 'Variant', 'frak' ),
			),
			'badgeText'    => array(
				'type'  => 'text',
				'label' => __( 'Badge text', 'frak' ),
			),
			'referrerText' => array(
				'type'  => 'textarea',
				'label' => __( 'Referrer text', 'frak' ),
			),
			'refereeText'  => array(
				'type'  => 'textarea',
				'label' => __( 'Referee text', 'frak' ),
			),
			'ctaText'      => array(
				'type'  => 'text',
				'label' => __( 'Call-to-action text', 'frak' ),
			),
			'sharingUrl'   => array(
				'type'  => 'text',
				'label' => __( 'Sharing URL', 'frak' ),
			),
			'merchantId'   => array(
				'type'  => 'text',
				'label' => __( 'Merchant ID', 'frak' ),
			),
			'placement'    => array(
				'type'  => 'text',
				'label' => __( 'Placement ID', 'frak' ),
			),
			'classname'    => array(
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
		return Frak_Component_Renderer::post_purchase( $attrs );
	}
}
