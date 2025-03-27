<script lang="ts">
  import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
  } from "$lib/components/ui/card";
  import { config } from "$lib/configuration/state/config.svelte";

  const removeLanguageIfAuto = () => {
    const { lang, ...rest } = config.metadata;
    return lang === "auto" ? rest : config.metadata;
  };

  const code = $derived.by(() => {
    return JSON.stringify(
      {
        ...config,
        metadata: removeLanguageIfAuto(),
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
