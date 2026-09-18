<?php

/**
 * Front-office asset and head injection for the Frak PrestaShop module.
 *
 * `header` renders resource hints, `window.FrakSetup` config, and the SDK
 * `<script>` itself (see {@see self::sdkScriptTag()} for why it lives here).
 * `actionFrontControllerSetMedia` is currently a no-op, see {@see self::setMedia()}.
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
        return '<link rel="dns-prefetch" href="' . FrakUrls::SDK_POINTER_HOST . '">'
            . '<link rel="preconnect" href="' . FrakUrls::SDK_POINTER_HOST . '">'
            . '<link rel="dns-prefetch" href="' . FrakUrls::CDN_BASE . '">'
            . '<link rel="preconnect" href="' . FrakUrls::CDN_BASE . '" crossorigin>'
            . '<script>window.FrakSetup=Object.assign(window.FrakSetup||{},{config:{metadata:{'
            . 'name:' . $shop_name_js . ','
            . 'logoUrl:' . $logo_url_js
            . '}}});</script>'
            . self::sdkScriptTag();
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
            . "s.src='" . FrakUrls::SDK_FALLBACK_SCRIPT . "';"
            . 's.defer=true;document.head.appendChild(s)';

        return '<script src="' . FrakUrls::SDK_POINTER_SCRIPT . '" defer'
            . ' onerror="' . $fallback . '"></script>';
    }

    /**
     * Intentionally inert: the SDK script is raw markup in {@see self::head()}
     * (see {@see self::sdkScriptTag()}). Kept as the registered
     * `actionFrontControllerSetMedia` target so no hook migration is needed.
     *
     * @param Context $context Forwarded from the Module instance so the helper
     *                         stays a stateless static call.
     */
    public static function setMedia($context): void
    {
        if (!isset($context->controller)) {
            return;
        }
    }
}
