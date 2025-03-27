<script lang="ts">
  import { step } from "$lib/configuration/state/step.svelte";
</script>

<nav>
  <ul>
    <li>
      <button onclick={() => (step.value = 1)}>1. Base settings</button>
    </li>
    <li>
      <button onclick={() => (step.value = 2)}>2. Customization</button>
    </li>
    <li>
      <button onclick={() => (step.value = 3)}>3. Code</button>
    </li>
  </ul>
</nav>

<style>
  ul {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin: 2rem 0;
  }
</style>
