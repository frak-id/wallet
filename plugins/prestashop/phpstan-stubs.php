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
