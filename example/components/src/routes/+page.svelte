<script lang="ts">
  import LearnMore from "$lib/components/LearnMore.svelte";
  import ListComponents from "$lib/components/ListComponents.svelte";
</script>

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
