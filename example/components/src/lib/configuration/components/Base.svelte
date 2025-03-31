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

  const data = defaults(typebox(baseFormSchema), {
    defaults: {
      metadata: config.metadata,
    },
  });

  const form = superForm(data, {
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

<form use:enhance class="grid gap-4 w-1/2">
  <FormField {form} name="metadata.name" class="grid gap-1">
    <FormControl>
      {#snippet children({ props })}
        <FormLabel>App Name</FormLabel>
        <Input {...props} bind:value={$formData.metadata.name} />
      {/snippet}
    </FormControl>
    <FormDescription>This is your public display name.</FormDescription>
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
      This is the language of the app. It will be used to display the app in the
      correct language.<br />By default, the language will be the language of
      the browser.
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
      This is the currency of the app. It will be used to display the app in the
      correct currency. By default, the currency will be in Euro.
    </FormDescription>
  </FormField>
  <FormButton>Submit</FormButton>
</form>
