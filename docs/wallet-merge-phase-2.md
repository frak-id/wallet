# Wallet Merge — Phase 2: Cross-Device Flow

> **Status:** Design draft. Supersedes the prior `remote-sig`-based draft. Phase 1 (same-device merge through `MergeFlow`) is in place; this doc describes how the same flow is extended to the cross-device case where the loser's passkey and the winner's passkey live on different devices.

## Goal

A user is signed in on **Device X with Wallet A** and types an email already attached to **Wallet B** (a different smart-account, controlled by a different passkey on **Device Y**). We want to merge A and B without forcing the user to recreate the wallet, and without changing the visible step ordering of the merge flow that already ships for the same-device case.

The deterministic merge primitives (preview, consent challenge, on-chain `addPassKey`, `WalletMergeOrchestrator.settle`, post-merge binding rewrite, fresh loser-session minting) all stay as they are. Phase 2 is purely a transport extension: turning a pairing WS into the carrier for the parts of the flow that have to leave the originating device.

---

## Core idea

Reuse the existing pairing flow exactly. Two additions only:

1. **One new optional column on `device_pairing`**: `authenticator_hint` — the credential ID the joining session must match.
2. **One new optional field on `signature-request`**: `signatureKind: "onchain" | "raw-assertion"` — lets the target return a base64 WebAuthn assertion JSON (the shape `WebAuthNService.verifyConsentSignature` already parses) instead of the smart-account-formatted on-chain signature blob.

No `kind` column. No `remote-sig-paired` / `merge-proposal` / `merge-consent` messages. One new server-emitted event (`merge-completed`) for the post-merge loser-side session refresh.

On the desktop side, **the pairing decision splits at `initiatePairing` time** on a single boolean `applySession`:

| `applySession` | When | What happens on `authenticated` |
|---|---|---|
| `true` (default) | Desktop is the **loser** (needs winner-context for the on-chain step) — i.e. today's `needsSwitch` would have triggered a local session swap | Park current session, set sessionStore to the new distant-webauthn=B JWT. wagmi tunnels every signing op through pairing → mobile. Same effect as `useSwitchAuthenticator` in the local flow, just routed over WS instead of a local biometric. |
| `false` | Desktop is the **winner** (no swap needed) — today's "no `needsSwitch`" case | Upgrade the WS connection to distant-webauthn=B internally (so backend's `PairingRouterRepository` keeps accepting our messages) but do **not** write to sessionStore. Desktop stays session=A locally. wagmi keeps signing with A. Pairing client uses B-token in an instance field for `connect()`/`reconnect()`. |

That single switch is the entire Phase 2 abstraction. Each side runs its own session for the actions it owns. Pairing is just a message bus that occasionally carries a signature payload.

---

## Glossary

| Term | Meaning |
|---|---|
| **Wallet A** | The smart-account address tied to the passkey currently active on Device X (the device that initiates the merge from the AddEmail conflict screen). |
| **Wallet B** | The smart-account address tied to the passkey associated with the email the user just typed. |
| **Loser** | The wallet whose passkey gets added to the other wallet's `multiWebAuthNValidatorV2` and whose identity-graph data migrates. Decided by `pickWinner()` from preview weights + `createdAt` tiebreaker. |
| **Winner** | The wallet that survives. Receives the loser's passkey as a co-signer and absorbs the loser's identity-graph data. |
| **`authId_X`** | The base64url WebAuthn credential ID for the passkey on wallet X. |
| **Hint** | The `authenticator_hint` column on the pairing row. Enforced at `handleJoinRequest`: a mobile that joins with a different `authenticatorId` is closed with `FORBIDDEN`. |
| **`applySession`** | Desktop-side flag on `initiatePairing`. Controls whether the `authenticated` payload also flips `sessionStore`. |
| **`signatureKind`** | Per-request discriminator on `signature-request` payloads. `"onchain"` (default) returns today's `formatSignature`-wrapped on-chain blob. `"raw-assertion"` returns `btoa(JSON({id, response: {metadata, signature}}))`, parseable by `verifyConsentSignature`. |

---

## How it maps onto today's `MergeFlow`

The local flow (`apps/wallet/app/module/walletMerge/component/MergeFlow/index.tsx`) is already shaped around a single discriminator:

```ts
const needsSwitch = preview.winner !== preview.requesterWallet;
// ...
handleConsentConfirmed: setStep(needsSwitch ? "switch" : "sign");
```

`needsSwitch=false` (requester is winner) → Consent → Sign → Settle. No SwitchStep.
`needsSwitch=true` (requester is loser) → Consent → Switch (parkSession + useLogin) → Sign → Settle.

Phase 2 preserves the same dichotomy. The only swap is at the boundary — what `useLoserConsent`, `useSwitchAuthenticator`, `useSendAddPassKeyTx`, `useMergeSettle` actually do under the hood. We introduce two strategies:

- **`useLocalMergeStrategy()`** — wraps today's hooks, unchanged.
- **`useRemoteMergeStrategy()`** — wraps pairing-driven equivalents. Detailed below.

`MergeFlow` consumes whichever it's given. Step ordering, animations, copy, and back-navigation all stay the same.

The strategy choice is surfaced on the existing `ConflictStep`: alongside the current "Combine accounts" primary CTA, add a secondary "Use my other device" CTA. Clicking it starts `MergeFlow` with the remote strategy.

---

## Two remote branches (mirrors `needsSwitch`)

### Branch 1 — Desktop is the loser, mobile is the winner (`needsSwitch=true` equivalent)

Mirrors today's "requester is loser, swap to winner" path. Desktop ends up tunneling everything through the pairing.

1. **Preview** — `useMergePreview` runs from session=A. Same backend call as local. Returns `winner=B`, `loser=A`.
2. **Assets** — `useLoserAssetCheck` runs from session=A. Loser is A and A is the current session → enumerates A's stablecoin balances exactly like today.
3. **Consent** — `useLoserConsent({winner: B, loserAuthenticatorId: authId_A})` runs locally on desktop with A's passkey. Stashed in step state.
4. **Switch (= pair-with-applySession-true)** — `originPairingClient.initiatePairing({ authenticatorHint: authId_B, applySession: true })`. Shows the existing QR + 6-digit code from `LaunchPairing`. Mobile scans `/p/<id>`:
   - If mobile's current credential ≠ `authId_B`, mobile's pairing route uses the existing `parkSession`+`useLogin` primitive to switch into the right credential before joining.
   - Mobile joins. Backend's `handleJoinRequest` enforces the hint, otherwise unchanged.
   - Backend emits `authenticated`. Desktop's `OriginPairingClient` first calls `sessionStore.parkSession({session: A, sdkSession})`, then `setSession(B-distant-webauthn)`. Same atomicity as `useSwitchAuthenticator` today.
5. **Sign** — `useSendAddPassKeyTx` runs from session=B-distant-webauthn. wagmi's smart-account is built via `frakPairedWalletSmartAccount` → `signHash` is `originPairingClient.sendSignatureRequest(...)` → mobile signs the userOp hash with B → bundler submits. Tx hash returns to desktop.
6. **Settling** — `useMergeSettle` waits for receipt (8 confirmations) locally, then POSTs `/merge/settle` from session=B-distant-webauthn with the stashed A-consent signature. **Requires `settle` to accept distant-webauthn** (see backend changes).
7. **Success** — settle returns. Backend additionally publishes `merge-completed` to **both** pairing topics (see Post-merge session refresh below). Desktop applies the freshly minted local-webauthn session for A (now bound to wallet B), drops the parked snapshot via `discardPreviousSession`. Mobile receives an info-only event and shows success.

### Branch 2 — Desktop is the winner, mobile is the loser (`needsSwitch=false` equivalent)

Mirrors today's "requester is winner, no swap" path. Desktop stays as A locally; pairing carries only the loser consent.

1. **Preview** — same as branch 1. Returns `winner=A`, `loser=B`.
2. **Assets** — `useLoserAssetCheck` returns "can't check, generic warning" (loser is B, but the current session is A). Same as today's local same-device A-wins case. Optional optimisation later: ship a balance summary from mobile over the pairing.
3. **Switch (= pair-with-applySession-false)** — `originPairingClient.initiatePairing({ authenticatorHint: authId_B, applySession: false })`. QR + code as in branch 1. Mobile joins under the hint check.
   - `authenticated` arrives. Desktop's client **only** upgrades its WS connection to distant-webauthn=B (it calls `forceConnect(() => connect({wallet: token}))`). It does **not** touch `sessionStore`. The token sits in an `OriginPairingClient` instance field so reconnects use it. `sessionStore.session` stays A. wagmi keeps using A.
4. **Consent (remote)** — desktop calls `originPairingClient.sendSignatureRequest(challenge, {signatureKind: "raw-assertion"})` with the deterministic merge-consent challenge for `{winner: A, loserAuthenticatorId: authId_B}`. The signature-request flows through the existing pairing infra, lands in mobile's `TargetSignatureModal`. Mobile's `useSignSignatureRequest` branches on `signatureKind`: the `"raw-assertion"` branch calls `WebAuthnP256.sign` with the challenge and returns the base64 assertion JSON. Desktop's promise resolves with that string.
5. **Sign** — `useSendAddPassKeyTx` runs from session=A (local webauthn). wagmi signs locally with A. Bundler submits userOp adding `authId_B` to wallet A.
6. **Settling** — `useMergeSettle` waits for receipt locally, POSTs `/merge/settle` from session=A (local webauthn — current gate passes as-is) with the consent signature received in step 4.
7. **Success** — backend publishes `merge-completed` to both topics. Mobile (loser) applies the freshly minted local-webauthn session for B (now bound to wallet A) — its `TargetPairingClient` writes to sessionStore for the first time. Desktop is the winner and stays unchanged.

The two branches share the same `MergeFlow` shell, the same step components, and identical visible copy. The differences live entirely inside the strategy hooks and the desktop's `applySession` flag.

---

## End-to-end sequence (winner = mobile, the more involved branch)

```
Desktop                          Backend                          Mobile
session=A                                                         session=B (after switch-passkey, if needed)
   │
   │── POST /user/wallet/auth/email
   │   conflict + targetAuthenticatorId=authId_B + targetWallet
   │<──────────
   │
   │── GET /merge/preview?targetAuthenticatorId=authId_B
   │   { winner: B, loser: A, loserAuthenticatorId: authId_A, … }
   │<──────────
   │
   │── useLoserConsent({winner: B, loserAuthenticatorId: authId_A})
   │   navigator.credentials.get on A → assertion → base64 JSON. Stash.
   │
   │── pairing WS: action=initiate, authenticatorHint=authId_B
   │── ─────────► pairing-initiated { pairingId, pairingCode, originResumeToken }
   │
   │   QR + 6-digit code rendered                                          (user scans QR)
   │
   │                                                       ◄────────────  pairing WS: action=join, wallet=B's JWT
   │                                                       backend checks pairing.authenticator_hint
   │                                                       backend writes resolvedAt, …
   │                                                       backend mints distant-webauthn JWT for B
   │                                ◄────  publish target → "partner-connected"
   │   "authenticated" {token, sdkJwt, wallet: distant-B}
   │<──────────                              ─────────►  target-side handled (existing flow)
   │   parkSession(A); setSession(distant-B); pairing.status="paired"
   │
   │── useSendAddPassKeyTx (wagmi, session=distant-B)
   │   wagmi computes userOp hash, calls signHash → originPairingClient.sendSignatureRequest(hash)
   │── ─────────► signature-request { id, request: hash, signatureKind: "onchain" }
   │                                ─────────►  TargetSignatureModal prompts user
   │                                              useSignSignatureRequest → signHashViaWebAuthN with B
   │                                ◄────────  signature-response { id, signature: formatted }
   │   Promise resolves, bundler submits userOp
   │── waitForTransactionReceipt(8 confirmations)
   │
   │── POST /user/wallet/merge/settle
   │   Auth header: distant-webauthn=B JWT
   │   Body: { targetAuthenticatorId: authId_A, loserConsentSignature: <stashed A-assertion>, pairingId }
   │
   │                                  WalletMergeOrchestrator.settle runs:
   │                                   - verifyConsentSignature(A-assertion, …)
   │                                   - webAuthNValidatorReader.getPasskey(B, authId_A) → matches preview pubkey
   │                                   - db.transaction:
   │                                       repointBinding(authId_A, B, reason=merged)
   │                                       mergeGroupsByWallet(winner=B, loser=A)
   │                                   - mintForCredential(authId_A, walletAddress=B) → fresh session for desktop
   │                                   - publish to origin topic: merge-completed { winner: B, loser: A, session, sdkJwt }
   │                                   - publish to target topic: merge-completed { winner: B, loser: A }    (info only)
   │  ◄─── 200 { status: "merged", winner, loser }
   │
   │   merge-completed (origin topic) — payload.session present
   │   OriginPairingClient.handleMessage("merge-completed"):
   │     sessionStore.setSession(session.session); setSdkSession(sdkJwt)
   │     discardPreviousSession() — drop parked A
   │     pairing.disconnect()
   │   SuccessStep renders.
   │
                                                                  merge-completed (target topic)
                                                                  TargetPairingClient.handleMessage("merge-completed"):
                                                                    info only — render success card if a flow was active
```

When **winner = desktop**, the diagram is shorter:

- No `parkSession` / `setSession` on desktop after `authenticated` (because `applySession=false`).
- A single `signature-request` with `signatureKind: "raw-assertion"` carries the consent.
- `addPassKey` is signed locally on desktop and `/merge/settle` is called from session=A. No backend gate relaxation.
- `merge-completed` to target topic carries the loser session (for mobile). Origin topic gets the info-only variant.

---

## Surface area changes

### Backend

| File | Change |
|---|---|
| `services/backend/src/domain/pairing/db/schema.ts` | New nullable column on `pairingTable`: `authenticator_hint: varchar`. Migration. |
| `services/backend/src/domain/pairing/repositories/PairingConnectionRepository.ts` | `handleInitiateRequest`: read `authenticatorHint` from query, persist to row. `handleJoinRequest`: if `pairing.authenticator_hint` is set and `wallet.authenticatorId !== hint`, `ws.close(FORBIDDEN, "Authenticator mismatch")`. Other paths untouched. |
| `services/backend/src/domain/pairing/repositories/PairingRouterRepository.ts` | `handleSignatureRequest`: forward `payload.signatureKind` (default `"onchain"`) through to the target topic. No new branch, just an extra field passed along. Add a single new server-emitter `publishMergeCompleted(pairingId, payload)` used by `WalletMergeOrchestrator.settle`. |
| `services/backend/src/domain/pairing/dto/WebsocketDirectMessage.ts` | Add `signatureKind?: "onchain" \| "raw-assertion"` to `WsSignatureRequest` payload. Add `WsMergeCompletedTopicMessage`. |
| `services/backend/src/api/user/wallet/pairing/management.ts` | `GET /pairings/find/:id` returns `authenticatorHint` so mobile can self-check before joining. |
| `services/backend/src/api/user/wallet/merge/settle.ts` | Body gains optional `pairingId`. The local-webauthn gate (`isLocalWebAuthnSession`) is relaxed to accept distant-webauthn too — equivalent crypto proof, the consent verifier and on-chain readback are the real gates. ECDSA stays excluded. |
| `services/backend/src/orchestration/identity/WalletMergeOrchestrator.ts` | `settle` accepts an optional `pairingId`. After the merge transaction commits (existing logic), always mint a fresh local-webauthn session for the loser credential (already done conditionally today via `mintForCredential`) and publish `merge-completed` to both pairing topics: loser-side topic with `{winner, loser, session, sdkJwt}`, winner-side with `{winner, loser}`. HTTP response shape unchanged. |
| (optional) `services/backend/src/domain/pairing/db/schema.ts` | Partial unique index `(authenticator_hint) WHERE resolved_at IS NULL AND authenticator_hint IS NOT NULL` to fail-fast on concurrent merges targeting the same credential. |

Nothing else. No new endpoints. No new tables.

### Frontend — `packages/wallet-shared`

| File | Change |
|---|---|
| `pairing/clients/base.ts` | `ConnectionParams.initiate` branch accepts `authenticatorHint`. |
| `pairing/clients/origin.ts` | `initiatePairing({ authenticatorHint, applySession })`. New private field `pendingDistantToken: string \| null` for the `applySession=false` mode. `handleMessage("authenticated")` branches on `applySession`: `true` → today's path (also `parkSession` first); `false` → call `forceConnect(() => connect({wallet: token}))` to upgrade WS, store token in `pendingDistantToken`, set `status: "paired"`, skip `setSession`. `reconnect()` uses `pendingDistantToken` if present before falling back to sessionStore. `handleMessage("merge-completed")` — apply pushed session if present, otherwise render terminal state. |
| `pairing/clients/target.ts` | `handleMessage("merge-completed")` — apply pushed session if present; emit a store event so the active mobile-side merge flow can transition to success. |
| `pairing/clients/target.ts` (signature-request handling) | When server forwards `signatureKind`, surface it in `TargetPairingPendingSignature`. |
| `pairing/types/ws.ts` | `WsSignatureRequest` payload gains `signatureKind`. `WsTargetMessage` / `WsOriginMessage` gain `merge-completed`. `WsTopicSignatureRequest` is extended in the same way. |
| `pairing/types/index.ts` (`TargetPairingPendingSignature`) | Optional `signatureKind` field. |
| `pairing/hook/useSignSignatureRequest.tsx` | Branch on `request.signatureKind`. Default → existing `signHashViaWebAuthN` + return Hex. `"raw-assertion"` → call `WebAuthnP256.sign({challenge: request.request, credentialId: session.authenticatorId})` and return `btoa(JSON.stringify({id: raw.id, response: {metadata, signature}}))`. Either way it lands in `sendSignatureResponse` — type the response payload to carry either shape. |
| `pairing/clients/origin.ts` (`sendSignatureRequest`) | Generic over the return type per `signatureKind`. For `"raw-assertion"` the resolved value is the base64 string, not a Hex. |
| `pairing/hook/usePairingInfo.tsx` | Surface `authenticatorHint`. |

`sessionStore.parkSession` / `popSession` / `discardPreviousSession` are already in place and reused as-is. `usePersistentPairingClient` is not extended for the `applySession=false` case — known limitation: mid-merge tab refresh on the desktop-is-winner branch drops the pairing. Acceptable given the bounded duration of the flow.

### Frontend — `apps/wallet`

| File | Change |
|---|---|
| `app/module/settings/component/AddEmail/ConflictStep.tsx` | New secondary CTA "Use my other device" that resolves to a new `FlowState` (`{kind: "merging", mode: "remote"}`). The existing "Combine accounts" CTA keeps its current behavior with `mode: "local"`. |
| `app/module/settings/component/AddEmail/index.tsx` | Thread the `mode` through to `MergeFlow`. |
| `app/module/walletMerge/strategy/useLocalMergeStrategy.ts` *(new)* | Wraps today's hooks (`useLoserConsent`, `useSwitchAuthenticator`, `useSendAddPassKeyTx`, `useMergeSettle`) into a strategy interface. |
| `app/module/walletMerge/strategy/useRemoteMergeStrategy.ts` *(new)* | Pairing-driven implementation. Internals: `useInitiatePairing({applySession})`, `useRemoteLoserConsent({signatureKind: "raw-assertion"})`, `useWaitForMergeCompleted()`. The `addPassKey` and `settle` hooks are reused as-is — wagmi + the existing `useMergeSettle` handle both branches because their behavior is fully driven by the live session. |
| `app/module/walletMerge/component/MergeFlow/index.tsx` | Accept a `strategy` prop. Replace direct hook usage with strategy calls at the boundary actions. Visible step ordering unchanged. |
| `app/module/walletMerge/component/SwitchStep/index.tsx` | Render variant: `local` shows today's "switch passkey" copy + biometric prompt; `remote-applySession-true` shows pair QR + status banner + parks A on `authenticated`; `remote-applySession-false` is a no-op step (skipped in `MergeFlow` because requester is winner, mirroring today's `!needsSwitch`). |
| `app/module/walletMerge/component/ConsentStep/index.tsx` | Render variant: `local` (today) prompts loser passkey on this device; `remote` (only used when desktop is the winner) renders "Confirm on your other device" + the pair QR + waits for the remote consent assertion. |
| `app/routes/_wallet/_protected-fullscreen/pairing.tsx` | Branch on `pairingInfo.authenticatorHint`: if present, mount `MergeApprovalPairing` instead of the default `PairingPage`. |
| `app/module/walletMerge/component/MergeApprovalPairing/` *(new)* | Mobile-side entry. Step 1 verifies `currentSession.authenticatorId === pairingInfo.authenticatorHint`; on mismatch, offer the existing switch-passkey flow (`parkSession` + `useLogin`). On match (or after switch), `joinPairing(id, pairingCode)`. Then either:<br>- Renders `TargetSignatureModal` as today for the merge-consent signature-request (covers winner=desktop branch).<br>- Renders `MergeFlow` with `useRemoteMergeStrategy({ side: "target" })` for the winner=mobile branch — mobile runs the full mobile-side merge UI (preview confirmation, sign+settle locally).<br>The branch decision comes from a `merge-proposal` ... no, see Open Questions §1: we don't need an explicit "this is a remote merge" message because `authenticatorHint` is enough to identify the intent; the mobile-side branch is decided locally from the preview the mobile fetches via `useMergePreview(authId_A)`. |

---

## Backend changes — concrete diffs

### `pairingTable` migration

```ts
authenticatorHint: varchar("authenticator_hint"), // nullable
// optional, fail-fast on concurrent merges:
// uniqueIndex(...) where authenticator_hint is not null and resolved_at is null
```

### `PairingConnectionRepository.handleInitiateRequest`

```diff
- const { action, pairingCode, id, originResumeToken, originNode: originNodeRaw } = query;
+ const { action, pairingCode, id, originResumeToken, originNode: originNodeRaw, authenticatorHint } = query;

  await db.insert(pairingTable).values({
      pairingId,
      pairingCode,
      originUserAgent: userAgent ?? "Unknown",
      originName: deviceName,
      originNode,
+     authenticatorHint: authenticatorHint || null,
  });
```

### `PairingConnectionRepository.handleJoinRequest`

```diff
  if (pairing.resolvedAt) {
      ws.close(WsCloseCode.FORBIDDEN, "Pairing already resolved");
      return;
  }

+ if (pairing.authenticatorHint && wallet.authenticatorId !== pairing.authenticatorHint) {
+     ws.close(WsCloseCode.FORBIDDEN, "Authenticator mismatch");
+     return;
+ }

  if (wallet.type !== undefined && wallet.type !== "webauthn") {
      ws.close(WsCloseCode.FORBIDDEN, "Can't resolve non-webauthn wallet");
      return;
  }
```

### `signature-request` payload

```diff
  payload: {
      id: string;
      request: Hex;
      context?: object;
+     signatureKind?: "onchain" | "raw-assertion";
  };
```

Forwarded as-is by `PairingRouterRepository.handleSignatureRequest`. `signature-response` payload similarly gains the same field (so the receiver knows how to interpret).

### `settle` relaxation + `merge-completed` emission

```diff
- if (!isLocalWebAuthnSession(walletSession)) { throw HttpError.badRequest("MERGE_UNSUPPORTED_SESSION", …); }
+ if (walletSession.type === "ecdsa") { throw HttpError.badRequest("MERGE_UNSUPPORTED_SESSION", …); }

  // ... existing settle logic ...

+ if (params.pairingId) {
+     await pairingRepo.publishMergeCompleted({
+         pairingId: params.pairingId,
+         loserAuthenticatorId: preview.loserAuthenticatorId,
+         winner: preview.winner,
+         loser: preview.loser,
+         loserSessionPayload: { session, sdkJwt }, // minted from authId_loser
+     });
+ }
```

The HTTP response shape stays `{ status: "merged", winner, loser, session? }`. `session` is still returned when `requesterIsLoser` (matches today's contract), redundant but harmless when the WS event also delivered it.

---

## Post-merge session refresh — symmetric design

`merge-completed` is the only new server-emitted topic message. Backend publishes it after `settle` succeeds, to **both** topics:

- **Loser-side topic** payload: `{ winner, loser, session, sdkJwt }`. A freshly minted **local-webauthn** session keyed to the loser credential, now bound to the winner wallet via `repointBinding`.
- **Winner-side topic** payload: `{ winner, loser }`. Informational only.

Loser-side clients (`OriginPairingClient` when desktop is the loser, `TargetPairingClient` when mobile is the loser) handle this by:

```ts
sessionStore.setSession(payload.session);
sessionStore.setSdkSession(payload.sdkJwt);
sessionStore.discardPreviousSession(); // drop parked A if any
// emit a "merge-completed" event on the client store for the active flow UI
```

Effect:
- **Desktop loser** (winner=mobile): desktop transitions from session=distant-webauthn=B (during the on-chain step) to session=local-webauthn{authId_A, address=B}. The A passkey is on desktop, so wagmi can sign directly from now on. No further pairing dependence.
- **Mobile loser** (winner=desktop): mobile transitions from session=local-webauthn{authId_B, address=B-as-of-pre-merge} to session=local-webauthn{authId_B, address=A}. Same local-webauthn shape, just rebound.

Both end states match the local same-device merge's "loser session is replaced with a freshly minted JWT pointing at the merged wallet" contract.

---

## Failure modes

| Scenario | Behaviour |
|---|---|
| Mobile cancels the switch-passkey modal before joining | `popSession` restores the previous mobile session. Pairing not joined. Desktop times out via the standard 10-min unresolved pairing cleanup cron. |
| Mobile cancels the `merge-consent` `signature-request` (winner=desktop branch) | Existing `signature-reject` path fires. Desktop's `sendSignatureRequest` promise rejects with `user-declined`. UI offers retry or back to ConflictStep. |
| Mobile signs the wrong credential in `raw-assertion` mode (only possible if hint check is bypassed somehow) | `verifyConsentSignature` at `/merge/settle` rejects with `MERGE_INVALID_CONSENT`. No DB write, no on-chain effect. |
| On-chain `addPassKey` reverts (winner=desktop branch) | Local error from wagmi. Settle is never called. Consent assertion is fresh on each retry (the deterministic challenge accepts ±1h slot). Retry the SignStep. |
| On-chain `addPassKey` reverts (winner=mobile branch) | wagmi error tunneled back through `signature-request` rejection. Same recovery. |
| `/merge/settle` succeeds on-chain but PG merge fails | Today: idempotent. Retry settle on the same inputs. `merge-completed` only emitted on full success. |
| Desktop disconnects after sending consent (winner=mobile branch) | The userOp + settle both happen on mobile, independently of desktop's WS state. Mobile sends `merge-completed` to origin topic — buffered server-side (existing topic semantics) and replayed when desktop reconnects via `originResumeToken` (same path as today's signature-request replay). |
| Mobile disconnects mid-flow | The next `handleReconnection` already re-publishes outstanding signature requests. We extend the same path to also re-emit the last `merge-completed` for any of the wallet's pairings whose `state` is still pending the loser-side ack. |
| `pairingId` missing on settle body | settle still works (legacy / local-merge path). No `merge-completed` emission. |
| Two desktops initiating remote merges to the same B | Partial unique index on `(authenticator_hint) WHERE resolved_at IS NULL` rejects the second `INSERT`. Without the index, the first `join` wins and the second `handleJoinRequest` would also succeed if the second pairing has a different `pairingId` — undefined behavior. Recommended to add the index. |

---

## Why this is the right shape

- **Almost no new infra.** One nullable pairing column, one optional signature-request field, one server-emitted event. The pairing transport, signature-request lifecycle, topic forwarding, reconnect logic, cleanup cron — all unchanged.
- **Reuses the existing wagmi-over-pairing connector.** When desktop is the loser and swaps to distant-webauthn=B, every wagmi operation (preview transactions, gas estimation, userOp signing) already routes correctly through `frakPairedWalletSmartAccount`. Zero new on-chain code.
- **Reuses the existing `MergeFlow` step shell.** Same components, same ordering, same animations. The user sees one extra option on the conflict screen ("Use my other device") and otherwise lives in the same flow they would on a same-device merge.
- **Each device runs `addPassKey` from a session it actually owns.** No userOp hash crosses the wire as anything other than what `wagmi` already routes through `signature-request`. The "winner device builds, signs, and submits the on-chain step" property is preserved.
- **Consent is explicit on both branches** via the same deterministic challenge format. The verifier (`WebAuthNService.verifyConsentSignature`) is unchanged. The only difference is which device's WebAuthn ceremony produces the assertion.
- **Loser-side JWT refresh is symmetric.** Whether desktop or mobile is the loser, the backend pushes the freshly minted local-webauthn session through the same `merge-completed` mechanism, mirroring the Phase 1 HTTP `MergeSettleResponse.session` contract.
- **The hint enforcement is server-side**, so a mobile UI bug can't accidentally pair with the wrong passkey.
- **Settle's session-type gate stays meaningful.** Distant-webauthn is just WebAuthn signing routed through a paired device — same crypto proof. The relaxation is from "local webauthn only" to "any webauthn (local or distant)". ECDSA stays excluded.

---

## Open questions for review

1. **Does mobile need an explicit "you're joining a merge" message?** Today, `pairingInfo.authenticatorHint` being non-null is the only signal that this is a merge-mode pairing. Mobile's `MergeApprovalPairing` route key off that and renders the merge UI. No new `merge-proposal` message is needed because mobile fetches the preview itself via `GET /merge/preview?targetAuthenticatorId=<authId_A>` (mobile's session is B, the preview is symmetric). One round-trip vs. forwarding the preview through the WS — preference for the round-trip because it avoids cross-device staleness if weights change between desktop's preview and mobile's display.

2. **Should `applySession=false` mode persist its WS-only token in sessionStorage so a desktop tab refresh during a winner=desktop remote merge can recover?** Probably yes for symmetry with the existing `pairing` persist slot, but it's a niche path — the merge takes ~tens of seconds, refresh-mid-flow is rare. Defer to a follow-up.

3. **Do we want `pairingId` in the `/merge/settle` body to be required when the pairing was opened with `authenticator_hint`, so we always emit `merge-completed`?** Recommended yes. The orchestrator can lookup the active pairing by `authenticator_hint` if the body omits it, but explicit is safer.

4. **Mobile-side asset summary for the winner=desktop branch** — Phase 1 punts on this (loser-balance check fails when current session isn't the loser). Optional Phase 2 addition: mobile pushes a signed asset-summary payload (or just a count) over the WS so desktop's `AssetMigrationStep` can render the same list it would in the local flow. Not blocking.

5. **Push notification when desktop is the loser and mobile receives the implicit "go sign" event** — today's `signature-request` already triggers a push (`PairingRouterRepository.handleSignatureRequest` → `notificationsService.sendNotification`). The winner=mobile branch piggybacks on that path because the userOp signing IS a signature-request. The winner=desktop branch (consent over WS) also flows through the same handler, so it gets the push for free. Confirmed by inspection — no extra wiring needed.

---

## Out of scope for Phase 2

- Setting up recovery for the merged wallet (Phase 3).
- Promoting the loser's passkey to primary via `setPrimaryPassKey` (Phase 3).
- Sweeping ERC-20 / native funds from the loser's address (Phase 3 / manual).
- Reattribution of historical `asset_logs` with `onchain_tx_hash` set.
- Cross-merchant identity merges that aren't keyed by wallet address.
- Allowing more than one pending remote-sig merge per target wallet at a time (the partial unique index forbids it).
