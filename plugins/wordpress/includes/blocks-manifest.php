<?php
/**
 * Block metadata manifest.
 *
 * Pre-computed copy of every bundled `block.json`, keyed by the folder name
 * under `includes/blocks/`. Registered with WP via
 * {@see wp_register_block_metadata_collection()} (WP 6.7+) so that
 * {@see register_block_type()} resolves metadata from this in-memory array
 * instead of re-reading + JSON-decoding the three `block.json` files on every
 * frontend request. Falls back to the legacy disk path on WP 6.4-6.6.
 *
 * IMPORTANT: regenerate this file whenever a block's `block.json` changes.
 * The manifest is the source of truth on WP 6.7+; stale entries silently
 * ship incorrect attribute defaults / supports to the block editor.
 *
 * @package Frak_Integration
 */

return array(
	'banner'        => array(
		'$schema'      => 'https://schemas.wp.org/trunk/block.json',
		'apiVersion'   => 3,
		'name'         => 'frak/banner',
		'title'        => 'Frak Banner',
		'description'  => 'Notification banner handling referral success and in-app browser prompts. Auto-hides when not needed.',
		'category'     => 'widgets',
		'icon'         => 'megaphone',
		'keywords'     => array( 'frak', 'banner', 'notification', 'referral' ),
		'supports'     => array(
			'html'  => false,
			'align' => array( 'wide', 'full' ),
		),
		'textdomain'   => 'frak',
		'attributes'   => array(
			'placement'           => array(
				'type'    => 'string',
				'default' => '',
			),
			'classname'           => array(
				'type'    => 'string',
				'default' => '',
			),
			'interaction'         => array(
				'type'    => 'string',
				'default' => '',
			),
			'referralTitle'       => array(
				'type'    => 'string',
				'default' => '',
			),
			'referralDescription' => array(
				'type'    => 'string',
				'default' => '',
			),
			'referralCta'         => array(
				'type'    => 'string',
				'default' => '',
			),
			'inappTitle'          => array(
				'type'    => 'string',
				'default' => '',
			),
			'inappDescription'    => array(
				'type'    => 'string',
				'default' => '',
			),
			'inappCta'            => array(
				'type'    => 'string',
				'default' => '',
			),
			'previewMode'         => array(
				'type'    => 'string',
				'default' => 'referral',
			),
		),
		'editorScript' => 'file:./editor.js',
		'render'       => 'file:./render.php',
	),
	'post-purchase' => array(
		'$schema'      => 'https://schemas.wp.org/trunk/block.json',
		'apiVersion'   => 3,
		'name'         => 'frak/post-purchase',
		'title'        => 'Frak Post-Purchase',
		'description'  => 'Inline card shown on thank-you pages — congratulates referees and invites referrers to share for rewards.',
		'category'     => 'widgets',
		'icon'         => 'cart',
		'keywords'     => array( 'frak', 'post purchase', 'thank you', 'reward', 'referral' ),
		'supports'     => array(
			'html'  => false,
			'align' => array( 'wide', 'full' ),
		),
		'textdomain'   => 'frak',
		'attributes'   => array(
			'sharingUrl'     => array(
				'type'    => 'string',
				'default' => '',
			),
			'merchantId'     => array(
				'type'    => 'string',
				'default' => '',
			),
			'placement'      => array(
				'type'    => 'string',
				'default' => '',
			),
			'classname'      => array(
				'type'    => 'string',
				'default' => '',
			),
			'variant'        => array(
				'type'    => 'string',
				'default' => '',
			),
			'badgeText'      => array(
				'type'    => 'string',
				'default' => '',
			),
			'referrerText'   => array(
				'type'    => 'string',
				'default' => '',
			),
			'refereeText'    => array(
				'type'    => 'string',
				'default' => '',
			),
			'ctaText'        => array(
				'type'    => 'string',
				'default' => '',
			),
			'previewVariant' => array(
				'type'    => 'string',
				'default' => 'referrer',
			),
		),
		'editorScript' => 'file:./editor.js',
		'render'       => 'file:./render.php',
	),
	'share-button'  => array(
		'$schema'      => 'https://schemas.wp.org/trunk/block.json',
		'apiVersion'   => 3,
		'name'         => 'frak/share-button',
		'title'        => 'Frak Share Button',
		'description'  => 'Button that opens the Frak sharing flow so users can earn rewards by sharing your content.',
		'category'     => 'widgets',
		'icon'         => 'share',
		'keywords'     => array( 'frak', 'share', 'reward', 'referral' ),
		'supports'     => array(
			'html'  => false,
			'align' => array( 'left', 'center', 'right' ),
		),
		'textdomain'   => 'frak',
		'attributes'   => array(
			'text'              => array(
				'type'    => 'string',
				'default' => 'Share and earn!',
			),
			'placement'         => array(
				'type'    => 'string',
				'default' => '',
			),
			'classname'         => array(
				'type'    => 'string',
				'default' => '',
			),
			'useReward'         => array(
				'type'    => 'boolean',
				'default' => false,
			),
			'noRewardText'      => array(
				'type'    => 'string',
				'default' => '',
			),
			'targetInteraction' => array(
				'type'    => 'string',
				'default' => '',
			),
			'clickAction'       => array(
				'type'    => 'string',
				'default' => 'sharing-page',
			),
			'buttonStyle'       => array(
				'type'    => 'string',
				'default' => 'primary',
			),
		),
		'editorScript' => 'file:./editor.js',
		'render'       => 'file:./render.php',
	),
);
