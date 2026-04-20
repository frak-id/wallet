<?php
/**
 * Base class for Frak sidebar widgets.
 *
 * Provides shared `widget()`, `form()`, `update()` and field-rendering
 * plumbing so each concrete widget only declares its attribute schema and
 * which {@see Frak_Component_Renderer} method to call. Saves duplicating
 * ~60 LOC × 3 widgets.
 *
 * The attribute schema is an ordered map of `camelCase key => field spec`.
 * Supported field types:
 *
 *   - `text`     => `<input type="text">` + `sanitize_text_field`.
 *   - `textarea` => `<textarea>` + `sanitize_textarea_field`.
 *   - `checkbox` => `<input type="checkbox">` + boolean cast.
 *   - `select`   => `<select>` (requires `options` map); value restricted to keys.
 *   - `url`      => `<input type="url">` + `esc_url_raw` on save, `esc_url` on render.
 *
 * All field labels are translatable via the `frak` text domain. Each widget
 * additionally carries the standard `title` field (rendered inside the
 * `before_title` / `after_title` sidebar wrappers when non-empty).
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_Widget_Base
 */
abstract class Frak_Widget_Base extends WP_Widget {

	/**
	 * Schema describing each editable attribute.
	 *
	 * @return array<string, array{type: string, label: string, help?: string, options?: array<string, string>}>
	 */
	abstract protected function field_schema(): array;

	/**
	 * Produce the final HTML for the given attribute bag.
	 *
	 * @param array<string, mixed> $attrs Widget instance values.
	 * @return string
	 */
	abstract protected function render_component( array $attrs ): string;

	/**
	 * Output the widget on the frontend.
	 *
	 * The sidebar-provided wrappers (`before_widget` / `after_widget`) are
	 * emitted unconditionally; the title wrappers only when an explicit
	 * title was entered — this matches WP core's default widget idiom and
	 * keeps the output clean when merchants don't want a heading.
	 *
	 * @param array<string, mixed> $args     Sidebar / theme wrappers.
	 * @param array<string, mixed> $instance Widget instance settings.
	 */
	public function widget( $args, $instance ) {
		$before_widget = isset( $args['before_widget'] ) ? $args['before_widget'] : '';
		$after_widget  = isset( $args['after_widget'] ) ? $args['after_widget'] : '';
		$before_title  = isset( $args['before_title'] ) ? $args['before_title'] : '';
		$after_title   = isset( $args['after_title'] ) ? $args['after_title'] : '';

		echo $before_widget; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Sidebar-provided, pre-escaped by theme/core.

		if ( ! empty( $instance['title'] ) ) {
			/** This filter is documented in wp-includes/default-widgets.php */
			$title = apply_filters( 'widget_title', (string) $instance['title'], $instance, $this->id_base );
			echo $before_title . esc_html( $title ) . $after_title; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Title wrappers pre-escaped; title itself escaped above.
		}

		echo $this->render_component( $instance ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Renderer escapes each attribute internally.

		echo $after_widget; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Sidebar-provided, pre-escaped by theme/core.
	}

	/**
	 * Render the admin form fields (title + every key in `field_schema()`).
	 *
	 * @param array<string, mixed> $instance Current widget values.
	 * @return string Form HTML (also echoed by WP — we return empty per WP contract).
	 */
	public function form( $instance ) {
		$title = isset( $instance['title'] ) ? (string) $instance['title'] : '';

		echo '<p><label for="' . esc_attr( $this->get_field_id( 'title' ) ) . '">' . esc_html__( 'Title', 'frak' ) . '</label>';
		echo '<input class="widefat" type="text" id="' . esc_attr( $this->get_field_id( 'title' ) ) . '" name="' . esc_attr( $this->get_field_name( 'title' ) ) . '" value="' . esc_attr( $title ) . '" /></p>';

		foreach ( $this->field_schema() as $key => $field ) {
			$this->render_field( $key, $field, $instance );
		}

		return '';
	}

	/**
	 * Sanitize submitted values against the schema.
	 *
	 * Unknown keys are dropped so form tampering can't smuggle extra HTML
	 * attributes into the rendered component. `select` field values are
	 * gated to the declared options list — again, defence in depth.
	 *
	 * @param array<string, mixed> $new_instance Submitted values.
	 * @param array<string, mixed> $old_instance Previous stored values.
	 * @return array<string, mixed>
	 */
	public function update( $new_instance, $old_instance ) {
		unset( $old_instance ); // Unused; WP signature requires both.

		$clean          = array();
		$clean['title'] = isset( $new_instance['title'] ) ? sanitize_text_field( (string) $new_instance['title'] ) : '';

		foreach ( $this->field_schema() as $key => $field ) {
			$raw = isset( $new_instance[ $key ] ) ? $new_instance[ $key ] : '';

			switch ( $field['type'] ) {
				case 'checkbox':
					$clean[ $key ] = ! empty( $raw );
					break;

				case 'textarea':
					$clean[ $key ] = sanitize_textarea_field( (string) $raw );
					break;

				case 'select':
					$options       = isset( $field['options'] ) ? $field['options'] : array();
					$raw_str       = (string) $raw;
					$clean[ $key ] = array_key_exists( $raw_str, $options ) ? $raw_str : '';
					break;

				case 'url':
					$clean[ $key ] = esc_url_raw( (string) $raw );
					break;

				case 'text':
				default:
					$clean[ $key ] = sanitize_text_field( (string) $raw );
					break;
			}
		}

		return $clean;
	}

	/**
	 * Render a single form field according to its spec.
	 *
	 * @param string               $key      Instance key.
	 * @param array<string, mixed> $field    Field spec (keys: type, label, help?, options?).
	 * @param array<string, mixed> $instance Current values.
	 */
	private function render_field( string $key, array $field, array $instance ) {
		$field_id   = $this->get_field_id( $key );
		$field_name = $this->get_field_name( $key );
		$value      = isset( $instance[ $key ] ) ? $instance[ $key ] : '';
		$help       = isset( $field['help'] ) ? $field['help'] : '';

		echo '<p>';

		switch ( $field['type'] ) {
			case 'checkbox':
				$checked = ! empty( $value ) ? ' checked="checked"' : '';
				echo '<input type="checkbox" id="' . esc_attr( $field_id ) . '" name="' . esc_attr( $field_name ) . '" value="1"' . $checked . ' /> '; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- $checked is a static string.
				echo '<label for="' . esc_attr( $field_id ) . '">' . esc_html( $field['label'] ) . '</label>';
				break;

			case 'textarea':
				echo '<label for="' . esc_attr( $field_id ) . '">' . esc_html( $field['label'] ) . '</label>';
				echo '<textarea class="widefat" rows="3" id="' . esc_attr( $field_id ) . '" name="' . esc_attr( $field_name ) . '">' . esc_textarea( (string) $value ) . '</textarea>';
				break;

			case 'select':
				$options = isset( $field['options'] ) ? $field['options'] : array();
				echo '<label for="' . esc_attr( $field_id ) . '">' . esc_html( $field['label'] ) . '</label>';
				echo '<select class="widefat" id="' . esc_attr( $field_id ) . '" name="' . esc_attr( $field_name ) . '">';
				foreach ( $options as $option_value => $option_label ) {
					echo '<option value="' . esc_attr( $option_value ) . '"' . selected( (string) $value, (string) $option_value, false ) . '>' . esc_html( $option_label ) . '</option>';
				}
				echo '</select>';
				break;

			case 'url':
				echo '<label for="' . esc_attr( $field_id ) . '">' . esc_html( $field['label'] ) . '</label>';
				echo '<input class="widefat" type="url" id="' . esc_attr( $field_id ) . '" name="' . esc_attr( $field_name ) . '" value="' . esc_url( (string) $value ) . '" />';
				break;

			case 'text':
			default:
				echo '<label for="' . esc_attr( $field_id ) . '">' . esc_html( $field['label'] ) . '</label>';
				echo '<input class="widefat" type="text" id="' . esc_attr( $field_id ) . '" name="' . esc_attr( $field_name ) . '" value="' . esc_attr( (string) $value ) . '" />';
				break;
		}

		if ( '' !== $help ) {
			echo '<br /><small>' . esc_html( $help ) . '</small>';
		}

		echo '</p>';
	}
}
