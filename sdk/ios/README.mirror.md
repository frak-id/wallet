# Frak iOS SDK

Referral tracking and rewards for iOS apps. Zero third-party dependencies.

> **Pre-release.** The sharing sheet has had one device pass (iPhone 15, iOS 26, 2026-08-13):
> it opens, shares, and pools one web-content process across repeated opens. The install
> handoff has never been exercised outside a test suite, and no run has happened below
> iOS 26. Pin an exact version and expect breaking changes until 1.0.

## What is supported

| | Status |
|---|---|
| **iOS floor** | 15.0. The package declares it and CI compiles at `arm64-apple-ios15.0-simulator`, so an unguarded iOS 16+ API is a build error |
| **SwiftUI** | Fully supported, both the core SDK and the sharing sheet |
| **UIKit** | Supported. Core SDK as-is; the sheet through `FrakSharing` rather than the SwiftUI modifier |
| **Objective-C** | Not supported. See the note under *Sharing sheet — UIKit* |
| **Xcode** | 16 or newer, for Swift 6 language mode |

**iOS 15 and 16 are supported but not verified.** The sheet degrades where the OS gives it less to
work with: no resizable detent below iOS 16, so the sheet is full height there, and no clear sheet
background below 16.4. Both are handled, neither has been exercised on a device — Xcode 26 cannot
install a simulator runtime that old, so verifying it needs physical hardware. Report anything odd
on those versions and it will be treated as a real bug.

## Install

Xcode → File → Add Package Dependencies → `https://github.com/frak-id/frak-ios-sdk`

Or in a `Package.swift`:

No tag exists yet, so pin the branch until the first release is cut:

```swift
dependencies: [
    .package(url: "https://github.com/frak-id/frak-ios-sdk.git", branch: "main")
],
targets: [
    .target(name: "YourApp", dependencies: [
        .product(name: "FrakSDK", package: "frak-ios-sdk"),
    ])
]
```

Two products. Take only what you need:

| Product | Contents |
| --- | --- |
| `FrakSDK` | Identity, config, rewards, interaction tracking, referral links. No UI, no web view. |
| `FrakSDKUI` | Adds the sharing sheet (`WKWebView` in a SwiftUI sheet). Depends on `FrakSDK`. |

The dependency never runs the other way, so taking `FrakSDK` alone links no web view.

**Requires iOS 15+ and Xcode 16+.** The Xcode floor comes from the manifest declaring
Swift 6 language mode, so your build compiles this package the same way its CI does.

## Before your first call

**Frak must allow-list your bundle id against your merchant id.** Ask us to do it before you
integrate. Until it is done every call fails with `merchantResolutionFailed` — and
`tracking.purchase` still returns success, because tracking is queued and best-effort, so the
failure is silent unless you turn logging on (below).

## Quickstart

```swift
import FrakSDK

Frak.initialize(
    FrakConfig(
        merchantId: "your-merchant-id",
        metadata: FrakMetadata(name: "Your App", currency: .eur),
        // Default is `.none`. Every diagnostic the SDK writes — including the two above —
        // is dropped on the floor until you raise this.
        logLevel: .debug
    )
)
```

`Frak.client` is throwing-synchronous; every namespace member on it is `async`:

```swift
// `try`, because both the `client` getter and `best` throw.
let reward = try await Frak.clientOrNull?.rewards.best(targetInteraction: "purchase")
// `purchase` does not throw — it returns a Result — but the `client` getter still does.
let outcome = try await Frak.client.tracking.purchase(
    customerId: "c", orderId: "o", token: "t"
)
```

### Sharing sheet — SwiftUI

```swift
import FrakSDKUI

struct ProductView: View {
    @State private var sharing = false

    var body: some View {
        Button("Share") { sharing = true }
            .frakSharingSheet(isPresented: $sharing, request: request) { result in
                // handle SharingResult
            }
    }
}
```

`FrakSharingConfiguration` tunes the sheet's height and picks which App Store surface the
install step raises — an `SKStoreProductViewController` page (the default) or an
`SKOverlay` banner:

```swift
.frakSharingSheet(
    isPresented: $sharing,
    request: request,
    configuration: FrakSharingConfiguration(
        heightFraction: 0.9,
        install: .overlay(.init(position: .bottomRaised))
    )
) { result in
    // handle SharingResult
}
```

While that surface is up, the sheet polls for the wallet becoming installable and hands off
deterministically — no install code needed — reporting `.walletOpened`. Set
`detectInstall: false` to keep the store surface without the polling; the same
`LSApplicationQueriesSchemes` entry `isFrakAppInstalled()` already needs is what makes either
one work at all.

### Sharing sheet — UIKit

`frakSharingSheet` is a SwiftUI `ViewModifier`, so a UIKit screen uses `FrakSharing` instead. Both
drive the same session machinery and the same pooled web view; the Android SDK is split the same
way, between the Compose modifier and `FrakSharing.Builder.build(activity)`.

```swift
import FrakSDKUI

final class ProductViewController: UIViewController {
    private var sharing: FrakSharing?

    override func viewDidLoad() {
        super.viewDidLoad()
        sharing = FrakSharing(presentingFrom: self) { result in
            // handle SharingResult
        }
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        // Boots the web view and the identity/config reads before the tap.
        sharing?.warm()
    }

    @objc private func shareTapped() {
        sharing?.present(request)
    }
}
```

Hold the instance for as long as the screen lives — releasing it takes the warm web view with it and
the next share pays a cold start. It takes the same `FrakSharingConfiguration` as the modifier, and
holds the presenting controller weakly, so it never keeps a screen alive.

**Objective-C is not supported.** The SDK's surface is Swift structs, enums with associated values
and `async` methods, none of which bridge, so using it from Objective-C means adding a Swift bridge
file to your app. That is a deliberate scoping decision, not an oversight — tell us if it blocks you
and we will look at a compatibility layer.

### Inbound referral links

There is no automatic deep-link handling — a library cannot observe your `Scene` or
`AppDelegate` URL callbacks. Wire it yourself:

```swift
.onOpenURL { url in
    Task { await Frak.clientOrNull?.appLink.handleReferral(url) }
}
```

## Info.plist and entitlements

Three things the SDK cannot do for you. Skip them and the failures are silent.

**`LSApplicationQueriesSchemes`.** Without it `isFrakAppInstalled()` is permanently false,
the install handoff never prefers the app over the store, and the console fills with
`canOpenURL: failed`:

```xml
<key>LSApplicationQueriesSchemes</key>
<array>
    <string>frakwallet</string>
</array>
```

**Associated Domains, plus an `apple-app-site-association` on your domain.** The share links
this SDK builds are `https://` links on *your* domain. Without the entitlement they open
Safari instead of your app, and no arrival is ever tracked:

```
applinks:yourdomain.example
```

**`.onOpenURL` only works in the SwiftUI `App` lifecycle.** There it receives universal links as
well as custom schemes, so the one handler above covers both. If your app still uses a UIKit
`AppDelegate`/`SceneDelegate`, it never fires — route both entry points yourself:

```swift
func scene(_ scene: UIScene, openURLContexts contexts: Set<UIOpenURLContext>) {
    guard let url = contexts.first?.url else { return }
    Task { await Frak.clientOrNull?.appLink.handleReferral(url) }
}

func scene(_ scene: UIScene, continue activity: NSUserActivity) {
    guard activity.activityType == NSUserActivityTypeBrowsingWeb,
        let url = activity.webpageURL
    else { return }
    Task { await Frak.clientOrNull?.appLink.handleReferral(url) }
}
```

## Privacy manifest

Both targets ship a `PrivacyInfo.xcprivacy`. Since 1 May 2024 an SDK that uses a
required-reason API without declaring it gets **your** App Store upload rejected with
ITMS-91053, so keep the SDK current.

One thing our manifest cannot cover for you: `Interaction.custom(_:data:)` takes an
arbitrary `[String: String]` that the SDK persists and transmits. If you put an email
address or a user id in there, your binary's privacy declarations need to say so.

## Contributing

**This repository is generated.** Its `main` branch is force-pushed from
[`frak-id/wallet`](https://github.com/frak-id/wallet) (`sdk/ios/`) on each release, so
commits and pull requests opened here are overwritten by the next tag.

Issues and pull requests belong on [`frak-id/wallet`](https://github.com/frak-id/wallet).

## License

Apache-2.0. See [`LICENSE`](./LICENSE) — deliberately not the monorepo's GPL-3.0,
because this is statically linked into closed-source App Store binaries.
