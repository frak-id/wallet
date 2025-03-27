<!--
@component

# Card

Render a card with a title, description, and action button.

## Props

@prop title - The title of the card.
@prop description - The description of the card.
@prop action - The action of the card.
@prop image - The component to render in the card.

## Usage:
  ```html
  <Card title="Title" description="Description" action="Action" image={Image} />
```
-->

<script lang="ts">
  import type { Component } from "svelte";
  import BrowserWindow from "$lib/landing/components/BrowserWindow.svelte";

  /**
   * @description Card props
   * @param {string} title - The title of the card
   * @param {string} description - The description of the card
   * @param {string} action - The action of the card
   * @param {Component} image - The component to render in the card
   */
  type CardProps = {
    title: string;
    description: string;
    action: string;
    image: Component;
    showWallet?: boolean;
  };

  let { title, description, action, image, showWallet }: CardProps = $props();

  // Image is a component, so we need to derive it
  let Image = $derived(image);
</script>

<div class="card">
  <BrowserWindow>
    <Image />
  </BrowserWindow>
  <h3>{title}</h3>
  <p>{description}</p>

  <frak-button-share
    text={action}
    classname="card__button"
    {...showWallet && { "show-wallet": true }}
  ></frak-button-share>
</div>

<style>
  .card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    max-width: 300px;
  }

  h3 {
    color: var(--text-primary);
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 8px 0;
    transition: color 0.3s ease;
  }

  p {
    color: var(--text-secondary);
    font-size: 14px;
    line-height: 1.5;
    margin: 0 0 20px 0;
    transition: color 0.3s ease;
  }

  :global(.card__button) {
    background-color: var(--bg-primary);
    color: var(--accent-color);
    border: 1px solid var(--accent-color);
    border-radius: 4px;
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition:
      background-color 0.3s ease,
      color 0.3s ease;

    &:hover {
      background-color: var(--bg-secondary);
    }
  }
</style>
