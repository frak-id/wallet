<script lang="ts">
  import Preview from "./Preview.svelte";
  import { Label } from "$lib/components/ui/label";
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import { Button } from "$lib/components/ui/button";
  import { createForm } from "svelte-forms-lib";
  import { config } from "$lib/configuration/state/config.svelte";
  import { toast } from "svelte-sonner";
  import type { Language } from "@frak-labs/core-sdk";
  import { getLanguageLabel } from "$lib/configuration/utils/languages";

  let { lang = "en" }: { lang?: Language } = $props();

  const { form, handleChange, handleSubmit } = createForm({
    initialValues: {
      ...config,
    },
    onSubmit: (values) => {
      if (values.customizations?.i18n && config.customizations) {
        config.customizations.i18n[lang] = values.customizations.i18n[lang];
      }
      toast.success(
        `Customization settings saved for ${getLanguageLabel(lang)}`,
      );
    },
  });
</script>

<div class="grid gap-10 grid-cols-2 w-full">
  <Preview form={$form} {lang} />

  <form onsubmit={handleSubmit} class="grid gap-4 w-full">
    <div class="grid gap-1">
      <Label for="description">Description</Label>
      <Textarea
        placeholder=""
        class="w-full"
        id="description"
        name="description"
        onchange={handleChange}
        bind:value={
          $form.customizations.i18n[lang]["sdk.modal.login.description"]
        }
      />
    </div>
    <div class="grid gap-1">
      <Label for="primaryAction">Primary action</Label>
      <Input
        type="text"
        placeholder=""
        class="w-full"
        id="primaryAction"
        name="primaryAction"
        onchange={handleChange}
        bind:value={
          $form.customizations.i18n[lang]["sdk.modal.login.primaryAction"]
        }
      />
    </div>
    <Button type="submit">Save {getLanguageLabel(lang)} settings</Button>
  </form>
</div>
