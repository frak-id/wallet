<script lang="ts">
  import "../app.css";
  import "$lib/css/all.css";
  import { Toaster } from "$lib/components/ui/sonner";
</script>

<svelte:head>
  <script>
    const config = localStorage.getItem("frak-wallet-sdk-config");

    if (config) {
      window.FrakSetup = {
        config: {
          walletUrl: "https://wallet-dev.frak.id",
          ...JSON.parse(config),
        },
      };
    } else {
      window.FrakSetup = {
        config: {
          walletUrl: "https://wallet-dev.frak.id",
          metadata: {
            name: "Example components",
          },
        },
      };
    }
  </script>
  <script
    type="text/javascript"
    src="https://cdn.jsdelivr.net/npm/@frak-labs/components"
    defer
  ></script>
</svelte:head>

<main class="main">
  <slot />

  <frak-button-wallet></frak-button-wallet>
  <Toaster />
</main>

<style>
  .main {
    padding: 10px;
  }
</style>
