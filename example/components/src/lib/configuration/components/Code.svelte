<script lang="ts">
  import { Card, CardContent } from "$lib/components/ui/card";
  import { getCode } from "$lib/configuration/utils/saveInLocalstorage.svelte";
</script>

<div class="container">
  <Card class="w-full">
    <CardContent>
      <pre>window.FrakSetup = {getCode()}</pre>
    </CardContent>
  </Card>
</div>

<style>
  .container {
    margin: 0 auto;
    width: auto;
  }
</style>
