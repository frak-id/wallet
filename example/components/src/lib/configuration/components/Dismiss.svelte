<script lang="ts">
  import { Input } from "$lib/components/ui/input";
  import { config } from "$lib/configuration/state/config.svelte";
  import { toast } from "svelte-sonner";
  import type { Language } from "@frak-labs/core-sdk";
  import { getLanguageLabel } from "$lib/configuration/utils/languages";
  import { defaults, superForm } from "sveltekit-superforms";
  import { typeboxClient, typebox } from "sveltekit-superforms/adapters";
  import { dismissFormSchema } from "$lib/configuration/schemas/customization";
  import {
    FormField,
    FormControl,
    FormLabel,
    FormDescription,
    FormFieldErrors,
    FormButton,
  } from "$lib/components/ui/form";
  import PreviewDismiss from "./PreviewDismiss.svelte";

  let { lang = "en" }: { lang?: Language } = $props();

  // Get the default data for the language
  const defaultDataLang = config.customizations.i18n[lang];

  const data = defaults(typebox(dismissFormSchema), {
    defaults: {
      primaryAction: defaultDataLang?.["sdk.modal.dismiss.primaryAction"] ?? "",
    },
  });

  const form = superForm(data, {
    id: `dismiss-form-${lang}`,
    dataType: "json",
    SPA: true,
    resetForm: false,
    clearOnSubmit: "errors-and-message",
    validators: typeboxClient(dismissFormSchema),
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
      langData["sdk.modal.dismiss.primaryAction"] =
        form.data?.primaryAction ?? "";

      // Show a success toast
      toast.success(
        `Customization settings saved for ${getLanguageLabel(lang)}`,
      );
    },
  });

  const { form: formData, enhance } = form;
</script>

<div class="grid gap-10 grid-cols-2 w-full">
  <PreviewDismiss formData={$formData} {lang} />

  <form use:enhance class="grid gap-4">
    <FormField {form} name="primaryAction" class="grid gap-1">
      <FormControl>
        {#snippet children({ props })}
          <FormLabel>Primary action</FormLabel>
          <Input {...props} bind:value={$formData.primaryAction} />
        {/snippet}
      </FormControl>
      <FormDescription>
        Primary action of the dismiss screen (<strong>optional</strong>).
      </FormDescription>
      <FormFieldErrors />
    </FormField>

    <FormButton>Submit</FormButton>
  </form>
</div>
