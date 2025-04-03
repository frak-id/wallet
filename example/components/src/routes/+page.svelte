<script lang="ts">
  import LearnMore from "$lib/landing/components/LearnMore.svelte";
  import ListComponents from "$lib/landing/components/ListComponents.svelte";
  import Header from "$lib/landing/components/Header.svelte";
</script>

<Header />

<div class="content">
  <ListComponents />
  <LearnMore />
</div>

<style>
  .content {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 20px;
  }
</style>
