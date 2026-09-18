import type { FrakEnvironment } from "@frak-labs/core-sdk";

/**
 * Generates a copy-paste-ready snippet for merchants on non-OS-2.0 themes.
 * Mirrors listener.liquid but without any {{ shop.metafields ... }} reads.
 *
 * `waitForBackendConfig` is deliberately omitted so it defaults to `true`,
 * meaning name / logo / css / i18n / placements all come from the Frak
 * dashboard (business.frak.id) rather than Shopify metafields.
 */
/**
 * JSON-encode a value for safe embedding inside an inline <script>: escapes
 * quotes (so it can't break the string literal) AND `<` (so a value can never
 * terminate the <script> element early, e.g. a stray `</script>`).
 */
function js(value: unknown): string {
    return JSON.stringify(value).replace(/</g, "\\u003c");
}

const JSDELIVR_ORIGIN = "https://cdn.jsdelivr.net";

/**
 * The pointer's own fetch is no-cors, so its preconnect must not carry
 * `crossorigin`; the shim's `import()` is CORS-mode, so jsDelivr's must.
 */
function preconnectLinks(pointerOrigin: string): string {
    return `<link rel="dns-prefetch" href="${pointerOrigin}">
<link rel="preconnect" href="${pointerOrigin}">
<link rel="dns-prefetch" href="${JSDELIVR_ORIGIN}">
<link rel="preconnect" href="${JSDELIVR_ORIGIN}" crossorigin>`;
}

/**
 * The pointer file is a single `import()` statement, so a failed load ran
 * nothing — the jsDelivr shim can replace it without double-evaluating.
 * The dev pointer tracks the beta channel, so its fallback must too.
 */
function onErrorFallback(componentsUrl: string): string {
    const tag = componentsUrl.includes("sdk-dev.frak.id") ? "beta" : "latest";
    return `var s=document.createElement('script');s.src='${JSDELIVR_ORIGIN}/npm/@frak-labs/components@${tag}/cdn/components.js';s.defer=true;document.head.appendChild(s)`;
}

export function buildFrakSnippet({
    merchantId,
    env,
    componentsUrl,
}: {
    merchantId: string;
    env: FrakEnvironment;
    componentsUrl: string;
}): string {
    return `<!-- Frak SDK -->
${preconnectLinks(new URL(componentsUrl).origin)}
<script src="${componentsUrl}" defer="defer" onerror="${onErrorFallback(componentsUrl)}"></script>
<script type="text/javascript">
  window.FrakSetup = {
    config: {
      env: ${js(env)},
      metadata: {
        // Merchant ID from Frak dashboard (avoids domain-based lookup)
        merchantId: ${js(merchantId)},
      },
      domain: window.location.host,
      // waitForBackendConfig defaults to true: name, logo, css, i18n and
      // placements are fetched from the Frak dashboard automatically.
    },
  };

  // Store merchantId in sessionStorage for the checkout pixel fallback.
  try {
    sessionStorage.setItem('frak-merchant-id', ${js(merchantId)});
  } catch (e) {}

  // Sync frak-client-id to Shopify cart attributes for server-side purchase
  // tracking. Cart attributes flow through to the order webhook as
  // note_attributes, enabling ad-blocker-resistant identity linking.
  function syncFrakCartAttributes() {
    try {
      const clientId = window.FrakSetup?.core?.getClientId?.()
        ?? localStorage.getItem('frak-client-id');
      if (!clientId) return;
      fetch(window.Shopify.routes.root + 'cart/update.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attributes: { '_frak-client-id': clientId } })
      }).catch(function() {});
    } catch (e) {}
  }
  syncFrakCartAttributes();
  window.addEventListener('frak:client', syncFrakCartAttributes, { once: true });
</script>`;
}
