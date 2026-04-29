<?php

class AdminFrakIntegrationController extends ModuleAdminController
{
    public function __construct()
    {
        $this->bootstrap = true;
        $this->display = 'view';
        parent::__construct();
        $this->meta_title = $this->l('Frak Integration');
    }

    /**
     * Register the admin-only static assets used by the Frak configuration
     * page.
     *
     * `views/js/admin.js` carries the live logo-preview wiring (URL input +
     * file-picker ↔ `<img>` in the side panel). Loading it via `addJS`
     * gets it cached by the browser across admin page loads (vs the inline
     * `<script>` it replaced in `configure.tpl`, which was re-shipped on
     * every render) and removes the `unsafe-inline` requirement merchants
     * running CSP would otherwise need.
     *
     * `setMedia` is scoped per-controller-route by `ModuleAdminController`,
     * so this fires only when the Frak admin page renders — not on every
     * back-office page.
     */
    public function setMedia($isNewTheme = false): void
    {
        parent::setMedia($isNewTheme);
        $this->addJS($this->module->getPathUri() . 'views/js/admin.js');
    }

    public function renderView()
    {
        $merchant = FrakMerchantResolver::getRecord();

        // Batch the brand + webhook lookups in one Configuration::getMultiple
        // call. Each individual `Configuration::get` hits the autoload cache,
        // but a single batched call collapses the (already fast) lookups
        // into one hashmap walk and matches the PrestaShop best-practice for
        // module settings reads (see ps_wirepayment).
        $config = Configuration::getMultiple([
            'FRAK_SHOP_NAME',
            'FRAK_LOGO_URL',
            'FRAK_WEBHOOK_SECRET',
            'PS_SHOP_NAME',
        ]);
        $shop_name = $config['FRAK_SHOP_NAME'] ?? '';
        $logo_url = $config['FRAK_LOGO_URL'] ?? '';
        $webhook_secret = $config['FRAK_WEBHOOK_SECRET'] ?? '';
        $ps_shop_name = $config['PS_SHOP_NAME'] ?? '';

        $this->context->smarty->assign([
            'module_dir' => $this->module->getPathUri(),
            'form_action' => $this->context->link->getAdminLink('AdminFrakIntegration'),
            'shop_name' => $shop_name ?: $ps_shop_name,
            'logo_url' => $logo_url,
            'webhook_secret' => $webhook_secret,
            'webhook_url' => FrakWebhookHelper::getWebhookUrl(),
            'webhook_secret_configured' => !empty($webhook_secret),
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
            'placement_groups' => $this->buildPlacementGroups(),
            'queue_stats' => FrakWebhookQueue::stats(),
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

    /**
     * Group registered placements by component so the template renders one
     * `<fieldset>` per component (Banner / Share button / Post-purchase) with
     * its toggles inside. The grouping is computed here (rather than in the
     * template) so the Smarty file stays declarative.
     *
     * Each placement entry carries its current enabled state alongside its
     * static metadata. The enabled values are pulled from the in-memory
     * placement map ({@see FrakPlacementRegistry::getEnabledMap()}) which
     * is decoded from the bundled storage row exactly once per request.
     *
     * @return array<string, array{label: string, items: array<int, array<string, mixed>>}>
     */
    private function buildPlacementGroups(): array
    {
        $component_labels = [
            FrakPlacementRegistry::COMPONENT_SHARE_BUTTON => $this->l('Share button'),
            FrakPlacementRegistry::COMPONENT_BANNER => $this->l('Banner'),
            FrakPlacementRegistry::COMPONENT_POST_PURCHASE => $this->l('Post-purchase card'),
        ];

        $groups = [];
        foreach ($component_labels as $component => $label) {
            $groups[$component] = ['label' => $label, 'items' => []];
        }

        // Fetch the enabled map once — `isEnabled()` would re-decode it per
        // call, this skips the loop overhead.
        $enabled_map = FrakPlacementRegistry::getEnabledMap();

        foreach (FrakPlacementRegistry::PLACEMENTS as $id => $placement) {
            $component = $placement['component'];
            if (!isset($groups[$component])) {
                continue;
            }
            $groups[$component]['items'][] = [
                'id' => $id,
                'config_key' => $placement['config_key'],
                'label' => $this->l($placement['label']),
                'description' => $this->l($placement['description']),
                'hook' => $placement['hook'],
                'placement_attr' => $placement['placement_attr'],
                'enabled' => $enabled_map[$id] ?? $placement['default'],
            ];
        }

        // Strip empty groups so the template does not render orphaned
        // headings (e.g. if a future component has no placements yet).
        return array_filter(
            $groups,
            static fn (array $group): bool => !empty($group['items'])
        );
    }

    public function postProcess()
    {
        if (Tools::isSubmit('submitFrakSettings')) {
            $this->processBrandFields();
            $this->processWebhookSecret();
            $this->processPlacementToggles();
        }

        if (Tools::isSubmit('refreshFrakMerchant')) {
            $this->processMerchantRefresh();
        }

        if (Tools::isSubmit('drainFrakQueue')) {
            $this->processDrainQueue();
        }
    }

    /**
     * Persist the brand-section fields (shop name + logo URL/file). A
     * successful file upload replaces the typed-in URL so the merchant can
     * paste a placeholder + drop a file in one round-trip.
     */
    private function processBrandFields(): void
    {
        $shopName = strval(Tools::getValue('FRAK_SHOP_NAME'));
        $logoUrl = strval(Tools::getValue('FRAK_LOGO_URL'));

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

        if (!$shopName || !Validate::isGenericName($shopName)) {
            $this->errors[] = $this->l('Invalid Shop Name');
            return;
        }
        if (!$logoUrl || (!Validate::isUrl($logoUrl) && !$this->isLocalFile($logoUrl))) {
            $this->errors[] = $this->l('Invalid Logo URL');
            return;
        }

        Configuration::updateValue('FRAK_SHOP_NAME', $shopName);
        Configuration::updateValue('FRAK_LOGO_URL', $logoUrl);
        $this->confirmations[] = $this->l('Brand settings updated');
    }

    /**
     * Persist the webhook secret. Empty submissions clear the row and disable
     * dispatch — mirrors the WordPress plugin's pattern. The secret is owned
     * by the Frak business dashboard (single source of truth, stored on
     * `merchantWebhooksTable.hookSignatureKey`); the admin pastes it here so
     * outbound HMAC signatures match what the backend verifies.
     */
    private function processWebhookSecret(): void
    {
        if (!Tools::getIsset('FRAK_WEBHOOK_SECRET')) {
            return;
        }
        $submittedSecret = strval(Tools::getValue('FRAK_WEBHOOK_SECRET'));
        $previousSecret = (string) Configuration::get('FRAK_WEBHOOK_SECRET');
        if ($submittedSecret === $previousSecret) {
            return;
        }
        Configuration::updateValue('FRAK_WEBHOOK_SECRET', $submittedSecret);
        // Reset the helper's per-request memo so the new secret takes effect
        // immediately if any subsequent action in the same request triggers
        // a webhook (e.g. saving + draining the queue).
        FrakWebhookHelper::resetCache();
        $this->confirmations[] = $this->l('Webhook secret updated');
    }

    /**
     * Persist placement on/off toggles from the rendered checkboxes. The form
     * lists every registered placement; an unchecked checkbox is absent from
     * `$_POST`, so we treat "missing" as "disabled" instead of "leave alone"
     * — otherwise the merchant could never turn a placement off.
     *
     * Writes go through {@see FrakPlacementRegistry::setEnabledMap()} which
     * collapses every placement update into a single bundled-row write
     * (single round-trip vs the N writes a per-row layout would need).
     */
    private function processPlacementToggles(): void
    {
        $updates = [];
        foreach (FrakPlacementRegistry::PLACEMENTS as $id => $placement) {
            $form_key = $placement['config_key'];
            // The rendered form emits a hidden `<input name="…__present" value="1">`
            // alongside each checkbox so we can distinguish "form did not include
            // this placement" (do nothing) from "checkbox unchecked" (write 0).
            if (!Tools::getIsset($form_key . '__present')) {
                continue;
            }
            $updates[$id] = (bool) Tools::getValue($form_key);
        }
        if (empty($updates)) {
            return;
        }
        $current = FrakPlacementRegistry::getEnabledMap();
        $changed = false;
        foreach ($updates as $id => $value) {
            if (($current[$id] ?? null) !== $value) {
                $changed = true;
                break;
            }
        }
        if (!$changed) {
            return;
        }
        if (FrakPlacementRegistry::setEnabledMap($updates)) {
            $this->confirmations[] = $this->l('Placement settings updated');
        }
    }

    /**
     * Force-refresh the cached merchant resolver record. Wired to the
     * "Refresh Merchant" button — invalidates the per-domain cache and the
     * negative cache, then re-queries `GET /user/merchant/resolve` so a
     * domain rename / fresh registration shows up immediately.
     */
    private function processMerchantRefresh(): void
    {
        FrakMerchantResolver::invalidate();
        // Drop the helper's URL memo too — the URL is derived from the
        // merchant id and would otherwise be stale within the same request.
        FrakWebhookHelper::resetCache();
        $merchant = FrakMerchantResolver::getRecord();
        if ($merchant !== null) {
            $this->confirmations[] = $this->l('Merchant resolved') . ': ' . $merchant['id'];
            return;
        }
        $this->errors[] = $this->l('Merchant not resolved for the current domain. Register the shop in the Frak dashboard.');
    }

    /**
     * Synchronous drainer trigger — wired to the "Drain now" button on the
     * queue health panel. Handy when the cron URL has not been wired up yet,
     * or when the merchant wants to flush a build-up after fixing a backend
     * outage without waiting for the next cron tick.
     */
    private function processDrainQueue(): void
    {
        $stats = FrakWebhookCron::run();
        if (!empty($stats['skipped'])) {
            $this->errors[] = $this->l('Webhook queue drainer is already running. Try again in a few minutes.');
            return;
        }
        $this->confirmations[] = sprintf(
            $this->l('Webhook queue drained: %1$d processed (%2$d success, %3$d failure)'),
            (int) $stats['processed'],
            (int) $stats['success'],
            (int) $stats['failure']
        );
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
