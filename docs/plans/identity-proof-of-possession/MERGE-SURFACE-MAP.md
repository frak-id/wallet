# Merge surface map

**The single place to check before touching identity.** Three questions, answered as tables: where
identities get merged, what attests each side, and what is actually broken.

This document describes the **surface**. The decision and the schedule live in
[`MERGE-ADMISSION-PLAN.md`](./MERGE-ADMISSION-PLAN.md); every gap below names the work item that owns
it rather than sequencing the work here.

Backend paths are relative to `services/backend/src/`. Everything else is repo-relative. Line
numbers were read at `1c02c67d3` (`audit/shipped-scopes-review`); symbols are the durable anchor.
Rows marked **SUSPECTED** are inference; everything else was read in the file cited.

**Naming.** `ROLLOUT-STEP-3` is the marker set in the tree and the step in
[`ROLLOUT.md`](./ROLLOUT.md); it is the only thing either document calls a "step". Merge points are
`M1`–`M20`, gaps are `G1`–`G28`, correctness defects are `B1`–`B2`, audit findings are `AID-*`, and
work items keep their `T1.x` / `T2.x` / `T3.x` ids from `MERGE-ADMISSION-PLAN.md`. That plan now
groups those items into five buckets (A–E) instead of three tiers. Two id notes, so every reference
below still resolves: `T3.1` split into **`T3.1a`** (`/merge/initiate`, bucket D) and **`T3.1b`**
(`/merge/execute`, bucket E), and **`T2.4` was deleted** — AID-005 closes as a side effect of the
flips and needs no dedicated work (G27 below).

---

## The shape of the thing

**A merge is two independent assertions, and they are made at different times by different callers.**
`POST /user/identity/merge/initiate` binds the **source**: it either takes a `sourceAnonymousId` with
a `frak-merge-v1` proof, or it takes a wallet session, and it mints a 60-minute JWT naming the
resulting `sourceGroupId` (`orchestration/identity/AnonymousMergeOrchestrator.ts:75`).
`POST /user/identity/merge/execute` binds the **target**: a `targetAnonymousId` plus a
`frak-merge-v1` proof whose 32-byte binding field is `SHA-256(mergeToken)`
(`AnonymousMergeOrchestrator.ts:203`). The token binding is what removes the need for a replay cache
on the proof — and it is the *only* binding filled in anywhere in the system. Every other op signs
`new Uint8Array(0)`.

**Latch-gated** means `orchestration/identity/latchedProof.ts#enforceLatchedProof`: if a proof is
present it must verify; if it is absent, the node is looked up and the call is refused only when
`proof_seen_at` is already set (`:65`). A node that has never presented a valid proof takes
`return false` at `:73`, and every caller reads `false` as *allow*. So the control is present for
identities that have already signed and **absent for identities that never have** — which is, by
construction, the pre-install sharer and the pre-install buyer: the population holding unclaimed,
unsettled value with no wallet attached yet. `WALLET_CONFLICT`
(`IdentityWeightService#checkWalletPriority`) is the only other brake and it fires only when *both*
groups already carry different wallets, so it fails on exactly the same set. The control and the
bound are absent together, on the population that matters.

**The id-to-key binding is derived, not registered, and it is checked before anything else.**
`domain/identity/services/IdentityProofService.ts:144-146`:

```ts
const derivedId = await deriveIdFromKey(envelope.pk);
if (derivedId !== params.anonymousId.toLowerCase()) {
    return { valid: false, reason: "id_mismatch" };
}
```

`deriveIdFromKey` is `deriveClientIdFromHash(SHA-256(pk))` — the same function that minted the id
(`sdk/core/src/identity/canonical.ts:166-185`). The signed message is
`op ‖ merchantId(16B) ‖ anonymousId(16B) ‖ binding(32B) ‖ ts(8B)`, verified against the same embedded
`pk`.

> **Verdict: a spoofed stored client id cannot assert someone else's identity through the proof
> path.** There is no key registry and none is needed; an attacker cannot present a `pk` for an id
> they do not hold, and the proof is merchant-scoped so it cannot be replayed across merchants.
> **What a spoofed client id *can* do is bypass the proof path entirely.** Every row below marked
> **YES** in Q2 accepts a caller-named id with no proof at all, or with a proof that is
> optional-when-absent — `MERGE-ADMISSION-PLAN.md` counts eleven such routes across the API, eight of
> which cause a write. The defect is never in the credential. It is in the routes that do not ask for
> one.

That last point is also why the fix is cheap: because the comparison above already rejects
`id_mismatch` before the signature is checked, **making the proof mandatory buys exactly what
removing the id from the body would buy**. So the id stays on the wire — every published client's
request shape remains valid, and the body id is demoted to untrusted input that must match the
proof. Nothing in this programme removes a request field.

Two riders on the verdict:

- **A captured proof is a bearer credential for its whole window.** `frak-ensure-v1` is 30 days,
  `frak-install-v1` 30 days, `frak-merge-v1`/`frak-sso-v1` 10 minutes. Only `merge/execute` binds
  anything. A captured `frak-ensure-v1` is a month-long capability to link that anon id to whatever
  wallet session presents it (G5).
- **The comparison lowercases; storage does not.** `IdentityProofService.ts:145` lowercases the
  claimed id; `IdentityRepository#normalizeValue:31-39` lowercases `wallet` and `email` and returns
  `anonymous_fingerprint` raw (G8, = AID-006). A *derived* id can never be mixed case —
  `deriveClientIdFromHash` emits through `bytesToHex` (`canonical.ts:177,187-189`), which is
  lowercase by construction — so mixed case can only ever arrive from a caller.

---

## Q1 — Where identities get merged

One row per point where identity nodes end up in one group, or where a node is written into a group
at a caller's request. **Side effect** marks a merge that happens as a consequence of an operation
whose stated purpose is something else. **Reachability** marks rows that are not reachable from a
live caller today.

### Identity routes

| ID | Merge point | Links what to what | App / context | Code anchor | Notes |
|---|---|---|---|---|---|
| **M1** | `POST /user/identity/ensure` — SDK arm | anon → wallet | merchant-site SDK, after `watchWalletStatus` sees a connected wallet | `api/user/identity/ensure.ts#resolveSdkEnsureAnonymousId:132`; merge via `IdentityOrchestrator.resolveAndAssociate:118`. Client: `sdk/core/src/actions/ensureIdentity.ts:56-74` | The SDK signs `frak-ensure-v1` on every call and omits it only when `signProof` returns `null` (`ensureIdentity.ts:56`). The subject is `x-frak-client-id`, which is the **derived** id from the first load (`migrateLegacyIdentity.ts:10-13`), so what keeps the arm proof-optional is the schema, not any client population |
| **M2** | `POST /user/identity/ensure` — wallet arm, **ticket** branch | anon → wallet | wallet app after redeeming an install code | `ensure.ts#resolveWalletEnsureAnonymousId:46`, ticket branch `:56` (`InstallCodeService.verifyTicket`) | Short-circuits with `return resolved.anonymousId` **before any latch read**. The ticket is minted by M-x1 below |
| **M3** | `POST /user/identity/ensure` — wallet arm, **bare id** | anon → wallet | wallet Tauri binary, deep link, Play referrer, hosted `/install`, **and the wallet's own `/sharing` → `/install` hop** | `ensure.ts:78-88` (the proofless variant) and the header fallback `:213-225`; the separate `frak-install-v1` branch at `:105-120` is the *attested* arm and is not part of this row | The bare variant verifies nothing and the latch is **never read**. Strictly weaker than `/merge/execute`. The in-file comment at `:78-80` ("kept only because the installed Tauri binary POSTs exactly this shape") is **wrong**: `SharingView.tsx:94-99` → `routes/sharing.tsx:55-57` → `InstallView.tsx:150-172` → `drainEnsures.ts:104-109` reaches it from the *current* web build with neither credential, structurally — that page holds no keypair |
| **M4** | `POST /user/identity/merge/initiate` — anon-source arm | anon → wallet | SDK, listener modal, embedded wallet | `api/user/identity/merge.ts:9` → `AnonymousMergeOrchestrator.initiateMerge:75`, merge at `:150` | **Side effect.** The stated purpose is minting a token; `resolveAndAssociate([wallet, anon])` runs first and merges the caller's wallet group into whatever `sourceAnonymousId` resolves to. The ordering is acknowledged in-file at `:99-106`. Three live callers, three different proof postures — see the readiness table in the plan §7 |
| **M5** | `POST /user/identity/merge/initiate` — wallet-session arm | — (no group write) | wallet app explorer, listener | `merge.ts:9`; `apps/wallet/.../ExplorerDetail/index.tsx:107` | Not a merge itself. Mints the token that M6 consumes, authenticated by session. Listed because it is the source half of the two-proof flow and the source of AID-020's token |
| **M6** | `POST /user/identity/merge/execute` (**unauthenticated**) | anon → anon, or wallet-group → anon | any caller; legitimately the in-app-browser escape, the explorer hop, legacy migration, native inbound `fmt` | `merge.ts:63` → `AnonymousMergeOrchestrator.executeMerge:180`; target resolution ternary at `:231-241` | The proof *authorises creation* of the target; an already-existing unlatched target is admitted with no proof at all (`TARGET_NOT_FOUND` at `:239` only when the row is absent). `sdk/core/src/actions/migrateLegacyIdentity.ts:82-96` sends `{mergeToken, targetAnonymousId, merchantId}` and **no proof — and cannot**: its target is the legacy id, which has no key. That is why this route, alone in the system, waits on the legacy-id population aging out (plan §6, bucket E) rather than on any client release |

**Adjacent, not merge points — but they supply every input above.** Kept in the map so the surface
is closed.

| ID | Surface | Why it is here | Code anchor |
|---|---|---|---|
| M-x1 | `POST /identity/install-code/generate` + `/resolve` (both unauthenticated) | Mints the credential M2 consumes, for a caller-named `anonymousId`, unconditionally | `api/user/identity/installCode.ts:10`, `:69`; `InstallCodeService#mintTicket` |
| M-x2 | `GET /user/identity/order-client` | Unauthenticated `anonymousId` oracle keyed on `(merchantId, checkoutToken)` — supplies the id M3/M6 need to name. Also the route **B1** breaks: its third step (`orderClient.ts:45-55`) 404s whenever the group holds no merchant-scoped anon node | `api/user/identity/orderClient.ts:22`, `:37-43`, `:45-55` |
| M-x3 | `POST /user/wallet/auth/emailStatus` | Unauthenticated email → `{wallet, authenticatorIds}` oracle, including for **unverified** email nodes | `orchestration/identity/AuthenticatorLookupOrchestrator.ts#resolveEmail:59` |
| M-x4 | `IdentityMergeService#runMergeInTrx` | Not an admission point; the **blast radius** of every merge row. Rewrites nodes, purchases, referrals, assets, referral codes, affiliate attributions, push tokens, **and `merchants.owner_wallet` + `merchant_admins`** | `orchestration/identity/IdentityMergeService.ts:117`, `:148`, admin rewrite `:625-731` |

### Attribution and purchase

| ID | Merge point | Links what to what | App / context | Code anchor | Notes |
|---|---|---|---|---|---|
| **M7** | `POST /track/interaction`, `POST /track/purchase`, `GET /merchant/referral-status` | **no merge** — but creates the anon node and its group for a caller-named id | web/native SDK, unauthenticated | `api/user/track/sdkIdentity.ts:157,170` → `IdentityOrchestrator.resolveForAttribution:176` | All three investigations agree: `resolveForAttribution` never calls `mergeGroups`, and it is tested. It is still a **write**, and it manufactures the permanently-unlatched population every other row fails open on. `referralStatus` does it on a `GET`. When a **wallet** node is present the anchor rule at `:183` resolves only the wallet node, so the anon node is never written at all — that is **B1**, and it fires on every wallet-bearing `track/*` call |
| **M8** | `PurchaseLinkingOrchestrator.claimPurchase` — the `merge:true` arms | anon → purchase's group | none live | `orchestration/PurchaseLinkingOrchestrator.ts:74`, arms at `:91-95`, `:130` and `:162-190`; default `const merge = params.merge ?? true` at `:87` | **Reachability: unreachable today.** The only live caller passes `merge:false` (`api/user/track/purchase.ts:67`). The *default* is the merging one, and `rebindExisting: merge` at `:130` rides on the same flag. The doc block at `:14-21` names `PurchaseWebhookOrchestrator` as the default's consumer; that class never calls this method — the default is a default for nobody (**B2**) |
| **M9** | Shopify / Magento order webhook → `PurchaseWebhookOrchestrator.upsertWithCartAttributeIdentity` | buyer-writable cart attribute → an existing group, and onto `purchases.identity_group_id` + the interaction | server-to-server webhook (HMAC-verified) | `orchestration/PurchaseWebhookOrchestrator.ts:88,160,177`; `api/external/.../shopifyWebhook.ts:91-93,127`; `magentoWebhook.ts:64` | **Side effect** of recording a purchase. Investigations A/C/D: single node ⇒ `uniqueGroupIds.length === 1` ⇒ `mergeGroups` never runs — **no merge**. Investigation B agrees on today's behaviour and adds that this is the merging API and adopts any named group, including one holding a wallet. Both readings are in the row deliberately |
| **M10** | `/track/interaction {type:"arrival"}` → `ArrivalHandler#resolveReferrerGroupId` | **not a group merge** — writes a `referral_links` edge referrer-group → referee-group | SDK, unauthenticated | `orchestration/interaction-submission/handlers/ArrivalHandler.ts:80,145`; `ReferralService` first-referrer-wins | Distinct table, same "caller names an id" shape, and the graph `BatchRewardOrchestrator` walks at payout. Tracked as G18; no item owns it |

### Auth / SSO / pairing / email

| ID | Merge point | Links what to what | App / context | Code anchor | Notes |
|---|---|---|---|---|---|
| **M11** | `POST /user/wallet/auth/login` and `/ecdsaLogin` | anon → wallet | wallet app login, SSO and normal | `api/user/wallet/auth/login.ts:63,131` → `IdentityOrchestrator.linkWalletToFingerprint:207`, merge at `:248` | **Side effect** of logging in. The anon node is pushed only inside `if (clientId && merchantId && proof)` and only on `verification.valid` — no proof, no merge |
| **M12** | `POST /user/wallet/auth/register` — anon arm | anon → wallet | wallet app SSO onboarding | `api/user/wallet/auth/register.ts:155` → `linkWalletToFingerprint:207` | **Side effect** of registering. Runs only `if (created)` — a re-registration with a valid proof performs no merge |
| **M13** | `POST /user/wallet/auth/register` — **email arm** | email → wallet's group | wallet app register | `register.ts:160` → `IdentityOrchestrator.ts:273` (`addNode`, `verified_at` NULL) | **Side effect**, and unconditional. The `email` node is global (not merchant-scoped) and is a first-class node moved by `mergeGroups`. **Out of scope for this programme — filed separately** (see the plan §9) |
| **M14** | `POST /user/wallet/auth/email/verification` (first email), then `/verify` | email → wallet's group | wallet app profile | attach `api/user/wallet/auth/email.ts:115`; promote `IdentityRepository#confirmEmail:268` | Attach is unconditional and happens **before the code is sent**; promotion is code-gated. `confirmEmail` also soft-unlinks the group's other email nodes. The rotation path deliberately does the opposite (`EmailVerificationService#resolveTarget`). **Out of scope for this programme — filed separately** (see the plan §9) |
| **M15** | `GET /user/wallet/merge/preview` + `POST /settle` | wallet ⇄ wallet, whole groups collapse | wallet app | `orchestration/identity/WalletMergeOrchestrator.ts#settle`; `IdentityMergeService.mergeGroupsByWallet:433` | The only point in the domain with cryptographic attestation on **both** sides |
| **M16** | `POST /user/wallet/auth/recover` | new credential → existing wallet group | wallet recovery | `orchestration/identity/RecoveryClaimOrchestrator.ts:97` (on-chain `getPasskey` readback), `:154` | No `clientId`, no proof, no anon node — merges nothing anonymous |
| **M17** | `WS /user/wallet/pairings/ws`, `GET /pairings/find/:id` | **nothing** | wallet ⇄ desktop pairing | `domain/pairing/**`, `orchestration/pairing/**` | Listed because it used to merge. The unauthenticated `originNode` merge is gone: no `IdentityOrchestrator` dependency, no `origin_node` column, pinned by `services/backend/test/api/wallet/pairing.test.ts:592-700`. Session issuance only |
| **M18** | `api/middleware/identity.ts#resolve` | wallet node → its own group | any wallet-session route | `api/middleware/identity.ts` | Creates, never merges. The wallet address comes from a verified JWT |

### Native

| ID | Merge point | Links what to what | App / context | Code anchor | Notes |
|---|---|---|---|---|---|
| **M19** | Inbound `?fmt=` handed to `handleReferral` → `POST /merge/execute` | anon → anon | merchant's native app hosting `sdk/android` / `sdk/ios` | `sdk/android/.../identity/MergeSender.kt:40`, `sdk/ios/Sources/FrakSDK/.../MergeSender.swift:39`; `IdentityMerge.parseToken` | The **only** identity endpoint either native SDK calls. Fail-closed: `DeliveryOutcome.Hold` / early return when `signProof` yields null. The token itself comes from a merchant-supplied URL — that is M6's source-side gap (G13), not a native one |
| **M20** | Native sharing sheet → `frakwallet://install?…&p=` or Play install referrer → `/identity/ensure`'s wallet arm | anon → wallet | native merchant app → wallet app | `InstallLinks.kt:20-42`, `InstallLinks.swift:14-20`; consumed by `apps/wallet/.../module/install/params.ts`, landing on `ensure.ts:105-120` | The **well-attested arm of the wallet ensure route**: a real `frak-install-v1` signed in Keystore / Secure Enclave, verified and latched at `:105-120`. The same route also accepts a bare id from anyone (M3/G1), so the arm's strength is not the route's — and that is why the bare variant is deleted while this branch is kept and made mandatory |

**Surfaces that hold no signing key and therefore cannot attest anything they send** (from the
client-surface inventory): `apps/listener` (wallet origin, id is a URL param), `apps/wallet` SPA and
Tauri binary, the standalone `/sharing` and `/install` entrypoints, the Shopify post-purchase
extension, the Shopify checkout web pixel, the Shopify theme app-embed, and every storefront plugin.
The only web signer is `sdk/core` on the **merchant origin** (`sdk/core/src/identity/sign.ts`, key at
`frak-client-key` in origin-scoped `localStorage`); `signProof` and `frak-client-key` grep to zero
hits across `apps/**` and `packages/**`, and `signProof` is not exported from the SDK's public
surface, so no merchant script, theme snippet or plugin can mint a proof. `apps/business` touches no
identity node at all.

---

## Q2 — What attests each side

Same IDs. The last column is the question that decides everything: **can a caller put an id it holds
no key for into a body field or header and have the backend act on it?**

| ID | Source identified by | Source attested by | Target identified by | Target attested by | Gating | Caller can name a foreign id? |
|---|---|---|---|---|---|---|
| **M1** | `walletSession.address` | verified SDK JWT (`walletSessionKind === "sdk"`) | `x-frak-client-id` | `frak-ensure-v1`, **empty binding**, 30-day window — optional | latch-gated | **YES** — any id that has never latched |
| **M2** | `walletSession.address` | verified wallet JWT | install ticket `sub` | ticket signature only; the `sub` came from a caller-named `anonymousId` at M-x1 | **none** — returns before any latch read | **YES** — including latched ids |
| **M3** | `walletSession.address` | verified wallet JWT | body `anonymousId` / `x-frak-client-id` | **— nothing —** on the bare variant | **none** — latch never read | **YES** — including latched ids. The widest hole in the system |
| **M4** | `sourceAnonymousId` | `frak-merge-v1`, **empty binding**, 10 min | n/a (mints token) | n/a | latch-gated | **YES** — any unlatched id |
| **M5** | `walletSession.address` | verified wallet JWT **or SDK JWT** (`withOptionalWalletOrSdkAuthent`) | n/a | n/a | none by design — the session *is* the attestation | no — but see G22, the SDK JWT is handed to merchant page JS |
| **M6** | `sourceGroupId` from the merge-token JWT | bearer token, 60 min, **never consumed** | `targetAnonymousId` | `frak-merge-v1` bound to `SHA-256(mergeToken)` — optional | latch-gated; the proof also authorises *creation* | **YES** — any unlatched id **that already exists** (AID-020) |
| **M7** | `x-frak-client-id` | **— nothing —** | n/a (no merge) | n/a | none | **YES** — creates the node, does not merge; and creates **nothing** when a wallet node is present (B1) |
| **M8** | claiming group from `x-frak-client-id` | **— nothing —**, plus bearer knowledge of `(merchantId, orderId, purchaseToken)` | existing purchase's group | order/token pair — the schema states this *is* the model (`domain/purchases/db/schema.ts:100`) | none | **YES**, if a caller ever passes `merge:true` |
| **M9** | `_frak-client-id` cart attribute / `frak_client_id` cookie | **— nothing —** — buyer-writable via the public `/cart/update.js` Ajax API; HMAC proves only that the shop relayed it | whatever group already owns that fingerprint | **— nothing —** | none | **YES** |
| **M10** | `referrerClientId` / `referrerWallet` in the request body | **— nothing —** | referee = `x-frak-client-id` | **— nothing —** | self-referral, cycle and first-referrer-wins only | **YES, both ends** |
| **M11** | WebAuthn assertion / EOA `personal_sign` over a **client-supplied** challenge | verified signature; no server nonce, no `signCount` check | `x-frak-client-id` | `frak-sso-v1`, **empty binding**, 10 min — **mandatory for the merge to occur** | unconditional on the proof: no proof, no merge | no — but a captured `?p=` blob is a 10-minute bearer that reaches the same outcome (G6) |
| **M12** | WebAuthn registration (`expectedChallenge: () => true`) | ceremony only | `x-frak-client-id` | `frak-sso-v1`, mandatory | as M11 | no — same rider (G6) |
| **M13** | wallet from the same registration | ceremony | `email` from the request body | **— nothing —** | unconditional | **YES** — squat any address; global unique slot |
| **M14** | wallet session | verified wallet JWT | email address from the body | **— nothing —** on attach; 6-digit code (≤10 attempts, TTL, consumed in-tx) on promote | attach unconditional, promote code-gated | **YES** for the attach |
| **M15** | requester's local WebAuthn session | verified assertion | loser wallet | loser's **own WebAuthn consent signature** + on-chain validator readback of the passkey | unconditional, two-sided | no |
| **M16** | new passkey registration ceremony | ceremony | `recoveredWallet` from the body | **on-chain `getPasskey` readback** | unconditional | no |
| **M17** | joiner's wallet session | verified wallet JWT | `pairingId` + 6-digit code | code, plus `authenticatorHints` | n/a — no identity write | n/a (session fixation risk only, G-adjacent) |
| **M18** | wallet JWT | verified | n/a | n/a | n/a | no |
| **M19** | `fmt` token from a merchant-supplied URL | bearer token | its **own derived** id | `frak-merge-v1` bound to `SHA-256(token)`, **fail-closed** | unconditional client-side | no |
| **M20** | own derived id | `frak-install-v1` signed in Keystore / Secure Enclave | n/a | n/a | unconditional client-side | no — but it lands on the same route as M3, which is a **YES** row |

### After the planned changes

**A `no` is the goal state.** The middle column is what `ROLLOUT-STEP-3` can *actually* execute now
that the wallet binary is propagated — which is less than its own markers claim. The right column is
`MERGE-ADMISSION-PLAN.md` in full: proof mandatory on the four admission routes with the body id
demoted to untrusted-input-that-must-match, deletion of `ensure`'s proofless bare variant, Gate 2 for
the keyless Shopify surfaces, and the credential-lifetime work. **Only one row in that column waits on
a population** — M6 — because only its subject can be an unprovable legacy id.

| ID | Today | After `ROLLOUT-STEP-3`, as it can actually be executed | After `MERGE-ADMISSION-PLAN.md` |
|---|---|---|---|
| M1 | **YES** | **YES** — untouched. `ROLLOUT-STEP-3` addresses the *wallet* arm; the SDK arm stays latch-gated because its schema still marks `proof` optional, not because any live client omits it | **no** (T3.2, bucket D, ships now: `frak-ensure-v1` required; the header id must match it) |
| M2 | **YES** | **YES** — the ticket becomes the *sole* wallet-arm credential, and its `sub` still came from a caller-named id at `install-code/generate`, which `ROLLOUT-STEP-3` does not touch | **no** for naming an id (T3.3 + Gate 2 decide the credential at `generate`). A stolen *code* is still a capture of that id until T3.5/T2.6 land |
| M3 | **YES** | **YES — corrected.** `ROLLOUT-STEP-3` does **not** close this row. `ensure.ts:78`'s premise ("kept only because the installed Tauri binary POSTs exactly this shape") is false: the wallet's own `/sharing` → `/install` hop lands on the bare arm with neither credential from the *current* web build, and that page can never sign — it holds no keypair (`SharingView.tsx:94-99`). The unmarked header fallback at `:213-225` is a second door. Item 4 of `ROLLOUT.md`'s step-3 list is not executable as written | **no** — T3.2 deletes `:78-88` **and** `:213-225`, makes the `frak-install-v1` branch at `:105-120` mandatory, and stops the wallet sharing page forwarding an `a=` it holds no credential for |
| M4 | **YES** | **YES** — untouched. `AnonymousMergeOrchestrator.ts:112` marks this arm as *revisit*; its `TODO(merge-initiate-proof)` at `:117-121` says "the SDK's RPC path already sends one", which holds for every live SDK once **T1.7** lands — `getMergeToken.ts:32-39` signs at call time, but over `metadata.merchantId ?? ""` today, so the proof is `null` (G23/AID-009). The residue is `mergeTokenQueryOptions.ts:68-74`, which sends none ever and can never sign locally | **no** (T3.1a, bucket D: `proof` required whenever `sourceAnonymousId` is present), after T2.3 gives the listener an SDK-signed `proofs.mergeSource` to present (plan §2.1) and T3.11 refuses without one. **Not blocked on SDK propagation** |
| M5 | no | no | no |
| M6 | **YES** | **YES** — untouched. `/merge/execute` is not a wallet arm; no `ROLLOUT-STEP-3` marker flips its target gating | **no** (T3.1b, **bucket E, alone**) — the one flip with a population gate: `targetAnonymousId` on a migration *is* the legacy id, so it waits for `merge_execute_credential{class=absent_unlatched}` ≈0, with a permanent tail written off at flip time. M4's arm flips earlier and does not close this row |
| M7 | **YES** | **YES** | **YES** — explicitly out of scope; `/track/*` must stay usable by keyless clients. B1 is fixed in the Shopify credential path, not here |
| M8 | **YES** (latent) | **YES** | **YES** for the merging arms as a shape; T1.3 makes `merge` a required param so no caller reaches them by default |
| M9 | **YES** | **YES** | **YES** — G14, filed separately |
| M10 | **YES** | **YES** | **YES** — G18 needs its own plan; mandatory proof structurally cannot reach `/track/*` |
| M11 | no | no | no — G6's binding is T3.8, not part of the admission flip |
| M12 | no | no | no — same |
| M13 | **YES** | **YES** | **YES** — out of scope, filed separately (§9 of the plan) |
| M14 | **YES** | **YES** | **YES** — out of scope, filed separately (§9 of the plan) |
| M15–M20 | no | no | no |

**Read the middle column carefully.** `ROLLOUT-STEP-3` closes **no row on its own**. The binary is
propagated, which retires the *store-approval* dependency and unblocks the wallet-only marker work
(`installCode.ts:105`, the four pending-action markers, the two `latchedProof.ts` doc/log tails), but
the bare arm survives on a wallet-side path nobody had scoped and on an unmarked header fallback.
Anything that describes `ROLLOUT-STEP-3` as closing the merge surface is describing an M3 closure that
its own markers cannot deliver. The `/merge/*` markers are **not** blocked on SDK propagation either:
`initiate`'s markers clear as soon as the listener carries an SDK-signed proof (plan §2.1), and
`execute`'s clear when the legacy population has drained.

**And one thing that is *not* on this table: the "require a target proof when the merge token came
from a wallet session" branch.** It reads as a cheap P0 for AID-020 and it is not one. It is
bypassable: `api/user/identity/merge.ts:19-24` passes **both** `sourceAnonymousId` and
`sourceWalletAddress` into `initiateMerge`, so an attacker supplies their own derived id plus a valid
proof for it, the token carries both claims, and the branch never fires. It closes a code path, not an
outcome. It belongs in the programme as **alarm-only instrumentation** (T2.2), never as a gate.

---

## Q3 — Concrete gaps

| ID | Merge points | What the attacker gains | Sev | Tracked as → owner | Remediation |
|---|---|---|---|---|---|
| **G1** | M3 | Capture of **any** anon id, latched or not, in one call, with only the attacker's own wallet session. No token, no code, no proof | **Blocker** | AID-002 (recorded "closed by ROLLOUT-STEP-3"; that recording is wrong — see Q2) → **T3.2**, sized by T1.1's `ensure_arm{wallet_bare}` | Delete the proofless bare-id variant (`ensure.ts:78-88`) and the header fallback (`:213-225`); keep the `frak-install-v1` branch at `:105-120` and make it mandatory; stop the wallet `/sharing` page forwarding an `a=` it cannot attest |
| **G2** | M6 | Capture of any existing unlatched id in two calls, one of them the attacker's own legitimate `initiate` | Critical | **AID-020** → **T3.1b** (bucket E) for the target half, **T3.1a** (bucket D) for the source half; T2.2 alarms only | `proof` required on `execute`. `initiate`'s anon-source arm flips first and independently — it no longer waits for `execute`, because its subject is always the derived id. The wallet-session-arm predicate is bypassable and must not be shipped as a gate |
| **G3** | M2, M-x1 | Three unauthenticated calls launder a named id into an install ticket that bypasses the latch; one code yields up to 20 tickets, each 7 days | Critical | **AID-001** + **AID-019** → **T3.3** (admission half), **T2.6**/**T3.5** (residual) | Credential decided synchronously at `generate` — `{merchantId, anonymousId, proof}` or Gate 2's `{merchantId, checkoutToken}`, a bare `anonymousId` rejected 400 — then single-resolve codes and a **1–2 hour** ticket. Single-use tickets are dropped from this programme as an accepted risk |
| **G4** | M5, M6 | A captured `?fmt=` is a 60-minute **unlimited-use** group-capture capability | High | **AID-003** → **T3.6** (TTL only) | Cut the TTL, with the native 60-min hold cut in the same release. Token **consumption** (`jti`/`consumed_at`) is dropped from this programme as an accepted risk: replay requires capturing the token first, and sniffing/phishing is a more sophisticated attack than the one the burn would close |
| **G5** | M1 | A captured `frak-ensure-v1` is a 30-day bearer that links that id to *the attacker's* wallet | High | **AID-017** → **T3.8** | Bind the wallet address or the SDK JWT `jti`; cut the window. Needs a 30-day dual-accept window |
| **G6** | M11, M12 | A captured SSO URL, within 10 minutes, merges the victim's anon id into a wallet the attacker creates. `WALLET_CONFLICT` does not fire — the victim is pre-install | High | **AID-008** (transport); the unbound binding itself untracked → **T3.8** for the binding, transport half unowned | Put the wallet or credential id in the signed binding; `history.replaceState` after `setSsoContext` |
| **G7** | M4, M5 | A captured 10-minute initiate proof mints a token *for the victim's group*, redeemable into a target the attacker controls | High | **AID-003**(b) → **accepted risk, this round** | It **cannot** be filled with the hash of the token it mints: the client signs before the request and the token does not exist until after enforcement runs (`enforceProof:123`, `generateToken:165`). It needs a server nonce or a two-phase mint — both are dropped here. The 10-minute window is accepted as-is: capturing a live proof inside it is a sniffing or phishing attack, strictly more sophisticated than the naming attack T3.1 closes |
| **G8** | M1, M3, M6 | Latch bypass by case: a mixed-case victim id misses `findNodeByIdentity`, so `enforceLatchedProof` fails open and M1/M3 create the shadow node and merge it | Medium | **AID-006** → **closed by mandatory proof (T3.1a/T3.1b/T3.2)**; no migration, no item of its own | **No backfill.** Derived ids are lowercase by construction — `deriveClientIdFromHash` emits through `bytesToHex` (`canonical.ts:177,187-189`) — so mixed case can only arrive from a caller, and mandatory proof closes that dodge: `IdentityProofService.ts:145` lowercases **both** sides of the comparison and the caller must hold the key. Normalising `anonymous_fingerprint` on write is still available as a **no-backfill hygiene item**; it is not a security fix and must not be shipped with a destructive `UPDATE` |
| **G9** | M13, M14, M-x3 | Permanent squat of any un-claimed email (global unique slot), denial of the real owner's verification, and an email → `{wallet, authenticatorIds}` disclosure | Medium | untracked → **out of scope for this programme, filed separately** (plan §9) | Never write an email node before verification; gate the `merge` disclosure on `verifiedAt !== null`. Product decision already taken: keep the address pending, prompt informationally on the wallet home page, invite verification from the profile page |
| **G10** | M6 | The listener posts `/merge/execute` with a URL-param `clientId` and **no proof**, and the trust gate that unlocks it is self-asserted from the same untrusted postMessage | High | untracked → **T3.4** | Delete the `iframeClientId ?? clientIdStore` fallback (and fix the proven-id branch that also sends no proof); resolve `allowedDomains` server-side |
| **G11** | M4 | Listener-modal and embedded-wallet ids **can never latch**, because the wallet origin holds no key — this is what keeps the latch permanently fail-open for them | High | `TODO(merge-initiate-proof)` → **T2.3** (plumb the proof), then **T3.11** (refuse without it) | The SDK signs an empty-binding `frak-merge-v1` and carries it on `resolved-config` as `proofs.mergeSource`, re-pushed fresh on `visibilitychange`; the listener stores the latest and mints the token lazily, only when an embed or the toast displays (plan §2.1). Then it refuses locally when no proof is present — strictly cheaper than a backend 403: same `null` result, no round trip, no rate-limit burn |
| **G12** | M2, M-x1 | The wallet-originated share → install chain is keyless end to end with a caller-named id, which is what makes a proof-mandatory `generate` impossible today | High | **AID-001**'s client half → **T2.5** | Gate 2 (order-derived credential) + carry `checkoutToken` through `/sharing` → `/install`, where `SharingView.tsx:98` currently drops it |
| **G13** | M6, M19 | `?fmt=` is consumed from the page URL with nothing attesting who minted it; a link on any page folds the visitor's group into the attacker's | Med-High | **AID-012** (adjacent) → **T3.1a** for the source half; the minting-context binding unowned | Bind the token to its minting context; refuse a token whose source group is unrelated to the presented merchant |
| **G14** | M9 | Redirection of a real, HMAC-signed order's attribution, its referral chain and its `asset_logs` to a buyer-chosen group — and it **beats** the SDK claim when the webhook lands first | High | no owner — separate plan; the Magento instance is recorded nowhere else | Resolve-only against a group that already proved that id, else hold the purchase; never create a node; never adopt a wallet-bearing group |
| **G15** | all | Group membership **is** the payout instruction: 60-day accrual backlog, hourly settlement, no lockup that bounds an attacker. This is what turns every row above into money | High | untracked → **out of scope for this programme, filed separately** (plan §9) | Bind `asset_logs` to the wallet resolved at reward creation, or quarantine settlement after a group's first wallet node appears. Assessed as the **highest value-per-unit-of-risk item on the table** and therefore given its own plan rather than a row in this one |
| **G16** | M8 | `const merge = params.merge ?? true` — the safe behaviour rests on one call site remembering `merge:false` | Low-Med | untracked → **T1.3** (= **B2**) | Make `merge` a required param. Keep the arms: with the param required they are dead-but-typed, still covered by two tests, and deleting them is strictly easier once the type change has proved there is exactly one caller |
| **G17** | M7 | Mass manufacture of nodes with `proof_seen_at` NULL for arbitrary caller-named ids — the permanently-latch-open population every other gap feeds on. A `GET` writes | Medium | no owner — with G18 | Do not create nodes on unattested attribution paths; resolve-only and return `{isReferred:false}` rather than 404. Move the in-memory limiter to Redis (it multiplies by replica count). **Note the interaction with B1:** the naive B1 fix — materialise the anon node inside `resolveForAttribution` — would make this gap strictly worse, which is why B1 is fixed in the credential path instead |
| **G18** | M10 | Permanent installation as referrer-of-record for a victim's group, with **no merge at all**, collecting on every future purchase | Medium | no owner — its own plan | A possession check on the referee, or a signed share token on the referrer. Harder than anything in the merge programme; must not be folded into it |
| **G19** | M-x1, M-x2, M-x3 | The harvesting step. Two unauthenticated `anonymousId` oracles plus an email oracle, and the three identity limiters may be collapsing into one Elysia bucket | Medium | **AID-007** → **T1.5** (limiters), **T3.7** (`resolve` body); oracle scoping unowned | Distinct `seed`/`maxRequests` per limiter; scope `order-client`; drop `anonymousId` from the `resolve` **response** body; drop `wallet` from `emailStatus` |
| **G20** | M8 | Pre-claiming: `claimPurchase` writes a claim row for an order that does not exist yet, so claims can be sprayed against guessed `(orderId, token)` and lie in wait. `customerId` is never compared at redemption | Medium | untracked → **accepted risk, this round**; bounded by Gate 2's resolved-first ordering | What it actually buys today is **purchase-attribution theft**, not identity takeover: the chain forged-claim → `/sharing` → `/install` is dead at step 2, because `order-client` reads the `purchases` table only (`orderClient.ts:37-43`) and cannot see a claim row. It also grants nothing `install-code/generate` already grants to anyone who knows the id. Gate 2 prefers a webhook-resolved purchase over a claim, which closes the real-order class; the fabricated-order class needs a claim-age bound, and that must land **before** T3.3 tightens `generate` |
| **G21** | M11, M12 | A captured login request body is a permanent session-minting capability (no server nonce, no `signCount`); wallet JWTs are 30 days with no `jti` and no revocation, and `/auth/logout` does not touch them | Medium | untracked → no owner | Server-issued single-use challenges; verify and persist `signCount`; `jti` + revocation set |
| **G22** | M5 | The "wallet session" that authorises `/merge/initiate` may be the **SDK JWT**, which is deliberately handed to merchant page JS and stored in merchant-origin `sessionStorage`. `scopes:["interaction"]` is written and never read | Medium | untracked → no owner | Enforce scopes in `resolveWalletOrSdkSession`; require `x-wallet-auth` on that arm |
| **G23** | M4, M6 | Manufacture of unprovable ids: a `localStorage` quota error deletes a valid key and the next visit treats the user's own derived id as legacy; `getMergeToken` signs over `metadata.merchantId ?? ""` so the only proofed `initiate` arm silently degrades to the proofless one | High | **AID-004**, **AID-009** → **T1.6**, **T1.7** (in that order) | Narrow the catch to key load/parse/keygen; `await sdkConfigStore.resolveMerchantId()` |
| **G24** | M3 | A 30-day `frak-install-v1` left in the URL lands in nginx logs, history and `document.referrer` — the install-side twin of AID-008 | Medium | untracked → no owner; ride the client release | `history.replaceState` immediately after `resolveInstallProof`, for both the fragment and the search param |
| **G25** | all merge rows | `weightCache` is not invalidated on wallet attach, so `WALLET_CONFLICT` can read stale state and two wallet-bearing groups can merge — widening every capture above | Medium | **AID-010** → **T2.8** | Invalidate weight on wallet attach, or read `hasWallet` live |
| **G26** | M-x4 | An identity merge transfers `merchants.owner_wallet` and `merchant_admins`. `linkWalletToFingerprint` wraps everything in `try/catch` and only `log.error`s, so a `WALLET_CONFLICT` at login — *someone else already claimed this id* — is indistinguishable from a DB hiccup | Medium | untracked → **T1.2** | Distinct counter/alert on the conflict branch (`ensure.ts` already does this properly); review whether merchant ownership should move with an identity merge at all |
| **G27** | M6 | The legacy anonymous node survives migration as a permanently unlatched alias pointing at a now-proven group, so `enforceLatchedProof` fails open on it forever | High | **AID-005** → **closed by the flips; no dedicated work, no owner needed** | **Nothing to build.** The node is repointed rather than deleted on purpose, so published `fCtx` links keep resolving — but once a route requires a proof, *naming* that legacy id requires a proof **for** it, which nobody can produce. The alias goes from freely claimable to unclaimable, piecewise as each arm flips (T3.1a, T3.2, T3.3, then T3.1b). No new column, no semantic change, nothing written onto a legacy node. A `frak-migrate-v1` proof would **not** help: it is signed by the *new* key and attests nothing about the keyless legacy id |
| **G28** | M17 | `GET /pairings/find/:id` is unauthenticated and returns `pairingCode`, so a leaked `pairingId` lets an attacker join a victim's desktop pairing with their own wallet — session fixation, **no graph effect** | Low | untracked → **T2.9** | Require `withWalletAuthent` and **keep** returning `pairingCode`: the wallet auto-fills that code today, so dropping it would force the user to type it |

### Correctness defects

Not admission gaps — an attacker gains nothing. They are first-class work items anyway, because one
of them silently kills the conversion path this whole surface exists to serve.

| ID | Merge point | What breaks | Sev | Owner | Fix |
|---|---|---|---|---|---|
| **B1** | M7, M-x2 | `resolveForAttribution` anchors on the wallet node (`IdentityOrchestrator.ts:183`) and resolves **only** that node, so the merchant-scoped `anonymous_fingerprint` node is never created for a wallet-bearing caller. Every client sends `x-wallet-sdk-auth` and `x-frak-client-id` together when a session exists (`checkout-web-pixel/src/index.ts:44-49`, `trackPurchaseStatus.ts:65-74`, `backendClient.ts:32-38`), so this is the **majority** path, not a tail case. `order-client`'s third step 404s (`orderClient.ts:45-55`), `useSharingIdentity.ts:32-52` retries 5× and yields `undefined`, and `SharingView.tsx:96-99,148-152` renders the install CTA as a **dead button** — silently, with no error and no telemetry | Med-High | **T1.12** | Materialise the node in the **Shopify credential path only** (Gate 2, T2.5), with a server-minted id. Doing it inside `resolveForAttribution` would fix the 404 by writing a caller-named, unauthenticated node on every `track/*` request — a G17 regression, and it breaks the write-discipline invariant pinned at `IdentityOrchestrator.test.ts:86-93`. Ship it **with** a deterministic `orderBy` on `findAnonymousFingerprint` (`IdentityRepository.ts:195-207` is an unordered `findFirst`), or a group holding two anon nodes returns a nondeterministic id |
| **B2** | M8 | `const merge = params.merge ?? true` (`PurchaseLinkingOrchestrator.ts:87`) is a dangerous default with **zero** callers relying on it — `PurchaseWebhookOrchestrator`, the class its doc block at `:14-21` names, never calls `claimPurchase` at all. The three `merge:true` arms are three distinct takeover primitives: group merge from an unauthenticated route (`:91-95`), last-claim-wins rebinding (`:130` → `PurchaseClaimRepository.ts:38-50`), and theft of an already-attributed purchase (`:162-190`) | Med now, **Critical on first mistake** | **T1.3** (= G16) | Make `merge` required. Compile-enforced, zero production behaviour change, and it removes the footgun entirely without touching the arms |

**Who owns the work.** Every "→" above points into `MERGE-ADMISSION-PLAN.md` §6, which carries the
file list, LoC, release requirement, prerequisite and proof of UX-neutrality for each item. Gaps
marked *no owner* are real and unscheduled: G14 and G18 (each needs its own plan), G17, G21, G22 and
G24. Gaps marked *accepted risk* (G7, G20) and *out of scope, filed separately* (G9, G15) are
decisions, recorded in the plan §9 and §10 — not omissions. Buckets A–C close no admission gap on
their own: G1, G3, G10, G11, G12 and G2's source half need a **bucket-D** flip, all of which ship now
or shortly; only G2's target half needs **bucket E**, and only because `/merge/execute`'s subject is
the legacy id. G27/AID-005 has no item at all — it closes as a side effect of those flips.

### Per-gap detail

Only for gaps where a line is not enough.

**G1 — `/identity/ensure`'s bare wallet variant.**
*Fix:* delete `:78-88` and the `x-frak-client-id` fallback at `:213-225`. **Do not delete the whole
arm:** `:105-120` verifies a real `frak-install-v1` and latches it, and it is the only landing site
for Keystore- and Secure-Enclave-signed native installs and the Play install referrer (M20), which
reach `ensure` directly and never touch `install-code/generate`. Make that branch mandatory instead.
Short term, alert on every wallet-arm ensure whose anon node is already latched.
*The blocker is not the store binary.* The binary is propagated. The live proofless caller is the
wallet's own `/sharing` → `/install` hop, which is **structurally** incapable of presenting either
credential (`SharingView.tsx:94-99`, in-file: *"this page has no SDK keypair to sign with"*), plus
the unmarked header fallback at `:213-225`, plus a 7-day pending-action replay window
(`pendingActionsStore.ts`, TTL `INSTALL_TICKET_TTL_MS` = 7 days). Smallest fix, KISS: stop
`SharingView`/`routes/sharing.tsx` forwarding `a=` when it holds no credential for it —
`buildInstallProcessingEnsureAction` (`params.ts:85`) then returns `undefined` and no ensure fires.
Cost: one failsafe self-link that `ensureIdentity` already covers, proof-carrying, from the merchant
origin. **SUSPECTED near-zero; worth one metric before committing.**
*Backend-only:* no — the wallet's pending-action queue carries a bare `anonymousId` for up to 7 days,
and the sharing-page change is a wallet edit. *Migration:* none.
*Does NOT close:* M6's anonymous-source arm, M1's unbound proof, or anything in the attribution
domain. Latch-gating the variant instead of deleting it would be worse than useless: it 403s an id
that latched via the SDK and then installs through the **proofless** wallet `/sharing` link, which is
a live journey, while remaining trivially bypassable by an id that has never latched.

**G2 — `/merge/execute` admits unlatched existing targets.**
*Fix:* `proof` required on `execute` **and** on `initiate`'s anon-source arm in the same deploy. The
body ids stay on the wire; `IdentityProofService.check` already rejects `id_mismatch`, so requiring
the proof buys what removing the field would buy and does not break the published native SDKs.
*Backend-only:* yes. *Client release:* no, for either flip. `initiate`'s arm (T3.1a) waits only for
the listener to carry a proof and then refuse without one (G11, T2.3, T3.11); `execute` (T3.1b) waits
for the legacy population. *Migration:* no.
*Not a fix:* "require a target proof when the token was minted from a wallet session". `merge.ts:19-24`
passes both `sourceAnonymousId` and `sourceWalletAddress`, so an attacker with their own proven id
never trips the branch. Ship it as an alarm (T2.2), not a gate.
*Does NOT close:* nothing rescues the legacy-migration shape — `migrateLegacyIdentity.ts:82-96` sends
no proof on `execute` and no client can produce one for a keyless id, so every remaining migration
403s on flip day. That is bucket E's accepted write-off, gated on
`merge_execute_credential{class=absent_unlatched}` ≈0 and never on a date. It also does not touch M3,
which reaches the same outcome in one call.

**G3 — install-ticket laundering.**
*Fix:* the credential class is decided synchronously at `generate` — `{merchantId, anonymousId, proof}`
or Gate 2's `{merchantId, checkoutToken}` — a bare `anonymousId` is rejected 400, and the code becomes
single-resolve with a **1–2 hour** ticket.
*Backend-only:* the `generate` flip needs the wallet to carry `checkoutToken` from `/sharing` to
`/install`, and the codeless-CTA degradation must ship in the same wallet release or an earlier one.
*Migration:* Gate 2's deferred-resolution schema (nullable `anonymous_id`, `checkout_token`).
*Does NOT close:* a **stolen code** is still a capture of that id — mandatory proof changes the
attack from targeted to untargeted keyspace enumeration, and only the ticket-lifetime work caps it.
Treat T3.5/T2.6 as a hard prerequisite of the flip, not a parallel track. A **1–2 hour window is the
accepted position**, not single-use: single-use races the passkey ceremony (the ticket is minted when
the code is pasted and drained after authentication) and contradicts an in-file invariant at
`jwt.ts:56-57`.

**G7 — `initiate`'s unfilled binding.**
*Fix:* not the one that reads obvious, and **not attempted this round**. Binding the proof to
`SHA-256` of the token being minted is impossible as usually stated: the client signs **before** the
request, and the token does not exist until after `enforceProof` runs
(`AnonymousMergeOrchestrator.ts:123` vs `:165`). It needs a server-issued nonce fetched first, or a
two-phase mint — a new route shape and a round trip on the modal path.
*Decision:* accepted as-is. The 10-minute window is short, and exploiting it requires capturing a
live proof — a sniffing or phishing attack, categorically more sophisticated than the caller-names-an-id
attack this programme closes. Revisit only if the modal round trip becomes free for another reason.
*Does NOT close:* nothing else depends on it; T3.1a makes the proof mandatory without filling the
binding, and says so.

**G8 — case normalisation on the latch read.**
*Fix:* **none required, and no backfill.** `deriveClientIdFromHash` builds the id from `bytesToHex`
(`canonical.ts:177,187-189`), which emits lowercase hex, so no client can produce a mixed-case
derived id. A mixed-case id therefore only ever arrives from a caller choosing to send one — which is
exactly the dodge mandatory proof removes: `IdentityProofService.ts:145` lowercases both sides of the
comparison and the caller must hold the key to get past it.
*If normalisation on write is still wanted*, it is a **hygiene** change — add `anonymous_fingerprint`
to `normalizeValue` and ship **no** `UPDATE`. It must not be sold as a security fix, and it must not
carry the destructive backfill the earlier draft specified: `identity_nodes_unique_identity` is on
the raw value (`domain/identity/db/schema.ts:80-82`, `nullsNotDistinct`), so a collision is a node
*merge*, not an `UPDATE`, and that is a data migration this programme is not taking.
*Does NOT close:* nothing depends on it either way.

**G10 — the listener's unproven merge target.**
*Fix:* delete the `fallbackId ?? undefined` branch and require `sdkIdentity.anonymousId` **plus** the
execute-side proof (`sdkIdentity.proofs.mergeExecute`, renamed from `proofs.merge` by T2.3), dropping
the merge silently when either is missing — and fix the proven-id branch at
`lifecycleHandler.ts:225-231`, which also sends no proof when that key is absent while `anonymousId`
is present. Separately, have the listener
resolve the merchant config itself and gate on the backend's `allowedDomains` rather than the
caller's copy.
*Backend-only:* no — listener release. *Migration:* none.
*Does NOT close:* the backend still accepts unproven targets from any other caller; this removes one
client, not the admission policy. Anything whose `resolved-config` payload predates `sdkIdentity`
loses the in-app-browser escape permanently; that population is assumed empty (everything points at
`@latest`) but is unmeasured until `merge_execute_target_source{proven,fallback}` ships, which is why
T3.4 gates on that counter and not on a date.

**G11 — the listener can never sign, and can refuse instead.**
*Fix:* the listener URL is built unversioned — `` `${walletUrl}/listener` `` (`iframeHelper.ts:119-120`)
— so **every** SDK version, including the oldest, loads the *current* listener deployment. A listener
change therefore reaches 100% of embedded merchant pages on the next wallet web deploy, in minutes,
independent of merchant SDK version. That is the propagation property the store binary lacked and now
has, and it makes local refusal (T3.11) strictly better than a backend 403: identical `null` outcome
(`useOnGetMergeToken.ts:21` already returns `null` on missing context; `Banner.tsx:197-204` redirects
without a token; `iframeLifecycleManager.ts:85-92` omits `?fmt=`), but zero round trips, zero logged
403s and zero rate-limit burn (`merge.ts:8`, 20 req/min).
*Measure first:* T1.13 counts proofless calls at both listener call sites before anything refuses.
`mergeTokenQueryOptions`'s "no production merchant today" claim is undated and unmeasured; the counter
exists so flip day does not rest on an assertion.
*Mint lazily:* the token is minted only when an embed or the in-app-browser toast actually displays,
never on init — a token per init is an unconsumed 60-minute bearer credential (G4/AID-003) plus
backend load for nothing. Signing is cheap; minting is not.
*Do not "carry a proof" locally — carry the SDK's:* `signProof` and `frak-client-key` grep to **zero**
hits across `apps/**` and `packages/**`. The key is in merchant-origin `localStorage`; the listener
runs on the wallet origin. Reusing the existing `sdkIdentity.proofs.merge` would 403 — that one binds
`SHA-256(mergeToken)` and is the **execute**-side proof, which is why it is renamed
`proofs.mergeExecute`. T2.3 adds a second, empty-binding `proofs.mergeSource` next to it, re-pushed
fresh on `visibilitychange` — free, because `sendLifecycleConfig` is already sent twice and chained
(`createIFrameFrakClient.ts:498-503`) with last-write-wins on the listener. No new `ProofOp`, no
window change, no golden-fixture regeneration.

**G14 — buyer-writable purchase identity.**
*Fix:* demote the cart attribute to resolve-only against a group whose node already has
`proof_seen_at IS NOT NULL`, else store the purchase `pending_claim`. At minimum: never create a
node, never adopt a group holding a wallet node, and let a later wallet-JWT-backed claim repoint a
cart-attribute-attributed purchase. Long term the attribute carries a merchant-scoped MAC issued by
the SDK.
*Backend-only:* the minimum is backend-only. The MAC needs a theme-block and plugin release across
Shopify and Magento. *Migration:* none for the minimum.
*Does NOT close:* the Shopify checkout token remaining a cross-domain URL query param, or the
`order-client` oracle it unlocks (G19).
**SUSPECTED and unresolved outside this repo:** whether Shopify's `/cart/update` accepts a
cross-origin form POST. If it does, this stops being self-attribution and becomes theft of arbitrary
victims' purchase attribution from any attacker-controlled page.

**G15 — group membership is the payout instruction.**
*Fix:* bind `asset_logs` to the wallet resolved at reward creation, or gate settlement on a quarantine
window after a group gains its first wallet node, plus an alert when a group holding ≥ X pending
rewards is joined.
*Backend-only:* yes. *Client release:* no. *Migration:* a column on `asset_logs` if the first option
is taken.
*Does NOT close:* any admission gap. It is the amplifier, and it is worth fixing **even if every
merge gap closes**, because it is what makes the 60-day backlog claimable in one shot and what makes
waiting profitable for an attacker.
*Status:* **out of scope for this programme, filed separately.** It was assessed as the highest
value-per-unit-of-risk item on this map, and that is precisely why it gets its own plan with its own
blast-radius analysis rather than a row inside an admission-control programme.

**G19 — the oracles and the limiter.**
*Fix:* give each identity limiter a distinct `seed`/`maxRequests` so they cannot collapse into one
Elysia bucket; scope `order-client` to an authenticated merchant/webhook context; remove
`anonymousId` from the `install-code/resolve` 200 **response** body; drop `wallet` from the
`emailStatus` response (the UI needs only `authenticatorIds`).
*Backend-only:* yes, except the `resolve` response change — `ResolveResult.anonymousId` is a
**required** field in the shipped Tauri binary's typed result, and the current wallet still reads it
deliberately "so the store remains readable by a rolled-back build". The wallet must stop reading it
before the backend stops sending it: two wallet deploys, **no SDK involvement**. *Migration:* none.
*Does NOT close:* anything on its own. It raises the cost of the harvesting step; every capture route
still works against an id obtained any other way, and every published `?fCtx=` link contains one.
**Not verified:** whether the three limiters share a bucket or the second hook simply never runs.

**B1 — the missing anonymous node.**
*Fix:* materialise it in Gate 2 (T2.5's ladder), never in `resolveForAttribution`. The value is a
**server-minted UUID**: it cannot be pre-claimed because it does not exist until the server mints it,
whereas `x-frak-client-id` is caller-supplied and forgeable — that forgeability is the premise of the
two regression tests at `IdentityOrchestrator.test.ts:68` and `:102`.
*What the broad fix would break, concretely:* `IdentityOrchestrator.test.ts:88-90`
(`toHaveBeenCalledTimes(1)` → `2`), the invariant comment at `:86-87`, and the doc block at
`IdentityOrchestrator.ts:171-174`. Two of those state a **write-discipline invariant** that is real
and load-bearing — it is the one place in the tracking surface that refuses to write a caller-named
node. The security invariant (attribution lands on the caller's own anchor, `mergeGroups` never
called) would survive either way; the write-discipline one would not.
*Ship with it, not after it:* `findAnonymousFingerprint` (`IdentityRepository.ts:195-207`) is a
`findFirst` with no `orderBy`. Once a group can hold two merchant-scoped anon nodes — the buyer's real
id from a later proofless visit plus the server-minted one — the id returned to `/sharing` is
nondeterministic across queries. Both mitigations are cheap and both should be taken: mint only when
the lookup returns none, in the same unit of work, and add `orderBy: asc(createdAt)`, matching the
pattern `getWalletForGroup` (`:170-178`) already documents.
*Not affected:* `install-code/resolve` looks the group up by id **value** (`installCode.ts:78-82`,
`findGroupByIdentity`), not by group.

---

## Coverage and residual

**Could not be established.**

- Whether Shopify's `/cart/update` Ajax endpoint accepts a cross-origin POST. This decides whether
  G14 is self-attribution or theft of arbitrary victims' attribution. Not answerable from this repo.
- Whether the three identity rate limiters share one Elysia bucket or the second hook simply never
  runs (AID-007). Needs a request-level test against the composed `identityApi`.
- Whether any production client emits a mixed-case `anonymousId`. G8's mismatch is structural and
  verified; its live blast radius is not known — and no longer needs to be, since the remediation is
  now "mandatory proof" rather than a migration.
- `IdentityWeightService#determineAnchor`'s tie-break was not traced. It decides who anchors after a
  hostile merge and therefore sets the blast radius of every capture in Q3.
- Whether the Shopify checkout web pixel's `localStorage` is sandbox-scoped or storefront-scoped. If
  sandbox-scoped, Gate 2's deferral path is load-bearing rather than a tail case.
- Whether a later organic merchant visit completes a deferred merge with no human action. Suspected
  to differ by platform — plausibly automatic on Chrome/Android via the listener's wallet session,
  plausibly impossible on iOS/Safari under storage partitioning.
- Whether cross-device install is a real journey. No route, param, string, doc or test frames the
  code as desktop → phone, and no telemetry distinguishes the cases.
- Whether any production merchant pins a CDN tag old enough to matter. **Decided rather than
  measured:** everything points at `@latest`, so the working assumption is that no old SDK version is
  live and the exposure is a 1–2 hour rollout deadzone — which is why the listener tolerates both
  proof key shapes for one deploy window instead of forever (plan §2.1). It stays unverifiable here:
  there is **no SDK version signal at the RPC boundary at all** — `sdkVersion` / `minVersion` across
  `apps/listener/**` returns one doc comment, and `packages/rpc` has no version field — so
  presence-of-proof (T1.13) remains the only measurement, and T1.10's header can never describe the
  population it would be sizing.
- Whether `mergeTokenQueryOptions` has a production merchant. Its own doc block says no; the claim is
  undated and unmeasured. It no longer gates anything — its proofless call is deleted outright by
  T2.3 — but T1.13 still counts it, so the deadzone can be watched draining.
- Whether the `proof_seen_at` migration is **applied** in every environment. The artefact exists
  (`services/bootstrap/drizzle/prod/0020_gigantic_black_crow.sql`, alongside `dev/0040` and
  `local/0035`); application is an ops check this repo cannot answer. If the column is missing
  anywhere, every proof-absent merge 500s.
- The live attribution cost of dropping `a=` from the wallet `/sharing` → `/install` hop (G1's
  smallest fix). SUSPECTED near-zero — the SDK arm covers the same link from the merchant origin,
  proof-carrying — but not measured.
- Commits `833c5a23d` and `6296ffe63` were not inspected directly; both were verified against the
  current tree state and their committed regression tests instead. `6ace7b678` and `5bf8e3d64` were
  not inspectable and are unreferenced in the tree.

**Inferred rather than verified.**

- G8's exploit chain (latch bypass by case, then shadow-node creation and merge on M1/M3) is
  **SUSPECTED**; the normalisation mismatch itself is verified, and so is the lowercase-by-construction
  property that makes the caller the only possible source.
- M8's "unreachable today" rests on a call-site grep: `claimPurchase` has one production caller and it
  passes `merge:false`; the other five hits are the unit test. A second caller reopens the row
  silently — which is exactly what T1.3 makes impossible.
- G14's ordering claim — that the webhook beats a wallet-JWT-backed SDK claim when it lands first —
  is read from `PurchaseLinkingOrchestrator`'s refusal to repoint, not observed in production.
- The rate-limiter dedupe reaching the auth routes (identical `name`+`seed` on `authRoutes`,
  `/identity/ensure` and `/wallet/referral/code`) is **SUSPECTED**; it depends on Elysia semantics
  not executed here.
- That a legacy id is not distinguishable from a derived one by shape is **SUSPECTED-strong**: a
  legacy id may well also be a UUID, and `sign.ts:88-97` treats any pre-existing `frak-client-id`
  value as legacy. There is no server-side discriminator, which is why no shape test can rescue a
  policy latch on caller-supplied ids.
- Whether path E — a host-embedded wallet page with no `returnScheme` — occurs in any live merchant
  configuration. The code path is confirmed; the deployment is not.

**Open after everything currently planned.** The plan is not total and does not claim to be.

- **M7, M10 — `/track/*` and referral-link planting (G17, G18).** Mandatory proof structurally cannot
  reach `/track/*`; it must stay usable by keyless clients. An attacker who enumerates client ids
  becomes referrer-of-record for a population with **no merge at all**. This needs its own plan and
  is a harder problem than anything in the merge programme.
- **M9 — buyer-writable purchase identity (G14).** Filed separately. Gate 2's Phase B residual leans
  on it staying bounded by `coalesce` first-writer-wins.
- **M13, M14 — email nodes (G9).** Out of scope for this programme and filed separately, with the
  product decision already taken (plan §9).
- **G15 — group membership as the payout instruction.** Out of scope for this programme and filed
  separately, as the single highest value-per-risk item on this map (plan §9).
- **The install ticket stays a bearer capability, for 1–2 hours.** Mandatory proof degrades AID-001
  from a targeted attack to keyspace enumeration; the TTL cut caps it; single-use is not taken.
- **The merge token stays replayable inside its window (G4)**, and `initiate`'s binding stays empty
  (G7). Both accepted; both require capturing a live credential first.
- **Forgeable purchase claims (G20) and forgeable checkout tokens.** Accepted. Gate 2's resolved-first
  ordering closes the real-order class; the fabricated-order class is bounded only by the fact that
  `install-code/generate` already grants strictly more to anyone holding the same id.
- **`install-code/generate` remains a complete latch bypass for any known `anonymousId`** until T3.3.
  It dominates the forged-claim chain, and it is the reason G20's acceptance is not "the chain is
  safe".
- **Permanently unprovable ids, on `/merge/execute` only.** Legacy and non-UUID-shaped ids can never
  sign, and the client id is never one of them — it is flipped to the derived id before the iframe
  exists (`migrateLegacyIdentity.ts:10-13`). The exposure is the migration *target*: under mandatory
  proof those ids can never be a merge target again and the group becomes unpayable rather than merely
  unattributed. The tail is **permanent** — an id only migrates when its user returns — so the flip is
  gated on `merge_execute_credential{class=absent_unlatched}` ≈0 and never on a date, and firing it is
  the moment the remainder is written off. That is a human decision (plan OQ1, bucket E).
- **Gate 2 admits ids that have a key.** A Shopify buyer whose merchant also runs the web SDK holds a
  key-holding id that Gate 2 admits without a signature. Recommended as acceptable, not as closed
  (plan OQ2).
- **The latch is not retired in this round.** `proof_seen_at` stays; retirement is a later round with
  a stated precondition (plan §4, DB6).
- **Audit findings deliberately out of this map's scope**, because they are client reporting and
  hygiene rather than merge admission: AID-011 (`WALLET_ALREADY_LINKED` unreportable on standalone
  `/install`), AID-013 (no cross-merchant proof test; the property holds), AID-014 (doc drift on
  every validity window), AID-015 (envelope version byte unsigned), AID-016 (doomed 4xx retried for a
  week).
