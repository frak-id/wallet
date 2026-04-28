{*
 * Resource hints warm the TLS handshake to `cdn.jsdelivr.net` before the
 * SDK `<script>` tag is parsed — dns-prefetch resolves DNS early, preconnect
 * opens the TCP/TLS session in parallel with HTML parsing. Mirrors the
 * WordPress plugin's `Frak_Frontend::add_resource_hints()` filter and saves a
 * full RTT on the SDK's first-paint on cold connections.
 *}
<link rel="dns-prefetch" href="https://cdn.jsdelivr.net">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<script src="https://cdn.jsdelivr.net/npm/@frak-labs/components" defer="defer"></script>
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
