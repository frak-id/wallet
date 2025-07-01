# Plan: Scoped Campaigns

This document outlines the implementation plan for introducing "scoped" campaigns into the Frak Wallet ecosystem.

## 1. Backend Changes

### 1.1. Campaign Model

The current campaign model is defined implicitly through the data read from the blockchain. We need to introduce a new field to differentiate between "fixed" and "scoped" campaigns.

-   **File to modify**: `services/backend/src/domain/business/repositories/CampaignRepository.ts` (or a similar file where the campaign data is handled).
-   **Change**: Add a `scope` field to the `Campaign` type, which can be either `"fixed"` or `"scoped"`.

```typescript
export type Campaign = {
    // ... existing fields
    scope: "fixed" | "scoped";
};
```

### 1.2. API Endpoints

We need to modify the API endpoints to handle the new `scope` field.

-   **Create Campaign**: The `POST /campaigns` endpoint should accept a `scope` field in the request body.
-   **Get Campaigns**: The `GET /campaigns` endpoint should be able to filter campaigns by scope.

### 1.3. On-Chain Interaction

The core change is to modify how the backend interacts with the smart contracts.

-   **File to modify**: `services/backend/src/domain/interactions/services/CampaignRewardsService.ts`
-   **Change**: When calculating rewards, the service should now differentiate between fixed and scoped campaigns.
    -   **Fixed campaigns**: These will be triggered automatically for every interaction, as before.
    -   **Scoped campaigns**: These will only be triggered if the `campaignId` is specified in the interaction.

## 2. Dashboard Changes

### 2.1. Create Campaign Form

The "Create Campaign" form in the dashboard needs to be updated to include the new "scoped" option.

-   **File to modify**: `apps/dashboard/src/module/embedded/component/CreateCampaign/index.tsx`
-   **Change**: Add a checkbox to the form that allows the user to mark the campaign as "scoped".
    -   When checked, the `scope` field of the campaign should be set to `"scoped"`.
    -   Add a tooltip or a small text explaining what a scoped campaign is.

### 2.2. Campaign List

The campaign list should visually distinguish between fixed and scoped campaigns.

-   **File to modify**: `apps/dashboard/src/module/campaigns/component/TableCampaigns/index.tsx`
-   **Change**: Add a column to the table that shows the scope of each campaign.

### 2.3. Sharing Link

The business owner should be able to generate a sharing link for a scoped campaign.

-   **File to modify**: A new component will be needed for this, likely in the `apps/dashboard/src/module/campaigns` directory.
-   **Change**:
    -   Create a new button or a menu option for each scoped campaign in the campaign list.
    -   When clicked, this should open a modal or a new page where the business owner can generate a sharing link.
    -   The sharing link should include the `campaignId` as a query parameter. To keep the URL short, we can use a 4-byte identifier for the campaign.

## 3. SDK Changes

### 3.1. Interaction Submission

The SDK needs to be updated to allow the `campaignId` to be specified when submitting an interaction.

-   **Files to modify**: All files in the `sdk` directory that are responsible for sending interactions to the backend.
-   **Change**: Add an optional `campaignId` parameter to all methods that submit interactions.

### 3.2. Sharing Link Handling

The SDK should be able to parse the `campaignId` from a sharing link and include it in the interaction.

-   **File to modify**: The part of the SDK that handles the initial setup and configuration.
-   **Change**: When the SDK is initialized, it should check the URL for a `campaignId` query parameter. If present, it should store it and use it for all subsequent interactions.

## 4. Internationalization (i18n)

The business owner should be able to customize the i18n for a specific campaign.

-   **This is a more complex feature that might require a separate implementation plan.**
-   A possible approach would be to allow the business owner to provide a JSON file with the translations for a specific campaign. This JSON file would then be loaded by the SDK when the `campaignId` is present in the URL.

## Implementation Steps

1.  **Backend**:
    1.  Add the `scope` field to the `Campaign` model.
    2.  Update the "Create Campaign" endpoint to accept the `scope` field.
    3.  Modify the `CampaignRewardsService` to handle scoped campaigns.
2.  **Dashboard**:
    1.  Add the "scoped" checkbox to the "Create Campaign" form.
    2.  Update the campaign list to show the campaign scope.
    3.  Implement the sharing link generation for scoped campaigns.
3.  **SDK**:
    1.  Add the `campaignId` parameter to the interaction submission methods.
    2.  Implement the logic to parse the `campaignId` from the URL.
4.  **i18n**:
    1.  Design and implement a solution for campaign-specific i18n.
