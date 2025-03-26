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
  import Card from "$lib/components/Card.svelte";
  import ButtonWallet from "$lib/components/ButtonWallet.svelte";
  import ButtonShare from "$lib/components/ButtonShare.svelte";

  type Option = {
    title: string;
    description: string;
    action: string;
    image: Component;
    showWallet?: boolean;
  };

  const embedOptions: Option[] = [
    {
      title: "Share Button",
      description: "Add a share button in your page",
      action: "Open share modal",
      image: ButtonShare,
      showWallet: false,
    },
    {
      title: "Wallet Button",
      description: "Add a floating wallet button (bottom right)",
      action: "Open wallet modal",
      image: ButtonWallet,
      showWallet: true,
    },
  ];
</script>

<div class="header">
  <div class="embed-options-label">EMBED OPTIONS</div>
  <h2>Frak offers components to embed on your site</h2>
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
    color: #0066ff;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 1px;
    margin-bottom: 16px;
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
