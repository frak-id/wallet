<script lang="ts">
  import { Input } from "$lib/components/ui/input";
  import { config } from "$lib/configuration/state/config.svelte";
  import { toast } from "svelte-sonner";
  import type { Language } from "@frak-labs/core-sdk";
  import { getLanguageLabel } from "$lib/configuration/utils/languages";
  import { defaults, superForm } from "sveltekit-superforms";
  import { typeboxClient, typebox } from "sveltekit-superforms/adapters";
  import { cssFormSchema } from "$lib/configuration/schemas/customization";
  import {
    FormField,
    FormControl,
    FormLabel,
    FormDescription,
    FormFieldErrors,
    FormButton,
  } from "$lib/components/ui/form";

  let { lang = "en" }: { lang?: Language } = $props();

  const data = defaults(typebox(cssFormSchema), {
    defaults: {
      css: config.customizations.css ?? "",
    },
  });

  const form = superForm(data, {
    id: `css-form`,
    dataType: "json",
    SPA: true,
    resetForm: false,
    clearOnSubmit: "errors-and-message",
    validators: typeboxClient(cssFormSchema),
    onUpdate({ form }) {
      // If the form is not valid, return
      if (!form.valid) return;

      // Update the css
      config.customizations.css = form.data?.css ?? "";

      // Show a success toast
      toast.success(`Customization CSS settings saved`);
    },
  });

  const { form: formData, enhance } = form;
</script>

<div class="grid gap-10 grid-cols-2 w-full">
  <form use:enhance class="grid gap-4">
    <FormField {form} name="css" class="grid gap-1">
      <FormControl>
        {#snippet children({ props })}
          <FormLabel>CSS</FormLabel>
          <Input {...props} bind:value={$formData.css} />
        {/snippet}
      </FormControl>
      <FormDescription>
        Custom CSS styles to apply to the modals and components (<strong
          >optional</strong
        >).
      </FormDescription>
      <FormFieldErrors />
    </FormField>

    <FormButton>Submit</FormButton>
  </form>
</div>
