<script src="https://cdn.jsdelivr.net/npm/@frak-labs/components" defer="defer"></script>
<script type="text/javascript">
  let logoUrl = '{$logo_url}';
  const lang = '{$modal_lng}' === 'default' ? undefined : '{$modal_lng}';

  let i18n = {};
  try {
    i18n = JSON.parse('{$modal_i18n}'.replace(
    /&amp;|&lt;|&gt;|&#39;|&quot;/g,
    tag =>
      ({
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&#39;': "'",
        '&quot;': '"'
      }[tag] || tag)
  )) || {};
  } catch (error) {
    console.error('Error parsing i18n customizations:', error);
  }

  window.FrakSetup = {
    config: { walletUrl: 'https://wallet.frak.id', metadata: { name: '{$shop_name}', lang, logoUrl }, customizations: { i18n }, domain: window.location.host },
    modalConfig: { login: { allowSso: true, ssoMetadata: { logoUrl, homepageLink: window.location.host } } },
    modalShareConfig: { link: window.location.href },
    modalWalletConfig: { metadata: { position: '{$floating_button_position}' } },
  };

  // If we got an order data in the page, handle that 
  document.addEventListener('DOMContentLoaded', async () => {
    const frakOrderData = document.getElementById('frak-order-data');
    if (frakOrderData) {
      const interactionToken = await sessionStorage.getItem(
          "frak-wallet-interaction-token"
      );
      const customerId = frakOrderData.dataset.customerId;
      const orderId = frakOrderData.dataset.orderId;
      const token = frakOrderData.dataset.token;

      if (customerId && orderId && token && interactionToken) {
        fetch('https://backend.frak.id/wallet/interactions/listenForPurchase', {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'x-wallet-sdk-auth': interactionToken },
          body: JSON.stringify({ customerId,orderId,token }),
        });
      }
    }
  });
</script>
