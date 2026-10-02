<?php

/**
 * Front-office asset and head injection for the Frak PrestaShop module.
 *
 * `header` renders resource hints, `window.FrakSetup` config, and the SDK
 * `<script>` itself (see {@see self::sdkScriptTag()} for why it lives here).
 * `actionFrontControllerSetMedia` only loads the ambassador-page stylesheet, see {@see self::setMedia()}.
 */
class FrakFrontend
{
    /**
     * Front-office `<head>` fragment: resource hints for both SDK hosts,
     * then the inline `window.FrakSetup` config, then the SDK `<script>`
     * itself — in that order, so the config exists before the SDK reads it.
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

        // The pointer's script fetch is no-cors, so its preconnect must NOT
        // carry `crossorigin`; the shim's `import()` from jsDelivr is a
        // CORS-mode module fetch, so that preconnect must.
        return '<link rel="dns-prefetch" href="' . FrakUrls::sdkPointerHost() . '">'
            . '<link rel="preconnect" href="' . FrakUrls::sdkPointerHost() . '">'
            . '<link rel="dns-prefetch" href="' . FrakUrls::CDN_BASE . '">'
            . '<link rel="preconnect" href="' . FrakUrls::CDN_BASE . '" crossorigin>'
            . '<script>window.FrakSetup=Object.assign(window.FrakSetup||{},{config:{metadata:{'
            . 'name:' . $shop_name_js . ','
            . 'logoUrl:' . $logo_url_js
            . '}' . self::configOverrides() . '}});</script>'
            . self::sdkScriptTag();
    }

    /**
     * `,env:"dev"` and `,domain:"…"` for the config object, only while the
     * matching constant asks for them. The domain is the normalised override;
     * `JSON_HEX_TAG` keeps a `</script>` in it from ending the inline script.
     */
    private static function configOverrides(): string
    {
        $extra = FrakEnv::isDev() ? ',env:"dev"' : '';
        $domain = FrakUtils::merchantDomainOverride();
        if ($domain === '') {
            return $extra;
        }
        $domain_js = json_encode($domain, FrakComponentRenderer::JSON_FLAGS | JSON_HEX_TAG);
        return $extra . ',domain:' . ($domain_js === false ? '""' : $domain_js);
    }

    /**
     * The SDK `<script>` tag with an `onerror` fallback to jsDelivr. Raw
     * markup because `registerJavascript()`'s `attribute` is whitelisted to
     * `async`/`defer` (`JavascriptManagerCore::$valid_attribute`). The pointer
     * file is a single `import()`, so a failed fetch ran nothing to double-run.
     */
    private static function sdkScriptTag(): string
    {
        $fallback = "var s=document.createElement('script');"
            . "s.src='" . FrakUrls::sdkFallbackScript() . "';"
            . 's.defer=true;document.head.appendChild(s)';

        return '<script src="' . FrakUrls::sdkPointerScript() . '" defer'
            . ' onerror="' . $fallback . '"></script>';
    }

    /**
     * Loads the stylesheet that hides the theme's page title, only on the CMS
     * page the module created. The SDK script is raw markup in {@see self::head()}.
     *
     * @param Context $context Forwarded from the Module instance so the helper
     *                         stays a stateless static call.
     */
    public static function setMedia($context): void
    {
        $controller = $context->controller ?? null;
        $pageId = FrakConfig::getAmbassadorPageId();
        if ($pageId > 0 && $controller instanceof CmsController && (int) ($controller->cms->id ?? 0) === $pageId) {
            $controller->registerStylesheet(
                'module-frakintegration-ambassador',
                'modules/frakintegration/views/css/ambassador-page.css'
            );
        }
    }
}
