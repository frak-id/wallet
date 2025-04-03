<script lang="ts">
  import { toggleMode } from "mode-watcher";
  import Sun from "@lucide/svelte/icons/sun";
  import Moon from "@lucide/svelte/icons/moon";
</script>

<button class="theme-toggle" onclick={toggleMode} aria-label="Toggle theme">
  <Sun
    class="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
  />
  <Moon
    class="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
  />
  <span class="sr-only">Toggle theme</span>
</button>

<style>
  .theme-toggle {
    position: absolute;
    right: 10px;
    top: 10px;
    background: none;
    border: none;
    color: var(--accent-color);
    cursor: pointer;
    padding: 8px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.3s ease;
  }

  .theme-toggle:hover {
    background-color: var(--bg-secondary);
  }
</style>
