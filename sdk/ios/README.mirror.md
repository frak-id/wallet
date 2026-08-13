# Frak iOS SDK

Referral tracking and rewards for iOS apps. Zero third-party dependencies.

> **Pre-release.** This package has not had a device or simulator pass. The sharing
> sheet and the install handoff have never been exercised outside a test suite. Pin an
> exact version and expect breaking changes until 1.0.

## Install

Xcode → File → Add Package Dependencies → `https://github.com/frak-id/frak-ios-sdk`

Or in a `Package.swift`:

```swift
dependencies: [
    .package(url: "https://github.com/frak-id/frak-ios-sdk.git", exact: "0.1.0-alpha.1")
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

## Quickstart

```swift
import FrakSDK

Frak.initialize(
    FrakConfig(
        merchantId: "your-merchant-id",
        metadata: FrakMetadata(name: "Your App", currency: .eur)
    )
)
```

`Frak.client` is throwing-synchronous; every namespace member on it is `async`:

```swift
let reward = await Frak.clientOrNull?.rewards.best(...)
try await Frak.client.tracking.purchase(...)
```

### Sharing sheet

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

### Inbound referral links

There is no automatic deep-link handling — a library cannot observe your `Scene` or
`AppDelegate` URL callbacks. Wire it yourself:

```swift
.onOpenURL { url in
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
