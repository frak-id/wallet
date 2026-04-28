<?php
if (!defined('_PS_VERSION_')) {
    exit;
}

require_once __DIR__ . '/vendor/autoload.php';
require_once __DIR__ . '/classes/FrakWebhookHelper.php';

class FrakIntegration extends Module
{
    public function __construct()
    {
        $this->name = 'frakintegration';
        $this->tab = 'front_office_features';
        $this->version = '1.0.0';
        $this->author = 'Frak';
        $this->need_instance = 0;
        $this->ps_versions_compliancy = [
            'min' => '1.7',
            'max' => _PS_VERSION_
        ];
        $this->bootstrap = true;

        parent::__construct();

        $this->displayName = $this->l('Frak');
        $this->description = $this->l('Integrates Frak services with PrestaShop.');

        $this->confirmUninstall = $this->l('Are you sure you want to uninstall?');
    }

    public function install()
    {
        if (parent::install() &&
            $this->registerHook('header') &&
            $this->registerHook('displayFooter') &&
            $this->registerHook('displayProductAdditionalInfo') &&
            $this->registerHook('displayOrderConfirmation') &&
            $this->registerHook('actionOrderStatusUpdate')) {
            Configuration::updateValue('FRAK_SHOP_NAME', Configuration::get('PS_SHOP_NAME'));
            Configuration::updateValue('FRAK_LOGO_URL', $this->context->link->getMediaLink(_PS_IMG_ . Configuration::get('PS_LOGO')));
            Configuration::updateValue('FRAK_MODAL_LNG', 'default');
            Configuration::updateValue('FRAK_MODAL_I18N', '{}', true);
            Configuration::updateValue('FRAK_FLOATING_BUTTON_ENABLED', true);
            Configuration::updateValue('FRAK_FLOATING_BUTTON_POSITION', 'right');
            Configuration::updateValue('FRAK_SHARING_BUTTON_ENABLED', true);
            Configuration::updateValue('FRAK_SHARING_BUTTON_TEXT', 'Share with Frak');
            return true;
        }
        return false;
    }

    public function uninstall()
    {
        if (parent::uninstall() &&
            $this->unregisterHook('header') &&
            $this->unregisterHook('displayFooter') &&
            $this->unregisterHook('displayOrderConfirmation') &&
            $this->unregisterHook('displayProductAdditionalInfo')) {
            Configuration::deleteByName('FRAK_SHOP_NAME');
            Configuration::deleteByName('FRAK_LOGO_URL');
            Configuration::deleteByName('FRAK_MODAL_LNG');
            Configuration::deleteByName('FRAK_MODAL_I18N');
            Configuration::deleteByName('FRAK_FLOATING_BUTTON_ENABLED');
            Configuration::deleteByName('FRAK_FLOATING_BUTTON_POSITION');
            Configuration::deleteByName('FRAK_SHARING_BUTTON_ENABLED');
            Configuration::deleteByName('FRAK_SHARING_BUTTON_TEXT');
            Configuration::deleteByName('FRAK_SHARING_BUTTON_STYLE');
            Configuration::deleteByName('FRAK_SHARING_BUTTON_CUSTOM_STYLE');
            Configuration::deleteByName('FRAK_WEBHOOK_SECRET');
            Configuration::deleteByName('FRAK_WEBHOOK_LOGS');
            return true;
        }
        return false;
    }

    public function hookHeader()
    {
        $this->context->smarty->assign([
            'shop_name' => Configuration::get('FRAK_SHOP_NAME'),
            'logo_url' => Configuration::get('FRAK_LOGO_URL'),
            'modal_lng' => Configuration::get('FRAK_MODAL_LNG'),
            'modal_i18n' => Configuration::get('FRAK_MODAL_I18N'),
            'floating_button_position' => Configuration::get('FRAK_FLOATING_BUTTON_POSITION')
        ]);

        return $this->display(__FILE__, 'views/templates/hook/head.tpl');
    }


    public function hookDisplayFooter()
    {
        if (!Configuration::get('FRAK_FLOATING_BUTTON_ENABLED')) {
            return;
        }
        return $this->display(__FILE__, 'views/templates/hook/floatingButton.tpl');
    }

    public function hookDisplayProductAdditionalInfo()
    {
        if (!Configuration::get('FRAK_SHARING_BUTTON_ENABLED')) {
            return;
        }

        $sharing_button_style = Configuration::get('FRAK_SHARING_BUTTON_STYLE');
        $sharing_button_classname = 'btn btn-secondary'; // Default value

        if ($sharing_button_style === 'primary') {
            $sharing_button_classname = 'btn btn-primary';
        } elseif ($sharing_button_style === 'custom') {
            $sharing_button_classname = Configuration::get('FRAK_SHARING_BUTTON_CUSTOM_STYLE');
        }

        $this->context->smarty->assign([
            'button_text' => Configuration::get('FRAK_SHARING_BUTTON_TEXT'),
            'sharing_button_classname' => $sharing_button_classname,
        ]);
        return $this->display(__FILE__, 'views/templates/hook/sharingButton.tpl');
    }

    public function hookActionOrderStatusUpdate($params)
    {
        $order_id = $params['id_order'];
        $token = $params['cart']->secure_key;
        $new_status = $params['newOrderStatus'];
        
        PrestaShopLogger::addLog('FrakIntegration: Order status update triggered for order ' . $order_id . ' with status ID: ' . $new_status->id . ' (' . $new_status->name . ')', 1);
        
        // The different statuses that we send to the webhook
        $status_map = [
            (int)Configuration::get('PS_OS_WS_PAYMENT') => 'confirmed',
            (int)Configuration::get('PS_OS_PAYMENT') => 'confirmed',
            (int)Configuration::get('PS_OS_DELIVERED') => 'confirmed',
            (int)Configuration::get('PS_OS_CANCELED') => 'cancelled',
            (int)Configuration::get('PS_OS_REFUND') => 'refunded',
        ];

        // Status code to skip
        $skip_status_codes = [
            (int)Configuration::get('PS_OS_SHIPPING'),
            (int)Configuration::get('PS_OS_PREPARATION'),
        ];

        // If the status code is in the skip list, do nothing
        if (in_array((int)$new_status->id, $skip_status_codes)) {
            PrestaShopLogger::addLog('FrakIntegration: Skipping webhook for order ' . $order_id . ' with status: ' . $new_status->id, 1);
            return;
        }

        // Default to pending if the status is not in the map
        $webhook_status = 'pending';
        if (array_key_exists((int)$new_status->id, $status_map)) {
            $webhook_status = $status_map[(int)$new_status->id];
        }

        PrestaShopLogger::addLog('FrakIntegration: Triggering webhook for order ' . $order_id . ' with status: ' . $webhook_status, 1);
        
        // Send the webhook
        $result = FrakWebhookHelper::send($order_id, $webhook_status, $token);
        
        if ($result && isset($result['success'])) {
            if ($result['success']) {
                PrestaShopLogger::addLog('FrakIntegration: Webhook sent successfully for order ' . $order_id, 1);
            } else {
                PrestaShopLogger::addLog('FrakIntegration: Webhook failed for order ' . $order_id . ': ' . ($result['error'] ?? 'Unknown error'), 3);
            }
        }
    }

    public function hookDisplayOrderConfirmation($params)
    {
        $order = $params['order'];

        if (!$order) {
            // No order found, do nothing
            return;
        }

        $this->context->smarty->assign([
            'customer_id' => $order->id_customer,
            'order_id' => $order->id,
            'token' => $order->secure_key,
        ]);

        return $this->display(__FILE__, 'views/templates/hook/orderConfirmation.tpl');
    }


    public function getContent()
    {
        Tools::redirectAdmin($this->context->link->getAdminLink('AdminFrakIntegration'));
    }
}
