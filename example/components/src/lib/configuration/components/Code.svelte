<script lang="ts">
  import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
  } from "$lib/components/ui/card";
  import { config } from "$lib/configuration/state/config.svelte";
  import { cleanObjects } from "$lib/configuration/utils/cleanObjects";

  function removeLanguageIfAuto(metadata: typeof config.metadata) {
    const { lang, ...rest } = metadata;
    return lang === "auto" ? rest : metadata;
  }

  function removeCurrencyIfEur(metadata: typeof config.metadata) {
    const { currency, ...rest } = metadata;
    return currency === "eur" ? rest : metadata;
  }

  function removeDefaultValues(metadata: typeof config.metadata) {
    return removeLanguageIfAuto(removeCurrencyIfEur(metadata));
  }

  const code = $derived.by(() => {
    return JSON.stringify(
      {
        ...config,
        metadata: cleanObjects(removeDefaultValues(config.metadata)),
        customizations: cleanObjects(config.customizations),
      },
      null,
      2,
    );
  });
</script>

<div class="container">
  <Card class="w-full">
    <CardContent>
      <pre>window.FrakSetup = {code}</pre>
    </CardContent>
  </Card>
</div>

<style>
  .container {
    margin: 0 auto;
    width: auto;
  }
</style>
