<script lang="ts">
  import type { Language } from "@frak-labs/core-sdk";

  let { formData, lang = "en" }: { formData: any; lang: Language } = $props();

  const defaultValues = {
    en: {
      description: "Connect to your account with **{{ productName }}**",
      primaryAction: "Create my wallet",
    },
    fr: {
      description: "Connectez-vous à votre compte avec **{{ productName }}**",
      primaryAction: "Créer mon porte-monnaie",
    },
  };

  const description = $derived(
    formData.description || defaultValues[lang].description,
  );
  const primaryAction = $derived(
    formData.primaryAction || defaultValues[lang].primaryAction,
  );
</script>

<div class="share-modal">
  <p>{description}</p>
  <p class="button-container">
    <button type="button" class="button-primary">
      {primaryAction}
    </button>
  </p>
</div>

<style>
  .share-modal {
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(85px);
    padding: 25px 15px 15px 15px;
    border-radius: 16px;
    color: #fff;
  }

  .button-container {
    display: flex;
    justify-content: center;
    margin-top: 40px;
  }

  .button-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    max-width: 80%;
    border: 1px solid transparent;
    padding: 5px 10px;
    border-radius: 8px;
    cursor: pointer;
    line-height: 24px;
    text-align: center;
    background-color: #fff;
    color: #000;
  }
</style>
