<script lang="ts">
  import Login from "./Login.svelte";
  import Activation from "./Activation.svelte";
  import Dismiss from "./Dismiss.svelte";
  import Css from "./Css.svelte";
  import Final from "./Final.svelte";
</script>

<div class="container">
  <h2>Customization of CSS</h2>
  <Css />

  <h2>Customization of login screen</h2>

  <h3>English</h3>
  <Login lang="en" />

  <h3>French</h3>
  <Login lang="fr" />
</div>

<div class="container">
  <h2>Customization of activation screen</h2>

  <h3>English</h3>
  <Activation lang="en" />

  <h3>French</h3>
  <Activation lang="fr" />
</div>

<div class="container">
  <h2>Customization of dismiss screen</h2>

  <h3>English</h3>
  <Dismiss lang="en" />

  <h3>French</h3>
  <Dismiss lang="fr" />
</div>

<div class="container">
  <h2>Customization of final screen</h2>

  <h3>English</h3>
  <Final lang="en" />

  <h3>French</h3>
  <Final lang="fr" />
</div>

<style>
  .container {
    margin: 0 auto;
    max-width: 900px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    border-top: 1px solid #e0e0e0;
    padding-top: 40px;
  }
</style>
