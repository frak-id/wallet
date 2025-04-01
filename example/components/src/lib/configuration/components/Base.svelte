<script lang="ts">
  import {
    FormField,
    FormControl,
    FormLabel,
    FormDescription,
    FormFieldErrors,
    FormButton,
  } from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import { baseFormSchema } from "$lib/configuration/schemas/base";
  import { defaults, superForm } from "sveltekit-superforms";
  import { typeboxClient, typebox } from "sveltekit-superforms/adapters";
  import { languages } from "$lib/configuration/utils/languages";
  import { currencies } from "$lib/configuration/utils/currencies";
  import {
    Select,
    SelectTrigger,
    SelectContent,
    SelectItem,
  } from "$lib/components/ui/select";
  import { toast } from "svelte-sonner";
  import { config } from "$lib/configuration/state/config.svelte";
  import { saveInLocalstorage } from "$lib/configuration/utils/saveInLocalstorage.svelte";

  const data = defaults(typebox(baseFormSchema), {
    defaults: {
      metadata: config.metadata,
    },
  });

  const form = superForm(data, {
    id: `base-form`,
    dataType: "json",
    SPA: true,
    resetForm: false,
    validators: typeboxClient(baseFormSchema),
    onUpdate({ form }) {
      // If the form is not valid, return
      if (!form.valid) return;

      // Update the configuration
      config.metadata = form.data.metadata;

      // Show a success toast
      toast.success("Base settings saved");

      // Finalize save in localstorage
      saveInLocalstorage();
    },
  });

  const { form: formData, enhance } = form;

  const selectedLanguage = $derived(
    $formData.metadata.lang
      ? languages.find((language) => language.value === $formData.metadata.lang)
          ?.label
      : "Select a language",
  );

  const selectedCurrency = $derived(
    $formData.metadata.currency
      ? currencies.find(
          (currency) => currency.value === $formData.metadata.currency,
        )?.label
      : "Select a currency",
  );
</script>

<div class="container">
  <form use:enhance class="grid gap-4">
    <FormField {form} name="metadata.name" class="grid gap-1">
      <FormControl>
        {#snippet children({ props })}
          <FormLabel>App Name</FormLabel>
          <Input {...props} bind:value={$formData.metadata.name} />
        {/snippet}
      </FormControl>
      <FormDescription
        >App Name is <strong>required</strong> and will be used as the title of the
        app.
      </FormDescription>
      <FormFieldErrors />
    </FormField>

    <FormField {form} name="metadata.lang" class="grid gap-1">
      <FormControl>
        <FormLabel>Language</FormLabel>
        <Select
          type="single"
          bind:value={$formData.metadata.lang}
          name="metadata.lang"
        >
          <SelectTrigger class="w-[180px]">{selectedLanguage}</SelectTrigger>
          <SelectContent>
            {#each languages as language}
              <SelectItem value={language.value}>{language.label}</SelectItem>
            {/each}
          </SelectContent>
        </Select>
      </FormControl>
      <FormDescription>
        Language of the app (<strong>optional</strong>).<br /> It will be used
        to display the app in the correct language.<br />By default, the
        language will be the language of the browser.
      </FormDescription>
    </FormField>

    <FormField {form} name="metadata.currency" class="grid gap-1">
      <FormControl>
        <FormLabel>Currency</FormLabel>
        <Select
          type="single"
          bind:value={$formData.metadata.currency}
          name="metadata.currency"
        >
          <SelectTrigger class="w-[180px]">{selectedCurrency}</SelectTrigger>
          <SelectContent>
            {#each currencies as currency}
              <SelectItem value={currency.value}>{currency.label}</SelectItem>
            {/each}
          </SelectContent>
        </Select>
      </FormControl>
      <FormDescription>
        Currency of the app (<strong>optional</strong>).<br />
        It will be used to display the app in the correct currency. By default, the
        currency will be in Euro.
      </FormDescription>
    </FormField>

    <FormField {form} name="metadata.logoUrl" class="grid gap-1">
      <FormControl>
        <FormLabel>Logo URL</FormLabel>
        <Input bind:value={$formData.metadata.logoUrl} />
      </FormControl>
      <FormDescription>
        URL of your logo (<strong>optional</strong>).<br />
        It will be used on modal and sso popup.
      </FormDescription>
      <FormFieldErrors />
    </FormField>

    <FormField {form} name="metadata.homepageLink" class="grid gap-1">
      <FormControl>
        <FormLabel>Homepage Link</FormLabel>
        <Input bind:value={$formData.metadata.homepageLink} />
      </FormControl>
      <FormDescription>
        URL of your homepage website (<strong>optional</strong>).<br />
        It will be used as a link on logo.
      </FormDescription>
      <FormFieldErrors />
    </FormField>
    <FormButton>Submit</FormButton>
  </form>
</div>

<style>
  .container {
    max-width: 500px;
    margin: 0 auto;
  }
</style>
