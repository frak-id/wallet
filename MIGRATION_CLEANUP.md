# Business App — Backend API Migration Cleanup

Tracking file for migrating `apps/business/` from blockchain indexer + MongoDB + on-chain reads to the single backend API.

## Already Migrated ✅

- `getProducts.ts` → `authenticatedBackendApi.merchant.my.get()`
- `getCampaigns.ts` → `authenticatedBackendApi.merchant({id}).campaigns.get()`
- `useGetProductAdministrators.ts` → `authenticatedBackendApi.merchant({id}).admins.get()`
- `useAddProductMember.ts` → `authenticatedBackendApi.merchant({id}).admins.post()`
- `useRemoveProductMember.ts` → `authenticatedBackendApi.merchant({id}).admins({wallet}).delete()`
- `useHasRoleOnMerchant` → `authenticatedBackendApi.merchant({id}).get()` (role check)
- `ButtonAddTeam` → simplified (no permission checkboxes, merchantId: string)
- `TableTeam/Modal.tsx` → simplified (DeleteTeamMemberModal only, no UpdateRoleTeamMemberModal)
- `TableTeam/index.tsx` → removed UpdateRoleTeamMemberModal, fixed prop types
- `roles.ts` → deprecated stub

---

## 1. Dead Code — Safe to Delete

Files/exports with zero production imports remaining.

| File | What | Why Dead |
|------|------|----------|
| `src/module/product/utils/permissions.ts` | `permissionLabels`, `permissionLabelsArray` | Only imported by its own test file. Granular on-chain roles no longer exist. |
| `src/module/product/utils/permissions.test.ts` | Tests for above | Dead along with the module |
| `src/context/product/action/roles.ts` | Deprecated stub (5 lines) | Already gutted in Phase 1, can fully delete |

---

## 2. useHasRoleOnProduct.ts — Remove Legacy Properties

**File:** `src/module/common/hook/useHasRoleOnProduct.ts`

The hook has legacy role properties that map to the old on-chain bitmask system. With the backend, there are only `owner` / `admin` / `none` roles.

**Properties to remove from `defaultAccess` and `demoAccess`:**
- `isInteractionManager` — legacy on-chain role
- `isCampaignManager` — legacy on-chain role

**Keep:**
- `role` (`"owner" | "admin" | "none"`)
- `isOwner`
- `isAdmin`
- `hasAccess`
- `isAdministrator` (= isOwner || isAdmin, still used by TableTeam + CreateCampaign)

**Consumers still using legacy fields (must update first):**
- `src/module/embedded/component/CreateCampaign/index.tsx` — uses `isCampaignManager` (line ~83)
- `src/context/campaigns/action/getDetails.ts` — uses `isCampaignManager`, `isInteractionManager` (lines ~82, ~137)

**Test file:** `src/module/common/hook/useHasRoleOnProduct.test.ts` — update assertions to remove legacy fields, remove deprecated `useHasRoleOnProduct` stub tests (lines 213–236)

---

## 3. Indexer API — Files Still Using `indexerApi`

**Client:** `src/context/api/indexerApi.ts`

| File | What It Fetches | Backend Endpoint Needed |
|------|----------------|------------------------|
| `src/context/campaigns/action/getCampaignsStats.ts` | Campaign stats via indexer GET | Missing — need `GET /merchant/{id}/campaigns/stats` |
| `src/context/members/action/getProductMembers.ts` | Members/referrals via indexer GET | Missing — need members endpoint |
| `src/module/product/hook/useGetProductFunding.ts` | Bank data via indexer GET + multicall | Partially available — `GET /merchant/{id}/bank` exists |

**Test files to update:**
- `useGetProductFunding.test.ts` — mocks indexerApi
- `useGetProductAdministrators.test.ts` — mocks indexerApi

---

## 4. MongoDB / CampaignRepository — Files Still Using Direct Mongo

**Client:** `src/context/common/mongoDb.ts`
**Repository:** `src/context/campaigns/repository/CampaignRepository.ts`
**DTO:** `src/context/campaigns/dto/CampaignDocument.ts`

| File | Operation | Backend Replacement |
|------|-----------|-------------------|
| `src/context/campaigns/action/getCampaignsStats.ts` | Aggregation pipeline for stats | `GET /merchant/{id}/campaigns/stats` (missing) |
| `src/context/campaigns/action/createCampaign.ts` | Insert draft campaign doc | `POST /merchant/{id}/campaigns` |
| `src/context/campaigns/action/getDetails.ts` | Find campaign by ID | `GET /merchant/{id}/campaigns/{campaignId}` |
| `src/context/campaigns/action/deleteCampaign.ts` | Delete campaign + detach on-chain | `DELETE /merchant/{id}/campaigns/{campaignId}` |

**Components consuming CampaignDocument type:**
- `CampaignTerritory.tsx`
- `CampaignStatus.tsx`
- `campaigns/queries/queryOptions.ts`

---

## 5. Direct Blockchain Reads — `readContract` / `multicall`

These files call viem directly for on-chain data.

| File | What It Reads | Backend Replacement |
|------|--------------|-------------------|
| `action/getBankInfo.ts` | Bank token balance, distribution status | `GET /merchant/{id}/bank` |
| `action/getDetails.ts` | Campaign config, role checks on-chain | `GET /merchant/{id}/campaigns/{id}` |
| `action/getAttachedCampaigns.ts` | Interaction contract attached campaigns | Remove (no interaction contracts) |
| `hook/useGetBankInfo.ts` | Bank balance via readContract | `GET /merchant/{id}/bank` |
| `hook/useEditCampaign.ts` | Campaign config readContract | Backend manages config |
| `hook/useOracleSetupData.ts` | Role checks via readContract (PARTIAL MIGRATION) | Fully use backend |
| `hook/useProductInteractionContract.ts` | Interaction contract address | Remove (no interaction contracts) |
| `hook/useGetProductFunding.ts` | Bank balances via multicall | `GET /merchant/{id}/bank` |
| `hook/useSetupInteractionContract.ts` | Deploy + configure interaction contract | Remove (no interaction contracts) |
| `component/Funding/index.tsx` | Token allowance readContract | `GET /merchant/{id}/bank` |
| `component/InteractionSettings.tsx` | Interaction contract config | Remove (no interaction contracts) |
| `component/CampaignBank.tsx` | Bank balance multicall | `GET /merchant/{id}/bank` |
| `queries/queryOptions.ts` | Product metadata readContract | Backend serves metadata |

---

## 6. On-Chain Transaction Sending — `useSendTransactionAction`

Hooks that send blockchain transactions (will need backend endpoints or keep as-is if still on-chain).

| File | Transaction | Decision Needed |
|------|------------|----------------|
| `hook/useEditCampaign.ts` | Update campaign on-chain | → Backend `PUT /merchant/{id}/campaigns/{id}` |
| `hook/useDeleteCampaign.ts` | Detach + delete campaign | → Backend `DELETE /merchant/{id}/campaigns/{id}` |
| `hook/useUpdateCampaignRunningStatus.ts` | Pause/resume campaign | → Backend `POST .../pause` / `POST .../resume` |
| `hook/useEditProduct.ts` | Update product metadata on-chain | Keep on-chain? Or backend manages? |
| `hook/useSetBankDistributionStatus.ts` | Toggle bank distribution | → Backend `POST /merchant/{id}/bank/...` (missing) |
| `hook/useSetupInteractionContract.ts` | Deploy interaction contract | Remove (no interaction contracts) |
| `hook/useAddProductBank.ts` | Deploy bank contract | → Backend `POST /merchant/{id}/bank/deploy` |
| `component/Funding/index.tsx` | Token approve + deposit | Keep on-chain (user wallet tx) |
| `component/PurchaseTracker.tsx` | Grant/revoke oracle roles | → Backend manages roles |
| `component/InteractionSettings.tsx` | Grant/revoke roles, set facets | Remove (no interaction contracts) |
| `Creation/ValidationCampaign/index.tsx` | Create campaign on-chain | → Backend `POST .../publish` |

---

## 7. Old Campaign State Model

The old model uses `state.address` (on-chain address) and `state.interactionLink`. The new model uses `status` (`draft/published/paused/archived`).

| File | Usage |
|------|-------|
| `action/getCampaignsStats.ts` | Filters by `state.address` |
| `action/deleteCampaign.ts` | Checks `state.address` for on-chain detach |
| `action/mock.ts` | Mock data includes `state.address` |
| `repository/CampaignRepository.ts` | Queries `state.address` |
| `component/CampaignEdit/index.tsx` | Reads `state.address` |
| `component/CampaignStateTag.tsx` | Reads `state.interactionLink` |
| `component/TableCampaigns/index.tsx` | Reads `state.address` |
| `component/CampaignStatus.tsx` | Reads `state.address` |
| `types/Campaign.ts` | Defines `interactionLink` property (line 109) |

---

## 8. productTypes — On-Chain Bitmask

`productTypes` is an on-chain bitmask concept. If backend now manages product types, this can be removed.

| File | Usage |
|------|-------|
| `types/Product.ts` | Defines `productTypes` field |
| `utils/productTypes.ts` | Encode/decode utility functions |
| `utils/productTypes.test.ts` | Tests |
| `hook/useEditProduct.ts` | Uses `encodeProductTypesMask` |
| `component/MintProduct/ProductInformationPanel.tsx` | Form field for types |
| `component/Mint/index.tsx` | Reads from search params |
| `component/Creation/MetricsCampaign/FormTriggersCac.tsx` | Campaign trigger compatibility |
| `component/Creation/NewCampaign/FormGoals.tsx` | Campaign goal validation |
| `utils/goalCompatibility.ts` | Checks productTypes compatibility |
| `queries/queryOptions.ts` | Mock data includes productTypes |

---

## 9. Interaction Contract Concept — Fully Remove

Interaction contracts no longer exist in the new architecture.

| File | What to Do |
|------|-----------|
| `hook/useSetupInteractionContract.ts` | Delete entirely |
| `hook/useProductInteractionContract.ts` | Delete entirely |
| `hook/useProductInteractionContract.test.ts` | Delete entirely |
| `component/ProductDetails/InteractionSettings.tsx` | Delete entirely |
| `action/getAttachedCampaigns.ts` | Delete entirely |
| `hook/useEditProduct.ts` | Remove interaction contract dependency |
| `hook/useEditProduct.test.ts` | Update mocks |

---

## 10. viemClient / Blockchain Provider

22 files import `viemClient` for direct blockchain access. As backend endpoints replace these reads, remove the imports. The client itself (`src/context/blockchain/provider.ts` or similar) can be deleted once no files import it.

---

## Backend Endpoints — Still Missing

Endpoints needed but not yet available on backend:

| Endpoint | Purpose | Blocked Files |
|----------|---------|--------------|
| `GET /merchant/{id}/campaigns/stats` | Campaign stats aggregation | `getCampaignsStats.ts` |
| `GET /merchant/{id}/members` | Members/referral counts | `getProductMembers.ts` |
| `POST /merchant/{id}/bank/distribution` | Toggle bank distribution | `useSetBankDistributionStatus.ts` |
| `PATCH /merchant/{id}` | Update merchant metadata | `useEditProduct.ts` |
| `GET /merchant/{id}/bank/funding` | Bank balance + token info | `useGetProductFunding.ts`, `Funding/index.tsx` |
