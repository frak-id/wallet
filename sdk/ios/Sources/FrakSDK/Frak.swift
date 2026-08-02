import Foundation

/// Entry point. Call `initialize(_:)` once, then use `client`.
///
/// ```swift
/// Frak.initialize(FrakConfig(merchantId: "...", metadata: FrakMetadata(name: "Acme")))
///
/// let reward = try await Frak.client.bestReward(targetInteraction: "purchase")
/// ```
public enum Frak {
    private static let lock = NSLock()
    nonisolated(unsafe) private static var instance: (any FrakClient)?
    // Kept alongside the client so preloadSharing can be read without widening FrakClient.
    nonisolated(unsafe) private static var configuration: FrakConfig?

    // Non-blocking, no I/O, never throws. Second call is a no-op (first config wins).
    public static func initialize(_ config: FrakConfig) {
        let logger = FrakLogger(level: config.logLevel, sink: config.logSink)
        let effective = config.withBundleIdFromMainBundle()
        let missingIdentity = effective.merchantId == nil && effective.bundleId == nil

        // Logging must not happen while `lock` is held (a sink reading Frak.client would
        // deadlock); the switch below emits every log line after the lock is released.
        enum Outcome {
            case alreadyInitialized
            case missingStore
            case initialized
        }

        let outcome: Outcome = {
            lock.lock()
            defer { lock.unlock() }

            if instance != nil {
                return .alreadyInitialized
            }

            guard let store = UserDefaultsStore(),
                let identityStore = UserDefaultsStore(suiteName: UserDefaultsStore.identitySuiteName)
            else {
                return .missingStore
            }

            instance = DefaultFrakClient(
                config: effective,
                store: store,
                identity: AnonymousIdStore(
                    keyStore: PersistedDeviceKeyStore(store: identityStore),
                    store: identityStore,
                    logger: logger,
                    // App scope == merchant scope; regenerated if this ever changes.
                    merchantMarker: effective.merchantId ?? effective.bundleId ?? "",
                    trackingEnabled: effective.trackingEnabled
                ),
                queue: EventQueue(fileURL: EventQueue.defaultFileURL(logger: logger), logger: logger),
                launcher: SystemAppLauncher(),
                logger: logger
            )
            configuration = effective
            return .initialized
        }()

        switch outcome {
        case .alreadyInitialized:
            logger.warn("Frak.initialize was called more than once. The first configuration is kept.")
        case .missingStore:
            if missingIdentity {
                logger.error(
                    "FrakConfig has neither a merchantId nor a bundleId. "
                        + "Every SDK call will fail with merchantResolutionFailed."
                )
            }
            logger.error("Frak could not open its UserDefaults suite. The SDK will not initialize.")
        case .initialized:
            if missingIdentity {
                logger.error(
                    "FrakConfig has neither a merchantId nor a bundleId. "
                        + "Every SDK call will fail with merchantResolutionFailed."
                )
            }
            logger.info("Frak \(FrakSDKVersion.current) initialized.")
        }
    }

    public static var client: any FrakClient {
        get throws {
            lock.lock()
            defer { lock.unlock() }
            guard let instance else { throw FrakError.notInitialized }
            return instance
        }
    }

    // Pure/static: works before initialize(_:) has run. Decode-only — arrival tracking
    // and the self-referral guard are FrakClient.handleReferralLink(_:).
    public static func parseReferralLink(_ url: String) -> FrakContext? {
        SharingLinkBuilder.parse(url)
    }

    public static func parseReferralLink(_ url: URL) -> FrakContext? {
        SharingLinkBuilder.parse(url.absoluteString)
    }

    // Mirrors FrakConfig.preloadSharing for FrakSDKUI. Lives here (not FrakClient) so
    // growing it doesn't break merchant hand-written fakes of that protocol.
    public static var preloadSharing: Bool {
        lock.lock()
        defer { lock.unlock() }
        return configuration?.preloadSharing ?? false
    }

    public static var isInitialized: Bool {
        lock.lock()
        defer { lock.unlock() }
        return instance != nil
    }

    static func resetForTesting() {
        lock.lock()
        defer { lock.unlock() }
        instance = nil
        configuration = nil
    }
}

extension FrakConfig {
    fileprivate func withBundleIdFromMainBundle() -> FrakConfig {
        guard merchantId == nil, bundleId == nil, let bundleId = Bundle.main.bundleIdentifier else {
            return self
        }
        return withBundleId(bundleId)
    }
}
