<?php

require_once _PS_MODULE_DIR_ . 'frakintegration/classes/FrakUtils.php';
require_once _PS_MODULE_DIR_ . 'frakintegration/classes/FrakMerchantResolver.php';
require_once _PS_MODULE_DIR_ . 'frakintegration/classes/FrakWebhookHelper.php';

class AdminFrakIntegrationController extends ModuleAdminController
{
    public function __construct()
    {
        $this->bootstrap = true;
        $this->display = 'view';
        parent::__construct();
        $this->meta_title = $this->l('Frak Integration');
    }

    public function renderView()
    {
        $merchant = FrakMerchantResolver::getRecord();
        $shop_name = Configuration::get('FRAK_SHOP_NAME');
        $logo_url = Configuration::get('FRAK_LOGO_URL');

        $this->context->smarty->assign([
            'module_dir' => $this->module->getPathUri(),
            'form_action' => $this->context->link->getAdminLink('AdminFrakIntegration'),
            'shop_name' => $shop_name ?: Configuration::get('PS_SHOP_NAME'),
            'logo_url' => $logo_url,
            'webhook_secret' => Configuration::get('FRAK_WEBHOOK_SECRET'),
            'webhook_url' => FrakWebhookHelper::getWebhookUrl(),
            'webhook_secret_configured' => !empty(Configuration::get('FRAK_WEBHOOK_SECRET')),
            'cron_url' => $this->buildCronUrl(),
            'frak_dashboard_url' => 'https://business.frak.id/',
            'frak_docs_url' => 'https://docs.frak.id/components/frak-setup',
            'domain' => FrakUtils::currentHost(),
            'merchant_id' => $merchant['id'] ?? '',
            'merchant_name' => $merchant['name'] ?? '',
            'merchant_resolved' => $merchant !== null,
            'merchant_dashboard_url' => $merchant !== null
                ? 'https://business.frak.id/merchant/' . $merchant['id']
                : 'https://business.frak.id/',
        ]);

        return $this->context->smarty->fetch($this->getTemplatePath() . 'configure.tpl');
    }

    /**
     * Build the public URL the merchant copy-pastes into their server cron.
     * Returns an empty string when the cron token has not been provisioned yet
     * (shouldn't happen on a fresh install, but the guard keeps the admin
     * page renderable on broken upgrades). The token is exposed verbatim
     * because the merchant needs to invoke the URL from outside the admin
     * session — we already gate read access to it behind admin auth on this
     * page.
     */
    private function buildCronUrl(): string
    {
        $token = (string) Configuration::get('FRAK_CRON_TOKEN');
        if ($token === '') {
            return '';
        }
        $base = $this->context->link->getBaseLink(null, true);
        return rtrim($base, '/')
            . '/index.php?fc=module&module=frakintegration&controller=cron&token='
            . rawurlencode($token);
    }

    public function postProcess()
    {
        if (Tools::isSubmit('submitFrakModal')) {
            $shopName = strval(Tools::getValue('FRAK_SHOP_NAME'));
            $logoUrl = strval(Tools::getValue('FRAK_LOGO_URL'));

            // Handle optional logo upload first — a successful upload overrides
            // the typed-in URL so the merchant can paste a placeholder + drop a
            // file in one round-trip.
            if (isset($_FILES['FRAK_LOGO_FILE']) && $_FILES['FRAK_LOGO_FILE']['error'] == UPLOAD_ERR_OK) {
                $uploadedFile = $_FILES['FRAK_LOGO_FILE'];
                $allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'svg'];
                $maxFileSize = 2 * 1024 * 1024; // 2MB

                $fileExtension = strtolower(pathinfo($uploadedFile['name'], PATHINFO_EXTENSION));

                if (!in_array($fileExtension, $allowedExtensions)) {
                    $this->errors[] = $this->l('Invalid file format. Only JPG, PNG, GIF, SVG files are allowed.');
                } elseif ($uploadedFile['size'] > $maxFileSize) {
                    $this->errors[] = $this->l('File size exceeds 2MB limit.');
                } else {
                    $uploadsDir = _PS_MODULE_DIR_ . 'frakintegration/uploads/';
                    if (!is_dir($uploadsDir)) {
                        mkdir($uploadsDir, 0755, true);
                    }

                    $filename = 'logo_' . uniqid() . '.' . $fileExtension;
                    $targetPath = $uploadsDir . $filename;

                    if (move_uploaded_file($uploadedFile['tmp_name'], $targetPath)) {
                        $logoUrl = $this->context->link->getBaseLink() . 'modules/frakintegration/uploads/' . $filename;
                        $this->confirmations[] = $this->l('Logo uploaded successfully');
                    } else {
                        $this->errors[] = $this->l('Failed to upload logo file');
                    }
                }
            }

            if (!$shopName || empty($shopName) || !Validate::isGenericName($shopName)) {
                $this->errors[] = $this->l('Invalid Shop Name');
            } elseif (!$logoUrl || empty($logoUrl) || (!Validate::isUrl($logoUrl) && !$this->isLocalFile($logoUrl))) {
                $this->errors[] = $this->l('Invalid Logo URL');
            } elseif (empty($this->errors)) {
                Configuration::updateValue('FRAK_SHOP_NAME', $shopName);
                Configuration::updateValue('FRAK_LOGO_URL', $logoUrl);
                $this->confirmations[] = $this->l('Brand settings updated');

                if (isset($_FILES['FRAK_LOGO_FILE']) && $_FILES['FRAK_LOGO_FILE']['error'] == UPLOAD_ERR_OK) {
                    Tools::redirectAdmin($this->context->link->getAdminLink('AdminFrakIntegration') . '&conf=4');
                }
            }
        }

        if (Tools::isSubmit('submitFrakWebhook')) {
            // The webhook secret is owned by the Frak business dashboard (single
            // source of truth, stored on `merchantWebhooksTable.hookSignatureKey`).
            // The admin pastes it here so outbound HMAC signatures match what the
            // backend verifies. An empty submission clears the row and disables
            // dispatch — mirrors the WordPress plugin's pattern.
            $submittedSecret = strval(Tools::getValue('FRAK_WEBHOOK_SECRET'));
            Configuration::updateValue('FRAK_WEBHOOK_SECRET', $submittedSecret);
            $this->confirmations[] = $this->l('Webhook secret updated');
        }

        if (Tools::isSubmit('refreshFrakMerchant')) {
            FrakMerchantResolver::invalidate();
            $merchant = FrakMerchantResolver::getRecord();
            if ($merchant !== null) {
                $this->confirmations[] = $this->l('Merchant resolved') . ': ' . $merchant['id'];
            } else {
                $this->errors[] = $this->l('Merchant not resolved for the current domain. Register the shop in the Frak dashboard.');
            }
        }
    }

    private function isLocalFile($url)
    {
        // Check if the URL is a local file uploaded to the module directory
        $moduleUploadPath = _PS_MODULE_DIR_ . 'frakintegration/uploads/';
        $baseUrl = $this->context->link->getBaseLink();

        // Check if URL starts with our base URL and contains our module path
        if (strpos($url, $baseUrl . 'modules/frakintegration/uploads/') === 0) {
            // Extract filename from URL
            $filename = basename($url);
            $absolutePath = $moduleUploadPath . $filename;
            return file_exists($absolutePath);
        }

        return false;
    }
}
