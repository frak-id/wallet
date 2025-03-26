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
  :global(body) {
    margin: 0;
    padding: 0;
    font-family:
      "Inter",
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      Oxygen,
      Ubuntu,
      Cantarell,
      "Open Sans",
      "Helvetica Neue",
      sans-serif;
    background-color: #ffffff;
    color: #333;
  }

  .main {
    padding: 10px;
  }
</style>
