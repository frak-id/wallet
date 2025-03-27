<!--
@component

# BrowserWindow

Render a browser window with a control bar and a content area.

## Props

@prop children - The content to render inside the browser window.

## Usage:
  ```html
  <BrowserWindow>
    <div>Hello</div>
  </BrowserWindow>
  ```
-->

<script lang="ts">
  import type { Snippet } from "svelte";

  type BrowserWindowProps = {
    children?: Snippet;
  };

  let { children }: BrowserWindowProps = $props();
</script>

<div class="browser__window">
  <div class="browser__controls">
    <span class="browser__dot"></span>
    <span class="browser__dot"></span>
    <span class="browser__dot"></span>
  </div>
  <div class="browser__content">
    {@render children?.()}
  </div>
</div>

<style>
  .browser__window {
    width: 100%;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 20px;
    box-shadow: var(--card-shadow);
    transition:
      background-color 0.3s ease,
      color 0.3s ease;
  }

  .browser__controls {
    background-color: var(--bg-secondary);
    padding: 8px 12px;
    display: flex;
    gap: 6px;
    align-items: center;
    transition:
      background-color 0.3s ease,
      color 0.3s ease;
  }

  .browser__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--browser-dot-color);
    transition:
      background-color 0.3s ease,
      color 0.3s ease;
  }

  .browser__content {
    padding: 20px 0px;
    display: flex;
  }
</style>
