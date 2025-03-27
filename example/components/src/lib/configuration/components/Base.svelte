<script lang="ts">
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
  } from "$lib/components/ui/select";
  import { Button } from "$lib/components/ui/button";
  import { createForm } from "svelte-forms-lib";
  import { config } from "$lib/configuration/state/config.svelte";
  import { languages } from "$lib/configuration/utils/languages";
  import { currencies } from "$lib/configuration/utils/currencies";
  import { toast } from "svelte-sonner";

  const { form, handleChange, handleSubmit /* , errors */ } = createForm({
    initialValues: {
      ...config,
    },
    // validate: (values) => {
    //   let errs: Record<string, string> = {};
    //   if (values.metadata.name === "") {
    //     errs.metadata.name = "App name is required";
    //   }
    //   return errs;
    // },
    onSubmit: (values) => {
      toast.success("Base settings saved");
      config.metadata = values.metadata;
    },
  });

  const selectedLanguage = $derived(
    $form.metadata.lang
      ? languages.find((language) => language.value === $form.metadata.lang)
          ?.label
      : "Select a language",
  );

  const selectedCurrency = $derived(
    $form.metadata.currency
      ? currencies.find(
          (currency) => currency.value === $form.metadata.currency,
        )?.label
      : "Select a currency",
  );
</script>

<form onsubmit={handleSubmit} class="grid gap-4 w-1/2">
  <div class="grid gap-1">
    <Label for="metadata.name">App Name</Label>
    <Input
      type="text"
      placeholder=""
      class="w-full"
      id="metadata.name"
      name="metadata.name"
      onchange={handleChange}
      bind:value={$form.metadata.name}
    />
    <!-- {#if $errors.metadata.name}
      <p class="text-red-500 text-sm">{$errors.metadata.name}</p>
    {/if} -->
  </div>
  <div class="grid gap-1">
    <Label for="metadata.lang">Language</Label>
    <Select type="single" bind:value={$form.metadata.lang} name="metadata.lang">
      <SelectTrigger class="w-[180px]">{selectedLanguage}</SelectTrigger>
      <SelectContent>
        {#each languages as language}
          <SelectItem value={language.value}>{language.label}</SelectItem>
        {/each}
      </SelectContent>
    </Select>
  </div>
  <div class="grid gap-1">
    <Label for="metadata.currency">Currency</Label>
    <Select
      type="single"
      bind:value={$form.metadata.currency}
      name="metadata.currency"
    >
      <SelectTrigger class="w-[180px]">{selectedCurrency}</SelectTrigger>
      <SelectContent>
        {#each currencies as currency}
          <SelectItem value={currency.value}>{currency.label}</SelectItem>
        {/each}
      </SelectContent>
    </Select>
  </div>
  <Button type="submit">Save base settings</Button>
</form>
