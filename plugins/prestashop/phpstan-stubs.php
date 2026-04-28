<?php

if (!class_exists('Module')) {
    class Module
    {
        public function __construct()
        {
        }

        public function install()
        {
            return true;
        }

        public function uninstall()
        {
            return true;
        }
    }
}

if (!class_exists('ModuleAdminController')) {
    class ModuleAdminController
    {
        public function __construct()
        {
        }
    }
}

if (!class_exists('Controller')) {
    class Controller
    {
        public function init()
        {
        }
    }
}

if (!class_exists('ModuleFrontController')) {
    class ModuleFrontController extends Controller
    {
        public $auth = false;
        public $guestAllowed = true;
        public $display_header = false;
        public $display_footer = false;
        public $display_column_left = false;
        public $display_column_right = false;
        public $ssl = false;
        public $module;
    }
}
