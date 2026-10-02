<?php
/**
 * Ambassador page model.
 *
 * Answers "which ambassador page is known, and what can the Settings action
 * do", and performs the "ensure" (create or restore) behind that action.
 *
 * Storage:
 *   - `frak_ambassador_page_id` option (autoload=no) — the page the action
 *     created. Always validated as an existing `page` post before use. The
 *     page itself is the merchant's content and survives uninstall.
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_Ambassador_Page
 */
class Frak_Ambassador_Page {

	/**
	 * Option row holding the id of the page the action created. autoload=no.
	 */
	public const OPTION_KEY = 'frak_ambassador_page_id';

	/**
	 * Strings in a post body that mean "this page holds the ambassador
	 * component": the block comment, the shortcode, the raw element. The one
	 * list behind the scan, the stored-page check and the post-write check.
	 */
	private const MARKERS = array( '<!-- wp:frak/ambassador', '[frak_ambassador', '<frak-ambassador' );

	/**
	 * Same idea for the Elementor `_elementor_data` meta (a JSON document, so
	 * the shortcode widget and the HTML widget both show up as these words).
	 */
	private const ELEMENTOR_MARKERS = array( 'frak_ambassador', 'frak-ambassador' );

	/**
	 * Statuses a created page can sit in while hidden from visitors.
	 */
	private const RESTORABLE_STATUSES = array( 'draft', 'pending', 'future', 'private', 'trash' );

	/**
	 * Template-name needles in priority order (full width, then wide, then no
	 * sidebar); each is matched case-insensitively against name and slug.
	 */
	private const TEMPLATE_NEEDLES = array(
		array( 'full width', 'full-width', 'fullwidth' ),
		array( 'wide' ),
		array( 'no sidebar', 'no-sidebar', 'nosidebar' ),
	);

	/**
	 * Block-theme needles: the component opens with its own heading, so the
	 * page title would show twice.
	 */
	private const BLOCK_TEMPLATE_NEEDLES = array(
		array( 'no title', 'no-title', 'notitle' ),
	);

	/**
	 * Where the ambassador page stands, as Settings shows it.
	 *
	 *   - live: a published page holds the component. `template_hint` is true
	 *     only for the page the action created, on a classic theme that is
	 *     still on the default template.
	 *   - restorable: no page is live, but the created page still exists,
	 *     holds the component and is hidden.
	 *   - none: neither.
	 *
	 * @return array{type:'live',page:WP_Post,template_hint:bool}|array{type:'restorable',page:WP_Post,status:string}|array{type:'none'}
	 */
	public static function state(): array {
		$stored = self::stored_page();

		if ( $stored && 'publish' === $stored->post_status && self::holds_component( $stored ) ) {
			return array(
				'type'          => 'live',
				'page'          => $stored,
				'template_hint' => ! wp_is_block_theme() && '' === (string) get_page_template_slug( $stored ),
			);
		}

		$found = self::find_published();
		if ( $found ) {
			return array(
				'type'          => 'live',
				'page'          => $found,
				'template_hint' => false,
			);
		}

		if ( $stored && in_array( $stored->post_status, self::RESTORABLE_STATUSES, true ) && self::holds_component( $stored ) ) {
			return array(
				'type'   => 'restorable',
				'page'   => $stored,
				'status' => $stored->post_status,
			);
		}

		return array( 'type' => 'none' );
	}

	/**
	 * Make sure a published ambassador page exists: report a known one,
	 * restore the created one, or insert a new one. The page is read back
	 * afterwards; on a mismatch the change is undone and the reason returned.
	 *
	 * @return array{status:string,message:string} `status` is `exists`,
	 *                                             `restored`, `created` or `failed`.
	 */
	public static function ensure(): array {
		$state = self::state();

		if ( 'live' === $state['type'] ) {
			return array(
				'status'  => 'exists',
				'message' => __( 'An ambassador page already exists.', 'frak' ),
			);
		}

		if ( 'restorable' === $state['type'] ) {
			return self::restore( $state['page'] );
		}

		return self::create();
	}

	/**
	 * The page the action created, or null. Clears the option when it no
	 * longer points at an existing page.
	 */
	private static function stored_page(): ?WP_Post {
		$id = (int) get_option( self::OPTION_KEY, 0 );
		if ( $id <= 0 ) {
			return null;
		}

		$post = get_post( $id );
		if ( $post instanceof WP_Post && 'page' === $post->post_type ) {
			return $post;
		}

		delete_option( self::OPTION_KEY );
		return null;
	}

	/**
	 * Whether a post holds the ambassador component, by body or by Elementor
	 * data.
	 *
	 * @param WP_Post $post Post to inspect.
	 */
	private static function holds_component( WP_Post $post ): bool {
		foreach ( self::MARKERS as $marker ) {
			if ( false !== strpos( $post->post_content, $marker ) ) {
				return true;
			}
		}

		$elementor = get_post_meta( $post->ID, '_elementor_data', true );
		if ( is_string( $elementor ) ) {
			foreach ( self::ELEMENTOR_MARKERS as $marker ) {
				if ( false !== strpos( $elementor, $marker ) ) {
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * The most recently modified published page holding the component.
	 */
	private static function find_published(): ?WP_Post {
		global $wpdb;

		$content_clauses = implode( ' OR ', array_fill( 0, count( self::MARKERS ), 'p.post_content LIKE %s' ) );
		$meta_clauses    = implode( ' OR ', array_fill( 0, count( self::ELEMENTOR_MARKERS ), 'm.meta_value LIKE %s' ) );
		$patterns        = array();
		foreach ( array_merge( self::MARKERS, self::ELEMENTOR_MARKERS ) as $marker ) {
			$patterns[] = '%' . $wpdb->esc_like( $marker ) . '%';
		}

		// EXISTS probes postmeta through its post_id index instead of joining.
		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
		$id = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT p.ID FROM {$wpdb->posts} p
				WHERE p.post_type = 'page' AND p.post_status = 'publish'
				AND ( {$content_clauses} OR EXISTS (
					SELECT 1 FROM {$wpdb->postmeta} m
					WHERE m.post_id = p.ID AND m.meta_key = '_elementor_data' AND ( {$meta_clauses} )
				) )
				ORDER BY p.post_modified DESC, p.ID DESC
				LIMIT 1",
				$patterns
			)
		);
		// phpcs:enable

		$post = $id ? get_post( (int) $id ) : null;
		return $post instanceof WP_Post ? $post : null;
	}

	/**
	 * Publish the created page again, body untouched.
	 *
	 * @param WP_Post $before The hidden page, as it is now.
	 * @return array{status:string,message:string}
	 */
	private static function restore( WP_Post $before ): array {
		if ( 'trash' === $before->post_status && ! wp_untrash_post( $before->ID ) ) {
			return self::failure( __( 'The page could not be taken out of the trash.', 'frak' ) );
		}

		$update = array(
			'ID'          => $before->ID,
			'post_status' => 'publish',
		);
		if ( 'future' === $before->post_status ) {
			// A scheduled date in the future would keep the page scheduled.
			$update['post_date']     = current_time( 'mysql' );
			$update['post_date_gmt'] = current_time( 'mysql', true );
		}

		$result = wp_update_post( $update, true );
		$reason = is_wp_error( $result ) ? $result->get_error_message() : self::verify( $before->ID );
		if ( '' !== $reason ) {
			self::revert( $before );
			return self::failure( $reason );
		}

		update_option( self::OPTION_KEY, $before->ID, false );
		return array(
			'status'  => 'restored',
			'message' => __( 'Your ambassador page is live again.', 'frak' ),
		);
	}

	/**
	 * Insert and publish a new ambassador page.
	 *
	 * @return array{status:string,message:string}
	 */
	private static function create(): array {
		$page = array(
			'post_type'    => 'page',
			'post_status'  => 'publish',
			'post_title'   => 0 === strpos( get_locale(), 'fr' ) ? 'Devenir ambassadeur' : 'Become an ambassador',
			'post_content' => self::body(),
		);

		$id = wp_insert_post( $page, true );
		if ( is_wp_error( $id ) ) {
			return self::failure( $id->get_error_message() );
		}

		// Set after the insert: wp_insert_post() rejects a template only once the page is already published.
		$template = self::template();
		if ( '' !== $template ) {
			update_post_meta( $id, '_wp_page_template', $template );
		}

		$reason = self::verify( $id );
		if ( '' !== $reason ) {
			wp_delete_post( $id, true );
			return self::failure( $reason );
		}

		update_option( self::OPTION_KEY, $id, false );
		return array(
			'status'  => 'created',
			'message' => __( 'Your ambassador page is live.', 'frak' ),
		);
	}

	/**
	 * Read a page back from the database. Empty string when it is published
	 * and still holds the component, else the reason it is not.
	 *
	 * @param int $id Page id.
	 */
	private static function verify( int $id ): string {
		clean_post_cache( $id );
		$post = get_post( $id );

		if ( ! $post instanceof WP_Post ) {
			return __( 'The page could not be read back after saving.', 'frak' );
		}
		if ( 'publish' !== $post->post_status ) {
			return sprintf(
				/* translators: %s: the post status WordPress saved instead of "publish". */
				__( 'The page was saved as "%s" instead of being published, probably by another plugin.', 'frak' ),
				$post->post_status
			);
		}
		if ( ! self::holds_component( $post ) ) {
			return __( 'The ambassador component was removed from the page while saving, probably by another plugin.', 'frak' );
		}

		return '';
	}

	/**
	 * Put a restored page back to the status it had before.
	 *
	 * @param WP_Post $before The page as it was before the restore.
	 */
	private static function revert( WP_Post $before ): void {
		if ( 'trash' === $before->post_status ) {
			wp_trash_post( $before->ID );
			return;
		}

		$update = array(
			'ID'          => $before->ID,
			'post_status' => $before->post_status,
		);
		if ( 'future' === $before->post_status ) {
			$update['post_date']     = $before->post_date;
			$update['post_date_gmt'] = $before->post_date_gmt;
		}
		wp_update_post( $update );
	}

	/**
	 * Failure result.
	 *
	 * @param string $reason Why it failed, shown to the admin.
	 * @return array{status:string,message:string}
	 */
	private static function failure( string $reason ): array {
		return array(
			'status'  => 'failed',
			'message' => $reason,
		);
	}

	/**
	 * Body of a created page: on a block theme the block, aligned `wide` (the
	 * widest column that keeps the theme's side padding; `full` runs edge to
	 * edge); on a classic theme or with the Classic
	 * Editor, which the merchant can see and edit around. Both survive kses.
	 */
	private static function body(): string {
		if ( wp_is_block_theme() && ! class_exists( 'Classic_Editor' ) ) {
			return '<!-- wp:frak/ambassador {"align":"wide"} /-->';
		}
		return '[frak_ambassador]';
	}

	/**
	 * Classic themes: the full-width page template, falling back to wide, then
	 * no sidebar. Block themes: a template without the page title, since the
	 * block's `align` already sets the width. Empty string for the default.
	 */
	private static function template(): string {
		$templates = wp_get_theme()->get_page_templates();
		$tiers     = wp_is_block_theme() ? self::BLOCK_TEMPLATE_NEEDLES : self::TEMPLATE_NEEDLES;

		foreach ( $tiers as $needles ) {
			foreach ( $templates as $slug => $name ) {
				foreach ( $needles as $needle ) {
					if ( false !== stripos( (string) $name, $needle ) || false !== stripos( (string) $slug, $needle ) ) {
						return (string) $slug;
					}
				}
			}
		}

		return '';
	}
}
