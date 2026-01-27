## 🔍 Business App Migration Audit — Full Report

### Architecture Overview

The business app currently has **3 data sources** that need consolidation into **1** (backend):

| Current Source | What It Serves | Status |
|---|---|---|
| **Indexer API** (`INDEXER_URL`) | Products, campaigns list, members, stats, admins, funding | ❌ Must migrate to backend |
| **MongoDB** (direct `MONGODB_BUSINESS_URI`) | Campaign drafts, metadata, creation flow | ❌ Must migrate to backend |
| **Blockchain** (viem `readContract`/`multicall`) | Campaign state, bank info, role checks, contract deploys | ❌ Must migrate to backend |
| **Backend API** (`BACKEND_URL`) | Auth, merchant CRUD, webhooks, rates, notifications, funding | ✅ Already migrated |

---

### 1. INDEXER CALLS TO MIGRATE → Backend Already Has Replacements

| Frontend (current) | Indexer Endpoint | Backend Replacement | Gap? |
|---|---|---|---|
| `getMyProducts()` | `GET admin/{wallet}/products` | `GET /merchant/my` | ⚠️ **Partial** — backend returns merchants, not "products". Need to align concept (product → merchant) |
| `getRolesOnProduct()` | `GET admin/{wallet}/products` | `GET /merchant/{id}` returns `role` | ⚠️ **Partial** — role is per-merchant, old code checks per-product bitmask roles |
| `getMyCampaigns()` | `GET admin/{wallet}/campaigns` | `GET /merchant/{id}/campaigns` | ✅ **Ready** — backend has full CRUD |
| `getMyCampaignsStats()` | `GET admin/{wallet}/campaignsStats` | ❌ **Missing** — no stats endpoint on backend |
| `getProductMembers()` | `POST members/{wallet}` | ❌ **Missing** — no members/referrals endpoint on backend |
| `getProductsMembersCount()` | `POST members/{wallet}` (noData) | ❌ **Missing** — same |
| `useGetProductFunding()` | `GET products/{productId}/banks` | `GET /merchant/{id}/bank` | ⚠️ **Partial** — backend has bank status but not funding balances/history |
| `useGetProductAdministrators()` | `GET products/{productId}/administrators` | `GET /merchant/{id}/admins` | ✅ **Ready** — backend has full admin CRUD |

### 2. DIRECT BLOCKCHAIN CALLS TO MIGRATE

#### Read operations (should become backend endpoints or be removed):

| Hook/File | Blockchain Call | Purpose | Backend Ready? |
|---|---|---|---|
| `getDetails.ts` | `multicall` (isActive, canEdit, isRunning, getMetadata) | Campaign on-chain state | ❌ **Missing** — backend campaigns have `status` field but no on-chain sync |
| `getCampaigns.ts` | `multicall` (isActive, canEdit, isRunning) | Campaign list state | ❌ Same — backend `status` should replace this |
| `getAttachedCampaigns.ts` | `readContract` (getInteractionContract, getCampaigns) | Attached campaigns | ❌ **Missing** — concept doesn't exist in new backend |
| `getBankInfo.ts` | `readContract` (getConfig, decimals) | Bank token info | ⚠️ **Partial** — backend has `bankAddress` but not token details |
| `useGetBankInfo.ts` | `readContract` (getConfig, decimals) | Same, hook version | ⚠️ Same |
| `useProductInteractionContract.ts` | `readContract` (getInteractionContract) | Interaction contract addr | ❌ **Missing** — concept may not exist in new system |
| `useOracleSetupData.ts` | `readContract` (hasAllRolesOrOwner) | Oracle permission check | ❌ **Missing** — backend should handle this |
| `useProductMetadata.ts` / `queryOptions.ts` | `readContract` (getMetadata) | Product name/types | ✅ Backend merchants have `name` + `domain` |
| `InteractionSettings.tsx` | `readContract` (hasAllRolesOrOwner) | Validator role check | ❌ **Missing** |
| `Funding/index.tsx` | `readContract` (isDistributing) | Distribution status | ❌ **Missing** |

#### Write operations (transactions via `useSendTransactionAction`):

| Hook/Component | Tx Purpose | Backend Ready? |
|---|---|---|
| `useEditCampaign.ts` | Update campaign caps on-chain | ⚠️ Backend has `PUT /campaigns/{id}` but it's off-chain only |
| `useUpdateCampaignRunningStatus.ts` | Pause/resume campaign on-chain | ✅ Backend has `POST /campaigns/{id}/pause` & `/resume` |
| `useDeleteCampaign.ts` | Detach + delete campaign on-chain | ✅ Backend has `DELETE /campaigns/{id}` |
| `useAddProductBank.ts` | Deploy bank contract | ✅ Backend has `POST /merchant/{id}/bank/deploy` |
| `useSetBankDistributionStatus.ts` | Toggle bank distribution | ❌ **Missing** |
| `useAddProductMember.ts` | Grant roles on-chain | ✅ Backend has `POST /merchant/{id}/admins` |
| `useRemoveProductMember.ts` | Revoke roles on-chain | ✅ Backend has `DELETE /merchant/{id}/admins/{wallet}` |
| `useEditProduct.ts` | Update product metadata on-chain | ❌ **Missing** — `PATCH /merchant` TODO in code |
| `useSetupInteractionContract.ts` | Deploy interaction contract | ❌ **Missing** — concept may not exist in new system |
| `ValidationCampaign/index.tsx` | Deploy campaign on-chain | ⚠️ Backend has `POST /campaigns` but no on-chain deploy |
| `CreateCampaign/index.tsx` (embedded) | Same | ⚠️ Same |
| `Funding/index.tsx` | Fund bank / withdraw | ❌ **Missing** |
| `InteractionSettings.tsx` | Setup oracle, validator | ❌ **Missing** |
| `PurchaseTracker.tsx` | Setup purchase tracker | ❌ **Missing** |

### 3. MONGODB DIRECT ACCESS TO REMOVE

The business app connects **directly** to MongoDB (`MONGODB_BUSINESS_URI`), bypassing the backend:

| File | MongoDB Operation | Should Become |
|---|---|---|
| `CampaignRepository.ts` | Full CRUD on `campaigns` collection | Backend `POST/PUT/DELETE /campaigns` — ✅ already exists |
| `createCampaign.ts` | `upsertDraft()`, `updateState()` | Backend `POST /campaigns` + `POST /campaigns/{id}/publish` |
| `deleteCampaign.ts` | `repository.delete()` | Backend `DELETE /campaigns/{id}` |
| `getDetails.ts` | `repository.getOneById()` | Backend `GET /campaigns/{id}` |
| `getCampaigns.ts` | `repository.findByAddressesOrCreator()` | Backend `GET /merchant/{id}/campaigns` |
| `getCampaignsStats.ts` | Reads campaign names from MongoDB | Backend campaigns already include names |

### 4. CONCEPTS THAT NO LONGER EXIST IN NEW SYSTEM

| Old Concept | Where Used | New Equivalent |
|---|---|---|
| `productId` (Hex) | Everywhere in campaigns, members, products | `merchantId` (string UUID) — migration in progress |
| `productTypes` (bitmask) | Types, product actions | May not exist — merchants are simpler |
| Interaction contract | Setup status, campaign attachment | Likely gone — backend handles interactions directly |
| On-chain campaign deployment | ValidationCampaign, createOnChain | Backend `POST /campaigns` + `/publish` |
| On-chain role bitmasks | `useHasRoleOnProduct`, admins | Backend `role: "owner" | "admin" | "none"` |
| Campaign bank authorization | deleteCampaign TODO | Backend handles internally |
| `CampaignState.address` | Campaign details | Likely gone — campaigns are DB records now |

### 5. MISSING BACKEND ENDPOINTS (Need to be built)

| Priority | Endpoint Needed | Purpose | Currently Served By |
|---|---|---|---|
| 🔴 HIGH | `GET /merchant/{id}/campaigns/stats` | Campaign performance metrics (CTR, interactions, rewards) | Indexer `admin/{wallet}/campaignsStats` |
| 🔴 HIGH | `GET /merchant/{id}/members` | Paginated referral members with filtering | Indexer `POST members/{wallet}` |
| 🔴 HIGH | `GET /merchant/{id}/members/count` | Member count for dashboard | Indexer (same endpoint) |
| 🟡 MED | `PATCH /merchant/{id}` | Update merchant name/config | TODO in code, currently no-op |
| 🟡 MED | `GET/POST /merchant/{id}/bank/fund` | Fund/withdraw bank | Direct on-chain tx |
| 🟡 MED | `GET /merchant/{id}/bank/balance` | Bank balance + token details | On-chain `readContract` + indexer |
| 🟡 MED | `POST /merchant/{id}/bank/distribution` | Toggle distribution status | Direct on-chain tx |
| 🟢 LOW | Ownership transfer UI support | Already backend-ready | Backend has `transfer/` routes, **no frontend UI yet** |

### 6. FILES/MODULES TO REMOVE AFTER MIGRATION

| What | Files | Why |
|---|---|---|
| Indexer API client | `context/api/indexerApi.ts` + test | No more indexer calls |
| MongoDB connection | `context/common/mongoDb.ts` | Backend owns the DB |
| Campaign repository | `context/campaigns/repository/CampaignRepository.ts` | Backend CRUD replaces it |
| Campaign MongoDB DTO | `context/campaigns/dto/CampaignDocument.ts` | Backend types replace it |
| Blockchain provider | `context/blockchain/provider.ts` + test | No more direct chain calls |
| `createOnChain.ts` | Full campaign on-chain deployment logic | Backend handles deployment |
| `getAttachedCampaigns.ts` | On-chain attached campaign queries | Concept removed |
| All `encodeFunctionData` usage | ~12 hooks building raw txs | Backend handles transactions |
| `useWaitForTxAndInvalidateQueries.ts` | Tx receipt waiting utility | No more client txs |
| All `useSendTransactionAction` usage | ~22 files sending txs | Backend handles writes |
| `mongodb` dependency | package.json | No longer needed |

### 7. SUMMARY MIGRATION SCORECARD

| Area | Current State | Migration % |
|---|---|---|
| **Auth** | Backend ✅ | 100% |
| **Merchant CRUD** | Backend ✅ (missing PATCH) | 90% |
| **Merchant Admins** | Backend ✅ (not consumed by frontend yet) | 50% — frontend still uses indexer |
| **Campaigns CRUD** | Backend ✅ (not consumed by frontend yet) | 30% — frontend still uses MongoDB + indexer + blockchain |
| **Campaign Stats** | No backend endpoint | 0% |
| **Members/Referrals** | No backend endpoint | 0% |
| **Bank/Funding** | Backend partial (deploy/sync only) | 20% |
| **Webhooks** | Backend ✅ | 100% |
| **Notifications** | Backend ✅ | 100% |
| **Token Rates** | Backend ✅ | 100% |

**Overall migration: ~40%** — The backend has a solid foundation with campaigns, admins, bank, and transfer routes already built. The frontend just hasn't been rewired to use them yet. The two big gaps are **campaign stats** and **members/referrals** endpoints.

---

