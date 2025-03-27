<!--
@component

# ListComponents

Render a list of components.

## Usage:
  ```html
  <ListComponents />
```
-->

<script lang="ts">
  import type { Component } from "svelte";
  import Card from "$lib/landing/components/Card.svelte";
  import ButtonWallet from "$lib/landing/components/ButtonWallet.svelte";
  import ButtonShare from "$lib/landing/components/ButtonShare.svelte";
  import { _ } from "svelte-i18n";

  type Option = {
    title: string;
    description: string;
    action: string;
    image: Component;
    showWallet?: boolean;
  };

  const embedOptions: Option[] = [
    {
      title: $_("components.shareButton.title"),
      description: $_("components.shareButton.description"),
      action: $_("components.shareButton.action"),
      image: ButtonShare,
      showWallet: false,
    },
    {
      title: $_("components.walletButton.title"),
      description: $_("components.walletButton.description"),
      action: $_("components.walletButton.action"),
      image: ButtonWallet,
      showWallet: true,
    },
  ];
</script>

<div class="header">
  <div class="embed-options-label">{$_("common.embedOptions")}</div>
  <h2>{$_("common.h2")}</h2>
</div>

<div class="list-components">
  {#each embedOptions as option}
    <Card {...option} />
  {/each}
</div>

<style>
  .header {
    text-align: center;
    margin-bottom: 60px;
  }

  .embed-options-label {
    color: var(--accent-color);
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 1px;
    margin-bottom: 16px;
    transition:
      color 0.3s ease,
      transform 0.3s ease;
  }

  .list-components {
    display: flex;
    justify-content: center;
    gap: 40px;
    width: 100%;
    flex-wrap: wrap;
    margin-bottom: 60px;
  }

  @media (max-width: 768px) {
    .list-components {
      flex-direction: column;
      align-items: center;
    }
  }
</style>
