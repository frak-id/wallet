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
?>
<div class="wrap">
	<h1><?php echo esc_html( get_admin_page_title() ); ?></h1>

	<div class="frak-links">
		<a href="https://docs.frak.id/components/frak-setup" target="_blank">📚 Documentation</a>
		<a href="https://business.frak.id/" target="_blank">🎯 Dashboard</a>
	</div>

	<form method="post" action="" enctype="multipart/form-data">
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
										__( 'No site icon or custom logo found. <a href="%s" target="_blank">Set one in Customizer</a>', 'frak' ),
										array(
											'a' => array(
												'href'   => array(),
												'target' => array(),
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
						<p class="description"><?php esc_html_e( 'Upload a logo image (JPG, PNG, GIF, SVG - Max 2MB)', 'frak' ); ?></p>
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
				if ( class_exists( 'WooCommerce' ) ) {
					esc_html_e( 'WooCommerce detected — purchases are tracked automatically on the thank-you page. Configure the webhook below so order-status updates (refunds, cancellations) reach the Frak backend.', 'frak' );
				} else {
					esc_html_e( 'Install and activate WooCommerce to get automatic purchase tracking. The webhook below can still be configured for custom backends that POST their own order events.', 'frak' );
				}
				?>
			</p>

			<?php
			$webhook_secret = get_option( 'frak_webhook_secret', '' );
			$product_id     = Frak_Webhook_Helper::get_product_id();
			$webhook_url    = Frak_Webhook_Helper::get_webhook_url();
			$webhook_status = Frak_Webhook_Helper::get_webhook_status();
			$webhook_logs   = Frak_Webhook_Helper::get_webhook_logs( 10 );
			$webhook_stats  = Frak_Webhook_Helper::get_webhook_stats();
			?>

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
								value="<?php echo esc_attr( $webhook_secret ); ?>" class="regular-text" readonly>
							<button type="button" id="generate-webhook-secret" class="button">
								<?php echo $webhook_secret ? esc_html__( 'Regenerate', 'frak' ) : esc_html__( 'Generate', 'frak' ); ?>
							</button>
						</td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Webhook Status', 'frak' ); ?></th>
						<td>
							<span class="frak-webhook-status <?php echo $webhook_status ? 'status-active' : 'status-inactive'; ?>">
								<?php echo $webhook_status ? esc_html__( 'Active', 'frak' ) : esc_html__( 'Inactive', 'frak' ); ?>
							</span>
						</td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Manage Webhook', 'frak' ); ?></th>
						<td>
							<button type="button" id="open-webhook-popup" class="button"
								data-product-id="<?php echo esc_attr( $product_id ); ?>">
								<?php esc_html_e( 'Create Webhook', 'frak' ); ?>
							</button>
							<a href="<?php echo esc_url( 'https://business.frak.id/product/' . $product_id ); ?>"
								target="_blank" class="button">
								<?php esc_html_e( 'Manage on Frak', 'frak' ); ?>
							</a>
							<button type="button" id="test-webhook" class="button">
								<?php esc_html_e( 'Test Webhook', 'frak' ); ?>
							</button>
						</td>
					</tr>
				</table>

				<h4><?php esc_html_e( 'Webhook Information', 'frak' ); ?></h4>
				<p><strong><?php esc_html_e( 'Domain:', 'frak' ); ?></strong> <?php echo esc_html( wp_parse_url( home_url(), PHP_URL_HOST ) ); ?></p>
				<p><strong><?php esc_html_e( 'Product ID:', 'frak' ); ?></strong> <code><?php echo esc_html( $product_id ); ?></code></p>
				<p><strong><?php esc_html_e( 'Webhook URL:', 'frak' ); ?></strong> <code><?php echo esc_html( $webhook_url ); ?></code></p>

				<h4><?php esc_html_e( 'Webhook Statistics', 'frak' ); ?></h4>
				<div class="frak-stats-grid">
					<div class="frak-stat-box">
						<h3><?php echo esc_html( $webhook_stats['total_attempts'] ); ?></h3>
						<p><?php esc_html_e( 'Total Attempts', 'frak' ); ?></p>
					</div>
					<div class="frak-stat-box">
						<h3><?php echo esc_html( $webhook_stats['successful'] ); ?></h3>
						<p><?php esc_html_e( 'Successful', 'frak' ); ?></p>
					</div>
					<div class="frak-stat-box">
						<h3><?php echo esc_html( $webhook_stats['failed'] ); ?></h3>
						<p><?php esc_html_e( 'Failed', 'frak' ); ?></p>
					</div>
					<div class="frak-stat-box">
						<h3><?php echo esc_html( $webhook_stats['success_rate'] ); ?>%</h3>
						<p><?php esc_html_e( 'Success Rate', 'frak' ); ?></p>
					</div>
					<div class="frak-stat-box">
						<h3><?php echo esc_html( $webhook_stats['avg_response_time'] ); ?>ms</h3>
						<p><?php esc_html_e( 'Avg Response Time', 'frak' ); ?></p>
					</div>
				</div>

				<h4><?php esc_html_e( 'Recent Webhook Attempts', 'frak' ); ?></h4>
				<?php if ( ! empty( $webhook_logs ) ) : ?>
					<table class="wp-list-table widefat fixed striped">
						<thead>
							<tr>
								<th><?php esc_html_e( 'Timestamp', 'frak' ); ?></th>
								<th><?php esc_html_e( 'Order ID', 'frak' ); ?></th>
								<th><?php esc_html_e( 'Status', 'frak' ); ?></th>
								<th><?php esc_html_e( 'HTTP Code', 'frak' ); ?></th>
								<th><?php esc_html_e( 'Response Time', 'frak' ); ?></th>
								<th><?php esc_html_e( 'Result', 'frak' ); ?></th>
								<th><?php esc_html_e( 'Error', 'frak' ); ?></th>
							</tr>
						</thead>
						<tbody>
							<?php foreach ( $webhook_logs as $log ) : ?>
								<tr>
									<td><?php echo esc_html( $log['timestamp'] ); ?></td>
									<td>
										<?php if ( $log['order_id'] > 0 ) : ?>
											<a href="<?php echo esc_url( admin_url( 'post.php?post=' . $log['order_id'] . '&action=edit' ) ); ?>" target="_blank">
												#<?php echo esc_html( $log['order_id'] ); ?>
											</a>
										<?php else : ?>
											<?php esc_html_e( 'Test', 'frak' ); ?>
										<?php endif; ?>
									</td>
									<td><?php echo esc_html( $log['status'] ); ?></td>
									<td>
										<span class="<?php echo $log['http_code'] >= 200 && $log['http_code'] < 300 ? 'text-success' : 'text-error'; ?>">
											<?php echo esc_html( $log['http_code'] ); ?>
										</span>
									</td>
									<td><?php echo esc_html( $log['execution_time'] ); ?>ms</td>
									<td>
										<?php if ( $log['success'] ) : ?>
											<span style="color: green;">✓ <?php esc_html_e( 'Success', 'frak' ); ?></span>
										<?php else : ?>
											<span style="color: red;">✗ <?php esc_html_e( 'Failed', 'frak' ); ?></span>
										<?php endif; ?>
									</td>
									<td>
										<?php if ( $log['error'] ) : ?>
											<span title="<?php echo esc_attr( $log['error'] ); ?>">
												<?php echo esc_html( substr( $log['error'], 0, 50 ) . ( strlen( $log['error'] ) > 50 ? '...' : '' ) ); ?>
											</span>
										<?php else : ?>
											-
										<?php endif; ?>
									</td>
								</tr>
							<?php endforeach; ?>
						</tbody>
					</table>
					<p>
						<button type="button" id="clear-webhook-logs" class="button"><?php esc_html_e( 'Clear Logs', 'frak' ); ?></button>
					</p>
				<?php else : ?>
					<p><?php esc_html_e( 'No webhook attempts recorded yet. Webhook logs will appear here after orders are placed or tests are run.', 'frak' ); ?></p>
				<?php endif; ?>
			</div>
		</div>

		<?php submit_button( __( 'Save Settings', 'frak' ) ); ?>
	</form>
</div>
