{*
    Resource hints + inline FrakSetup config block. The SDK <script> itself is
    registered via `hookActionFrontControllerSetMedia` so PrestaShop's native
    asset manager handles the actual <script> tag (defer attribute, body-bottom
    position, CCC-aware deduplication).

    Mirrors the WordPress sibling's `wp_resource_hints` + `wp_add_inline_script`
    split: hints go in <head> for the browser to act on while parsing
    continues; the inline config goes in <head> too so `window.FrakSetup` is
    populated *before* the deferred SDK script executes.
*}
<link rel="dns-prefetch" href="https://cdn.jsdelivr.net">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<script type="text/javascript">
  // SDK config is intentionally minimal. Only `metadata.{name,logoUrl}` is
  // injected here; everything else (i18n, language, modal config, walletUrl,
  // domain) is resolved by the SDK against the Frak business dashboard once
  // the merchant is registered. Mirrors the WordPress plugin's
  // `Frak_Frontend::generate_config_script()`.
  window.FrakSetup = Object.assign(window.FrakSetup || {}, {
    config: {
      metadata: {
        name: '{$shop_name|escape:'javascript':'UTF-8'}',
        logoUrl: '{$logo_url|escape:'javascript':'UTF-8'}'
      }
    }
  });
</script>
