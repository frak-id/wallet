<!--
@component

# LearnMore

Render a learn more link.

## Usage:
  ```html
  <LearnMore />
```
-->

<script lang="ts">
  import { ArrowRight } from "@lucide/svelte";
  import { _ } from "svelte-i18n";
</script>

<div class="learn-more">
  <a
    href="https://docs.frak.id/components"
    target="_blank"
    rel="noreferrer"
    class="learn-more-link"
  >
    {$_("common.learnMore")}
    <ArrowRight size={16} />
  </a>
</div>

<style>
  .learn-more {
    text-align: center;
  }

  .learn-more-link {
    color: var(--accent-color);
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: color 0.3s ease;
  }
</style>
