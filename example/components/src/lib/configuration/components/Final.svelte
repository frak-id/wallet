<script lang="ts">
  import { Input } from "$lib/components/ui/input";
  import { config } from "$lib/configuration/state/config.svelte";
  import { toast } from "svelte-sonner";
  import type { Language } from "@frak-labs/core-sdk";
  import { getLanguageLabel } from "$lib/configuration/utils/languages";
  import { defaults, superForm } from "sveltekit-superforms";
  import { typeboxClient, typebox } from "sveltekit-superforms/adapters";
  import { finalFormSchema } from "$lib/configuration/schemas/customization";
  import {
    FormField,
    FormControl,
    FormLabel,
    FormDescription,
    FormFieldErrors,
    FormButton,
  } from "$lib/components/ui/form";
  import PreviewFinal from "./PreviewFinal.svelte";
  let { lang = "en" }: { lang?: Language } = $props();

  // Get the default data for the language
  const defaultDataLang = config.customizations.i18n[lang];

  const data = defaults(typebox(finalFormSchema), {
    defaults: {
      description: defaultDataLang?.["sdk.modal.final.description"] ?? "",
      dismissed: {
        description:
          defaultDataLang?.["sdk.modal.final.dismissed.description"] ?? "",
      },
    },
  });

  const form = superForm(data, {
    id: `final-form-${lang}`,
    dataType: "json",
    SPA: true,
    resetForm: false,
    clearOnSubmit: "errors-and-message",
    validators: typeboxClient(finalFormSchema),
    onUpdate({ form }) {
      // If the form is not valid, return
      if (!form.valid) return;

      // If the language data is not set, set it to an empty object
      if (!config.customizations.i18n[lang]) {
        config.customizations.i18n[lang] = {};
      }

      // Get the language data
      const langData = config.customizations.i18n[lang];

      // Update the language data
      langData["sdk.modal.final.description"] = form.data?.description ?? "";
      langData["sdk.modal.final.dismissed.description"] =
        form.data?.dismissed?.description ?? "";

      // Show a success toast
      toast.success(
        `Customization settings saved for ${getLanguageLabel(lang)}`,
      );
    },
  });

  const { form: formData, enhance } = form;
</script>

<div class="grid gap-10 grid-cols-2 w-full">
  <PreviewFinal formData={$formData} {lang} />

  <form use:enhance class="grid gap-4">
    <FormField {form} name="description" class="grid gap-1">
      <FormControl>
        {#snippet children({ props })}
          <FormLabel>Description</FormLabel>
          <Input {...props} bind:value={$formData.description} />
        {/snippet}
      </FormControl>
      <FormDescription>
        Description of the final screen (<strong>optional</strong>).
      </FormDescription>
      <FormFieldErrors />
    </FormField>

    <FormField {form} name="dismissed.description" class="grid gap-1">
      <FormControl>
        {#snippet children({ props })}
          <FormLabel>Dismissed description</FormLabel>
          <Input {...props} bind:value={$formData.dismissed.description} />
        {/snippet}
      </FormControl>
      <FormDescription>
        Description of the dismissed screen (<strong>optional</strong>).
      </FormDescription>
      <FormFieldErrors />
    </FormField>

    <FormButton>Submit</FormButton>
  </form>
</div>
