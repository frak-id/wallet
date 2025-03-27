<script lang="ts">
  import { onMount } from "svelte";

  /**
   * Theme state
   */
  let isDarkTheme = false;

  /**
   * Check for user's preferred color scheme on mount
   */
  onMount(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      isDarkTheme = savedTheme === "dark";
      setTheme();
    }
  });

  /**
   * Toggle the theme
   */
  function toggleTheme() {
    isDarkTheme = !isDarkTheme;
    localStorage.setItem("theme", isDarkTheme ? "dark" : "light");
    setTheme();
  }

  /**
   * Set the theme on the html element
   */
  function setTheme() {
    const html = document.querySelector("html");
    if (html) {
      html.classList.remove(isDarkTheme ? "light-theme" : "dark-theme");
      html.classList.add(isDarkTheme ? "dark-theme" : "light-theme");
    }
  }
</script>

<button class="theme-toggle" onclick={toggleTheme} aria-label="Toggle theme">
  {#if isDarkTheme}
    <!-- Sun icon for light mode -->
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="12" r="5"></circle>
      <line x1="12" y1="1" x2="12" y2="3"></line>
      <line x1="12" y1="21" x2="12" y2="23"></line>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
      <line x1="1" y1="12" x2="3" y2="12"></line>
      <line x1="21" y1="12" x2="23" y2="12"></line>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    </svg>
  {:else}
    <!-- Moon icon for dark mode -->
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
    </svg>
  {/if}
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
