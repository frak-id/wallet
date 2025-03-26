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
</script>

<div class="learn-more">
  <a
    href="https://docs.frak.id/components"
    target="_blank"
    rel="noreferrer"
    class="learn-more-link"
  >
    Learn more about Frak Components
    <ArrowRight size={16} />
  </a>
</div>

<style>
  .learn-more {
    text-align: center;
  }

  .learn-more-link {
    color: #0066ff;
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
</style>
