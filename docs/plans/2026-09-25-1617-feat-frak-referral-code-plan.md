---
title: Frak Referral Code (welcome bonus) - Plan
type: feat
date: 2026-09-25
topic: frak-referral-code
execution: code
---

# Frak Referral Code (welcome bonus) - Plan

## Goal Capsule

- **Objective:** a user onboarded in person by Frak marketing enters a Frak-owned referral code at install, and on their first Frak-credited purchase at *each* merchant receives the referrer reward on top of their own referee reward.
- **Means:** reuse the existing cross-merchant referral-code system. Frak becomes the user's cross-merchant referrer through a code of a new `kind='frak'`. One policy step in `BatchRewardOrchestrator` redirects Frak's referrer share to the user (first time per merchant) or drops it (every other time).
- **Untouched:** campaign rule engine and calculator, settlement / on-chain, campaign bank, billing, SDKs (web + native), listener, Shopify, plugins.
- **Stop conditions:** stop and ask before changing `RuleEngineService` / `RewardCalculator`, before widening `RecipientTypeSchema` itself (campaign configs reuse it: KTD6), before giving the Frak identity a wallet, before making a Frak code redeemable outside onboarding, or before writing a Drizzle migration (the db team writes those, see `services/backend/AGENTS.md`).
- **Open blockers:** none. See Open Questions for tunables.

---

## Product Contract

### Summary

Frak marketing hands out codes (`FRAKPA`, `FRAKLY`, …) or a QR code pointing to `wallet.frak.id/install?ref=CODE`. A new user enters (or gets pre-filled) the code during onboarding. From then on Frak is their referrer of last resort at every merchant. Frak does not keep the referrer reward. The first purchase credited to Frak at a given merchant pays the user both sides (referee + referrer). Later purchases at that merchant pay the normal referee reward only. The same `/install?ref=` link works for influencer (user-owned) codes.

### Key Decisions (settled with product, 2026-09-25)

- D1. **Bonus is per merchant.** A user buying at N merchants (with Frak as referrer at each) gets N bonuses, one per merchant.
- D2. **"First" means first purchase Frak is credited for at that merchant**, not the user's first purchase ever at that merchant.
- D3. **After the first time, Frak's referrer share is dropped**: not paid, not saved, budget released back to the campaign. Frak never receives rewards and has no wallet.
- D4. **Frak codes are redeemable only during onboarding.** Attempting one from settings returns the regular "code not found / invalid" error, without revealing it is a Frak code.
- D5. **iOS pre-fill is copy/paste.** No deferred-deep-link or fingerprint matching.
- D6. **The merchant is not asked to opt in.** Their cost is exactly a normal referral: the referrer share they already budgeted.

### Requirements

**Code and redemption**

- R1. Frak can hold any number of simultaneously active codes (one per event, city, staff member). User codes keep the "one active code per owner" rule.
- R2. A Frak code is redeemed through the same onboarding step and endpoint as a user code.
- R3. A Frak code is accepted only when the request comes from the onboarding step *and* the account is still in its onboarding window (KTD3). Otherwise it fails with `NOT_FOUND`.
- R4. Removing or replacing a Frak referrer in settings stays possible. Afterwards the Frak code cannot be re-redeemed, because the window has passed.

**Reward**

- R5. On a `purchase` interaction at merchant M, when Frak is the user's *direct* referrer at M (no merchant-scoped referrer shadowing it) and the user has no live bonus at M, every referrer reward computed for Frak on that interaction is paid to the user instead, tagged as a welcome bonus.
- R6. Every other reward computed for the Frak identity is dropped: later purchases at M, non-purchase triggers, and Frak appearing deeper in someone else's referral chain.
- R7. A refunded or expired bonus does not count as claimed. The next Frak-credited purchase at M qualifies again.
- R8. Merchant caps (`maxRewardsPerUser`, `merchantMaxRewardsPerUser`) behave exactly as today. The bonus is booked as the referrer share, so it never consumes the referee cap.

**Wallet display**

- R9. The home screen shows a dismissible "welcome bonus" slide while the user is Frak-referred.
- R10. Explorer cards and merchant detail show the first-purchase bonus on merchants where it is still available: no live bonus there, and no merchant-scoped referrer shadowing Frak.
- R11. In history, a bonus reward renders with its own label and icon, and its detail sheet explains where it comes from. The row shows the user's own purchase (it already does: `recipientType !== 'referrer'` takes the own-purchase path in `RewardHistoryService.extractPurchaseInfo`).
- R12. When a Frak code is applied in onboarding, the success toast uses dedicated "exclusive cashback unlocked" copy.

**Install link / QR**

- R13. `wallet.frak.id/install?ref=CODE` works for any code kind and leads the user to the app with the code pre-filled where the platform allows it.
- R14. App already installed (universal link / app link): logged out goes to register with the code pre-filled. Logged in goes to the settings redeem page pre-filled, where a Frak code fails per R3.
- R15. Android not installed: the Play Store referrer carries the code and onboarding pre-fills it.
- R16. iOS not installed: the install page shows the code with a copy action, and the onboarding step offers a paste action.

**Reporting**

- R17. Bonus recipients are never counted or listed as ambassadors in merchant stats. Bonus amounts still count in campaign `spend` and in the referee-side amount (`refereeAmount`), since the money went to the referee. Converted-referee / ambassador-sales counts measure ambassador-driven conversions and therefore exclude bonus rows.

### Key Flows

- F1. **In-person onboarding (Android).** Staff shows QR → `/install?ref=FRAKPA` → Play Store (referrer `referralCode=FRAKPA`) → install → register → referral step pre-filled → confirm → "exclusive cashback" toast → home shows bonus slide.
- F2. **In-person onboarding (iOS).** Same QR → install page, the code is copied when the store button is tapped → App Store → register → referral step → paste → confirm.
- F3. **App already installed.** QR → OS opens the app → `deepLink.ts` `install` resolver → `/register?ref=FRAKPA` (logged out).
- F4. **First purchase at Brand A.** Purchase webhook → interaction → batch: Frak resolved as referrer → rules give referee 5 € + referrer 5 € (for Frak) → policy redirects the 5 € to the user → two rows for the user: `recipientType='referee'` (normal) + `recipientType='welcome_bonus'`.
- F5. **Second purchase at Brand A** (uncapped campaign). Referee 5 € to the user, referrer 5 € for Frak → dropped, budget restored.
- F6. **First purchase at Brand B.** Same as F4. Bonus again.
- F7. **Settings attempt.** Existing user types `FRAKPA` in Profile → Referral → Redeem → "code not found".

### Acceptance Examples

- AE1. **R5, D1.** A Frak-referred user with no bonus buys at A then at B. Both purchases produce a referee row and a bonus row.
- AE2. **R6.** Same user, second purchase at A, uncapped campaign. Only the referee row is created, and the campaign budget ends where it would without a referrer reward.
- AE3. **R6.** User X (Frak-referred) referred user Y by link, and the campaign has a chained referrer reward, depth 3. Y buys: X gets their chain share, Frak's share is dropped, no row has the Frak identity.
- AE4. **R7.** First purchase at A is refunded (bonus cancelled). The next purchase at A produces a bonus.
- AE5. **R5.** The user clicked a friend's share link for A (merchant-scoped referrer). A purchase at A pays the friend, and no bonus is created. The explorer does not show the bonus on A.
- AE6. **R8.** Campaign `maxRewardsPerUser=1`. The second purchase at A produces nothing, as today.
- AE7. **R3, D4.** Account created 3 days ago, or with any purchase, or redeeming from settings: a Frak code returns 404 `NOT_FOUND`. A user code still works from settings.
- AE8. **R3.** Two campaigns at A match the first purchase and both define a referrer reward. Both referrer shares are redirected to the user (one interaction, both tagged).
- AE9. **R17.** After AE1, merchant A's campaign stats do not list the user as an ambassador. `spend` and `refereeAmount` include the bonus amount; `ambassadorAmount` does not.

### Scope Boundaries

- No admin UI for Frak codes. Issuance is a backend script (U2).
- No change to the rule engine, campaign schema, business campaign editor, or on-chain contracts.
- No merchant-facing opt-out or distinct reporting line for bonuses (can come later from `recipientType='welcome_bonus'`).
- No per-code redemption cap, expiry, or kill switch. A leaked code produces purchases at merchants, which is the outcome we want; revisit when there is a user base (Q2).
- No iOS deferred deep linking.
- Not porting anything to `plugins/magento`, SDKs, or Shopify.

---

## Planning Contract

### Key Technical Decisions

- **KTD1. `referral_codes.kind` (`'user'` default | `'frak'`).** The partial unique index `referral_codes_owner_active_idx` becomes `… WHERE revoked_at IS NULL AND kind = 'user'`, so Frak can hold many active codes (R1). The `code` uniqueness index is unchanged. User-facing issue/suggest/replace endpoints always write `kind='user'`. `findActiveByOwner` must filter `kind='user'`. *Why not a separate table:* redemption, status, and `referral_links.sourceData.codeId` already point at `referral_codes`, so one column keeps every read path intact.
- **KTD2. One well-known Frak identity group id.** `FRAK_REFERRAL_IDENTITY_GROUP_ID` is a fixed UUID constant, identical on every stage, in `services/backend/src/domain/referral-code/constants.ts`. The issuance script upserts a matching `identity_groups` row so joins never dangle. The group never gets a wallet or identity nodes. "Frak-referred" is then just `referrerIdentityGroupId === FRAK_ID` on the active cross-merchant `referral_links` row: `referral_links` schema is unchanged and `source='code'` / `sourceData.codeId` keep working.
- **KTD3. Onboarding gate = client intent + server eligibility.** `POST /code/redeem` gains an optional body field `context: "onboarding"`. Only the onboarding `ReferralCodeStep` sends it. For `kind='frak'` codes the orchestrator requires all of:
  1. `context === "onboarding"`
  2. identity group `createdAt` within `FRAK_CODE_ONBOARDING_WINDOW` (default 24 h)
  3. no `purchase` interaction for the group

  Any failure throws `HttpError.notFound("NOT_FOUND", …)`, which the wallet already maps to `wallet.referral.redeem.errorNotFound`. The client flag makes the settings path fail deterministically. The server checks make the flag worthless to someone scripting the API. Because the user sees a generic error, the orchestrator logs a structured line (`code`, `identityGroupId`, which check failed) and bumps `businessMetrics.frakCodeRejected(reason)`, so support and marketing can see event-day rejections. The window is measured on `identity_groups.createdAt`, which is the wallet's own group in practice because the wallet-bearing group always anchors a merge (`IdentityWeightService.checkWalletPriority`).
- **KTD4. Policy lives in orchestration, as a pure function.** `services/backend/src/orchestration/reward/frakReferralPolicy.ts` exports `applyFrakReferralPolicy({ rewards, frakIdentityGroupId, userIdentityGroupId, trigger, directReferrerIsFrak, bonusAlreadyClaimed })` → `PolicyReward[]` (`CalculatedReward & { recipient: AssetLogRecipientType }`, KTD6).

  `BatchRewardOrchestrator.processSingleInteraction` calls it between `evaluateRules` / the defer check and `buildAssetLogParams`. It only pays out when all of these hold:
  - the reward's recipient is Frak and it is a referrer reward
  - `chainDepth ∈ {undefined, 1}`
  - trigger is `purchase`
  - `directReferrerIsFrak`
  - `!bonusAlreadyClaimed`

  Then it re-targets the recipient to the user with `recipient: "welcome_bonus"`, merging several qualifying rewards of one interaction into one (KTD7). Any other reward whose recipient is Frak is removed. Rewards for other recipients pass through unchanged.

  The rule engine stays Frak-agnostic, which respects the cross-domain rule (campaign domain must not know attribution / referral-code semantics). `ReferralLinkRepository.findChain` is LRU-cached for 10 min while `findReferrerForReferee` is not, so right after a merchant-scoped link is created the chain can still name Frak at depth 1 while `directReferrerIsFrak` is false: the policy drops it, which is the safe direction.
- **KTD5. Budget release is free.** `consumedByCampaign` is computed from the *pre-policy* `evaluationResult.rewards`, and `restoreUnpersistedBudget` restores `consumed − inserted` per campaign. So dropped Frak shares are released by the existing code path. Do not recompute `consumedByCampaign` after the policy; this is a one-line comment at the call site (a trap, not history: it passes `lint:comments`). When the policy merges several Frak shares into one row under one `campaignRuleId`, the other campaigns' shares are restored by the same arithmetic, and the merged row over-books the first campaign by the same amount: accept, or keep one row per campaign and make the unique index `(identity_group_id, merchant_id, campaign_rule_id)`. Decide in U4; the per-campaign variant is simpler and still closes the cross-replica race per campaign.
- **KTD6. Third asset-log recipient type: `recipientType='welcome_bonus'`.** `asset_logs.recipient_type` is plain `text` with no CHECK, so this is a type-level change only: a new `AssetLogRecipientTypeSchema = t.Union([RecipientTypeSchema, t.Literal("welcome_bonus")])` used by `asset_logs`, `CreateAssetLogParams` and `RewardHistoryItemSchema.role`. `RecipientTypeSchema` itself stays `referrer | referee` because campaign reward configs (`domain/campaign/schemas` L114/125/144) reuse it, and a campaign must not be able to target `welcome_bonus`. The policy sets `recipient: "welcome_bonus"` on the redirected reward; `buildAssetLogParams` already forwards `reward.recipient`.

  What this buys for free (every site keys on the literal `'referrer'` / `'referee'`): referee caps (`countAsRefereeWhere`) untouched; history own-purchase path and `buildReferrerPurchaseIdMap` need no change; all five ambassador count/list sites in the stats orchestrators exclude the row by construction (R17); the wallet gets `role: 'welcome_bonus'` in history with no mapping code. `referralLinkId` stays set to the Frak `referral_links` row for traceability.
- **KTD7. "Already claimed" check, enforced by the database.** `AssetLogRepository.hasLiveFrakBonus(identityGroupId, merchantId)`: exists a row with `recipientType='welcome_bonus'` and status in (`pending`, `processing`, `settled`, `bank_depleted`), the same live-status set the caps use. The check runs once per interaction *before* the policy, so all Frak referrer shares of one purchase (several campaigns, AE8) are redirected together.

  The read is not enough on its own: `findUnprocessedForRewards` has no `SKIP LOCKED`, the reward cron runs on up to two replicas (`infra/gcp/backend.ts` HPA `max: 2`), and `processSingleInteraction` already handles "another worker beat us". Two runs can each hold one of a user's two purchases at M and both read `false`. So the index in U1 is a **partial UNIQUE index** on `(identity_group_id, merchant_id) WHERE recipient_type = 'welcome_bonus' AND status IN (live set)`: the loser's insert fails, the tx rolls back, the interaction stays unprocessed, and the retry sees the claim and drops. AE8 is unaffected because all of one purchase's Frak shares are one row: the policy merges them (sum of amounts, first campaign's `campaignRuleId`) before insert. Note this also means a Frak bonus counts once per merchant against no campaign-level cap, which is the intent.
- **KTD8. `directReferrerIsFrak`** comes from `InteractionContextBuilder.build`. It already resolves the direct referrer (merchant scope shadows cross-merchant), so the orchestrator compares `context.attribution.referrerIdentityGroupId` with the constant. No extra query.
- **KTD9. Status endpoint carries what the wallet needs in one call.** `/user/wallet/referral/status` adds:
  - `crossMerchantReferrer.isFrak: boolean`
  - `frakReferral: { claimedMerchantIds: string[] } | null`

  `claimed` = merchants with a live bonus (KTD7 set), one indexed query, only run when `isFrak`. Explorer cards derive eligibility as `!claimed`. The merchant detail page additionally hides the bonus row when `merchantReferrer` is set, using the existing `useReferralStatus(merchantId)` call: no `shadowedMerchantIds` field. A card may therefore show the badge on a merchant where a friend's link shadows Frak (AE5); the detail page is correct, and the badge is a hint, not a promise.
- **KTD10. Explorer boost is a display-only overlay, not a summed amount.** The reward pieces can be fixed, percentage or tiered, so they can't be summed reliably. Cards show a "first-purchase bonus" badge. The detail `CampaignInfoCard` shows an extra row with the referrer estimate (existing `EstimatedReward` formatting) plus an explanation. The explorer API and the SDK `MerchantReward` type are untouched: `referrer` / `referee` estimates are already on each card's rewards.
- **KTD11. `/install?ref=` is the single QR contract.** Extend `parseInstallSearch` rather than add a page: it already owns store links, app-link handoff, Play referrer and the light bundle. `ref` is validated client-side against the code alphabet/length (`[A-Z0-9]{6}`, uppercase) and dropped when invalid. An optional nginx `302 /r/:code → /install?ref=:code` gives denser printed QR codes (infra, optional).
- **KTD12. `ref` survives the auth surfaces.** `/register?ref=` on a device that already has passkeys redirects to `/login` (`register.tsx` guard); `ref` is forwarded as `/login?ref=`, and after login the post-login redirect goes to `/profile/referral/redeem?code=`. The client never knows a code's kind, so it forwards every code; a Frak code then fails there per R3, which is exactly D4. Only user codes are effectively preserved.

### Implementation Constraints

- `services/backend/AGENTS.md`: no service → service, no service → orchestrator. All Frak logic lives in `src/orchestration/` or in repositories. Migrations are human-written: this plan specifies the schema diff, and the db team writes the SQL.
- Standalone install bundle budget (`assertEagerBundleBudget`): the `ref`-only variant of `InstallView` must add no dependency and reuse existing components.
- Comment budget (`bun run lint:comments`): no history-narrating comments. Rationale stays in this plan / PR bodies.
- i18n: every new key in both `packages/wallet-shared/src/i18n/locales/{en,fr}`.
- Quality gate per PR: `bun run format && bun run lint && bun run typecheck && bun run test`.

### Sequencing

PR1 (U1–U4) → PR2 (U6–U7) → PR3 (U8–U10) and PR4 (U11–U13) in parallel. PR1 is safe to deploy dark: without an issued Frak code, nothing changes at runtime.

---

## Implementation Units

### PR1 — Backend core

#### U1. Schema changes (spec for the db team)

- `referral_codes`: add `kind text NOT NULL DEFAULT 'user'` + `CHECK (kind IN ('user','frak'))`. Replace `referral_codes_owner_active_idx` with the same columns `WHERE revoked_at IS NULL AND kind = 'user'`.
- `asset_logs`: no column change (`recipient_type` is unchecked `text`). Add partial **unique** index `asset_logs_welcome_bonus_live_idx ON (identity_group_id, merchant_id) WHERE recipient_type = 'welcome_bonus' AND status IN ('pending','processing','settled','bank_depleted')` (KTD7; add `campaign_rule_id` if U4 keeps one row per campaign). It doubles as the lookup index for `hasLiveFrakBonus` and `findFrakBonusMerchantIds`.
- Drizzle: `domain/referral-code/db/schema.ts` (`kind` with `$type<ReferralCodeKind>()`) and the `t.Union` in `domain/referral-code`. `domain/rewards/schemas/index.ts`: `AssetLogRecipientTypeSchema` (KTD6), used by `db/schema.ts` `recipientType.$type<>()`, `types/index.ts` (`CreateAssetLogParams`, asset-log select types) and `RewardHistoryItemSchema.role`. `RecipientTypeSchema` is unchanged.

#### U2. Frak identity + issuance script

- `domain/referral-code/constants.ts`: `FRAK_REFERRAL_IDENTITY_GROUP_ID`, `FRAK_CODE_ONBOARDING_WINDOW_MS` (24 h). Export via `domain/referral-code/index.ts`.
- `ReferralCodeRepository`: `createFrakCode(code)`, `revokeFrakCode(code)`, `listFrakCodes()`. `findActiveByOwner` filters `kind='user'`.
- `services/backend/scripts/frakReferralCode.ts`, modelled on `genSetupCode.ts`: `issue <CODE?>` (vanity or random, validated with `STEM_ALPHABET` / `CODE_LENGTH`) · `revoke <CODE>` · `list` (with redemption counts from `referral_links`). Idempotent upsert of the Frak `identity_groups` row.

#### U3. Redemption gate

- `api/user/wallet/referral/code.ts` `/redeem`: body gains `context: t.Optional(t.Literal("onboarding"))`. Response becomes `200 { kind: "user" | "frak" }` (was 204) so onboarding can pick the toast (R12).
- `ReferralCodeRedemptionOrchestrator.redeem`: if `referralCode.kind === "frak"`, run the KTD3 checks before the cycle check. Inject `IdentityRepository` (group `createdAt`) and `InteractionLogRepository` (`hasPurchaseForGroup(groupId)`, a new one-row query). Keep the existing errors and ordering for user codes.
- Tests (`ReferralCodeRedemptionOrchestrator.test.ts`, new): Frak code accepted in onboarding window. Rejected with `NOT_FOUND` for: no context, account older than window, existing purchase. User code unaffected by context. `ALREADY_REDEEMED` still wins for a user who already has a referrer.

#### U4. Reward policy

- `orchestration/reward/frakReferralPolicy.ts` (KTD4) + `frakReferralPolicy.test.ts` covering AE1–AE3 and AE8 at the function level. Cases: redirect, drop non-purchase, drop depth > 1, drop when claimed, drop when not direct, pass-through of non-Frak rewards, multi-campaign redirect.
- `AssetLogRepository.hasLiveFrakBonus` (KTD7). `PolicyReward = CalculatedReward & { recipient: AssetLogRecipientType }`; `buildAssetLogParams` takes `PolicyReward[]` and drops its `as RecipientType` cast.
- `BatchRewardOrchestrator.processSingleInteraction`:
  1. After the defer check, if any reward's `recipientIdentityGroupId === FRAK_ID`, compute `bonusAlreadyClaimed` (skip the query otherwise: hot path).
  2. Apply the policy.
  3. Pass the policy output to `buildAssetLogParams`.
  4. `businessMetrics.frakWelcomeBonus(merchantId)` per redirected row, next to the existing `rewardInteractions` counters.

  Leave `consumedByCampaign` computed from the pre-policy rewards (KTD5), with the one-line trap comment.
- `sendRewardPendingNotifications` needs no change: the bonus row belongs to the user.
- Tests (`BatchRewardOrchestrator` integration-level, with repository mocks as in `SettlementOrchestrator.test.ts`): AE2 budget restore amount, AE4 refund re-opens, AE6 cap unchanged, unique-index violation leaves the interaction unprocessed (KTD7).

#### U5. (dropped)

No identity-merge guard. The wallet-bearing group always anchors a merge, so the only real shape is "new wallet holding the Frak link absorbs an older anonymous/email group with purchase history", and D2 defines the bonus as the first *Frak-credited* purchase, which that user has not had. Two identities each holding a bonus at the same merchant keep both after a merge: accepted.

### PR2 — Backend read APIs + reporting

#### U6. Status + history APIs

- `api/user/wallet/referral/status.ts`: KTD9 fields. Repository helper: `AssetLogRepository.findFrakBonusMerchantIds(groupId)`.
- History needs no mapping change: `role` is already `log.recipientType` and the own-purchase path is the `!== 'referrer'` branch of `extractPurchaseInfo`; `buildReferrerPurchaseIdMap` filters `=== 'referrer'`. Only `RewardHistoryItemSchema.role` widens (U1).
- Tests: history item for a bonus row has `role: 'welcome_bonus'` + the user's own purchase amount.

#### U7. Merchant reporting (R17)

- Ambassador counts and lists (`CampaignStatsOrchestrator` ~L195/L381/L440/L525, `CampaignOverviewOrchestrator` ~L189–190) and the converted-referee counts (~L316, overview ~L655) all filter `recipient_type = 'referrer'`, so bonus rows are excluded with no change (KTD6).
- One edit: `refereeAmount` (`CampaignStatsOrchestrator` ~L379) becomes `FILTER (WHERE recipient_type IN ('referee','welcome_bonus'))` so `ambassadorAmount + refereeAmount = spend` still holds. `spend` is unfiltered and already includes the row.
- Test: AE9 on the aggregate query.

### PR3 — Wallet onboarding, install link, home

#### U8. Install link `?ref=`

- `apps/wallet/app/module/install/params.ts`: `InstallSearch.ref`, parsed and validated (KTD11) in `parseInstallSearch`.
- `InstallView.tsx`:
  - When `ref` is present without `m` / `a`: skip install-code minting and render a code-first variant (code displayed large, copy action, store buttons).
  - The store-button gesture copies the referral code (iOS path, D5).
  - With both `m` / `a` and `ref`: existing flow, the install code keeps the clipboard, and the referral code is shown for manual entry.
- `packages/wallet-shared/src/sharing/buildInstallUrl.ts`: `buildPlayStoreInstallUrl` accepts optional `referralCode` (appended as `referralCode=`, additive like `proof`). Add a variant for the `ref`-only case (no merchant).
- `apps/wallet/app/utils/deepLink.ts`: `extractSearchParams` reads `ref`, and the `install` resolver routes as R14. `install` is in `publicActions`, so `handleDeepLinkAction` deliberately passes `session = null` for it: the resolver must call `getSafeSession()` itself. Logged out → `{ to: "/register", search: { ref } }`. Logged in → `{ to: "/profile/referral/redeem", search: { code: ref } }`.
- `routes/_wallet/_protected-fullscreen/profile.referral.redeem.tsx` has no `validateSearch` today: add `code`, and pass it as `initialCode` to `RedeemReferralCodePage` / `ReferralCodeForm`.
- `routes/_wallet/_auth/login.tsx`: `ref` in `validateSearch`; the post-login redirect targets `/profile/referral/redeem?code=` when present (KTD12). `register.tsx`'s passkey guard forwards `ref` to `/login`.
- Tests: `params.test.ts`, `deepLink.test.ts`, `InstallView.test.tsx` (ref-only variant renders, copy fires with the referral code, Android URL carries `referralCode`).

#### U9. Onboarding pre-fill + Frak toast

- `routes/_wallet/_auth/register.tsx`: `RegisterSearch.ref` in `validateSearch`. Initial code source, in priority: `search.ref` > `useInstallReferrer().data.referralCode` > none.
- `module/onboarding/hook/useInstallReferrer.ts`: read `referralCode` from the Play referrer. It currently returns `null` when `merchantId` / `anonymousId` are missing, so return `{ referralCode }` alone in that case without the merchant ensure action.
- `ReferralCodeStep` + `useRedeemReferralCodeForm`:
  - `initialCode` prop, pre-filled but not auto-submitted
  - a paste action (reuse the `CodeInput` paste pattern / `clipboard-manager:allow-read-text`)
  - send `context: "onboarding"` from this step only (U3)
- `useRedeemReferralCode`: surface the response `kind`. `register.tsx` shows `onboarding.referral.frakAppliedToast` when `kind === "frak"`. `useReplaceReferralCode` (delete + redeem) and the e2e `tests/pages/auth.page.ts` are the other two `/redeem` consumers: both must tolerate the 200-with-body response.
- Analytics (`packages/wallet-shared/src/common/analytics/events/onboarding.ts`): `referral_code_resolved` gains `code_kind` and `prefill_source: "url" | "install_referrer" | "paste" | "none"`.
- Tests: `ReferralCodeStep.test.tsx` (prefill, paste), `-register-install-referrer.test.tsx` (referrer with only `referralCode`), `useRedeemReferralCodeForm.test.tsx` (context flag sent).

#### U10. Home slide

- `module/wallet/component/WelcomeCard`: new slide kind `frakBonus` (types in `utils/types.ts`, dismissal via existing `dismissedSlides`), first in order, visible when `referralStatus.frakReferral` is non-null. CTA → `/explorer`. Copy: "You're one of our first members — enjoy an exclusive cashback bonus on your first purchase at participating brands." ("participating": a merchant with no referrer reward pays nothing, and the explorer badge is what marks the ones that do.)
- Test in `WelcomeCard/index.test.tsx`.

### PR4 — Wallet explorer + history

#### U11. Eligibility hook

- `packages/wallet-shared/src/referral/hook/useFrakBonusEligibility.ts`: from `useReferralStatus()`, returns `{ isFrakReferred, isEligible(merchantId) }` = `isFrak && !claimedMerchantIds.includes(id)` per KTD9. Export via `referral/index.ts`.

#### U12. Explorer

- `module/explorer/component/ExplorerCard/index.tsx`: badge `explorer.frakBonus.badge` when `isEligible(merchant.id)` and one of the card's rewards has `trigger === 'purchase'` and a `referrer` estimate (`MerchantReward` in `sdk/core/src/types/rpc/merchantInformation.ts` carries both).
- `module/explorer/campaignView.ts` + `ExplorerDetail/CampaignInfoSection.tsx`: when eligible *and* `useReferralStatus(merchantId).merchantReferrer` is null (KTD9), an extra `InfoRow` "First-purchase bonus: +{referrer estimate}" and a short explanation (`explorer.frakBonus.explanation`).
- Tests: `campaignView` unit test for the bonus figure. Card renders the badge only when eligible.

#### U13. History

- `module/history/component/HistoryEntryRow`: label `reward.frakBonus.label` + distinct icon/accent when `item.role === "welcome_bonus"`. The wallet reads `role` nowhere today, so this is the first consumer.
- `RewardDetailModal`: extra `InfoCard` block explaining the bonus: "Because you joined Frak with an invitation, Frak passed its referrer reward to you on your first purchase at {merchant}." The purchase header uses `item.purchase`, already the user's own purchase for a non-`referrer` role.
- Tests: row + modal render the bonus variant.

---

## Verification Contract

- Unit: `frakReferralPolicy.test.ts` covers every branch of KTD4.
- Orchestrators: redemption gate (AE7, incl. the rejection log/metric), batch (AE1, AE2, AE4, AE6, AE8, unique-index retry), history role (U6), reporting aggregate (AE9).
- Wallet: tests listed per unit. Existing `-register-install-referrer`, `ReferralCodeStep`, `InstallView`, `deepLink` suites stay green.
- Manual, on the dev stage, after issuing a code with U2's script:
  1. F1 on an Android build with the `/install?ref=` QR
  2. F2 on iOS
  3. F4–F6 with two test merchants and uncapped campaigns
  4. F7 from settings
- Build gates: standalone bundle budget passes, `bun run check:es-output`, full quality gate.

## Definition of Done

- All AE pass in automated tests or the manual run above.
- Migration SQL delivered by the db team and applied on dev before PR1 merges.
- At least one Frak code issued on dev and prod via the script, and the QR URL handed to marketing.
- en + fr copy reviewed by product.

## Risks

- **Friend link shadows Frak (AE5).** Intended. The explorer card badge can be stale for such a merchant (KTD9 dropped `shadowedMerchantIds`); the detail page is exact. No reward is mis-paid either way.
- **Budget pre-check includes Frak's share.** `consumeBudget` runs on the pre-policy total, so a nearly exhausted campaign can skip a purchase whose referee reward alone would fit. Today's behaviour for any referred purchase, but structurally more frequent for Frak-referred users: on every purchase after the first at M, the referrer half is consumed then always dropped.
- **Ops load of uncapped campaigns.** Every later purchase evaluates, then drops, a Frak share: one extra array pass, plus one indexed `EXISTS` only when a Frak recipient is present.
- **Merge edge cases.** Two identities each holding a bonus at the same merchant keep both after a merge. Accepted as negligible (U5 dropped).
- **Onboarding window tuning.** 24 h may be too short if marketing onboards people who only finish registration later. The value is a constant, and the rejection log/metric (KTD3) is how we find out.
- **Code leaks.** A leaked Frak code only helps brand-new accounts with no purchase, one bonus per merchant, and every redemption ends in a purchase at a merchant. Revoke via the script (`revoke`); existing redemptions are preserved. No cap, expiry or kill switch for now (Q2).

## Open Questions (tunables, non-blocking)

- Q1. Onboarding window length: 24 h default.
- Q2. Per-code redemption limit, expiry, or a policy kill switch? Not in scope while there is no user base: abuse converts to merchant purchases. Two nullable columns on `referral_codes` checked in the U3 gate, plus one env flag in the policy, when it matters.
- Q3. Short QR alias `/r/:code`: needs an nginx rule in `infra/`, so decide with infra.
