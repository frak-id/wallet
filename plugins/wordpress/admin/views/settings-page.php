<?php
/**
 * Admin settings page template.
 *
 * @package Frak_Integration
 *
 * @var string $app_name App name.
 * @var string $logo_url Logo URL.
 */

// Prevent direct access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$webhook_secret  = get_option( 'frak_webhook_secret', '' );
$merchant_record = Frak_Merchant::get_record();
$wc_active       = class_exists( 'WooCommerce' );
$wc_status       = $wc_active && class_exists( 'Frak_WC_Webhook_Registrar' )
	? Frak_WC_Webhook_Registrar::status()
	: null;
$wc_admin_url    = $wc_active ? admin_url( 'admin.php?page=wc-settings&tab=advanced&section=webhooks' ) : '';
$wc_logs_url     = $wc_active ? admin_url( 'admin.php?page=wc-status&tab=logs' ) : '';
?>
<div class="wrap">
	<h1><?php echo esc_html( get_admin_page_title() ); ?></h1>

	<div class="frak-links">
		<a href="https://docs.frak.id/components/frak-setup" target="_blank" rel="noopener">📚 Documentation</a>
		<a href="https://business.frak.id/" target="_blank" rel="noopener">🎯 Dashboard</a>
	</div>

	<form method="post" action="" enctype="multipart/form-data">
		<?php wp_nonce_field( Frak_Admin::SETTINGS_NONCE_ACTION ); ?>
		<!-- Generic Website Info Section -->
		<div class="frak-section">
			<h2><?php esc_html_e( 'Website Information', 'frak' ); ?></h2>
			<table class="form-table">
				<tr>
					<th scope="row">
						<label for="frak_app_name"><?php esc_html_e( 'App Name', 'frak' ); ?></label>
					</th>
					<td>
						<input type="text" id="frak_app_name" name="frak_app_name"
							value="<?php echo esc_attr( $app_name ); ?>" class="regular-text">
						<button type="button" id="autofill_app_name" class="button button-secondary" style="margin-left: 10px;">
							<?php esc_html_e( 'Use Site Name', 'frak' ); ?>
						</button>
						<p class="description">
							<?php
							/* translators: %s: site name */
							printf( esc_html__( 'Current site name: %s', 'frak' ), '<strong>' . esc_html( get_bloginfo( 'name' ) ) . '</strong>' );
							?>
						</p>
					</td>
				</tr>
				<tr>
					<th scope="row">
						<label for="frak_logo_url"><?php esc_html_e( 'Logo URL', 'frak' ); ?></label>
					</th>
					<td>
						<input type="url" id="frak_logo_url" name="frak_logo_url"
							value="<?php echo esc_url( $logo_url ); ?>" class="regular-text">
						<button type="button" id="autofill_logo_url" class="button button-secondary" style="margin-left: 10px;">
							<?php esc_html_e( 'Use Site Icon', 'frak' ); ?>
						</button>
						<?php
						$site_icon_id   = get_option( 'site_icon' );
						$custom_logo_id = get_theme_mod( 'custom_logo' );
						if ( $site_icon_id || $custom_logo_id ) :
							?>
							<p class="description">
								<?php
								if ( $site_icon_id ) {
									esc_html_e( 'Site icon available', 'frak' );
								} elseif ( $custom_logo_id ) {
									esc_html_e( 'Custom logo available', 'frak' );
								}
								?>
							</p>
						<?php else : ?>
							<p class="description">
								<?php
								printf(
									wp_kses(
										/* translators: %s: URL to customizer */
										__( 'No site icon or custom logo found. <a href="%s" target="_blank" rel="noopener">Set one in Customizer</a>', 'frak' ),
										array(
											'a' => array(
												'href'   => array(),
												'target' => array(),
												'rel'    => array(),
											),
										)
									),
									esc_url( admin_url( 'customize.php' ) )
								);
								?>
							</p>
						<?php endif; ?>
					</td>
				</tr>
				<tr>
					<th scope="row">
						<label for="frak_logo_file"><?php esc_html_e( 'Upload Logo', 'frak' ); ?></label>
					</th>
					<td>
						<input type="file" id="frak_logo_file" name="frak_logo_file" accept="image/*">
						<p class="description"><?php esc_html_e( 'Upload a logo image (JPG, PNG, GIF - Max 2MB)', 'frak' ); ?></p>
						<?php if ( $logo_url ) : ?>
							<div class="frak-logo-preview" style="margin-top: 10px;">
								<img src="<?php echo esc_url( $logo_url ); ?>" alt="<?php esc_attr_e( 'Current logo', 'frak' ); ?>" style="max-height: 80px; max-width: 200px;">
							</div>
						<?php endif; ?>
					</td>
				</tr>
			</table>
		</div>

		<!-- Purchase Tracking Section -->
		<div class="frak-section">
			<h2><?php esc_html_e( 'Purchase Tracking', 'frak' ); ?></h2>
			<p class="description">
				<?php
				if ( $wc_active ) {
					esc_html_e( 'WooCommerce detected — purchases are tracked automatically on the thank-you page, and order-status updates are delivered via WooCommerce\'s native webhook pipeline.', 'frak' );
				} else {
					esc_html_e( 'Install and activate WooCommerce to get automatic purchase tracking and order-status webhooks.', 'frak' );
				}
				?>
			</p>

			<!-- Webhook Configuration -->
			<div class="frak-subsection">
				<h3><?php esc_html_e( 'Webhook Configuration', 'frak' ); ?></h3>

				<table class="form-table">
					<tr>
						<th scope="row">
							<label for="frak_webhook_secret"><?php esc_html_e( 'Webhook Secret', 'frak' ); ?></label>
						</th>
						<td>
							<input type="text" id="frak_webhook_secret" name="frak_webhook_secret"
								value="<?php echo esc_attr( $webhook_secret ); ?>" class="regular-text"
								placeholder="<?php esc_attr_e( 'Paste the webhook secret from your Frak dashboard', 'frak' ); ?>">
							<p class="description">
								<?php
								printf(
									wp_kses(
										/* translators: %s: URL to the Frak business dashboard webhook configuration. */
										__( 'Generate the secret in your <a href="%s" target="_blank" rel="noopener">Frak business dashboard</a> (Merchant → Purchase Tracker → WooCommerce) and paste it here. Saving this form will automatically configure the WooCommerce webhook with the new secret.', 'frak' ),
										array(
											'a' => array(
												'href'   => array(),
												'target' => array(),
												'rel'    => array(),
											),
										)
									),
									esc_url( 'https://business.frak.id/' )
								);
								?>
							</p>
						</td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Merchant', 'frak' ); ?></th>
						<td>
							<?php if ( $merchant_record ) : ?>
								<span class="frak-webhook-status status-active">
									<?php esc_html_e( '✓ Connected:', 'frak' ); ?> <strong><?php echo esc_html( $merchant_record['name'] ); ?></strong>
								</span>
							<?php else : ?>
								<span class="frak-webhook-status status-inactive">
									<?php esc_html_e( '✗ Not resolved for this domain', 'frak' ); ?>
								</span>
								<p class="description" style="margin-top: 8px;">
									<?php
									printf(
										wp_kses(
											/* translators: 1: current site host, 2: business dashboard URL. */
											__( 'If you just moved the site to a new domain or this is a fresh install, add <code>%1$s</code> under <a href="%2$s" target="_blank" rel="noopener">Merchant → Allowed Domains</a> in the Frak dashboard, then click "Refresh Merchant".', 'frak' ),
											array(
												'a'    => array(
													'href' => array(),
													'target' => array(),
													'rel'  => array(),
												),
												'code' => array(),
											)
										),
										esc_html( wp_parse_url( home_url(), PHP_URL_HOST ) ),
										esc_url( 'https://business.frak.id/' )
									);
									?>
								</p>
							<?php endif; ?>
							<button type="button" id="refresh-merchant" class="button" style="margin-left: 10px;">
								<?php esc_html_e( 'Refresh Merchant', 'frak' ); ?>
							</button>
							<?php if ( $merchant_record ) : ?>
								<a href="<?php echo esc_url( 'https://business.frak.id/merchant/' . $merchant_record['id'] ); ?>"
									target="_blank" rel="noopener" class="button">
									<?php esc_html_e( 'Manage on Frak', 'frak' ); ?>
								</a>
							<?php endif; ?>
						</td>
					</tr>
				</table>

				<h4><?php esc_html_e( 'Site Information', 'frak' ); ?></h4>
				<p><strong><?php esc_html_e( 'Domain:', 'frak' ); ?></strong> <?php echo esc_html( wp_parse_url( home_url(), PHP_URL_HOST ) ); ?></p>
				<?php if ( $merchant_record ) : ?>
					<p><strong><?php esc_html_e( 'Merchant ID:', 'frak' ); ?></strong> <code><?php echo esc_html( $merchant_record['id'] ); ?></code></p>
				<?php endif; ?>
			</div>

			<?php if ( null !== $wc_status ) : ?>
				<!-- WooCommerce webhook health -->
				<div class="frak-subsection">
					<h3><?php esc_html_e( 'WooCommerce Webhook', 'frak' ); ?></h3>

					<?php
					$healthy = $wc_status['exists']
						&& 'active' === $wc_status['status']
						&& $wc_status['url_matches']
						&& $wc_status['topic_matches']
						&& $wc_status['api_version_matches']
						&& $wc_status['secret_matches']
						&& $wc_status['secret_configured']
						&& $wc_status['merchant_resolved']
						&& $wc_status['domain_matches']
						&& 0 === $wc_status['failure_count'];
					?>

					<?php if ( $healthy ) : ?>
						<div class="notice notice-success inline" style="margin: 0 0 12px;">
							<p>
								<?php esc_html_e( '✓ WooCommerce webhook active — order updates are being delivered to Frak.', 'frak' ); ?>
							</p>
						</div>
					<?php else : ?>
						<div class="notice notice-warning inline" style="margin: 0 0 12px;">
							<p>
								<strong><?php esc_html_e( 'WooCommerce webhook is not ready.', 'frak' ); ?></strong>
								<?php
								if ( ! $wc_status['merchant_resolved'] ) {
									esc_html_e( 'Register this domain on business.frak.id, then click "Refresh Merchant" above.', 'frak' );
								} elseif ( ! $wc_status['domain_matches'] ) {
									esc_html_e( 'This site\'s domain has changed since the merchant was resolved. Click "Refresh Merchant" above — if the merchant fails to resolve, add the new domain under Merchant → Allowed Domains in the Frak dashboard.', 'frak' );
								} elseif ( ! $wc_status['secret_configured'] ) {
									esc_html_e( 'Paste your webhook secret above and save the form.', 'frak' );
								} elseif ( ! $wc_status['exists'] ) {
									esc_html_e( 'Click "Set up webhook" to create it in WooCommerce.', 'frak' );
								} elseif ( 'active' !== $wc_status['status'] ) {
									esc_html_e( 'The webhook exists but is not active. Click "Re-enable webhook" to reset it.', 'frak' );
								} elseif ( ! $wc_status['url_matches'] ) {
									esc_html_e( 'The webhook is pointing at a stale URL. Click "Sync webhook" to fix it.', 'frak' );
								} elseif ( ! $wc_status['topic_matches'] || ! $wc_status['api_version_matches'] ) {
									esc_html_e( 'The webhook topic or API version was edited in WooCommerce. Click "Sync webhook" to restore the Frak defaults.', 'frak' );
								} elseif ( ! $wc_status['secret_matches'] ) {
									esc_html_e( 'The secret stored on the WooCommerce webhook no longer matches the one saved above. Click "Sync webhook" to reapply it.', 'frak' );
								} elseif ( $wc_status['failure_count'] > 0 ) {
									printf(
										/* translators: %d: WooCommerce delivery failure count. */
										esc_html( _n( 'WooCommerce has recorded %d delivery failure. Check the logs and click "Sync webhook" once the backend is reachable again.', 'WooCommerce has recorded %d delivery failures. Check the logs and click "Sync webhook" once the backend is reachable again.', (int) $wc_status['failure_count'], 'frak' ) ),
										(int) $wc_status['failure_count']
									);
								}
								?>
							</p>
						</div>
					<?php endif; ?>

					<table class="form-table">
						<tr>
							<th scope="row"><?php esc_html_e( 'Status', 'frak' ); ?></th>
							<td>
								<?php if ( $wc_status['exists'] ) : ?>
									<code><?php echo esc_html( $wc_status['status'] ); ?></code>
								<?php else : ?>
									<em><?php esc_html_e( 'not created', 'frak' ); ?></em>
								<?php endif; ?>
							</td>
						</tr>
						<?php if ( '' !== $wc_status['expected_url'] ) : ?>
							<tr>
								<th scope="row"><?php esc_html_e( 'Delivery URL', 'frak' ); ?></th>
								<td>
									<code><?php echo esc_html( $wc_status['expected_url'] ); ?></code>
									<?php if ( $wc_status['exists'] && ! $wc_status['url_matches'] ) : ?>
										<p class="description" style="color: #b32d2e;">
											<?php
											printf(
												/* translators: %s: current delivery URL */
												esc_html__( 'Currently pointing at: %s', 'frak' ),
												'<code>' . esc_html( $wc_status['delivery_url'] ) . '</code>'
											);
											?>
										</p>
									<?php endif; ?>
								</td>
							</tr>
						<?php endif; ?>
						<?php if ( $wc_status['exists'] ) : ?>
							<tr>
								<th scope="row"><?php esc_html_e( 'Topic', 'frak' ); ?></th>
								<td>
									<code><?php echo esc_html( Frak_WC_Webhook_Registrar::TOPIC ); ?></code>
									<?php if ( ! $wc_status['topic_matches'] ) : ?>
										<span style="color: #b32d2e;"><?php esc_html_e( '(WooCommerce has a different topic configured)', 'frak' ); ?></span>
									<?php endif; ?>
								</td>
							</tr>
							<tr>
								<th scope="row"><?php esc_html_e( 'Secret in WooCommerce', 'frak' ); ?></th>
								<td>
									<?php if ( $wc_status['secret_matches'] ) : ?>
										<span style="color: #46b450;"><?php esc_html_e( '✓ matches the secret saved above', 'frak' ); ?></span>
									<?php else : ?>
										<span style="color: #b32d2e;"><?php esc_html_e( '✗ does not match — click "Sync webhook" to reapply', 'frak' ); ?></span>
									<?php endif; ?>
								</td>
							</tr>
							<?php if ( $wc_status['failure_count'] > 0 || $wc_status['pending_delivery'] ) : ?>
								<tr>
									<th scope="row"><?php esc_html_e( 'Delivery health', 'frak' ); ?></th>
									<td>
										<?php if ( $wc_status['pending_delivery'] ) : ?>
											<em><?php esc_html_e( 'Waiting for WooCommerce to deliver the first event…', 'frak' ); ?></em><br>
										<?php endif; ?>
										<?php if ( $wc_status['failure_count'] > 0 ) : ?>
											<span style="color: #b32d2e;">
												<?php
												printf(
													/* translators: %d: WooCommerce failure counter (5 auto-disables the webhook). */
													esc_html( _n( '%d recent delivery failure (WooCommerce auto-disables after 5).', '%d recent delivery failures (WooCommerce auto-disables after 5).', (int) $wc_status['failure_count'], 'frak' ) ),
													(int) $wc_status['failure_count']
												);
												?>
											</span>
										<?php endif; ?>
									</td>
								</tr>
							<?php endif; ?>
						<?php endif; ?>
						<tr>
							<th scope="row"><?php esc_html_e( 'Actions', 'frak' ); ?></th>
							<td>
								<button type="button" id="setup-wc-webhook" class="button button-primary"
									<?php
									disabled(
										! ( $wc_status['merchant_resolved'] && $wc_status['secret_configured'] )
									);
									?>
								>
									<?php
									if ( ! $wc_status['exists'] ) {
										esc_html_e( 'Set up webhook', 'frak' );
									} elseif ( 'active' !== $wc_status['status'] ) {
										esc_html_e( 'Re-enable webhook', 'frak' );
									} else {
										esc_html_e( 'Sync webhook', 'frak' );
									}
									?>
								</button>
								<?php if ( $wc_admin_url ) : ?>
									<a href="<?php echo esc_url( $wc_admin_url ); ?>" class="button" target="_blank" rel="noopener">
										<?php esc_html_e( 'View in WooCommerce', 'frak' ); ?>
									</a>
								<?php endif; ?>
								<?php if ( $wc_logs_url ) : ?>
									<a href="<?php echo esc_url( $wc_logs_url ); ?>" class="button" target="_blank" rel="noopener">
										<?php esc_html_e( 'Delivery logs', 'frak' ); ?>
									</a>
								<?php endif; ?>
							</td>
						</tr>
					</table>
				</div>
			<?php endif; ?>
		</div>

		<?php submit_button( __( 'Save Settings', 'frak' ) ); ?>
	</form>
</div>
