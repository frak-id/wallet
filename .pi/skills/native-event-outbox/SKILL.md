---
name: native-event-outbox
description: Model-check the native SDK's tracking outbox (sdk/android EventOutbox.kt + EventQueue.kt, and the scheduling and purge calls in DefaultFrakClient.kt) with TLA+/TLC over every interleaving of track, drain, purge, identity reset, consent toggles and process death. Use before merging any change to those files, or to the iOS mirror's drain loop, to show that no queued event is silently lost, no enqueue is left undrained, and nothing is sent after consent is withdrawn or under a reset id.
---

# Native event outbox model

A merchant's binary freezes at store submission, so an outbox bug ships for the life of that app version. Tests cover the orderings someone wrote down. This model covers every ordering of the steps below, within the bounds in `model/EventOutbox.cfg`.

## The rules

| Rule | Sentence | Harm when broken | Status at sync commit |
| --- | --- | --- | --- |
| `NoSilentLoss` | A queued event leaves the file only after it was sent, dropped by a verdict on that row, or purged. | Referral or purchase events vanish and rewards are never attributed. | holds |
| `NoLostWakeup` | Whenever the outbox goes idle, every event on disk was seen by a drain that started after it was queued. | An event sits on disk until the next launch or `track()`, maybe for days. | holds |
| `NoSendWhileOff` | No request is made while tracking is disabled. | Data leaves the device against the user's choice. | holds |
| `NoSendUnderResetId` | No request carries an anonymous id that `resetAnonymousId()` has already replaced. | The identity the user asked to forget is linked again. | **breaks** (finding 1) |
| `NoSendOfWithdrawnEvent` | No event captured before `setTrackingEnabled(false)` is ever sent. | An event the user withdrew is sent once they opt back in. | **breaks** (finding 2) |

`model/expected.json` holds the status column. `scripts/check.ts` fails when a rule's result differs from it, in either direction.

## Run it

```sh
bun .pi/skills/native-event-outbox/scripts/check.ts             # the rules, ~30 s
bun .pi/skills/native-event-outbox/scripts/check.ts --mutants   # proof each check can fail, ~1 min
```

It needs Java 11+ on `PATH` (the JDK 17 that `sdk/android` already requires). On the first run it downloads TLC 1.7.4 to `~/.cache/frak-tla/` and verifies its sha256. Add `--out <dir>` to keep TLC's output somewhere other than a temp dir. Exit 0 means every rule matched `expected.json`.

Each broken rule prints its shortest path as numbered steps with the variables that changed. Read it, and every result, with the `/statechart` skill: it tells a violation as a path in plain words and, when the model passes, draws how the outbox moves between states. Give it `model/EventOutbox.tla` and a config with the rule as an `INVARIANT`.

## Does my change touch the verified code?

Coverage, confirmed against the code at **sync commit `02ef48716`** (origin/dev, 2026-11-26):

| Model action | Code |
| --- | --- |
| `TrackBegin`, `TrackEnqueue` | `DefaultFrakClient.track` / `trackPurchase` (`trackingCall` → `requireTrackingEnabled`, `identity.anonymousId()`), `EventOutbox.enqueue` |
| `ScheduleFlush`, `LoopTop`, `LoopCas` | `EventOutbox.scheduleFlush` and the coroutine it launches (`drainState`) |
| `Start` | top of `EventOutbox.flush`: `flushMutex`, `trackingAllowed()`, `backoff.isBackingOff`, `queue.read`, `currentClientId()` |
| `Row` | the `for` loop in `EventOutbox.flush`: per-row `trackingAllowed()`, stale-id drop, id stamping, `DeliveryOutcome` branches, `recordRetry` |
| `Checkpoint`, `Reconcile` | `checkpoint()` and the final `queue.reconcile` in `flush`; `EventQueue.reconcile` (fresh `readLocked`, filter by `rowId`, `replaceLocked`, the `durable` refusal) |
| `Purge` | `EventOutbox.purge` → `EventQueue.clear` |
| `ResetId` | `DefaultFrakClient.resetAnonymousId` (`identity.reset()` then `tracker.purge()`) |
| `Withdraw`, `Enable` | `DefaultFrakClient.setTrackingEnabled` |
| `Crash`, `Restart` | process death; the `init` block of `DefaultFrakClient` (purge if consent is off, else `tracker.flush()`) |

```sh
git log --oneline 02ef48716..HEAD -- \
  sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/tracking/EventOutbox.kt \
  sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/tracking/EventQueue.kt \
  sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/core/DefaultFrakClient.kt \
  sdk/ios/Sources/FrakSDK/Tracking/EventOutbox.swift
```

Any commit listed there (or your own diff on those files) needs a look. Your change matters to the model if it changes:

- when the drain reads the file, the id or consent;
- the order of the checks in the row loop, or which outcome breaks or continues;
- what `reconcile` reads or writes;
- how `scheduleFlush` hands work to the drain;
- what `track`, `purge`, `resetAnonymousId` or `setTrackingEnabled` do, or in what order.

Payload shapes, senders' HTTP details and logging do not matter to it.

The iOS drain (`sdk/ios/Sources/FrakSDK/Tracking/EventOutbox.swift`, `drain()`) has the same row loop and the same once-per-drain `currentClientId()`, so both findings very likely apply there too. Neither was replayed on iOS. Its scheduler (`scheduleDrain`, an actor with `drainTask`/`drainAgain`) is **not** modelled, so `NoLostWakeup` says nothing about iOS.

## When the check fails

1. **Your change was meant to change behavior.** Edit the action that stands for the code you changed so it does what the code now does, one atomic step per step the code takes between suspension points that matter. Rerun. If a rule now breaks, that is the change's effect, not a modeling detail.
2. **A rule breaks that should hold.** Replay the path against the real code before you believe it, one step per action. The fastest replay is a JVM test in `sdk/android/frak-sdk/src/test/kotlin/id/frak/sdk/tracking/EventOutboxTest.kt`: seed rows with `queue.append(seeded(...))`, and run the middle steps from inside the `trackingAllowed` lambda, which the drain calls before each row. Run it with `./gradlew :frak-sdk:testDebugUnitTest --tests 'id.frak.sdk.tracking.EventOutboxTest'` from `sdk/android`. Both findings below were replayed this way.
   - **It reproduces:** it is a bug. Report the path in code words. Do not weaken the rule or narrow the model to make it pass.
   - **It does not reproduce:** the model is wrong. Find the action that allows a step the code forbids, fix it, and check the action again against the table above.
3. **A known finding now holds.** Someone fixed it. Confirm the fix in the code, then set its rule to `holds` in `expected.json` and update the status column above.
4. **A mutant reports `FAIL`.** Its `find` text no longer matches the spec (the script says so), or the model lost the ability to catch that bug. Update `model/mutants.json` so each mutant still mirrors its `code` line.

Once the model describes the code at a new commit, update the sync commit above and in the `git log` command. Do this only after you have checked each action in the coverage table against that commit.

## Findings at the sync commit

Both were reproduced on the real Kotlin, and the SDK code was left unchanged.

1. **`NoSendUnderResetId`.** A track lands, then a drain reads the file and the current id. `resetAnonymousId()` erases the key and purges the file. The drain carries on through its in-memory rows and sends the rest under the old id. `flush()` calls `currentClientId()` once, before the loop. The constructor's own doc says it is "read fresh so a reset is visible mid-drain". Up to a whole backlog can go out after the reset returned. Mutant `fix-read-the-id-per-row` shows that reading the id per row makes the rule hold.
2. **`NoSendOfWithdrawnEvent`.** A drain reads the file. `setTrackingEnabled(false)` runs and its purge completes. Then `setTrackingEnabled(true)` runs before the drain reaches the next row. The per-row consent check passes again, and the drain sends rows captured before the withdrawal from its in-memory copy. This contradicts the `init` comment "Events captured before tracking was turned off must not be sent now." The window is one drain long, so it is rare.

## What the model leaves out

- **Bounds:** 2 events, 1 id reset, 2 consent toggles, 1 crash, `MaxFailures = 2`, checkpoint before every row after the first (the code: every 20). A pass covers these bounds, not the whole system.
- **Atomic steps:** the per-row consent check and the request are one step. So a withdrawal while one request is already on the wire is accepted, as the code intends. `Start` merges the consent and backoff checks with the file read and the id read. The id is never `null` while consent is on (minting is assumed done).
- **Not modelled:** age, count and byte trims in `EventQueue`; torn lines; row-id migration; merchant resolution (a deferred row is a `Hold`); unknown row kinds; `trackMerge`'s dedupe; `DeliveryOutcome.Dropped`; the `configStore.updates` flushes (only the `init` flush runs outside `scheduleFlush`); `shutdown()`; backoff timing beyond on/off; at-least-once duplicates (a resend after a crash is allowed, since the backend dedupes on the idempotency key).
- **iOS:** see above.
