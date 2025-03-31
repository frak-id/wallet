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

<Card class="w-full">
  <CardHeader>
    <CardTitle>Get the code</CardTitle>
  </CardHeader>
  <CardContent>
    <pre>{code}</pre>
  </CardContent>
</Card>
