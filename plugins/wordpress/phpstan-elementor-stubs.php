<?php
/**
 * Minimal Elementor stubs for PHPStan.
 *
 * Used solely by static analysis (referenced from `phpstan.neon` via
 * `scanFiles`). Production code never loads this file — when Elementor
 * is active it ships the real classes; when it isn't, our integration
 * is gated on `did_action( 'elementor/loaded' )` and never references
 * these symbols.
 *
 * Stubs are kept as thin as possible — only the surface our
 * `class-frak-elementor*.php` files actually touch. Adding a new control
 * type or accessor? Stub it here so PHPStan keeps passing.
 *
 * @package Frak_Integration
 */

namespace Elementor;

if ( ! class_exists( '\Elementor\Widget_Base' ) ) {
	/**
	 * Stub for Elementor's widget base class.
	 */
	abstract class Widget_Base {

		/**
		 * @return string
		 */
		abstract public function get_name();

		/**
		 * @return string
		 */
		abstract public function get_title();

		/**
		 * @return string
		 */
		public function get_icon() {
			return '';
		}

		/**
		 * @return string[]
		 */
		public function get_categories() {
			return array();
		}

		/**
		 * @return string[]
		 */
		public function get_keywords() {
			return array();
		}

		/**
		 * @return string
		 */
		public function get_custom_help_url() {
			return '';
		}

		/**
		 * @return array<string, mixed>
		 */
		public function get_settings_for_display() {
			return array();
		}

		/**
		 * @return void
		 */
		protected function register_controls() {
		}

		/**
		 * @return void
		 */
		protected function render() {
		}

		/**
		 * @param string               $section_id Section identifier.
		 * @param array<string, mixed> $args       Section arguments.
		 * @return void
		 */
		protected function start_controls_section( $section_id, $args = array() ) {
		}

		/**
		 * @return void
		 */
		protected function end_controls_section() {
		}

		/**
		 * @param string               $id   Control identifier.
		 * @param array<string, mixed> $args Control arguments.
		 * @return void
		 */
		protected function add_control( $id, $args = array() ) {
		}
	}
}

if ( ! class_exists( '\Elementor\Controls_Manager' ) ) {
	/**
	 * Stub for Elementor's controls manager constants.
	 */
	class Controls_Manager {
		const TAB_CONTENT = 'content';
		const TEXT        = 'text';
		const TEXTAREA    = 'textarea';
		const SELECT      = 'select';
		const SWITCHER    = 'switcher';
	}
}

if ( ! class_exists( '\Elementor\Plugin' ) ) {
	/**
	 * Stub for Elementor's main plugin singleton.
	 */
	class Plugin {

		/** @var Plugin|null */
		public static $instance;

		/** @var object|null */
		public $editor;

		/** @var object|null */
		public $preview;
	}
}

if ( ! class_exists( '\Elementor\Widgets_Manager' ) ) {
	/**
	 * Stub for Elementor's widgets manager.
	 */
	class Widgets_Manager {

		/**
		 * @param Widget_Base $widget Widget instance.
		 * @return void
		 */
		public function register( $widget ) {
		}
	}
}

if ( ! class_exists( '\Elementor\Elements_Manager' ) ) {
	/**
	 * Stub for Elementor's elements manager.
	 */
	class Elements_Manager {

		/**
		 * @param string               $name Category slug.
		 * @param array<string, mixed> $args Category arguments.
		 * @return void
		 */
		public function add_category( $name, $args = array() ) {
		}
	}
}
