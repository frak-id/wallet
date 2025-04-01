<script lang="ts">
  import type { Language } from "@frak-labs/core-sdk";

  let { formData, lang = "en" }: { formData: any; lang: Language } = $props();

  const defaultValues = {
    en: {
      primaryAction: "Continue browsing",
    },
    fr: {
      primaryAction: "Je continue ma navigation",
    },
  };

  const primaryAction = $derived(
    formData.primaryAction || defaultValues[lang].primaryAction,
  );
</script>

<div>
  <div class="share-modal">
    <p class="button-container">
      <button type="button" class="button-primary">
        {primaryAction}
      </button>
    </p>
  </div>
</div>

<style>
  .share-modal {
    position: relative;
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(85px);
    padding: 25px 15px;
    border-radius: 16px;
    color: #fff;
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
