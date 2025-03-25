<script lang="ts">
  import "$lib/css/all.css";
  import Header from "$lib/components/Header.svelte";
</script>

<main class="main">
  <Header />

  <slot />
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
</style>
