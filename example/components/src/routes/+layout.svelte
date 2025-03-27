<script lang="ts">
  import "$lib/css/all.css";
  import Header from "$lib/components/Header.svelte";
</script>

<svelte:head>
  <script>
    window.FrakSetup = {
      config: {
        walletUrl: "https://wallet-dev.frak.id",
        metadata: {
          name: "Example components",
        },
      },
    };
  </script>
  <script
    type="text/javascript"
    src="https://cdn.jsdelivr.net/npm/@frak-labs/components"
    defer
  ></script>
</svelte:head>

<main class="main">
  <Header />

  <slot />

  <frak-button-wallet></frak-button-wallet>
</main>

<style>
  .main {
    padding: 10px;
  }
</style>
