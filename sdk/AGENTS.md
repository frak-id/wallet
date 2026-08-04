# sdk/ — Compass

Public SDK surface. Dual output (NPM `dist/` + CDN `cdn/`). Build order is **strict**: `rpc → core → legacy → react → components`. Linked via Changesets: `frame-connector`, `core-sdk`, `react-sdk`.

`android/` and `ios/` are **native SDKs, not npm packages** — different toolchains, different registries, different release train. They are excluded from `build:sdk`, biome, knip and Changesets. See the section at the bottom.

## Package Graph

```
@frak-labs/frame-connector (packages/rpc) ─── RPC foundation
           │
@frak-labs/core-sdk         ─── actions, clients, bundle
           │              ╲
@frak-labs/react-sdk      @frak-labs/components (Preact, Web Components)
           │
@frak-labs/nexus-sdk (legacy, Knip-ignored, IIFE as NexusSDK)
```

## Build System (tsdown / Rolldown)

- **NPM**: `{ format: ["esm", "cjs"], outDir: "dist", dts: true }`
- **CDN**: `{ format: "iife", globalName: "FrakSDK", outDir: "cdn", noExternal: [/.*/] }` — fully self-contained bundle
- **`development` export condition**: apps in this monorepo consume `src/index.ts` directly (no rebuild in dev loop)

## Non-Obvious Patterns

- **Build order is a hard requirement** — downstream packages typecheck against upstream build outputs.
- **CDN `noExternal: [/.*/]`** means every dep (viem, TanStack Query, etc.) ships inside the bundle. Size discipline matters.
- **Adding a new action is a 4-step sequence** (do not skip):
  1. Add type in `sdk/core/src/types/rpc/*.ts`, extend `IFrameRpcSchema`
  2. Implement in `sdk/core/src/actions/<name>.ts` (pure function, `client: FrakClient`)
  3. Re-export from `sdk/core/src/actions/index.ts`
  4. Add React hook in `sdk/react/src/hook/use<Name>.ts` (wrap with TanStack Query)
- **Action pattern**: `client.request({ method, params })` — never call transports directly.
- **Hook pattern**: `useFrakClient()` + `useQuery`/`useMutation` — never recreate clients.
- **Legacy is Knip-ignored** — do not add new exports there.
- **`bun run build:sdk` means "build the JS SDKs"** and must keep meaning that. Native builds are separate scripts — there is no Turborepo here to hang them off, only sequential Bun `--filter` calls.

## Quick Commands

```bash
bun run build:sdk                       # Builds all SDKs in the correct order
bun run test --project core-sdk-unit
bun run test --project react-sdk-unit
```

## Native SDKs (`android/`, `ios/`) — pre-release

Apache-2.0, not the monorepo's GPL-3.0 (`sdk/{android,ios}/LICENSE`): merchants statically link these
into closed-source store binaries, and the patent grant covers the identity proof-of-possession scheme.

Two artifacts per platform so a merchant taking only tracking never pulls in a web view:

| | Android | iOS |
| --- | --- | --- |
| Core (UI-free) | `id.frak:frak-sdk` (`:frak-sdk`) | `FrakSDK` |
| UI (web view) | `id.frak:frak-sdk-ui` (`:frak-sdk-ui`) | `FrakSDKUI` |
| Build | Gradle 9.5.0, AGP 9.1.1, Kotlin 2.4.10 → language/API level 2.2, JVM target 17, `compileSdk 36` | SwiftPM, tools-version 5.9 |
| Minimum | `minSdk 24`, `explicitApi()` on | iOS 15 |
| Registry | Maven Central Portal (not OSSRH — decommissioned), not yet wired | SPM only, no CocoaPods |

- **MVP surface implemented on both platforms**, one Android device pass only — the sharing sheet, the install handoff and inbound deep links have run nowhere, iOS nowhere at all. See `sdk/{android,ios}/README.md`.
- **No publish path and no CI**, deliberately: `publishToMavenLocal` only, `bun run --cwd sdk/ios xcframework` exits 1, no job builds/tests/lints either SDK. Every green result is a human running a command once.
- **Three iOS divergences, each forced by the platform**: the anonymous id lives in `UserDefaults` (Keychain survives uninstall) in its own `id.frak.sdk.identity` suite, alongside the Secure Enclave's wrapped key blob; `DeepLinkHandling` has no `.automatic` case, because a library cannot observe a host's `Scene`/`AppDelegate` URL callbacks the way it can Android's `ActivityLifecycleCallbacks`; the install fallback is a plain App Store URL, so the identity handoff only completes when the wallet is already installed.
- **The two wire formats are pinned to golden fixtures, not to each other.** The identity proof layout and the FrakContext v2 codec are asserted against `sdk/core/src/{identity,context}/fixtures/` on every platform. A port that does not assert against the corpus has not been ported.
- **Android dex budget: 256 KB per artifact** (`sdk/android/gradle.properties`). The check measures each module's own `classes.jar`, so it is meaningful for `:frak-sdk` and vacuous for `:frak-sdk-ui`.
- **`:frak-sdk` has zero third-party runtime deps** bar `kotlinx-coroutines-core`, which is `api` because `suspend`/`StateFlow` are in the public surface. `:frak-sdk-ui` ships Compose — that is the reason the two artifacts are split. Both iOS targets are genuinely dependency-free.
- **`explicitApi()` on Android is deliberate**: a merchant's binary freezes at store submission, so an accidentally-public helper is one we are stuck supporting forever.
- **`Presenter` lives in the UI artifact, not `sharing/`** — `client.sharing.buildLink()` is 100% local and must stay callable without the web view.
- **`FrakClient` is a sealed concrete class with five namespaces** (`config`, `rewards`, `sharing`, `tracking`, `appLink`), not an interface/protocol. Adding a member is additive on both platforms; nothing can substitute a fake for it, so `frak-sdk-ui`'s tests inject narrow functions and merchant tests should point `FrakEnvironment.Custom`/`.custom` at a stub server.
- **No exported activity, no intent filter in the SDK manifest**: inbound `fCtx` is wired through `FrakConfig.deepLink`, so the merchant's own router keeps owning their links.
- **`PrivacyInfo.xcprivacy` is a hard gate**: ITMS-91053 lands on the merchant's upload, not ours, and `FrakSDKUI` ships its own because it is separately consumable. Declared: `DeviceID`, `PurchaseHistory`, `ProductInteraction`, `UserID` on the core; `DeviceID` + `ProductInteraction` on the UI; `UserDefaults`/`CA92.1` as the only required-reason API, core only.

```bash
bun run --cwd sdk/android build   # assembleRelease — no device, this is a library
bun run --cwd sdk/android test    # JVM unit tests
bun run --cwd sdk/android check   # ktlint, tests, Android Lint, version drift, dex budget
bun run --cwd sdk/ios build       # swift build at an explicit iOS-simulator triple
bun run --cwd sdk/ios test        # two stages: compile at the iOS triple, then run on the host
bun run --filter '*/native-*' lint   # ktlint + swift-format across SDKs and harnesses
```

No `apiCheck`/`apiDump`: binary-compatibility-validator was wired then removed while the public shape is
unfrozen, and no `.api` dump is committed. It returns before the first publish — `explicitApi()` catches a
newly-public symbol but not a breaking change to an existing one.

## See Also

Children `sdk/{core,react,components}/AGENTS.md` · `packages/rpc/` (frame-connector source) · `apps/listener/AGENTS.md` (RPC consumer) · `sdk/{android,ios}/README.md` · `docs/plans/native-sdk/`.
