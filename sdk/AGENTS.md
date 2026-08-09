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
| Core (UI-free) | `id.frak.sdk:core` (`:frak-sdk`) | `FrakSDK` |
| UI (web view) | `id.frak.sdk:ui` (`:frak-sdk-ui`) | `FrakSDKUI` |
| Build | Gradle 9.5.0, AGP 9.1.1, Kotlin 2.4.10 → language/API level 2.2, JVM target 17, `compileSdk 36` | SwiftPM, tools-version 5.9 |
| Minimum | `minSdk 24`, `explicitApi()` on | iOS 15 |
| Registry | Maven Central Portal (not OSSRH — decommissioned). Namespace `id.frak.sdk` claimed, GPG key live, Portal token wired, `release-android-sdk.yml` on an `android-v*` tag. The Portal takes a zipped Maven tree over REST, so Gradle stages into a local `centralBundle` repo and the workflow uploads; both artifacts go in ONE deployment. `USER_MANAGED` by default. Nothing published yet | SPM only, no CocoaPods. Mirrored to [`frak-id/frak-ios-sdk`](https://github.com/frak-id/frak-ios-sdk) — SwiftPM reads `Package.swift` from a repo root only, so `sdk/ios` is unreachable to a merchant. `release-ios-sdk.yml` on an `ios-v*` tag; `main` seeded, no tags yet |

- **MVP surface implemented on both platforms**, one Android device pass only — the sharing sheet, the install handoff and inbound deep links have run nowhere, iOS nowhere at all. See `sdk/{android,ios}/README.md`.
- **CI lints/builds/tests both native SDKs, and there is still no publish path**: `.github/workflows/apps.yaml` runs `sdk/android` (ubuntu, JDK 17) and `sdk/ios` (macos-26) on every `dev`/`main` push and PR touching them. A `changes` job (`dorny/paths-filter`) gates each one, so an `apps/**`-only change never boots the 10×-billed macOS runner. **Android now runs `check` too** — `lint`, `build`, `test`, `apiCheck` and `check`, in that order. The narrower four are kept alongside `check` even though it subsumes them, so a failure is attributed by step name. That was previously skipped because Android Lint had never run and `apiCheck` was red without a dump; Android Lint has since run clean and both dumps are committed. Still no emulator or simulator anywhere. Publishing is **broken, not merely absent**: `publishToMavenLocal` fails in AGP's bundled Dokka, which cannot parse Kotlin 2.4 class files (A6 in `docs/plans/native-sdk/06-open-findings.md`), and `bun run --cwd sdk/ios xcframework` still exits 1.
- **Three iOS divergences, each forced by the platform**: the anonymous id lives in `UserDefaults` (Keychain survives uninstall) in its own `id.frak.sdk.identity` suite, alongside the Secure Enclave's wrapped key blob; `DeepLinkHandling` has no `.automatic` case, because a library cannot observe a host's `Scene`/`AppDelegate` URL callbacks the way it can Android's `ActivityLifecycleCallbacks`; the install fallback is a plain App Store URL, so the identity handoff only completes when the wallet is already installed.
- **The two wire formats are pinned to golden fixtures, not to each other.** The identity proof layout and the FrakContext v2 codec are asserted against `sdk/core/src/{identity,context}/fixtures/` on every platform. A port that does not assert against the corpus has not been ported.
- **Android dex budget: 256 KB per artifact** (`sdk/android/gradle.properties`). The check measures each module's own `classes.jar`, so it is meaningful for `:frak-sdk` and vacuous for `:frak-sdk-ui`.
- **`:frak-sdk` has zero third-party runtime deps** bar `kotlinx-coroutines-core`, which is `api` because `suspend`/`StateFlow` are in the public surface. `:frak-sdk-ui` ships Compose (`implementation`) and `androidx.activity` (`api` — `ComponentActivity` is a `FrakSharing.Builder.build` parameter and `ComponentDialog` hosts the sheet's window); that dependency load is the reason the two artifacts are split. Note the asymmetry: the `@Composable build()` overload is public but `androidx.compose.runtime` is only `implementation`, so a consumer must declare Compose themselves to call it. `08-sharing-sheet-api.md` step C moves Compose out of the base artifact and would settle this. Both iOS targets are genuinely dependency-free.
- **`explicitApi()` on Android is deliberate**: a merchant's binary freezes at store submission, so an accidentally-public helper is one we are stuck supporting forever.
- **`Presenter` lives in the UI artifact, not `sharing/`** — `client.sharing.buildLink()` is 100% local and must stay callable without the web view.
- **`FrakClient` is a sealed concrete class with five namespaces** (`config`, `rewards`, `sharing`, `tracking`, `appLink`), not an interface/protocol. Adding a member is additive on both platforms; nothing can substitute a fake for it, so `frak-sdk-ui`'s tests inject the narrow `SharingDependencies` interface and merchant tests should point `FrakEnvironment.Custom`/`.custom` at a stub server.
- **No exported activity, no intent filter in the SDK manifest**: inbound `fCtx` is wired through `FrakConfig.deepLink`, so the merchant's own router keeps owning their links.
- **`PrivacyInfo.xcprivacy` is a hard gate**: ITMS-91053 lands on the merchant's upload, not ours, and `FrakSDKUI` ships its own because it is separately consumable. Declared: `DeviceID`, `PurchaseHistory`, `ProductInteraction`, `UserID` on the core; `DeviceID` + `ProductInteraction` on the UI; `UserDefaults`/`CA92.1` as the only required-reason API, core only.

```bash
bun run --cwd sdk/android build   # assembleRelease — no device, this is a library
bun run --cwd sdk/android test    # JVM unit tests
bun run --cwd sdk/android check   # ktlint, ABI gate, tests, Android Lint, version drift, dex budget
bun run --cwd sdk/android apiDump # write api/*.api; the diff IS the ABI decision
bun run --cwd sdk/ios build       # swift build at an explicit iOS-simulator triple
bun run --cwd sdk/ios test        # two stages: compile at the iOS triple, then run on the host
bun run --filter '*/native-*' lint   # ktlint + swift-format across SDKs and harnesses
```

`apiCheck`/`apiDump` exist on Android and hang off `check`. **Both dumps are now committed** —
`frak-sdk/api/frak-sdk.api` and `frak-sdk-ui/api/frak-sdk-ui.api` — `apiCheck` passes, and it runs in CI.
Change a public signature and it goes red until you rerun `bun run --cwd sdk/android apiDump` (JDK 17 +
`ANDROID_HOME`) and review the diff, which *is* the ABI decision. Never run `apiDump` and `apiCheck` in one
Gradle invocation — Gradle rejects the undeclared implicit dependency; `run.sh` keeps them separate.
`explicitApi()` catches a newly-public symbol; only the dump catches a breaking change to an existing one.
The wiring is hand-rolled in `buildSrc` because binary-compatibility-validator registers nothing for an
AGP 9 Android library and its documented replacement is unavailable for the same reason — see
`docs/plans/native-sdk/09-android-api-surface.md` §5a, which is also the record of the Builder /
`*Async` / `Interaction` reshaping that gate freezes.

## See Also

Children `sdk/{core,react,components}/AGENTS.md` · `packages/rpc/` (frame-connector source) · `apps/listener/AGENTS.md` (RPC consumer) · `sdk/{android,ios}/README.md` · `docs/plans/native-sdk/`.
