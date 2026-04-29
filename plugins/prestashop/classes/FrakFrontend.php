<?php

/**
 * Front-office asset and head injection for the Frak PrestaShop module.
 *
 * Owns the two always-on front-office hooks:
 *   - `header`: resource hints + inline `window.FrakSetup` config block.
 *   - `actionFrontControllerSetMedia`: SDK script registered through
 *     PrestaShop's native asset manager.
 *
 * Mirrors the WordPress sibling's `Frak_Frontend` (head + asset wiring) so
 * the two plugins read as a coherent family. Extracted from the
 * `FrakIntegration` bootstrap to keep the Module class a thin hook router.
 */
class FrakFrontend
{
    /**
     * Front-office `<head>` fragment — kept minimal. Emits resource hints
     * (`dns-prefetch` + `preconnect`) so the browser warms the TLS
     * handshake to `cdn.jsdelivr.net` while parsing continues, plus the
     * inline `window.FrakSetup` config block (kept inline so the SDK reads
     * a non-empty config when it runs from the deferred script tag).
     *
     * The SDK script tag itself lives in {@see self::setMedia()} — outside
     * the `<head>` dispatch path, in PrestaShop's native asset pipeline.
     */
    public static function head(): string
    {
        // Single batched read so we touch the autoload cache once. The brand
        // pair is the only Configuration data the front-office head needs;
        // everything else lives in the bundled placement row or the Symfony
        // Cache pool.
        $brand = FrakConfig::getBrand();

        // Bypass Smarty: the head fragment is 3 lines of HTML and 2 escaped
        // values, both of which `json_encode` produces JS-safe string
        // literals for (covers `<`, `>`, `'`, `"`, control chars, unicode).
        // Avoiding the Smarty parser/render saves a real-but-small amount of
        // CPU on every front-office request — measurable in flame graphs on
        // high-traffic shops.
        $shop_name_js = json_encode($brand['name'], FrakComponentRenderer::JSON_FLAGS);
        $logo_url_js = json_encode($brand['logoUrl'], FrakComponentRenderer::JSON_FLAGS);
        if ($shop_name_js === false) {
            $shop_name_js = '""';
        }
        if ($logo_url_js === false) {
            $logo_url_js = '""';
        }

        return '<link rel="dns-prefetch" href="' . FrakUrls::CDN_BASE . '">'
            . '<link rel="preconnect" href="' . FrakUrls::CDN_BASE . '" crossorigin>'
            . '<script>window.FrakSetup=Object.assign(window.FrakSetup||{},{config:{metadata:{'
            . 'name:' . $shop_name_js . ','
            . 'logoUrl:' . $logo_url_js
            . '}}});</script>';
    }

    /**
     * Register the SDK external script via PrestaShop's native asset manager.
     * Runs on every front-office request (the hook fires before the
     * controller renders), so the `<script>` ends up in the position the
     * asset manager picks (typically bottom-of-body) with the `defer`
     * attribute we requested.
     *
     * Why `actionFrontControllerSetMedia` instead of inline `<script>` in
     * `head.tpl`:
     *   - PrestaShop's CCC (Combine, Compress, Cache) pipeline is asset-
     *     manager aware: registered remote scripts are deduped if another
     *     module asks for the same URL, and the merchant retains control
     *     via `Performance → CCC`.
     *   - `priority => 200` runs the SDK after PrestaShop's own scripts so
     *     the inline `window.FrakSetup` block from {@see self::head()} is
     *     guaranteed to be evaluated before the deferred SDK boots.
     *   - Mirrors the WordPress sibling's
     *     `wp_enqueue_script('frak-sdk', ..., strategy:defer, in_footer:true)`
     *     ({@see plugins/wordpress/includes/class-frak-frontend.php}).
     *
     * @param Context $context Forwarded from the Module instance so the helper
     *                         stays a stateless static call.
     */
    public static function setMedia($context): void
    {
        if (!isset($context->controller) || !method_exists($context->controller, 'registerJavascript')) {
            return;
        }
        // Skip on AJAX: registerJavascript writes into the asset queue that
        // only the full HTML response materialises. AJAX endpoints (cart
        // updates, search-as-you-type, theme JSON polls) never render the
        // queue, so registering here is wasted work — noticeable on chatty
        // themes that fire dozens of XHRs per page lifecycle.
        if (!empty($context->controller->ajax)) {
            return;
        }
        $context->controller->registerJavascript(
            'frak-sdk',
            FrakUrls::SDK_SCRIPT,
            [
                'server' => 'remote',
                'position' => 'bottom',
                'priority' => 200,
                'attribute' => 'defer',
            ]
        );
    }
}
