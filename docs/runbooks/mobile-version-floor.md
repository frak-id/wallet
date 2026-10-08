# Mobile version floor

The backend publishes a minimum app version per platform (`GET /common/version`). An app below it shows a full-screen "Update the app" gate that can't be dismissed; its only action opens the store. `0.0.0` means no floor. Production stays at `0.0.0` between incidents.

The floor blocks, it doesn't fix. A user who is blocked can't use the wallet at all until they install a newer version from the store.

## When to raise it

Raise it only for a released version that puts users or funds at risk. A UI bug is not a reason.

The value is always the **fixed** version, never the bad one: the comparison is strict (`installed < floor`), so a floor equal to the bad version doesn't block it. To block `1.0.110`, set `1.0.111`.

- **By default:** wait until the fixed version is live in the store, so a blocked user can update straight away.
- **When funds are at risk:** raise it right away, even if the fix is still in review. Blocked users can't use the wallet until the fix is approved, which can take days on iOS.

The two platforms are independent. Only raise the platform that ships the bad version.

## Procedure

1. GitHub → Settings → Environments → **`gcp-production`** (or `gcp-staging` for a rehearsal) → add or edit `MIN_VERSION_IOS` / `MIN_VERSION_ANDROID`. Plain `X.Y.Z` only: no `v`, no suffix.
2. Actions → ☁️ Deploy → Run workflow. **Pick the branch: `main` for production, `dev` for staging.** The ref decides the stage, and the dropdown defaults to `main`. Tick `force_deploy`.
3. Check the endpoint: `curl -s https://backend.frak.id/common/version` (staging: `https://backend.gcp-dev.frak.id/common/version`).

Changing the variable alone does nothing: the backend reads it at deploy time, so step 2 is required. `kubectl set env` is not a shortcut: the next deploy reverts it.

## What to expect

Measured on staging, 2026-10-08:

- Variable set → endpoint reports the new floor: **~3 min 15 s** (the deploy run itself ends ~30 s later).
- Endpoint → app blocked: the app re-reads the floor only when it comes back to the foreground or relaunches, **and** its cached value is more than 5 minutes old (plus up to 60 s of edge cache). In the rehearsal the gate appeared on the second return to the foreground, ~7 min after the variable was set.
- **There is no deadline for everyone.** An app left in the background is only blocked the next time it's opened, which can be hours or days later. A slow tail is normal; it doesn't mean the floor failed.
- Once an app has seen the floor, it stays blocked offline (airplane mode + relaunch).

## Rollback

Delete the variable (or set it back to `0.0.0`), run step 2 again on the same branch, and check the endpoint reports `0.0.0`. Measured: ~3 min 15 s to the endpoint, then the same 5-minute cache before each app clears.

## Limits

- Builds up to `1.0.33` predate the gate and can't be blocked by any floor.
- Builds before the release containing the build-version fix (`1.0.107` on dev) only block while Apple's / Google's store lookup succeeds.
- iOS builds before the release containing the App Store link fix open a blank App Store page from the gate's button. The user is blocked but has to find the update in the App Store themselves.
- Never guess a standing iOS floor: App Store Connect doesn't report which app versions are installed.
