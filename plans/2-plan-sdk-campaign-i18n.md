# Plan: SDK Campaign-Specific i18n (Component-Based)

This document outlines the implementation plan for introducing campaign-specific i18n into the Frak Wallet SDK. This approach is component-based and does not require any changes to the core SDK. The new logic will be contained within the `sdk/components` package.

## 1. No Core SDK Changes

This approach does not require any changes to the `@frak-labs/core-sdk`. We will leverage the existing `metadata.i18n` property in the `DisplayModalParamsType` and `DisplayEmbeddedWalletParamsType` types.

## 2. `sdk/components` Changes

The `sdk/components` package will be responsible for managing the i18n configurations and passing the correct one to the wallet.

### 2.1. Global `FrakSetup` Configuration

We will introduce a new, optional property to the global `window.FrakSetup` object called `campaignI18n`. This property will be an object where the keys are campaign IDs and the values are `I18nConfig` objects.

-   **File to modify**: `sdk/components/src/utils/initFrakSdk.ts` (or a similar file where `window.FrakSetup` is defined).
-   **Change**: Update the type definition for `window.FrakSetup` to include the `campaignI18n` property.

```typescript
declare global {
    interface Window {
        FrakSetup: {
            // ... existing properties
            campaignI18n?: {
                [campaignId: string]: I18nConfig;
            };
        };
    }
}
```

### 2.2. Component Logic

The components that can trigger an interaction will be updated to use the campaign-specific i18n configuration.

-   **Files to modify**: All components in `sdk/components/src/components` that can trigger an interaction (e.g., `ButtonShare`, `ButtonWallet`).
-   **Change**:
    1.  The components will be updated to accept a `campaignId` prop.
    2.  When a component is initialized, it will check if a `campaignId` is provided.
    3.  If a `campaignId` is provided, the component will look for a corresponding entry in the `window.FrakSetup.campaignI18n` object.
    4.  If a campaign-specific i18n configuration is found, it will be passed to the wallet using the `metadata.i18n` property of the `displayModal` or `displayEmbeddedWallet` methods.
    5.  If no `campaignId` is provided, or if no campaign-specific i18n configuration is found, the component will fall back to the default i18n configuration from `window.FrakSetup.config.customizations.i18n`.

## 3. Developer Experience

To make this feature easy to use for developers, we should:

-   **Update the documentation**: The documentation for the `sdk/components` package should be updated to explain how to use the new `campaignI18n` feature. We should provide clear examples of how to configure `window.FrakSetup` for different campaigns.
-   **Provide clear error messages**: If a `campaignId` is provided but no corresponding i18n configuration is found, we should log a warning to the console to help developers debug their implementation.

## Implementation Steps

1.  **`sdk/components`**:
    1.  Update the `window.FrakSetup` type definition to include the `campaignI18n` property.
    2.  Update the components to accept a `campaignId` prop.
    3.  Implement the logic to select the correct i18n configuration based on the `campaignId` and pass it to the wallet.
2.  **Documentation**:
    1.  Update the `sdk/components` documentation with examples of how to use the new feature.
