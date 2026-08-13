# Audit — `apps/wallet` `/sharing` + `/install` as consumed by the native SDKs

Worktree: `/home/dev/wallet-audit` @ `c0a0cec` (read-only). No toolchain; every claim below is from reading code.

## Summary

The surface itself is unusually well built for an alpha: one `SharingView`/`InstallView` shared by the SPA route and the standalone entry, one param table (`SHARING_PARAMS`) both surfaces decode through, one `buildHostResultUrl` shape both SDKs parse, a sanitised `returnScheme`, a sanitised seeded reward, a real retry ladder and a real tier-3 fallback. It is not a fork and it is not sloppy.

Two things make it not alpha-ready. **The worst is that the sheet has no notion of "the document loaded but the app never rendered."** `onPageFinished`/`didFinish` sets `pageLoaded`, which cancels the 5 s load deadline *and* lifts the skeleton after 400 ms — so a 200-OK HTML whose JS never boots (a chunk 404 during a rolling deploy, a parse error on a pre-Chrome-107 WebView, any throw during module eval) leaves an empty sheet forever, tells the host nothing, and bypasses the native-share fallback that exists for exactly this. The only outcome the merchant ever sees is `Dismissed`, when the user swipes.

Second: this runtime contract — ~15 query params, 7 fragment keys, 8 action strings, one `<scheme>://result` shape, one scheme regex — is the surface a *frozen* store binary actually depends on, and it is the only surface in the whole native programme with no gate. Kotlin has a ratified `.api` dump and `apiCheck` in CI; the web contract has hand-copied literals in `search.test.ts` and a paragraph in `06-open-findings.md` saying a human re-checked it. `sdkVersion` is sent by both SDKs and read as telemetry only (`table.ts:75-76`). Nothing negotiates, nothing warns, nothing fails a build. A three-letter rename in the wallet bricks every shipped binary silently.

Everything else is smaller: the install-code handoff hangs off an unguarded WebView clipboard write; every non-en/fr device gets a **French** sheet and the merchant cannot override it; nginx silently drops the site's security headers on exactly these two paths; and the "budget the whole exercise exists to protect" measures under half of a cold share's bytes.

## Findings

### F1. A document that loads but renders nothing = an empty sheet forever, no outcome, no fallback

- **Severity**: blocker
- **Axis**: correctness
- **Complexity to fix**: small (<1d)
- **Evidence**:
  - `sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/SharingWebView.kt:340` — `onPageFinished` → `settledBinding.onPageReady()`; Android delivers this for any committed document, JS or no JS.
  - `sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/SharingSheetState.kt:241-244` — `fun onPageReady() { pageLoaded = true; settleContent() }`, and `:264-266` — `fun onLoadDeadline() { if (pageLoaded) return; … }`. The 5 s budget (`SharingPresentation.kt:59` `PAGE_LOAD_DEADLINE_MILLIS = 5_000L`) is therefore cancelled by document-finished, not by content.
  - `sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/FrakSharingSheet.kt:72-78` + `:244` — `SKELETON_GRACE_MILLIS = 400L`: "a finished document that produced no paint callback is uncovered on a short grace".
  - iOS identical: `SharingSheetModel.swift:212-216` (`onPageReady` → `.documentReady` + `settleContent`), `FrakSharingSheet.swift:177-189` (`skeletonGrace = 0.4` uncovers a finished document), `SharingWebView.swift:437-442` (`didFinish` → `onPageReady`).
  - Trigger 1, systematic: `apps/wallet/vite.standalone.config.ts` `target: "baseline-widely-available"` (≈ chrome107/safari16) against `minSdk 24`. A device whose WebView is frozen below that (no-Play AOSP/Huawei/Fire builds) gets a `SyntaxError` at parse and never runs a line.
  - Trigger 2, operational: `apps/wallet/nginx.conf:144` serves the HTML `no-store` while `:71-77` serves hashed chunks `immutable`. Fresh HTML from a new pod + a chunk request answered by an old pod during a rolling deploy = a 404 on a static import = nothing renders.
  - Trigger 3: any throw in `apps/wallet/app/entry/shared/bootstrap.tsx` (`initI18n`, `createRoot`) — `reportBootstrapFailure` records it and nothing else happens; `apps/wallet/app/entry/sharing/main.tsx:56` `.catch(reportBootstrapFailure)`.
- **What actually happens**: user taps Share in My Moulinex, the sheet slides up, the skeleton pulses for 400 ms, then they stare at an empty sheet (transparent web view over the system background) until they swipe it away. The merchant's `onResult` gets `Dismissed`. Nobody gets an error, nobody gets the OS share chooser, and the wallet's own `recordError` fires only if the JS got far enough to install the handlers — which in triggers 1 and 2 it did not.
- **Fix sketch**: make `ready` (not document-finished) the only thing that settles the content budget, and give `pageLoaded`-without-`ready` its own short watchdog (~1.5 s) that routes to `fallBack()`/`.nativeShare`; the page already sends `ready` from `useHostBridge.ts:24-36`. Add a `<noscript>`/inline `onerror` bailout in `sharing.html` that navigates to `<scheme>://result?action=error&sid=…` when the module fails to load.
- **Register status**: NEW. Adjacent to the closed 2.1/2.2 ("both sharing sheets misreading a failed load as ready"), which fixed *transport* failures only. The document-loads-JS-dies case is untouched and is the one a continuously deployed web app actually produces.

### F2. The frozen-binary web contract is unversioned, un-negotiated and has no cross-language gate

- **Severity**: high
- **Axis**: build-release / parity
- **Complexity to fix**: medium (few days)
- **Evidence**:
  - `apps/wallet/app/module/sharing/params/table.ts:56-94` — the whole param contract, with `sdkVersion: { decode: looseStr, transport: "query" }` and `/** Version of the native SDK that opened this page. Telemetry only. */` (`:75-76`). Its only consumer is `useSharingPageController.ts:151-155` (`sdk_version` on an analytics event).
  - Producers: `sdk/android/.../SharingPageUrl.kt:40-59,65-85,92-110` and `sdk/ios/.../SharingPageURL.swift:32-59,65-85,92-114`. Both hardcode `walletOrigin + "/sharing"` and `"/install"` with no version segment; `InstallLinks.kt:52-67`.
  - Consumer of the return channel: `SharingWebView.kt:307-317` (`url.scheme == returnScheme && url.host == SharingPageUrl.RESULT_HOST`, `sid` equality, then `fromWire`) and `SharingWebView.swift:384-397`.
  - The only "test" of the contract is hand-copied literals on each side: `apps/wallet/app/entry/shared/search.test.ts:11-14` ("the URLs below are the shapes emitted by `sdk/android/.../SharingPageUrl.kt` … change one there and this should go red" — nothing enforces that), `apps/wallet/app/module/sharing/host/bridge.test.ts:4` ("A shipped SDK binary parses these URLs, so the exact shape is the contract"), and `sdk/android/frak-sdk-ui/src/test/kotlin/.../SharingPageUrlTest.kt:10` which re-declares the wallet's regex as `Regex("^frak-[a-z0-9._-]{1,60}$")`.
  - Backend has a min-version gate but only for the *wallet app*: `services/backend/src/api/common/version.ts:19-22` (`MIN_VERSION_IOS`/`ANDROID`). `x-frak-sdk-version` is recorded and never checked (`services/backend/src/index.ts:64-65`).
  - No CI job reads a native file from the web side or vice versa: `search.test.ts` and `bridge.test.ts` are pure-TS.
- **What actually happens**: concrete silent breaks a wallet deploy can ship on any Tuesday, against a Moulinex binary frozen at submission —
  1. Rename `sid` (or stop echoing it): `sendHostResult` omits it → `url.getQueryParameter("sid") == binding.sessionId` fails on every action → **every** outcome of **every** sheet is dropped; shares, copies and installs all report `Dismissed`. One three-letter key, total loss, zero errors anywhere.
  2. Change `${scheme}://result?` (a path, a different host, a `#` payload): same total loss (`bridge.ts:38`).
  3. Rename an action string — `dismiss` → `dismissed`, `code` → `installCode`, or move the code out of `value` — `fromWire` returns `null` by design (`SharingWebView.kt:66`, `SharingWebView.swift:36`) → that outcome silently never happens. For `code` that means the user's install code never reaches the pasteboard.
  4. Tighten `assertHostClientId` (`guard.ts:21-30`) to require one more param → every shipped binary immediately gets `action=error` → `FrakError.InternalFailure("the sharing page refused to render")` (`SharingSheetState.kt:352`).
  5. Rename/retire a param: `link`/`products` → sheet renders with no product cards and no link (the CTAs still work because the host owns the share); `seedReward` → the first frame loses its headline; `state` → every warm page reports `sharing_page_viewed` and the funnel silently doubles; `view=confirmation` → a re-presented sheet lands on the share screen instead of the confirmation.
  6. Tighten `sanitizeReturnScheme`'s regex (`sanitizeReturnScheme.ts:8`) or `sanitizeSeededReward`'s `SHAPE` (`sanitizeSeededReward.ts:25-26`) → the former is case 1 again; the latter drops the seed.
  7. Move `/sharing` off nginx's exact-match location (`nginx.conf:138-149`) → `=404` by design, so tier-3 fires and the sheet degrades to a bare OS chooser for every user of every shipped binary.
- **Fix sketch**: pin the contract from *one* source — emit `sharing-contract.json` (param names + transports + action strings + result host + scheme regex) from `table.ts`/`bridge.ts`, commit it as a golden fixture next to `sdk/core/src/context/fixtures/golden-context.json`, and assert it from Kotlin/Swift tests the way `golden-context.json` is already asserted; add a wallet-side test that fails if a key in the fixture disappears from `SHARING_PARAMS`. Separately, decide and document a deprecation window (`05-build-and-release.md:67` promises one "before v1.0" for the SDK API and says nothing about this surface).
- **Register status**: overstated in `06-open-findings.md` §4 bullet "The native↔web sharing param contract, re-verified end to end". The re-verification is accurate as of this tree (I checked it: every param either platform emits has a `SHARING_PARAMS` entry, `FRAGMENT_KEYS` == both `activationFragment()` key sets, `state` absent on cold loads, `view=confirmation` appended by `SharingPageUrl.build` on Android and by `SharingSheetLogic.swift:49,57` on iOS). But it is filed under "Closed, for the record" when it is the largest live instance of the register's own §3.7/§3.8 pattern — hand-mirrored literals with no compiler link — and much larger than the two CSS variables §3.8 keeps open for exactly that reason.

### F3. The install-code handoff to the host sits behind an unguarded `navigator.clipboard.writeText`

- **Severity**: high
- **Axis**: correctness
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `apps/wallet/app/module/install/component/InstallView.tsx:302-311`
  ```ts
  const handleCopy = useCallback(async () => {
      if (!data?.code) return;
      await navigator.clipboard.writeText(data.code);   // ← no try/catch
      handOverCode();                                    // ← the native handoff
      trackEvent("install_code_copied", …);
      setCopied(true);
  ```
  `handOverCode` (`:272-284`) is the only thing that ever sends `action=code` to the host, and the comment two lines below the await says the host's write is the authoritative one ("same code, but marked sensitive and given an expiry"). `NativeShare.copyInstallCode` on the Android side is what actually sets the sensitive flag (`SharingSheetState.kt:344-347`).
- **What actually happens**: in an Android WebView the async Clipboard API is the least reliable thing on this page (no browser permission UI, permission delegated to the host app, historically `NotAllowedError`). If it rejects, the whole callback aborts: the button label never flips to "Copied!", the analytics event never fires, and — the real damage — the native host never receives the code, so the pasteboard is empty when the user lands in the freshly installed wallet and is asked for a code. The user sees a tap that did nothing. This is the primary install-handoff path and per `06-open-findings.md` D2b it has never run on a device.
- **Fix sketch**: call `handOverCode()` *first* (it is the authoritative write when a host exists), then `try { await navigator.clipboard.writeText(...) } catch {}`, and only gate the "Copied!" state on `returnScheme ? true : writeSucceeded`.
- **Register status**: NEW.

### F4. Localisation: nothing forwards a language, so every non-en/fr device gets a French sheet

- **Severity**: high
- **Axis**: merchant-setup / UX
- **Complexity to fix**: small (<1d) for the plumbing; large for actual translations
- **Evidence**:
  - `packages/wallet-shared/src/i18n/config.ts:3-7` — `supportedLngs = ["en","fr"]`, `fallbackLng = "fr"`. Only `locales/en` and `locales/fr` exist.
  - `apps/wallet/app/entry/shared/bootstrap.tsx` `detection.order = ["querystring","cookie","sessionStorage","localStorage","navigator"]` — `querystring` (i18next default key `lng`) is first, so a host *could* force the language for free.
  - Neither SDK sends it: `grep -n "lng\|locale\|language" sdk/android/frak-sdk-ui/src/main/kotlin/**/*.kt sdk/ios/Sources/FrakSDKUI/*.swift` → no matches. `SharingPageUrl.kt:40-59` and `SharingPageURL.swift:32-59` emit no locale param.
  - The SDKs *have* the value and use it elsewhere: `FrakConfig.kt:61` `public val lang: FrakLanguage?` → `config/MerchantQuery.kt:31,46` sends `"lang" to lang` to the backend for merchant copy. It is dropped on the floor for the sheet.
  - `apps/wallet/sharing.html:12` / `install.html:9` hardcode `<html lang="en">` and never update `documentElement.lang`.
- **What actually happens**: a My Moulinex user in Germany, Spain, Italy, Poland or the Netherlands taps Share inside a German-language app and gets a **French** sharing sheet (i18next resolves an unsupported detected language to `fallbackLng`). A merchant who explicitly set `FrakConfig.lang = EN` still gets whatever the device says. There is no API to override it and no `lng` param to reach for.
- **Fix sketch**: append `&lng=<FrakLanguage.wireValue>` in both `SharingPageUrl.build/warm` (and `InstallLinks.installPage`), defaulting to the device language when unset; on the wallet side make `fallbackLng` `"en"` for a non-fr device or ship the locales the first merchant's markets need.
- **Register status**: NEW. The register has no localisation row at all.

### F5. nginx silently strips the site's security headers on `/sharing` and `/install`

- **Severity**: medium
- **Axis**: security
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `apps/wallet/nginx.conf:47-59` sets `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` at `server{}` scope. `location = /sharing` (`:138-149`) and `location = /install` (`:151-160`) each declare their own `add_header` set — and nginx's rule is that `add_header` is inherited *only if the current level declares none*. So on exactly these two paths the effective headers are `Cache-Control`, `Pragma`, `Expires`, `X-Content-Type-Options` (re-added, minus `always`) and nothing else. There is no CSP anywhere in the repo (`grep -rn "Content-Security-Policy" infra/ apps/ sst.config.ts` → only the nginx file, which does not set one).
- **What actually happens**: `https://wallet.frak.id/sharing?...` is framable by any origin. Combined with F13 (`link` is unvalidated) that is a Frak-branded, wallet-origin "share this link and earn" dialog an attacker can frame and parameterise. `/install`, which mints a real install code on load, is equally framable. The SPA keeps its protection; the two SDK-critical pages lost it, and the loss is invisible because nothing tests headers.
- **Fix sketch**: repeat the six server-level `add_header … always` lines in both locations (or move them to an `include snippets/security-headers.conf`), and add `frame-ancestors 'none'` via a CSP while there.
- **Register status**: NEW.

### F6. The eager-JS budget measures under half of a cold share, and 3G loses the sheet entirely

- **Severity**: medium
- **Axis**: performance / UX
- **Complexity to fix**: medium (few days)
- **Evidence**:
  - `apps/wallet/vite.standalone.config.ts` — `EAGER_JS_BUDGET_GZIP = 105 * 1024`, described as "the number the whole exercise exists to protect", measured at "90 KB gz for `/sharing`".
  - `packages/dev-tooling/src/vite.ts:248-283,310-331` — `assertEagerBundleBudget` walks `<script src>` only and gzips **JS chunks**. CSS, HTML, fonts and every dynamically imported chunk are outside it.
  - Unbudgeted, and on the critical path: `inlineFontFaces` (`vite.standalone.config.ts`, plugin at `packages/dev-tooling/src/vite.ts:428-464`) inlines both font stylesheets and preloads `/fonts/inter-latin.woff2`. Actual sizes: `apps/wallet/public/fonts/inter-latin.woff2` 47.1 KB + `inter-tight-latin.woff2` 43.8 KB = **~91 KB of fonts** on a cold open (both families are used — headings are Inter Tight), plus `inter-latin-ext.woff2` 83.1 KB / `inter-tight-latin-ext.woff2` 87.7 KB the moment a merchant name or product title contains a Polish/Czech/Turkish diacritic (`public/fonts/inter.css` unicode-range).
  - Also outside the budget: the lazily-imported English locale (`bootstrap.tsx` `await import(".../locales/en/standalone")`, chunked as `i18n-en` in the vite config) — an extra round trip on the critical path for every English user.
  - The deadline it has to beat: 5 s on both platforms (`SharingPresentation.kt:59`, `SharingSheetModel.swift:18`), covering DNS + TLS + HTML (`no-store`, always network) + JS + CSS + fonts + the reward/config XHRs.
- **What actually happens**: a realistic cold share is ~90 KB gz JS + CSS + ~91 KB fonts + an i18n round trip + 2 backend calls, i.e. roughly 200 KB and 4–5 serial round trips. On Regular 3G that is borderline against 5 s; on Slow 3G it loses, and the sheet the whole product is about never appears — the user gets the bare OS share chooser (tier 3, `SharingSheetState.kt:392-405`) with a raw link and no reward messaging, and the merchant's dashboard records a normal `Shared`. The budget's own docstring implies the cold-load cost is bounded at 105 KB; it bounds roughly 45 % of it.
- **Fix sketch**: extend the budget plugin to count emitted CSS and preloaded/`@font-face`-referenced fonts, or add a second explicit `TOTAL_COLD_BYTES` assertion; subset the two latin woff2s to the glyphs these two pages actually use (or drop Inter Tight here); bundle the `en` locale subset eagerly (it is a few KB) instead of paying a round trip for it.
- **Register status**: NEW.

### F7. The retry ladder's cache-only rung cannot ever succeed: the documents are `no-store`

- **Severity**: medium
- **Axis**: correctness / performance
- **Complexity to fix**: small (<1d)
- **Evidence**: `apps/wallet/nginx.conf:144` (and `:155`) — `Cache-Control: "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"`, `etag off`, on both `/sharing` and `/install`. The ladders: `SharingWebView.kt:487-495` — rung 2 is `Rung(delayMillis = 900L, cacheOnly = true)` applied as `WebSettings.LOAD_CACHE_ONLY`; `SharingWebView.swift:335-339` — `Rung(delay: 0.9, cacheOnly: true)` applied as `.returnCacheDataDontLoad`. Both are documented as "the only thing that can answer for a device that went offline on a page it has seen before" (`SharingWebView.kt:378-381`). A `no-store` response is never in the HTTP cache, so the rung always fails.
- **What actually happens**: offline or on a dead radio, the sheet spends its budget on a rung that structurally cannot answer, then falls back — the fallback is fine, but the "works offline if you've seen it" property the code claims does not exist, and the wait before tier 3 is longer than it needs to be. Worse for Android, where `SharingWebViewPool.release()` re-warms with a full navigation after every sheet close (`SharingWebViewPool.kt:99-106`), so every close costs a fresh network HTML fetch that can never be served from cache.
- **Fix sketch**: either drop the cache-only rung and go to tier 3 sooner, or make the HTML cacheable for a few seconds (`max-age=0, must-revalidate` + ETag) so a stale-while-offline read is actually possible.
- **Register status**: NEW.

### F8. English devices render the sheet in French first (`bindI18nStore` missing)

- **Severity**: medium
- **Axis**: UX
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `apps/wallet/app/entry/shared/bootstrap.tsx` — French is bundled, English is added later via `i18next.on("languageChanged", … addResourceBundle(...))`, and `init()` is awaited but the async handler is not. react-i18next's defaults are `bindI18n: "languageChanged"`, `bindI18nStore: ""`, so an `addResourceBundle` (`added` store event) triggers no re-render. The same repo knows this: `apps/business/src/main.tsx:51-57` sets `react: { bindI18nStore: "added" }` and `apps/business/src/i18n/loadBundle.ts:10` documents *why*. Neither `bootstrap.tsx` nor the SPA's `apps/wallet/app/main.tsx:46-55` sets it.
- **What actually happens**: on an English device the first paint of the sheet is French (fallbackLng) and stays French until something unrelated re-renders — normally the reward/config query settling, i.e. a visible language flip a few hundred ms in, and no flip at all on a surface where no query resolves.
- **Fix sketch**: `initReactI18next` init with `react: { bindI18nStore: "added" }`, or bundle the `en` standalone subset eagerly (see F6) and delete the lazy path.
- **Register status**: NEW.

### F9. Only one failure mode ever reports `error`; everything else is indistinguishable from a dismissal

- **Severity**: medium
- **Axis**: correctness / DX
- **Complexity to fix**: small (<1d)
- **Evidence**: the only producers of `action=error` are the missing-`clientId` guard, on both surfaces: `apps/wallet/app/entry/sharing/main.tsx:38-46` and `apps/wallet/app/routes/sharing.tsx:25-34`. `SharingView.tsx:121-152` wires `share/copy/dismiss/shareAgain/install` and no error outcome; `useSharingPageController.ts:35-50` has no error channel in `SharingOutcomes`. Failure paths that therefore report nothing: the reward query failing (`useFormattedEstimatedReward`), `useMerchantResolvedConfig` 4xx on a bad `merchantId`, `useSharingIdentity`'s 5-retry order-client lookup exhausting (`useSharingIdentity.ts:50-51`), and on `/install` a failed or rate-limited code generation — `useGenerateInstallCode.ts:30-31` throws and `InstallView.tsx:365-369` renders `t("installCode.error")` and stops. That endpoint is capped at **5 requests / 60 s** (`services/backend/src/api/user/identity/installCode.ts:9`), which a shared-NAT office wifi can exhaust.
- **What actually happens**: the user sees an error string inside the sheet (or an install page with no code), has no button to press, swipes it away, and the merchant's callback receives `SharingResult.Dismissed`. There is no signal anywhere that distinguishes "the user changed their mind" from "our backend 429'd", so the alpha's most important metric — did the sheet work — is unmeasurable from the host side.
- **Fix sketch**: add an `error` outcome to `SharingOutcomes`, fire it from the page's error states (reward-independent failures excluded), and give `HostResultAction: "error"` an optional `reason` param the SDKs pass into `FrakError`.
- **Register status**: NEW.

### F10. Android's return-scheme derivation is Unicode-aware where the wallet's regex is ASCII-only; iOS guards, Android does not

- **Severity**: low
- **Axis**: parity / correctness
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/SharingPageUrl.kt:20` — `.filter { it.isDigit() || it in 'a'..'z' || it in ".-_" }`; Kotlin's `Char.isDigit()` is `Character.isDigit`, i.e. any Unicode `Nd`. iOS does the same filter but with an explicit ASCII gate: `SharingPageURL.swift:24` — `.filter { $0.isASCII && ($0.isNumber || …) }`. The wallet accepts only `^frak-[a-z0-9._-]{1,60}$` (`sanitizeReturnScheme.ts:8`). `SharingPageUrlTest.kt:10-28` re-declares that regex by hand and tests `com.Acme.App`, `com.acme:remote`, `"a"*200`, `"///"` — no non-ASCII case.
- **What actually happens**: an application id containing a non-ASCII digit produces a scheme the wallet silently rejects (`returnScheme` decodes to `undefined`) → `canHandOff` false, `sendHostResult` returns false for everything → the sheet works visually and reports nothing, forever. Play Console forbids such ids, so this is latent rather than live; it is included because it is the cheapest possible demonstration that the two implementations of one regex have already drifted.
- **Fix sketch**: add `it.code < 128 &&` to the Android filter and a non-ASCII case to `SharingPageUrlTest`.
- **Register status**: NEW.

### F11. Two SPA routes are structurally reachable inside the sheet, and the register's justification for withdrawing 9.12 quotes a KDoc that no longer exists

- **Severity**: low
- **Axis**: correctness / docs-accuracy
- **Complexity to fix**: small (<1d)
- **Evidence**:
  - Same-origin navigation inside the sheet web view is unrestricted: `SharingWebView.kt:319-321` (`if (isSameOrigin(url)) return false`) and `SharingWebView.swift:399-402` (`.allow`).
  - `InstallView.tsx:83` `shouldShowCodeView = !IS_TAURI && !getSafeSession()?.token` → with a token present the sheet renders `InstallProcessing`, which navigates out: `apps/wallet/app/entry/install/main.tsx:39-40` — `toWallet: () => window.location.replace("/wallet")`, `toRegister: () => window.location.replace("/register")`. `getSafeSession` reads `localStorage["frak_session_store"]` (`packages/wallet-shared/src/common/utils/safeSession.ts:20-30`, `stores/sessionStore.ts:12-37`), which the WebView shares app-wide with any other WebView on the wallet origin (iOS explicitly uses `.default()`: `SharingWebView.swift:124`).
  - `/wallet` and `/register` are real SPA routes (`app/routes/_wallet/_protected/wallet.tsx`, `_wallet/_auth/register.tsx`), read no `embed`, boot the ~390 KB shell inside a bottom sheet, and can report nothing to the host. `/register` is the WebAuthn registration flow, which neither WKWebView nor Android WebView can complete.
  - Consumers of the helper today are exactly three: `SharingView.tsx:75`, `InstallView.tsx:289`, and the inline viewport scripts in `sharing.html`/`install.html`.
  - Docs-accuracy: `06-open-findings.md` §3.5 withdraws 9.12 on the grounds that "`hostEmbed.ts`'s KDoc claims every route the sheet can reach reads that helper *and nothing else*". `apps/wallet/app/module/common/utils/hostEmbed.ts:1-20` contains no such claim (it says "How a page reachable from a native host's web view decides it is embedded"). The register is arguing against text that is not there, and the substantive question — which routes are reachable — was never answered.
- **What actually happens**: rare in practice (needs a wallet session in that WebView's localStorage), but when it happens the sheet becomes a broken mini-wallet with no exit and no result. It is also a standing trap: any future in-page navigation to an SPA route inherits it silently.
- **Fix sketch**: in `entry/install/main.tsx`, when `embed=native`, report `dismiss`/`error` to the host instead of navigating to `/wallet`/`/register`; and have the SDKs cancel same-origin navigations outside an allowlist of `/sharing` and `/install`.
- **Register status**: CONTRADICTS the withdrawal rationale of 9.12 (the quoted KDoc claim does not exist in this tree); the reachability question itself is NEW.

### F12. Every sheet close costs a network HTML fetch and an inflated `sharing_page_preloaded`

- **Severity**: low
- **Axis**: performance / docs-accuracy
- **Complexity to fix**: small (<1d)
- **Evidence**: `SharingWebViewPool.kt:99-106` re-warms with a full navigation on every `release()`; the document is `no-store` (`nginx.conf:144`), so that is a real network request each time. `state=warm` (`SharingPageUrl.kt:74`) makes the page emit `sharing_page_preloaded` (`useSharingPageController.ts:150-156`) on each of those loads.
- **What actually happens**: N sheet opens produce N+1 preload events and N+1 HTML fetches, so the preload→view funnel the `state` param exists to protect is not measuring what it claims, and a data-capped user pays for a page they already closed.
- **Fix sketch**: only re-warm on foreground/next `warm()` call, or tag automatic re-warms distinctly.
- **Register status**: NEW.

### F13. `link` and `logoUrl` are unvalidated on a framable wallet-origin page

- **Severity**: low
- **Axis**: security
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `table.ts:59,61` — `link: { decode: str, transport: "both" }`, `logoUrl: { decode: str, transport: "both" }`, versus `redirectUrl: { decode: sanitizeRedirectUrl }` (`:64`, which enforces https and strips query/hash) and `seedReward: { decode: sanitizeSeededReward }` (`:79`). `link` becomes the shared URL via `buildSharingLink` (`SharingView.tsx:105` → `packages/wallet-shared/src/sharing/buildSharingLink.ts:49-59`); `logoUrl` becomes an `<img src>` through `mediaSrcSet` (`InstallView.tsx:325-329`).
- **What actually happens**: with F5 removing `X-Frame-Options`, any site can frame `wallet.frak.id/sharing?merchantId=…&link=https://evil.example&appName=…&logoUrl=…` and present a Frak-branded "share and earn" dialog for an attacker-chosen URL and brand. No XSS (`<img>` cannot execute, and `ExternalLink` already gates schemes at `packages/wallet-shared/src/common/component/ExternalLink/index.tsx:12-22`) — it is brand/phishing surface plus an arbitrary outbound image request from a wallet-origin document.
- **Fix sketch**: run `link` and `logoUrl` through an https-only sanitiser (`sanitizeRedirectUrl`'s shape, without the query-stripping for `link`).
- **Register status**: NEW.

## Verified-OK

- **No fork**: the SPA route and the standalone entry render the same `SharingView`/`InstallView` and decode through the same `parseSharingSearch`/`parseInstallSearch` (`routes/sharing.tsx:21`, `entry/sharing/main.tsx:24`; `routes/install.tsx:15`, `entry/install/main.tsx:22`). The guard is genuinely shared (`module/sharing/guard.ts:21`), including the `error` report on rejection.
- **Param contract, as of this tree**: every param either SDK emits (`embed, merchantId, clientId, returnScheme, sid, sdkVersion, appName, logoUrl, link, products, seedReward, view, state` + `/install`'s `m, a, p`) has a `SHARING_PARAMS`/`InstallSearch` entry; `FRAGMENT_KEYS` (link, logoUrl, products, sid, seedReward, state, view) is exactly what both `activationFragment()` implementations can send; `state`'s `fragmentDefault: "live"` correctly un-warms a fragment that omits it; `view=confirmation` is appended on both platforms (`SharingPageUrl.kt:58`, `SharingSheetLogic.swift:49,57`).
- **No `view`/`state` leak across pooled sessions**: cold `build()` URLs carry `sid` in the query, so a later session's base URL never matches and always does a full load; only `warm()` URLs (no `view`) are fragment-activated.
- **Return-channel hardening**: `sid` equality check before dispatch on both platforms (`SharingWebView.kt:309`, `SharingWebView.swift:386`); `WARM_SESSION_ID`/`warmSessionId` can never match a real sheet; unknown actions parse to null by design; `buildHostResultUrl` percent-escapes `sid`/`value` so neither can inject `action=` (`bridge.test.ts:37-45,63-71`); `sendHostResult` dedupes per `(sid, action, value)` with `share/copy/ready` exempt (`bridge.ts:46-84`).
- **`returnScheme` and `seedReward` sanitisation** are real and correctly scoped: `^frak-[a-z0-9._-]{1,60}$` (`sanitizeReturnScheme.ts:8`) and a currency-shape regex that correctly covers both U+00A0 and the U+202F that modern ICU emits for fr-FR (`sanitizeSeededReward.ts:25-26`) — which matches what the backend actually produces (`sdk/core/src/utils/format/formatAmount.ts:18-23`, locale derived from currency; `services/backend/.../merchant/index.test.ts:110` asserts `"12\u00a0€"`).
- **Cookies/ITP are a non-issue**: auth is header-based (`x-wallet-auth` / `x-wallet-sdk-auth` / `x-frak-client-id`, `packages/wallet-shared/src/common/api/backendClient.ts:19-40`); `credentials: "include"` is vestigial for these pages. Third-party cookies are off on Android (`SharingWebView.kt:209`) and blocked by WKWebView anyway, with no effect on any reachable call. `localStorage`/`sessionStorage` are only used for the confirmation memo (`sharing/utils/confirmation.ts:54-90`, try/catch-guarded, correctly scoped by merchant+client+products because one pooled document serves every sheet) and the session read, both degrade cleanly.
- **No WebAuthn on any route the sheet actually reaches** (`/sharing`, `/install` code view, external store/legal links). `/register` is only reachable via the logged-out `InstallProcessing` branch, which the standalone build cannot enter (`IS_TAURI` is a build-time `false`, and the branch requires a token).
- **Cross-origin egress from the sheet is correct**: legal links and store links are `target="_blank"` + scheme-allowlisted (`ExternalLink/index.tsx:12-22`) and both SDKs route them to the browser rather than loading them in the sheet (`SharingWebView.kt:319-322`, `SharingWebView.swift:405-407`), including the `nil targetFrame` case on iOS. Store click hands the code over *before* navigating (`InstallView.tsx:424-435`), which is the one clipboard path that is ordered correctly.
- **`isAndroid` UA sniffing works in both web views** (`InstallView.tsx:291`), so the Play-referrer install URL is used on Android and the App Store URL on iOS.
- **nginx routing for these two paths is deliberately fail-loud** (`try_files … =404`, `nginx.conf:140,153`) rather than silently falling back to the SPA — good call, and it is also F2's most dangerous single point.

## Could not verify

- Actual bundle sizes (90 KB gz `/sharing`, 72 KB `/install`) and the emitted CSS weight — no toolchain; F6's numbers are the measurable parts (font bytes on disk, the budget's documented scope) plus arithmetic.
- Whether `navigator.clipboard.writeText` actually rejects in a current Android WebView / WKWebView (needs a device — F3's ordering defect is unconditional either way).
- The exact `baseline-widely-available` browser floor for the installed rolldown-vite version (documented as chrome107/edge107/firefox104/safari16 for Vite ≥6.3), and what share of `minSdk 24` devices sit below it.
- Whether the double-`requestAnimationFrame` `ready` ping reliably fires on iOS for a fragment activation delivered before the sheet's web view is in a window — the iOS code says it does not run until then and works around it (`SharingSheetModel.swift:420-428`), but the timing is device-only.
- Real 3G numbers against the 5 s deadline.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "13 ranked findings written to /tmp/frak-audit/wallet-web-surface.md, each with severity, axis, fix-complexity, path:line evidence and register status; 1 blocker (F1: document-loaded-but-JS-dead leaves an empty sheet with no host report and no tier-3 fallback — SharingSheetState.kt:241-266, FrakSharingSheet.kt:72-78/244, SharingSheetModel.swift:212-216, FrakSharingSheet.swift:177-189), 3 high (F2 unversioned frozen-binary web contract, F3 InstallView.tsx:302-311 unguarded clipboard write before the native code handoff, F4 no lng forwarded so non-en/fr devices get French), 4 medium, 5 low."
    }
  ],
  "changedFiles": [],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "rg/grep/sed/find over apps/wallet/app/entry, apps/wallet/app/module/{sharing,install}, packages/wallet-shared/src/{sharing,i18n,common}, apps/wallet/nginx.conf, apps/wallet/vite.standalone.config.ts, packages/dev-tooling/src/vite.ts, sdk/android/frak-sdk-ui, sdk/ios/Sources/FrakSDKUI, services/backend/src",
      "result": "passed",
      "summary": "read-only inspection; no build or test runner available (no JDK, no Android SDK, no Swift toolchain)"
    }
  ],
  "validationOutput": [
    "No repo file modified; artifact written only under /tmp/frak-audit/.",
    "Every finding carries at least one path:line citation; decisive code quoted inline for F1, F2, F3, F5, F8.",
    "Register cross-checks: F2 marked 'overstated in 06-open-findings.md §4 native<->web param contract bullet' (the manual re-verification is accurate for this tree but is filed as closed when it is the largest live instance of the register's own §3.7/§3.8 hand-mirrored-literal pattern); F11 marked CONTRADICTS the 9.12 withdrawal rationale, which quotes a hostEmbed.ts KDoc claim absent from hostEmbed.ts:1-20."
  ],
  "residualRisks": [
    "Bundle byte totals and CSS weight are estimates: no toolchain to build, so F6 rests on font sizes on disk plus the budget plugin's documented scope (packages/dev-tooling/src/vite.ts:248-331).",
    "F3's WebView-specific clipboard rejection and F1's pre-Chrome-107 WebView share are device-only questions; both findings stand on the code path regardless.",
    "iOS ready-ping timing for a fragment activation delivered before the web view is in a window is unverifiable without a simulator (register T3/D2b: the sheet has never run on iOS at all).",
    "The /wallet and /register in-sheet reachability in F11 requires a wallet session in that WebView's localStorage; I could not construct a real-world sequence that puts one there, so the severity is low and the value is the standing trap, not a live bug.",
    "I did not audit the Shopify post-purchase consumer of the same pages; a fix to the param table could break it too."
  ],
  "noStagedFiles": true,
  "diffSummary": "No repo changes. One new artifact: /tmp/frak-audit/wallet-web-surface.md.",
  "reviewFindings": [
    "blocker: sdk/android/frak-sdk-ui/.../SharingSheetState.kt:241-244,264-266 + FrakSharingSheet.kt:72-78,244 (iOS twins SharingSheetModel.swift:212-216, FrakSharingSheet.swift:177-189) - document-finished sets pageLoaded, which cancels the 5s load deadline and lifts the skeleton after 400ms, so a 200-OK HTML whose JS never boots (chunk 404 mid rolling deploy, parse error on a pre-Chrome-107 WebView against minSdk 24, any bootstrap throw) leaves an empty sheet forever, reports nothing to the host and bypasses the native-share fallback; merchant only ever sees Dismissed.",
    "high: apps/wallet/app/module/sharing/params/table.ts:56-94,75-76 + sdk/{android,ios} SharingPageUrl{.kt,.swift} + bridge.ts:38 - the runtime contract a frozen store binary depends on (15 params, 7 fragment keys, 8 action strings, one <scheme>://result shape, one scheme regex) is unversioned, sdkVersion is telemetry only, and the only cross-language check is hand-copied literals in search.test.ts:11-14 / bridge.test.ts:4 / SharingPageUrlTest.kt:10; renaming sid alone silently drops every outcome of every shipped binary.",
    "high: apps/wallet/app/module/install/component/InstallView.tsx:302-311 - `await navigator.clipboard.writeText(...)` is unguarded and sits BEFORE handOverCode(), the only path that ever sends action=code to the host; a clipboard rejection in a WebView kills the native handoff, the Copied! state and the analytics event.",
    "high: sdk/{android,ios} sharing URL builders emit no locale param while apps/wallet/app/entry/shared/bootstrap.tsx puts querystring first in the i18next detection order and packages/wallet-shared/src/i18n/config.ts:3-7 has only en/fr with fallbackLng=fr - every de/es/it/nl/pl device gets a French sheet, and FrakConfig.lang (used for backend copy at config/MerchantQuery.kt:31,46) is never forwarded.",
    "medium: apps/wallet/nginx.conf:47-59 vs :138-160 - the per-location add_header blocks drop the server-level X-Frame-Options/Referrer-Policy/Permissions-Policy/COOP for exactly /sharing and /install (nginx inherits add_header only when the level declares none), and there is no CSP anywhere; both SDK-critical pages are framable by any origin.",
    "medium: apps/wallet/vite.standalone.config.ts + packages/dev-tooling/src/vite.ts:248-331 - assertEagerBundleBudget counts JS chunks only, so ~91 KB of woff2 (inter-latin 47.1K + inter-tight-latin 43.8K), all CSS and the lazily fetched en locale sit outside the number the exercise exists to protect; against a 5s deadline (SharingPresentation.kt:59, SharingSheetModel.swift:18) a 3G cold share loses the sheet and silently degrades to the OS chooser.",
    "medium: apps/wallet/nginx.conf:144,155 vs SharingWebView.kt:487-495 / SharingWebView.swift:335-339 - the ladder's cache-only rung cannot ever succeed because both documents are no-store, so the documented offline fallback does not exist and Android's per-close re-warm (SharingWebViewPool.kt:99-106) is always a network fetch.",
    "medium: apps/wallet/app/entry/shared/bootstrap.tsx - react-i18next's bindI18nStore default is '' and is not overridden (apps/business/src/main.tsx:51-57 does override it, with a comment saying why), so English devices paint French until an unrelated re-render.",
    "medium: apps/wallet/app/entry/sharing/main.tsx:38-46 is the only producer of action=error, and SharingView.tsx:121-152 / useSharingPageController.ts:35-50 have no error channel, so a failed reward query, a bad merchantId or a 429 from the 5-req/min install-code endpoint (services/backend/src/api/user/identity/installCode.ts:9) is reported to the merchant as Dismissed.",
    "low: sdk/android/.../SharingPageUrl.kt:20 uses Unicode-aware Char.isDigit() where SharingPageURL.swift:24 gates on isASCII and the wallet regex (sanitizeReturnScheme.ts:8) is ASCII-only; a non-ASCII digit in the application id yields a scheme the wallet silently rejects and a sheet that reports nothing.",
    "low: SharingWebView.kt:319-321 / SharingWebView.swift:399-402 allow any same-origin navigation, and entry/install/main.tsx:39-40 can navigate the sheet to /wallet or /register - SPA routes that read no embed, boot the ~390 KB shell inside a bottom sheet and cannot report to the host (/register additionally needs WebAuthn, which no WebView supports).",
    "low: docs/plans/native-sdk/06-open-findings.md withdraws 9.12 by quoting a hostEmbed.ts KDoc claim ('every route the sheet can reach reads that helper and nothing else') that does not exist in hostEmbed.ts:1-20, and never answers the reachability question the row was about.",
    "low: SharingWebViewPool.kt:99-106 + useSharingPageController.ts:150-156 - every sheet close triggers a full no-store re-warm and therefore an extra sharing_page_preloaded, so the preload-to-view funnel the state param exists to protect is inflated by one event per close.",
    "low: table.ts:59,61 - link and logoUrl are raw `str` decodes on a page that is framable (see F5) and turns link into the URL the user shares; sanitizeRedirectUrl/sanitizeSeededReward exist for the neighbouring params."
  ],
  "manualNotes": "Two things the parent should weigh. (1) F1 and F2 are the same underlying gap seen from two ends: the sheet trusts 'the document loaded' as 'the app works', and nothing anywhere pins the web contract a frozen binary depends on. Fixing F1 (make the page's own `ready` the only content signal, plus a watchdog) also converts most F2 breakages from a silent hang into a tier-3 fallback, so it is the highest-leverage change on this surface and it is roughly a day's work on each platform. (2) The plan corpus is genuinely accurate on the Kotlin/Swift ABI and genuinely blind to this surface: 06-open-findings.md files two hand-mirrored CSS variable names as open (§3.8) while filing the far larger hand-mirrored param/action contract as closed (§4). I would move that bullet out of §4 and give it an id. Note also that any fix to the param table has a second consumer I did not audit: Shopify's post-purchase card opens the same pages."
}
```
