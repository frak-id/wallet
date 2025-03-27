<!--
@component

# Header

Render a header with a title.

## Usage:
  ```html
  <Header />
```
-->

<script lang="ts">
  import { _ } from "svelte-i18n";
  import ButtonTheme from "$lib/components/ButtonTheme.svelte";
</script>

<header>
  <h1>{$_("common.h1")}</h1>
  <ButtonTheme />
</header>

<style>
  header {
    padding-bottom: 4rem;
    text-align: center;
  }
</style>
