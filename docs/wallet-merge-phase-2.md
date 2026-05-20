# Wallet Merge — Phase 2: Cross-Device Flow

> **Status:** Design draft. Phase 1 (same-device fast path) ships first; this document covers the Phase 2 cross-device path where wallet A is on one device and wallet B is on another.

## Goal

A user is signed in on **Device X with Wallet A** and types an email that is already attached to **Wallet B** (a different smart-account address controlled by a different passkey, likely on **Device Y**, typically the same person who has two wallets). We need to:

1. Establish a side-channel from Device X to Device Y that does **not** swap Device X's session.
2. Ensure Device Y is authenticated specifically with **the passkey associated with the email** (not whatever other passkey the user might be using on Device Y).
3. Show the user a dry-merge preview.
4. Have the **winner's owner** sign the `addPassKey` userOp on their own device.
5. Finalise the merge in the backend (libSQL repoint + PG identity merge).

This document describes only Phase 2. The on-chain primitive (`multiWebAuthNValidatorV2.addPassKey`), the backend `IdentityMergeService` extensions (push_tokens / asset_logs pending / referral_codes conflict), the `WalletMergeOrchestrator.settle`, the libSQL `repointBinding` repository method, and the postgres-resident `identity_nodes` email storage are all shared with Phase 1 and assumed to already exist.

---

## Core idea

Reuse the existing pairing flow with **two small additions**:

1. A new pairing **`kind`**: `"remote-sig"` (alongside today's implicit `"session"`).
2. A new pairing field **`target_authenticator_hint`**: the credential ID the target device MUST be authenticated as in order to join.

In `remote-sig` mode:

- The origin keeps its existing session (no `distant-webauthn` JWT is ever issued).
- The pairing WS becomes a one-shot RPC channel between Device X and Device Y.
- The target device, before joining, verifies its current session matches the hint. If not, it offers to switch passkeys (with a primitive to restore the previous session after).
- After both sides have computed the preview, the **winner's device** signs and submits the on-chain `addPassKey` userOp **using its own wagmi client** — there is no signature round-trip across the pairing. The pairing carries the **intent + parameters**, not a hash to sign.

This last point is the simplification over earlier drafts: the device that has the winning passkey is the device that submits the transaction. We avoid round-tripping a userOp hash + signature across the WS.

---

## Glossary

| Term | Meaning |
|---|---|
| **Wallet A** | The smart-account address tied to the passkey currently active on Device X. |
| **Wallet B** | The smart-account address tied to the passkey associated with the email the user just typed. Likely on Device Y. |
| **Loser** | The wallet whose passkey gets added to the other wallet's `multiWebAuthNValidatorV2` and whose backend data migrates. |
| **Winner** | The wallet that survives — receives the loser's passkey as a co-signer and absorbs the loser's identity-graph data. |
| **`authId_X`** | The base64url WebAuthn credential ID for the passkey on wallet X. |
| **Hint** | The `target_authenticator_hint` value persisted on the pairing row — the credential ID the joining session must match. |

The winner is determined by `IdentityWeightService.getGroupWeight` with `createdAt` as tiebreaker (older wallet wins). Result is snapshotted into the preview, frozen until merge completes.

---

## State diagram

```
            ┌──────────────────────┐
            │ idle (no merge)      │
            └──────────┬───────────┘
                       │ user types conflicting email
                       ▼
            ┌──────────────────────┐
            │ initiating-pairing    │ ← desktop calls initiateRemoteSig
            └──────────┬───────────┘    backend creates device_pairing
                       │                  (kind=remote-sig, hint=authId_B)
                       ▼                  emits pairingCode + originResumeToken
            ┌──────────────────────┐
            │ awaiting-target       │ ← QR shown, status=connected
            └──────────┬───────────┘
                       │ mobile scans, authenticates as authId_B
                       │ (auto if matches, or via switch-passkey flow)
                       │ mobile sends action=join with matching session
                       │ server validates hint match → emits "remote-sig-paired"
                       ▼
            ┌──────────────────────┐
            │ paired                │ ← both devices now exchange messages
            └──────────┬───────────┘    desktop fetches preview
                       │ desktop sends "merge-proposal" message with
                       │ all required data (instructions, addresses, preview)
                       ▼
            ┌──────────────────────┐
            │ awaiting-confirm      │ ← mobile shows preview, biometric
            └──────────┬───────────┘
                       │
        ┌──────────────┴────────────────┐
        │                               │
        ▼                               ▼
  winner = A                      winner = B
  desktop signs locally            mobile signs locally
  (wagmi useSendTransaction)       (wagmi useSendTransaction)
  → submits addPasskey userOp      → submits addPasskey userOp
  → polls receipt                  → polls receipt
  → calls /merge/settle            → calls /merge/settle
  → backend runs orchestrator       → backend runs orchestrator
  → desktop shows success          → mobile shows success
                                   → desktop receives "merge-completed"
                                     event, double-checks with backend,
                                     shows success
        │                               │
        └───────────────┬───────────────┘
                        ▼
            ┌──────────────────────┐
            │ merged                │
            └──────────────────────┘
```

Failure transitions: any step can transition to `failed` with a `failure_reason`. The orchestrator is idempotent — a stuck `signed` or `settling` state is picked up by the existing pairing cleanup cron.

---

## End-to-end flow

### Step 1 — Desktop initiates the merge

**Trigger:** User is logged in on Device X as wallet A, no email attached. They open the AddEmail page (`/profile/add-email`) and submit an email already taken.

**Backend (`POST /user/wallet/auth/email`):**

```http
POST /user/wallet/auth/email
Body: { "email": "user@example.com" }

Response (conflict branch):
{
  "status": "conflict",
  "targetAuthenticatorId": "<base64url credId of authId_B>",
  "targetWallet": "0xAbC…"
}
```

**Desktop UI (`AddEmail` conflict branch):**

- Shows: "This email is already on another wallet of yours (`0xAbC…`). Want to merge?"
- "Start merge" button → calls:

```ts
originPairingClient.initiateRemoteSig({
  targetAuthenticatorHint: response.targetAuthenticatorId,
  targetWallet: response.targetWallet,
});
// → WS open: action=initiate&kind=remote-sig&targetAuthenticatorHint=<authId_B>
```

**Backend (`PairingConnectionRepository.handleInitiateRequest`):**

```ts
await db.insert(pairingTable).values({
  pairingId,
  pairingCode,
  originUserAgent,
  originName,
  kind: "remote-sig",                            // NEW
  targetAuthenticatorHint: targetAuthenticatorHint, // NEW
});
// emits "pairing-initiated" with { pairingId, pairingCode, originResumeToken }
```

**Desktop:**

- Receives `pairing-initiated`, persists `{ pairingId, pairingCode, originResumeToken, kind: "remote-sig" }` in sessionStorage (`frak_pairing_in_flight`).
- Navigates to `/merge/start` showing a QR code: `${FRAK_WALLET_URL}/p/${pairingId}` (existing QR pattern) plus the 6-digit code as fallback.
- Desktop session is **unchanged** — still wallet A.

### Step 2 — Mobile scans the QR

Mobile opens `/pairing?id=<pairingId>` (existing deep link, behind `_protected`). The pairing page fetches:

```http
GET /pairings/find/:id

Response:
{
  "id": "...",
  "originName": "Chrome on macOS",
  "createdAt": "...",
  "pairingCode": "123456",
  "kind": "remote-sig",              // NEW
  "targetAuthenticatorHint": "<authId_B>", // NEW
  "targetWallet": "0xAbC…"           // NEW
}
```

The pairing page branches on `kind`:

- `"session"` → existing `PairingPage` component (today's behavior).
- `"remote-sig"` → new **`MergeApprovalPairing`** component.

### Step 3 — Mobile resolves the authenticator

`MergeApprovalPairing` compares the current session's `authenticatorId` against `targetAuthenticatorHint`.

**Case A — match:**

The user is already logged in as wallet B on Device Y. Show the standard "Confirm pairing" UI with merge-specific copy ("Device X wants to merge a wallet into this one") + the 6-digit code for confirmation. On confirm:

```ts
await targetPairingClient.joinPairing(id, pairingCode);
```

**Case B — mismatch:**

Mobile is logged in as some other wallet on Device Y (the user has multiple passkeys). Show a "Switch passkey" modal:

> This action needs the passkey associated with `0xAbC…`. Sign in with that passkey to continue?
>
> [Cancel] [Switch passkey]

On confirm:

```ts
// 1. Save current session
sessionStore.getState().pushSession();

try {
  // 2. Force biometric prompt limited to authId_B
  await login({
    lastAuthentication: {
      authenticatorId: targetAuthenticatorHint,
      wallet: targetWallet,
    },
  });
  // sessionStore now holds wallet B's session
  // 3. Join the pairing with the new session
  await targetPairingClient.joinPairing(id, pairingCode);
} catch (err) {
  // Restore previous session if anything failed before join
  sessionStore.getState().popSession();
  throw err;
}
```

`pushSession`/`popSession` are new primitives on `sessionStore`. `pushSession` snapshots `{ session, sdkSession }` into a `previousSession` slot (persisted). `popSession` restores it without a new biometric ceremony — the previous JWT is reused as-is, valid as long as the backend hasn't expired it. If the JWT is rejected on the next request, the existing 401 handler clears the session and routes to `/register`. Acceptable degradation.

### Step 4 — Backend resolves the pairing

`PairingConnectionRepository.handleJoinRequest`:

1. Validates `pairingCode`.
2. **NEW:** Enforces the hint:
   ```ts
   if (pairing.targetAuthenticatorHint && wallet.authenticatorId !== pairing.targetAuthenticatorHint) {
     ws.close(WsCloseCode.FORBIDDEN, "Authenticator mismatch");
     return;
   }
   ```
3. Updates the pairing row: sets `wallet`, `resolvedAt`, `targetUserAgent`, `targetName`.
4. Branches on `pairing.kind`:
   - `"session"` → existing behavior: sign `distant-webauthn` JWT, publish `"authenticated"`.
   - `"remote-sig"` → **NEW**: publish `"remote-sig-paired"` to the origin topic. Payload contains only `{ partnerDevice, pairingId, targetWallet }` — no JWT, no session.

### Step 5 — Desktop receives `remote-sig-paired`

`OriginPairingClient.handleMessage` gets a new branch:

```ts
if (message.type === "remote-sig-paired") {
  this.setState({
    status: "paired",
    partnerDevice: message.payload.partnerDevice,
    pairing: undefined, // in-flight done, originResumeToken still authorises the WS
  });
  this.onPairingSuccess?.();
  // CRITICAL: no sessionStore.setSession()
  // CRITICAL: no forceConnect(reconnect()) — keep the WS alive on originResumeToken
  return;
}
```

Desktop's session is still wallet A. The WS stays open using the original `originResumeToken`. Desktop can now exchange merge-specific messages with mobile.

### Step 6 — Desktop computes & shares the merge proposal

Desktop calls:

```http
GET /user/wallet/merge/preview?pairingId=<pairingId>
Auth: origin-resume-token (in WS context) or webauthn JWT (in REST context)

Response: MergePreview
{
  "requesterWallet": "0xDeF…",       // wallet A
  "targetWallet":    "0xAbC…",       // wallet B
  "winner":          "0xAbC…",       // resolved by getGroupWeight + createdAt tiebreaker
  "loser":           "0xDeF…",
  "loserAuthenticatorId": "<authId_A>",
  "loserPublicKey":  { "x": "0x…", "y": "0x…" },
  "winnerAuthenticatorId": "<authId_B>",
  "winnerPublicKey":  { "x": "0x…", "y": "0x…" },
  "movedCounts": {
    "interactions": 7,
    "purchases": 2,
    "assetLogsPending": 3,
    "assetLogsSettled": 4,     // historical, NOT migrated
    "referralsAsReferrer": 5,
    "referralsAsReferee": 1
  },
  "conflicts": {
    "selfLoops": 0,
    "duplicateRefereeLinks": 0,
    "duplicateActiveReferralCode": false
  },
  "identitiesBeingMerged": [
    { "type": "wallet", "value": "0xDeF…" },
    { "type": "email", "value": "user@example.com" }
  ]
}
```

The preview is computed read-only in a `REPEATABLE READ` Postgres transaction. It is **the source of truth** for both devices during the rest of the flow.

Desktop shows the recap UI, and sends the proposal to mobile **via a new pairing message type**:

```ts
originPairingClient.sendMergeProposal({
  pairingId,
  preview,                         // entire MergePreview JSON
});
```

The new message:

```ts
// origin → server → target topic
{
  "type": "merge-proposal",
  "payload": {
    "pairingId": "...",
    "preview": { /* MergePreview */ }
  }
}
```

The backend forwards it like any other pairing message (no DB persistence needed for this one — it's a transient instruction). Persistence for replay-on-reconnect could be added later if mobile reconnects mid-flow; for now the desktop can resend on `remote-sig-paired` re-emission.

### Step 7 — Mobile shows the recap and confirms

`MergeApprovalPairing` receives the `merge-proposal` message and renders the preview:

> Confirm merge
> 
> Wallet `0xDeF…` will be merged into this wallet (`0xAbC…`).
> - 7 interactions
> - 5 referrals (as referrer)
> - 3 pending rewards will be redirected here
> - 4 historical rewards stay attributed to the original address
> 
> [Cancel] [Confirm merge]

On confirm, **mobile branches on `preview.winner`**:

#### Step 7a — Winner = Wallet B (mobile)

Mobile holds the winning passkey, so mobile does everything locally. The earlier framing — "mobile's transaction IS the consent" — was incomplete: B signing the on-chain `addPasskey` userOp only proves **B's owner** approved adding A as a co-signer to B. It says nothing about **A's owner**, whose identity graph (interactions, referrals, asset_logs, push tokens, email node) is the part being absorbed. Without A's consent, a malicious owner of B could craft this userOp against an unsuspecting A and have the backend hand A's identity graph over.

The unified Phase 1 consent design fixes this: mobile collects A's biometric over the merge-consent challenge **before** switching to B's session, then passes the assertion through to `/merge/settle` like any other caller.

Concretely, BEFORE the `pushSession` + `useLogin` step that switches to B (in Step 3 Case B), mobile collects the consent over A's credential — A is still the active session at that point:

```ts
// Still logged in as wallet A (loser) at this point — collect consent now
const expectedChallenges = buildMergeConsentChallengeSlots({
  winner: preview.winner,            // 0xAbC… (B, lowercased)
  loserAuthenticatorId: authId_A,
});
const loserConsentAssertion = await navigator.credentials.get({
  publicKey: {
    challenge: stringToBytes(buildMergeConsentChallenge({
      winner: preview.winner,
      loserAuthenticatorId: authId_A,
      hourSlot: formatMergeConsentHourSlot(new Date()),
    })),
    allowCredentials: [{ id: base64UrlToBytes(authId_A), type: "public-key" }],
    userVerification: "required",
  },
});
const loserConsentSignature = encodeCompressedAssertion(loserConsentAssertion);
// Stash for the settle call — survives the session switch
mergeFlowState.set({ loserConsentSignature });

// NOW switch sessions
sessionStore.getState().pushSession();
await login({ lastAuthentication: { authenticatorId: authId_B, wallet: preview.winner } });
```

Once mobile is on B's session, the rest of the local merge proceeds:

```ts
// useMergeFinaliseLocal hook (mobile-side, now as wallet B)
const { sendTransactionAsync } = useSendTransaction();

// 1. Build the userOp call data
const calldata = encodeFunctionData({
  abi: multiWebAuthNValidatorV2Abi,
  functionName: "addPassKey",
  args: [
    keccak256(toHex(preview.loserAuthenticatorId)),  // authId_A hash
    BigInt(preview.loserPublicKey.x),
    BigInt(preview.loserPublicKey.y),
  ],
});

// 2. Submit via the standard wagmi/permissionless smart-account hook
//    (whatever the existing useSendTransactionAction wraps)
const txHash = await sendTransactionAsync({
  to: WEBAUTHN_VALIDATOR_ADDRESS,
  data: calldata,
  // smart account: wallet B's address (current session)
});

// 3. Wait for receipt (already handled by the existing sendTransactionAction)
//    The hook resolves once the bundler confirms; if it fails, we get a thrown error.

// 4. Tell backend to settle — pass the stashed A-side consent signature
await authenticatedWalletApi.user.wallet.merge.settle.post({
  pairingId,
  onChainTxHash: txHash,
  loserConsentSignature: mergeFlowState.get().loserConsentSignature,
});
// Server-side: WalletMergeOrchestrator.settle()
//   - verifies loserConsentSignature against authId_A's public key + three candidate challenges
//   - verifies on-chain getPasskey returns the expected pubkey
//   - libSQL repointBinding(loserAuthId, chainId → winnerAddress)
//   - PG IdentityMergeService.mergeGroups(winner, loser, { migratePushTokens, ... })
//   - emits walletMerged event
//   - publishes "merge-completed" to the pairing's ORIGIN topic

// 5. Mobile shows success screen and proposes "log back into your other wallet?"
//    If previousSession was stashed: sessionStore.popSession() (or stay as wallet B — user's choice)
```

#### Step 7b — Winner = Wallet A (desktop)

Mobile holds the loser-side passkey (B), so mobile collects A-side… no — in this branch **B is the loser**, A is the winner. Mobile owns the loser's credential and must produce the consent assertion. On "Confirm merge", mobile builds the deterministic challenge from the preview, prompts B's biometric, and ships the resulting assertion to desktop:

```ts
// Mobile-side, still on wallet B's session (the loser)
const challenge = buildMergeConsentChallenge({
  winner: preview.winner,            // 0xDeF… (A, lowercased)
  loserAuthenticatorId: authId_B,
  hourSlot: formatMergeConsentHourSlot(new Date()),
});
const loserConsentAssertion = await navigator.credentials.get({
  publicKey: {
    challenge: stringToBytes(challenge),
    allowCredentials: [{ id: base64UrlToBytes(authId_B), type: "public-key" }],
    userVerification: "required",
  },
});
const loserConsentSignature = encodeCompressedAssertion(loserConsentAssertion);

// Send to desktop over the pairing
await targetPairingClient.sendMergeConsent({ pairingId, loserConsentSignature });
```

The `merge-consent` message still flows over the pairing WS, but the signed challenge is now the unified Phase 1 deterministic string — **not** the old `keccak256("frak-merge-consent" || pairingId)` framing:

```ts
// target → server → origin topic
{
  "type": "merge-consent",
  "payload": {
    "pairingId": "...",
    "loserConsentSignature": "0x…"   // WebAuthn assertion over
                                      //   frak-merge-consent:{UTC hour}:{winner_lowercased}:{loser authid}
                                      //   produced with wallet B's credential — proves B's owner approved
  }
}
```

Desktop receives `merge-consent`, then locally:

```ts
// useMergeFinaliseLocal hook (desktop-side)
const { sendTransactionAsync } = useSendTransaction();

// 1. Build userOp adding authId_B to wallet A
const calldata = encodeFunctionData({
  abi: multiWebAuthNValidatorV2Abi,
  functionName: "addPassKey",
  args: [
    keccak256(toHex(preview.loserAuthenticatorId)),  // authId_B hash (because A is winner, B is loser)
    BigInt(preview.loserPublicKey.x),
    BigInt(preview.loserPublicKey.y),
  ],
});

// 2. Submit via wagmi/permissionless from wallet A's session
const txHash = await sendTransactionAsync({
  to: WEBAUTHN_VALIDATOR_ADDRESS,
  data: calldata,
});

// 3. Tell backend to settle, passing the consent signature received over pairing
await authenticatedWalletApi.user.wallet.merge.settle.post({
  pairingId,
  onChainTxHash: txHash,
  loserConsentSignature,
});
// Server verifies loserConsentSignature against authId_B's public key over the three
// deterministic candidate challenges (current hour ±1h) before applying merge.

// 4. Desktop shows success screen
//    Backend publishes "merge-completed" to TARGET topic so mobile also shows success.
```

In **both** sub-cases the device that performs the on-chain transaction is the device that owns the winning passkey, using its own wagmi/smart-account client. **No userOp hash crosses the pairing channel.** The pairing only carries: the proposal (`merge-proposal`) and the loser's consent (`merge-consent`).

### Step 8 — Backend settles

`WalletMergeOrchestrator.settle({ pairingId, onChainTxHash, loserConsentSignature })` — consent is **always required**, regardless of which side wins, because the loser side always exists and always needs to approve being absorbed:

```ts
async settle({ pairingId, onChainTxHash, loserConsentSignature }) {
  const pairing = await pairingRepo.getByPairingId(pairingId);
  assert(pairing.kind === "remote-sig");

  const preview = await previewSvc.recompute(pairing); // or load stored snapshot

  // 1. Verify loser consent FIRST — cheap, no on-chain or DB cost
  const expectedChallenges = buildMergeConsentChallengeSlots({
    winner: preview.winner,
    loserAuthenticatorId: preview.loserAuthenticatorId,
  });
  const consentOk = await webAuthNService.verifyConsentSignature({
    compressedSignature: loserConsentSignature,
    expectedAuthenticatorId: preview.loserAuthenticatorId,
    expectedChallenges,
  });
  if (!consentOk) throw new MergeError("MERGE_INVALID_CONSENT");

  // 2. Verify the on-chain state (idempotent read)
  const receipt = await publicClient.waitForTransactionReceipt({ hash: onChainTxHash });
  if (receipt.status !== "success") throw new MergeError("user-op-reverted");

  const onChainPubkey = await readContract({
    address: WEBAUTHN_VALIDATOR,
    abi: multiWebAuthNValidatorV2Abi,
    functionName: "getPasskey",
    args: [preview.winner, keccak256(toHex(preview.loserAuthenticatorId))],
  });
  assert(onChainPubkey.x === BigInt(preview.loserPublicKey.x));
  assert(onChainPubkey.y === BigInt(preview.loserPublicKey.y));

  // 3. libSQL repoint (chain-scoped)
  await authRepo.repointBinding({
    credentialId: preview.loserAuthenticatorId,
    chainId: preview.chainId,
    toSmartWalletAddress: preview.winner,
    reason: "merged",
  });

  // 4. PG merge (single tx). The loser group's `identity_nodes` rows —
  //    including the email — move onto the winner group as part of the bulk
  //    node update inside `mergeGroups`. `findEmailForGroup` is ordered by
  //    `created_at ASC` so the winner's original email keeps winning even if
  //    the loser had one of its own.
  await identityMergeSvc.mergeGroupsByWallet(preview.winner, preview.loser, {
    migratePushTokens: true,
    migrateRecipientWallet: true,
    referralCodeConflict: "keep-winner",
  });

  // 5. Emit "merge-completed" to both pairing topics
  await pairingRepo.publishToBoth(pairingId, {
    type: "merge-completed",
    payload: { winner: preview.winner, loser: preview.loser },
  });

  // 6. Mark pairing as terminal so cron can clean it up
  await pairingRepo.markRemoteSigCompleted(pairingId);
}
```

Cross-DB safety is the same as Phase 1: each step is idempotent, so a crashed `settle()` is safely re-runnable by the reconciliation cron.

### Step 9 — Desktop double-checks and shows success

Desktop receives the `merge-completed` event over the WS. As a safety net, desktop also calls:

```http
GET /user/wallet/merge/status?pairingId=<pairingId>
Response:
{
  "state": "merged",
  "winner": "0xAbC…",
  "loser": "0xDeF…",
  "completedAt": "..."
}
```

If `state === "merged"`, desktop shows a success screen:

> Merge complete!
>
> Your wallet `0xDeF…` is now part of wallet `0xAbC…`.
> All your data has been migrated. The next time you log in with this device, you'll automatically be signed into the merged wallet.

Then desktop:

1. Closes the pairing WS (`originPairingClient.disconnect()`).
2. Clears the `frak_pairing_in_flight` sessionStorage entry.
3. Optionally proposes logging out and back in to refresh the session with the new wallet address. **Desktop's current `webauthn` session is still for the old wallet A address — its JWT is still valid but now points to a wallet that has been merged.** On next biometric login, the credential resolves to the new (winning) smart-account address automatically.

### Step 10 — Mobile cleanup

If mobile pushed a previous session in Step 3 (Case B switch-passkey), it offers:

> Sign back into your other wallet?
>
> [Stay signed in as the merged wallet] [Switch back]

"Stay" → leaves the current session, drops `previousSession`.
"Switch back" → `sessionStore.popSession()`.

Either way the merge itself is complete and durable in the backend.

---

## New message types

All messages flow through the existing pairing WS. The router (`PairingRouterRepository`) gains three new branches; all of them are simple forwarding with light validation.

| Type | Direction | Payload | Purpose |
|---|---|---|---|
| `merge-proposal` | origin → target | `{ pairingId, preview: MergePreview }` | Desktop tells mobile what's about to happen. |
| `merge-consent` | target → origin | `{ pairingId, loserConsentSignature }` | Loser's owner approves the merge. `loserConsentSignature` is a WebAuthn assertion over the deterministic challenge `frak-merge-consent:{UTC hour}:{winner_lowercased}:{loser authid}` (not the legacy `keccak256("frak-merge-consent" \|\| pairingId)` framing). Sent in both winner=A and winner=B flows — only the source of the assertion differs (collected on mobile pre-switch in winner=B, collected on mobile post-confirm in winner=A). |
| `merge-completed` | server → both | `{ winner, loser }` | Backend confirms the merge has settled. |

No new persisted table is required for Phase 2. The pairing row itself (with `kind = "remote-sig"`) is the canonical resource. Add one tracking column if needed: `device_pairing.merge_state` enum (`pending | proposed | consented | settling | merged | failed`). This is a nice-to-have for the admin dashboard; the orchestrator works without it because each step is idempotent.

---

## Surface area changes (Phase 2 only)

Phase 1 already lands: `kind` + `targetAuthenticatorHint` columns, the new email-conflict response shape (resolved via `AuthenticatorLookupOrchestrator.findByEmail`), `repointBinding`, extended `IdentityMergeService`, `WalletMergeOrchestrator.settle`, and the `identity_nodes` email storage. Phase 2 adds:

### Backend

| File | Change |
|---|---|
| `services/backend/src/domain/pairing/repositories/PairingConnectionRepository.ts` | `handleInitiateRequest`: persist `kind` + `targetAuthenticatorHint` from query. `handleJoinRequest`: enforce hint match; branch on `kind` (existing `"session"` path unchanged; new `"remote-sig"` emits `"remote-sig-paired"` with no JWT). |
| `services/backend/src/domain/pairing/repositories/PairingRouterRepository.ts` | Add `merge-proposal`, `merge-consent`, `merge-completed` forwarding branches. Relax the `wallet.type === "distant-webauthn"` check to also accept origin-resume connections when `pairing.kind === "remote-sig"`. |
| `services/backend/src/api/user/wallet/pairing/management.ts` | `GET /pairings/find/:id` returns `kind`, `targetAuthenticatorHint`, `targetWallet`. |
| `services/backend/src/api/user/wallet/merge/preview.ts` *(new)* | `GET /user/wallet/merge/preview?pairingId=...`. |
| `services/backend/src/api/user/wallet/merge/settle.ts` *(new)* | `POST /user/wallet/merge/settle` body `{ pairingId, onChainTxHash, consentSignature? }`. |
| `services/backend/src/api/user/wallet/merge/status.ts` *(new)* | `GET /user/wallet/merge/status?pairingId=...` for the desktop double-check. |
| `services/backend/src/api/user/wallet/auth/email.ts` | Conflict response gains `{ targetAuthenticatorId, targetWallet }`. |

### Frontend — `packages/wallet-shared`

| File | Change |
|---|---|
| `pairing/clients/origin.ts` | New `initiateRemoteSig(opts)`. New `handleMessage` branches: `remote-sig-paired` (no session write), `merge-consent` (resolves a promise on the desktop's hook), `merge-completed` (resolves the "wait for merge" promise). |
| `pairing/clients/target.ts` | New `handleMessage` branches: `merge-proposal` (sets state on the client, exposed via a hook), `merge-completed`. |
| `pairing/clients/base.ts` | `ConnectionParams` `"initiate"` branch accepts `kind` + `targetAuthenticatorHint`; encoded as plain query params. |
| `pairing/hook/usePairingInfo.tsx` | Surfaces the new fields. |
| `stores/sessionStore.ts` | New `previousSession` slot, `pushSession`, `popSession`. |

### Frontend — `apps/wallet`

| File | Change |
|---|---|
| `app/module/settings/component/AddEmail/index.tsx` | Conflict branch: shows a "Start merge" CTA wired to `originPairingClient.initiateRemoteSig`. |
| `app/module/walletMerge/component/MergeStartPage/` *(new)* | Desktop page: QR + status banner + preview + winner-side execution. Mounted at `/merge/start` (or as the conflict view of the AddEmail page — TBD). |
| `app/module/walletMerge/component/MergeApprovalPairing/` *(new)* | Mobile page rendered when `pairingInfo.kind === "remote-sig"`. Handles auth-match check, optional switch-passkey flow, preview display, confirm action. |
| `app/module/walletMerge/hook/useSwitchAuthenticator.ts` *(new)* | Wraps `sessionStore.pushSession` + `useLogin` + restore on failure. |
| `app/module/walletMerge/hook/useMergeFinaliseLocal.ts` *(new)* | Builds the `addPassKey` calldata, submits via wagmi, calls `/merge/settle`. Used by mobile (winner = B) and desktop (winner = A) symmetrically. |
| `app/routes/_wallet/_protected-fullscreen/pairing.tsx` | Branches on `pairingInfo.kind`: existing `PairingPage` for `session`, new `MergeApprovalPairing` for `remote-sig`. |
| `app/module/pairing/component/TargetSignatureModal/index.tsx` | No change for Phase 2. (`merge-proposal` doesn't go through this modal — it lives in `MergeApprovalPairing`.) |

---

## Failure modes

| Scenario | Behavior |
|---|---|
| Mobile cancels in the "switch passkey" modal | `popSession` restores the previous session; pairing not joined; desktop's `awaiting-target` state times out via the standard 10-min unresolved pairing cleanup cron. |
| Mobile cancels on the confirm screen | Mobile sends `signature-reject` (existing) or just disconnects; desktop transitions back to `awaiting-target` until user retries or cleanup fires. |
| Mobile's on-chain `addPasskey` reverts (winner = B) | Mobile shows error, does NOT call `/merge/settle`. Pairing stays in `paired` state until cron cleanup. Desktop never sees `merge-completed`. User retries the confirm action. |
| Desktop's on-chain `addPasskey` reverts (winner = A) | Same as above, swap roles. Consent signature stays valid for the pairing's lifetime — retry doesn't require re-prompting mobile. |
| `/merge/settle` called with a missing or invalid `loserConsentSignature` | 401 with `MERGE_INVALID_CONSENT`. Pairing stays in `paired` state, no on-chain read or DB write happens. Cross-references Phase 1's identical handling — the verifier is shared. UI re-prompts the loser passkey and retries. |
| `/merge/settle` succeeds on-chain verification but PG merge fails | Orchestrator marks pairing state, reconciliation cron retries. Each step idempotent. |
| `/merge/settle` succeeds but `merge-completed` push to topics fails | Desktop's status-polling endpoint covers it. |
| Mobile disconnects after sending `merge-consent` but before receiving `merge-completed` | Desktop continues, submits userOp + settle. On reconnect (origin or target), backend replays the latest `merge-completed` event. (Add: `PairingConnectionRepository.handleReconnection` replays terminal state events similarly to how it replays unprocessed signature requests today.) |
| Desktop disconnects after sending `merge-proposal` | Mobile holds the proposal locally; desktop reconnects via `originResumeToken`; mobile retries the proposal via `merge-proposal` re-emission if needed. |
| `previousSession` JWT is expired by the time mobile pops it | Next backend call returns 401 → existing `backendClient.onResponse` clears the session → mobile lands on `/register`. User has to log back in once. |
| Two `remote-sig` pairings targeting the same wallet B concurrently | The second `action=join` will conflict on `resolvedAt is null` and be rejected. First-write-wins. Optional: add a partial unique on `(target_wallet) WHERE state='pending' AND kind='remote-sig'` to fail-fast on the requester side too. |

---

## Why this is the right shape

- **No new shared infra.** The pairing WS, the topics, the push fallback, the reconnect logic, the cleanup cron — all reused. Phase 2 only adds two pairing columns, three message types, and three REST endpoints.
- **One device, one transaction.** The winner's device builds, signs, and submits the `addPassKey` userOp with its own wagmi client. No hash crosses the wire for the on-chain step. Failures are localised (a revert on mobile doesn't leave desktop in a half-state, and vice versa).
- **Consent is explicit on both branches.** Loser consent is an explicit WebAuthn assertion in both winner-side branches, signed over a backend-deterministic challenge that includes the loser's authenticator id (`frak-merge-consent:{UTC hour}:{winner_lowercased}:{loser authid}`). Server-side verification rejects before any on-chain read or DB write. The earlier "mobile's transaction IS the consent" simplification was unsafe: it only proved the winner-side owner approved adding a co-signer to their own account, never the loser-side owner whose identity graph is being absorbed.
- **The hint enforcement is server-side**, so a mobile UI bug can't accidentally pair with the wrong passkey. The `target_authenticator_hint` is checked at `action=join` against the JWT's `authenticatorId`.
- **Session isolation is enforced by skipping the `setSession` call** on the origin side for `kind = "remote-sig"`. There is no concept of a "temporary session" — desktop's session simply never changes.

---

## Open questions for review

1. **Where does the merge proposal live before `/merge/settle` runs?** Today the document assumes the preview is recomputed by the backend at settle time. If the merge takes minutes (likely fine) the snapshot can drift — usually irrelevant because the preview is mostly counts. Decision: recompute on settle but store the preview in a `device_pairing.preview` JSONB column for the desktop's display + audit.

2. **Should the loser's smart account be marked "merged" anywhere on-chain?** No on-chain primitive supports this; the loser's account still exists and is still controllable by anyone holding its passkey. Documentation must surface this. Phase 3 could add a "sweep funds to winner" helper.

3. **Does `merge-completed` replay on reconnect?** Recommend yes — implement by reusing the `pairingSignatureRequestTable` replay pattern: add a `pairing_event` table with `(pairingId, eventType, payload, sentAt)` for terminal events, and have `handleReconnection` replay unread events to each side.

4. **Multiple email associations after merge.** Resolved in Phase 1: emails live as `identity_nodes` rows on the wallet's identity group, not on the authenticator. The loser's email node migrates into the winner's group with the rest of the bulk node move. If both sides had a different email, the winner ends up holding multiple active email nodes; `findEmailForGroup` orders by `created_at ASC` so the original (winner's) email wins deterministically. The global unique on `(identity_type, identity_value, merchant_id)` guarantees no two groups can hold the same email value, so the merge can never trigger a constraint conflict on the email row itself.

5. **What if the user does the same-device fast path mid-Phase-2?** A user on Device X with both passkeys in the OS keychain could complete a merge entirely locally without needing the pairing flow. Phase 1 ships that local fast path; if it fires for some users they skip Phase 2 entirely. No conflict.

---

## Out of scope for Phase 2

- Setting up recovery for the merged wallet (Phase 3).
- Promoting the loser's passkey to primary via `setPrimaryPassKey` (Phase 3).
- Sweeping ERC-20 / native funds from the loser's address (Phase 3 / manual for now).
- Reattribution of historical `asset_logs` with `onchain_tx_hash` set (impossible — on-chain state is final).
- Cross-merchant identity merges that aren't keyed by wallet address.
- Allowing more than one pending merge per target wallet at a time.
