<script lang="ts">
  import { Input } from "$lib/components/ui/input";
  import Preview from "$lib/configuration/components/customization/Preview.svelte";
  import { config } from "$lib/configuration/state/config.svelte";
  import { toast } from "svelte-sonner";
  import type { Language } from "@frak-labs/core-sdk";
  import { getLanguageLabel } from "$lib/configuration/utils/languages";
  import { defaults, superForm } from "sveltekit-superforms";
  import { typeboxClient, typebox } from "sveltekit-superforms/adapters";
  import { loginFormSchema } from "$lib/configuration/schemas/customization";
  import {
    FormField,
    FormControl,
    FormLabel,
    FormDescription,
    FormFieldErrors,
    FormButton,
  } from "$lib/components/ui/form";
  import { saveInLocalstorage } from "$lib/configuration/utils/saveInLocalstorage.svelte";

  let { lang = "en" }: { lang?: Language } = $props();

  // Get the default data for the language
  const defaultDataLang = config.customizations.i18n[lang];

  const data = defaults(typebox(loginFormSchema), {
    defaults: {
      description: defaultDataLang?.["sdk.modal.login.description"] ?? "",
      primaryAction: defaultDataLang?.["sdk.modal.login.primaryAction"] ?? "",
      success: defaultDataLang?.["sdk.modal.login.successAction"] ?? "",
    },
  });

  const form = superForm(data, {
    id: `login-form-${lang}`,
    dataType: "json",
    SPA: true,
    resetForm: false,
    clearOnSubmit: "errors-and-message",
    validators: typeboxClient(loginFormSchema),
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
      langData["sdk.modal.login.description"] = form.data?.description ?? "";
      langData["sdk.modal.login.primaryAction"] =
        form.data?.primaryAction ?? "";

      // Show a success toast
      toast.success(
        `Customization settings saved for ${getLanguageLabel(lang)}`,
      );

      // Finalize save in localstorage
      saveInLocalstorage();
    },
  });

  const { form: formData, enhance } = form;
</script>

<div class="grid gap-10 grid-cols-2 w-full p-1">
  <Preview formData={$formData} {lang} />

  <form use:enhance class="grid gap-4">
    <FormField {form} name="description" class="grid gap-1">
      <FormControl>
        {#snippet children({ props })}
          <FormLabel>Description</FormLabel>
          <Input {...props} bind:value={$formData.description} />
        {/snippet}
      </FormControl>
      <FormDescription>
        Description of the login screen (<strong>optional</strong>).
      </FormDescription>
      <FormFieldErrors />
    </FormField>

    <FormField {form} name="primaryAction" class="grid gap-1">
      <FormControl>
        {#snippet children({ props })}
          <FormLabel>Primary action</FormLabel>
          <Input {...props} bind:value={$formData.primaryAction} />
        {/snippet}
      </FormControl>
      <FormDescription>
        Primary action of the login screen (<strong>optional</strong>).
      </FormDescription>
      <FormFieldErrors />
    </FormField>

    <FormField {form} name="success" class="grid gap-1">
      <FormControl>
        {#snippet children({ props })}
          <FormLabel>Success message</FormLabel>
          <Input {...props} bind:value={$formData.success} />
        {/snippet}
      </FormControl>
      <FormDescription>
        Success message of the login screen (<strong>optional</strong>).
      </FormDescription>
      <FormFieldErrors />
    </FormField>

    <FormButton>Submit</FormButton>
  </form>
</div>
