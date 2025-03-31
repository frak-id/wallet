<script lang="ts">
  import Navigation from "$lib/configuration/components/Navigation.svelte";
  import Base from "$lib/configuration/components/Base.svelte";
  import Customization from "$lib/configuration/components/Customization.svelte";
  import Code from "$lib/configuration/components/Code.svelte";
  import { step } from "$lib/configuration/state/step.svelte";
  import Header from "$lib/configuration/components/Header.svelte";
</script>

<div>
  <Header />
  <Navigation />

  <div class="grid gap-10">
    {#if step.value === 1}
      <Base />
    {:else if step.value === 2}
      <Customization />
    {:else if step.value === 3}
      <Code />
    {/if}
  </div>
</div>
