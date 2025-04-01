<script lang="ts">
  import type { Language } from "@frak-labs/core-sdk";

  let { formData, lang = "en" }: { formData: any; lang: Language } = $props();

  const defaultValues = {
    en: {
      description: "You've successfully completed all the steps.",
      dismissed: {
        description: "All good",
      },
    },
    fr: {
      description: "Vous avez effectué toutes les étapes avec succès.",
      dismissed: {
        description: "Tout est bon",
      },
    },
  };

  const description = $derived(
    formData.description || defaultValues[lang].description,
  );
  const dismissedDescription = $derived(
    formData.dismissed?.description ||
      defaultValues[lang].dismissed.description,
  );
</script>

<div>
  <div class="share-modal">
    <p class="description">{description}</p>
    <p class="button-container">
      <button type="button" class="button-primary">
        {dismissedDescription}
      </button>
    </p>
  </div>
</div>

<style>
  .share-modal {
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(85px);
    padding: 25px 15px;
    border-radius: 16px;
    color: #fff;
  }

  .description {
    margin-bottom: 25px;
  }

  .button-container {
    position: absolute;
    bottom: 15px;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    margin-top: 40px;
  }

  .button-primary {
    all: unset;
    cursor: pointer;
    text-decoration: underline;
    display: inline-flex;
    gap: 8px;
  }
</style>
