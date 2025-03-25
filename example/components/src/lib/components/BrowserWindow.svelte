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
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 20px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  }

  .browser__controls {
    background-color: #f5f5f5;
    padding: 8px 12px;
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .browser__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #ccc;
  }

  .browser__content {
    padding: 20px 0px;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 150px;
    background-color: #fff;
  }
</style>
